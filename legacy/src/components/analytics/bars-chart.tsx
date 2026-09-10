"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function BarsChart({
  data,
  dataKey,
  label,
  height = 220,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  label: string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "rgb(var(--muted))" }}
            formatter={(v: number) => [v, label]}
            cursor={{ fill: "rgb(var(--surface-2))" }}
          />
          <Bar dataKey={dataKey} fill="rgb(var(--brand))" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
