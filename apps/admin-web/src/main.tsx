import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MansaMartApi } from "@mansamart/api-client";
import { createTokenStore } from "@mansamart/authentication";
import type { SessionUser } from "@mansamart/shared-types";
import "./styles.css";

const store = createTokenStore("mansamart_admin_session");
const api = new MansaMartApi(import.meta.env.VITE_API_URL || "http://127.0.0.1:5000", "admin", store.get);

const sections = {
  Overview: "/api/admin/stats",
  Users: "/api/admin/users",
  Vendors: "/api/admin/vendors",
  Orders: "/api/admin/orders",
  Riders: "/api/admin/riders",
  Verification: "/api/admin/verifications",
  Finance: "/api/admin/payments",
  Payouts: "/api/admin/payouts",
  Returns: "/api/admin/returns",
  Support: "/api/admin/support/tickets",
  Audit: "/api/admin/audit-logs",
  WhatsApp: "/api/admin/whatsapp",
} as const;
type Section = keyof typeof sections;
type AdminLoginResult =
  | { token: string; user: SessionUser; expiresIn: number }
  | { mfaRequired: true; challengeId: string; expiresIn: number };

function AdminApp() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [active, setActive] = useState<Section>("Overview");
  const [data, setData] = useState<unknown>(null);
  const [busy, setBusy] = useState(!!store.get());
  const [error, setError] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const loadSection = useCallback(async () => {
    if (!user) return;
    setBusy(true); setError("");
    try { setData(await api.request(sections[active])); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load data"); }
    finally { setBusy(false); }
  }, [active, user]);

  useEffect(() => {
    if (!store.get()) return;
    api.me().then(({ user: current }) => {
      if (current.role !== "admin") throw new Error("Administrator access required");
      setUser(current);
    }).catch(() => store.clear()).finally(() => setBusy(false));
  }, []);

  useEffect(() => { void loadSection(); }, [loadSection]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.request<AdminLoginResult>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: String(form.get("email")), password: String(form.get("password")) }),
      });
      if ("mfaRequired" in result) {
        setChallengeId(result.challengeId);
        return;
      }
      if (result.user.role !== "admin") throw new Error("Administrator access required");
      store.set(result.token); setUser(result.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Login failed"); }
    finally { setBusy(false); }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.request<{ token: string; user: SessionUser }>("/api/admin/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId, code: String(form.get("code")) }),
      });
      if (result.user.role !== "admin") throw new Error("Administrator access required");
      store.set(result.token); setUser(result.user); setChallengeId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed"); }
    finally { setBusy(false); }
  }

  async function logout() { await api.logout().catch(() => undefined); store.clear(); setUser(null); setData(null); }

  if (!user) return <Login onSubmit={login} onVerifyMfa={verifyMfa} onCancelMfa={() => { setChallengeId(null); setError(""); }} challengeId={challengeId} busy={busy} error={error}/>;
  return <div className="admin-shell">
    <aside><div className="brand"><span>M</span><div><b>MansaMart</b><small>CONTROL CENTRE</small></div></div><nav>{(Object.keys(sections) as Section[]).map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><i>{item.slice(0,1)}</i>{item}</button>)}</nav><div className="admin-user"><div>{user.name.slice(0,1)}</div><span><b>{user.name}</b><small>Administrator</small></span><button onClick={logout} title="Sign out">↗</button></div></aside>
    <main><header><div><p>ADMINISTRATION</p><h1>{active}</h1></div><div className="secure">● Secure session</div></header>{error && <div className="alert">{error}</div>}{busy ? <div className="loading">Loading secure data…</div> : <AdminContent section={active} data={data} refresh={loadSection}/>}</main>
  </div>;
}

function Login({ onSubmit, onVerifyMfa, onCancelMfa, challengeId, busy, error }: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVerifyMfa: (event: FormEvent<HTMLFormElement>) => void;
  onCancelMfa: () => void;
  challengeId: string | null;
  busy: boolean;
  error: string;
}) {
  return <main className="login-page"><section className="login-intro"><div className="brand light"><span>M</span><div><b>MansaMart</b><small>ADMINISTRATION</small></div></div><div><p className="kicker">RESTRICTED SYSTEM</p><h1>Operate the marketplace with clarity.</h1><p>Review businesses, coordinate orders, oversee delivery and protect every transaction from one secure control centre.</p></div><small>Private administrative system · All access is audited</small></section><section className="login-panel">{challengeId ? <form onSubmit={onVerifyMfa}><div className="lock">✉</div><p className="kicker">SECOND STEP</p><h2>Check your administrator email</h2><p>Enter the six-digit code. It expires in 10 minutes and can be used only once.</p>{error && <div className="alert">{error}</div>}<label>Verification code<input name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required autoFocus/></label><button className="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}</button><button type="button" className="refresh" disabled={busy} onClick={onCancelMfa}>Back to password</button><div className="security-note"><b>One-time code</b><span>After five failed codes, start the sign-in process again.</span></div></form> : <form onSubmit={onSubmit}><div className="lock">⌁</div><p className="kicker">SECURE SIGN IN</p><h2>Administrator access</h2><p>Use your authorised MansaMart administrator credentials.</p>{error && <div className="alert">{error}</div>}<label>Email address<input name="email" type="email" autoComplete="username" required autoFocus/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button className="submit" disabled={busy}>{busy ? "Verifying…" : "Continue securely"}</button><div className="security-note"><b>Protected access</b><span>Production sign-in requires a one-time email code.</span></div></form>}</section></main>;
}

function AdminContent({ section, data, refresh }: { section: Section; data: unknown; refresh: () => Promise<void> }) {
  if (section === "Overview") return <Overview data={data}/>;
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data as Record<string, unknown>).find(Array.isArray) as unknown[] || [] : [];
  return <section className="data-card"><div className="card-head"><div><h2>{section} management</h2><p>{rows.length} records returned by the live API</p></div><button className="refresh" onClick={() => void refresh()}>Refresh</button></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Name / ID</th><th>Status / Role</th><th>Contact / Detail</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.slice(0,100).map((raw, index) => <AdminRow key={String((raw as Record<string, unknown>).id || index)} section={section} row={raw as Record<string, unknown>} refresh={refresh}/>)}</tbody></table></div> : <div className="empty"><b>No {section.toLowerCase()} found</b><p>New records will appear here automatically.</p></div>}</section>;
}

function AdminRow({ section, row, refresh }: { section: Section; row: Record<string, unknown>; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const nestedUser = row.user && typeof row.user === "object" ? row.user as Record<string, unknown> : null;
  const nestedCustomer = row.customer && typeof row.customer === "object" ? row.customer as Record<string, unknown> : null;
  const id = String(row.id || row.userId || "");
  const name = String(row.name || row.storeName || row.displayName || nestedUser?.name || nestedCustomer?.name || row.subject || row.action || id || "Record");
  const detail = String(row.email || row.phone || nestedUser?.email || nestedCustomer?.email || row.total || row.amount || row.eventType || row.entityType || "—");
  const status = String(row.status || row.role || row.verificationStatus || row.paymentStatus || "active");
  const run = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    try { await api.request(path, { method: "PUT", body: JSON.stringify(body) }); await refresh(); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Admin action failed"); }
    finally { setBusy(false); }
  };
  const post = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    try { await api.request(path, { method: "POST", body: JSON.stringify(body) }); await refresh(); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Admin action failed"); }
    finally { setBusy(false); }
  };
  let actions: React.ReactNode = <span className="muted">View only</span>;
  if (section === "Verification") {
    const type = String(row.type || ""); const userId = String(row.userId || nestedUser?.id || row.id || "");
    actions = <div className="row-actions"><button disabled={busy} onClick={() => void run(`/api/admin/verify/${type}/${userId}`, { status: "verified" })}>Approve</button><button className="danger" disabled={busy} onClick={() => { const note = window.prompt("Reason for rejection"); if (note) void run(`/api/admin/verify/${type}/${userId}`, { status: "rejected", note }); }}>Reject</button></div>;
  } else if (section === "Payouts") {
    actions = <div className="row-actions"><button disabled={busy || status !== "pending"} onClick={() => void run(`/api/admin/payouts/${id}`, { status: "approved" })}>Approve</button><button disabled={busy || status !== "approved"} onClick={() => { const currentPassword = window.prompt("Re-enter your administrator password to complete this payout"); if (currentPassword) void run(`/api/admin/payouts/${id}`, { status: "completed", currentPassword }); }}>Complete</button></div>;
  } else if (section === "Support") {
    actions = <div className="row-actions"><button disabled={busy} onClick={() => void run(`/api/admin/support/tickets/${id}`, { status: "in_progress" })}>Take</button><button disabled={busy} onClick={() => void run(`/api/admin/support/tickets/${id}`, { status: "resolved" })}>Resolve</button></div>;
  } else if (section === "Returns") {
    actions = <div className="row-actions"><button disabled={busy} onClick={() => void run(`/api/admin/returns/${id}`, { status: "reviewing", resolution: "Under administrator review" })}>Review</button><button disabled={busy} onClick={() => { const resolution = window.prompt("Resolution note"); if (resolution) void run(`/api/admin/returns/${id}`, { status: "approved", resolution }); }}>Approve</button></div>;
  } else if (section === "Riders" && status === "pending") {
    const userId = String(row.userId || nestedUser?.id || "");
    actions = <div className="row-actions"><button disabled={busy} onClick={() => void run(`/api/admin/riders/${userId}/verify`, { status: "verified" })}>Verify</button></div>;
  } else if (section === "Finance" && ["succeeded", "requires_refund"].includes(status)) {
    actions = <div className="row-actions"><button className="danger" disabled={busy} onClick={() => {
      const reason = window.prompt("Refund reason (at least 5 characters)");
      if (!reason || reason.trim().length < 5) return;
      const currentPassword = window.prompt("Re-enter your administrator password to authorize this refund");
      if (currentPassword && window.confirm("Issue a full Wave refund for this payment?")) {
        void post(`/api/admin/payments/${id}/refund`, { reason: reason.trim(), currentPassword });
      }
    }}>Refund</button></div>;
  }
  return <tr><td><b>{name}</b><small>{id.slice(0, 12)}</small></td><td><span className="pill">{status.replace(/_/g, " ")}</span></td><td>{detail}</td><td>{row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : "—"}</td><td>{actions}</td></tr>;
}

function Overview({ data }: { data: unknown }) {
  const stats = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const cards = useMemo(() => [
    ["Total users", stats.totalUsers ?? stats.users ?? 0], ["Active vendors", stats.totalVendors ?? stats.vendors ?? 0], ["Orders", stats.totalOrders ?? stats.orders ?? 0], ["Service bookings", stats.totalBookings ?? stats.bookings ?? 0]
  ], [data]);
  return <><section className="metrics">{cards.map(([label,value], index) => <article key={String(label)}><div><span>{index + 1}</span><small>LIVE</small></div><h3>{Number(value || 0).toLocaleString()}</h3><p>{String(label)}</p></article>)}</section><section className="overview-grid"><article className="data-card"><p className="kicker">OPERATIONS</p><h2>Marketplace health</h2><div className="health-row"><span>API connection</span><b>Operational</b></div><div className="health-row"><span>Administrator session</span><b>Protected</b></div><div className="health-row"><span>Role isolation</span><b>Enabled</b></div></article><article className="data-card dark"><p className="kicker">SECURITY</p><h2>Admin access is isolated</h2><p>Administrator accounts are rejected by the general MansaMart website and all mobile applications.</p><b>admin.mansamart.gm only</b></article></section></>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><AdminApp/></React.StrictMode>);
