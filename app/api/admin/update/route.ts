import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const APP_DIR = process.cwd()

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.user)
    return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), { status: 401 })
  if (session.user.role !== 'ADMIN')
    return new Response(JSON.stringify({ error: 'Nur Admins können Updates durchführen' }), { status: 403 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, output: string, error = false) => {
        const line = `data: ${JSON.stringify({ step, output, error })}\n\n`
        controller.enqueue(encoder.encode(line))
      }

      const run = async (label: string, cmd: string, opts?: { ignoreFail?: boolean }) => {
        try {
          const { stdout, stderr } = await execAsync(cmd, { cwd: APP_DIR, timeout: 300000 })
          send(label, (stdout + stderr).trim() || '(kein Output)')
          return true
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          send(label, msg, !opts?.ignoreFail)
          return false
        }
      }

      send('Projektverzeichnis', APP_DIR)

      // Version vor Update
      const { stdout: hashBefore } = await execAsync('git rev-parse --short HEAD', { cwd: APP_DIR })
        .catch(() => ({ stdout: 'unbekannt' }))
      send('Version vor Update', hashBefore.trim())

      // Prüfen ob package.json / package-lock.json sich ändern — BEVOR git reset
      const { stdout: pkgDiff } = await execAsync(
        'git diff HEAD origin/main -- package.json package-lock.json',
        { cwd: APP_DIR }
      ).catch(() => ({ stdout: '' }))
      const packagesChanged = pkgDiff.trim().length > 0
      send('Pakete geändert?', packagesChanged ? 'Ja — node_modules wird neu installiert' : 'Nein — Installation wird übersprungen')

      // Git fetch
      await run('Git Fetch', 'git fetch origin main')

      // skip-worktree / assume-unchanged zurücksetzen
      await run(
        'Git Flags zurücksetzen',
        "git ls-files -v | grep '^[hS]' | awk '{print $2}' | xargs -r git update-index --no-skip-worktree --no-assume-unchanged",
        { ignoreFail: true }
      )
      await run('Git Sparse-Checkout deaktivieren', 'git sparse-checkout disable 2>/dev/null || true', { ignoreFail: true })

      const pulled = await run('Git Reset', 'git reset --hard origin/main')
      if (!pulled) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: false })}\n\n`))
        controller.close()
        return
      }

      await run('Änderungen (letzte 10 Commits)', 'git log --oneline -10')

      // Kritische Dateien prüfen
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs')
      const critical = [
        'lib/auth.ts', 'lib/prisma.ts', 'lib/permissions.ts', 'lib/constants.ts',
        'lib/plant-types.ts', 'types/next-auth.d.ts', 'components/StatusBadge.tsx',
        'components/JobCalendar.tsx', 'components/Sidebar.tsx',
        'tailwind.config.ts', 'next.config.js',
      ]
      const missing = critical.filter(f => !fs.existsSync(`${APP_DIR}/${f}`))
      for (const f of missing) {
        await run(`Git Extract: ${f}`, `git show origin/main:"${f}" > "${f}"`, { ignoreFail: true })
      }
      const stillMissing = critical.filter(f => !fs.existsSync(`${APP_DIR}/${f}`))
      const fileSizes = critical.map(f => {
        try { return `${f}: ${fs.statSync(`${APP_DIR}/${f}`).size}B` } catch { return `${f}: FEHLT` }
      }).join('\n')
      send('Datei-Check', fileSizes, stillMissing.length > 0)

      // Abhängigkeiten nur neu installieren wenn package.json / package-lock.json geändert
      if (packagesChanged) {
        await run('Cache leeren', 'rm -rf .next node_modules/.cache tsconfig.tsbuildinfo')
        await run('node_modules entfernen', 'rm -rf node_modules')
        const installed = await run('npm ci', 'npm ci --prefer-offline')
        if (!installed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: false })}\n\n`))
          controller.close()
          return
        }
      } else {
        // .next-Cache trotzdem leeren damit der Build sauber ist
        await run('Cache leeren (.next)', 'rm -rf .next tsconfig.tsbuildinfo')
      }

      // Prisma
      await run('Prisma generate', 'npx prisma generate')
      await run('Prisma db push', 'npx prisma db push --accept-data-loss')

      // Build
      const built = await run('Build', 'npm run build')
      if (!built) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: false })}\n\n`))
        controller.close()
        return
      }

      const { stdout: hashAfter } = await execAsync('git rev-parse --short HEAD', { cwd: APP_DIR })
        .catch(() => ({ stdout: 'unbekannt' }))
      send('Version nach Update', hashAfter.trim())

      await run('Neustart', 'pm2 restart heta-servicehub 2>/dev/null || pm2 restart all 2>/dev/null || true', { ignoreFail: true })

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
