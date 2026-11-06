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
| `tests/task-input.test.ts` | Frequência padrão, todas as frequências oferecidas, deduplicação de pontos focais, título sem espaços nas extremidades, datas inexistentes, matrícula inválida e arquivos em campos de texto |
| `tests/archive-input.test.ts` | Motivo obrigatório, limites de tamanho, espaços e tipos inválidos |
| `tests/frequency.test.ts` | Sete recorrências automáticas, NONE/EVENTUAL, final de mês, ano bissexto, passagem de ano e preservação da data original |
| `tests/task-status.test.ts` | Pendências vencidas, hoje, limites de 15/16 dias, prioridade de concluída/validada, mudança de ano e preservação da data recebida |
| `tests/task-actions.test.ts` | Cadastro, edição, troca/remoção de pontos focais, histórico, arquivamento e restauração sem perda de histórico, conclusão, validação pelo gestor, geração da sucessora, tarefas inexistentes, sessão ausente/inválida, troca de perfil, permissões, isolamento, transições, validação concorrente e rollback de auditoria |
| `tests/task-ui.test.tsx` | Envio e limpeza do cadastro, preservação dos campos após falha, erros de transporte e negócio, nova tentativa, edição, histórico, confirmação/cancelamento do arquivamento e restauração, bloqueio de ações concorrentes e botões conforme perfil/unidade/estado |
| `tests/calendar-ui.test.tsx` | Janeiro com month=0, período atual, navegação mensal/anual, passagem de ano, alternância de visão, abertura/fechamento de detalhes, doze meses, indicadores e seletor de demonstração |

Resultado após o incremento 3, em 05/11/2026: **127 testes aprovados em 7 arquivos**, sem casos `todo`.

## Banco isolado

A integração cria um diretório exclusivo com `mkdtemp` e um SQLite novo a cada execução. A URL temporária é definida antes de importar a aplicação; a variável de ambiente original é restaurada ao finalizar. Nenhum comando de reset é aplicado ao banco do projeto.

Os SQLs versionados de `prisma/migrations` são aplicados em ordem. O executor divide as instruções por ponto e vírgula; se as migrações passarem a conter triggers ou strings com esse caractere, será necessário adaptar o executor. Essa preparação valida o comportamento sobre o esquema versionado, mas não testa a CLI do Prisma nem sua tabela de controle de migrações.

As consultas Prisma e a auditoria são reais. As fronteiras `next/headers` e `next/cache` são substituídas para fornecer cookies e observar a revalidação sem iniciar o servidor Next. O construtor Prisma é envolvido apenas para rastrear e desconectar os clientes reais no fim da suíte. A auditoria agora usa o mesmo cliente transacional das ações. As tarefas são removidas entre os casos; o banco temporário é removido ao concluir.

O cliente Prisma precisa ter sido gerado para a plataforma local. Se o motor não for encontrado, reexecute `npx prisma generate` antes dos testes de integração.

## Interface e limites

Os componentes são renderizados no JSDOM com suas ações de servidor simuladas. Assim, os testes verificam entrada de dados, estados de processamento, mensagens e chamadas das ações. Eles não substituem testes de navegador real, layout, foco, comportamento de cookies HTTP ou o transporte de Server Actions do Next.

Foi encontrada e corrigida uma regressão em `TaskFields`: o reset nativo do formulário restaurava a periodicidade e as caixas de pontos focais após uma falha. Os defaults nativos agora acompanham a escolha atual; a limpeza após sucesso continua sendo feita pelo remount do formulário. A suíte protege esse comportamento no cadastro e na edição.

As setas de navegação ainda não têm nomes acessíveis; seus testes usam a ordem dos botões, com essa limitação explícita no arquivo. Adicionar rótulos faz parte da evolução de acessibilidade.

## Controles do incremento 2

Os cinco `todo` anteriores foram substituídos por testes executáveis:

- VIEWER sem mutações e consultas/alterações de tarefas isoladas por unidade, inclusive chamadas diretas por ID.
- Dados enviados pelo formulário não escolhem unidade, criador, estado ou tarefa de origem.
- Edição/conclusão exigem PENDING e validação exige COMPLETED.
- Validação sequencial e simultânea gera uma única sucessora, com pontos focais; uma segunda inserção com a mesma origem também falha pela restrição do banco.
- Triggers temporárias do SQLite provocam falhas na auditoria de criação, edição, conclusão, validação e criação da sucessora. Os testes comparam tarefas, vínculos e histórico antes/depois e exigem rollback completo.
- `DEMO_MODE=false` bloqueia sessão e troca de usuário. Produção também bloqueia essas operações mesmo com a flag habilitada.

Autenticação real, política de lotação dos funcionários e testes em navegador real continuam fora do escopo entregue. O teste de concorrência usa requisições simultâneas no mesmo processo com SQLite real; a restrição única no banco fornece a garantia adicional entre processos.


## Controles do incremento 3

A integração verifica preservação de dados, autor/data/motivo, restauração de cada estado, histórico permanente, proibição de mutações arquivadas, consultas por unidade em todos os períodos e ausência de exclusão física na API. Testes simultâneos exigem uma única gravação de ARCHIVE/RESTORE. Triggers SQLite também provocam falhas nessas duas ações para confirmar rollback de metadados e histórico.

Na interface, os testes verificam abertura e cancelamento do formulário de motivo, campos obrigatórios, erros e nova tentativa, bloqueio durante o processamento, permissões da restauração e navegação entre ativas/arquivadas preservando o período.
