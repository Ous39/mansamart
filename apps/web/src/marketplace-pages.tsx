import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, assetUrl, label, money } from "./api";
import { AppLink, Button, Empty, ErrorNotice, Icon, Notice, PageHeader, ProductCard, ServiceCard, Spinner, Status, type Navigate } from "./components";
import type { Product, Service, User } from "./types";

interface MarketplaceProps {
  products: Product[];
  services: Service[];
  loading: boolean;
  user: User | null;
  navigate: Navigate;
  openAuth: (mode?: "login" | "register", returnTo?: string) => void;
  notify: (message: string, tone?: "success" | "error") => void;
  refreshCart: () => void;
}

const categories = [
  { id: "fashion", name: "Fashion", mark: "FA" },
  { id: "electronics", name: "Electronics", mark: "EL" },
  { id: "beauty", name: "Beauty", mark: "BE" },
  { id: "furniture", name: "Home & Furniture", mark: "HF" },
  { id: "food", name: "Food & Grocery", mark: "FG" },
  { id: "general", name: "Everything else", mark: "MM" },
];

export function HomePage(props: MarketplaceProps) {
  const add = (product: Product) => addToCart(product, props);
  return <>
    <main className="hero"><div className="hero-copy"><p className="eyebrow">THE GAMBIA'S CONNECTED MARKETPLACE</p><h1>Local products and trusted services, <em>all in one place.</em></h1><p className="lead">Shop from Gambian businesses, book skilled professionals and follow every order through reliable local delivery.</p><div className="hero-actions"><Button onClick={() => props.navigate("/shop")}>Start shopping <Icon name="arrow"/></Button><Button className="secondary" onClick={() => props.navigate("/services")}>Find a service</Button></div><div className="trust-row"><span><Icon name="shield"/><b>Verified sellers</b></span><span><Icon name="location"/><b>Local delivery</b></span><span><Icon name="briefcase"/><b>Trusted services</b></span></div></div><div className="hero-visual"><div className="hero-badge"><span>🇬🇲</span><p>Built in The Gambia</p></div><div className="hero-stat one"><b>{props.products.length}+</b><span>Products</span></div><div className="hero-stat two"><b>{props.services.length}+</b><span>Services</span></div><div className="hero-orbit"><span>M</span></div><strong>Shop.<br/>Book.<br/><em>Grow.</em></strong></div></main>
    <section className="category-strip"><div><p className="eyebrow">EXPLORE</p><h2>Shop by category</h2></div><div className="category-grid">{categories.map((category) => <button key={category.id} onClick={() => props.navigate(`/shop?category=${category.id}`)}><span>{category.mark}</span><b>{category.name}</b><Icon name="arrow"/></button>)}</div></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">POPULAR PRODUCTS</p><h2>Fresh from local sellers</h2></div><AppLink to="/shop" navigate={props.navigate}>View marketplace <Icon name="arrow"/></AppLink></div>{props.loading ? <Spinner/> : props.products.length ? <div className="product-grid">{props.products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} navigate={props.navigate} onAdd={add}/>)}</div> : <Empty title="Marketplace is getting ready" body="Verified products will appear when the API is connected."/>}</section>
    <section className="service-section"><div className="section-heading"><div><p className="eyebrow">LOCAL PROFESSIONALS</p><h2>Book help you can trust</h2></div><AppLink to="/services" navigate={props.navigate}>Explore services <Icon name="arrow"/></AppLink></div>{props.services.length ? <div className="service-grid">{props.services.slice(0, 6).map((service) => <ServiceCard key={service.id} service={service} navigate={props.navigate}/>)}</div> : <Empty title="Services are coming" body="Verified providers will appear here."/>}</section>
    <section className="how-section"><div><p className="eyebrow">HOW IT WORKS</p><h2>A safer journey from discovery to delivery.</h2></div><div className="steps"><article><span>01</span><h3>Discover</h3><p>Browse products and services from local Gambian businesses.</p></article><article><span>02</span><h3>Order securely</h3><p>Prices are checked by MansaMart's server before payment.</p></article><article><span>03</span><h3>Track progress</h3><p>See seller preparation, rider pickup and delivery updates.</p></article><article><span>04</span><h3>Confirm delivery</h3><p>Use the protected delivery code only at handover.</p></article></div></section>
    <section className="business-band" id="business"><div><p className="eyebrow">GROW WITH MANSAMART</p><h2>Give your business or skill a bigger market.</h2><p>Vendors and service providers can register, complete verification and manage operations on the website or dedicated Business app.</p><Button className="accent" onClick={() => props.openAuth("register")}>Create a business account</Button></div><div className="business-icons"><span><Icon name="store"/>Sell products</span><span><Icon name="briefcase"/>Offer services</span><span><Icon name="bike"/>Deliver orders</span></div></section>
  </>;
}

export function ShopPage(props: MarketplaceProps) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "all");
  const [sort, setSort] = useState("featured");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = props.products.filter((product) => (category === "all" || product.category === category) && (!needle || `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(needle)));
    return [...rows].sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : sort === "rating" ? Number(b.rating || 0) - Number(a.rating || 0) : 0);
  }, [props.products, category, query, sort]);
  const add = (product: Product) => addToCart(product, props);
  return <main className="public-page"><PageHeader eyebrow="MANSAMART SHOP" title="Products from local businesses" body="Search current, in-stock listings from verified marketplace sellers."/><div className="catalog-tools"><label className="search-field"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or sellers"/></label><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Product category"><option value="all">All categories</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="rating">Highest rated</option></select></div><div className="results-line"><b>{filtered.length}</b> product{filtered.length === 1 ? "" : "s"}<span>Only available stock is shown</span></div>{props.loading ? <Spinner/> : filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} navigate={props.navigate} onAdd={add}/>)}</div> : <Empty title="No products found" body="Try another search or category." action={<Button className="secondary" onClick={() => { setQuery(""); setCategory("all"); }}>Clear filters</Button>}/>}</main>;
}

export function ServicesPage(props: MarketplaceProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const serviceCategories = useMemo(() => [...new Set(props.services.map((service) => service.category).filter(Boolean))] as string[], [props.services]);
  const rows = useMemo(() => { const q = query.toLowerCase(); return props.services.filter((service) => (category === "all" || service.category === category) && (!q || `${service.name} ${service.providerName} ${service.category}`.toLowerCase().includes(q))); }, [props.services, query, category]);
  return <main className="public-page"><PageHeader eyebrow="TRUSTED SERVICES" title="Find a skilled professional" body="Book verified local providers with clear prices and appointment tracking."/><div className="catalog-tools"><label className="search-field"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What service do you need?"/></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All services</option>{serviceCategories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="results-line"><b>{rows.length}</b> service{rows.length === 1 ? "" : "s"}<span>Available providers only</span></div>{props.loading ? <Spinner/> : rows.length ? <div className="service-grid page-grid">{rows.map((service) => <ServiceCard key={service.id} service={service} navigate={props.navigate}/>)}</div> : <Empty title="No services found" body="Try a broader search."/>}</main>;
}

export function ProductDetailPage({ productId, ...props }: MarketplaceProps & { productId: string }) {
  const [product, setProduct] = useState<Product | null>(props.products.find((item) => item.id === productId) || null);
  const [loading, setLoading] = useState(!product);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  useEffect(() => { if (product) return; api.request<Product>(`/api/products/${productId}`).then(setProduct).catch((cause) => setError(cause instanceof Error ? cause.message : "Product not found")).finally(() => setLoading(false)); }, [product, productId]);
  if (loading) return <main className="public-page"><Spinner label="Loading product"/></main>;
  if (!product) return <main className="public-page"><ErrorNotice message={error || "Product not found"}/></main>;
  const add = async () => {
    if (!props.user) return props.openAuth("login", `/product/${product.id}`);
    if (props.user.role !== "user") return props.notify("Shopping is available to customer accounts", "error");
    try { await api.request("/api/cart", { method: "POST", body: JSON.stringify({ productId: product.id, quantity, ...(color ? { selectedColor: color } : {}), ...(size ? { selectedSize: size } : {}) }) }); props.refreshCart(); props.notify("Added to cart", "success"); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not add to cart", "error"); }
  };
  const soldOut = product.inStock === false || (product.stock !== undefined && Number(product.stock) < 1);
  return <main className="public-page"><button className="back-link" onClick={() => props.navigate("/shop")}>← Back to marketplace</button><div className="product-detail"><section className="detail-gallery"><div>{product.images?.[0] ? <img src={assetUrl(product.images[0])} alt={product.name}/> : <span>MM</span>}</div>{(product.images || []).slice(1, 5).map((image) => <img key={image} src={assetUrl(image)} alt=""/>)}</section><section className="detail-info"><p className="eyebrow">{product.category || "MARKETPLACE"}</p><h1>{product.name}</h1><p className="seller-line">Sold by <b>{product.brand}</b> {product.location && <>· <Icon name="location"/> {product.location}</>}</p><div className="rating large">★ {product.rating || "New"} <span>({product.reviewCount || 0} reviews)</span></div><div className="detail-price"><strong>{money(product.price)}</strong>{product.originalPrice && product.originalPrice > product.price ? <del>{money(product.originalPrice)}</del> : null}</div><p className="detail-description">{product.description || "A current MansaMart listing from a local marketplace seller."}</p>{product.colors?.length ? <label>Colour<select value={color} onChange={(event) => setColor(event.target.value)}><option value="">Choose colour</option>{product.colors.map((item) => <option key={item}>{item}</option>)}</select></label> : null}{product.size && <label>Size<input value={size} onChange={(event) => setSize(event.target.value)} placeholder={product.size}/></label>}<div className="buy-row"><div className="quantity large"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Icon name="minus"/></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(Number(product.stock || 99), quantity + 1))}><Icon name="plus"/></button></div><Button onClick={add} disabled={soldOut}><Icon name="cart"/>{soldOut ? "Out of stock" : "Add to cart"}</Button></div><div className="detail-assurances"><span><Icon name="shield"/><b>Server-checked price</b><small>The app never decides the final total.</small></span><span><Icon name="location"/><b>Local fulfilment</b><small>Delivery or pickup is confirmed at checkout.</small></span></div></section></div></main>;
}

export function ServiceDetailPage({ serviceId, ...props }: MarketplaceProps & { serviceId: string }) {
  const [service, setService] = useState<Service | null>(props.services.find((item) => item.id === serviceId) || null);
  const [loading, setLoading] = useState(!service);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (service) return; api.request<Service>(`/api/services/${serviceId}`).then(setService).catch((cause) => setError(cause instanceof Error ? cause.message : "Service not found")).finally(() => setLoading(false)); }, [service, serviceId]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!service) return;
    const form = new FormData(event.currentTarget); setSending(true);
    try { await api.request("/api/bookings", { method: "POST", body: JSON.stringify({ serviceId: service.id, date: String(form.get("date")), time: String(form.get("time")), address: String(form.get("address")), notes: String(form.get("notes") || "") }) }); props.notify("Booking request submitted", "success"); props.navigate("/bookings"); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Booking failed", "error"); }
    finally { setSending(false); }
  };
  if (loading) return <main className="public-page"><Spinner label="Loading service"/></main>;
  if (!service) return <main className="public-page"><ErrorNotice message={error || "Service not found"}/></main>;
  const image = service.images?.[0] || service.image;
  return <main className="public-page"><button className="back-link" onClick={() => props.navigate("/services")}>← Back to services</button><div className="service-detail"><div className="service-detail-media">{image ? <img src={assetUrl(image)} alt={service.name}/> : <Icon name="briefcase"/>}</div><section><p className="eyebrow">{service.category || "LOCAL SERVICE"}</p><h1>{service.name}</h1><p className="seller-line">Provided by <b>{service.providerName || "MansaMart professional"}</b>{service.location && <> · <Icon name="location"/> {service.location}</>}</p><div className="rating large">★ {service.rating || "New"} <span>({service.reviewCount || 0} reviews)</span></div><p className="detail-description">{service.description || "Book this local professional service through MansaMart."}</p><div className="service-price"><span>Starting price</span><strong>{money(service.price)}</strong>{service.duration && <small>{service.duration}</small>}</div><Notice><b>Protected booking.</b> The provider, service price and ownership are verified again by the API.</Notice><Button onClick={() => { if (!props.user) props.openAuth("login", `/service/${service.id}`); else if (props.user.role !== "user") props.notify("Bookings are available to customer accounts", "error"); else setBooking(true); }}><Icon name="calendar"/>Request booking</Button></section></div>{booking && <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><button type="button" className="modal-close" onClick={() => setBooking(false)}><Icon name="close"/></button><p className="eyebrow">BOOK SERVICE</p><h2>{service.name}</h2><div className="form-grid"><label>Date<input type="date" name="date" min={new Date().toISOString().slice(0, 10)} required/></label><label>Time<input type="time" name="time" required/></label></div><label>Service address<input name="address" minLength={5} placeholder="Street, area or nearby landmark" required/></label><label>Notes<textarea name="notes" rows={4} maxLength={1000}/></label><Button type="submit" disabled={sending}>{sending ? "Submitting…" : "Request booking"}</Button></form></div>}</main>;
}

export function PaymentReturn({ kind, navigate }: { kind: "success" | "error"; navigate: Navigate }) {
  const success = kind === "success";
  return <main className="payment-return"><section><span className={`payment-icon ${success ? "success" : "error"}`}>{success ? "✓" : "!"}</span><p className="eyebrow">WAVE CHECKOUT</p><h1>{success ? "Payment submitted" : "Payment not completed"}</h1><p>{success ? "MansaMart is waiting for Wave's signed server confirmation. Visiting this page does not mark your order as paid." : "No successful payment was confirmed. Your account remains safe and you can review the order before trying again."}</p><Button onClick={() => navigate("/orders")}>{success ? "Check order status" : "Return to orders"}</Button><small>You can safely close this page if Wave opened in a separate tab.</small></section></main>;
}

export function PolicyPage({ kind, navigate }: { kind: "privacy" | "terms"; navigate: Navigate }) {
  return <main className="public-page policy"><PageHeader eyebrow="MANSAMART" title={kind === "privacy" ? "Privacy notice" : "Terms of use"} body="Plain-language website information for the MansaMart marketplace."/><Notice tone="warning">This is an implementation draft and should receive Gambian legal review before production launch.</Notice>{kind === "privacy" ? <><h2>Information we use</h2><p>Account, contact, address, order, booking, verification and support information is used to operate the marketplace and protect transactions.</p><h2>Payments</h2><p>Payment credentials remain with the approved payment provider. MansaMart stores payment status, references and audit information needed to reconcile an order.</p><h2>Your choices</h2><p>Contact MansaMart support to correct account information or request permitted account-data actions.</p></> : <><h2>Marketplace accounts</h2><p>Use accurate information, protect your password and use only the account role assigned to you.</p><h2>Orders and services</h2><p>Availability, final prices and delivery charges are confirmed by the server. Vendors and providers remain responsible for accurate listings and fulfilment.</p><h2>Payments and disputes</h2><p>An order is paid only after verified provider confirmation. Refunds, returns and disputes follow the platform's approved process.</p></>}<Button className="secondary" onClick={() => navigate("/")}>Return home</Button></main>;
}

async function addToCart(product: Product, props: MarketplaceProps) {
  if (!props.user) return props.openAuth("login", `/product/${product.id}`);
  if (props.user.role !== "user") return props.notify("Shopping is available to customer accounts", "error");
  try { await api.request("/api/cart", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }) }); props.refreshCart(); props.notify(`${product.name} added to cart`, "success"); }
  catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not add to cart", "error"); }
}
