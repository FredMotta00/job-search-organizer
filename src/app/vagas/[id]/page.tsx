import Link from "next/link";
import { notFound } from "next/navigation";
import { adjustScore, prepareApplication, reassessJob, transitionJob } from "@/app/actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { allowedTransitions, STATUS_LABELS } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function JobDetail({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<Record<string,string|undefined>> }) {
  const { id } = await params; const query = await searchParams;
  const [job,resumes] = await Promise.all([
    prisma.job.findUnique({ where:{id}, include:{assessment:true,histories:{orderBy:{createdAt:"desc"}},preparations:{orderBy:{createdAt:"desc"},include:{resume:true}}} }),
    prisma.resume.findMany({where:{confirmed:true},orderBy:{createdAt:"desc"}}),
  ]); if(!job) notFound();
  const assessment=job.assessment; const score=job.manualScore ?? assessment?.score ?? 0;
  const matched=parseJson<string[]>(assessment?.matchedJson,[]), gaps=parseJson<string[]>(assessment?.gapsJson,[]), unknown=parseJson<string[]>(assessment?.unknownJson,[]), blocks=parseJson<string[]>(assessment?.hardBlocksJson,[]);
  return <>
    <PageHeader eyebrow={job.company} title={job.title} description={`${job.source} · ${STATUS_LABELS[job.status]}`} actions={<>{job.url&&<a className="btn secondary" href={job.url} target="_blank" rel="noreferrer">Abrir candidatura ↗</a>}<Link className="btn secondary" href="/vagas">Voltar</Link></>} />
    {query.erro&&<div className="notice">{decodeURIComponent(query.erro)}</div>}
    <div className="grid two">
      <Card><div className="split"><div><h2>Compatibilidade</h2><Badge tone={blocks.length?"bad":score>=80?"good":score>=65?"info":"neutral"}>{assessment?.category??"não avaliada"}</Badge></div><div className="score" style={{"--score":score} as React.CSSProperties}><strong>{score}</strong></div></div>
        <p>{assessment?.explanation}</p><div className="progress"><span style={{width:`${assessment?.coverage??0}%`}} /></div><small className="muted">Cobertura dos dados: {assessment?.coverage??0}% · não é probabilidade de contratação</small>
        {blocks.length>0&&<div className="callout bad"><strong>Critérios eliminatórios</strong><ul>{blocks.map(x=><li key={x}>{x}</li>)}</ul></div>}
        <div className="grid two"><div><h3>Atendidos</h3>{matched.length?<ul>{matched.map(x=><li key={x}>{x}</li>)}</ul>:<p className="muted">Nenhum confirmado.</p>}</div><div><h3>Lacunas</h3>{gaps.length?<ul>{gaps.map(x=><li key={x}>{x}</li>)}</ul>:<p className="muted">Nenhuma identificada.</p>}</div></div><h3>Desconhecidos</h3><div className="chips">{unknown.map(x=><Badge key={x}>{x}</Badge>)}</div>
        <form action={reassessJob}><input type="hidden" name="jobId" value={id}/><button className="secondary">Recalcular com o perfil atual</button></form>
      </Card>
      <Card><h2>Status e histórico</h2><form action={transitionJob} className="stack"><input type="hidden" name="jobId" value={id}/><label>Próximo estado<select name="toStatus" required>{allowedTransitions(job.status).map(s=><option value={s} key={s}>{STATUS_LABELS[s]}</option>)}</select></label><label>Anotação<textarea name="note" /></label><label>Evidência do envio (opcional)<input name="evidence" placeholder="Confirmação ou identificador" /></label><label>Currículo usado<select name="resumeVersionId"><option value="">Não informado</option>{resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="checkbox"><input type="checkbox" name="confirmedSent"/> Confirmo que o envio foi concluído</label><button disabled={allowedTransitions(job.status).length===0}>Registrar transição</button></form>
        <div className="list">{job.histories.map(h=><div className="listItem" key={h.id}><div><strong>{STATUS_LABELS[h.toStatus]}</strong><p>{h.note||"Sem anotação"}</p><small>{h.createdAt.toLocaleString("pt-BR")}{h.confirmedSent?" · envio confirmado":""}</small></div></div>)}</div>
      </Card>
    </div>
    <div className="grid two" style={{marginTop:18}}>
      <Card><h2>Dados do anúncio</h2><div className="chips"><Badge>{job.workMode||"modelo desconhecido"}</Badge><Badge>{job.seniority||"senioridade desconhecida"}</Badge><Badge>{job.contractType||"contratação desconhecida"}</Badge>{job.incomplete&&<Badge tone="warn">incompleta</Badge>}</div><pre className="textPreview">{job.description||"Descrição não informada."}</pre></Card>
      <Card><h2>Ajuste manual da nota</h2><p className="muted">O ajuste não apaga o cálculo original e exige justificativa.</p><form action={adjustScore} className="stack"><input type="hidden" name="jobId" value={id}/><label>Nota<input type="number" name="score" min="0" max="100" defaultValue={job.manualScore??assessment?.score??0}/></label><label>Justificativa<textarea name="reason" defaultValue={job.manualScoreReason??""}/></label><button>Salvar ajuste</button></form></Card>
    </div>
    <Card style={{marginTop:18} as React.CSSProperties}><h2>Preparação da candidatura</h2><p className="muted">Os textos usam apenas fatos explicitamente confirmados. Salário, disponibilidade e declarações sensíveis permanecem pendentes de revisão.</p><form action={prepareApplication} className="actions"><input type="hidden" name="jobId" value={id}/><select name="resumeId" style={{maxWidth:360}}><option value="">Sem currículo selecionado</option>{resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button>Gerar materiais determinísticos</button></form>
      {job.preparations.map(p=><div className="card" key={p.id} style={{marginTop:14}}><div className="split"><strong>Preparação de {p.createdAt.toLocaleString("pt-BR")}</strong><Badge>{p.aiProvider}</Badge></div><h3>Resumo</h3><p>{p.opportunitySummary}</p><h3>Apresentação curta</h3><pre className="textPreview">{p.shortIntroduction}</pre><h3>Alterações propostas</h3><ul>{parseJson<string[]>(p.proposedChangesJson,[]).map(x=><li key={x}>{x}</li>)}</ul><h3>Pendências</h3><ul>{parseJson<string[]>(p.pendingItemsJson,[]).map(x=><li key={x}>{x}</li>)}</ul></div>)}
    </Card>
  </>;
}
