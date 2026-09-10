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

## Primeiro uso

1. Abra **Perfil**, revise os dados iniciais e mantenha como rascunho tudo que ainda não foi validado.
2. Copie para **Fatos confirmados** somente afirmações que você revisou e aceita usar em candidaturas.
3. Importe o currículo em **Currículos**, confira o texto extraído e confirme a versão.
4. Cadastre uma vaga em **Vagas**. A URL é armazenada e normalizada, mas nunca é acessada pelo servidor.
5. Revise nota, cobertura, requisitos atendidos, lacunas, desconhecidos e critérios eliminatórios.
6. Avance para **Aprovada para preparar** e gere os materiais.
7. Revise as pendências, abra o portal e conclua a candidatura manualmente.
8. Marque **Enviada** apenas com a caixa de confirmação ou uma evidência verificável.

## Estados do pipeline

| Estado | Finalidade |
| --- | --- |
| Nova | Vaga recém-importada ou cadastrada. |
| Em análise | Avaliação humana em andamento. |
| Aprovada para preparar | Vaga escolhida, ainda não enviada. |
| Preparada | Materiais gerados e aguardando revisão. |
| Aguardando ação | Tudo pronto para conclusão manual no portal. |
| Enviada | Envio explicitamente confirmado ou comprovado. |
| Em processo | Empresa respondeu ou iniciou o processo. |
| Entrevista | Entrevista confirmada. |
| Oferta | Oferta recebida. |
| Rejeitada | Rejeição explícita; silêncio não conta como rejeição. |
| Arquivada | Registro preservado fora do fluxo ativo. |
| Retirada | Candidatura retirada por decisão do usuário. |

## Como a compatibilidade é calculada

Os pesos padrão são tecnologias 30, senioridade 20, localização/modelo 15, responsabilidades 15, idioma 10 e salário/contratação 10. Somente critérios com dados conhecidos entram no denominador da nota; por isso a cobertura é exibida separadamente. Requisitos desejáveis não viram bloqueios e informações ausentes não são contadas como falha.

As faixas são:

- 80–100: prioritária.
- 65–79: revisar.
- Abaixo de 65: baixa prioridade.
- Eliminada: existe ao menos um critério eliminatório, independentemente da nota informativa.

A nota é uma comparação determinística com o perfil, não uma probabilidade de contratação.

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

### Comandos úteis

| Comando | Ação |
| --- | --- |
| `npm run dev` | Painel em modo de desenvolvimento, ligado somente a `127.0.0.1`. |
| `npm run worker` | Worker de sincronização e tarefas agendadas. |
| `npm run build` | Gera Prisma Client e build de produção. |
| `npm start` | Serve o build de produção somente em `127.0.0.1`. |
| `npm run db:seed` | Cria o perfil inicial editável e pesos padrão sem vagas fictícias. |
| `npm run check` | Executa lint, testes unitários/integrados e build. |

## Docker Compose

Copie `.env.example` para `.env` e execute:

```powershell
docker compose up --build
```

O Compose publica somente `127.0.0.1:3000` e mantém banco/uploads no volume `app_data`.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Arquivo SQLite. O padrão local é `file:../data/app.db`. |
| `APP_URL` | Sim | URL local usada por callbacks. |
| `WORKER_INTERVAL_MS` | Não | Intervalo do worker; mínimo efetivo de 60 segundos. |
| `APP_ENCRYPTION_KEY` | Para Gmail | Chave base64 de 32 bytes usada somente para criptografar tokens. |
| `GOOGLE_CLIENT_ID` | Para Gmail | Identificador público do cliente OAuth. |
| `GOOGLE_CLIENT_SECRET` | Para Gmail | Segredo do cliente, mantido somente no `.env`. |
| `GOOGLE_REDIRECT_URI` | Para Gmail | Callback que deve coincidir exatamente com o Google Cloud. |
| `OPENAI_API_KEY` | Para IA | Chave da API, nunca enviada ao navegador ou gravada no banco. |
| `OPENAI_MODEL` | Para IA | Modelo disponível no projeto da API. Não há modelo presumido. |
| `OPENAI_MONTHLY_REQUEST_LIMIT` | Não | Referência de configuração; o limite ativo é editável no painel. |

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

Tokens recebidos são criptografados com AES-256-GCM antes de entrar no SQLite. A desconexão remove os tokens armazenados. Mensagens e anúncios são tratados como conteúdo não confiável; instruções encontradas nesses textos não controlam a aplicação.

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

### Relatório de QA — busca “Dev Pleno de Teste”

Executado em 9 de setembro de 2026 no Chromium do Playwright. Foram criadas quatro vagas fictícias com a fonte `QA_CONTROLADO`; todas foram removidas automaticamente ao final da suíte.

| Caso | Cenário buscado | Resultado esperado | Resultado |
| --- | --- | --- | --- |
| QA-01 | `Dev Pleno de Teste — TypeScript` | Encontrar a vaga compatível e exibir 92/100. | Aprovado |
| QA-02 | `Dev Pleno de Teste — Dados incompletos` | Encontrar a vaga e exibir o aviso `incompleta`. | Aprovado |
| QA-03 | `Dev Pleno de Teste — Possível duplicata` | Encontrar o registro e sinalizar possível duplicata sem fusão. | Aprovado |
| QA-04 | `Dev Pleno de Teste — Critério eliminatório` | Preservar a nota 86 e exibir o bloqueio separadamente. | Aprovado |

Resultado da execução completa:

- 17 testes unitários e de integração aprovados.
- 6 testes de interface aprovados, incluindo os quatro casos de QA acima.
- Build de produção aprovado.
- Lint e verificação TypeScript aprovados.
- Worker iniciado e execução agendada concluída com sucesso.
- `npm audit`: zero vulnerabilidades conhecidas.

## API local

| Rota | Método | Finalidade |
| --- | --- | --- |
| `/api/health` | GET | Verificação de processo e acesso ao SQLite. |
| `/api/resumes` | POST | Upload validado e extração de PDF/DOCX. |
| `/api/backup` | GET | Exportação JSON sem tokens ou segredos. |
| `/api/backup/restore` | POST | Restauração transacional de backup validado. |
| `/api/data/delete` | POST | Exclusão local após a confirmação textual `EXCLUIR`. |
| `/api/integrations/gmail/start` | GET | Início do OAuth com `state`. |
| `/api/integrations/gmail/callback` | GET | Troca do código e armazenamento criptografado. |
| `/api/integrations/gmail/import` | POST | Importação do marcador selecionado. |
| `/api/integrations/gmail/disconnect` | POST | Remoção da conexão e dos tokens locais. |

## Solução de problemas

- **Banco não existe:** execute `npx prisma migrate deploy` e `npm run db:seed`.
- **PDF sem texto:** o arquivo provavelmente é digitalizado; aplique OCR externamente e importe novamente.
- **Gmail desconectado:** confira as quatro variáveis Google, `APP_ENCRYPTION_KEY`, a Gmail API habilitada e a URI de callback exata.
- **OpenAI desativada:** configure chave e modelo no `.env`, reinicie o painel e habilite a opção em **Integrações**.
- **Porta 3000 ocupada:** encerre o processo anterior antes de reiniciar, preservando a URL do callback configurada.
- **Falha no worker:** consulte **Execuções**; mensagens são limitadas e nunca incluem tokens.

## Estrutura

- `src/app`: telas, Server Actions e Route Handlers.
- `src/lib`: regras de negócio, segurança, IA, Gmail e backup.
- `prisma`: schema, migração e seed editável.
- `worker`: processo agendado separado.
- `tests`: testes unitários, integração e interface.

## Segurança e dados

- `.env`, SQLite, uploads, backups locais e relatórios de teste são ignorados pelo Git.
- O painel não possui contas, organizações, cobrança ou exposição pública intencional.
- Route Handlers e Server Actions validam limites e campos relevantes no servidor.
- URLs importadas aceitam apenas HTTP/HTTPS; nenhuma requisição é feita a elas.
- Erros externos têm timeout/tentativas limitadas e são registrados sem credenciais.
- Backups exportados omitem integrações e tokens; guarde os arquivos exportados em local protegido.
- O sistema não responde testes técnicos, avaliações comportamentais ou declarações pessoais como se fosse o usuário.

Dados iniciais sobre GPECx e tecnologias são apenas rascunhos editáveis. Eles não entram em textos de candidatura até serem copiados e confirmados explicitamente em **Fatos confirmados**.
