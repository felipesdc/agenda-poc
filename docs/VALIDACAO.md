# Verificação inicial — 05/11/2026

A análise inicial modificou a documentação e adicionou um exemplo público de configuração, sem alterar regras de negócio ou o banco existente. Os resultados do incremento na aplicação estão registrados ao final.

| Verificação | Resultado |
| --- | --- |
| Leitura de páginas, componentes, ações, schema, migrações e seed | Concluída; achados registrados em ARQUITETURA.md e ROADMAP.md |
| `npm ci --ignore-scripts --no-audit --no-fund` | Concluído: 411 pacotes instalados; scripts de instalação não executados |
| `npm run lint` | Reprovado: 6 erros e 11 avisos no código existente |
| `DATABASE_URL='file:./dev.db' npx prisma generate` | Bloqueado por tentativa de atualizar cache fora das pastas permitidas (`EPERM`) |
| Geração com `XDG_CACHE_HOME` em `/private/tmp` | Não concluída: falha de resolução de `binaries.prisma.sh` (`ENOTFOUND`) ao buscar o motor |
| `npx tsc --noEmit` | Reprovado com cliente Prisma não gerado; erros de exports ausentes e tipos implícitos. Reexecutar após geração bem-sucedida antes de concluir sobre tipos |
| `git diff --check` | Aprovado |
| Migrações, seed, build e navegação no navegador | Não executados nesta análise; o ambiente não concluiu a geração do cliente Prisma |

## Erros do lint

- `DashboardCalendar.tsx`: dois usos de `any`.
- `StatusCards.tsx`: dois usos de `any`.
- `UserSwitcher.tsx`: um uso de `any`.
- `TaskModal.tsx`: atualização síncrona de estado em efeito (`react-hooks/set-state-in-effect`).

Os 11 avisos são imports e variáveis não utilizados. Não foram ocultados nem desabilitados nesta entrega.

## Reproduzir a verificação completa

Em um ambiente com acesso aos binários do Prisma, seguir a preparação do README. Depois executar lint, verificação de tipos e build. O seed é apresentado por chamada direta ao `ts-node`, pois a CLI avisa que `prisma.config.ts` sobrepõe a configuração legada `package.json#prisma`; centralizar essa configuração é uma melhoria pendente.

Para validar o produto, criar uma tarefa, editar periodicidade e pontos focais, concluir como operador e validar como gestor. Conferir sucessora e histórico. Testar também erros, ações repetidas e acesso entre unidades após as correções correspondentes. Não executar essas verificações no banco com dados importantes.


## Incremento 1 — cadastro e retorno das ações

O registro acima preserva a situação anterior. Resultados após as alterações:

| Verificação | Resultado |
| --- | --- |
| Cliente Prisma | Gerado com os binários existentes copiados para uma pasta temporária, sem buscar novos binários |
| `npm test` | 5 testes aprovados: frequência ausente, todas as frequências, pontos focais únicos, datas/entradas inválidas, arquivos em campos textuais |
| `npm run lint` | Aprovado, sem erros ou avisos |
| `npx tsc --noEmit` | Aprovado |
| Integração de cadastro/edição | Ações reais e Prisma sobre SQLite temporário; sessão e revalidação substituídas por adaptadores de teste. Confirmados cadastro sem frequência, histórico de criação, edição persistida, funcionário inexistente sem alteração das relações e recusa de data inválida/usuário ausente |
| Servidor e resposta HTML | GET `/` respondeu 200; HTML contém periodicidade, funcionários, pontos focais e idioma `pt-BR` |
| Build de produção | `npx next build --webpack` aprovado; o build padrão com Turbopack foi interrompido após não concluir neste ambiente. Webpack não foi definido como padrão do projeto |
| Navegador | Não verificado: host de automação indisponível. Não foi possível testar cliques, foco ou preservação visual dos campos |

A base usada foi `/private/tmp/agenda-poc-incremento-1.db`; `prisma/dev.db` não foi alterado. A CLI `migrate deploy` retornou `Schema engine error` sem detalhe neste ambiente; os SQLs versionados foram aplicados com SQLite para preparar apenas a base temporária, e o seed foi executado com sucesso. Isso não confirma o funcionamento da CLI de migrações.

O teste de integração foi uma verificação pontual com script temporário; `npm test` executa os testes de validação versionados. As permissões por unidade, transações de auditoria e idempotência das recorrências ainda não estão cobertas nem corrigidas neste incremento.


## Ampliação da suíte automatizada — 05/11/2026

- Migração dos testes de entrada para Vitest e adição de testes de recorrência, status, integração de ações e componentes React.
- `npm test`: 70 aprovados, 5 `todo`, 6 arquivos. Os `todo` registram regras ainda ausentes; não são verificações aprovadas.
- A integração agora é versionada e reproduzível, com banco novo por execução, aplicação dos SQLs de migração, cookies simulados e auditoria real.
- O JSDOM permitiu verificar as interações dos componentes e encontrar a perda da periodicidade/pontos focais após falha. Corrigida a sincronização dos defaults nativos em `TaskFields`, com testes de regressão no cadastro e na edição.
- `npx next build --webpack`: aprovado após a correção de `TaskFields`.
- Navegador real e transporte HTTP das Server Actions continuam fora dessa suíte.

Veja [TESTES.md](TESTES.md) para comandos, cobertura e limites. Nenhuma regra de autorização ou recorrência do roteiro foi antecipada nesta mudança.


## Incremento 2 — autorização e integridade — 05/11/2026

- `npm test`: 90 aprovados em 6 arquivos, sem `todo`. Novos controles de perfil/unidade, estados, entradas forjadas, validações sequenciais/simultâneas, rollback via triggers SQLite e bloqueio da sessão de demonstração em produção.
- Migração `20261106000000_task_recurrence_integrity` aplicada com `prisma migrate deploy` em cópia temporária do banco existente. Comparação de todas as colunas anteriores confirmou preservação dos dados de unidades, usuários, funcionários, tarefas, vínculos e histórico.
- `prisma migrate diff` entre a cópia migrada e o schema atualizado: nenhuma diferença.
- `npx next build --webpack`: aprovado.
- Banco original não alterado. O README contém os comandos para aplicar a migração e atualizar o seed na instalação local.
- Autenticação real e arquivamento continuam pendentes; a sessão simulada foi limitada a desenvolvimento com flag explícita.

## Incremento 3 — arquivamento e restauração — 05/11/2026

- `npm test`: 127 aprovados em 7 arquivos, sem `todo`.
- `npx tsc --noEmit`, `npm run lint` e `git diff --check`: aprovados.
- `npx next build --webpack`: aprovado.
- `prisma migrate deploy` aplicou as migrações pendentes em cópia temporária do banco original, incluindo `20261106010000_task_archiving`.
- Comparação de todos os campos anteriores de unidades, usuários, funcionários, tarefas, vínculos e histórico confirmou preservação dos registros. Novos campos de arquivamento ficaram nulos nas tarefas existentes.
- `prisma migrate diff` entre a cópia migrada e o schema: nenhuma diferença.
- Testes com SQLite real confirmaram restauração de cada estado, isolamento entre unidades, motivo obrigatório, proteção contra chamadas simultâneas, preservação dos vínculos de recorrência e rollback de ARCHIVE/RESTORE via falha de auditoria.
- Testes JSDOM cobrem formulário de motivo, cancelamento, erros/nova tentativa, restrições do modal, consulta do arquivo e navegação Ativas/Arquivadas. Navegador real e transporte HTTP continuam fora desta verificação.
- A aplicação removeu a Server Action de exclusão física. Banco original não alterado; instruções de atualização no README.

## Incremento 4 — login por senha e calendário — 07/11/2026

- Runtime de verificação: Node 22.23.4. O requisito mínimo passou a Node 20.19; `.nvmrc` indica Node 22.
- `npm test`: 187 aprovados em 11 arquivos, incluindo Better Auth real, SQLite temporário, Server Actions com sessão por senha, componentes de login/logout, parâmetros inválidos e cores do calendário.
- `npx tsc --noEmit`, `npm run lint` e `git diff --check`: aprovados.
- `npx next build --webpack`: aprovado; `/login` e `/api/auth/[...all]` constam como rotas dinâmicas, sem depender de segredos durante o build.
- Migração `20261107000000_password_auth` aplicada com Prisma em cópia do banco existente. `prisma migrate diff`: nenhuma diferença para o schema atualizado. Comparação dos dados anteriores de unidades, usuários, funcionários, tarefas, vínculos e histórico confirmou preservação após migração e testes HTTP.
- `npm run auth:provision` executado por stdin na cópia, usando senha exclusiva de teste. Confirmados gravação do acesso sem modificar o perfil/unidade e ausência de senhas padrão no seed.
- Servidor Next em localhost: agenda anônima pede identificação; `/login` entrega formulário; POST de login retorna 200 e cookie de sessão; GET da agenda autenticada retorna 200 sem seletor de demonstração; GET de `/login` autenticado retorna 307 para a agenda; POST de logout retorna 200 e a agenda volta a exigir identificação.
- Host de automação de navegador indisponível. A revisão visual em navegador real continua pendente; as interações do formulário foram verificadas em JSDOM e o transporte em HTTP real.
- Banco original e arquivos locais de segredos não alterados. Configuração e operação detalhadas em [AUTENTICACAO.md](AUTENTICACAO.md).

## Incremento 5 — CI e preparação do banco (07/11/2026)

- Validação local com Node 22: lint, tipos, 187 testes em 11 arquivos e `npm run build -- --webpack` aprovados.
- SQLite temporário vazio: seis migrações aplicadas por `db:prepare`, `db:status` atualizado, `db:check` sem diferenças e `prisma validate` aprovado. O arquivo vazio foi criado explicitamente antes das migrações, como no workflow.
- Contraprova: uma cópia temporária teve a tabela AuthRateLimit removida; `db:check` detectou a diferença e retornou código 2.
- Workflow configurado para GitHub Actions, ainda sem execução remota nesta entrega. A instalação limpa `npm ci` será executada no runner; não foi repetida sobre o node_modules local.
- O banco local já migrado durante a correção do erro P2022 não foi usado nessas verificações.

## Incremento 6 — gestão administrativa (07/11/2026)

- 200 testes aprovados em 12 arquivos; novos casos de gestão usam SQLite temporário e componentes em JSDOM.
- Autorização de consultas e mutações, isolamento de unidade, validação/duplicação de e-mail, proteção do próprio gestor, sincronização/revogação e rollback verificados.
- Build `npm run build -- --webpack` aprovado com rota dinâmica `/usuarios`; lint e tipos verificados com Node 22.
- Sem nova migração e sem alterações no banco local neste incremento. Validação visual em navegador e transporte HTTP de Server Actions não foram executados para esta tela.

## Incremento 7 — auditoria administrativa (07/11/2026)

- 206 testes aprovados em 12 arquivos, lint e tipos aprovados com Node 22; build `npm run build -- --webpack` aprovado.
- Testes com SQLite temporário verificam autoria/snapshots, retenção, permissões/unidade, limite de consulta, ausência de eventos sem mudanças e rollback após falha de auditoria.
- Backup local em `/private/tmp/agenda-poc-before-user-audit-20261107-214615.db`; migração aditiva aplicada por `db:prepare` e `db:check` sem diferenças.
- Comparação de todos os registros nas 11 tabelas preexistentes confirmou preservação dos dados; tabela UserAudit local inicialmente vazia.
- A consulta renderiza no servidor; não houve validação visual em navegador deste histórico. A auditoria não cobre seed, provisionamento CLI ou alterações diretas no banco.

## Incremento 8 — desativação e reativação (07/11/2026)

- 219 testes aprovados em 12 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Integração com SQLite e handler real de autenticação verifica rejeição de login desativado, bloqueio por sessão antiga e novo login após reativação. Casos adicionais cobrem demo, permissões, confirmação, repetição, preservação de hash e rollback.
- Backup local em `/private/tmp/agenda-poc-before-activation-20261107-215607.db`; `db:prepare` aplicou migração aditiva e `db:check` não encontrou diferenças.
- Comparação de todas as colunas anteriores nas 12 tabelas preexistentes confirmou preservação dos dados; contas locais existentes permaneceram ativas.
- Testes de interface usam JSDOM; não houve validação visual em navegador neste incremento.

## Incremento 9 — visão anual interativa (07/11/2026)

- 225 testes aprovados em 12 arquivos, incluindo seis novos cenários anuais; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Modal real compartilhado exercitado em JSDOM com ações de servidor simuladas: detalhes, histórico, edição com falha/sucesso, visualizador e validação pelo gestor.
- Lista acompanha tarefas revalidadas após mudança de prazo; consulta mantém separação por ano e link para o mês correto. Sem migração ou alteração de dados locais neste incremento.
- Tentativa de inspeção no navegador encontrou `The browser access host is unavailable`; não foi realizada validação visual no navegador.

## Incremento 10 — detalhes pelos quadros de prazo (07/11/2026)

- 232 testes aprovados em 12 arquivos, incluindo sete novos cenários para os quadros; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Cada faixa abre lista e modal reais em JSDOM; testes verificam histórico, edição, visualizador, atualização após conclusão, exclusão de estados não aplicáveis, teclado e fechamento.
- Sem migração nem alteração dos dados locais. A lista usa somente o período consultado na agenda. Não houve validação visual em navegador neste incremento.

## Incremento 11 — lista com busca e filtros (07/11/2026)

- 252 testes aprovados em 13 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22. Rota `/tarefas` dinâmica incluída no build.
- Dez casos de parâmetros, seis de consulta SQLite e quatro de interação adicionados: busca por título/descrição, estado, vencidas históricas, isolamento, paginação, modal e permissões.
- Sem migração nem alteração do banco local. Busca de texto segue contains do SQLite; acentos não são normalizados.
- Interface validada em JSDOM com ações simuladas; não foi realizada validação visual em navegador nem submissão HTTP do formulário GET nesta entrega.

## Incremento 12 — UX/UI e temas (07/11/2026)

- 257 testes aprovados em 14 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Tema: três novos testes de preferência/persistência/sistema. Modal: dois novos testes de diálogo, Escape, foco e rolagem.
- Inspeção no Chrome via controles nativos: lista em claro/escuro, abertura por teclado, detalhes e campos de edição em escuro, Escape fechando e devolvendo foco à tarefa. Sem salvar mudanças em tarefas. Preferência restaurada para Sistema.
- Contrastes calculados para pares neutros: texto principal claro/superfície 15,77:1; secundário claro/fundo 5,09:1; texto suave claro/fundo 4,92:1; principal escuro/superfície 14,86:1; secundário escuro/superfície 8,03:1. São pares específicos, não uma certificação de acessibilidade da aplicação.
- Layouts de telas menores ajustados no código; não foi realizada inspeção em dispositivo móvel. Sem migração ou alteração de dados de negócio neste incremento.

## Incremento 13 — navegação e acessibilidade (07/11/2026)

- 264 testes aprovados em 14 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22. Os testes de tarefa foram repetidos após os ajustes finais de foco e formulário.
- Novos casos cobrem abas por setas/Home/End, associação dos painéis, rascunho preservado, foco em erro/cancelamento, Hoje nas duas visões, data atual e armazenamento de tema bloqueado.
- No Chrome nativo, a árvore de acessibilidade reconheceu tablist/tab/tabpanel; Tab e seta direita selecionaram Histórico. Escape fechou e devolveu foco à tarefa. Sem alterações em dados de tarefas.
- Sem migração. Inspeção com leitor de tela dedicado e dispositivo móvel não realizada; os resultados não representam certificação completa de acessibilidade.

## Incremento 14 — filtros de ponto focal e prazo (08/11/2026)

- 284 testes aprovados em 15 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Novos casos: 12 de parâmetros, cinco de consultas SQLite e três de formulário/paginação da página em JSDOM.
- Limites de datas incluem meia-noite inicial e último milissegundo final; filtros se combinam com vencidas sem sobrescrever restrições de data. Matrícula estrangeira/inexistente não retorna tarefas, e opções de visualizador não incluem e-mails ou pessoas exclusivas de outra unidade.
- Tentativa no Chrome encontrou ERR_CONNECTION_REFUSED em localhost:3000, pois o servidor não estava em execução. A validação do formulário foi feita em JSDOM; não houve validação visual nem submissão GET no navegador nesta entrega.
- Sem migração nem alteração de dados locais.

## Incremento 15 — fila de validação (08/11/2026)

- 292 testes aprovados em 15 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22, incluindo a rota dinâmica /validacoes.
- SQLite real verifica autorização, isolamento por unidade, estados/arquivamento, conclusões antigas/legadas, busca, paginação e retirada da fila após validar com recorrência única. O contador passa a zero após validação.
- JSDOM verifica modal com falha, nova tentativa, sucesso e lista vazia atualizada; há indicação de conclusão legada sem data.
- Sem migração nem alteração de dados locais. Não houve validação visual em navegador neste incremento.

## Incremento 16 — busca sem acentos (08/11/2026)

- 303 testes aprovados em 16 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Testes verificam português/latim comum, formas Unicode decompostas, idempotência, divisão da migração com triggers e consultas reais após criação/edição/recorrência, inclusive na fila.
- Backup local em `/private/tmp/agenda-poc-before-accent-search-20261108-132202.db`; migração aditiva aplicada por db:prepare e db:check sem diferenças.
- Comparação das colunas anteriores nas 12 tabelas preexistentes confirmou preservação dos dados; dois triggers de busca instalados. As cinco tarefas locais tiveram searchText comparado ao normalizador da aplicação, sem divergências.
- A mudança cobre o conjunto de acentos documentado; não oferece normalização universal de todos os alfabetos, correção ortográfica ou índice full-text. Não houve validação visual em navegador neste incremento.

## Incremento 17 — backup e restauração (08/11/2026)

- 309 testes aprovados em 17 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Seis casos de backup com SQLite real cobrem WAL, dados/histórico/triggers, permissões, sessões revogadas na cópia, recusa de sobrescrita/corrupção e migração inacabada.
- CLI db:backup criou `backups/agenda-2026-11-08T16-26-23-862Z.db`, confirmado como ignorado pelo Git. db:restore criou `/private/tmp/agenda-poc-restored-20261108-162623.db`; db:check na cópia não encontrou diferenças.
- Comparação confirmou preservação das 12 tabelas fora de AuthSession; a cópia restaurada contém zero sessões. O banco ativo e o .env não foram substituídos.
- Não houve nova migração, agendamento, envio externo ou teste em outra máquina. O arquivo de backup local fica disponível para revisão.

## Incremento 18 — exportação CSV (08/11/2026)

- 329 testes aprovados em 19 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22, incluindo /api/tarefas/exportar.
- Onze casos de serialização, sete de handler HTTP real/SQLite e dois de interface: autenticação/perfis/unidade, filtros, todas as páginas, limites, aspas/quebras/acentos e prefixos de fórmula.
- A interface verifica download/liberação de URL temporária e mensagem de limite sem navegação para JSON. O handler usa no-store/nosniff e não inclui e-mails/campos internos.
- Sem migração nem alteração de dados locais. Não houve download em navegador real ou abertura em Excel/LibreOffice nesta entrega; a neutralização de fórmulas é uma mitigação, sem garantia universal para todas as reimportações.

## Correção — Carlos no demo e atalhos (08/11/2026)

- Banco local tinha somente admin@banco.com e operador@banco.com. demo:prepare criou o leitor ausente sem alterar os cadastros existentes; não houve seed/reset.
- Chrome confirmou entrada como Carlos Leitor/VIEWER, com formulário de cadastro e atalhos administrativos ausentes. A navegação abaixo do título foi inspecionada com dois atalhos separados, sem links concatenados.
- 333 testes aprovados em 19 arquivos; lint, tipos e build `npm run build -- --webpack` aprovados com Node 22.
- Novos testes verificam preparação idempotente/preservação de nome/perfil/situação, bloqueio com autenticação real e mensagens de falha no seletor. Sem nova migração ou alteração do .env.
