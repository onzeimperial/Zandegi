import Image from "next/image";
import Link from "next/link";
import { SignInCard, SignOut } from "@/components/account";
import { LandingScene } from "@/components/landing-scene";

const mascotSrc =
  "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

export type HomeState = "sign-in" | "invite-only" | "closed" | "unavailable" | "guest";

function Panel({ state }: { state: HomeState }) {
  switch (state) {
    case "sign-in":
      return <SignInCard />;
    case "invite-only":
      return (
        <div className="auth-card" role="status">
          <h1 className="d">Zandegi is invite-only for now</h1>
          <p>
            This account isn&#39;t on the list yet. If you were invited, sign in with the email your
            invite went to, and confirm it when asked.
          </p>
          <SignOut className="d flow-primary" />
        </div>
      );
    case "closed":
      return (
        <div className="auth-card" role="status">
          <h1 className="d">Zandegi isn&#39;t open right now</h1>
          <p>Check back soon. Everything you&#39;ve done is safe.</p>
        </div>
      );
    case "unavailable":
      return (
        <div className="auth-card" role="alert">
          <h1 className="d">We can&#39;t check your account right now</h1>
          <p>Nothing has been lost. Try again in a moment.</p>
          <Link className="d flow-primary" href="/">
            Try again
          </Link>
        </div>
      );
    case "guest":
      return (
        <div className="auth-card">
          <h1 className="d">Guest mode</h1>
          <p>Accounts are off on this machine, so your missions belong to this browser.</p>
          <Link className="d flow-primary" href="/generate">
            Build a mission
          </Link>
          <Link className="flow-secondary" href="/today">
            Go to your path
          </Link>
        </div>
      );
  }
}

export function HomeView({ state }: { state: HomeState }) {
  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Zandegi introduction">
        <Image
          className="mascot"
          src={mascotSrc}
          width={260}
          height={260}
          alt="Zandegi mascot"
          priority
          unoptimized
        />
        <div className="d wordmark">zandegi</div>
        <div className="tagline">Level up your real life.</div>
      </section>
      <section className="auth-panel">
        <LandingScene />
        <Panel state={state} />
      </section>
    </main>
  );
}
