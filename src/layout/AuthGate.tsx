import type { Session } from '@supabase/supabase-js'
import { MailCheck } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../storage'

interface Account {
  email: string | null
  signOut: () => Promise<void>
}

const AccountContext = createContext<Account | null>(null)

/** The signed-in account, or null in local-only mode. */
export function useAccount(): Account | null {
  return useContext(AccountContext)
}

/**
 * In cloud mode, shows the sign-in screen until there is a Supabase session.
 * In local-only mode it renders its children straight away.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // A fresh page load keeps the journal's in-memory cache scoped to one account.
      if (event === 'SIGNED_OUT') window.location.replace('/')
      else setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) return <>{children}</>
  if (session === undefined) return <div className="auth-screen" aria-busy="true" />
  if (!session) return <SignIn />

  const account: Account = {
    email: session.user.email ?? null,
    signOut: async () => {
      await supabase!.auth.signOut()
    },
  }
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const address = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('Enter an email address like name@example.com.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(/rate/i.test(error.message) ? 'Too many sign-in emails. Wait a minute and try again.' : error.message)
    else setSentTo(address)
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark" aria-hidden>
            <span />
          </span>
          Palate
        </div>
        {sentTo ? (
          <>
            <MailCheck size={28} className="auth-icon" aria-hidden />
            <h1>Check your email</h1>
            <p className="muted">
              We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device to continue.
            </p>
            <button type="button" className="btn" onClick={() => setSentTo(null)}>
              Use a different email
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="form-stack" noValidate>
            <h1>Sign in to your journal</h1>
            <p className="muted">Your foods, meals and photos sync to every device you sign in on. No password needed.</p>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
              {error && <span className="field-error">{error}</span>}
            </label>
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
