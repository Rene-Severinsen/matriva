import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMatrivaApiClient } from "@matriva/api-client";
import type { AdminBootstrapResponse, SessionTokens } from "@matriva/shared";

import "./styles.css";

const apiBaseUrl =
  import.meta.env.VITE_MATRIVA_API_BASE_URL?.trim() || "http://127.0.0.1:4000";
const refreshTokenStorageKey = "matriva.admin.refreshToken.v1";

type AuthState =
  | { status: "restoring" }
  | { status: "anonymous" }
  | { status: "authenticated"; tokens: SessionTokens; bootstrap: AdminBootstrapResponse }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

type ViewKey = "dashboard" | "users" | "houses" | "recommendations" | "settings";

const navigation: Array<{ key: ViewKey; label: string; disabled?: boolean }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "Brugere", disabled: true },
  { key: "houses", label: "Boliger", disabled: true },
  { key: "recommendations", label: "Anbefalinger", disabled: true },
  { key: "settings", label: "Indstillinger", disabled: true }
];

function magicLinkTokenFromLocation() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");

  if (token) {
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
  }

  return token;
}

function adminUrlForMagicLink(magicLink: string) {
  const token = new URL(magicLink).searchParams.get("token");

  if (!token) {
    return magicLink;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("token", token);
  return url.toString();
}

function userFacingError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Matriva Admin kunne ikke gennemføre handlingen.";
}

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ status: "restoring" });
  const [email, setEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");

  const client = useMemo(
    () =>
      createMatrivaApiClient({
        baseUrl: apiBaseUrl,
        getAccessToken: () => accessToken
      }),
    [accessToken]
  );

  async function loadAdminSession(tokens: SessionTokens) {
    setAccessToken(tokens.accessToken);

    try {
      const sessionClient = createMatrivaApiClient({
        baseUrl: apiBaseUrl,
        getAccessToken: () => tokens.accessToken
      });
      const bootstrap = await sessionClient.getAdminBootstrap();
      sessionStorage.setItem(refreshTokenStorageKey, tokens.refreshToken);
      setAuthState({ status: "authenticated", tokens, bootstrap });
    } catch (error) {
      sessionStorage.removeItem(refreshTokenStorageKey);
      setAccessToken(null);
      setAuthState({
        status: "unauthorized",
        message: userFacingError(error)
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = magicLinkTokenFromLocation();

      try {
        if (token) {
          const session = await client.consumeMagicLink({ token });

          if (!cancelled) {
            await loadAdminSession(session.tokens);
          }
          return;
        }

        const refreshToken = sessionStorage.getItem(refreshTokenStorageKey);

        if (!refreshToken) {
          setAuthState({ status: "anonymous" });
          return;
        }

        const refreshed = await client.refreshSession({ refreshToken });

        if (!cancelled) {
          await loadAdminSession(refreshed.tokens);
        }
      } catch (error) {
        sessionStorage.removeItem(refreshTokenStorageKey);
        setAccessToken(null);

        if (!cancelled) {
          setAuthState({ status: "anonymous" });
          setLoginMessage(userFacingError(error));
        }
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  async function requestMagicLink() {
    setIsRequestingLink(true);
    setLoginMessage(null);

    try {
      const response = await client.requestMagicLink({ email });
      setLoginMessage(
        response.devMagicLink
          ? `Dev loginlink: ${adminUrlForMagicLink(response.devMagicLink)}`
          : response.message
      );
    } catch (error) {
      setLoginMessage(userFacingError(error));
    } finally {
      setIsRequestingLink(false);
    }
  }

  async function logout() {
    const tokens = authState.status === "authenticated" ? authState.tokens : null;
    sessionStorage.removeItem(refreshTokenStorageKey);
    setAccessToken(null);
    setAuthState({ status: "anonymous" });

    if (tokens) {
      try {
        await client.logout({ refreshToken: tokens.refreshToken });
      } catch {
        // Local browser state is already cleared; server session expires or is revoked later.
      }
    }
  }

  if (authState.status === "restoring") {
    return <FullPageState title="Indlæser adminsession" body="Vent et øjeblik." />;
  }

  if (authState.status === "authenticated") {
    return (
      <AdminShell
        activeView={activeView}
        bootstrap={authState.bootstrap}
        onLogout={() => void logout()}
        onNavigate={setActiveView}
      />
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">Matriva Admin</p>
        <h1>Log ind med magic link</h1>
        <label>
          E-mail
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="rene@joinit.dk"
            type="email"
            value={email}
          />
        </label>
        <button
          className="primary-action"
          disabled={isRequestingLink || email.trim().length === 0}
          onClick={() => void requestMagicLink()}
          type="button"
        >
          {isRequestingLink ? "Sender..." : "Send loginlink"}
        </button>
        {authState.status === "unauthorized" ? (
          <p className="state-message error">{authState.message}</p>
        ) : null}
        {authState.status === "error" ? (
          <p className="state-message error">{authState.message}</p>
        ) : null}
        {loginMessage ? <p className="state-message">{loginMessage}</p> : null}
      </section>
    </main>
  );
}

function AdminShell({
  activeView,
  bootstrap,
  onLogout,
  onNavigate
}: {
  activeView: ViewKey;
  bootstrap: AdminBootstrapResponse;
  onLogout: () => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const activeLabel =
    navigation.find((item) => item.key === activeView)?.label ?? "Dashboard";

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">Matriva Admin</div>
        <nav aria-label="Admin navigation">
          {navigation.map((item) => (
            <button
              className={item.key === activeView ? "nav-item active" : "nav-item"}
              disabled={item.disabled}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <span>{item.label}</span>
              {item.disabled ? <small>Senere</small> : null}
            </button>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeLabel}</p>
            <h1>{activeLabel}</h1>
          </div>
          <div className="admin-user">
            <span>{bootstrap.admin.email}</span>
            <button type="button" onClick={onLogout}>
              Log ud
            </button>
          </div>
        </header>
        <section className="content-surface">
          {activeView === "dashboard" ? (
            <EmptyDashboard bootstrap={bootstrap} />
          ) : (
            <FullPageState title="Kommer senere" body="Denne adminside er ikke en del af foundation-scope." />
          )}
        </section>
      </section>
    </div>
  );
}

function EmptyDashboard({ bootstrap }: { bootstrap: AdminBootstrapResponse }) {
  return (
    <div className="empty-dashboard">
      <h2>Dashboard foundation er klar</h2>
      <p>
        Adminadgang er valideret server-side for{" "}
        {bootstrap.admin.displayName ?? bootstrap.admin.email}.
      </p>
      <dl>
        <div>
          <dt>Rolle</dt>
          <dd>{bootstrap.admin.roles.join(", ")}</dd>
        </div>
        <div>
          <dt>Genereret</dt>
          <dd>{new Date(bootstrap.generatedAt).toLocaleString("da-DK")}</dd>
        </div>
      </dl>
    </div>
  );
}

function FullPageState({ title, body }: { title: string; body: string }) {
  return (
    <div className="full-page-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
