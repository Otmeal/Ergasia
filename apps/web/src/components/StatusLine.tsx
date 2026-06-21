export function StatusLine({ status }: { status: string }) {
  return (
    <section className="status-line" aria-live="polite">
      {status}
    </section>
  )
}
