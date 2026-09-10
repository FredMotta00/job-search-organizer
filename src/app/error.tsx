"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="card"><h2>Não foi possível carregar esta tela</h2><p className="muted">Os dados foram preservados. Tente novamente.</p><button onClick={reset}>Tentar novamente</button></div>; }
