"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      await fetch("/api/bootstrap", { method: "POST" });
      router.push("/projects");
      router.refresh();
      return;
    }
    setMessage("Check your email to confirm your account, then sign in.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="font-display mb-8 text-xl">
        Caseform
      </Link>
      <h1 className="font-display text-3xl tracking-tight">Create account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Your workspace starts with one personal org — ready for pilot testers.
      </p>
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-6">
        <label className="block text-sm">
          <span className="mb-1.5 block">Name</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Tester"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block">Email</span>
          <input
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block">Password</span>
          <input
            className="field"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-[var(--accent)]">{message}</p>
        ) : null}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
