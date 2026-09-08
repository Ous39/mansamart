import React, { FormEvent, useEffect, useMemo, useState } from "react";
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
} as const;
type Section = keyof typeof sections;

function AdminApp() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [active, setActive] = useState<Section>("Overview");
  const [data, setData] = useState<unknown>(null);
  const [busy, setBusy] = useState(!!store.get());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!store.get()) return;
    api.me().then(({ user: current }) => {
      if (current.role !== "admin") throw new Error("Administrator access required");
      setUser(current);
    }).catch(() => store.clear()).finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setBusy(true); setError("");
    api.request(sections[active]).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load data")).finally(() => setBusy(false));
  }, [active, user]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.login(String(form.get("email")), String(form.get("password")));
      if (result.user.role !== "admin") throw new Error("Administrator access required");
      store.set(result.token); setUser(result.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Login failed"); }
    finally { setBusy(false); }
  }

  async function logout() { await api.logout().catch(() => undefined); store.clear(); setUser(null); setData(null); }

  if (!user) return <Login onSubmit={login} busy={busy} error={error}/>;
  return <div className="admin-shell">
    <aside><div className="brand"><span>M</span><div><b>MansaMart</b><small>CONTROL CENTRE</small></div></div><nav>{(Object.keys(sections) as Section[]).map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><i>{item.slice(0,1)}</i>{item}</button>)}</nav><div className="admin-user"><div>{user.name.slice(0,1)}</div><span><b>{user.name}</b><small>Administrator</small></span><button onClick={logout} title="Sign out">↗</button></div></aside>
    <main><header><div><p>ADMINISTRATION</p><h1>{active}</h1></div><div className="secure">● Secure session</div></header>{error && <div className="alert">{error}</div>}{busy ? <div className="loading">Loading secure data…</div> : <AdminContent section={active} data={data}/>}</main>
  </div>;
}

function Login({ onSubmit, busy, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) {
  return <main className="login-page"><section className="login-intro"><div className="brand light"><span>M</span><div><b>MansaMart</b><small>ADMINISTRATION</small></div></div><div><p className="kicker">RESTRICTED SYSTEM</p><h1>Operate the marketplace with clarity.</h1><p>Review businesses, coordinate orders, oversee delivery and protect every transaction from one secure control centre.</p></div><small>Private administrative system · All access is audited</small></section><section className="login-panel"><form onSubmit={onSubmit}><div className="lock">⌁</div><p className="kicker">SECURE SIGN IN</p><h2>Administrator access</h2><p>Use your authorised MansaMart administrator credentials.</p>{error && <div className="alert">{error}</div>}<label>Email address<input name="email" type="email" autoComplete="username" required autoFocus/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button className="submit" disabled={busy}>{busy ? "Verifying…" : "Continue securely"}</button><div className="security-note"><b>Protected access</b><span>Five failed attempts temporarily lock login from your network.</span></div></form></section></main>;
}

function AdminContent({ section, data }: { section: Section; data: unknown }) {
  if (section === "Overview") return <Overview data={data}/>;
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data as Record<string, unknown>).find(Array.isArray) as unknown[] || [] : [];
  return <section className="data-card"><div className="card-head"><div><h2>{section} management</h2><p>{rows.length} records returned by the live API</p></div><input placeholder={`Search ${section.toLowerCase()}…`}/></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Name / ID</th><th>Status / Role</th><th>Contact / Detail</th><th>Created</th></tr></thead><tbody>{rows.slice(0,50).map((raw, index) => { const row = raw as Record<string, unknown>; return <tr key={String(row.id || index)}><td><b>{String(row.name || row.storeName || row.id || "Record")}</b><small>{row.id ? String(row.id).slice(0,12) : ""}</small></td><td><span className="pill">{String(row.status || row.role || row.verificationStatus || "Active")}</span></td><td>{String(row.email || row.phone || row.total || row.amount || "—")}</td><td>{row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : "—"}</td></tr>; })}</tbody></table></div> : <div className="empty"><b>No {section.toLowerCase()} found</b><p>New records will appear here automatically.</p></div>}</section>;
}

function Overview({ data }: { data: unknown }) {
  const stats = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const cards = useMemo(() => [
    ["Total users", stats.totalUsers ?? stats.users ?? 0], ["Active vendors", stats.totalVendors ?? stats.vendors ?? 0], ["Orders", stats.totalOrders ?? stats.orders ?? 0], ["Service bookings", stats.totalBookings ?? stats.bookings ?? 0]
  ], [data]);
  return <><section className="metrics">{cards.map(([label,value], index) => <article key={String(label)}><div><span>{index + 1}</span><small>LIVE</small></div><h3>{Number(value || 0).toLocaleString()}</h3><p>{String(label)}</p></article>)}</section><section className="overview-grid"><article className="data-card"><p className="kicker">OPERATIONS</p><h2>Marketplace health</h2><div className="health-row"><span>API connection</span><b>Operational</b></div><div className="health-row"><span>Administrator session</span><b>Protected</b></div><div className="health-row"><span>Role isolation</span><b>Enabled</b></div></article><article className="data-card dark"><p className="kicker">SECURITY</p><h2>Admin access is isolated</h2><p>Administrator accounts are rejected by the general MansaMart website and all mobile applications.</p><b>admin.mansamart.gm only</b></article></section></>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><AdminApp/></React.StrictMode>);
