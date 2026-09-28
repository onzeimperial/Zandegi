import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { StatusRail } from "@/components/status-rail";

export default function PathPage(){return <AppShell current="Path" aside={<StatusRail/>}><div className="page-column stack">
  <button className="chip" type="button" disabled title="Mission switching is preview only">Bench 100 kg ▾</button>
  <section className="hero-card stack"><div><span className="eyebrow" style={{color:"#e2d8ff"}}>Mission · Bench 100 kg</span><h1>Chapter 2 · Build the base</h1></div><div className="row-between small"><b>Best lift 72.5 kg</b><b>Goal 100 kg</b></div><div className="metric-bar" aria-label="72.5 kilograms toward a 100 kilogram target"><i/></div></section>
  <section className="path-map" aria-label="Mission path"><span className="path-node" role="img" aria-label="Step 4, complete"><Icon name="check"/></span><div className="next-label"><b>Start · Today 6:30 pm</b><br/><span className="muted small">Push day A · 5×5 at 75 kg</span></div><Link className="path-node" href="/step" aria-label="Start step 5, Push day A">◫</Link><span className="path-node locked" aria-label="Step 6, locked"><Icon name="lock"/></span><span className="path-node locked" aria-label="Chapter chest, locked">□</span><div className="divider" style={{width:"100%"}}>Chapter 3 · Add volume</div><span className="path-node locked" aria-label="Chapter 3 step 1, locked"><Icon name="lock"/></span></section>
 </div></AppShell>}
