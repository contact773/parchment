import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './IconButton'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descId = `${baseId}-desc`

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Focus management: move focus into the dialog on open, trap Tab inside it, and
  // restore focus to the previously-focused element on close.
  useEffect(() => {
    if (!open) return
    prevFocus.current = (document.activeElement as HTMLElement) ?? null
    const dialog = dialogRef.current
    const focusables = () =>
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null) : []
    const initial = focusables()[0] ?? dialog
    initial?.focus()
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) {
        e.preventDefault()
        dialog?.focus()
        return
      }
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    dialog?.addEventListener('keydown', onTab)
    return () => {
      dialog?.removeEventListener('keydown', onTab)
      prevFocus.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-auto w-full rounded-xl border border-border bg-surface shadow-panel animate-scale-in focus:outline-none',
          sizeMap[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="text-lg font-semibold text-text">{title}</h2>}
              {description && <p id={descId} className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-1.5 shrink-0">
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
