import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageSkeleton } from './layout/PageSkeleton'
import { AppShell } from './layout/AppShell'
import { AuthGate } from './layout/AuthGate'
import { DiscoverPage } from './pages/CollectionsPages'
import { DatabasePage } from './pages/DatabasePage'
import { JournalPage } from './pages/JournalPage'
import { JournalProvider } from './state/JournalProvider'
import { ToastProvider } from './state/ToastProvider'
import { UIProvider } from './state/UIProvider'

const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthGate>
        <JournalProvider>
          <UIProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<JournalPage />} />
                <Route path="foods" element={<DatabasePage />} />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <AnalyticsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="map"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <MapPage />
                    </Suspense>
                  }
                />
                <Route path="favourites" element={<Navigate to="/discover" replace />} />
                <Route path="discover" element={<DiscoverPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </UIProvider>
        </JournalProvider>
        </AuthGate>
      </ToastProvider>
    </BrowserRouter>
  )
}
