import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, Spinner, Wordmark, paths } from "../components/ui";
import { ApiError } from "../api/client";
import { useAuth } from "../auth";


function friendly(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/**
 * Shown when Supabase knows the user but the API has no company row for them yet. The API does not say
 * whether an invitation exists, so try to join first; only a 404 (no invitation) leads to registering.
 */
function Onboarding({ email }: { email: string }) {
  const { registerCompany, joinCompany, logOut } = useAuth();
  const [step, setStep] = useState<"checking" | "register" | "blocked">("checking");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    joinCompany().catch((failure) => {
      if (failure instanceof ApiError && failure.status === 404) return setStep("register");
      setError(friendly(failure));
      setStep("blocked");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await registerCompany(company.trim(), name.trim());
    } catch (failure) {
      setError(friendly(failure));
    } finally {
      setBusy(false);
    }
  }

  if (step === "checking")
    return (
      <p role="status" className="note rise">
        <Spinner size={16} />
        <span>Signed in as {email}. Checking for an invitation from your company…</span>
      </p>
    );

  return (
    <form className="rise" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p className="note">
        <Icon d={paths.info} size={16} style={{ flex: "none", marginTop: 2, color: "var(--blue)" }} />
        <span>
          {step === "register"
            ? `Signed in as ${email}. There is no invitation for this email, so create your company to continue.`
            : `Signed in as ${email}.`}
        </span>
      </p>
      {step === "register" && (
        <>
          <div className="field">
            <label htmlFor="company">Company name</label>
            <input id="company" className="input" required value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </>
      )}
      {error && <p role="alert" className="error"><Icon d={paths.warn} size={16} />{error}</p>}
      {step === "register" && (
        <button className="btn big" type="submit" disabled={busy}>
          {busy ? <Spinner /> : "Create company"}
        </button>
      )}
      <button type="button" className="btn ghost" onClick={() => logOut()}>Use a different account</button>
    </form>
  );
}

export function SignIn({ pendingEmail }: { pendingEmail?: string }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [sentTo, setSentTo] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "sign-in") await signIn(email.trim(), password);
      else if ((await signUp(email.trim(), password)) === "confirm-email") setSentTo(email.trim());
    } catch (failure) {
      setError(friendly(failure));
      setShakeKey((key) => key + 1);
    } finally {
      setBusy(false);
    }
  }

  const switchMode = () => {
    setError("");
    setSentTo("");
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
  };

  const heading = pendingEmail ? "Almost there" : sentTo ? "Check your inbox" : mode === "sign-up" ? "Create your account" : "Welcome back";
  const subhead = pendingEmail
    ? "Finish setting up your workspace."
    : sentTo
      ? "Confirm your email to continue."
      : mode === "sign-up"
        ? "Invited by your company? Use the email address they invited."
        : "Sign in to your ConstroMan account.";

  return (
    <div className="auth">
      <section className="auth-hero" aria-label="About ConstroMan">
        <div className="orb a" aria-hidden="true" />
        <div className="orb b" aria-hidden="true" />
        <div className="grid-bg" aria-hidden="true" />
        <div className="rise" style={{ position: "relative" }}>
          <img src="/logo-wordmark.png" alt="ConstroMan" style={{ height: 92, width: "auto", display: "block" }} />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 22, maxWidth: 540 }}>
          <h1 className="rise" style={{ margin: 0, fontWeight: 600, fontSize: "clamp(40px, 4.4vw, 60px)", lineHeight: 1.04, letterSpacing: "-0.04em", animationDelay: ".12s" }}>
            Ask your project spreadsheets <span style={{ color: "var(--amber)" }}>anything.</span>
          </h1>
          <p className="rise" style={{ margin: 0, fontSize: 18, lineHeight: 1.55, color: "#a9aeb8", animationDelay: ".2s" }}>
            Upload BOQs, quotations, purchase orders and invoices. Get answers, dashboards and what-ifs, each traced back to the sheet it came from.
          </p>
        </div>
        <div style={{ position: "relative", height: 1 }} />
      </section>

      <main className="auth-form">
        <div className="auth-card rise" style={{ animationDelay: ".15s" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontWeight: 600, fontSize: 32, letterSpacing: "-0.035em" }}>{heading}</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 15, lineHeight: 1.5 }}>{subhead}</p>
          </div>

          {pendingEmail ? (
            <Onboarding email={pendingEmail} />
          ) : (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sentTo ? (
                <p role="status" className="note rise">
                  <Icon d={paths.info} size={16} style={{ flex: "none", marginTop: 2, color: "var(--blue)" }} />
                  <span>We sent a confirmation link to {sentTo}. Open it, then come back and sign in.</span>
                </p>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input id="email" className="input" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="pw">Password</label>
                    <input
                      key={shakeKey}
                      id="pw"
                      className={`input${error ? " shake" : ""}`}
                      type="password"
                      autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "sign-up" ? 8 : undefined}
                      placeholder={mode === "sign-up" ? "At least 8 characters" : "Your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={error ? { borderColor: "#c52a30" } : undefined}
                    />
                  </div>
                  {error && <p role="alert" className="error"><Icon d={paths.warn} size={16} />{error}</p>}
                  <button className="btn big" type="submit" disabled={busy} style={{ marginTop: 4 }}>
                    {busy ? <Spinner /> : <>{mode === "sign-up" ? "Create account" : "Continue"} <Icon d={paths.arrow} /></>}
                  </button>
                </>
              )}
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", textAlign: "center" }}>
                {mode === "sign-in" ? "New to ConstroMan? " : "Already have an account? "}
                <a href="#" style={{ textDecoration: "none", fontWeight: 500 }} onClick={(e) => { e.preventDefault(); switchMode(); }}>
                  {mode === "sign-in" ? "Create an account" : "Sign in"}
                </a>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export function Splash() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--muted)" }}>
      <Wordmark />
      <Spinner />
    </div>
  );
}
