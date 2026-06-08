import { useEffect, useState } from 'react'
import { Flame, Timer, RotateCcw, Pencil } from 'lucide-react'
import { useUI } from '@/store/useUI'
import { useSettings } from '@/store/useSettings'
import { Progress } from '@/components/ui/misc'
import { formatNumber } from '@/lib/format'

function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function GoalsWidget() {
  const sessionStartedAt = useUI((s) => s.sessionStartedAt)
  const sessionWords = useUI((s) => s.sessionWords)
  const resetSession = useUI((s) => s.resetSession)
  const dailyGoal = useSettings((s) => s.stats.dailyGoal)
  const setDailyGoal = useSettings((s) => s.setDailyGoal)
  const todayWords = useSettings((s) => s.todayWords())
  const streak = useSettings((s) => s.streak())

  const [, setTick] = useState(0)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = sessionStartedAt ? Date.now() - sessionStartedAt : 0
  const goalPct = dailyGoal ? (todayWords / dailyGoal) * 100 : 0

  return (
    <div className="space-y-2.5 border-t border-border px-3 py-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <Timer size={13} /> Session
        </span>
        <span className="tabular-nums text-text">
          {formatNumber(sessionWords)} words · {fmtDuration(elapsed)}
        </span>
        <button onClick={resetSession} title="Reset session" className="text-muted hover:text-text">
          <RotateCcw size={13} />
        </button>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            Daily goal
            <button onClick={() => setEditing((v) => !v)} className="hover:text-text">
              <Pencil size={11} />
            </button>
          </span>
          {editing ? (
            <input
              type="number"
              autoFocus
              defaultValue={dailyGoal}
              onBlur={(e) => {
                setDailyGoal(Number(e.target.value))
                setEditing(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-16 rounded border border-accent/50 bg-surface px-1 py-0 text-right text-xs outline-none"
            />
          ) : (
            <span className="tabular-nums text-text">
              {formatNumber(todayWords)} / {formatNumber(dailyGoal)}
            </span>
          )}
        </div>
        <Progress value={goalPct} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Flame size={13} className={streak > 0 ? 'text-accent' : ''} />
        {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
      </div>
    </div>
  )
}
