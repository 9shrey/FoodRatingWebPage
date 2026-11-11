import type { Session } from '@supabase/supabase-js'
import { Hourglass, Lock, MailCheck } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../storage'

interface Account {
  email: string | null
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AccountContext = createContext<Account | null>(null)

/** The signed-in account, or null in local-only mode. */
export function useAccount(): Account | null {
  return useContext(AccountContext)
}

interface Access {
  allowed: boolean
  admin: boolean
}

/**
 * In cloud mode, shows the sign-in screen until there is a Supabase session
 * whose email is on the allowlist. In local-only mode it renders its children straight away.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [access, setAccess] = useState<Access | null>(null)
  const userId = session?.user.id

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

  useEffect(() => {
    if (!supabase || !userId) return
    let live = true
    Promise.all([supabase.rpc('is_allowed'), supabase.rpc('is_admin')]).then(([a, b]) => {
      if (live) setAccess({ allowed: a.data === true, admin: b.data === true })
    })
    return () => {
      live = false
    }
  }, [userId])

  if (!supabase) return <>{children}</>
  if (session === undefined) return <div className="auth-screen" aria-busy="true" />
  if (!session) return <SignIn />
  if (!access) return <div className="auth-screen" aria-busy="true" />

  const signOut = async () => {
    await supabase!.auth.signOut()
  }
  if (!access.allowed) return <NoAccess email={session.user.email ?? ''} signOut={signOut} />

  const account: Account = { email: session.user.email ?? null, isAdmin: access.admin, signOut }
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark" aria-hidden>
            <span />
          </span>
          Palate
        </div>
        {children}
      </div>
    </main>
  )
}

function NoAccess({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  return (
    <AuthCard>
      <Lock size={28} className="auth-icon" aria-hidden />
      <h1>No access</h1>
      <p className="muted">
        <strong>{email}</strong> isn’t approved to use Palate. Sign out and request access with this email.
      </p>
      <button type="button" className="btn" onClick={signOut}>
        Sign out
      </button>
    </AuthCard>
  )
}

type Step =
  | { kind: 'email' }
  | { kind: 'sent'; email: string }
  | { kind: 'request'; email: string }
  | { kind: 'pending'; email: string; justSent: boolean }
  | { kind: 'denied'; email: string }

function SignIn() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('Enter an email address like name@example.com.')
      return
    }
    setBusy(true)
    setError(null)
    const status = await supabase!.rpc('access_status', { p_email: address })
    if (status.error) {
      setBusy(false)
      setError('Couldn’t reach the server. Try again.')
      return
    }
    if (status.data !== 'allowed') {
      setBusy(false)
      if (status.data === 'pending') setStep({ kind: 'pending', email: address, justSent: false })
      else if (status.data === 'denied') setStep({ kind: 'denied', email: address })
      else setStep({ kind: 'request', email: address })
      return
    }
    const { error } = await supabase!.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(/rate/i.test(error.message) ? 'Too many sign-in emails. Wait a minute and try again.' : error.message)
    else setStep({ kind: 'sent', email: address })
  }

  const back = () => {
    setError(null)
    setStep({ kind: 'email' })
  }

  if (step.kind === 'sent')
    return (
      <AuthCard>
        <MailCheck size={28} className="auth-icon" aria-hidden />
        <h1>Check your email</h1>
        <p className="muted">
          We sent a sign-in link to <strong>{step.email}</strong>. Open it on this device to continue.
        </p>
        <button type="button" className="btn" onClick={back}>
          Use a different email
        </button>
      </AuthCard>
    )

  if (step.kind === 'request') return <RequestAccess email={step.email} onBack={back} onSent={() => setStep({ kind: 'pending', email: step.email, justSent: true })} />

  if (step.kind === 'pending')
    return (
      <AuthCard>
        <Hourglass size={28} className="auth-icon" aria-hidden />
        <h1>{step.justSent ? 'Request sent' : 'Request pending'}</h1>
        <p className="muted">
          Access for <strong>{step.email}</strong> is waiting for approval. Once it’s approved, come back and sign in with this email.
        </p>
        <button type="button" className="btn" onClick={back}>
          Back to sign in
        </button>
      </AuthCard>
    )

  if (step.kind === 'denied')
    return (
      <AuthCard>
        <Lock size={28} className="auth-icon" aria-hidden />
        <h1>Request not approved</h1>
        <p className="muted">
          Access for <strong>{step.email}</strong> wasn’t approved.
        </p>
        <button type="button" className="btn" onClick={back}>
          Back to sign in
        </button>
      </AuthCard>
    )

  return (
    <AuthCard>
      <form onSubmit={submit} className="form-stack" noValidate>
        <h1>Sign in to your journal</h1>
        <p className="muted">Palate is invite-only for now. Approved emails get a sign-in link, no password needed.</p>
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
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </AuthCard>
  )
}

function RequestAccess({ email, onBack, onSent }: { email: string; onBack: () => void; onSent: () => void }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.rpc('request_access', { p_email: email, p_name: name, p_note: note })
    setBusy(false)
    if (error) setError('Couldn’t send the request. Try again.')
    else onSent()
  }

  return (
    <AuthCard>
      <form onSubmit={submit} className="form-stack" noValidate>
        <h1>Request access</h1>
        <p className="muted">
          <strong>{email}</strong> isn’t on the guest list yet. Send a request and you can sign in once it’s approved.
        </p>
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Note (optional)</span>
          <textarea className="textarea" value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="How do you know me?" />
          {error && <span className="field-error">{error}</span>}
        </label>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
        <button type="button" className="btn" onClick={onBack} disabled={busy}>
          Use a different email
        </button>
      </form>
    </AuthCard>
  )
}
