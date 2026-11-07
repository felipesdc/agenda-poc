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
npx prisma generate
npx prisma migrate deploy
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
npx prisma generate
npx prisma migrate deploy
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
