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
