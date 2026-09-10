"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function TrajectoryChart({
  data,
  height = 220,
  label = "XP",
}: {
  data: { date: string; value: number }[];
  height?: number;
  label?: string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="fillBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(var(--muted))" }}
            formatter={(v: number) => [v, label]}
          />
          <Area type="monotone" dataKey="value" stroke="rgb(var(--brand))" strokeWidth={2} fill="url(#fillBrand)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
