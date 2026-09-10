import { runDiscoveryNow, saveDiscoverySettings, saveGmailLabel, saveSettings } from "@/app/actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { listGmailLabels } from "@/lib/gmail";
import { parseJson } from "@/lib/json";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const [settings, gmail, lastDiscovery] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.integration.findUnique({ where: { provider: "gmail" } }),
    prisma.execution.findFirst({ where: { task: { in: ["python-job-discovery", "manual-job-discovery"] } }, orderBy: { startedAt: "desc" } }),
  ]);
  let labels: { id: string; name: string }[] = [];
  if (gmail?.status === "connected") {
    try { labels = await listGmailLabels(); } catch { labels = []; }
  }
  const sources = new Set(parseJson<string[]>(settings.discoverySourcesJson, ["LinkedIn", "Indeed", "Glassdoor"]));
  const discoveryQueries = parseJson<string[]>(settings.discoveryQueriesJson, []);
  const openaiReady = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const gmailReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && process.env.APP_ENCRYPTION_KEY);
  const errorMessage = query.erro === "pesos"
    ? "Os pesos devem ser inteiros não negativos e somar 100."
    : query.erro === "descoberta"
      ? "Informe pelo menos uma fonte e uma busca; a nota deve ficar entre 0 e 100 e o limite diário entre 1 e 100."
      : query.erro ? decodeURIComponent(query.erro) : null;

  return <>
    <PageHeader eyebrow="Configuração" title="Integrações e critérios" description="Busca automática por alertas oficiais, sem raspagem dos portais." />
    {errorMessage && <div className="notice">{errorMessage}</div>}
    {query.descoberta === "salva" && <div className="notice success">Configuração da busca automática salva.</div>}
    <div className="grid two">
      <Card>
        <div className="split"><h2>OpenAI</h2><Badge tone={openaiReady ? "good" : "neutral"}>{openaiReady ? "configurada" : "desativada"}</Badge></div>
        <p>A integração usa Responses API, saída estruturada e limite mensal. A chave nunca é exibida no painel.</p>
        {!openaiReady && <div className="callout warn">Sem chave configurada: a preparação determinística continua funcionando.</div>}
      </Card>
      <Card>
        <div className="split"><h2>Gmail</h2><Badge tone={gmail?.status === "connected" ? "good" : "neutral"}>{gmail?.status === "connected" ? "conectado" : "desconectado"}</Badge></div>
        <p>O marcador escolhido continua disponível para importação manual. A busca automática lê somente alertas com remetentes oficiais do LinkedIn, Indeed e Glassdoor.</p>
        {!gmailReady
          ? <div className="callout warn">Configure as variáveis Google e a chave de criptografia no arquivo local de ambiente.</div>
          : gmail?.status !== "connected"
            ? <a className="btn" href="/api/integrations/gmail/start">Conectar Gmail</a>
            : <>
              <form action={saveGmailLabel} className="stack">
                <label>Marcador de vagas<select name="label" defaultValue={gmail.selectedFolder ?? ""}><option value="">Selecione</option>{labels.map((label) => <option value={label.id} key={label.id}>{label.name}</option>)}</select></label>
                <button>Salvar marcador</button>
              </form>
              <div className="actions" style={{ marginTop: 10 }}>
                <form action="/api/integrations/gmail/import" method="post"><button>Importar marcador agora</button></form>
                <form action="/api/integrations/gmail/disconnect" method="post"><button className="danger">Desconectar</button></form>
              </div>
            </>}
      </Card>
    </div>

    <Card style={{ marginTop: 18 } as React.CSSProperties}>
      <div className="split">
        <div><h2>Busca automática de vagas</h2><p className="muted">O agendador Python consulta o Gmail a cada 2 horas, valida os remetentes, extrai somente links de vagas e nunca raspa os portais.</p></div>
        <Badge tone={settings.discoveryEnabled ? "good" : "neutral"}>{settings.discoveryEnabled ? "ativa" : "pausada"}</Badge>
      </div>
      <div className="callout">
        <strong>Configuração única nos portais</strong>
        <p>Crie alertas diários nas buscas desejadas e mantenha o recebimento por e-mail ativado. Depois disso, você não precisa procurar manualmente.</p>
        <div className="actions">
          <a className="btn secondary" href="https://www.linkedin.com/jobs/search/?keywords=Desenvolvedor%20Full-Stack%20Pleno" target="_blank" rel="noreferrer">Criar alerta no LinkedIn ↗</a>
          <a className="btn secondary" href="https://br.indeed.com/jobs?q=desenvolvedor+full+stack+pleno" target="_blank" rel="noreferrer">Criar alerta no Indeed ↗</a>
          <a className="btn secondary" href="https://www.glassdoor.com.br/Vaga/index.htm" target="_blank" rel="noreferrer">Criar alerta no Glassdoor ↗</a>
        </div>
      </div>
      <form action={saveDiscoverySettings} className="formGrid" style={{ marginTop: 18 }}>
        <label className="checkbox span2"><input type="checkbox" name="discoveryEnabled" defaultChecked={settings.discoveryEnabled} /> Executar automaticamente a cada 2 horas</label>
        <fieldset className="span2 sourceChoices"><legend>Fontes oficiais</legend>{["LinkedIn", "Indeed", "Glassdoor"].map((source) => <label className="checkbox" key={source}><input type="checkbox" name="discoverySources" value={source} defaultChecked={sources.has(source)} /> {source}</label>)}</fieldset>
        <label>Nota mínima para entrar na fila<input type="number" name="discoveryMinScore" min="0" max="100" defaultValue={settings.discoveryMinScore} /></label>
        <label>Limite de novas vagas por dia<input type="number" name="discoveryDailyLimit" min="1" max="100" defaultValue={settings.discoveryDailyLimit} /></label>
        <label className="span2">Cargos e palavras-chave, um por linha<textarea name="discoveryQueries" defaultValue={discoveryQueries.join("\n")} /></label>
        <div className="span2 actions"><button>Salvar busca automática</button></div>
      </form>
      <div className="split discoveryRun">
        <div><strong>Última execução</strong><p className="muted">{lastDiscovery ? `${lastDiscovery.startedAt.toLocaleString("pt-BR")} · ${lastDiscovery.status} · ${lastDiscovery.processed} nova(s)` : "Ainda não executada."}</p></div>
        <form action={runDiscoveryNow}><button className="secondary" disabled={gmail?.status !== "connected"}>Buscar alertas agora</button></form>
      </div>
    </Card>

    <Card style={{ marginTop: 18 } as React.CSSProperties}>
      <h2>Pesos da compatibilidade</h2>
      <form action={saveSettings} className="formGrid">
        <label>Tecnologias<input type="number" name="technologiesWeight" defaultValue={settings.technologiesWeight} /></label><label>Senioridade<input type="number" name="seniorityWeight" defaultValue={settings.seniorityWeight} /></label>
        <label>Localização e modelo<input type="number" name="locationWeight" defaultValue={settings.locationWeight} /></label><label>Responsabilidades<input type="number" name="responsibilitiesWeight" defaultValue={settings.responsibilitiesWeight} /></label>
        <label>Idioma<input type="number" name="languageWeight" defaultValue={settings.languageWeight} /></label><label>Salário e contratação<input type="number" name="salaryWeight" defaultValue={settings.salaryWeight} /></label>
        <label className="checkbox"><input type="checkbox" name="aiEnabled" defaultChecked={settings.aiEnabled} /> Habilitar IA quando configurada</label><label>Limite mensal de solicitações de IA<input type="number" name="aiMonthlyLimit" min="0" defaultValue={settings.aiMonthlyLimit} /></label>
        <div className="span2"><button>Salvar configuração</button></div>
      </form>
    </Card>
    <Card style={{ marginTop: 18 } as React.CSSProperties}><h2>Dados, backup e exclusão</h2><div className="actions"><a className="btn secondary" href="/api/backup">Exportar backup JSON</a><form action="/api/backup/restore" method="post" encType="multipart/form-data"><input name="backup" type="file" accept="application/json,.json" required /><button>Restaurar backup</button></form><form action="/api/data/delete" method="post"><input name="confirmation" placeholder="Digite EXCLUIR" required /><button className="danger">Excluir dados pessoais</button></form></div></Card>
  </>;
}
