import { AppShell } from "@/components/app-shell";

/**
 * Today's loading state. The skeleton has the card's real proportions, so
 * nothing jumps when the missions arrive.
 */
export default function TodayLoading() {
  return (
    <AppShell current="Today">
      <header className="today-head">
        <h1 className="hero-title">Today</h1>
        <p className="today-sub">Your next step on every mission.</p>
      </header>
      <p className="sr-only" role="status">
        Loading your missions…
      </p>
      <ul className="today-list" aria-hidden="true">
        {[0, 1].map((key) => (
          <li key={key} className="card today-card today-skeleton">
            <i className="skeleton-line short" />
            <i className="skeleton-line" />
            <i className="skeleton-line tall" />
            <i className="skeleton-block" />
            <i className="skeleton-block" />
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
