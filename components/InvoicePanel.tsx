'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Invoice {
  id: string
  invoiceNumber: string | null
  description: string | null
  amount: number | null
  fileUrl: string
  fileName: string
  createdAt: string
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function InvoicePanel({
  customerId,
  canUpload,
}: {
  customerId: string
  canUpload: boolean
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    invoiceNumber: '',
    description: '',
    amount: '',
    file: null as File | null,
  })

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices?customerId=${customerId}`)
    if (res.ok) setInvoices(await res.json())
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!form.file) { setUploadError('Bitte eine PDF-Datei auswählen.'); return }
    setUploading(true)
    setUploadError('')

    const fd = new FormData()
    fd.append('file', form.file)
    fd.append('customerId', customerId)
    if (form.invoiceNumber) fd.append('invoiceNumber', form.invoiceNumber)
    if (form.description) fd.append('description', form.description)
    if (form.amount) fd.append('amount', form.amount)

    const res = await fetch('/api/invoices', { method: 'POST', body: fd })
    setUploading(false)

    if (!res.ok) {
      const data = await res.json()
      setUploadError(data.error || 'Upload fehlgeschlagen')
    } else {
      setShowForm(false)
      setForm({ invoiceNumber: '', description: '', amount: '', file: null })
      if (fileRef.current) fileRef.current.value = ''
      await load()
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmDelete(null)
    await load()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Rechnungen</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{invoices.length}</span>
        </div>
        {canUpload && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Rechnung hochladen
          </button>
        )}
      </div>

      {/* Upload form */}
      {canUpload && showForm && (
        <form
          onSubmit={handleUpload}
          className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-purple-900">Neue Rechnung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rechnungsnummer</label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={e => setForm({ ...form, invoiceNumber: e.target.value })}
                placeholder="z.B. RE-2024-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Betrag (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Kurzbeschreibung"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PDF-Datei *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              required
              onChange={e => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
            />
          </div>
          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg"
            >
              {uploading ? 'Hochladen...' : 'Hochladen'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Invoice list */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden...</p>
      ) : invoices.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-400">Keine Rechnungen vorhanden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rechnungsnr.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beschreibung</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Betrag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {inv.invoiceNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {inv.description ?? inv.fileName}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {inv.amount != null ? formatCurrency(inv.amount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={inv.fileUrl}
                        download={inv.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                      {canUpload && (
                        confirmDelete === inv.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(inv.id)}
                              disabled={deleting}
                              className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded"
                            >
                              {deleting ? '...' : 'Ja'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded"
                            >
                              Nein
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(inv.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
