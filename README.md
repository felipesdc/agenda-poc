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

Para a demonstração local sem senha, mantenha `BETTER_AUTH_SECRET` vazio e use `DEMO_MODE=true`. Os perfis disponíveis são:

| Perfil de demonstração | E-mail |
| --- | --- |
| Alice, gestora (`ADMIN`) | admin@banco.com |
| Bob, operador (`OPERATOR`) | operador@banco.com |
| Carlos, visualizador (`VIEWER`) | leitor@banco.com |

O seed cria a unidade `U001`, três usuários e três funcionários fictícios. Não cria tarefas e pode ser executado novamente por usar `upsert`. No cadastro, selecione a periodicidade e os pontos focais; o padrão é sem repetição.

`DATABASE_URL="file:./dev.db"` usa o arquivo `prisma/dev.db`. O repositório já contém esse banco versionado: faça uma cópia antes de aplicar migrações se houver dados que deseja preservar. Para conferir a situação, execute `npx prisma migrate status`. Não use `migrate reset` para preparar um banco com dados importantes.

## Atualizar uma instalação existente

Os incrementos incluem migrações aditivas para recorrência, arquivamento, autenticação e índices. Antes de iniciar a versão atualizada, com a sua configuração `DATABASE_URL` carregada:

```bash
npm run db:prepare
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Configure o login conforme [AUTENTICACAO.md](docs/AUTENTICACAO.md). Para demonstração local sem segredo configurado, use `DEMO_MODE=true`; essa flag nunca habilita a sessão simulada em produção. A migração foi verificada em uma cópia do banco; o banco original do projeto não foi alterado automaticamente. Vínculos de origem só são registrados para novas ocorrências geradas.

## Arquivar e restaurar

Como gestor, abra uma tarefa, clique em **Arquivar tarefa**, informe o motivo (3 a 500 caracteres) e confirme. A tarefa sai da agenda e dos indicadores ativos, mantendo histórico, pontos focais e vínculos de recorrência.

A opção **Arquivadas** mostra todos os períodos da sua unidade. Abra uma tarefa para consultar autor, data, motivo e histórico. O gestor pode usar **Restaurar tarefa** para trazê-la de volta, com prazo e estado originais. O arquivamento de uma ocorrência não arquiva as outras da mesma recorrência.

Operadores e visualizadores consultam o arquivo da própria unidade; arquivar e restaurar são ações exclusivas do gestor. A aplicação não oferece mais exclusão definitiva.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run db:prepare` | Gera cliente Prisma e aplica migrações pendentes, sem reset ou seed |
| `npm run db:status` | Confere migrações pendentes |
| `npm run db:check` | Compara o banco configurado com o schema, falhando se houver diferenças |
| `npm run typecheck` | Verificação de tipos |
| `npm run auth:provision -- --email usuario@dominio.com` | Provisionar ou redefinir senha de usuário existente |
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

A busca usa `contains` do SQLite: aceita correspondência parcial, mas não remove acentos nem oferece equivalência completa entre maiúsculas/minúsculas em caracteres acentuados. O termo é limitado a 120 caracteres. Esta primeira versão não inclui filtros por ponto focal ou intervalo personalizado de datas.

## Aparência e acessibilidade

O seletor **Tema**, no cabeçalho, oferece **Sistema**, **Claro** e **Escuro**. A preferência fica neste navegador; Sistema acompanha mudanças do sistema operacional. Fundos, textos, campos, bordas e cores de situação foram ajustados para os dois temas. A escolha é aplicada antes da hidratação para reduzir o clarão inicial.

O cabeçalho mantém acesso ao calendário e à lista. A visão anual ocupa a largura disponível; a navegação de período se reorganiza em telas menores. O calendário mensal permite rolagem horizontal em telas estreitas e dias com mais tarefas podem crescer. No celular, o seletor de demonstração deixa de cobrir o conteúdo.

O modal anuncia um diálogo, recebe o foco, mantém Tab dentro dele e devolve o foco ao elemento de origem ao fechar. Escape fecha quando não há uma operação em andamento; a rolagem do fundo fica bloqueada. Há atalho **Pular para o conteúdo**, foco visível e respeito à preferência por movimento reduzido.
