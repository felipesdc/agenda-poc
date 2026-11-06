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
- Troca de usuário de demonstração entre gestor, operador e visualizador.

**Estado:** protótipo local. A troca de perfil é uma simulação de sessão, habilitada apenas com `DEMO_MODE=true` fora de produção. Permissões por perfil/unidade e integridade do ciclo são aplicadas no servidor; autenticação real continua pendente. Consulte o [diagnóstico e plano de evolução](docs/ROADMAP.md) antes de usar dados reais.

## Tecnologias

Next.js 16.0.7 (App Router), React 19.2, TypeScript, Tailwind CSS 4, Prisma 6, SQLite, Zod e date-fns. As versões exatas estão no `package-lock.json`.

## Executar localmente

Pré-requisitos: Node.js compatível com Next.js 16 (20.9 ou superior) e npm.

```bash
npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
npm run dev
```

Abra http://localhost:3000 e selecione um perfil no canto inferior direito:

| Perfil de demonstração | E-mail |
| --- | --- |
| Alice, gestora (`ADMIN`) | admin@banco.com |
| Bob, operador (`OPERATOR`) | operador@banco.com |
| Carlos, visualizador (`VIEWER`) | leitor@banco.com |

O seed cria a unidade `U001`, três usuários e três funcionários fictícios. Não cria tarefas e pode ser executado novamente por usar `upsert`. No cadastro, selecione a periodicidade e os pontos focais; o padrão é sem repetição.

`DATABASE_URL="file:./dev.db"` usa o arquivo `prisma/dev.db`. O repositório já contém esse banco versionado: faça uma cópia antes de aplicar migrações se houver dados que deseja preservar. Para conferir a situação, execute `npx prisma migrate status`. Não use `migrate reset` para preparar um banco com dados importantes.

## Atualizar uma instalação existente

Os incrementos 2 e 3 incluem migrações aditivas para recorrência, arquivamento e índices. Antes de iniciar a versão atualizada, com a sua configuração `DATABASE_URL` carregada:

```bash
npx prisma generate
npx prisma migrate deploy
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Inclua `DEMO_MODE="true"` no `.env` para usar a demonstração com `npm run dev`. Essa flag nunca habilita a sessão em produção. A migração foi verificada em uma cópia do banco; o banco original do projeto não foi alterado automaticamente. Vínculos de origem só são registrados para novas ocorrências geradas.

## Arquivar e restaurar

Como gestor, abra uma tarefa, clique em **Arquivar tarefa**, informe o motivo (3 a 500 caracteres) e confirme. A tarefa sai da agenda e dos indicadores ativos, mantendo histórico, pontos focais e vínculos de recorrência.

A opção **Arquivadas** mostra todos os períodos da sua unidade. Abra uma tarefa para consultar autor, data, motivo e histórico. O gestor pode usar **Restaurar tarefa** para trazê-la de volta, com prazo e estado originais. O arquivamento de uma ocorrência não arquiva as outras da mesma recorrência.

Operadores e visualizadores consultam o arquivo da própria unidade; arquivar e restaurar são ações exclusivas do gestor. A aplicação não oferece mais exclusão definitiva.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
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

- [Arquitetura, entidades e regras atuais](docs/ARQUITETURA.md)
- [Melhorias priorizadas e critérios de aceite](docs/ROADMAP.md)
- [Testes: execução, cobertura e limites](docs/TESTES.md)
- [Registro das verificações](docs/VALIDACAO.md)

Licença: [MIT](LICENSE).
