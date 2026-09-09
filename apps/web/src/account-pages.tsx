import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { roleLabel } from "@mansamart/authentication";
import { api, assetUrl, dateTime, label, money } from "./api";
import { AppLink, Button, Empty, ErrorNotice, Icon, Notice, PageHeader, Spinner, Status, type Navigate } from "./components";
import { nextBookingStatus, nextVendorStatus } from "./web-rules";
import type { Address, Booking, CartRow, FinanceResponse, Notification, Order, PaymentConfig, Product, TrackingResponse, User } from "./types";

interface ProtectedPageProps {
  user: User;
  navigate: Navigate;
  notify: (message: string, tone?: "success" | "error") => void;
  refreshCart: () => void;
}

function useRemote<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError("");
    try { setData(await api.request<T>(path)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load this page"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

function PortalShell({ user, active, navigate, children }: { user: User; active: string; navigate: Navigate; children: ReactNode }) {
  const items = user.role === "user"
    ? [["Overview", "/account"], ["Orders", "/orders"], ["Bookings", "/bookings"], ["Cart", "/cart"], ["Notifications", "/notifications"], ["Support", "/support"]]
    : user.role === "vendor"
      ? [["Overview", "/vendor"], ["Orders", "/orders"], ["Products", "/vendor/products"], ["Finance", "/finance"], ["Returns", "/returns"], ["Support", "/support"]]
      : user.role === "service_provider"
        ? [["Overview", "/provider"], ["Bookings", "/bookings"], ["Services", "/provider/services"], ["Finance", "/finance"], ["Notifications", "/notifications"], ["Support", "/support"]]
        : [["Overview", "/rider"], ["Deliveries", "/rider/deliveries"], ["Notifications", "/notifications"], ["Support", "/support"]];
  return <main className="portal-layout"><aside className="portal-nav"><div className="portal-person"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><b>{user.name}</b><small>{roleLabel(user.role)}</small></div></div><nav>{items.map(([name, path]) => <AppLink key={path} to={path} navigate={navigate} className={active === path ? "active" : ""}>{name}</AppLink>)}</nav><div className="portal-security"><Icon name="shield"/><span>Protected by role-based access</span></div></aside><section className="portal-content">{children}</section></main>;
}

function StatCard({ label: title, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <article className="stat-card"><span>{title}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

export function CustomerAccount(props: ProtectedPageProps) {
  const { data: orders, loading: ordersLoading } = useRemote<Order[]>("/api/orders");
  const { data: bookings } = useRemote<Booking[]>("/api/bookings");
  const { data: notifications } = useRemote<Notification[]>("/api/notifications");
  const pending = (orders || []).filter((order) => !["completed", "cancelled", "refunded"].includes(order.status)).length;
  return <PortalShell user={props.user} active="/account" navigate={props.navigate}><PageHeader eyebrow="CUSTOMER ACCOUNT" title={`Welcome back, ${props.user.name.split(" ")[0]}`} body="Your orders, bookings and updates are connected in one place." actions={<Button onClick={() => props.navigate("/shop")}>Continue shopping</Button>}/>{ordersLoading ? <Spinner/> : <><div className="stats-grid"><StatCard label="Active orders" value={pending}/><StatCard label="All orders" value={(orders || []).length}/><StatCard label="Bookings" value={(bookings || []).length}/><StatCard label="Unread updates" value={(notifications || []).filter((item) => !item.isRead).length}/></div><section className="panel"><div className="panel-title"><div><h2>Recent orders</h2><p>Track payment, preparation and delivery.</p></div><AppLink to="/orders" navigate={props.navigate}>View all <Icon name="arrow"/></AppLink></div><OrderRows orders={(orders || []).slice(0, 4)} navigate={props.navigate}/></section></>}</PortalShell>;
}

export function OrdersPage(props: ProtectedPageProps) {
  const remote = useRemote<Order[]>("/api/orders");
  const advance = async (order: Order) => {
    const next = nextVendorStatus(order.vendorStatus || order.status);
    if (!next) return;
    try { await api.request(`/api/orders/${order.id}/status`, { method: "PUT", body: JSON.stringify({ status: next }) }); props.notify(`Order moved to ${label(next)}`, "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not update order", "error"); }
  };
  return <PortalShell user={props.user} active="/orders" navigate={props.navigate}><PageHeader eyebrow={props.user.role === "vendor" ? "SELLER ORDERS" : "ORDER HISTORY"} title={props.user.role === "vendor" ? "Manage orders" : "Your orders"} body={props.user.role === "vendor" ? "Only your products and seller subtotal are shown for multi-vendor orders." : "Every purchase and delivery update in one place."}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No orders yet" body={props.user.role === "user" ? "Products you buy will appear here." : "New paid orders containing your products will appear here."} action={props.user.role === "user" ? <Button onClick={() => props.navigate("/shop")}>Browse products</Button> : undefined}/> : <div className="stack-list">{remote.data!.map((order) => <article className="order-card" key={order.id}><div className="order-card-head"><div><small>ORDER #{order.id.slice(0, 8).toUpperCase()}</small><h3>{dateTime(order.createdAt)}</h3></div><div className="status-pair"><Status value={order.vendorStatus || order.status}/><Status value={order.paymentStatus}/></div></div><div className="order-items">{order.items?.slice(0, 3).map((item) => <div key={`${item.productId}-${item.selectedColor || ""}-${item.selectedSize || ""}`}><span className="mini-media">{item.image ? <img src={assetUrl(item.image)} alt=""/> : "MM"}</span><p><b>{item.name}</b><small>{item.quantity} × {money(item.price)}</small></p></div>)}</div><div className="order-card-foot"><strong>{money(order.total)}</strong><div>{props.user.role === "vendor" && nextVendorStatus(order.vendorStatus || order.status) && <Button className="secondary small" onClick={() => advance(order)}>Mark {label(nextVendorStatus(order.vendorStatus || order.status))}</Button>}<Button className="small" onClick={() => props.navigate(`/orders/${order.id}`)}>View details</Button></div></div></article>)}</div>}</PortalShell>;
}

function OrderRows({ orders, navigate }: { orders: Order[]; navigate: Navigate }) {
  if (!orders.length) return <Empty title="No orders yet" body="Start shopping to create your first order."/>;
  return <div className="table-list">{orders.map((order) => <button key={order.id} onClick={() => navigate(`/orders/${order.id}`)}><span><b>#{order.id.slice(0, 8).toUpperCase()}</b><small>{dateTime(order.createdAt)}</small></span><span>{order.items?.length || 0} item(s)</span><strong>{money(order.total)}</strong><Status value={order.status}/><Icon name="arrow"/></button>)}</div>;
}

export function OrderDetailPage({ orderId, ...props }: ProtectedPageProps & { orderId: string }) {
  const remote = useRemote<TrackingResponse>(`/api/orders/${orderId}/tracking`);
  if (remote.loading) return <PortalShell user={props.user} active="/orders" navigate={props.navigate}><Spinner label="Loading order"/></PortalShell>;
  if (!remote.data) return <PortalShell user={props.user} active="/orders" navigate={props.navigate}><ErrorNotice message={remote.error || "Order not found"}/></PortalShell>;
  const { order, events, qrs, riderLocation } = remote.data;
  const visibleQr = qrs.find((qr) => qr.status === "active" && (props.user.role === "user" ? qr.purpose === "delivery" : qr.purpose === "pickup"));
  return <PortalShell user={props.user} active="/orders" navigate={props.navigate}><PageHeader eyebrow={`ORDER #${order.id.slice(0, 8).toUpperCase()}`} title="Order details" body={`Placed ${dateTime(order.createdAt)}`} actions={<><Status value={order.status}/><Status value={order.paymentStatus}/></>}/><div className="detail-columns"><section className="panel"><h2>Items</h2><div className="cart-lines compact">{order.items.map((item) => <div className="cart-line" key={`${item.productId}-${item.selectedColor || ""}`}><span className="cart-image">{item.image ? <img src={assetUrl(item.image)} alt=""/> : "MM"}</span><div><b>{item.name}</b><small>{item.vendorName || "MansaMart seller"}{item.selectedColor ? ` · ${item.selectedColor}` : ""}{item.selectedSize ? ` · ${item.selectedSize}` : ""}</small></div><span>{item.quantity} × {money(item.price)}</span></div>)}</div><div className="totals"><p><span>Subtotal</span><b>{money(order.subtotal)}</b></p><p><span>Delivery</span><b>{money(order.shipping)}</b></p><p className="grand"><span>Total</span><b>{money(order.total)}</b></p></div></section><aside className="stack"><section className="panel"><h2>Delivery</h2><p className="muted"><Icon name="location"/> {order.address}, {order.city}</p>{riderLocation && <p className="muted">Latest rider location: {riderLocation.latitude.toFixed(4)}, {riderLocation.longitude.toFixed(4)}</p>}{visibleQr && <div className="qr-code"><small>{label(visibleQr.purpose)} verification code</small><strong>{visibleQr.code}</strong><p>Share this only at the correct handover.</p></div>}</section><section className="panel"><h2>Timeline</h2><div className="timeline">{events.map((event) => <div key={event.id}><i/><span><b>{event.title}</b><p>{event.message}</p><small>{dateTime(event.createdAt)}</small></span></div>)}</div></section></aside></div></PortalShell>;
}

export function BookingsPage(props: ProtectedPageProps) {
  const remote = useRemote<Booking[]>("/api/bookings");
  const update = async (booking: Booking, status: string) => {
    try { await api.request(`/api/bookings/${booking.id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); props.notify(`Booking ${label(status)}`, "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not update booking", "error"); }
  };
  return <PortalShell user={props.user} active="/bookings" navigate={props.navigate}><PageHeader eyebrow="SERVICE BOOKINGS" title={props.user.role === "service_provider" ? "Manage bookings" : "Your bookings"} body={props.user.role === "service_provider" ? "Confirm requests and move each appointment through its real status." : "Review upcoming and completed service appointments."} actions={props.user.role === "user" ? <Button onClick={() => props.navigate("/services")}>Book a service</Button> : undefined}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No bookings" body="Service appointments will appear here."/> : <div className="stack-list">{remote.data!.map((booking) => { const next = props.user.role === "service_provider" ? nextBookingStatus(booking.status) : null; return <article className="booking-card" key={booking.id}><div className="booking-date"><b>{new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit" })}</b><span>{new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-GB", { month: "short" })}</span></div><div><h3>{booking.serviceName}</h3><p>{props.user.role === "service_provider" ? booking.userName || "Customer" : booking.providerName || "MansaMart provider"}</p><small>{booking.time} · {booking.address || "Address on booking"}</small></div><strong>{money(booking.price)}</strong><Status value={booking.status}/><div className="row-actions">{next && <Button className="small" onClick={() => update(booking, next)}>Mark {label(next)}</Button>}{props.user.role === "user" && ["pending", "confirmed"].includes(booking.status) && <Button className="danger secondary small" onClick={() => update(booking, "cancelled")}>Cancel</Button>}</div></article>; })}</div>}</PortalShell>;
}

export function VendorDashboard(props: ProtectedPageProps) {
  const remote = useRemote<any>("/api/vendor/dashboard");
  const data = remote.data;
  return <PortalShell user={props.user} active="/vendor" navigate={props.navigate}><PageHeader eyebrow="VENDOR CENTRE" title={data?.profile?.storeName || props.user.businessName || "Your store"} body="Products, paid orders and settlement-ready earnings from your seller account." actions={<Button onClick={() => props.navigate("/vendor/products")}>Manage products</Button>}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : data && <><VerificationBanner status={data.profile?.verificationStatus}/><div className="stats-grid"><StatCard label="Products" value={data.stats?.products || 0}/><StatCard label="Paid revenue" value={money(data.stats?.revenue)}/><StatCard label="Pending orders" value={data.stats?.pendingOrders || 0}/><StatCard label="Average rating" value={data.stats?.avgRating || "New"}/></div><section className="panel"><div className="panel-title"><div><h2>Recent seller orders</h2><p>Only your items and subtotal are visible.</p></div><AppLink to="/orders" navigate={props.navigate}>Manage orders <Icon name="arrow"/></AppLink></div><OrderRows orders={data.recentOrders || []} navigate={props.navigate}/></section>{data.lowStock?.length > 0 && <section className="panel"><h2>Low stock</h2><div className="simple-list">{data.lowStock.map((product: Product) => <div key={product.id}><b>{product.name}</b><span>{product.stock} remaining</span></div>)}</div></section>}</>}</PortalShell>;
}

export function VendorProductsPage(props: ProtectedPageProps) {
  const remote = useRemote<Product[]>("/api/products/vendor/mine");
  const updateStock = async (product: Product, stock: number) => {
    try { await api.request(`/api/vendor/products/${product.id}/stock`, { method: "PUT", body: JSON.stringify({ stock: Math.max(0, stock) }) }); props.notify("Stock updated", "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not update stock", "error"); }
  };
  return <PortalShell user={props.user} active="/vendor/products" navigate={props.navigate}><PageHeader eyebrow="CATALOGUE" title="Your products" body="Review live stock. Use the Business mobile app for complete product creation and image editing."/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No products" body="Complete verification and add products using the MansaMart Business app."/> : <div className="management-grid">{remote.data!.map((product) => <article key={product.id}><span className="management-media">{product.images?.[0] ? <img src={assetUrl(product.images[0])} alt=""/> : "MM"}</span><div><small>{product.category}</small><h3>{product.name}</h3><b>{money(product.price)}</b></div><div className="stock-control"><button onClick={() => updateStock(product, Number(product.stock || 0) - 1)} aria-label="Reduce stock"><Icon name="minus"/></button><span>{product.stock || 0}</span><button onClick={() => updateStock(product, Number(product.stock || 0) + 1)} aria-label="Increase stock"><Icon name="plus"/></button></div></article>)}</div>}</PortalShell>;
}

export function ProviderDashboard(props: ProtectedPageProps) {
  const remote = useRemote<any>("/api/provider/dashboard");
  const data = remote.data;
  return <PortalShell user={props.user} active="/provider" navigate={props.navigate}><PageHeader eyebrow="PROVIDER CENTRE" title={props.user.businessName || "Your service business"} body="Manage appointments, availability and completed-service earnings." actions={<Button onClick={() => props.navigate("/provider/services")}>Manage services</Button>}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : data && <><VerificationBanner status={data.profile?.verificationStatus}/><div className="stats-grid"><StatCard label="Services" value={data.stats?.services || 0}/><StatCard label="Bookings" value={data.stats?.bookings || 0}/><StatCard label="Pending" value={data.stats?.pendingBookings || 0}/><StatCard label="Completed revenue" value={money(data.stats?.revenue)}/></div><section className="panel"><div className="panel-title"><div><h2>Recent appointments</h2><p>New requests from customers.</p></div><AppLink to="/bookings" navigate={props.navigate}>Manage bookings <Icon name="arrow"/></AppLink></div>{(data.recentBookings || []).length ? <div className="simple-list">{data.recentBookings.map((booking: Booking) => <div key={booking.id}><span><b>{booking.serviceName}</b><small>{booking.date} at {booking.time}</small></span><Status value={booking.status}/></div>)}</div> : <Empty title="No bookings" body="Customer requests will appear here."/>}</section></>}</PortalShell>;
}

export function ProviderServicesPage(props: ProtectedPageProps) {
  const remote = useRemote<any[]>("/api/services/provider/mine");
  const toggle = async (service: any) => {
    try { await api.request(`/api/services/${service.id}`, { method: "PUT", body: JSON.stringify({ isAvailable: !service.isAvailable }) }); props.notify(service.isAvailable ? "Service paused" : "Service activated", "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not update service", "error"); }
  };
  return <PortalShell user={props.user} active="/provider/services" navigate={props.navigate}><PageHeader eyebrow="SERVICES" title="Your services" body="Publish, pause and review your professional services."/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No services" body="Use the Business app to create your first detailed service listing."/> : <div className="management-grid">{remote.data!.map((service) => <article key={service.id}><span className="management-media service"><Icon name="briefcase"/></span><div><small>{service.category}</small><h3>{service.name}</h3><b>{money(service.price)}</b></div><Button className={`small ${service.isAvailable ? "secondary" : ""}`} onClick={() => toggle(service)}>{service.isAvailable ? "Pause" : "Activate"}</Button></article>)}</div>}</PortalShell>;
}

export function FinancePage(props: ProtectedPageProps) {
  const remote = useRemote<FinanceResponse>("/api/business/finance");
  const [open, setOpen] = useState(false);
  const requestPayout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api.request("/api/payouts", { method: "POST", body: JSON.stringify({ amount: Number(form.get("amount")), method: form.get("method"), accountName: String(form.get("accountName")), accountNumber: String(form.get("accountNumber")) }) }); props.notify("Payout request submitted", "success"); setOpen(false); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Payout request failed", "error"); }
  };
  const data = remote.data;
  return <PortalShell user={props.user} active="/finance" navigate={props.navigate}><PageHeader eyebrow="FINANCE" title="Settlements and payouts" body="This balance is an internal settlement record, not a bank account or legal escrow." actions={<Button disabled={!data || data.summary.availableForPayout < 50} onClick={() => setOpen(true)}>Request payout</Button>}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : data && <><VerificationBanner status={data.payoutProfile.verificationStatus}/><div className="stats-grid"><StatCard label="Available" value={money(data.summary.availableForPayout)}/><StatCard label="Pending payout" value={money(data.summary.pendingPayout)}/><StatCard label="Settled" value={money(data.summary.totalSettled)}/><StatCard label="Paid out" value={money(data.summary.totalPaidOut)}/></div><section className="panel"><h2>Payout requests</h2>{data.payouts.length ? <div className="simple-list">{data.payouts.map((payout) => <div key={payout.id}><span><b>{money(payout.amount)}</b><small>{dateTime(payout.createdAt)} · {label(payout.method)}</small></span><Status value={payout.status}/></div>)}</div> : <Empty title="No payout requests" body="Eligible settlement requests will be recorded here."/>}</section>{open && <div className="modal-backdrop"><form className="modal-card" onSubmit={requestPayout}><button type="button" className="modal-close" onClick={() => setOpen(false)}><Icon name="close"/></button><h2>Request payout</h2><p>Available: {money(data.summary.availableForPayout)}</p><label>Amount (GMD)<input name="amount" type="number" min="50" max={data.summary.availableForPayout} required/></label><label>Method<select name="method"><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option></select></label><label>Account name<input name="accountName" defaultValue={data.payoutProfile.accountName} required/></label><label>Account or mobile number<input name="accountNumber" defaultValue={data.payoutProfile.accountNumber} required/></label><Button type="submit">Submit request</Button></form></div>}</>}</PortalShell>;
}

export function ReturnsPage(props: ProtectedPageProps) {
  const remote = useRemote<any[]>("/api/business/returns");
  return <PortalShell user={props.user} active="/returns" navigate={props.navigate}><PageHeader eyebrow="RETURNS" title="Customer return requests" body="Read-only return visibility for products sold by your business."/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No return requests" body="Eligible customer requests involving your products will appear here."/> : <div className="stack-list">{remote.data!.map((item) => <article className="order-card" key={item.id}><div className="order-card-head"><div><small>RETURN #{item.id.slice(0, 8).toUpperCase()}</small><h3>{item.productName || "Product return"}</h3></div><Status value={item.status}/></div><p>{item.reason}</p><small>{dateTime(item.createdAt)}</small></article>)}</div>}</PortalShell>;
}

export function RiderDashboard(props: ProtectedPageProps) {
  const remote = useRemote<any>("/api/rider/dashboard");
  const data = remote.data;
  const updateStatus = async () => {
    if (!data?.profile) return;
    const next = !data.profile.isOnline;
    try { await api.request("/api/rider/status", { method: "PUT", body: JSON.stringify({ isOnline: next, isAvailable: next }) }); props.notify(next ? "You are now online" : "You are offline", "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not change availability", "error"); }
  };
  const accept = async (id: string) => {
    try { await api.request(`/api/delivery-requests/${id}/accept`, { method: "POST" }); props.notify("Delivery accepted", "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Offer is no longer available", "error"); }
  };
  return <PortalShell user={props.user} active="/rider" navigate={props.navigate}><PageHeader eyebrow="RIDER CENTRE" title="Delivery dashboard" body="Manage availability, delivery offers and current work." actions={<Button className={data?.profile?.isOnline ? "secondary" : ""} onClick={updateStatus}>{data?.profile?.isOnline ? "Go offline" : "Go online"}</Button>}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : data && <><VerificationBanner status={data.profile?.verificationStatus}/><div className="stats-grid"><StatCard label="Status" value={data.profile?.isOnline ? "Online" : "Offline"}/><StatCard label="New offers" value={data.offers?.length || 0}/><StatCard label="Completed" value={data.metrics?.completed || 0}/><StatCard label="Earnings" value={money(data.totalEarnings)}/></div><section className="panel"><div className="panel-title"><div><h2>Delivery offers</h2><p>Offers can expire quickly.</p></div></div>{data.offers?.length ? <div className="simple-list">{data.offers.map((offer: any) => <div key={offer.id}><span><b>Delivery offer</b><small>{offer.distanceKm ? `${Number(offer.distanceKm).toFixed(1)} km away` : "Pickup details available after acceptance"}</small></span><Button className="small" onClick={() => accept(offer.id)}>Accept</Button></div>)}</div> : <Empty title="No offers right now" body={data.profile?.isOnline ? "Keep this page open while you are available." : "Go online to receive verified delivery offers."}/>}</section></>}</PortalShell>;
}

export function RiderDeliveriesPage(props: ProtectedPageProps) {
  const remote = useRemote<any>("/api/rider/dashboard");
  const update = async (delivery: any, status: string) => {
    try { await api.request(`/api/delivery/${delivery.id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); props.notify(`Delivery marked ${label(status)}`, "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not update delivery", "error"); }
  };
  return <PortalShell user={props.user} active="/rider/deliveries" navigate={props.navigate}><PageHeader eyebrow="DELIVERIES" title="Active and recent work" body="Use QR verification at pickup and drop-off whenever it is available."/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : <div className="stack-list">{(remote.data?.history || []).map((delivery: any) => <article className="order-card" key={delivery.id}><div className="order-card-head"><div><small>DELIVERY #{delivery.id.slice(0, 8).toUpperCase()}</small><h3>{delivery.pickupAddress || "Vendor pickup"} → {delivery.dropoffAddress || "Customer"}</h3></div><Status value={delivery.status}/></div><div className="order-card-foot"><strong>{money(delivery.deliveryFee)}</strong><div>{delivery.status === "assigned" && <Button className="small" onClick={() => update(delivery, "picked_up")}>Mark picked up</Button>}{delivery.status === "picked_up" && <Button className="small" onClick={() => update(delivery, "in_transit")}>Start delivery</Button>}</div></div></article>)}{!(remote.data?.history || []).length && <Empty title="No deliveries" body="Accepted delivery offers will appear here."/>}</div>}</PortalShell>;
}

export function CartPage(props: ProtectedPageProps) {
  const cart = useRemote<CartRow[]>("/api/cart");
  const addresses = useRemote<Address[]>("/api/addresses");
  const config = useRemote<PaymentConfig>("/api/payments/config");
  const [checkout, setCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const rows = cart.data || [];
  const subtotal = useMemo(() => rows.reduce((sum, row) => sum + Number(row.product.price) * row.cartItem.quantity, 0), [rows]);
  const updateQuantity = async (row: CartRow, quantity: number) => {
    if (quantity < 1) return;
    try { await api.request(`/api/cart/${row.cartItem.id}`, { method: "PUT", body: JSON.stringify({ quantity }) }); await cart.reload(); props.refreshCart(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not update quantity", "error"); }
  };
  const remove = async (row: CartRow) => { await api.request(`/api/cart/${row.cartItem.id}`, { method: "DELETE" }); await cart.reload(); props.refreshCart(); };
  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.data?.wave.ready) return props.notify("Wave checkout is not active yet", "error");
    const form = new FormData(event.currentTarget); const savedId = String(form.get("savedAddress") || ""); const saved = addresses.data?.find((item) => item.id === savedId);
    const address = saved?.address || String(form.get("address") || ""); const city = saved?.city || String(form.get("city") || ""); const phone = saved?.phone || String(form.get("phone") || props.user.phone || "");
    if (!address || !city || !phone) return props.notify("Enter a complete delivery address and phone number", "error");
    setSubmitting(true);
    try {
      const order = await api.request<Order>("/api/orders", { method: "POST", body: JSON.stringify({ items: rows.map((row) => ({ productId: row.product.id, quantity: row.cartItem.quantity, selectedColor: row.cartItem.selectedColor, selectedSize: row.cartItem.selectedSize, selectedVariant: row.cartItem.selectedVariant, selectedOptions: row.cartItem.selectedOptions || undefined })), address, city, phone, paymentMethod: "wave", fulfillmentType: form.get("fulfillmentType") || "delivery", notes: String(form.get("notes") || "") }) });
      const payment = await api.request<{ launchUrl: string }>("/api/payments/wave/checkout", { method: "POST", body: JSON.stringify({ orderId: order.id, payerMobile: phone }) });
      props.refreshCart(); window.location.assign(payment.launchUrl);
    } catch (cause) { props.notify(cause instanceof Error ? cause.message : "Checkout failed", "error"); }
    finally { setSubmitting(false); }
  };
  return <PortalShell user={props.user} active="/cart" navigate={props.navigate}><PageHeader eyebrow="SHOPPING CART" title="Review your basket" body="Prices and stock are checked again securely by the API before the order is created."/><ErrorNotice message={cart.error}/>{cart.loading ? <Spinner/> : !rows.length ? <Empty title="Your cart is empty" body="Add products from verified MansaMart sellers." action={<Button onClick={() => props.navigate("/shop")}>Browse products</Button>}/> : <div className="cart-layout"><section className="panel"><div className="cart-lines">{rows.map((row) => <div className="cart-line" key={row.cartItem.id}><span className="cart-image">{row.product.images?.[0] ? <img src={assetUrl(row.product.images[0])} alt=""/> : "MM"}</span><div><b>{row.product.name}</b><small>{row.product.brand}{row.cartItem.selectedColor ? ` · ${row.cartItem.selectedColor}` : ""}{row.cartItem.selectedSize ? ` · ${row.cartItem.selectedSize}` : ""}</small><strong>{money(row.product.price)}</strong></div><div className="quantity"><button onClick={() => updateQuantity(row, row.cartItem.quantity - 1)}><Icon name="minus"/></button><span>{row.cartItem.quantity}</span><button onClick={() => updateQuantity(row, row.cartItem.quantity + 1)}><Icon name="plus"/></button></div><button className="icon-button danger" onClick={() => remove(row)} aria-label={`Remove ${row.product.name}`}><Icon name="trash"/></button></div>)}</div></section><aside className="panel order-summary"><h2>Order summary</h2><p><span>Subtotal estimate</span><b>{money(subtotal)}</b></p><p><span>Delivery</span><b>Calculated by server</b></p><div className="summary-total"><span>Estimated total</span><strong>{money(subtotal)}</strong></div><small>The final amount comes only from current server prices and delivery rules.</small>{!config.loading && !config.data?.wave.ready && <Notice tone="warning">Wave checkout is safely disabled until the merchant wallet and GMD support are confirmed.</Notice>}<Button disabled={!config.data?.wave.ready} onClick={() => setCheckout(true)}>Continue to checkout</Button></aside></div>}{checkout && <div className="modal-backdrop"><form className="modal-card checkout-card" onSubmit={placeOrder}><button type="button" className="modal-close" onClick={() => setCheckout(false)}><Icon name="close"/></button><p className="eyebrow">SECURE CHECKOUT</p><h2>Delivery and payment</h2>{(addresses.data || []).length > 0 && <label>Saved address<select name="savedAddress" defaultValue={addresses.data?.find((item) => item.isDefault)?.id || ""}><option value="">Enter another address</option>{addresses.data!.map((address) => <option value={address.id} key={address.id}>{address.label} — {address.address}, {address.city}</option>)}</select></label>}<div className="form-grid"><label>Address<input name="address" placeholder="Street or landmark"/></label><label>City / area<input name="city" placeholder="Serrekunda"/></label></div><label>Phone<input name="phone" defaultValue={props.user.phone || ""} placeholder="+220 ..."/></label><label>Fulfilment<select name="fulfillmentType"><option value="delivery">Delivery</option><option value="pickup">Store pickup</option></select></label><label>Order note<textarea name="notes" rows={3} placeholder="Optional delivery directions"/></label><Notice>Payment opens on Wave. A success page alone never marks an order paid; MansaMart waits for Wave's signed confirmation.</Notice><Button type="submit" disabled={submitting}>{submitting ? "Opening Wave…" : "Pay securely with Wave"}</Button></form></div>}</PortalShell>;
}

export function NotificationsPage(props: ProtectedPageProps) {
  const remote = useRemote<Notification[]>("/api/notifications");
  const markAll = async () => { await api.request("/api/notifications/read-all", { method: "PUT" }); props.notify("Notifications marked as read", "success"); await remote.reload(); };
  return <PortalShell user={props.user} active="/notifications" navigate={props.navigate}><PageHeader eyebrow="UPDATES" title="Notifications" body="Orders, bookings, payments and account updates." actions={<Button className="secondary" onClick={markAll}>Mark all read</Button>}/><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No notifications" body="Important account updates will appear here."/> : <div className="notification-list">{remote.data!.map((item) => <article className={item.isRead ? "" : "unread"} key={item.id}><span className="notification-icon"><Icon name={item.type === "booking" ? "calendar" : item.type === "delivery" ? "bike" : "bell"}/></span><div><h3>{item.title}</h3><p>{item.body}</p><small>{dateTime(item.createdAt)}</small></div>{!item.isRead && <i/>}</article>)}</div>}</PortalShell>;
}

export function SupportPage(props: ProtectedPageProps) {
  const remote = useRemote<any[]>("/api/support/tickets");
  const [sending, setSending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSending(true);
    try { await api.request("/api/support/tickets", { method: "POST", body: JSON.stringify({ subject: String(form.get("subject")), category: String(form.get("category")), message: String(form.get("message")) }) }); (event.currentTarget as HTMLFormElement).reset(); props.notify("Support ticket created", "success"); await remote.reload(); }
    catch (cause) { props.notify(cause instanceof Error ? cause.message : "Could not create ticket", "error"); }
    finally { setSending(false); }
  };
  return <PortalShell user={props.user} active="/support" navigate={props.navigate}><PageHeader eyebrow="HELP CENTRE" title="Customer support" body="Create and track a support request without sharing sensitive payment credentials."/><div className="detail-columns"><form className="panel support-form" onSubmit={submit}><h2>How can we help?</h2><label>Subject<input name="subject" minLength={3} maxLength={200} required/></label><label>Category<select name="category"><option value="general">General</option><option value="order">Order</option><option value="booking">Booking</option><option value="payment">Payment</option><option value="account">Account</option></select></label><label>Message<textarea name="message" rows={7} minLength={10} maxLength={3000} required/></label><Button type="submit" disabled={sending}>{sending ? "Sending…" : "Submit ticket"}</Button></form><section className="panel"><h2>Your tickets</h2><ErrorNotice message={remote.error}/>{remote.loading ? <Spinner/> : !(remote.data || []).length ? <Empty title="No support tickets" body="Your requests and their status will appear here."/> : <div className="simple-list">{remote.data!.map((ticket) => <div key={ticket.id}><span><b>{ticket.subject}</b><small>{dateTime(ticket.createdAt)}</small></span><Status value={ticket.status}/></div>)}</div>}</section></div></PortalShell>;
}

function VerificationBanner({ status }: { status?: string | null }) {
  if (status === "verified") return <Notice tone="success"><b>Verified business.</b> Publishing and payout controls are available according to your role.</Notice>;
  return <Notice tone="warning"><b>Verification {label(status || "pending")}.</b> Complete your business documents in the Business app. Publishing and payouts remain restricted until approval.</Notice>;
}
