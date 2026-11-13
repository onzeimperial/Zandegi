/**
 * The test page's loading state. The skeleton matches the page's two columns,
 * so nothing jumps when the mission arrives.
 */
export default function BossLoading() {
  return (
    <main className="step-page">
      <p className="sr-only" role="status">
        Loading your test…
      </p>
      <div className="step-body" aria-hidden="true">
        <div className="step-grid">
          <div className="step-main today-skeleton">
            <i className="skeleton-line short" />
            <i className="skeleton-line tall" />
            <i className="skeleton-block" />
          </div>
          <div className="step-aside today-skeleton">
            <i className="skeleton-block" />
            <i className="skeleton-block" />
            <i className="skeleton-block" />
          </div>
        </div>
      </div>
    </main>
  );
}
