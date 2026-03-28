import { useState } from "react";

function initialSetupForm() {
  return {
    display_name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  };
}

function initialLoginForm() {
  return {
    username: "",
    password: "",
  };
}

export default function AuthScreen({
  setupRequired,
  submitting,
  error,
  onLogin,
  onSetup,
}) {
  const [setupForm, setSetupForm] = useState(initialSetupForm());
  const [loginForm, setLoginForm] = useState(initialLoginForm());
  const [localError, setLocalError] = useState("");

  const activeError = error || localError;
  const headline = setupRequired
    ? "Create the first MadiBudget login"
    : "Sign in to MadiBudget";

  function resetErrors() {
    setLocalError("");
  }

  async function handleSetupSubmit(event) {
    event.preventDefault();
    resetErrors();

    if (setupForm.password !== setupForm.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    await onSetup({
      display_name: setupForm.display_name.trim(),
      username: setupForm.username.trim(),
      email: setupForm.email.trim() || null,
      password: setupForm.password,
    });
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    resetErrors();

    await onLogin({
      username: loginForm.username.trim(),
      password: loginForm.password,
    });
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel auth-panel-brand">
        <div className="auth-brand-mark">MB</div>
        <p className="section-kicker">Secure Access</p>
        <h1 className="auth-title">MadiBudget</h1>
        <p className="auth-copy">
          A self-hosted household budget workspace for staying ahead of fixed
          expenses, category limits, and cash on hand.
        </p>

        <div className="auth-feature-list">
          <div className="auth-feature-card">
            <strong>Private household access</strong>
            <span>
              Keep budgeting data protected when the app is exposed through your
              reverse proxy.
            </span>
          </div>
          <div className="auth-feature-card">
            <strong>Backend-protected API</strong>
            <span>
              Every budget, transaction, and planning endpoint now requires an
              authenticated session.
            </span>
          </div>
          <div className="auth-feature-card">
            <strong>Practical for home use</strong>
            <span>
              Set up the first login once, then sign in from your phone,
              desktop, or tablet.
            </span>
          </div>
        </div>
      </div>

      <div className="auth-panel auth-panel-form">
        <div className="auth-form-header">
          <p className="section-kicker">
            {setupRequired ? "First Run" : "Account Access"}
          </p>
          <h2>{headline}</h2>
          <p className="section-subtitle">
            {setupRequired
              ? "Set the first household username and password. After that, the app will switch to normal sign-in."
              : "Use the household login to open the budgeting workspace."}
          </p>
        </div>

        {activeError ? <div className="banner banner-error">{activeError}</div> : null}

        {setupRequired ? (
          <form className="auth-form" onSubmit={handleSetupSubmit}>
            <div className="field">
              <label htmlFor="setup-display-name">Display Name</label>
              <input
                id="setup-display-name"
                value={setupForm.display_name}
                onChange={(event) =>
                  setSetupForm((current) => ({
                    ...current,
                    display_name: event.target.value,
                  }))
                }
                maxLength={120}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="setup-username">Username</label>
              <input
                id="setup-username"
                value={setupForm.username}
                onChange={(event) =>
                  setSetupForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                autoComplete="username"
                minLength={3}
                maxLength={80}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="setup-email">Email</label>
              <input
                id="setup-email"
                type="email"
                value={setupForm.email}
                onChange={(event) =>
                  setSetupForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                maxLength={255}
              />
            </div>

            <div className="field">
              <label htmlFor="setup-password">Password</label>
              <input
                id="setup-password"
                type="password"
                value={setupForm.password}
                onChange={(event) =>
                  setSetupForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="setup-confirm-password">Confirm Password</label>
              <input
                id="setup-confirm-password"
                type="password"
                value={setupForm.confirmPassword}
                onChange={(event) =>
                  setSetupForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            <div className="button-row auth-button-row">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Create Login"}
              </button>
            </div>
          </form>
        ) : null}

        {!setupRequired ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                autoComplete="username"
                minLength={3}
                maxLength={80}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                autoComplete="current-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            <div className="button-row auth-button-row">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Signing In..." : "Sign In"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
