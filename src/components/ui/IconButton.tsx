import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  size?: 'sm' | 'md'
  label?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, size = 'md', label, ...props }, ref) => (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-muted transition-colors',
        'hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        active && 'bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent',
        className,
      )}
      {...props}
    />
  ),
)
IconButton.displayName = 'IconButton'
