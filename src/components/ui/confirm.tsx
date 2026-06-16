import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Pending = { opts: ConfirmOptions; resolve: (ok: boolean) => void }

let opener: ((opts: ConfirmOptions) => Promise<boolean>) | null = null

/**
 * Imperative, styled confirm dialog. Resolves to true/false.
 * Falls back to window.confirm if <ConfirmRoot/> isn't mounted.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (!opener) return Promise.resolve(window.confirm(opts.message))
  return opener(opts)
}

/** Mount once near the app root. */
export function ConfirmRoot() {
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    opener = (opts) => new Promise<boolean>((resolve) => setPending({ opts, resolve }))
    return () => {
      opener = null
    }
  }, [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  if (!pending) return null
  const { title, message, confirmLabel, cancelLabel, danger } = pending.opts
  return (
    <Modal
      open
      onClose={() => close(false)}
      title={title ?? 'Are you sure?'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
            {confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-text">{message}</p>
    </Modal>
  )
}
