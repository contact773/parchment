import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Download, Loader2, RefreshCw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Progress, Switch } from '@/components/ui/misc'
import { APP_VERSION, CHANNEL_LABEL, RELEASES_URL } from '@/lib/appInfo'
import { useSettings } from '@/store/useSettings'
import { useUI } from '@/store/useUI'
import { formatNumber, timeAgo } from '@/lib/format'
import { Markdownish } from '@/features/story-assistant/Markdownish'
import { describeStatus, isBusy, type UpdateStatus } from './updateModel'
import {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  resetUpdateState,
  skipVersion,
  updateDiagnostics,
  useUpdates,
} from './updateService'

/**
 * Settings ▸ Updates.
 *
 * Shows the running version, the channel it follows, when it last looked, and
 * one button per legal next step. Every state the service can be in has a
 * visible representation here — including the failures, because "nothing
 * happened" is the worst possible answer to "check for updates".
 */
export function UpdatesSettings() {
  const state = useUpdates()
  const prefs = useSettings((s) => s.settings.updates)
  const setSettings = useSettings((s) => s.setSettings)
  const toast = useUI((s) => s.toast)
  const [showNotes, setShowNotes] = useState(false)

  const busy = isBusy(state.status)
  const browser = state.status === 'unsupported'

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(updateDiagnostics())
      toast('Diagnostics copied', 'success')
    } catch {
      toast('Could not copy diagnostics', 'error')
    }
  }

  return (
    <div className="space-y-3">
      <div className="mb-5">
        <h2 className="font-serif text-xl font-semibold text-ink">Updates</h2>
        <p className="mt-1 text-sm text-muted">
          Parchment installs only releases signed by its publisher, and never restarts without asking.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">
              Parchment {APP_VERSION}
              <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {CHANNEL_LABEL[state.channel]} channel
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <StatusIcon status={state.status} />
              <span>{describeStatus(state)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {state.status === 'available' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => skipVersion(state.update!.version)}>
                  Skip this version
                </Button>
                <Button variant="primary" size="sm" onClick={() => void downloadUpdate()}>
                  <Download size={15} /> Download
                </Button>
              </>
            )}
            {state.status === 'ready' && (
              <Button variant="primary" size="sm" onClick={() => void installUpdate()}>
                <RotateCw size={15} /> Install and restart
              </Button>
            )}
            {state.status === 'error' && (
              <Button variant="secondary" size="sm" onClick={() => void resetUpdateState()}>
                Dismiss
              </Button>
            )}
            {!browser && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void checkForUpdates({ manual: true })}>
                {state.status === 'checking' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Check now
              </Button>
            )}
          </div>
        </div>

        {state.status === 'downloading' && (
          <div className="mt-3">
            <Progress value={(state.progress ?? 0) * 100} />
            <div className="mt-1 text-xs text-muted">
              {state.totalBytes
                ? `${formatNumber(Math.round(state.downloadedBytes / 1024))} of ${formatNumber(
                    Math.round(state.totalBytes / 1024),
                  )} KB`
                : `${formatNumber(Math.round(state.downloadedBytes / 1024))} KB downloaded`}
            </div>
          </div>
        )}

        {(state.status === 'installing' || state.status === 'restarting') && (
          <p className="mt-3 rounded-md bg-surface-2/60 px-3 py-2 text-xs text-muted">
            Saving your open document and map, then restarting. Nothing is installed until every pending change has
            reached this device's storage.
          </p>
        )}

        {state.error && (
          <div className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
            <div className="text-xs text-danger">{state.error.message}</div>
            <div className="mt-2 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void copyDiagnostics()}>
                <Copy size={14} /> Copy diagnostic details
              </Button>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent underline underline-offset-2"
              >
                Download the installer manually
              </a>
            </div>
          </div>
        )}
      </div>

      {state.update && (state.status === 'available' || state.status === 'ready') && state.update.notes && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="text-sm font-medium text-accent"
            aria-expanded={showNotes}
          >
            {showNotes ? 'Hide' : 'Show'} what's new in {state.update.version}
          </button>
          {showNotes && (
            <div className="mt-2 text-sm text-text">
              <Markdownish text={state.update.notes} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text">Check for updates on launch</div>
          <div className="text-xs text-muted">
            Runs quietly in the background a few seconds after Parchment opens. It never delays your work and never
            installs anything on its own.
          </div>
        </div>
        <Switch
          checked={prefs.checkOnStartup}
          label="Check for updates on launch"
          onChange={(v) => setSettings({ updates: { ...prefs, checkOnStartup: v } })}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text">Last checked</div>
          <div className="text-xs text-muted">
            {prefs.lastCheckedAt ? timeAgo(prefs.lastCheckedAt) : 'Never'}
            {prefs.skippedVersion && ` · skipping ${prefs.skippedVersion}`}
          </div>
        </div>
        {prefs.skippedVersion && (
          <Button variant="ghost" size="sm" onClick={() => setSettings({ updates: { ...prefs, skippedVersion: null } })}>
            Stop skipping
          </Button>
        )}
      </div>

      {browser && (
        <p className="rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-xs text-muted">
          You are running Parchment in a browser, which always loads the current version — there is no installed copy to
          update. The desktop app updates itself from signed releases.{' '}
          <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            Download Parchment for Windows
          </a>
          .
        </p>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: UpdateStatus }) {
  if (status === 'checking' || status === 'downloading' || status === 'installing' || status === 'restarting') {
    return <Loader2 size={13} className="animate-spin text-accent" />
  }
  if (status === 'error') return <AlertTriangle size={13} className="text-danger" />
  if (status === 'available' || status === 'ready') return <Download size={13} className="text-accent" />
  if (status === 'up-to-date') return <CheckCircle2 size={13} className="text-success" />
  return null
}
