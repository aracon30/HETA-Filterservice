'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type ConfirmOptions = {
  title: string
  message: string
  /** Beschriftung des Bestätigungsbuttons. Default: "Löschen" */
  confirmLabel?: string
  /** Beschriftung des Abbrechen-Buttons. Default: "Abbrechen" */
  cancelLabel?: string
  /** Roter (destruktiver) Bestätigungsbutton. Default: true */
  danger?: boolean
}

type ConfirmState = ConfirmOptions & {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

const INITIAL: ConfirmState = {
  open: false,
  title: '',
  message: '',
  resolve: null,
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>(INITIAL)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const close = useCallback(
    (result: boolean) => {
      state.resolve?.(result)
      setState(s => ({ ...s, open: false, resolve: null }))
    },
    [state]
  )

  const danger = state.danger ?? true
  const confirmLabel = state.confirmLabel ?? 'Löschen'
  const cancelLabel = state.cancelLabel ?? 'Abbrechen'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => close(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{state.title}</h2>
            <p className="text-sm text-gray-600 mb-4">{state.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => close(true)}
                className={`flex-1 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmLabel}
              </button>
              <button
                onClick={() => close(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/**
 * Imperativer Bestätigungsdialog im App-Stil.
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Löschen', message: '…' }))) return
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm muss innerhalb von <ConfirmProvider> verwendet werden')
  return ctx
}
