import type { ReactNode, CSSProperties, ElementType, ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type PanelTag = "div" | "button" | "article";

export type PanelProps<T extends PanelTag = "div"> = {
  children: ReactNode;
  className?: string;
  /**
   * Accent colour, e.g. a domain colour or a percentile-rarity colour. Shown
   * as a border tint plus a low-opacity outer glow — never as a flat fill,
   * per the visual spec.
   */
  accent?: string;
  glow?: boolean;
  chamfer?: number;
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "className" | "children" | "style">;

/**
 * The chamfered angular panel used everywhere in the game shell. Two nested
 * clip-path shapes (see .game-panel / .game-panel-fill in game-tokens.css)
 * fake a crisp border on a clipped element, since a plain CSS border would
 * be clipped away along with the corners.
 */
export function Panel<T extends PanelTag = "div">({
  children,
  className,
  accent,
  glow = false,
  chamfer,
  as,
  ...rest
}: PanelProps<T>) {
  const Tag = (as ?? "div") as ElementType;

  const style: CSSProperties = {
    ...(chamfer ? ({ "--chamfer": `${chamfer}px` } as CSSProperties) : {}),
    ...(accent
      ? {
          background: accent,
          boxShadow: glow ? `0 0 24px 0 ${accent}55` : undefined,
        }
      : {}),
  };

  const fillStyle: CSSProperties = accent ? { background: "rgb(var(--g-surface))" } : {};

  return (
    <Tag
      className={cn("game-panel", className)}
      style={style}
      {...(Tag === "button" ? { type: "button" } : {})}
      {...rest}
    >
      <span className="game-panel-fill" style={fillStyle} />
      <div className="game-panel-content">{children}</div>
    </Tag>
  );
}
