import { Brand } from "./brand";

/* The 76px onboarding header from boards 01-03: brand, centred progress,
   and a matching 260px spacer so the bar stays optically centred. */
export function FlowHeader({ percent, label }: { percent: number; label: string }) {
  return (
    <header className="step-header">
      <div className="side"><Brand /></div>
      <div className="step-progress">
        <div>
          <div className="track" aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>
          <b>{label}</b>
        </div>
      </div>
      <div className="side end" />
    </header>
  );
}
