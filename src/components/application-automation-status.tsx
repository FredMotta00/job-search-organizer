"use client";

import { useEffect, useState } from "react";

type FieldReport = { field: string; kind?: string; reason?: string; page: string };
type RunState = {
  id: string;
  status: string;
  filledFields: FieldReport[];
  pendingFields: FieldReport[];
  lastError?: string | null;
};

const statusLabels: Record<string, string> = {
  QUEUED: "Na fila",
  STARTING: "Abrindo navegador",
  ACTIVE: "Preenchimento assistido ativo",
  REVIEW_READY: "Pronta para revisão final",
  CLOSED: "Navegador fechado",
  FAILED: "Falha ao executar",
};

export function ApplicationAutomationStatus({ initial }: { initial: RunState }) {
  const [run, setRun] = useState(initial);
  useEffect(() => {
    if (["CLOSED", "FAILED"].includes(run.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/application-automation/${run.id}`, { cache: "no-store" });
      if (response.ok) setRun(await response.json());
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [run.id, run.status]);

  const tone = run.status === "FAILED" ? "automationStatus bad" : run.status === "REVIEW_READY" ? "automationStatus ready" : "automationStatus";
  return <div className={tone} aria-live="polite">
    <div className="split"><strong>{statusLabels[run.status] ?? run.status}</strong><small>{run.filledFields.length} preenchido(s) · {run.pendingFields.length} para revisar</small></div>
    {run.lastError && <p>{run.lastError}</p>}
    {run.filledFields.length > 0 && <details><summary>Campos preenchidos</summary><ul>{run.filledFields.map((item, index) => <li key={`${item.field}-${index}`}>{item.field}{item.kind ? ` — ${item.kind}` : ""}</li>)}</ul></details>}
    {run.pendingFields.length > 0 && <details><summary>Pendências para sua decisão</summary><ul>{run.pendingFields.map((item, index) => <li key={`${item.field}-${index}`}>{item.field} — {item.reason}</li>)}</ul></details>}
    {run.status === "REVIEW_READY" && <p><strong>Revise tudo no navegador aberto. O assistente não clicará em enviar.</strong></p>}
  </div>;
}
