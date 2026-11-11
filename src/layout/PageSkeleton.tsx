/** Placeholder shown while data or a page's code is loading. */
export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ width: 200, height: 30, marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 110, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  )
}
