import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MansaMartApi } from "@mansamart/api-client";
import { createTokenStore, roleLabel, webRouteForRole } from "@mansamart/authentication";
import { formatDalasi } from "@mansamart/business-logic";
import type { ProductSummary, SessionUser } from "@mansamart/shared-types";
import "./styles.css";

const tokenStore = createTokenStore("mansamart_web_session");
const api = new MansaMartApi(import.meta.env.VITE_API_URL || "http://127.0.0.1:5000", "web", tokenStore.get);

function App() {
  const paymentRedirect = window.location.pathname.match(/^\/payment\/wave\/(success|error)$/);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [dashboard, setDashboard] = useState<unknown>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api.request<ProductSummary[]>("/api/products").then(setProducts).catch(() => setProducts([]));
    if (!tokenStore.get()) { setBusy(false); return; }
    api.me().then(({ user: current }) => {
      if (current.role === "admin") throw new Error("Administrators must use admin.mansamart.gm");
      setUser(current); window.history.replaceState({}, "", webRouteForRole(current.role));
    }).catch(() => tokenStore.clear()).finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const endpoint = user.role === "user" ? "/api/orders" : user.role === "vendor" ? "/api/vendor/dashboard" : user.role === "service_provider" ? "/api/bookings" : "/api/rider/dashboard";
    api.request(endpoint).then(setDashboard).catch(() => setDashboard(null));
  }, [user]);

  const featured = useMemo(() => products.slice(0, 8), [products]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.login(String(form.get("email")), String(form.get("password")));
      if (result.user.role === "admin") throw new Error("Administrators must sign in at admin.mansamart.gm");
      tokenStore.set(result.token); setUser(result.user); setLoginOpen(false);
      window.history.replaceState({}, "", webRouteForRole(result.user.role));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await api.logout().catch(() => undefined); tokenStore.clear(); setUser(null); setDashboard(null); window.history.replaceState({}, "", "/");
  }

  if (paymentRedirect) return <PaymentRedirect kind={paymentRedirect[1] as "success" | "error"}/>;
  if (busy && tokenStore.get()) return <div className="loading">Loading MansaMart…</div>;

  return <div className="site-shell">
    <header className="nav"><a className="logo" href="/" onClick={() => setUser(null)}><span>M</span>MansaMart</a><nav><a href="#shop">Shop</a><a href="#services">Services</a><a href="#business">Sell on MansaMart</a></nav>{user ? <div className="account"><span>{roleLabel(user.role)}</span><button className="ghost" onClick={logout}>Sign out</button></div> : <button className="sign-in" onClick={() => setLoginOpen(true)}>Sign in</button>}</header>
    {user ? <Dashboard user={user} data={dashboard} /> : <>
      <main className="hero"><div><p className="eyebrow">THE GAMBIA'S DIGITAL MARKETPLACE</p><h1>Everything you need,<br/><em>closer to home.</em></h1><p className="lead">Discover products, trusted local professionals and reliable delivery—all through one Gambian marketplace.</p><div className="hero-actions"><a className="primary" href="#shop">Explore marketplace</a><button className="text-button" onClick={() => setLoginOpen(true)}>Sign in to your account →</button></div><div className="proof"><b>Secure orders</b><b>Verified businesses</b><b>Local delivery</b></div></div><div className="hero-card"><div className="flag">🇬🇲</div><span>Built for The Gambia</span><strong>Shop. Sell.<br/>Deliver.</strong><small>One connected marketplace</small></div></main>
      <section className="section" id="shop"><div className="section-heading"><div><p className="eyebrow">MARKETPLACE</p><h2>Popular right now</h2></div><span>{products.length || "Fresh"} products available</span></div><div className="product-grid">{featured.length ? featured.map((product) => <article className="product" key={product.id}><div className="product-image">{product.images?.[0] ? <img src={product.images[0]} alt=""/> : <span>MM</span>}</div><small>{product.brand}</small><h3>{product.name}</h3><div><b>{formatDalasi(product.price)}</b><span>★ {product.rating || "New"}</span></div></article>) : <p className="empty">Products will appear when the API is connected.</p>}</div></section>
      <section className="business-band" id="business"><p className="eyebrow">GROW WITH MANSAMART</p><h2>Turn your business or skill into opportunity.</h2><p>Vendors and service providers can manage their work here or through the dedicated MansaMart Business app.</p><button onClick={() => setLoginOpen(true)}>Business sign in</button></section>
    </>}
    <footer><b>MansaMart</b><span>Made in The Gambia by OceanBrown</span><span>Customer support · Privacy · Terms</span></footer>
    {loginOpen && <div className="modal-backdrop" onMouseDown={() => setLoginOpen(false)}><form className="login-card" onSubmit={login} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="close" onClick={() => setLoginOpen(false)}>×</button><span className="login-mark">M</span><h2>Welcome back</h2><p>Customers, vendors, providers and riders can sign in here.</p>{error && <div className="error">{error}</div>}<label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required autoComplete="current-password"/></label><button className="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button><small>Administrator accounts cannot sign in on this website.</small></form></div>}
  </div>;
}

function PaymentRedirect({ kind }: { kind: "success" | "error" }) {
  const success = kind === "success";
  return <main className="payment-return"><section><span className={success ? "payment-icon success" : "payment-icon error"}>{success ? "✓" : "!"}</span><p className="eyebrow">WAVE CHECKOUT</p><h1>{success ? "Payment submitted" : "Payment was not completed"}</h1><p>{success ? "Return to MansaMart while we verify the signed confirmation from Wave. Your order is not marked paid until that confirmation arrives." : "No payment confirmation was received. Return to MansaMart and try again when you are ready."}</p><a className="primary" href="/">Return to MansaMart</a><small>You can safely close this page if you opened Wave from the mobile app.</small></section></main>;
}

function Dashboard({ user, data }: { user: SessionUser; data: unknown }) {
  const summary = Array.isArray(data) ? `${data.length} recent records` : data ? "Your live information is connected" : "Connect the API to load live information";
  const actions = user.role === "user" ? ["Browse products", "My orders", "Book a service", "Track delivery"] : user.role === "vendor" ? ["Add product", "Manage stock", "View orders", "Request payout"] : user.role === "service_provider" ? ["Add service", "Manage bookings", "Availability", "Earnings"] : ["Go online", "Delivery offers", "Active delivery", "Earnings"];
  return <main className="dashboard"><aside><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><h3>{user.name}</h3><p>{roleLabel(user.role)}</p>{actions.map((action, index) => <button className={index === 0 ? "active" : ""} key={action}>{action}</button>)}</aside><section><p className="eyebrow">YOUR MANSAMART</p><h1>Good to see you, {user.name.split(" ")[0]}.</h1><p className="lead">{summary}</p><div className="metric-grid">{actions.map((action, index) => <article key={action}><span>0{index + 1}</span><h3>{action}</h3><p>Open and manage this part of your account.</p></article>)}</div></section></main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
