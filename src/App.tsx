import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApplyTheme } from '@/hooks/useApplyTheme'
import { migrateChapterContentToScenes } from '@/data/repo'
import { Toaster } from '@/components/ui/Toaster'
import { ConfirmRoot } from '@/components/ui/confirm'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Dashboard } from '@/pages/Dashboard'
import { Workspace } from '@/pages/Workspace'
import { SettingsPage } from '@/pages/SettingsPage'
import { HelpPage } from '@/pages/HelpPage'
import { initUpdates } from '@/features/updates/updateService'
import { UpdateNotice } from '@/features/updates/UpdateNotice'

export function App() {
  useApplyTheme()
  useEffect(() => {
    void migrateChapterContentToScenes()
  }, [])
  // Updates are wired up here, not inside the workspace: a writer must be able
  // to receive and install one without opening a project. The check itself is
  // deferred and never blocks the first render.
  useEffect(() => initUpdates(), [])
  return (
    <>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/project/:projectId" element={<Workspace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      <UpdateNotice />
      <Toaster />
      <ConfirmRoot />
    </>
  )
}
