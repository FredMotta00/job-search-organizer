# Carreira — organizador pessoal de busca de emprego

Aplicação local e de usuário único para cadastrar vagas, avaliar compatibilidade, preparar materiais fundamentados e acompanhar candidaturas. O sistema não envia candidaturas e não coleta páginas de portais: ele organiza os materiais e abre o link para conclusão manual.

## O que funciona

- Onboarding editável com perfil, preferências, pretensão por contratação/moeda e fatos confirmados.
- Cadastro manual de vagas, texto de anúncio, origem de campos e marcação de dados incompletos.
- Deduplicação exata por fonte/ID e URL normalizada, além de alerta de possíveis duplicatas entre plataformas.
- Pontuação determinística configurável, separada de critérios eliminatórios, com cobertura, lacunas e desconhecidos.
- Ajuste manual da nota com justificativa preservando o cálculo original.
- Pipeline com 12 estados, histórico, currículo utilizado e bloqueio do falso status “Enviada”.
- Importação de PDF e DOCX (até 5 MB), pré-visualização do texto e confirmação humana.
- Versões de currículo Full-Stack, Backend/Integrações e IA/Automação sem adicionar fatos.
- Preparação determinística completa sem IA; OpenAI opcional com saída estruturada, validação de vínculo e limite mensal.
- Banco de respostas com marcação de conteúdo sensível e confirmação.
- Gmail opcional via OAuth, escopo somente leitura e seleção de um marcador específico.
- Dashboard com denominadores explícitos, exportação/restauração JSON e exclusão de dados.
- Worker Node separado, agendamento simples, trava de concorrência e registro de execuções.

## Limites intencionais

- LinkedIn, Indeed, Sólides e portais semelhantes não são coletados nem preenchidos automaticamente. Use o cadastro manual e o botão para abrir a candidatura.
- O Gmail importa somente mensagens do marcador escolhido. Um link no e-mail não é acessado; alertas curtos são marcados como incompletos.
- A extração de PDF não executa OCR. PDFs digitalizados sem camada de texto geram aviso.
- A IA nunca envia candidaturas, executa comandos ou acessa segredos. Se falhar ou não estiver configurada, o fluxo determinístico continua disponível.
- Não foram implementados CAPTCHA, MFA, proxies, cookies extraídos ou qualquer técnica de evasão.

## Requisitos

- Node.js 20, 22 ou 24+.
- npm.
- Docker é opcional.

## Execução local

```powershell
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). Em outro terminal, inicie o worker:

```powershell
npm run worker
```

O painel e o banco ficam restritos a este computador por padrão. O SQLite é salvo em `data/app.db`; uploads ficam em `data/uploads/`.

## Docker Compose

Copie `.env.example` para `.env` e execute:

```powershell
docker compose up --build
```

O Compose publica somente `127.0.0.1:3000` e mantém banco/uploads no volume `app_data`.

## Configuração opcional da OpenAI

Uma assinatura do ChatGPT não oferece automaticamente créditos de API. Configure a chave somente no arquivo local `.env`, nunca no código ou em commits:

```dotenv
OPENAI_API_KEY="..."
OPENAI_MODEL="modelo-disponível-na-sua-conta"
OPENAI_MONTHLY_REQUEST_LIMIT="30"
```

Depois, habilite a IA em **Integrações e critérios**. A integração usa a [Responses API](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create), `store: false`, timeout, duas tentativas limitadas, JSON Schema e validação local dos fatos vinculados.

## Configuração opcional do Gmail

1. Crie um projeto no Google Cloud e habilite a Gmail API.
2. Crie um cliente OAuth do tipo **Aplicação Web**.
3. Cadastre exatamente `http://127.0.0.1:3000/api/integrations/gmail/callback` como URI de redirecionamento.
4. Gere uma chave de 32 bytes em base64 para criptografar tokens localmente.
5. Preencha somente no `.env`:

```dotenv
APP_ENCRYPTION_KEY=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://127.0.0.1:3000/api/integrations/gmail/callback"
```

A conexão segue o [fluxo OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server) com `state`, acesso offline e o escopo mínimo [`gmail.readonly`](https://developers.google.com/workspace/gmail/api/auth/scopes). A importação usa `labelIds` para limitar mensagens ao marcador escolhido.

## Backup e restauração

Use **Integrações → Dados, backup e exclusão** para exportar JSON. O backup contém dados do perfil, vagas, currículos extraídos, avaliações, materiais e histórico; nunca inclui tokens OAuth ou variáveis de ambiente.

Para cópia manual com a aplicação parada:

```powershell
Copy-Item data/app.db data/app.backup.db
Copy-Item data/uploads data/uploads.backup -Recurse
```

## Testes e qualidade

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
npm audit
```

A suíte cobre deduplicação, dados ausentes, obrigatório versus desejável, critérios eliminatórios, prevenção de invenção, persistência, transições, falso envio, credenciais ausentes, conteúdo não confiável, upload, URLs e backup/restauração.

## Estrutura

- `src/app`: telas, Server Actions e Route Handlers.
- `src/lib`: regras de negócio, segurança, IA, Gmail e backup.
- `prisma`: schema, migração e seed editável.
- `worker`: processo agendado separado.
- `tests`: testes unitários, integração e interface.

Dados iniciais sobre GPECx e tecnologias são apenas rascunhos editáveis. Eles não entram em textos de candidatura até serem copiados e confirmados explicitamente em **Fatos confirmados**.
