import { Database, Download, FileJson, FileSpreadsheet, FlaskConical, LogOut, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Dialog } from '../components/ui/Dialog'
import { Popover } from '../components/ui/Popover'
import { toCsv } from '../domain/csv'
import { backupAdvice } from '../domain/backup'
import { relativeDays, toLocalDate } from '../domain/dates'
import { validateImport, type ImportCheck } from '../domain/schemas'
import { pluralize } from '../domain/text'
import { downloadFile, saveBackupFile, useBackupState } from '../state/backup'
import { useJournal } from '../state/JournalProvider'
import { useToast } from '../state/ToastProvider'
import { useUI } from '../state/UIProvider'
import { cloudEnabled, type ImportMode } from '../storage'
import { useAccount } from './AuthGate'

export function DataMenu() {
  const { repo, data, hasSample, ownMeals } = useJournal()
  const backup = useBackupState()
  const account = useAccount()
  const advice = backupAdvice(backup, cloudEnabled ? 0 : ownMeals)
  const { confirm } = useUI()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [check, setCheck] = useState<(ImportCheck & { fileName: string }) | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [busy, setBusy] = useState(false)

  const exportJson = async () => {
    try {
      const payload = await saveBackupFile(repo, ownMeals)
      toast.show(`Backed up ${pluralize(payload.foods.length, 'food')} and ${pluralize(payload.occasions.length, 'meal')}`)
    } catch {
      toast.error('Export failed. Try again.')
    }
  }

  const exportCsv = () => {
    downloadFile(`food-journal-${toLocalDate()}.csv`, '﻿' + toCsv(data.foods, data.occasions), 'text/csv;charset=utf-8')
    toast.show('Exported CSV')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        setCheck({ ok: false, errors: ['This file isn’t valid JSON.'], warnings: [], fileName: file.name })
        return
      }
      setCheck({ ...validateImport(raw), fileName: file.name })
      setMode('merge')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const runImport = async () => {
    if (!check?.data) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace your whole journal?',
        message: `Your current ${pluralize(data.foods.length, 'food')} and ${pluralize(data.occasions.length, 'meal')} will be deleted and replaced by the file. Export a backup first if you might need them.`,
        confirmLabel: 'Replace everything',
        danger: true,
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const r = await repo.importAll(check.data, mode)
      toast.show(`Imported ${pluralize(r.foods, 'food')} and ${pluralize(r.occasions, 'meal')}`)
      setCheck(null)
    } catch {
      toast.error('Import failed. Your existing data was not changed.')
    } finally {
      setBusy(false)
    }
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete everything?',
      message: `This permanently deletes all ${pluralize(data.foods.length, 'food')}, ${pluralize(data.occasions.length, 'meal')} and photos from ${cloudEnabled ? 'your account on every device' : 'this browser'}. It can’t be undone. Export a backup first if you want to keep them.`,
      confirmLabel: 'Delete everything',
      danger: true,
    })
    if (!ok) return
    try {
      await repo.clearAll()
      toast.show('Journal cleared')
    } catch {
      toast.error('Couldn’t clear the journal.')
    }
  }

  const sample = async () => {
    try {
      if (hasSample) {
        const ok = await confirm({ title: 'Remove sample data?', message: 'Sample foods and meals will be deleted. Your own entries stay.', confirmLabel: 'Remove sample data', danger: true })
        if (!ok) return
        const n = await repo.removeSampleData()
        toast.show(`Removed ${n} sample foods`)
      } else {
        await repo.loadSampleData()
        toast.show('Sample data loaded. It’s labelled “Sample” and can be removed any time.')
      }
    } catch {
      toast.error('Couldn’t update sample data.')
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <Popover
        align="right"
        width={250}
        trigger={(p) => (
          <button
            type="button"
            className="icon-btn"
            aria-label={advice.due ? 'Data: a backup is due' : 'Data: backup, import and export'}
            data-tip="Backup & data"
            {...p}
          >
            <Database size={18} />
            {advice.due && <span className="icon-dot" aria-hidden />}
          </button>
        )}
      >
        {(close) => (
          <div role="menu">
            {account && (
              <>
                <div className="menu-label">Account</div>
                <p className="menu-note">Signed in as {account.email}</p>
                <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); account.signOut() }}>
                  <LogOut size={15} /> Sign out
                </button>
                <div className="menu-sep" />
              </>
            )}
            <div className="menu-label">Backup</div>
            <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); exportJson() }}>
              <FileJson size={15} /> Save backup file
            </button>
            <p className="menu-note">
              {cloudEnabled
                ? 'Your journal syncs to your account. A backup file is an extra copy.'
                : backup.at
                ? `Last backup ${relativeDays(backup.at.slice(0, 10))}${advice.unsaved ? `, ${pluralize(advice.unsaved, 'meal')} since` : ''}.`
                : ownMeals
                  ? 'Never backed up. Your journal lives only in this browser.'
                  : 'Your journal lives only in this browser.'}
            </p>
            <div className="menu-sep" />
            <div className="menu-label">Export</div>
            <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); exportCsv() }} disabled={!data.foods.length}>
              <FileSpreadsheet size={15} /> Spreadsheet (CSV)
            </button>
            <div className="menu-sep" />
            <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); fileRef.current?.click() }}>
              <Upload size={15} /> Import from JSON…
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); sample() }}>
              <FlaskConical size={15} /> {hasSample ? 'Remove sample data' : 'Load sample data'}
            </button>
            <div className="menu-sep" />
            <button type="button" role="menuitem" className="menu-item danger" onClick={() => { close(); clearAll() }} disabled={!data.foods.length}>
              <Trash2 size={15} /> Delete all data…
            </button>
          </div>
        )}
      </Popover>

      <Dialog
        open={!!check}
        onRequestClose={() => !busy && setCheck(null)}
        title="Import journal"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCheck(null)} disabled={busy}>
              Cancel
            </button>
            {check?.ok && (
              <button type="button" className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`} onClick={runImport} disabled={busy}>
                <Download size={15} /> {busy ? 'Importing…' : mode === 'replace' ? 'Replace and import' : 'Import'}
              </button>
            )}
          </>
        }
      >
        {check && (
          <div className="form-stack">
            <p className="muted">{check.fileName}</p>
            {!check.ok ? (
              <div className="banner banner-error" role="alert">
                <div>
                  <strong>This file can’t be imported.</strong>
                  <ul className="plain-list">
                    {check.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <p>
                  Found <strong>{pluralize(check.data!.foods.length, 'food')}</strong>, <strong>{pluralize(check.data!.occasions.length, 'meal')}</strong> and{' '}
                  {pluralize(check.data!.photos.length, 'photo')}.
                </p>
                {check.warnings.map((w) => (
                  <div key={w} className="banner">
                    {w}
                  </div>
                ))}
                <fieldset className="filter-group">
                  <legend>How should it be added?</legend>
                  <label className="radio-card">
                    <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                    <span>
                      <strong>Merge</strong>
                      <span className="muted">Add to your journal. Entries with the same ID are updated from the file.</span>
                    </span>
                  </label>
                  <label className="radio-card">
                    <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                    <span>
                      <strong>Replace</strong>
                      <span className="muted">Delete everything currently in {cloudEnabled ? 'your journal' : 'this browser'}, then import.</span>
                    </span>
                  </label>
                </fieldset>
              </>
            )}
          </div>
        )}
      </Dialog>
    </>
  )
}
