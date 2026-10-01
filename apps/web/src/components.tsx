import type { ButtonHTMLAttributes, ReactNode } from "react";
import { assetUrl, label, money } from "./api";
import type { Product, Service } from "./types";

export type Navigate = (path: string) => void;

export function AppLink({ to, navigate, children, className = "", ariaLabel }: { to: string; navigate: Navigate; children: ReactNode; className?: string; ariaLabel?: string }) {
  return <a href={to} className={className} aria-label={ariaLabel} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); navigate(to); } }}>{children}</a>;
}

export function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`.trim()} {...props}>{children}</button>;
}

export function Icon({ name }: { name: "search" | "cart" | "user" | "heart" | "bell" | "menu" | "arrow" | "store" | "briefcase" | "bike" | "shield" | "close" | "plus" | "minus" | "trash" | "location" | "calendar" }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    cart: <><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    store: <><path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4Z"/><path d="M9 20v-6h6v6"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18"/></>,
    bike: <><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m6 17 4-8h4l4 8M9 12h7M10 9 8 6h3"/></>,
    shield: <path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function PageHeader({ eyebrow, title, body, actions }: { eyebrow?: string; title: string; body?: string; actions?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{body && <p>{body}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function Status({ value }: { value?: string | null }) {
  const tone = ["paid", "completed", "delivered", "verified", "approved", "active", "succeeded"].includes(value || "") ? "good" : ["failed", "cancelled", "rejected", "refunded"].includes(value || "") ? "bad" : "wait";
  return <span className={`status ${tone}`}>{label(value)}</span>;
}

export function Spinner({ label: text = "Loading" }: { label?: string }) {
  return <div className="state"><span className="spinner"/><p>{text}…</p></div>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span>MM</span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function ProductCard({ product, navigate, onAdd }: { product: Product; navigate: Navigate; onAdd?: (product: Product) => void }) {
  return <article className="catalog-card">
    <button className="catalog-media" onClick={() => navigate(`/product/${product.id}`)} aria-label={`View ${product.name}`}>
      {product.images?.[0] ? <img src={assetUrl(product.images[0])} alt={product.name}/> : <span>MM</span>}
      {product.isSale && <b className="card-tag sale">Sale</b>}{product.isNew && <b className="card-tag new">New</b>}
    </button>
    <div className="catalog-body"><p>{product.brand || "MansaMart seller"}</p><button className="card-title" onClick={() => navigate(`/product/${product.id}`)}>{product.name}</button><div className="rating">★ {product.rating || "New"} <span>({product.reviewCount || 0})</span></div><div className="price-row"><strong>{money(product.price)}</strong>{product.originalPrice && product.originalPrice > product.price ? <del>{money(product.originalPrice)}</del> : null}</div>{onAdd && <Button className="small secondary" onClick={() => onAdd(product)}>Add to cart</Button>}</div>
  </article>;
}

export function ServiceCard({ service, navigate }: { service: Service; navigate: Navigate }) {
  const image = service.images?.[0] || service.image;
  return <article className="service-card" onClick={() => navigate(`/service/${service.id}`)}>
    <div className="service-media">{image ? <img src={assetUrl(image)} alt={service.name}/> : <Icon name="briefcase"/>}</div>
    <div><span className="service-category">{service.category || "Local service"}</span><h3>{service.name}</h3><p>{service.providerName || "Verified MansaMart professional"}</p><div className="service-meta"><b>From {money(service.price)}</b><span>★ {service.rating || "New"}</span></div></div>
  </article>;
}

export function ErrorNotice({ message }: { message?: string }) {
  return message ? <div className="notice error-notice" role="alert">{message}</div> : null;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
