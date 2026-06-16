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

export function App() {
  useApplyTheme()
  useEffect(() => {
    void migrateChapterContentToScenes()
  }, [])
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
      <Toaster />
      <ConfirmRoot />
    </>
  )
}
