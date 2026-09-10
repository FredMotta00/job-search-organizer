import Link from "next/link";

const items = [
  ["/", "Visão geral"], ["/vagas", "Vagas"], ["/candidaturas", "Candidaturas"],
  ["/perfil", "Perfil"], ["/curriculos", "Currículos"], ["/respostas", "Respostas"],
  ["/integracoes", "Integrações"], ["/execucoes", "Execuções"],
];

export function Nav() {
  return <aside className="sidebar">
    <div className="brand"><span className="brandMark">C</span><div><strong>Carreira</strong><small>painel pessoal</small></div></div>
    <nav>{items.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="privacy"><span>●</span> Somente neste computador</div>
  </aside>;
}
