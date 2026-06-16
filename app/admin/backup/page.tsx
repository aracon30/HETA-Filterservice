'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Backup = { name: string; size: number; createdAt: string }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function BackupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadBackups = async () => {
    const res = await fetch('/api/admin/backup')
    const data = await res.json()
    setBackups(data.backups ?? [])
  }

  // Hooks must run unconditionally; the admin guard comes after all hooks.
  useEffect(() => { loadBackups() }, [])

  if (status === 'loading') return null
  if (!session || session.user.role !== 'ADMIN') { router.replace('/'); return null }

  const showMsg = (text: string, error = false) => {
    setMessage({ text, error })
    setTimeout(() => setMessage(null), 5000)
  }

  const createBackup = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/backup', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      showMsg(`Backup erstellt: ${data.name} (${formatSize(data.size)})`)
      loadBackups()
    } else {
      showMsg(data.error ?? 'Fehler beim Erstellen', true)
    }
    setLoading(false)
  }

  const deleteBackup = async (name: string) => {
    const res = await fetch('/api/admin/backup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) { showMsg('Backup gelöscht'); loadBackups() }
    else showMsg('Fehler beim Löschen', true)
    setConfirmDelete(null)
  }

  const restoreFromList = async (name: string) => {
    setRestoring(true)
    const res = await fetch('/api/admin/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (data.success) showMsg('Datenbank erfolgreich wiederhergestellt')
    else showMsg(data.error ?? 'Fehler beim Wiederherstellen', true)
    setRestoring(false)
    setConfirmRestore(null)
  }

  const restoreFromUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.sql')) { showMsg('Nur .sql Dateien erlaubt', true); return }

    setRestoring(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/restore', { method: 'POST', body: form })
    const data = await res.json()
    if (data.success) showMsg('Datenbank aus Upload wiederhergestellt')
    else showMsg(data.error ?? 'Fehler beim Wiederherstellen', true)
    setRestoring(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Datensicherung</h1>
      <p className="text-gray-500 text-sm mb-6">Datenbank-Backups erstellen, herunterladen und wiederherstellen.</p>

      {/* Statusmeldung */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.error ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-green-100 text-green-800 border border-green-300'}`}>
          {message.error ? '✗' : '✓'} {message.text}
        </div>
      )}

      {/* Backup erstellen */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">Backup erstellen</h2>
        <p className="text-sm text-gray-500 mb-4">Erstellt einen vollständigen Datenbank-Dump und speichert ihn auf dem Server.</p>
        <div className="flex gap-3">
          <button
            onClick={createBackup}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
              </svg>
            )}
            {loading ? 'Erstelle Backup...' : 'Backup jetzt erstellen'}
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            Backup hochladen & einspielen
            <input ref={fileRef} type="file" accept=".sql" className="hidden" onChange={restoreFromUpload} disabled={restoring}/>
          </label>
        </div>
      </div>

      {/* Backup-Liste */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Vorhandene Backups</h2>
          <button onClick={loadBackups} className="text-sm text-gray-500 hover:text-gray-700">
            ↻ Aktualisieren
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Noch keine Backups vorhanden</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {backups.map(b => (
              <li key={b.name} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-800">{b.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatDate(b.createdAt)} · {formatSize(b.size)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* Download */}
                  <a
                    href={`/api/admin/backup/download?name=${encodeURIComponent(b.name)}`}
                    download={b.name}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Download
                  </a>
                  {/* Wiederherstellen */}
                  {confirmRestore === b.name ? (
                    <div className="flex gap-1">
                      <button onClick={() => restoreFromList(b.name)} disabled={restoring}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50">
                        {restoring ? '...' : 'Ja, einspielen'}
                      </button>
                      <button onClick={() => setConfirmRestore(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRestore(b.name)}
                      className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                      Wiederherstellen
                    </button>
                  )}
                  {/* Löschen */}
                  {confirmDelete === b.name ? (
                    <div className="flex gap-1">
                      <button onClick={() => deleteBackup(b.name)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">
                        Löschen
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(b.name)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      Löschen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Restore-Overlay */}
      {restoring && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-8 py-6 text-center shadow-xl">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="font-medium text-gray-800">Datenbank wird wiederhergestellt...</p>
            <p className="text-sm text-gray-500 mt-1">Bitte warten, nicht schließen.</p>
          </div>
        </div>
      )}
    </div>
  )
}
