"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUpAccount } from "@/server/actions/auth";
import { LoginScene } from "./_components/login-scene";

const FEATURES = [
  {
    id: "01",
    title: "AI-drafted winback",
    body: "Personalised messages for every lapsed student.",
  },
  {
    id: "02",
    title: "One-tap WhatsApp",
    body: "Send from your own number — no API setup.",
  },
  {
    id: "03",
    title: "Revenue recovered",
    body: "Track who re-enrolled and how much came back.",
  },
] as const;

function WireframeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setBusy(false);
      if (signInError) return setError(signInError.message);
      router.push("/");
      router.refresh();
      return;
    }

    const result = await signUpAccount(email, password);
    if ("error" in result) {
      setBusy(false);
      return setError(result.error);
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) return setError(signInError.message);

    router.push("/");
    router.refresh();
  }

  return (
    <main className="login-page">
      <LoginScene />
      <div className="login-grid" aria-hidden />
      <div className="login-vignette" aria-hidden />

      <div className="login-content">
        <section className="login-brand">
          <div className="login-mark">
            <WireframeIcon />
          </div>
          <p className="login-eyebrow">ReEngage · Tuition winback</p>
          <h1 className="login-headline">
            Bring students <span>back</span> to class.
          </h1>
          <p className="login-sub">
            A calm, precise tool for centre owners — identify who left,
            draft the message, send on WhatsApp, measure what returned.
          </p>
          <ul className="login-features">
            {FEATURES.map((f) => (
              <li key={f.id} className="login-feature">
                <span className="login-feature-icon">{f.id}</span>
                <div>
                  <p className="font-medium text-zinc-200">{f.title}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="login-card-wrap">
          <div className="login-card">
            <div className="login-mobile-brand">
              <div className="login-mark">
                <WireframeIcon />
              </div>
              <span>ReEngage</span>
            </div>

            <h2 className="login-card-title">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="login-card-sub">
              {mode === "signin"
                ? "Sign in to your centre dashboard."
                : "Start recovering students in minutes."}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="email" className="login-field">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@tuitioncentre.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                />
              </div>
              <div>
                <label htmlFor="password" className="login-field">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />
              </div>

              {error && <p className="login-error">{error}</p>}

              <button type="submit" disabled={busy} className="login-submit">
                {busy
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="login-toggle"
            >
              {mode === "signin" ? (
                <>
                  No account? <strong>Create one</strong>
                </>
              ) : (
                <>
                  Already registered? <strong>Sign in</strong>
                </>
              )}
            </button>

            <p className="login-footer">Manual-first · WhatsApp · MY</p>
          </div>
        </section>
      </div>
    </main>
  );
}
