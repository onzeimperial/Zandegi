"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Lock, Sparkles, Check } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { AvatarRender, type AvatarConfig } from "@/components/avatar/avatar-render";
import { RarityBadge, rarityRingStyle } from "@/components/avatar/rarity";
import {
  RARITIES,
  RARITY_LABELS,
  COSMETIC_SLOT_LABELS,
  type CosmeticSlot,
  type Rarity,
} from "@/lib/constants";

interface ShopItem {
  key: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  price: number | null;
  owned: boolean;
  lockedBy?: string;
}

interface ShopResponse {
  coins: number;
  avatar: AvatarConfig;
  items: ShopItem[];
}

type Filter = "all" | Rarity;

export default function ShopPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [buying, setBuying] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shop"],
    queryFn: () => api.get<ShopResponse>("/api/shop"),
  });

  if (isLoading || !data) return <Spinner className="py-24" />;

  async function buy(item: ShopItem) {
    setBuying(item.key);
    try {
      await api.post("/api/shop", { itemKey: item.key });
      toast.push({ kind: "success", title: `Bought ${item.name}`, body: "Equip it on your character page." });
      qc.invalidateQueries({ queryKey: ["shop"] });
      qc.invalidateQueries({ queryKey: ["avatar"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.push({
        kind: "error",
        title: e instanceof ApiClientError ? e.message : "Purchase failed",
      });
    } finally {
      setBuying(null);
    }
  }

  const visible = data.items
    .filter((i) => filter === "all" || i.rarity === filter)
    .sort((a, b) => {
      const r = RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity);
      return r !== 0 ? r : (a.price ?? Infinity) - (b.price ?? Infinity);
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shop</h1>
          <p className="text-sm text-muted">
            Spend coins on cosmetics. The rarest items only drop from finishing big goals.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium">
          <Coins className="h-4 w-4 text-brand" />
          {data.coins.toLocaleString()}
        </span>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(["all", ...RARITIES] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {f === "all" ? "All" : RARITY_LABELS[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="You already own everything at this rarity. Finish a goal to unlock drop-only items."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <ShopCard
              key={item.key}
              item={item}
              avatar={data.avatar}
              coins={data.coins}
              busy={buying === item.key}
              onBuy={() => buy(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShopCard({
  item,
  avatar,
  coins,
  busy,
  onBuy,
}: {
  item: ShopItem;
  avatar: AvatarConfig;
  coins: number;
  busy: boolean;
  onBuy: () => void;
}) {
  const dropOnly = item.price == null && !item.lockedBy;
  const locked = Boolean(item.lockedBy);
  const affordable = item.price != null && coins >= item.price;
  const buyable = !item.owned && !dropOnly && !locked && affordable;

  return (
    <div className="card flex flex-col items-center gap-2 p-4 text-center" style={rarityRingStyle(item.rarity)}>
      <AvatarRender
        config={{ ...avatar, [item.slot]: item.key }}
        size={96}
        showFrame={item.slot === "frame"}
      />
      <div>
        <p className="text-sm font-semibold">{item.name}</p>
        <p className="text-[11px] text-muted">{COSMETIC_SLOT_LABELS[item.slot]}</p>
        <RarityBadge rarity={item.rarity} />
      </div>
      <p className="text-xs text-muted">{item.description}</p>

      <div className="mt-auto w-full pt-2">
        {item.owned ? (
          <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" /> Owned
          </span>
        ) : locked ? (
          <span className="inline-flex items-center justify-center gap-1 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" /> Achievement locked
          </span>
        ) : dropOnly ? (
          <span className="inline-flex items-center justify-center gap-1 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Drop only
          </span>
        ) : (
          <button
            onClick={onBuy}
            disabled={!buyable || busy}
            className={cn("w-full", buyable ? "btn-primary" : "btn-outline")}
            title={affordable ? undefined : "Not enough coins"}
          >
            <Coins className="h-4 w-4" />
            {busy ? "Buying…" : item.price?.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}
