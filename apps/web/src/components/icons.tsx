export type IconName = "path" | "crew" | "shop" | "me" | "plus" | "close" | "check" | "lock" | "bolt";

const icons: Record<IconName, string> = {
  path: "⌂", crew: "◎", shop: "◇", me: "●", plus: "+", close: "×", check: "✓", lock: "▣", bolt: "ϟ",
};

export function Icon({ name }: { name: IconName }) {
  return <span className="icon" aria-hidden="true">{icons[name]}</span>;
}
