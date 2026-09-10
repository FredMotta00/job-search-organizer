import type { CSSProperties, ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="pageHeader"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{actions && <div className="headerActions">{actions}</div>}</header>;
}
export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) { return <section className={`card ${className}`} style={style}>{children}</section>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Empty({ title, children }: { title: string; children: ReactNode }) { return <div className="empty"><div className="emptyIcon">◇</div><h3>{title}</h3><p>{children}</p></div>; }
