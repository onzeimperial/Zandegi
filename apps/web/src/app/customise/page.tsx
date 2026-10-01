"use client";

import Link from "next/link";
import { useReducer } from "react";
import { CharacterArt } from "@/components/character-art";
import { Icon } from "@/components/icons";
import {
  EXTRAS, SWATCHES, TABS,
  characterLook, customiseReducer, initialCustomiseState,
  type SwatchTab,
} from "./customise-state";

export default function CustomisePage() {
  const [state, dispatch] = useReducer(customiseReducer, initialCustomiseState);
  const look = characterLook(state);
  const swatches = state.tab === "extras" ? [] : SWATCHES[state.tab as SwatchTab];

  return (
    <main className="customise-page">
      <p className="sr-only">Local character preview. Your look is not saved and nothing here can be purchased.</p>

      <header className="step-header customise-header">
        <div className="side">
          <Link href="/profile" className="step-close" aria-label="Back to profile">
            <Icon name="back" strokeWidth={2.8} />
          </Link>
          <span className="d title">Your look</span>
        </div>
        <div className="step-progress" />
        <div className="side end">
          <div className="d wallet"><Icon name="shard" tone="shard" /><span>340</span></div>
          <button type="button" className="d save-look" disabled>Save look</button>
        </div>
      </header>

      <div className="customise-body">
        <div className="customise-grid">
          <div className="character-stage"><CharacterArt look={look} /></div>

          <div className="customise-panel">
            <div className="customise-tabs" role="group" aria-label="Category">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className="d"
                  aria-pressed={state.tab === tab.key}
                  onClick={() => dispatch({ type: "tab", tab: tab.key })}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="options">
              {state.tab === "extras"
                ? EXTRAS.map((extra) => (
                    <button
                      key={extra.key}
                      type="button"
                      className="option"
                      aria-pressed={Boolean(state.extras[extra.key])}
                      aria-label={extra.lock ? `${extra.label}, locked: ${extra.lock}` : extra.label}
                      disabled={Boolean(extra.lock)}
                      onClick={() => dispatch({ type: "toggle-extra", key: extra.key })}
                    >
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#6F42E8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={extra.p1} />
                        {extra.p2 && <path d={extra.p2} />}
                      </svg>
                      <span className="label">{extra.label}</span>
                      {extra.lock && <span className="lock">{extra.lock}</span>}
                    </button>
                  ))
                : swatches.map((swatch, index) => (
                    <button
                      key={swatch.label}
                      type="button"
                      className="option"
                      aria-pressed={state.selected[state.tab as SwatchTab] === index}
                      aria-label={swatch.lock ? `${swatch.label}, locked: ${swatch.lock}` : swatch.label}
                      disabled={Boolean(swatch.lock)}
                      onClick={() => dispatch({ type: "select", tab: state.tab as SwatchTab, index })}
                    >
                      <span className="swatch" style={{ background: swatch.value }} />
                      <span className="label">{swatch.label}</span>
                      {swatch.lock && <span className="lock">{swatch.lock}</span>}
                    </button>
                  ))}
            </div>

            <p className="customise-note">Locked looks unlock with levels, chests or Shards. Looks never change your stats.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
