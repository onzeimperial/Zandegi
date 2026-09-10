"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { api, ApiClientError } from "@/lib/client";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", dailyMinutes: 45, weeklyDays: 5 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === "dailyMinutes" || k === "weeklyDays" ? Number(e.target.value) : e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await api.post("/api/auth/register", { ...form, timezone: tz });
      const res = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      if (res?.error) throw new Error("Signed up, but sign-in failed. Try logging in.");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : (err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Two minutes to your first plan.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Name">
          <Input required value={form.name} onChange={set("name")} autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 10 characters, with a number or capital.">
          <Input type="password" required value={form.password} onChange={set("password")} autoComplete="new-password" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes/day">
            <Input type="number" min={5} max={600} value={form.dailyMinutes} onChange={set("dailyMinutes")} />
          </Field>
          <Field label="Days/week">
            <Select value={form.weeklyDays} onChange={set("weeklyDays")}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </Field>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Create account</Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
