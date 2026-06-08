import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

/** Lightweight popover menu anchored to a trigger element. */
export function Menu({
  trigger,
  items,
  align = 'end',
  width = 200,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    let left = align === 'end' ? r.right - width : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    const top = Math.min(r.bottom + 6, window.innerHeight - 12)
    setPos({ top, left })
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', () => setOpen(false), true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      {trigger({ open, toggle: () => setOpen((v) => !v), ref: triggerRef })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 animate-scale-in overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-panel"
            style={{ top: pos.top, left: pos.left, width }}
          >
            {items.map((item, i) =>
              item.separator ? (
                <div key={i} className="my-1 h-px bg-border" />
              ) : (
                <button
                  key={i}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onClick?.()
                  }}
                  className={cn(
                    'menu-item',
                    item.danger && 'text-danger hover:bg-danger/10',
                    item.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
