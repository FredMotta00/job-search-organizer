import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/status";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [jobs, profile] = await Promise.all([
    prisma.job.findMany({ include: { assessment: true }, orderBy: { updatedAt: "desc" } }),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);
  const sent = jobs.filter((j) => ["ENVIADA", "EM_PROCESSO", "ENTREVISTA", "OFERTA", "REJEITADA"].includes(j.status)).length;
  const replies = jobs.filter((j) => ["EM_PROCESSO", "ENTREVISTA", "OFERTA", "REJEITADA"].includes(j.status)).length;
  const interviews = jobs.filter((j) => ["ENTREVISTA", "OFERTA"].includes(j.status)).length;
  const priority = jobs.filter((j) => (j.manualScore ?? j.assessment?.score ?? 0) >= 80).length;
  return <>
    <PageHeader eyebrow="Resumo de hoje" title="Sua busca, com menos ruído." description="Dados locais, decisões transparentes e nenhum envio sem sua confirmação." actions={<Link className="btn" href="/vagas#nova">Cadastrar vaga</Link>} />
    {!profile?.onboardingComplete && <div className="notice">Seu perfil ainda está em modo de rascunho. <Link href="/perfil"><u>Concluir onboarding</u></Link></div>}
    <div className="grid four">
      <Card className="metric"><small>Vagas acompanhadas</small><strong>{jobs.length}</strong><span className="trend">{priority} prioritária(s)</span></Card>
      <Card className="metric"><small>Candidaturas enviadas</small><strong>{sent}</strong><span className="muted">de {jobs.length} vagas</span></Card>
      <Card className="metric"><small>Respostas</small><strong>{replies}</strong><span className="muted">de {sent} enviadas</span></Card>
      <Card className="metric"><small>Entrevistas</small><strong>{interviews}</strong><span className="muted">de {replies} respostas</span></Card>
    </div>
    <div className="grid two" style={{marginTop:18}}>
      <Card><div className="split"><h2>Próximas ações</h2><Link href="/candidaturas" className="muted">Ver todas</Link></div>
        {jobs.length === 0 ? <Empty title="Comece por uma vaga">Cole um anúncio e receba uma avaliação baseada somente no que você confirmou.</Empty> : <div className="list">{jobs.slice(0,5).map(job => <Link className="listItem" href={`/vagas/${job.id}`} key={job.id}><div><strong>{job.title}</strong><p>{job.company}</p><small>{STATUS_LABELS[job.status]}</small></div><Badge tone={(job.manualScore ?? job.assessment?.score ?? 0) >= 80 ? "good" : "neutral"}>{job.manualScore ?? job.assessment?.score ?? "—"}</Badge></Link>)}</div>}
      </Card>
      <Card><h2>Fluxo seguro</h2><div className="stack"><div className="callout">1. Importe ou cadastre a vaga sem buscar conteúdo da URL.</div><div className="callout">2. Revise critérios, lacunas e dados desconhecidos.</div><div className="callout">3. Prepare materiais fundamentados no perfil confirmado.</div><div className="callout warn">4. Abra o portal e conclua o envio manualmente.</div></div></Card>
    </div>
  </>;
}
