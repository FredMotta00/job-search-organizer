import { confirmResume, createResumeVersion, setDefaultResume } from "@/app/actions";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";

export const dynamic = "force-dynamic";

const orientation = {
  ORIGINAL: "Original",
  FULL_STACK: "Full-Stack",
  BACKEND_INTEGRACOES: "Backend e integrações",
  IA_AUTOMACAO: "IA e automação",
};

export default async function ResumesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const resumes = await prisma.resume.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });

  return <>
    <PageHeader eyebrow="Documentos" title="Currículos" description="PDF e DOCX, até 5 MB. Revise o texto extraído antes de confirmar." />
    {query.erro && <div className="notice">{query.erro === "padrao" ? "Somente um currículo confirmado com arquivo original pode ser definido como padrão." : decodeURIComponent(query.erro)}</div>}
    {query.padrao && <div className="notice success">Currículo padrão atualizado. Ele será priorizado em todas as candidaturas.</div>}
    <Card>
      <h2>Importar currículo</h2>
      <form action="/api/resumes" method="post" encType="multipart/form-data" className="formGrid">
        <label>Nome da versão<input name="name" required placeholder="Currículo principal" /></label>
        <label>Arquivo<input type="file" name="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>
        <div className="span2"><button>Extrair texto</button></div>
      </form>
    </Card>
    <div className="grid two" style={{ marginTop: 18 }}>
      {resumes.length === 0
        ? <Card><Empty title="Nenhum currículo">Importe um PDF com texto ou DOCX para começar.</Empty></Card>
        : resumes.map((resume) => <Card key={resume.id}>
          <div className="split">
            <div>
              <h2>{resume.name}</h2>
              <div className="chips">
                {resume.isDefault && <Badge tone="info">padrão para todas as vagas</Badge>}
                <Badge>{orientation[resume.orientation]}</Badge>
                <Badge tone={resume.confirmed ? "good" : "warn"}>{resume.confirmed ? "confirmado" : "aguardando revisão"}</Badge>
              </div>
            </div>
            <small className="muted">{resume.createdAt.toLocaleDateString("pt-BR")}</small>
          </div>
          {parseJson<string[]>(resume.changesJson, []).map((change) => <div className="callout" key={change}>{change}</div>)}
          <pre className="textPreview">{resume.extractedText || "Nenhum texto extraído. Se for PDF digitalizado, use OCR externo e importe uma versão com texto."}</pre>
          {!resume.confirmed && <form action={confirmResume}><input type="hidden" name="resumeId" value={resume.id} /><button>Confirmar como fonte de verdade</button></form>}
          {resume.confirmed && <div className="stack">
            {!resume.isDefault && resume.storedPath && <form action={setDefaultResume}><input type="hidden" name="resumeId" value={resume.id} /><button>Usar como padrão em todas as vagas</button></form>}
            <form action={createResumeVersion} className="actions">
              <input type="hidden" name="resumeId" value={resume.id} />
              <select name="orientation"><option value="FULL_STACK">Full-Stack</option><option value="BACKEND_INTEGRACOES">Backend e integrações</option><option value="IA_AUTOMACAO">IA e automação</option></select>
              <button className="secondary">Criar versão orientada</button>
            </form>
          </div>}
        </Card>)}
    </div>
  </>;
}
