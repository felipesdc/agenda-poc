# Testes automatizados

A suíte usa Vitest, React Testing Library, user-event e JSDOM. A configuração está em `vitest.config.mts`, com alias `@/`, JSX automático e fuso `America/Sao_Paulo` para resultados reproduzíveis nas regras de prazo. As interações seguem os papéis e rótulos acessíveis dos componentes, conforme o uso da [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

## Preparação e execução

Após seguir a instalação do README e gerar o cliente Prisma:

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:ui
npm run test:watch
```

`npm test` executa tudo uma vez. O modo watch reexecuta os testes afetados durante o desenvolvimento. `npx tsc --noEmit` e `npm run lint` continuam sendo verificações separadas.

## Cobertura funcional

| Arquivo | O que verifica |
| --- | --- |
| `tests/theme-ui.test.tsx` | Tema do sistema, persistência local, escolha explícita e acompanhamento de mudanças do sistema |
| `tests/task-list-page.test.tsx` | Formulário GET acessível, valores de filtros, paginação e avisos de intervalo/ponto focal indisponível |
| `tests/task-list-params.test.ts` | Normalização, limites, estado desconhecido, vencidas, páginas inválidas, parâmetros duplicados e URLs de paginação |
| `tests/task-input.test.ts` | Frequência padrão, todas as frequências oferecidas, deduplicação de pontos focais, título sem espaços nas extremidades, datas inexistentes, matrícula inválida e arquivos em campos de texto |
| `tests/archive-input.test.ts` | Motivo obrigatório, limites de tamanho, espaços e tipos inválidos |
| `tests/calendar-params.test.ts` | Mês zero, ano limitado, parâmetros vazios/malformados/duplicados e fallback seguro |
| `tests/auth-settings.test.ts` | Segredo, URL, HTTPS em produção e indisponibilidade segura sem configuração |
| `tests/password-auth.test.ts` | Biblioteca e SQLite reais: login, logout, expiração, cookie inválido, revogação, perfil/unidade atuais, cadastro fechado, origem e rate limit |
| `tests/auth-ui.test.tsx` | Campos de login, mensagens genéricas, limites de tentativas, erro de conexão, envio único e logout |
| `tests/frequency.test.ts` | Sete recorrências automáticas, NONE/EVENTUAL, final de mês, ano bissexto, passagem de ano e preservação da data original |
| `tests/task-status.test.ts` | Pendências vencidas, hoje, limites de 15/16 dias, prioridade de concluída/validada, mudança de ano e preservação da data recebida |
| `tests/task-actions.test.ts` | Cadastro, edição, troca/remoção de pontos focais, histórico, arquivamento e restauração sem perda de histórico, conclusão, validação pelo gestor, geração da sucessora, tarefas inexistentes, sessão ausente/inválida, troca de perfil, permissões, isolamento, transições, validação concorrente e rollback de auditoria |
| `tests/user-management-ui.test.tsx` | Situação da senha, bloqueio do próprio rebaixamento, preservação após erro, limpeza após sucesso e falha de conexão |
| `tests/task-ui.test.tsx` | Envio e limpeza do cadastro, preservação dos campos após falha, erros de transporte e negócio, nova tentativa, edição, histórico, confirmação/cancelamento do arquivamento e restauração, bloqueio de ações concorrentes e botões conforme perfil/unidade/estado |
| `tests/calendar-ui.test.tsx` | Janeiro com month=0, período atual, navegação mensal/anual, passagem de ano, alternância de visão, abertura/fechamento de detalhes, doze meses, indicadores e seletor de demonstração |

Resultado após o incremento 18, em 07/11/2026: **333 testes aprovados em 19 arquivos**, sem casos `todo`.

## Banco isolado

A integração cria um diretório exclusivo com `mkdtemp` e um SQLite novo a cada execução. A URL temporária é definida antes de importar a aplicação; a variável de ambiente original é restaurada ao finalizar. Nenhum comando de reset é aplicado ao banco do projeto.

Os SQLs versionados de `prisma/migrations` são aplicados em ordem. O executor usa marcadores `-- statement-breakpoint` nas migrações novas que contêm triggers, preservando ponto e vírgula interno; as migrações antigas continuam divididas por ponto e vírgula. Essa preparação valida o comportamento sobre o esquema versionado, mas não testa a CLI do Prisma nem sua tabela de controle de migrações.

As consultas Prisma e a auditoria são reais. As fronteiras `next/headers` e `next/cache` são substituídas para fornecer cookies e observar a revalidação sem iniciar o servidor Next. O construtor Prisma é envolvido apenas para rastrear e desconectar os clientes reais no fim da suíte. A auditoria agora usa o mesmo cliente transacional das ações. As tarefas são removidas entre os casos; o banco temporário é removido ao concluir.

O cliente Prisma precisa ter sido gerado para a plataforma local. Se o motor não for encontrado, reexecute `npx prisma generate` antes dos testes de integração.

## Interface e limites

Os componentes são renderizados no JSDOM com suas ações de servidor simuladas. Assim, os testes verificam entrada de dados, estados de processamento, mensagens e chamadas das ações. Eles não substituem testes de navegador real, layout, foco, comportamento de cookies HTTP ou o transporte de Server Actions do Next.

Foi encontrada e corrigida uma regressão em `TaskFields`: o reset nativo do formulário restaurava a periodicidade e as caixas de pontos focais após uma falha. Os defaults nativos agora acompanham a escolha atual; a limpeza após sucesso continua sendo feita pelo remount do formulário. A suíte protege esse comportamento no cadastro e na edição.

As setas agora têm nomes acessíveis. Os testes de navegação verificam o conteúdo dos parâmetros sem depender da ordem de serialização da URL e confirmam o bloqueio nos anos-limite.

## Controles do incremento 2

Os cinco `todo` anteriores foram substituídos por testes executáveis:

- VIEWER sem mutações e consultas/alterações de tarefas isoladas por unidade, inclusive chamadas diretas por ID.
- Dados enviados pelo formulário não escolhem unidade, criador, estado ou tarefa de origem.
- Edição/conclusão exigem PENDING e validação exige COMPLETED.
- Validação sequencial e simultânea gera uma única sucessora, com pontos focais; uma segunda inserção com a mesma origem também falha pela restrição do banco.
- Triggers temporárias do SQLite provocam falhas na auditoria de criação, edição, conclusão, validação e criação da sucessora. Os testes comparam tarefas, vínculos e histórico antes/depois e exigem rollback completo.
- No modo de demonstração, `DEMO_MODE=false` bloqueia sessão e troca de usuário. Produção sempre bloqueia a sessão simulada. O incremento 4 adiciona a sessão real por senha, independente desse cookie antigo.

Política de lotação dos funcionários, recuperação de senha por e-mail, MFA e testes em navegador real continuam fora do escopo entregue. O teste de concorrência usa requisições simultâneas no mesmo processo com SQLite real; a restrição única no banco fornece a garantia adicional entre processos.


## Controles do incremento 3

A integração verifica preservação de dados, autor/data/motivo, restauração de cada estado, histórico permanente, proibição de mutações arquivadas, consultas por unidade em todos os períodos e ausência de exclusão física na API. Testes simultâneos exigem uma única gravação de ARCHIVE/RESTORE. Triggers SQLite também provocam falhas nessas duas ações para confirmar rollback de metadados e histórico.

Na interface, os testes verificam abertura e cancelamento do formulário de motivo, campos obrigatórios, erros e nova tentativa, bloqueio durante o processamento, permissões da restauração e navegação entre ativas/arquivadas preservando o período.


## Controles do incremento 4

Os testes de autenticação usam Better Auth e Prisma reais, com um SQLite novo por execução. Só os headers do contexto Next e o acesso ao cliente dessa base são adaptados para testar `getCurrentUser`; hashing, assinatura do cookie, persistência, consulta da sessão e revogação não são simulados. Os testes de configuração e componentes usam ambientes isolados, sem segredos de usuários reais.

Foram testados também provisionamento por stdin e o fluxo HTTP contra o servidor Next: tela de login, emissão de cookie, acesso autenticado, redirecionamento de usuário já autenticado e logout. Isso complementa JSDOM e handler direto, sem substituir uma revisão em navegador real.

A verificação foi executada com Node 22.23.4. O mínimo do projeto passou a ser Node 20.19 por compatibilidade com as dependências de autenticação.

## Gestão administrativa

A suíte de integração de ações também verifica cadastro de usuário, normalização/duplicação de e-mail, rejeição de campos inválidos, consultas e mutações restritas ao gestor e à sua unidade, impossibilidade de rebaixar a si próprio, sincronização da identidade e revogação de sessões. Uma trigger de falha na exclusão de sessão comprova rollback do nome e do perfil. O banco local não é usado.

## Auditoria administrativa

Testes adicionais verificam autoria e snapshots no cadastro/edição, preservação após alteração do diretório, operação sem mudanças sem revogação, isolamento/permissões de consulta e limite de 100 eventos. Uma trigger recusa INSERT em UserAudit e comprova rollback de cadastro, perfil, identidade e revogação de sessões.

## Contas ativas/desativadas

Integração verifica revogação de sessões, preservação de hash, transições repetidas, restrição de perfil/unidade, autodesativação, bloqueio por cookie demo antigo e rollback com falha na auditoria. O handler real Better Auth é exercitado contra SQLite: conta desativada não cria sessão; reativação aceita novo login; conta desativada não acessa ações mesmo com sessão preexistente. Componentes verificam confirmação/cancelamento, ausência de autodesativação e nova tentativa após falha.

## Visão anual interativa

Os testes do calendário exercitam múltiplas tarefas no dia, abertura/fechamento do modal compartilhado e consulta do histórico. Verificam edição com falha seguida de sucesso preservando os campos, leitura sem edição para visualizador, validação pelo gestor, lista atualizada após mudança de prazo e exclusão de tarefas de outro ano. A navegação para o mês usa o mês/ano do cartão.

## Quadros de prazo

Sete casos novos exercitam abertura de detalhes/histórico em cada faixa, edição pelo modal, consulta por visualizador, atualização da lista após conclusão, exclusão de arquivadas/concluídas/validadas, teclado, alternância e fechamento da lista. Os componentes reais são renderizados no JSDOM com as ações simuladas.

## Lista com busca e filtros

Ações de integração também consultam a lista com SQLite real, verificando todos os períodos, título/descrição, combinação com estado, vencidas antigas sem incluir hoje/finalizadas, exclusão de arquivadas, isolamento de unidade, anônimos, histórico e diretório restrito para visualizador. Paginação usa 26 registros com mesmo prazo para verificar divisão e ordenação estável. A interface exercita detalhes/histórico, edição, leitura pelo visualizador e remoção de detalhes quando a tarefa deixa os resultados.

## Tema e modal acessível

Três testes de tema verificam preferência do sistema, persistência e escolha explícita, além de retorno ao modo Sistema. Dois testes do modal verificam papel/nome de diálogo, Escape, contenção de foco e restauração de foco/rolagem. A verificação visual no Chrome incluiu temas claro e escuro, detalhes e campos de edição; não substitui auditoria completa de acessibilidade ou inspeção em dispositivos móveis.

## Evolução da acessibilidade

Sete novos casos verificam seleção/foco/painel nas abas pelo teclado, preservação de rascunho ao consultar histórico, foco após erro de campo, Hoje nas visões mensal/anual, marcação de data atual e preferência de tema com armazenamento bloqueado. Testes existentes foram ajustados para os papéis semânticos de abas.

## Filtros de ponto focal e prazo

Doze casos adicionais de parâmetros verificam datas civis/bissextas, Int32, intervalos invertidos, duplicação e preservação de todos os filtros na paginação. Cinco casos de consulta com SQLite real cobrem limites completos dos dias, intervalos abertos, combinação dos filtros, entradas inválidas sem ampliação e opções por unidade/perfil. Três casos da página verificam formulário GET, nomes acessíveis, valores, reinício da paginação e avisos sem expor cadastros externos.

## Fila de validação

Seis casos novos de integração verificam bloqueio de anônimos/operador/visualizador, escopo por unidade/estado/arquivamento, datas legadas, ordenação, busca, paginação e saída após validação com geração única da sucessora. Dois casos de interface exercitam data de conclusão, registro legado, falha mantendo modal aberto, nova tentativa e lista vazia após revalidação.

## Busca sem acentos

Sete casos novos verificam normalização de português/latim comum, formas decompostas, idempotência e divisão segura da migração com trigger. Quatro casos de integração exercitam título/descrição, manutenção por edição direta, recorrência e consulta da fila com permissões. O texto original é conferido separadamente do auxiliar. O backfill local foi comparado ao normalizador da aplicação para todas as tarefas preexistentes.

## Backup e restauração

Seis testes com SQLite temporário verificam resolução de caminhos, backup de dados WAL, preservação de histórico/triggers, revogação de sessões apenas na cópia restaurada, permissões do arquivo, recusa de sobrescrita/origem inválida e migração incompleta. O exercício da CLI também cria e restaura um backup do banco local em arquivo temporário, sem alterar o DATABASE_URL ativo.

## CSV

Onze testes do serializador verificam BOM/cabeçalho, acentos, delimitadores/aspas/quebras, rótulos e prefixos de fórmula/controles. Sete casos de integração exercitam o handler HTTP real com SQLite: autenticação, três perfis, isolamento de unidade, filtros, arquivadas, todas as páginas e limite. Dois casos de UI verificam download/liberação de URL e mensagem de erro permitindo nova tentativa.

## Correção do modo demo

Três casos de integração verificam preparação idempotente e não destrutiva, entrada como Carlos, bloqueio quando há segredo real e mensagens para perfil ausente/desativado. Um caso de interface verifica retorno de erro ao selecionar Carlos. No Chrome, Carlos foi selecionado e a interface exibiu Carlos Leitor/VIEWER, sem cadastro de tarefas ou atalhos administrativos.

### Meu dia e duplicação — 09/11/2026

Suíte: **343 testes em 20 arquivos**. `my-day-page.test.tsx` cobre filtro acessível, grupos, contadores, estados vazios, consulta completa, parâmetros inválidos e ausência de sessão. A integração com SQLite em `task-actions.test.ts` verifica limites de dias na virada do ano, exclusão de tarefas finalizadas/arquivadas e de outras unidades, filtro por ponto focal, limite de 25 com total real e acesso de visualizadores. `task-ui.test.tsx` cobre duplicação de tarefa finalizada, dados preenchidos, prazo obrigatório, falha recuperável, cancelamento e permissões. O cadastro existente continua responsável pela autorização e auditoria da cópia.

Validação automatizada: lint, TypeScript e build de produção com webpack. Testes de interface usam JSDOM; esta entrega não incluiu inspeção visual em navegador real.

### Filtros favoritos — 09/11/2026

Suíte: **359 testes em 22 arquivos**. `saved-task-filters.test.ts` verifica preservação dos filtros, remoção da paginação, destinos locais, descarte de dados inválidos, nomes duplicados, limite e chaves separadas por usuário/unidade. `saved-filters-ui.test.tsx` verifica salvar, remontar, reaplicar por link e remover; separação de perfis/unidades; falha de armazenamento com nova tentativa; mudanças entre abas e bloqueio de filtros inválidos.

Verificações: lint, TypeScript e build de produção com webpack. A interface foi testada em JSDOM; sem inspeção visual em navegador real nesta entrega.

### Comentários nas tarefas — 09/11/2026

Suíte: **369 testes em 23 arquivos**. A integração com SQLite em `task-actions.test.ts` cobre autoria, persistência independente da auditoria, limites de texto, permissões de publicação/leitura, isolamento por unidade, tarefa inexistente, ausência de sessão, arquivamento, recorrência e paginação estável. `task-comments-ui.test.tsx` cobre carregamento sob demanda, apresentação segura de texto/autor/data, publicação com atualização, falha preservando rascunho, bloqueio de envio repetido enquanto aguarda o servidor, leitura sem formulário, nova tentativa e navegação entre páginas.

Verificações: lint, TypeScript, build com webpack e `db:check` sem diferenças. Migração local aplicada após backup verificado; os testes usam bancos temporários. Interface verificada com JSDOM, sem inspeção visual em navegador real nesta entrega.

### Central de pendências — 09/11/2026

Suíte: **378 testes em 24 arquivos**. A integração SQLite em `task-actions.test.ts` cobre categorias sem sobreposição, limites civis na virada do ano, exclusão de outras unidades e tarefas arquivadas/validadas, contagens por perfil, bloqueio da categoria de validação, ausência de sessão, paginação estável e atualização após conclusão/arquivamento. `pending-center-page.test.tsx` cobre navegação por categoria, contadores, paginação, vazio, acesso restrito, ausência de sessão, normalização dos parâmetros e atualização manual.

Verificações: lint, TypeScript, build de produção com webpack e `git diff --check`. Testes de interface em JSDOM; sem inspeção visual em navegador real nesta entrega. Nenhuma migração de banco.
