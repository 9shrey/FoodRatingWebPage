import type { Session } from '@supabase/supabase-js'
import { Hourglass, KeyRound, Lock, MailCheck } from 'lucide-react'
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
  /** False when the account still needs a password (first link sign-in, or a forgotten one). */
  hasPassword: boolean
}

/** Set before emailing a link for a forgotten password, so the next sign-in asks for a new one. */
const RESET_KEY = 'palate:set-password'

function flagReset(on: boolean) {
  try {
    if (on) localStorage.setItem(RESET_KEY, '1')
    else localStorage.removeItem(RESET_KEY)
  } catch {
    // Storage blocked: the user can still sign in with the link, just without the reset prompt.
  }
}

function resetFlagged(): boolean {
  try {
    return localStorage.getItem(RESET_KEY) === '1'
  } catch {
    return false
  }
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
    const reset = resetFlagged()
    Promise.all([supabase.rpc('is_allowed'), supabase.rpc('is_admin'), supabase.rpc('has_password')]).then(([a, b, c]) => {
      // If has_password isn't deployed yet, don't trap anyone on the set-password screen.
      const hasPassword = reset ? false : c.error ? true : c.data === true
      if (live) setAccess({ allowed: a.data === true, admin: b.data === true, hasPassword })
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
  if (!access.hasPassword)
    return (
      <SetPassword
        email={session.user.email ?? ''}
        onDone={() => {
          flagReset(false)
          setAccess({ ...access, hasPassword: true })
        }}
      />
    )

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
  | { kind: 'password'; email: string }
  | { kind: 'create'; email: string }
  | { kind: 'sent'; email: string; reason: 'first' | 'forgot' }
  | { kind: 'request'; email: string }
  | { kind: 'pending'; email: string; justSent: boolean }
  | { kind: 'denied'; email: string }

const MIN_PASSWORD = 8

/** Signs in with a one-time email link. Only used for accounts without a password, or a forgotten one. */
async function sendLink(email: string): Promise<string | null> {
  const { error } = await supabase!.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (!error) return null
  return /rate/i.test(error.message) ? 'Too many emails. Wait a minute and try again.' : error.message
}

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
    const status = await supabase!.rpc('account_status', { p_email: address })
    setBusy(false)
    if (status.error) {
      setError('Couldn’t reach the server. Try again.')
      return
    }
    switch (status.data) {
      case 'password':
        return setStep({ kind: 'password', email: address })
      case 'new':
        return setStep({ kind: 'create', email: address })
      case 'link': {
        setBusy(true)
        const err = await sendLink(address)
        setBusy(false)
        return err ? setError(err) : setStep({ kind: 'sent', email: address, reason: 'first' })
      }
      case 'pending':
        return setStep({ kind: 'pending', email: address, justSent: false })
      case 'denied':
        return setStep({ kind: 'denied', email: address })
      default:
        return setStep({ kind: 'request', email: address })
    }
  }

  const back = () => {
    setError(null)
    setStep({ kind: 'email' })
  }

  if (step.kind === 'password' || step.kind === 'create')
    return (
      <PasswordStep
        email={step.email}
        mode={step.kind === 'create' ? 'create' : 'sign-in'}
        onBack={back}
        onForgot={() => setStep({ kind: 'sent', email: step.email, reason: 'forgot' })}
      />
    )

  if (step.kind === 'sent')
    return (
      <AuthCard>
        <MailCheck size={28} className="auth-icon" aria-hidden />
        <h1>Check your email</h1>
        <p className="muted">
          We sent a sign-in link to <strong>{step.email}</strong>.{' '}
          {step.reason === 'first'
            ? 'This is a one-time step: after you open it, you’ll set a password and won’t need emails again.'
            : 'Open it on this device, then choose a new password.'}
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
        <p className="muted">Palate is invite-only for now. Enter your email to sign in or ask for access.</p>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
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

function PasswordStep({
  email,
  mode,
  onBack,
  onForgot,
}: {
  email: string
  mode: 'sign-in' | 'create'
  onBack: () => void
  onForgot: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'create' && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    setBusy(true)
    setError(null)
    if (mode === 'create') {
      const up = await supabase!.auth.signUp({ email, password, options: { data: { password_set: true } } })
      if (up.error) {
        setBusy(false)
        setError(up.error.message)
        return
      }
      if (up.data.session) return // signed in; AuthGate takes over
    }
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error)
      setError(
        /invalid/i.test(error.message)
          ? 'That password isn’t right.'
          : /confirm/i.test(error.message)
            ? 'This account still needs its email confirmed. Check your inbox.'
            : error.message,
      )
  }

  const forgot = async () => {
    setBusy(true)
    const err = await sendLink(email)
    setBusy(false)
    if (err) setError(err)
    else {
      flagReset(true)
      onForgot()
    }
  }

  return (
    <AuthCard>
      <form onSubmit={submit} className="form-stack" noValidate>
        <h1>{mode === 'create' ? 'Choose a password' : 'Welcome back'}</h1>
        <p className="muted">
          {mode === 'create' ? (
            <>
              You’re approved. Pick a password for <strong>{email}</strong> and you’re in.
            </>
          ) : (
            <>
              Signing in as <strong>{email}</strong>.
            </>
          )}
        </p>
        {/* Lets password managers pair the password with the email. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            minLength={mode === 'create' ? MIN_PASSWORD : undefined}
            autoFocus
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !password}>
          {busy ? 'Signing in…' : mode === 'create' ? 'Create account' : 'Sign in'}
        </button>
        <button type="button" className="btn" onClick={onBack} disabled={busy}>
          Use a different email
        </button>
        {mode === 'sign-in' && (
          <p className="muted auth-aside">
            Forgot it?{' '}
            <button type="button" className="link-btn" onClick={forgot} disabled={busy}>
              Email me a sign-in link
            </button>
          </p>
        )}
      </form>
    </AuthCard>
  )
}

/** Shown after signing in by email link when the account has no password yet (or it was forgotten). */
function SetPassword({ email, onDone }: { email: string; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.updateUser({ password, data: { password_set: true } })
    setBusy(false)
    if (error) setError(/different/i.test(error.message) ? 'Pick a password you haven’t used here before.' : error.message)
    else onDone()
  }

  return (
    <AuthCard>
      <form onSubmit={submit} className="form-stack" noValidate>
        <KeyRound size={28} className="auth-icon" aria-hidden />
        <h1>Set a password</h1>
        <p className="muted">
          Next time, sign in with <strong>{email}</strong> and this password. No more email links.
        </p>
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <label className="field">
          <span className="field-label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            minLength={MIN_PASSWORD}
            autoFocus
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !password}>
          {busy ? 'Saving…' : 'Save password'}
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
