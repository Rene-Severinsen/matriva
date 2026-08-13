import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createMatrivaAdminApiClient,
  MatrivaApiError,
  type MatrivaAdminApiClient
} from "@matriva/api-client";
import type { AdminBootstrapResponse, SessionTokens } from "@matriva/shared";

import { AdminDataPage } from "./pages/AdminDataPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { EntitlementsPage } from "./pages/EntitlementsPage.js";
import { GuidesPage } from "./pages/GuidesPage.js";
import { TaskClustersPage } from "./pages/TaskClustersPage.js";
import { Icon, type IconName } from "./components/Icon.js";
import {
  adminEnvironmentOptions,
  allowsAdminEnvironmentSwitch,
  persistAdminEnvironment,
  resolveAdminEnvironment,
  type AdminEnvironment,
  type AdminEnvironmentKey
} from "./adminEnvironment.js";

const refreshTokenStorageKey = "matriva.admin.refreshToken.v1";

type AuthState =
  | { status: "restoring" }
  | { status: "anonymous" }
  | { status: "authenticated"; tokens: SessionTokens; bootstrap: AdminBootstrapResponse }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

type ViewKey = "dashboard" | "users" | "houses" | "claims" | "recommendations" | "task-clusters" | "guides" | "settings";
type DetailRoute =
  | { view: "users"; id: string }
  | { view: "houses"; id: string }
  | { view: "claims"; id: string }
  | { view: "recommendations"; id: string }
  | { view: "guides"; id: string };

const navigation: Array<{
  key: ViewKey;
  label: string;
  icon: IconName;
  disabled?: boolean;
}> = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "users", label: "Brugere", icon: "users" },
  { key: "houses", label: "Boliger", icon: "houses" },
  { key: "claims", label: "Adgangskrav", icon: "users" },
  {
    key: "recommendations",
    label: "Anbefalinger",
    icon: "recommendations"
  },
  { key: "task-clusters", label: "Brugernes opgavetyper", icon: "activity" },
  { key: "guides", label: "Vejledninger", icon: "guides" },
  { key: "settings", label: "Planer og adgang", icon: "settings" }
];

const routePaths: Record<ViewKey, string> = {
  dashboard: "/admin",
  users: "/admin/users",
  houses: "/admin/houses",
  claims: "/admin/claims",
  recommendations: "/admin/recommendations",
  "task-clusters": "/admin/task-clusters",
  guides: "/admin/guides",
  settings: "/admin/settings"
};

function routeFromLocation(): { view: ViewKey; detail: DetailRoute | null } {
  const path = window.location.pathname.replace(/\/$/, "");
  const parts = path.split("/").filter(Boolean);

  if (parts[0] !== "admin") {
    return { view: "dashboard", detail: null };
  }

  if (parts[1] === "users") {
    return {
      view: "users",
      detail: parts[2]
        ? { view: "users", id: decodeURIComponent(parts[2]) }
        : null
    };
  }

  if (parts[1] === "houses") {
    return {
      view: "houses",
      detail: parts[2]
        ? { view: "houses", id: decodeURIComponent(parts[2]) }
        : null
    };
  }

  if (parts[1] === "claims") {
    return { view: "claims", detail: parts[2] ? { view: "claims", id: decodeURIComponent(parts[2]) } : null };
  }

  if (parts[1] === "recommendations") {
    return {
      view: "recommendations",
      detail: parts[2]
        ? { view: "recommendations", id: decodeURIComponent(parts[2]) }
        : null
    };
  }

  if (parts[1] === "task-clusters") {
    return { view: "task-clusters", detail: null };
  }

  if (parts[1] === "guides") {
    return {
      view: "guides",
      detail: parts[2]
        ? { view: "guides", id: decodeURIComponent(parts[2]) }
        : null
    };
  }

  if (parts[1] === "settings") {
    return { view: "settings", detail: null };
  }

  return { view: "dashboard", detail: null };
}

function userFacingError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Matriva Admin kunne ikke gennemføre handlingen.";
}

export function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ status: "restoring" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [route, setRoute] = useState(routeFromLocation);
  const [adminEnvironment, setAdminEnvironment] = useState(resolveAdminEnvironment);
  const restorePromiseRef = useRef<Promise<SessionTokens | null> | null>(null);
  const canSwitchEnvironment = allowsAdminEnvironmentSwitch();

  const client = useMemo(
    () =>
      createMatrivaAdminApiClient({
        baseUrl: adminEnvironment.apiBaseUrl,
        getAccessToken: () => accessToken
      }),
    [accessToken, adminEnvironment.apiBaseUrl]
  );

  function clearLocalSession(nextAuthState: AuthState = { status: "anonymous" }) {
    restorePromiseRef.current = null;
    sessionStorage.removeItem(refreshTokenStorageKey);
    setAccessToken(null);
    setAuthState(nextAuthState);
  }

  function changeAdminEnvironment(environmentKey: AdminEnvironmentKey) {
    if (!canSwitchEnvironment || environmentKey === adminEnvironment.key) {
      return;
    }

    const nextEnvironment =
      adminEnvironmentOptions.find((option) => option.key === environmentKey) ??
      adminEnvironmentOptions[0];

    persistAdminEnvironment(nextEnvironment.key);
    setAdminEnvironment(nextEnvironment);
    setLoginMessage(null);
    setPassword("");
    clearLocalSession();

    if (window.location.pathname !== "/admin") {
      window.history.pushState({}, "", "/admin");
      setRoute(routeFromLocation());
    }
  }

  async function loadAdminSession(tokens: SessionTokens) {
    setAccessToken(tokens.accessToken);

    try {
      const sessionClient = createMatrivaAdminApiClient({
        baseUrl: adminEnvironment.apiBaseUrl,
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
      try {
        if (!restorePromiseRef.current) {
          const refreshToken = sessionStorage.getItem(refreshTokenStorageKey);

          restorePromiseRef.current = refreshToken
            ? client
                .refreshSession({ refreshToken })
                .then((session) => session.tokens)
            : Promise.resolve(null);
        }

        const tokens = await restorePromiseRef.current;

        if (!cancelled) {
          if (tokens) {
            await loadAdminSession(tokens);
          } else {
            setAuthState({ status: "anonymous" });
          }
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

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(view: ViewKey, id?: string) {
    const path = id
      ? `${routePaths[view]}/${encodeURIComponent(id)}`
      : routePaths[view];
    window.history.pushState({}, "", path);
    setRoute(routeFromLocation());
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);

    try {
      const session = await client.adminLogin({ email, password });
      setPassword("");
      await loadAdminSession(session.tokens);
    } catch (error) {
      setLoginMessage(userFacingError(error));
    } finally {
      setPassword("");
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    const tokens = authState.status === "authenticated" ? authState.tokens : null;
    clearLocalSession();

    if (tokens) {
      try {
        await client.logout({ refreshToken: tokens.refreshToken });
      } catch {
        // Local browser state is already cleared; server session expires or is revoked later.
      }
    }
  }

  async function handleDashboardAuthorizationError(error: unknown) {
    if (!(error instanceof MatrivaApiError)) {
      return false;
    }

    if (error.status === 403) {
      clearLocalSession({ status: "unauthorized", message: error.message });
      return true;
    }

    if (error.status !== 401 || authState.status !== "authenticated") {
      return false;
    }

    try {
      const refreshed = await createMatrivaAdminApiClient({
        baseUrl: adminEnvironment.apiBaseUrl
      }).refreshSession({ refreshToken: authState.tokens.refreshToken });
      await loadAdminSession(refreshed.tokens);
    } catch {
      await logout();
    }

    return true;
  }

  if (authState.status === "restoring") {
    return <FullPageState title="Indlæser adminsession" body="Vent et øjeblik." />;
  }

  if (authState.status === "authenticated") {
    return (
      <AdminShell
        activeView={route.view}
        adminEnvironment={adminEnvironment}
        bootstrap={authState.bootstrap}
        canSwitchEnvironment={canSwitchEnvironment}
        client={client}
        detail={route.detail}
        onEnvironmentChange={changeAdminEnvironment}
        onAuthorizationError={handleDashboardAuthorizationError}
        onLogout={() => void logout()}
        onNavigate={navigate}
      />
    );
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={(event) => void login(event)}>
        <div className="login-heading">
          <p className="eyebrow">Matriva Admin</p>
          <EnvironmentBadge environment={adminEnvironment} />
        </div>
        <h1>Log ind</h1>
        <EnvironmentControl
          canSwitch={canSwitchEnvironment}
          environment={adminEnvironment}
          onChange={changeAdminEnvironment}
        />
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
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <button
          className="primary-action"
          disabled={
            isLoggingIn ||
            email.trim().length === 0 ||
            password.length === 0
          }
          type="submit"
        >
          {isLoggingIn ? "Logger ind..." : "Log ind"}
        </button>
        {authState.status === "unauthorized" || authState.status === "error" ? (
          <p className="state-message error">{authState.message}</p>
        ) : null}
        {loginMessage ? <p className="state-message">{loginMessage}</p> : null}
      </form>
    </main>
  );
}

function AdminShell({
  activeView,
  adminEnvironment,
  bootstrap,
  canSwitchEnvironment,
  client,
  detail,
  onEnvironmentChange,
  onAuthorizationError,
  onLogout,
  onNavigate
}: {
  activeView: ViewKey;
  adminEnvironment: AdminEnvironment;
  bootstrap: AdminBootstrapResponse;
  canSwitchEnvironment: boolean;
  client: MatrivaAdminApiClient;
  detail: DetailRoute | null;
  onEnvironmentChange: (environmentKey: AdminEnvironmentKey) => void;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onLogout: () => void;
  onNavigate: (view: ViewKey, id?: string) => void;
}) {
  const activeLabel =
    navigation.find((item) => item.key === activeView)?.label ?? "Dashboard";

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand">Matriva Admin</div>
          <EnvironmentBadge environment={adminEnvironment} />
        </div>
        <nav aria-label="Admin navigation">
          {navigation.map((item) => (
            <button
              className={item.key === activeView ? "nav-item active" : "nav-item"}
              disabled={item.disabled}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <span className="nav-label">
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </span>
              {item.disabled ? <small>Senere</small> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <EnvironmentControl
            canSwitch={canSwitchEnvironment}
            environment={adminEnvironment}
            onChange={onEnvironmentChange}
          />
          <div className="account-profile">
            <span className="account-avatar" aria-hidden="true">
              {(bootstrap.admin.displayName ?? bootstrap.admin.email)
                .charAt(0)
                .toLocaleUpperCase("da-DK")}
            </span>
            <div className="account-copy">
              {bootstrap.admin.displayName ? (
                <strong>{bootstrap.admin.displayName}</strong>
              ) : null}
              <span>{bootstrap.admin.email}</span>
            </div>
          </div>
          <button className="logout-action" type="button" onClick={onLogout}>
            <Icon name="logout" />
            <span>Log ud</span>
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Matriva administration</p>
            <h1>{activeLabel}</h1>
          </div>
        </header>
        <main className="content-surface">
          {activeView === "dashboard" ? (
            <DashboardPage
              client={client}
              onAuthorizationError={onAuthorizationError}
            />
          ) : activeView === "users" ||
            activeView === "houses" ||
            activeView === "claims" ||
            activeView === "recommendations" ? (
            <AdminDataPage
              client={client}
              detail={
                detail && detail.view !== "guides"
                  ? { section: detail.view, id: detail.id }
                  : null
              }
              onAuthorizationError={onAuthorizationError}
              onOpenDetail={(section, id) => onNavigate(section, id)}
              section={activeView}
            />
          ) : activeView === "guides" ? (
            <GuidesPage
              client={client}
              detail={detail?.view === "guides" ? detail : null}
              onAuthorizationError={onAuthorizationError}
              onNavigate={(id) => onNavigate("guides", id)}
            />
          ) : activeView === "settings" ? (
            <EntitlementsPage client={client} onAuthorizationError={onAuthorizationError} />
          ) : activeView === "task-clusters" ? (
            <TaskClustersPage client={client} onAuthorizationError={onAuthorizationError} />
          ) : (
            <FullPageState
              title="Kommer senere"
              body="Denne adminside er ikke en del af dashboard-scope."
            />
          )}
        </main>
      </section>
    </div>
  );
}

function EnvironmentBadge({ environment }: { environment: AdminEnvironment }) {
  return (
    <span className={`environment-badge ${environment.key}`}>
      {environment.badge}
    </span>
  );
}

function EnvironmentControl({
  canSwitch,
  environment,
  onChange
}: {
  canSwitch: boolean;
  environment: AdminEnvironment;
  onChange: (environmentKey: AdminEnvironmentKey) => void;
}) {
  if (!canSwitch) {
    return (
      <div className="environment-control locked">
        <span>Miljø</span>
        <strong>{environment.label}</strong>
      </div>
    );
  }

  return (
    <label className="environment-control">
      Miljø
      <select
        onChange={(event) => onChange(event.target.value as AdminEnvironmentKey)}
        value={environment.key}
      >
        {adminEnvironmentOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
