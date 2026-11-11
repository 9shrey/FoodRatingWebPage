import { BarChart3, BookOpen, Compass, Map as MapIcon, Plus, Table2 } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { FoodDetailPanel } from '../components/food/FoodDetailPanel'
import { LogFoodDialog } from '../components/food/LogFoodDialog'
import { useJournal } from '../state/JournalProvider'
import { useUI } from '../state/UIProvider'
import { DataMenu } from './DataMenu'

const NAV = [
  { to: '/', label: 'Journal', short: 'Journal', icon: BookOpen, end: true },
  { to: '/foods', label: 'Foods', short: 'Foods', icon: Table2 },
  { to: '/map', label: 'Map', short: 'Map', icon: MapIcon },
  { to: '/analytics', label: 'Analytics', short: 'Analytics', icon: BarChart3 },
  { to: '/discover', label: 'Discover', short: 'Discover', icon: Compass },
]

export function AppShell() {
  const { openLog } = useUI()
  const { status, error } = useJournal()
  const location = useLocation()

  // "n" opens the log dialog from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable && !document.querySelector('dialog[open]')) {
        e.preventDefault()
        openLog()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openLog])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className={`shell${location.pathname === '/map' ? ' shell-map' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="Palate, home">
            <span className="brand-mark" aria-hidden>
              <span />
            </span>
            Palate
          </NavLink>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <DataMenu />
            <button type="button" className="btn btn-primary log-btn" onClick={() => openLog()} data-tip="Shortcut: N">
              <Plus size={16} /> Log food
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="main">
        {status === 'error' ? (
          <div className="page">
            <div className="banner banner-error" role="alert">
              <span>
                <strong>Storage unavailable.</strong> {error} Nothing has been lost — try reloading, or open the app in a normal browser window.
              </span>
              <button type="button" className="btn btn-sm" onClick={() => location && window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <button type="button" className="fab" onClick={() => openLog()} aria-label="Log food">
        <Plus size={24} />
      </button>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab">
            <n.icon size={20} aria-hidden />
            <span>{n.short}</span>
          </NavLink>
        ))}
      </nav>

      <FoodDetailPanel />
      <LogFoodDialog />
    </div>
  )
}
