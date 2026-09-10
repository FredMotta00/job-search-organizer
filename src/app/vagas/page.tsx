import Link from "next/link";
import { createJob } from "@/app/actions";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/status";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const query = await searchParams;
  const jobs = await prisma.job.findMany({ include: { assessment: true }, orderBy: { importedAt: "desc" } });
  const filtered = jobs.filter(j => (!query.status || j.status === query.status) && (!query.q || `${j.title} ${j.company}`.toLowerCase().includes(query.q.toLowerCase())));
  return <>
    <PageHeader eyebrow="Oportunidades" title="Vagas" description="Cadastre anúncios manualmente. A aplicação nunca acessa automaticamente a URL informada." />
    {query.erro && <div className="notice">{query.erro === "duplicada" ? "Esta vaga já foi importada (URL ou identificador da fonte)." : decodeURIComponent(query.erro)}</div>}
    <Card><form className="formGrid" method="get"><label>Buscar<input name="q" defaultValue={query.q} placeholder="Cargo ou empresa" /></label><label>Status<select name="status" defaultValue={query.status ?? ""}><option value="">Todos</option>{Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><div className="actions span2"><button>Filtrar</button><Link className="btn secondary" href="/vagas">Limpar</Link></div></form></Card>
    <Card style={{marginTop:18} as React.CSSProperties}><h2>Pipeline</h2>{filtered.length === 0 ? <Empty title="Nenhuma vaga encontrada">Cadastre uma oportunidade abaixo ou ajuste os filtros.</Empty> : <div className="list">{filtered.map(job => { const score=job.manualScore ?? job.assessment?.score; return <Link className="listItem" key={job.id} href={`/vagas/${job.id}`}><div><div className="chips"><Badge>{job.source}</Badge>{job.incomplete&&<Badge tone="warn">incompleta</Badge>}{job.possibleDuplicate&&<Badge tone="warn">possível duplicata</Badge>}</div><strong>{job.title}</strong><p>{job.company}{job.location?` · ${job.location}`:""}</p><small>{STATUS_LABELS[job.status]}</small></div><Badge tone={(score??0)>=80?"good":(score??0)>=65?"info":"neutral"}>{score ?? "—"}/100</Badge></Link>})}</div>}</Card>
    <Card className="" ><div id="nova"><h2>Nova vaga manual</h2><p className="muted">Cole somente dados publicados. Campos ausentes continuarão marcados como desconhecidos.</p></div>
      <form action={createJob} className="formGrid">
        <label>Fonte<input name="source" defaultValue="Manual" required /></label><label>ID externo<input name="externalId" /></label>
        <label className="span2">URL da candidatura<input name="url" type="url" placeholder="https://…" /></label>
        <label>Empresa<input name="company" required /></label><label>Cargo<input name="title" required /></label>
        <label>Localização<input name="location" /></label><label>Modelo<select name="workMode"><option value="">Não informado</option><option>Remoto</option><option>Híbrido</option><option>Presencial</option></select></label>
        <label>Senioridade<input name="seniority" placeholder="Júnior, Pleno, Sênior…" /></label><label>Contratação<input name="contractType" placeholder="CLT, PJ…" /></label>
        <label>Salário mínimo publicado<input name="salaryMin" type="number" min="0" /></label><label>Salário máximo publicado<input name="salaryMax" type="number" min="0" /></label>
        <label>Moeda<input name="currency" placeholder="BRL" /></label><label>Periodicidade<input name="salaryPeriod" placeholder="mensal, anual…" /></label>
        <label className="span2">Descrição do anúncio<textarea name="description" maxLength={100000} /></label>
        <label>Requisitos obrigatórios<textarea name="required" placeholder="Um por linha" /></label><label>Requisitos desejáveis<textarea name="desired" placeholder="Um por linha" /></label>
        <label>Responsabilidades<textarea name="responsibilities" placeholder="Uma por linha" /></label><label>Idiomas solicitados<textarea name="jobLanguages" placeholder="Um por linha" /></label>
        <label className="checkbox span2"><input type="checkbox" name="incomplete" /> Marcar como vaga incompleta</label>
        <div className="span2"><button type="submit">Salvar e avaliar</button></div>
      </form>
    </Card>
  </>;
}
