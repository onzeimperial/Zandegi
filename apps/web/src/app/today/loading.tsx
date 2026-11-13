import { AppShell } from "@/components/app-shell";

/**
 * Today's loading state. The skeleton has the card's real proportions -- the
 * day heading, two step rows, the coming-up list and the quick log -- so
 * nothing jumps when the plan arrives.
 */
export default function TodayLoading() {
  return (
    <AppShell current="Today">
      <header className="today-head">
        <h1 className="hero-title">Today</h1>
        <p className="today-sub">What fits in today on each mission, and what comes after.</p>
      </header>
      <p className="sr-only" role="status">
        Loading today&#39;s steps…
      </p>
      <ul className="today-list" aria-hidden="true">
        {[0, 1].map((key) => (
          <li key={key} className="card today-card today-skeleton">
            <i className="skeleton-line short" />
            <i className="skeleton-line tall" />
            <i className="skeleton-row" />
            <i className="skeleton-row" />
            <i className="skeleton-line" />
            <i className="skeleton-block" />
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
