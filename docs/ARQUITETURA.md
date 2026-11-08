# Arquitetura e comportamento atual

## Fluxo da aplicação

1. `src/app/page.tsx` resolve período e visão a partir da URL.
2. `src/lib/tasks.ts` identifica o usuário e carrega apenas tarefas da sua unidade no período, com histórico e pontos focais. Sem sessão, não consulta tarefas nem funcionários.
3. Os componentes apresentam indicadores, calendário e modal. Cadastro aparece para operadores e gestores; botões de edição, conclusão, validação, arquivamento e restauração seguem as permissões de `src/lib/permissions.ts`.
4. `src/actions.ts` revalida perfil, unidade e estado no servidor, independentemente dos botões apresentados. Cadastro e edição usam o schema compartilhado de `src/lib/task-input.ts`.
5. Criação, edição, conclusão, validação, arquivamento e restauração gravam tarefa, vínculos e auditoria na mesma transação. `src/lib/audit.ts` recebe o cliente da transação e propaga falhas.

Não há API REST dedicada. A página e as ações usam o singleton de `src/lib/prisma.ts`. Operações retornam mensagem e sucesso/erro; o modal fecha apenas com sucesso e impede ações simultâneas. Os campos preservam as entradas após falha.

## Modelo de dados

| Entidade | Responsabilidade |
| --- | --- |
| `Unit` | Unidade com código único; reúne usuários e tarefas |
| `User` | Nome, e-mail único, perfil e uma unidade; cria tarefas e registra ações |
| `Task` | Prazo, estado, frequência, ciclo de vida e pontos focais; pertence à unidade e ao criador |
| `Employee` | Cadastro global de funcionários, sem unidade; pontos focais podem existir sem acesso ao sistema |
| `TaskHistory` | Ação, detalhe, data, tarefa e autor; inclui ARCHIVE/RESTORE e permanece acessível no arquivo |

`Task.sourceTaskId` é opcional e único: referencia a ocorrência de origem e permite no máximo uma sucessora por tarefa. Migrações preservam registros anteriores com esse campo nulo; não tentam inferir vínculos históricos. Excluir uma origem mantém sua sucessora, com `sourceTaskId` nulo (`ON DELETE SET NULL`). Índices cobrem unidade/prazo e tarefa/data do histórico.

`User` e `Employee` são cadastros distintos, sem vínculo explícito. `UrgencyLevel` está declarado, mas não é usado.

## Permissões e ciclo de vida

| Operação na própria unidade | VIEWER | OPERATOR | ADMIN |
| --- | --- | --- | --- |
| Consultar tarefas e histórico | Sim | Sim | Sim |
| Criar tarefa | Não | Sim | Sim |
| Editar ou concluir pendência | Não | Sim | Sim |
| Validar conclusão | Não | Não | Sim |
| Arquivar ou restaurar tarefa | Não | Não | Sim |

As mutações por ID incluem a unidade do usuário nas condições do banco. IDs de outra unidade são tratados como indisponíveis, sem revelar os dados. Campos de formulário não escolhem unidade, criador, estado ou origem da recorrência.

O fluxo é `PENDING → COMPLETED → VALIDATED`. Edição e conclusão exigem `PENDING`; validação exige `COMPLETED`. Todas exigem tarefa ativa (`archivedAt=null`). Não há reabertura. Conclusão registra `completedAt`; validação registra `validatedAt`. O gestor pode validar a própria conclusão, mantendo o comportamento anterior.

O cadastro `Employee` continua global porque ainda não há uma política de lotação. Operadores/gestores recebem esse diretório para escolher pontos focais; visualizadores recebem apenas os pontos focais já vinculados às tarefas da sua unidade, sem o diretório completo.

## Recorrência e atomicidade

A validação começa por uma atualização condicional de `COMPLETED` para `VALIDATED`. Só a requisição que altera um registro prossegue com a auditoria e a sucessora. A origem única também protege o banco contra duplicação. Validações repetidas retornam falha sem novas gravações.

A sucessora preserva título, descrição, unidade, frequência e pontos focais, nasce `PENDING` e é atribuída ao gestor que a gerou. Sua data parte do prazo da ocorrência atual. Não há geração antecipada, dias úteis ou política para recuperar atrasos/preservar o dia original após meses curtos.

O controle condicional e o histórico ficam dentro da [transação interativa do Prisma 6](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions). Uma falha em qualquer gravação, inclusive no histórico da sucessora, desfaz a operação inteira. Edições registram antes/depois de título, descrição, prazo, frequência e IDs dos pontos focais.

## Datas e cores

Os formulários aceitam datas civis válidas em `YYYY-MM-DD`; a persistência acrescenta `T12:00:00Z`. Filtros e classificação usam o fuso do processo/navegador. Unificar essa política de fuso ainda é uma evolução pendente.

Cores: vermelho para pendências anteriores a hoje, amarelo até 15 dias, verde além disso, azul para concluídas e cinza para validadas. Indicadores contam apenas pendências no período consultado. As visões mensal e anual compartilham a prioridade de cores; as marcações anuais incluem rótulos acessíveis. `calendar-params.ts` normaliza os mesmos parâmetros no servidor e no cliente: mês 0–11, ano 1900–2100 e fallback para o período atual em entradas inválidas ou repetidas. A navegação respeita os limites e preserva filtros adicionais da URL.

## Autenticação e sessões

`src/lib/auth-config.ts` configura Better Auth com adaptador Prisma, login por e-mail/senha, cadastro público fechado, cookies e sessões armazenadas no banco. `src/lib/password-auth.ts` valida o segredo e a origem antes de inicializar a instância; produção exige HTTPS. A rota `/api/auth/[...all]` entrega as operações HTTP sem cache; `/login` é dinâmica para ler a configuração em runtime.

O diretório `User` mantém perfil/unidade. `AuthUser` referencia o mesmo ID e guarda a identidade; `AuthAccount` guarda o hash da senha e `AuthSession` guarda as sessões. `AuthVerification` atende ao esquema do provedor, e `AuthRateLimit` persiste contadores de tentativas. O comando administrativo usa a criptografia do Better Auth para provisionar a senha de um usuário existente e revoga todas as sessões anteriores.

`getCurrentUser` verifica a sessão real e carrega o `User` atual para autorizar cada requisição. Não confia no cookie antigo `userId` quando um segredo de autenticação está configurado. O modo demonstração só funciona fora de produção, com `DEMO_MODE=true` e segredo vazio.

A interface de login normaliza o e-mail, preserva a senha informada sem trim, mostra falhas genéricas e bloqueia envios simultâneos. O botão Sair só redireciona após a revogação pela API. Não há cadastro público ou recuperação por e-mail; redefinição de senha é administrativa. Detalhes de cookies, rate limit e operação em [AUTENTICACAO.md](AUTENTICACAO.md).

A aplicação não expõe mais `deleteTask` nem outra operação de exclusão física. O relacionamento de histórico continua com cascata no banco para manutenção administrativa, mas nenhuma Server Action usa esse caminho.

## Arquivamento e restauração

`Task.archivedAt`, `archivedById` e `archiveReason` registram o último arquivamento ativo. O motivo deve ter de 3 a 500 caracteres após remover espaços nas extremidades. Somente ADMIN da própria unidade pode arquivar/restaurar. Essas ações usam escrita condicional e registram `ARCHIVE`/`RESTORE` na mesma transação; chamadas duplicadas não repetem a auditoria.

O arquivamento mantém prazo, estado, autor original, pontos focais e vínculo de recorrência. Tarefas arquivadas não podem ser editadas, concluídas ou validadas. Arquivar uma ocorrência não afeta sua sucessora ou outras ocorrências.

A restauração limpa os três campos de arquivamento ativo e mantém o histórico permanente, incluindo motivos e autores dos ciclos anteriores. Não altera o estado nem recalcula prazos, não gera recorrências e pode devolver uma pendência já vencida à agenda.

A agenda e seus indicadores consultam somente tarefas ativas do período selecionado. A visão `?archived=true` consulta todas as arquivadas da unidade, ordenadas pelo arquivamento mais recente, sem filtro de prazo. O seletor preserva o período da agenda para o retorno. O diretório de funcionários não é carregado no arquivo. Operadores e visualizadores podem consultar os detalhes e histórico, mas só gestores recebem a ação de restaurar.

A migração de arquivamento é aditiva: tarefas existentes permanecem ativas, com novos campos nulos.

## Administração de usuários

`/usuarios` usa `getManagedUsers` para restringir a consulta ao gestor da unidade. Apenas id, nome, e-mail, perfil e presença de senha são enviados ao cliente; contas, hashes e tokens não são serializados. `src/user-actions.ts` autentica a sessão e reconsulta o gestor dentro da transação, define a unidade de novos registros pelo servidor e limita a edição à unidade atual.

A edição altera nome/perfil, sincroniza o nome da identidade e revoga sessões na mesma transação. E-mail/unidade são imutáveis nesta interface; o próprio gestor não pode se rebaixar. O provisionamento de credenciais permanece administrativo pelo terminal. A desativação está disponível; não há exclusão nesta interface.

### Auditoria de cadastros

`UserAudit` armazena snapshots de autor (id/nome), destinatário (id/e-mail), unidade, ação, data e nome/perfil antes/depois. IDs são referências históricas sem foreign keys para evitar apagamento em cascata ou impedir a retenção de evidências após mudanças externas no diretório. A tabela possui índice por unidade/data; consultas usam a unidade da sessão e retornam no máximo 100 eventos recentes.

Cadastro/edição gravam o evento pelo mesmo cliente transacional. Operações sem mudanças não alteram identidade/sessões e não geram evento. O histórico não contém credenciais. Apenas ações administrativas da interface são cobertas; provisionamento CLI, seed e alterações externas não geram eventos. Não é um mecanismo de proteção contra acesso direto ao arquivo SQLite.

### Situação das contas

`User.isActive` tem padrão true. `getCurrentUser` exige conta ativa na leitura do perfil para sessões reais e demo; a seleção demo também recusa conta desativada. A criação de sessão Better Auth usa um database hook que exige perfil ativo. A referência oficial dos [database hooks](https://better-auth.com/docs/1.6/concepts/database) descreve a interrupção da operação com APIError.

`setManagedUserActive` valida gestor ativo dentro da transação, recusa a própria conta e limita o alvo à unidade da sessão. Uma atualização condicional recusa transições repetidas. Situação, revogação de sessões e evento DEACTIVATE/REACTIVATE são atômicos. Auditoria inclui activeBefore/activeAfter; eventos anteriores mantêm esses campos nulos. Reativação não altera hash de senha e revoga também eventuais sessões remanescentes. Provisionamento CLI não altera isActive.

## Interação anual

YearView recebe TaskWithHistory[], usuário e diretório de funcionários com o mesmo escopo da visão mensal. Agrupa tarefas por data civil e ano, mantém a seleção do dia e o id da tarefa, e deriva o objeto selecionado das props atuais. Renderiza o TaskModal compartilhado para preservar regras e comportamento. A página reinicia a seleção ao mudar de ano por meio da key. A lista de um dia é derivada novamente após revalidação, sem snapshot desatualizado de prazo/título.

## Quadros de prazo interativos

StatusCards recebe tarefas com histórico, usuário e funcionários do mesmo fluxo de consulta da agenda. Agrupa apenas pendências ativas por prazo e mantém somente a faixa expandida e o id selecionado como estado. A tarefa do modal e as listas são derivadas das props atuais, acompanhando revalidações. Usa o TaskModal compartilhado; as ações mantêm as verificações existentes de perfil/unidade no servidor. Os quadros descrevem o período da agenda e não consultam pendências fora dele.

## Lista de tarefas

`/tarefas` normaliza parâmetros com `resolveTaskListParams` e consulta `getTaskListData`. Busca e estado são aplicados no Prisma, sempre com unitId da sessão e archivedAt=null. A opção overdue define status PENDING e dueDate anterior ao início do dia, seguindo a mesma data civil local das regras do calendário. Não há dependência dos parâmetros de mês/ano.

A contagem define a paginação de 25 resultados; páginas fora do intervalo são ajustadas para a última disponível. A ordenação por dueDate/id evita empates instáveis. Histórico e pontos focais acompanham apenas as tarefas da página; o diretório para edição só é carregado para operador/gestor. Anônimos não recebem dados. TaskList mantém o id selecionado e deriva o modal das props atuais. Formulário GET mantém filtros na URL e reinicia a página a cada aplicação. A busca segue as limitações de contains/SQLite para acentos.

## Temas e camada visual

`globals.css` define tokens de fundo, superfície, texto e escala neutra para os dois temas, utilizados pelo Tailwind via `@theme inline`. Superfícies usam bg-surface e ações sólidas preservam text-white. A variante dark segue data-theme no elemento html; cores de estado possuem variantes de fundo/texto adequadas ao tema.

O script inicial em layout escolhe a preferência local ou o sistema antes da hidratação. ThemeSelect usa useSyncExternalStore para sincronizar a preferência entre instâncias/abas e escuta mudanças do sistema. A preferência não é uma configuração de conta. AppHeader mantém navegação e seletor em todas as páginas.

TaskModal usa diálogo nomeado e efeito de ciclo de vida para foco/rolagem. O listener de teclado consulta as ações disponíveis ao tabular e useEffectEvent observa o estado atual de operação ao tratar Escape. As regras de negócio e autorização permanecem nas ações existentes.

### Abas, foco e tema temporário

TaskModal mantém os dois painéis montados e oculta o inativo via hidden, preservando o estado dos campos enquanto se consulta o histórico. As abas implementam tablist/tab/tabpanel, seleção e roving tabindex com setas/Home/End. A contenção de foco filtra controles em painéis ocultos e tabindex negativo. A edição foca título e o cancelamento restaura o botão Editar. TaskFields leva o foco ao primeiro aria-invalid após erro.

ThemeSelect mantém uma preferência temporária em estado local quando localStorage recusa a gravação; a preferência explícita continua prevalecendo sobre alterações do tema do sistema durante a sessão.
