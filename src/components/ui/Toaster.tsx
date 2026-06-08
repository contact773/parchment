import { createPortal } from 'react-dom'
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react'
import { useUI } from '@/store/useUI'
import { cn } from '@/lib/utils'

const icons = {
  success: <CheckCircle2 size={16} className="text-success" />,
  info: <Info size={16} className="text-accent" />,
  error: <AlertCircle size={16} className="text-danger" />,
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-panel animate-fade-up',
          )}
        >
          {icons[t.kind]}
          <span className="text-sm text-text">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="ml-1 text-muted hover:text-text">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
