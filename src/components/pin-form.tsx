"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function PinForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Invalid PIN.");
      }
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md p-4">
      <h1 className="mb-4 text-2xl font-bold">DeBag Metrics PIN</h1>
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <p className="text-sm text-slate-600">Enter PIN to access protected pages.</p>
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="w-full rounded-xl border border-slate-300 p-3 text-lg"
          placeholder="PIN"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 p-3 text-lg font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Checking..." : "Unlock"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </main>
  );
}
