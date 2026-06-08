import { Routes, Route, Navigate } from 'react-router-dom'
import { useApplyTheme } from '@/hooks/useApplyTheme'
import { Toaster } from '@/components/ui/Toaster'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Dashboard } from '@/pages/Dashboard'
import { Workspace } from '@/pages/Workspace'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  useApplyTheme()
  return (
    <>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/project/:projectId" element={<Workspace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      <Toaster />
    </>
  )
}
