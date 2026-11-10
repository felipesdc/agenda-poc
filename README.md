# Agenda POC

Prova de conceito de uma agenda de tarefas por unidade, com prazos, pontos focais, conclusão por operador e validação por gestor. A interface está em português.

## Funcionalidades atuais

- Calendários mensal e anual, com navegação por período na URL.
- Cadastro e edição de tarefas; arquivamento e restauração pelo gestor, com histórico preservado.
- Indicadores de tarefas vencidas, com vencimento em até 15 dias e no prazo, limitados ao período selecionado.
- Conclusão e validação, com histórico de ações.
- Periodicidades semanal, quinzenal (14 dias), mensal, bimestral, trimestral, semestral e anual. A próxima ocorrência nasce ao validar a atual; `NONE` e `EVENTUAL` não geram ocorrências.
- Associação de funcionários como pontos focais no cadastro e na edição.
- Permissões por perfil/unidade, transações com auditoria e recorrência sem duplicação.
- Login por e-mail e senha, sessões verificadas no servidor, logout e provisionamento administrativo.
- Troca de usuário de demonstração entre gestor, operador e visualizador, sem autenticação real configurada.
- Meu dia, central de pendências, resumo mensal e fila de validação.
- Busca, filtros, favoritos sincronizados por conta e exportação CSV.
- Comentários, etapas, duplicação, planejamento anual e substituição de ponto focal em lote.
- Administração de usuários, vínculo com ponto focal, auditoria e backup/restauração SQLite.

**Estado:** prova de conceito com login real por senha e permissões por perfil/unidade. O cadastro público é fechado. O modo demonstração continua disponível apenas fora de produção e sem segredo de autenticação configurado. Veja a [configuração de autenticação](docs/AUTENTICACAO.md) antes de iniciar um piloto.

## Tecnologias

Next.js 16.0.7 (App Router), React 19.2, TypeScript, Tailwind CSS 4, Prisma 6, SQLite, Better Auth, Zod e date-fns. As versões exatas estão no `package-lock.json`.

## Executar localmente

Pré-requisitos: Node.js 20.19 ou superior e npm. Recomendado Node 22, indicado em `.nvmrc`.

```bash
npm ci
cp .env.example .env
npm run db:prepare
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Para login por senha, configure `BETTER_AUTH_URL` e um `BETTER_AUTH_SECRET` gerado no `.env`, depois provisione um acesso:

```bash
npm run auth:provision -- --email admin@banco.com
npm run dev
```

Abra http://localhost:3000/login. O comando pede uma senha de 12 a 128 caracteres, sem exibi-la. O passo a passo, incluindo redefinição e revogação de sessões, está em [AUTENTICACAO.md](docs/AUTENTICACAO.md).

Para a demonstração local sem senha, mantenha `BETTER_AUTH_SECRET` vazio e use `DEMO_MODE=true`. Em instalações antigas, execute `npm run demo:prepare` para criar apenas os perfis faltantes, sem redefinir os existentes. Os perfis disponíveis são:

| Perfil de demonstração | E-mail |
| --- | --- |
| Alice, gestora (`ADMIN`) | admin@banco.com |
| Bob, operador (`OPERATOR`) | operador@banco.com |
| Carlos, visualizador (`VIEWER`) | leitor@banco.com |

O seed cria a unidade `U001`, três usuários e três funcionários fictícios; não cria tarefas. **Use-o apenas para preparar dados fictícios**: ao executá-lo novamente, ele redefine os perfis dos três usuários demo para seus valores originais. Para criar somente perfis demo ausentes sem alterar os existentes, use `npm run demo:prepare` nas condições descritas acima. No cadastro, selecione a periodicidade e os pontos focais; o padrão é sem repetição.

`DATABASE_URL="file:./dev.db"` usa o arquivo `prisma/dev.db`. O repositório já contém esse banco versionado: faça uma cópia antes de aplicar migrações se houver dados que deseja preservar. Para conferir a situação, execute `npx prisma migrate status`. Não use `migrate reset` para preparar um banco com dados importantes.

## Atualizar uma instalação existente

Os incrementos incluem migrações aditivas para o ciclo de vida, autenticação, comentários, trabalho pessoal e planejamento. Preserve o `.env`, pare o servidor e faça backup do banco configurado antes de atualizar:

```bash
npm run db:backup
npm run db:prepare
npm run db:status
npm run db:check
```

Reinicie o servidor após gerar o cliente Prisma. O preparo não executa o seed; evite executá-lo em bancos existentes porque ele redefine os perfis demo. Configure o login conforme [AUTENTICACAO.md](docs/AUTENTICACAO.md). Para demonstração local sem segredo, use `DEMO_MODE=true`; essa flag não habilita a sessão simulada em produção. Vínculos de recorrência anteriores à migração não são inferidos.

## Arquivar e restaurar

Como gestor, abra uma tarefa, clique em **Arquivar tarefa**, informe o motivo (3 a 500 caracteres) e confirme. A tarefa sai da agenda e dos indicadores ativos, mantendo histórico, pontos focais e vínculos de recorrência.

A opção **Arquivadas** mostra todos os períodos da sua unidade. Abra uma tarefa para consultar autor, data, motivo e histórico. O gestor pode usar **Restaurar tarefa** para trazê-la de volta, com prazo e estado originais. O arquivamento de uma ocorrência não arquiva as outras da mesma recorrência.

Operadores e visualizadores consultam o arquivo da própria unidade; arquivar e restaurar são ações exclusivas do gestor. A aplicação não oferece mais exclusão definitiva.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run db:backup` | Cria e verifica um snapshot SQLite em backups/ |
| `npm run db:restore -- --source backup.db --output novo.db` | Restaura em arquivo novo e revoga sessões da cópia |
| `npm run db:prepare` | Gera cliente Prisma e aplica migrações pendentes, sem reset ou seed |
| `npm run db:status` | Confere migrações pendentes |
| `npm run db:check` | Compara o banco configurado com o schema, falhando se houver diferenças |
| `npm run typecheck` | Verificação de tipos |
| `npm run auth:provision -- --email usuario@dominio.com` | Provisionar ou redefinir senha de usuário existente |
| `npm run demo:prepare` | Criar apenas perfis demo ausentes sem alterar os existentes |
| `npm run lint` | Análise estática com ESLint |
| `npm test` | Toda a suíte: regras, integração com SQLite e componentes |
| `npm run test:unit` | Validação, recorrência e classificação por prazo |
| `npm run test:integration` | Server Actions com banco temporário |
| `npm run test:ui` | Formulários, modal, calendário e navegação |
| `npm run test:watch` | Testes em modo de desenvolvimento |
| `npx tsc --noEmit` | Verificação de tipos, após gerar o cliente Prisma |
| `npm run build` | Build de produção |
| `npm start` | Executa o build já gerado |
| `npx prisma studio` | Inspeção e edição local do banco |
| `npx prisma migrate dev --name nome_da_mudanca` | Cria e aplica uma migração de desenvolvimento |

A suíte cobre validação, recorrências, classificação por prazo, CRUD e ciclo de vida com SQLite temporário, além de interações dos componentes. Veja os limites e os casos pendentes em [TESTES.md](docs/TESTES.md). O build usa fontes do Google via `next/font` e pode precisar de acesso à rede. Os comandos acima descrevem o fluxo de preparação; veja os resultados efetivamente verificados em [VALIDACAO.md](docs/VALIDACAO.md).

## Documentação

- [Guia de funcionalidades e permissões](docs/GUIA.md)
- [Backup e recuperação](docs/OPERACAO.md)
- [Login, provisionamento e sessões](docs/AUTENTICACAO.md)
- [Arquitetura, entidades e regras atuais](docs/ARQUITETURA.md)
- [Melhorias priorizadas e critérios de aceite](docs/ROADMAP.md)
- [Testes: execução, cobertura e limites](docs/TESTES.md)
- [Registro das verificações](docs/VALIDACAO.md)

Licença: [MIT](LICENSE).

## Integração contínua

O workflow [CI](.github/workflows/ci.yml) executa em pull requests, pushes na `main` e acionamento manual. Usa Node da `.nvmrc`, `npm ci` e SQLite novo no diretório temporário do runner, sem acessar o banco local ou exigir segredos. Verifica aplicação das migrações, equivalência do banco com o schema, schema Prisma, lint, testes, build com Webpack e tipos. O build precisa de rede para baixar fontes do Google.

Antes de iniciar uma versão atualizada localmente, faça backup do banco e execute `npm run db:prepare`. O comando não redefine dados e não executa o seed. Se aparecer `P2022` indicando uma coluna ausente (por exemplo `Task.archivedAt`), pare o servidor, confira `npm run db:status`, prepare o banco e reinicie `npm run dev`. Confirme que o `DATABASE_URL` aponta para o banco esperado.

O workflow passa a executar após ser enviado ao GitHub. Para exigir seu sucesso antes do merge, configure o check **Qualidade e migrações** nas regras da branch. Referência: [GitHub Actions para Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

## Gestão de usuários

Entre como gestor e abra **Gerenciar usuários** na agenda (`/usuarios`). A tela lista somente os usuários da sua unidade, permite cadastrar nome/e-mail/perfil e editar nome/perfil. Novos usuários recebem automaticamente a unidade do gestor. E-mails são normalizados e não podem repetir cadastros existentes, inclusive de outra unidade.

E-mail e unidade não são editáveis neste incremento. Não há exclusão de usuários. O gestor não pode rebaixar o próprio perfil; pode ajustar outros gestores da unidade. Alterações sincronizam o nome da identidade de autenticação e revogam as sessões do usuário em uma única transação. No modo demo, a próxima ação usa o perfil atualizado.

O cadastro não cria senha padrão. O responsável pelo ambiente provisiona a senha com `npm run auth:provision -- --email email-do-usuario`, como descrito em [AUTENTICACAO.md](docs/AUTENTICACAO.md). A interface mostra se há senha cadastrada. Não execute novamente o seed para gerir perfis: ele pode restaurar os perfis dos usuários fictícios. Troca de e-mail/unidade fica para um próximo incremento.

### Auditoria administrativa

A tela de usuários mostra os últimos 100 cadastros/alterações da unidade, com autor, horário de Brasília e nome/perfil antes e depois. Apenas gestores consultam esse histórico. A gravação é atômica: falhas no histórico revertem cadastro, edição e revogação de sessões. Salvar sem mudanças não cria evento nem revoga sessões.

Os registros preservam os valores da época e não são apagados por alterações no diretório. Não existe edição/exclusão de histórico na aplicação. A auditoria começa na migração `20261107010000_user_audit`; não reconstrói eventos anteriores. Ela cobre as ações da interface, não alterações diretas no banco, seed ou provisionamento de senhas pelo terminal. Em outras instalações, faça backup e execute `npm run db:prepare` antes de iniciar esta versão.

### Desativar e reativar contas

Em **Gerenciar usuários**, escolha **Desativar conta** e confirme. A ação bloqueia novos logins e o uso de cookies existentes, tanto no login por senha quanto no modo demo. As sessões são revogadas, e tarefas, autoria, senha e histórico permanecem preservados. O gestor só pode agir na própria unidade e não pode desativar a si próprio.

Contas desativadas continuam na lista com a situação visível. **Reativar conta** permite novo login com a senha existente; sessões revogadas não voltam a funcionar. Se ainda não há senha, use o provisionamento administrativo. Redefinir senha pelo terminal não reativa a conta. As duas transições são auditadas e atômicas.

A migração `20261107020000_user_activation` mantém todas as contas existentes ativas. Em outras instalações, faça backup e rode `npm run db:prepare`. Após gerar o novo cliente Prisma, reinicie o servidor de desenvolvimento.

## Visão anual interativa

Na opção **Ano**, cada mês mostra a quantidade de tarefas. Selecione um dia marcado para abrir a lista completa daquele dia e clique no título de uma tarefa para abrir o mesmo modal da visão mensal. Detalhes, pontos focais, histórico, edição, conclusão, validação e arquivamento seguem as mesmas permissões. Visualizadores consultam detalhes e histórico, sem editar.

A lista mantém todas as tarefas do dia acessíveis por rolagem. Dias sem tarefas ficam desabilitados; os botões informam data e quantidade, e a lista mostra a situação por texto além da cor. **Abrir mês** leva ao mês/ano correspondente na visão mensal. Após alterações, a lista acompanha os dados revalidados, inclusive se uma tarefa mudar de prazo. Não há migração de banco para esta melhoria.

## Detalhes pelos quadros de prazo

Clique em **Vencidas / Críticas**, **Atenção (Próx 15 dias)** ou **No Prazo** para abrir as tarefas daquela faixa. A lista considera somente pendências ativas do período consultado, ordenadas pelo prazo. Clique em uma tarefa para abrir detalhes, histórico e ações permitidas ao seu perfil, pelo mesmo modal dos calendários. Os quadros funcionam também por toque e teclado; clique novamente ou use **Fechar lista** para recolher. Não há migração de banco para essa melhoria.

## Lista com busca e filtros

Na agenda, abra **Lista de tarefas · busca e filtros** (`/tarefas`). A lista consulta todos os períodos da unidade, excluindo arquivadas. Digite parte do título ou descrição, escolha o estado e clique em **Aplicar filtros**. **Todas as vencidas** seleciona somente pendências anteriores a hoje, inclusive de meses/anos passados; essa opção tem prioridade sobre o estado escolhido e mantém a busca textual. Tarefas com prazo hoje não são vencidas.

Resultados são ordenados pelo prazo, com 25 tarefas por página. Filtros ficam na URL e são preservados na paginação; aplicar uma nova busca reinicia a página. **Limpar filtros** restaura a consulta geral. Clique em uma tarefa para consultar detalhes, histórico e ações conforme seu perfil. Não há nova migração.

A busca aceita correspondência parcial e normaliza acentos portugueses/latinos comuns e diferenças entre maiúsculas e minúsculas. O termo é limitado a 120 caracteres. A lista também permite filtros por ponto focal e intervalo de prazo.

## Aparência e acessibilidade

O seletor **Tema**, no cabeçalho, oferece **Sistema**, **Claro** e **Escuro**. A preferência fica neste navegador; Sistema acompanha mudanças do sistema operacional. Fundos, textos, campos, bordas e cores de situação foram ajustados para os dois temas. A escolha é aplicada antes da hidratação para reduzir o clarão inicial.

O cabeçalho mantém acesso ao calendário, Meu dia, pendências, lista, resumo e planejamento anual. A visão anual ocupa a largura disponível; a navegação de período se reorganiza em telas menores. O calendário mensal permite rolagem horizontal em telas estreitas e dias com mais tarefas podem crescer. No celular, o seletor de demonstração deixa de cobrir o conteúdo.

O modal anuncia um diálogo, recebe o foco, mantém Tab dentro dele e devolve o foco ao elemento de origem ao fechar. Escape fecha quando não há uma operação em andamento; a rolagem do fundo fica bloqueada. Há atalho **Pular para o conteúdo**, foco visível e respeito à preferência por movimento reduzido.

### Navegação por teclado e orientação

As abas **Detalhes** e **Histórico** do modal aceitam setas esquerda/direita e Home/End. A edição permanece preenchida ao consultar o histórico. Ao editar, o foco vai ao título; ao cancelar, volta a **Editar**. Erros de campo retornados pelo servidor levam o foco ao primeiro campo inválido. Campos e controles principais têm áreas maiores para interação por toque.

O botão **Hoje** retorna ao mês/ano atual preservando a visão e demais filtros. A data atual aparece marcada nas visões mensal/anual, e mudanças no período são anunciadas de forma discreta para tecnologias assistivas. O seletor de tema mantém a escolha durante a sessão mesmo quando o navegador bloqueia armazenamento local.

### Ponto focal e intervalo de prazo

Na lista, selecione um **Ponto focal** e/ou preencha **Prazo a partir de** e **Prazo até**. Os dias inicial e final são incluídos por inteiro. Você pode informar somente uma das datas. Todos os filtros se combinam: texto, estado, ponto focal, datas e vencidas. Com **Todas as vencidas**, o intervalo restringe as pendências anteriores a hoje.

As opções de ponto focal mostram apenas nome/matrícula de pessoas vinculadas a tarefas ativas da sua unidade; nenhuma opção revela cadastros exclusivos de outras unidades. Visualizadores podem filtrar sem receber o diretório global para edição. Matrículas indisponíveis retornam zero tarefas. Datas inexistentes, intervalo invertido e matrículas inválidas exibem erro sem executar a busca de tarefas. Filtros seguem na URL ao paginar; aplicar ou limpar reinicia a página. Sem migração nova.

## Fila de validação

Entre como gestor e abra **Fila de validação** na agenda (`/validacoes`). O contador reúne todas as tarefas concluídas e ativas da unidade, independentemente do mês/ano do calendário. Operadores, visualizadores e anônimos não têm acesso à consulta nem ao contador.

A fila mostra primeiro as conclusões mais antigas, informa a data de conclusão e permite buscar por título/descrição. Registros legados sem data aparecem no início e exibem esse aviso. Há 25 tarefas por página. Abra uma tarefa, confira detalhes/histórico e clique em **Validar** no modal. Se a operação falhar, o modal permanece aberto para nova tentativa.

Validação usa a mesma transação e regra de recorrência já existente. Após sucesso, a tarefa sai da fila e o contador é atualizado; a sucessora recorrente continua como pendente na agenda. Concluir, validar, arquivar e restaurar revalidam explicitamente agenda, lista e fila. Não há validação em lote nem nova migração.

## Busca com ou sem acentos

A lista e a fila de validação encontram **Relatório** com `relatorio`, **Validação** com `VALIDACAO` e **Reunião** com `reuniao`. A normalização cobre os acentos portugueses e latinos comuns (á/à/â/ã/ä/å, é/è/ê/ë, í/ì/î/ï, ó/ò/ô/õ/ö, ú/ù/û/ü, ç, ñ, ý/ÿ), suas formas maiúsculas e marcas combinantes Unicode. Não é busca aproximada nem correção ortográfica.

Título e descrição originais continuam intactos na interface e no histórico. O banco mantém um campo auxiliar atualizado por triggers em inserções/edições, inclusive recorrências e seed. A migração `20261108000000_accent_search` preenche esse campo para tarefas existentes. Faça backup e execute `npm run db:prepare` nas outras instalações; reinicie o servidor após gerar o cliente Prisma. Use as migrações versionadas, pois `db push` não instala os triggers. A busca continua por substring, sem índice full-text.

## Backup e recuperação

Execute `npm run db:backup` antes de migrações ou atualizações. O arquivo é criado em `backups/`, fora do Git, e verificado após a gravação. Para restaurar sem substituir o banco ativo: `npm run db:restore -- --source backups/arquivo.db --output backups/restaurado.db`. O destino precisa ser novo; o comando revoga sessões na cópia e não altera seu `.env`.

Procedimento completo, limites e exercício de recuperação em [OPERACAO.md](docs/OPERACAO.md). Os arquivos contêm dados e credenciais de autenticação; mantenha-os em local protegido.

## Exportar tarefas em CSV

Na lista de tarefas, aplique os filtros e clique em **Exportar CSV**. O arquivo inclui todos os resultados da consulta, independentemente da página, até 5.000 tarefas. Acima desse limite, refine os filtros; a aplicação não gera arquivo parcial. Campos alterados no formulário só entram na exportação depois de **Aplicar filtros**.

O CSV usa UTF-8 com BOM, separador ponto e vírgula e datas dd/MM/aaaa. Colunas: título, descrição, prazo, estado, periodicidade e nomes dos pontos focais. Todos os perfis autenticados podem exportar apenas tarefas ativas da própria unidade. O arquivo não inclui e-mails, sessões, auditoria ou campos internos de busca. Consulta vazia gera somente cabeçalho.

Aspas e quebras são escapadas; valores com prefixos que podem ser interpretados como fórmula recebem apóstrofo para serem tratados como texto, conforme a mitigação descrita em [CWE-1236](https://cwe.mitre.org/data/definitions/1236.html). Esse marcador pode aparecer ao importar o arquivo como texto. Ao importar manualmente em planilhas, mantenha as colunas textuais como texto. Não foi verificada a abertura em todas as versões de planilhas. Nenhuma exportação é enviada automaticamente a terceiros.

### Perfil demo ausente

Se Carlos ou outro perfil de demonstração ainda não existe no banco, execute `npm run demo:prepare`. O comando é permitido somente fora de produção, com DEMO_MODE=true e sem segredo de autenticação real. Cria os perfis fictícios faltantes na unidade do administrador demo existente; não modifica nomes/perfis, não reativa contas e não cria senhas. Se não houver essa unidade, prepara a unidade fictícia U001.

O seletor agora informa perfil inexistente, conta desativada e falha de conexão. Uma conta desativada deve ser reativada pelo gestor, sem usar a preparação para contornar o bloqueio. Os atalhos de busca e gestão aparecem em uma navegação própria, separados e com áreas de clique acessíveis.

### Meu dia e duplicação de tarefas

Acesse **Meu dia** na navegação para acompanhar pendências da unidade em três grupos: vencidas, hoje e os próximos sete dias (amanhã até o sétimo dia, inclusive). O filtro por ponto focal vale para os três grupos. Cada grupo mostra até 25 tarefas, o total e um link para consultar todas na lista. Datas seguem o fuso do servidor, como nos filtros existentes; configure o ambiente com o fuso da unidade. Selecione **Minhas tarefas** para filtrar pelo ponto focal associado à sua conta, ou **Toda a unidade** para consultar e filtrar a equipe. O gestor configura o vínculo na gestão de usuários; sem vínculo, a visão pessoal apresenta orientação e nenhum resultado.

Nos detalhes de qualquer tarefa da própria unidade, administradores e operadores podem escolher **Duplicar tarefa**. O formulário preserva título, descrição, periodicidade e pontos focais, mas exige escolher um prazo. A confirmação usa o cadastro existente e cria uma tarefa pendente com novo identificador e histórico próprio, sem copiar validação, arquivamento ou vínculo de recorrência. Cancelar não altera a tarefa original. Ao duplicar pela fila de validação ou pelo arquivo, o formulário apresenta os focais originais; para adicionar outra pessoa, edite a cópia pendente depois de criá-la. Visualizadores têm acesso de leitura ao Meu dia.

### Filtros favoritos

Na lista de tarefas, aplique uma consulta e use **Filtros favoritos** para dar um nome e salvar. O favorito conserva busca, estado, ponto focal, intervalo de prazo e opção de vencidas; abre sempre na primeira página. Alterações ainda não aplicadas no formulário não são salvas. Datas do intervalo são fixas; “Todas as vencidas” usa o dia atual ao consultar.

Cada usuário pode salvar até dez favoritos por unidade na própria conta. Os favoritos ficam no banco e estão disponíveis em outros dispositivos, sujeitos à sessão e ao isolamento por unidade. Favoritos da versão anterior permanecem no navegador e podem ser importados pelo botão **Importar favoritos locais**; duplicados e excedentes permanecem no navegador para revisão. Nomes repetidos não sobrescrevem favoritos existentes.

### Comentários nas tarefas

Abra uma tarefa em qualquer visão e selecione **Ver comentários** nos detalhes. Administradores e operadores podem publicar texto de até 2.000 caracteres em tarefas ativas da própria unidade, inclusive concluídas e validadas. Visualizadores podem ler. Tarefas arquivadas mantêm a conversa disponível somente para leitura.

Cada comentário registra autor, data e texto, separado do histórico automático de ações. As mensagens são exibidas como texto, sem HTML, com as mais recentes primeiro e 20 por página. Não há edição, exclusão ou envio de notificações nesta versão. Duplicações e novas ocorrências de uma tarefa recorrente começam sem comentários.

Este incremento inclui a migração `20261109000000_task_comments`. Em outras instalações, execute `npm run db:prepare` e reinicie o servidor. Os comentários são armazenados no SQLite e incluídos nos backups do banco.

### Central de pendências

A entrada **Pendências** na navegação reúne alertas da unidade em `/pendencias`: vencidas, prazo hoje e próximos 15 dias (amanhã até o 15º dia, inclusive). Para gestores, inclui também tarefas concluídas aguardando validação, de qualquer período. Operadores e visualizadores recebem apenas os alertas de prazo; a consulta de validações exige perfil de gestor no servidor.

Os contadores permitem filtrar a lista, que mostra 25 tarefas por página, ordenadas pelo prazo. Abra qualquer tarefa para usar os mesmos detalhes, comentários e ações das outras visões. Tarefas arquivadas e validadas ficam fora da central. Use **Atualizar pendências** para buscar mudanças de outras pessoas; não há envio de notificações nem atualização periódica automática. Para analisar validações por ordem de conclusão, o gestor pode abrir a fila de validação existente.

A central é uma visão da unidade, complementar ao **Meu dia**, que mantém seu horizonte de sete dias e filtro por ponto focal. Não é necessária migração de banco.

### Trabalho pessoal, etapas e resumo

O gestor vincula contas a pontos focais em **Usuários da unidade**. O cadastro de funcionários é global; por isso, a associação é restrita a pontos focais já presentes em tarefas da unidade. Um ponto focal pode estar associado a uma única conta. A alteração é registrada no histórico administrativo.

Nos detalhes de uma tarefa, **Ver etapas** permite acompanhar até 100 itens de checklist. Administradores e operadores podem adicionar, marcar e remover etapas enquanto a tarefa estiver pendente e não arquivada; outros perfis e tarefas finalizadas têm acesso de leitura. A conclusão da tarefa independe de todas as etapas estarem marcadas. Cópias e novas ocorrências não herdam etapas.

O **Resumo** apresenta indicadores mensais por prazo da unidade, com links para a lista filtrada. Os cartões mostram contagens de comentários quando disponíveis. A navegação e o calendário foram ajustados para telas menores.

A migração `20261110000000_personal_work` cria vínculos, checklist e favoritos em conta. Em outras instalações, faça backup, execute `npm run db:prepare` e reinicie a aplicação. O banco local foi migrado após backup.

### Planejamento anual

Em **Planejamento anual**, escolha o ano em que as tarefas foram concluídas, o ano de destino e, se desejar, quem registrou a conclusão. O levantamento usa a data de conclusão e o histórico da tarefa, inclui concluídas, validadas e arquivadas da unidade e informa quando não há data de conclusão em registros antigos. Usuários desativados continuam disponíveis no filtro.

Selecione as tarefas da página, examine os dados e informe um novo prazo no ano de destino para cada uma. O lote aceita até 25 tarefas por vez. Administradores e operadores podem criar as cópias; visualizadores podem consultar. As cópias nascem pendentes, com título, descrição, periodicidade e pontos focais; histórico, comentários, etapas e vínculo de recorrência não são copiados. A periodicidade mantida poderá gerar nova ocorrência após validação.

A tela avisa quando já existe cópia criada por este planejamento ou uma próxima ocorrência recorrente com prazo no ano escolhido. Cópias manuais e outras ocorrências não são detectadas automaticamente: confira a lista de tarefas antes de criar mais uma. Uma tentativa repetida com os mesmos dados usa a mesma chave, evitando que uma falha de conexão crie o mesmo lote duas vezes. Se trocar a seleção depois de uma falha, atualize a consulta e confira os avisos antes de prosseguir.

A migração `20261110010000_annual_planning` registra os lotes e suas origens. Em outras instalações, faça um backup, execute `npm run db:prepare` e reinicie a aplicação.

### Substituição de ponto focal em lote

Na **Lista de tarefas**, gestores e operadores podem selecionar **Substituir ponto focal em lote**, escolher a pessoa atual e a substituta e consultar as tarefas antes de confirmar. A operação considera tarefas pendentes e não arquivadas da unidade, com prazo a partir de hoje, segundo o fuso do servidor. Tarefas vencidas, concluídas, validadas e arquivadas permanecem fora da operação.

A prévia lista as tarefas e seus pontos focais atuais. Os demais pontos focais são preservados; se a pessoa substituta já participar da tarefa, ela não é duplicada. Cada confirmação atualiza até 200 tarefas; caso haja mais, consulte novamente para continuar com o próximo lote. Se as tarefas mudarem depois da prévia, a confirmação é recusada e é necessário consultar novamente. O histórico de cada tarefa registra a substituição, e uma falha de gravação reverte todo o lote.

A pessoa substituta é escolhida no cadastro global de funcionários, como na edição individual de tarefas. A operação atualiza as tarefas existentes selecionadas pela regra de prazo e não altera o vínculo entre conta e ponto focal. Novas ocorrências recorrentes seguem a regra existente: herdam os pontos focais da ocorrência validada.
