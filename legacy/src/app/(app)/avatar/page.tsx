"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Coins, Check } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { AvatarRender, type AvatarConfig } from "@/components/avatar/avatar-render";
import { RarityBadge, rarityRingStyle } from "@/components/avatar/rarity";
import { SKIN_TONES, HAIR_COLORS } from "@/components/avatar/palette";
import {
  COSMETIC_SLOTS,
  COSMETIC_SLOT_LABELS,
  type CosmeticSlot,
  type Rarity,
} from "@/lib/constants";

interface WardrobeItem {
  key: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  price: number | null;
  owned: boolean;
  equipped: boolean;
  lockedBy?: string;
  isNew: boolean;
}

interface WardrobeResponse {
  items: WardrobeItem[];
  coins: number;
  avatar: AvatarConfig;
}

const OPTIONAL_SLOTS: CosmeticSlot[] = ["accessory", "aura"];

/** Slot order for the editor tabs — front-to-back reads more naturally here. */
const TAB_ORDER: CosmeticSlot[] = ["base", "hair", "face", "outfit", "accessory", "aura", "frame"];

export default function AvatarPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<CosmeticSlot>("base");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["avatar"],
    queryFn: () => api.get<WardrobeResponse>("/api/avatar"),
  });

  if (isLoading || !data) return <Spinner className="py-24" />;

  async function mutate(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const next = await api.patch<WardrobeResponse>("/api/avatar", body);
      qc.setQueryData(["avatar"], next);
      // The sidebar bust reads from the profile query.
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.push({ kind: "success", title: successMsg });
    } catch (e) {
      toast.push({
        kind: "error",
        title: e instanceof Error ? e.message : "Couldn't update your avatar",
      });
    } finally {
      setBusy(false);
    }
  }

  const equip = (slot: CosmeticSlot, itemKey: string) =>
    mutate({ equip: [{ slot, itemKey }] }, "Avatar updated");

  const slotItems = data.items.filter((i) => i.slot === tab);
  const ownedCount = data.items.filter((i) => i.owned).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your character</h1>
          <p className="text-sm text-muted">
            {ownedCount} of {data.items.length} cosmetics unlocked
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium">
          <Coins className="h-4 w-4 text-brand" />
          {data.coins.toLocaleString()}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── Preview ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card grid place-items-center p-6">
            <AvatarRender config={data.avatar} size={200} title="Your avatar" />
          </div>

          <div className="card space-y-4 p-4">
            <Swatches
              label="Skin tone"
              colors={SKIN_TONES}
              value={data.avatar.skinTone}
              onPick={(c) => mutate({ skinTone: c }, "Skin tone updated")}
              disabled={busy}
            />
            <Swatches
              label="Hair colour"
              colors={HAIR_COLORS}
              value={data.avatar.hairColor}
              onPick={(c) => mutate({ hairColor: c }, "Hair colour updated")}
              disabled={busy}
            />
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Accent colour</p>
              <input
                type="color"
                aria-label="Accent colour"
                value={data.avatar.color}
                disabled={busy}
                onChange={(e) => mutate({ color: e.target.value }, "Accent colour updated")}
                className="h-9 w-full cursor-pointer rounded-md border border-border bg-surface p-1"
              />
            </div>
          </div>
        </div>

        {/* ── Wardrobe ────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {TAB_ORDER.filter((s) => COSMETIC_SLOTS.includes(s)).map((slot) => (
              <button
                key={slot}
                onClick={() => setTab(slot)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === slot
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface text-muted hover:text-fg",
                )}
              >
                {COSMETIC_SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {OPTIONAL_SLOTS.includes(tab) ? (
              <NoneCard
                equipped={data.avatar[tab] === "none"}
                disabled={busy}
                onSelect={() => equip(tab, "none")}
              />
            ) : null}

            {slotItems.map((item) => (
              <ItemCard
                key={item.key}
                item={item}
                avatar={data.avatar}
                disabled={busy}
                onSelect={() => equip(item.slot, item.key)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  avatar,
  disabled,
  onSelect,
}: {
  item: WardrobeItem;
  avatar: AvatarConfig;
  disabled: boolean;
  onSelect: () => void;
}) {
  const locked = Boolean(item.lockedBy);
  const selectable = item.owned && !locked;

  return (
    <button
      onClick={selectable ? onSelect : undefined}
      disabled={disabled || !selectable}
      aria-pressed={item.equipped}
      className={cn(
        "card relative flex flex-col items-center gap-2 p-3 text-center transition-all",
        selectable && "hover:border-brand hover:shadow-sm",
        item.equipped && "ring-2 ring-brand",
        !selectable && "opacity-60",
      )}
      style={rarityRingStyle(item.rarity)}
    >
      {item.isNew ? (
        <span className="absolute right-2 top-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
          NEW
        </span>
      ) : null}
      {item.equipped ? (
        <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
          <Check className="h-3 w-3" />
        </span>
      ) : null}

      {/* Preview the item in place on the current character. */}
      <AvatarRender
        config={{ ...avatar, [item.slot]: item.key }}
        size={84}
        showFrame={item.slot === "frame"}
      />

      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{item.name}</p>
        <RarityBadge rarity={item.rarity} />
      </div>

      {locked ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Lock className="h-3 w-3" /> Achievement locked
        </span>
      ) : !item.owned ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          {item.price == null ? (
            "Drop only"
          ) : (
            <>
              <Coins className="h-3 w-3" /> {item.price.toLocaleString()}
            </>
          )}
        </span>
      ) : null}
    </button>
  );
}

function NoneCard({
  equipped,
  disabled,
  onSelect,
}: {
  equipped: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={equipped}
      className={cn(
        "card flex flex-col items-center justify-center gap-2 p-3 text-center transition-all hover:border-brand",
        equipped && "ring-2 ring-brand",
      )}
    >
      <div className="grid h-[84px] w-[84px] place-items-center rounded-full border border-dashed border-border text-xs text-muted">
        None
      </div>
      <p className="text-xs font-semibold">Nothing equipped</p>
    </button>
  );
}

function Swatches({
  label,
  colors,
  value,
  onPick,
  disabled,
}: {
  label: string;
  colors: string[];
  value: string;
  onPick: (c: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            disabled={disabled}
            aria-label={`${label}: ${c}`}
            aria-pressed={value.toLowerCase() === c.toLowerCase()}
            style={{ background: c }}
            className={cn(
              "h-7 w-7 rounded-full border transition-transform hover:scale-110",
              value.toLowerCase() === c.toLowerCase()
                ? "border-brand ring-2 ring-brand ring-offset-1 ring-offset-bg"
                : "border-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
