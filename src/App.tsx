export default function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">Cross-platform audio workspace</p>
        <h1 id="app-title">Turbobard</h1>
        <p className="intro">
          A focused place to explore better audio behavior across devices.
        </p>
        <div className="status-card" role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>Ready for the first listening session.</span>
        </div>
      </section>
    </main>
  )
}
