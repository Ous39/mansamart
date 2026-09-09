import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { roleLabel } from "@mansamart/authentication";
import type { AuthResponse } from "@mansamart/shared-types";
import { api, tokenStore } from "./api";
import { AppLink, Button, Icon, Spinner, type Navigate } from "./components";
import { BookingsPage, CartPage, CustomerAccount, FinancePage, NotificationsPage, OrderDetailPage, OrdersPage, ProviderDashboard, ProviderServicesPage, ReturnsPage, RiderDashboard, RiderDeliveriesPage, SupportPage, VendorDashboard, VendorProductsPage } from "./account-pages";
import { HomePage, PaymentReturn, PolicyPage, ProductDetailPage, ServiceDetailPage, ServicesPage, ShopPage } from "./marketplace-pages";
import type { CartRow, Product, Service, User } from "./types";
import { defaultWebPath, roleCanUseGeneralWeb, safeInternalPath } from "./web-rules";

type AuthMode = "login" | "register";
type ProtectedProps = { user: User; navigate: Navigate; notify: (message: string, tone?: "success" | "error") => void; refreshCart: () => void };

function useNavigation(): { path: string; navigate: Navigate } {
  const [path, setPath] = useState(() => `${window.location.pathname}${window.location.search}${window.location.hash}`);
  useEffect(() => {
    const update = () => setPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((next: string) => {
    const safe = safeInternalPath(next);
    window.history.pushState({}, "", safe);
    setPath(safe);
    const hash = safe.includes("#") ? safe.slice(safe.indexOf("#") + 1) : "";
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 0);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  return { path, navigate };
}

export default function App() {
  const { path, navigate } = useNavigation();
  const routePath = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(!!tokenStore.get());
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast((current) => current?.message === message ? null : current), 4000);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!tokenStore.get()) return setCartCount(0);
    try { const rows = await api.request<CartRow[]>("/api/cart"); setCartCount(rows.reduce((sum, row) => sum + row.cartItem.quantity, 0)); }
    catch { setCartCount(0); }
  }, []);

  useEffect(() => {
    Promise.all([api.request<Product[]>("/api/products?limit=200"), api.request<Service[]>("/api/services?limit=200")])
      .then(([productRows, serviceRows]) => { setProducts(productRows); setServices(serviceRows); })
      .catch(() => { setProducts([]); setServices([]); })
      .finally(() => setMarketLoading(false));

    if (!tokenStore.get()) { setSessionLoading(false); return; }
    api.me().then(({ user: current }) => {
      if (!roleCanUseGeneralWeb(current.role)) throw new Error("Administrator sessions are not allowed on this website");
      setUser(current);
    }).catch(() => tokenStore.clear()).finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => { if (user?.role === "user") void refreshCart(); else setCartCount(0); }, [user, refreshCart]);

  const openAuth = useCallback((mode: AuthMode = "login", desiredPath?: string) => {
    setReturnTo(safeInternalPath(desiredPath || `${window.location.pathname}${window.location.search}`));
    setAuthMode(mode);
    setMobileOpen(false);
  }, []);

  const finishAuth = (result: AuthResponse) => {
    if (!roleCanUseGeneralWeb(result.user.role)) {
      tokenStore.clear();
      throw new Error("Administrator accounts must sign in at admin.mansamart.gm");
    }
    tokenStore.set(result.token);
    setUser(result.user);
    setAuthMode(null);
    const destination = returnTo && !["/", "/login"].includes(returnTo) ? safeInternalPath(returnTo, defaultWebPath(result.user.role)) : defaultWebPath(result.user.role);
    setReturnTo(null);
    navigate(destination);
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    tokenStore.clear(); setUser(null); setCartCount(0); navigate("/"); notify("Signed out securely");
  };

  const marketplaceProps = { products, services, loading: marketLoading, user, navigate, openAuth, notify, refreshCart };
  const protectedProps = user ? { user, navigate, notify, refreshCart } : null;
  const paymentMatch = routePath.match(/^\/payment\/wave\/(success|error)$/);

  if (paymentMatch) return <PaymentReturn kind={paymentMatch[1] as "success" | "error"} navigate={navigate}/>;
  if (sessionLoading) return <div className="app-loading"><span className="brand-mark">M</span><Spinner label="Securing your MansaMart session"/></div>;

  let page: ReactNode = null;
  if (routePath === "/") page = <HomePage {...marketplaceProps}/>;
  else if (routePath === "/shop") page = <ShopPage {...marketplaceProps}/>;
  else if (routePath === "/services") page = <ServicesPage {...marketplaceProps}/>;
  else if (routePath.startsWith("/product/")) page = <ProductDetailPage {...marketplaceProps} productId={routePath.split("/")[2]}/>;
  else if (routePath.startsWith("/service/")) page = <ServiceDetailPage {...marketplaceProps} serviceId={routePath.split("/")[2]}/>;
  else if (routePath === "/privacy") page = <PolicyPage kind="privacy" navigate={navigate}/>;
  else if (routePath === "/terms") page = <PolicyPage kind="terms" navigate={navigate}/>;
  else if (isProtectedRoute(routePath) && !user) page = <SignInRequired openAuth={openAuth} navigate={navigate}/>;
  else if (protectedProps) {
    page = renderProtectedRoute(routePath, protectedProps);
  }
  if (!page) page = <NotFound navigate={navigate}/>;

  return <div className="site-shell">
    <Header user={user} cartCount={cartCount} navigate={navigate} openAuth={openAuth} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}/>
    {page}
    <Footer navigate={navigate}/>
    {authMode && (
      <AuthModal mode={authMode} setMode={setAuthMode} close={() => setAuthMode(null)} finish={finishAuth}/>
    )}
    {toast && <div className={`toast ${toast.tone}`} role="status"><span>{toast.tone === "success" ? "✓" : "!"}</span>{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss"><Icon name="close"/></button></div>}
  </div>;
}

function renderProtectedRoute(routePath: string, props: ProtectedProps) {
  const { user, navigate } = props;
  if (routePath === "/account" && user.role === "user") return <CustomerAccount {...props}/>;
  if (routePath === "/vendor" && user.role === "vendor") return <VendorDashboard {...props}/>;
  if (routePath === "/provider" && user.role === "service_provider") return <ProviderDashboard {...props}/>;
  if (routePath === "/rider" && user.role === "delivery_rider") return <RiderDashboard {...props}/>;
  if (routePath === "/orders" && ["user", "vendor"].includes(user.role)) return <OrdersPage {...props}/>;
  if (routePath.startsWith("/orders/") && ["user", "vendor", "delivery_rider"].includes(user.role)) return <OrderDetailPage {...props} orderId={routePath.split("/")[2]}/>;
  if (routePath === "/bookings" && ["user", "service_provider"].includes(user.role)) return <BookingsPage {...props}/>;
  if (routePath === "/cart" && user.role === "user") return <CartPage {...props}/>;
  if (routePath === "/vendor/products" && user.role === "vendor") return <VendorProductsPage {...props}/>;
  if (routePath === "/provider/services" && user.role === "service_provider") return <ProviderServicesPage {...props}/>;
  if (routePath === "/finance" && ["vendor", "service_provider"].includes(user.role)) return <FinancePage {...props}/>;
  if (routePath === "/returns" && user.role === "vendor") return <ReturnsPage {...props}/>;
  if (routePath === "/rider/deliveries" && user.role === "delivery_rider") return <RiderDeliveriesPage {...props}/>;
  if (routePath === "/notifications") return <NotificationsPage {...props}/>;
  if (routePath === "/support") return <SupportPage {...props}/>;
  const dashboard = roleCanUseGeneralWeb(user.role) ? defaultWebPath(user.role) : "/";
  return <main className="gate-page"><Icon name="shield"/><h1>This page is not for your account role.</h1><p>Your {roleLabel(user.role).toLowerCase()} account remains protected from other role areas.</p><Button onClick={() => navigate(dashboard)}>Open my dashboard</Button></main>;
}

function isProtectedRoute(path: string) {
  return ["/account", "/vendor", "/provider", "/rider", "/orders", "/bookings", "/cart", "/finance", "/returns", "/notifications", "/support"].some((root) => path === root || path.startsWith(`${root}/`));
}

function Header({ user, cartCount, navigate, openAuth, logout, mobileOpen, setMobileOpen }: { user: User | null; cartCount: number; navigate: Navigate; openAuth: (mode?: AuthMode, returnTo?: string) => void; logout: () => void; mobileOpen: boolean; setMobileOpen: (open: boolean) => void }) {
  const dashboard = user && roleCanUseGeneralWeb(user.role) ? defaultWebPath(user.role) : "/";
  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("q"); navigate(`/shop?q=${encodeURIComponent(String(value || ""))}`); setMobileOpen(false); };
  return <header className="topbar"><div className="topbar-inner"><AppLink to="/" navigate={navigate} className="logo"><span className="brand-mark">M</span><b>MansaMart</b><small>THE GAMBIA</small></AppLink><nav className={mobileOpen ? "open" : ""}><AppLink to="/shop" navigate={navigate}>Shop</AppLink><AppLink to="/services" navigate={navigate}>Services</AppLink><AppLink to="/#business" navigate={navigate}>Sell with us</AppLink>{user && <AppLink to={dashboard} navigate={navigate}>Dashboard</AppLink>}</nav><form className="header-search" onSubmit={search}><Icon name="search"/><input name="q" placeholder="Search MansaMart" aria-label="Search products"/></form><div className="header-actions">{user?.role === "user" && <button className="nav-icon" onClick={() => navigate("/cart")} aria-label={`Cart with ${cartCount} items`}><Icon name="cart"/>{cartCount > 0 && <span>{cartCount > 99 ? "99+" : cartCount}</span>}</button>}{user ? <div className="profile-menu"><button onClick={() => navigate(dashboard)}><span>{user.name.slice(0, 1).toUpperCase()}</span><div><b>{user.name.split(" ")[0]}</b><small>{roleLabel(user.role)}</small></div></button><button className="logout-link" onClick={logout}>Sign out</button></div> : <><button className="text-link" onClick={() => openAuth("login")}>Sign in</button><Button className="small" onClick={() => openAuth("register")}>Create account</Button></>}<button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Icon name="menu"/></button></div></div></header>;
}

function Footer({ navigate }: { navigate: Navigate }) {
  return <footer><div className="footer-grid"><div><AppLink to="/" navigate={navigate} className="logo light"><span className="brand-mark">M</span><b>MansaMart</b></AppLink><p>A connected marketplace for Gambian customers, businesses, service providers and delivery riders.</p><small>Made in The Gambia by OceanBrown.</small></div><div><b>Marketplace</b><AppLink to="/shop" navigate={navigate}>Shop products</AppLink><AppLink to="/services" navigate={navigate}>Book services</AppLink></div><div><b>Accounts</b><AppLink to="/account" navigate={navigate}>Customer account</AppLink><AppLink to="/vendor" navigate={navigate}>Vendor centre</AppLink><AppLink to="/provider" navigate={navigate}>Provider centre</AppLink><AppLink to="/rider" navigate={navigate}>Rider centre</AppLink></div><div><b>Trust & support</b><AppLink to="/support" navigate={navigate}>Help centre</AppLink><AppLink to="/privacy" navigate={navigate}>Privacy</AppLink><AppLink to="/terms" navigate={navigate}>Terms</AppLink></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} MansaMart</span><span>Administrators use a separate secured portal.</span></div></footer>;
}

function AuthModal({ mode, setMode, close, finish }: { mode: AuthMode; setMode: (mode: AuthMode) => void; close: () => void; finish: (result: AuthResponse) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("user");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true); const form = new FormData(event.currentTarget);
    try {
      const result = mode === "login"
        ? await api.login(String(form.get("email")), String(form.get("password")))
        : await api.request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")), phone: String(form.get("phone") || ""), city: String(form.get("city") || ""), role, ...(role !== "user" ? { businessName: String(form.get("businessName") || ""), businessType: role === "delivery_rider" ? "Delivery Service" : String(form.get("businessType") || "") } : {}) }) });
      finish(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication failed"); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={close}><form className="modal-card auth-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={close}><Icon name="close"/></button><span className="brand-mark large">M</span><h2>{mode === "login" ? "Welcome back" : "Join MansaMart"}</h2><p>{mode === "login" ? "Sign in as a customer, vendor, provider or rider." : "Choose the account that matches how you will use the marketplace."}</p><div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Register</button></div>{error && <div className="notice error-notice" role="alert">{error}</div>}{mode === "register" && <><div className="role-picker"><button type="button" className={role === "user" ? "active" : ""} onClick={() => setRole("user")}><Icon name="user"/>Customer</button><button type="button" className={role === "vendor" ? "active" : ""} onClick={() => setRole("vendor")}><Icon name="store"/>Vendor</button><button type="button" className={role === "service_provider" ? "active" : ""} onClick={() => setRole("service_provider")}><Icon name="briefcase"/>Provider</button><button type="button" className={role === "delivery_rider" ? "active" : ""} onClick={() => setRole("delivery_rider")}><Icon name="bike"/>Rider</button></div><label>Full name<input name="name" autoComplete="name" minLength={2} required/></label>{role !== "user" && role !== "delivery_rider" && <label>Business name<input name="businessName" minLength={2} required/></label>}{role !== "user" && role !== "delivery_rider" && <label>Business type<input name="businessType" placeholder={role === "vendor" ? "Fashion, electronics, grocery…" : "Cleaning, repairs, beauty…"} required/></label>}<div className="form-grid"><label>Phone<input name="phone" type="tel" autoComplete="tel"/></label><label>City / area<input name="city" autoComplete="address-level2"/></label></div></>}<label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} required/></label><Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create account"}</Button><small>Administrator accounts are rejected here. Admins must use admin.mansamart.gm.</small></form></div>;
}

function SignInRequired({ openAuth, navigate }: { openAuth: (mode?: AuthMode, returnTo?: string) => void; navigate: Navigate }) {
  return <main className="gate-page"><Icon name="shield"/><h1>Sign in to continue</h1><p>This page contains private account information protected by MansaMart's role permissions.</p><div><Button onClick={() => openAuth("login", `${window.location.pathname}${window.location.search}`)}>Sign in</Button><Button className="secondary" onClick={() => navigate("/")}>Return home</Button></div></main>;
}

function NotFound({ navigate }: { navigate: Navigate }) {
  return <main className="gate-page"><span className="brand-mark large">M</span><p className="eyebrow">404</p><h1>We could not find that page.</h1><p>Use the marketplace navigation to continue.</p><Button onClick={() => navigate("/")}>Return to MansaMart</Button></main>;
}
