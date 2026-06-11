'use client'

import { useState } from 'react'
import Link from 'next/link'
import HetaLogo from '@/components/HetaLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Ein Fehler ist aufgetreten.')
        setStatus('error')
      } else {
        setStatus('sent')
      }
    } catch {
      setErrorMsg('Verbindungsfehler. Bitte versuchen Sie es erneut.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center p-1.5">
            <HetaLogo className="h-full w-full" />
          </div>
          <span className="font-bold text-gray-900">HETA ServiceHub</span>
        </div>

        {status === 'sent' ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">E-Mail gesendet</h2>
            <p className="text-sm text-gray-500 mb-6">
              Falls ein Konto mit dieser E-Mail-Adresse existiert, erhalten Sie in Kürze einen Link zum Zurücksetzen Ihres Passworts. Der Link ist 2 Stunden gültig.
            </p>
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Passwort vergessen?</h1>
            <p className="text-sm text-gray-500 mb-6">
              Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zurücksetzen.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="ihre@email.de"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Senden...
                  </>
                ) : 'Link anfordern'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                ← Zurück zur Anmeldung
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
