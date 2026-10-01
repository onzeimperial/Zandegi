import Image from "next/image";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StatusRail } from "@/components/status-rail";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Shop" };

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";
const packs = ["500", "1,200", "2,600"];

export default function ShopPage() {
  return (
    <AppShell current="Shop" aside={<StatusRail cards={["crew", "league"]} />}>
      <p className="sr-only">Fixture-backed shop preview. No purchase is possible and no wallet is connected.</p>

      <div className="shop-head">
        <h1 className="d">Shop</h1>
        <div className="d wallet"><Icon name="shard" tone="shard" /><span>340</span></div>
      </div>

      <section className="panel">
        <div className="row-between"><h2 className="d">Daily drop</h2><span className="card-note">New items in 09:12:44</span></div>
        <div className="shop-grid">
          <div className="shop-item">
            <div className="shop-art frame"><span className="ring"><Image src={mascotSrc} width={72} height={72} alt="Aurora frame preview" unoptimized /></span></div>
            <span className="name">Aurora frame</span>
            <button type="button" className="d buy" disabled><Icon name="gem" tone="shard" /><span>120</span></button>
          </div>

          <div className="shop-item">
            <div className="shop-art theme">
              <span className="swatch" style={{ background: "#6f42e8" }} />
              <span className="swatch" style={{ background: "#ffc53d" }} />
              <span className="swatch" style={{ background: "#9beaf0" }} />
            </div>
            <span className="name">Midnight theme</span>
            <button type="button" className="d buy" disabled><Icon name="gem" tone="shard" /><span>200</span></button>
          </div>

          <div className="shop-item">
            <div className="shop-art badge"><Icon name="crown" tone="bolt" /></div>
            <span className="name">Crown badge</span>
            <button type="button" className="d buy" disabled><Icon name="gem" tone="shard" /><span>90</span></button>
          </div>

          <div className="shop-item">
            <div className="shop-art effect"><Icon name="flame" tone="ember" /></div>
            <span className="name">Ember streak flame</span>
            <button type="button" className="d buy" disabled><Icon name="gem" tone="shard" /><span>150</span></button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="d">Shard packs</h2>
        <div className="pack-grid">
          {packs.map((amount) => (
            <button type="button" className="pack" key={amount} disabled>
              <b>{amount}</b>
              <span>[PRICE]</span>
            </button>
          ))}
        </div>
        <p className="shop-note">Fixed value, no surprises. Shards buy looks only — never XP, levels, streaks or rank.</p>
      </section>
    </AppShell>
  );
}
