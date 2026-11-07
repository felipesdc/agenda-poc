# Roteiro de evolução

Diagnóstico por leitura do código em 05/11/2026. Os itens abaixo registram propostas e a situação da implementação. A ordem prioriza um fluxo local confiável, controle de acesso e integridade dos dados antes de novas integrações.

## Incremento 1 entregue — cadastro e retorno das ações

- Cadastro com periodicidade e pontos focais; ausência de frequência usa `NONE`.
- Validação compartilhada de título, data civil, enum e matrículas; funcionários inexistentes são recusados.
- Campos controlados preservam a entrada após falhas e limpam o cadastro após sucesso.
- Conclusão/validação fora da edição; falhas aparecem no modal, que fecha apenas com sucesso; exclusão pede confirmação.
- Remoção dos atrasos artificiais, dos erros/avisos do lint e correção do contrato assíncrono de `searchParams` e idioma da página.
- Testes automatizados de validação e verificação das ações com SQLite temporário. Evidências em [VALIDACAO.md](VALIDACAO.md).

As pendências originais de filtros de mês/ano e cores anuais foram concluídas no incremento 4. O incremento 2 abaixo entrega autorização, atomicidade e proteção das recorrências.

## Incremento 2 entregue — autorização e integridade

- Leituras autenticadas limitadas à unidade do usuário; visualizador sem mutações e sem diretório global de funcionários.
- Operador cria/edita/conclui pendências; gestor também valida e exclui, sempre na própria unidade. Interface e Server Actions aplicam a política.
- Transições exigem estado anterior; tarefa concluída ou validada não pode ser editada nem concluída novamente.
- Validação repetida/concorrente gera uma única sucessora, com origem única no banco e cópia dos pontos focais.
- Criação, edição, conclusão, validação, vínculos e respectivos históricos são atômicos. Auditoria registra antes/depois, inclusive da descrição.
- Sessão de demonstração exige `DEMO_MODE=true`, é bloqueada em produção e inclui perfil visualizador no seed.
- Migração aditiva testada em cópia do banco existente. Banco original não alterado automaticamente.

Os incrementos 3 e 4 abaixo entregam arquivamento e autenticação por senha. O cadastro de funcionários permanece global; uma política de lotação precisa ser definida antes de introduzir isolamento desse cadastro.

## Incremento 3 entregue — arquivamento e restauração

- Arquivamento substitui a exclusão definitiva: a aplicação removeu a Server Action de exclusão física.
- Gestor informa motivo obrigatório; autor, data e motivo ficam registrados com o histórico, sem apagar vínculos ou ocorrências.
- Tarefas arquivadas ficam fora da agenda e dos indicadores ativos e não aceitam edição, conclusão ou validação.
- Consulta das arquivadas de todos os períodos da unidade, com detalhes e histórico para todos os perfis autorizados.
- Restauração exclusiva do gestor mantém prazo, estado e recorrência; ações usam transações, guardas contra repetição e auditoria atômica.
- Migração aditiva, testes de permissões, restauração, consultas, concorrência e rollback.

O incremento 4 abaixo entrega login por senha, normalização de mês/ano e cores anuais. CI, gestão de usuários e revisão operacional continuam pendentes.

## Incremento 4 entregue — autenticação por senha e calendário

- Better Auth com SQLite/Prisma, sem cadastro público, vinculado ao diretório de perfis/unidades existente.
- Login, logout, sessões verificadas no servidor, expiração e revogação após redefinição de senha.
- Provisionamento administrativo por terminal; seed sem senhas padrão e migração aditiva sem modificar os dados do domínio.
- Rate limit em banco, proteção de origem/CSRF e configuração de produção com HTTPS; modo de demonstração desativado quando um segredo real é configurado.
- Filtros de mês/ano normalizados no servidor e na interface, intervalo 1900–2100, botões com nomes acessíveis e navegação dentro dos limites.
- Mesma prioridade de cores na visão mensal/anual; concluídas em azul e validadas em cinza, com rótulos acessíveis nas marcações anuais.

Próximos incrementos: CI, gestão administrativa de usuários, revisão de dependências e preparação operacional do piloto. Recuperação de senha por e-mail, MFA e definição dos proxies confiáveis ainda não foram implementados. A redefinição atual é administrativa.

## Etapa 1 — Escopo original e pendências

| Item | Evidência atual | Critério de aceite |
| --- | --- | --- |
| Corrigir cadastro | `TaskForm` não envia `frequency`; `FormData.get` retorna `null`, mas o schema aceita enum ou `undefined` | Criar tarefa sem repetição funciona; formulário permite escolher frequência e pontos focais; ambos persistem |
| Validar entradas | Data é validada por parsing genérico antes de receber um sufixo; matrículas viram `Number` sem validação; parâmetros da URL aceitam valores arbitrários | Rejeitar datas inexistentes, matrículas inválidas e título só com espaços; tratar mês/ano inválidos sem quebrar a página |
| Mostrar resultado das ações | Modal ignora retorno de concluir, validar e excluir e fecha mesmo com falha | Mostrar erro, manter o modal aberto e reabilitar ações após falha; confirmação antes da exclusão |
| Corrigir tipos e apresentação | `any` em componentes, tipo de `searchParams` síncrono apesar do `await`, `lang="en"`, cores inconsistentes no ano | Tipagem compartilhada para tarefas com relações, contrato assíncrono da página, idioma `pt-BR` e cores coerentes |

Validar esta etapa com criação, edição, falha de validação e consulta mensal/anual. Remover também os atrasos artificiais das ações de criar/editar.

## Etapa 2 — Escopo original e requisitos para o piloto

| Item | Evidência atual | Critério de aceite |
| --- | --- | --- |
| Autenticação real | Troca por e-mail e cookie de ID sem prova de identidade | Sessão verificada no servidor; seletor de demonstração restrito a ambiente explícito; usuário anônimo sem acesso aos dados |
| Autorização por perfil e unidade | Apenas `validateTask` verifica perfil; consultas e mutações não restringem unidade | Toda leitura e mutação aplica a política abaixo, inclusive chamadas diretas às Server Actions |
| Transições válidas | Concluir/validar não verificam o estado anterior | Conclusão só de `PENDING`; validação só de `COMPLETED`; transições inválidas não alteram dados |
| Recorrência idempotente | Cada validação pode gerar nova tarefa; pontos focais não são copiados | Duas validações, inclusive concorrentes, geram no máximo uma sucessora; vínculo único com a tarefa de origem; preservar pontos focais |
| Operações atômicas | Mutação, histórico e sucessora são gravados separadamente; auditoria silencia erros | Transação grava todos os registros ou reverte tudo; falha de auditoria não resulta em sucesso parcial |
| Preservar histórico | Exclusão física apaga histórico por cascata; descrição alterada não é auditada | Arquivamento com autor, data e motivo; histórico acessível e alterações relevantes com antes/depois |

A política implementada está em [ARQUITETURA.md](ARQUITETURA.md). A matriz abaixo inclui o arquivamento já entregue:

| Operação na própria unidade | VIEWER | OPERATOR | ADMIN |
| --- | --- | --- | --- |
| Consultar tarefas e histórico | Sim | Sim | Sim |
| Criar/editar pendências e concluir | Não | Sim | Sim |
| Validar conclusão | Não | Não | Sim |
| Arquivar/restaurar tarefas | Não | Não | Sim |

Acesso a tarefas de outras unidades é bloqueado. O gestor pode validar a própria conclusão, preservando o comportamento anterior. Definir a lotação dos pontos focais antes de restringir o cadastro global de funcionários.

## Etapa 3 — Qualidade e operação

- **Testes de negócio:** permissões com duas unidades e três perfis; transições; validação repetida/concorrente; rollback de auditoria; recorrência em fim de mês e ano bissexto; prazos em fusos diferentes. Usar banco temporário separado do banco local.
- **CI:** instalação pelo lockfile, geração do Prisma, lint, tipos, testes e build. Verificar migrações em banco vazio. Não existe pipeline atualmente.
- **Banco e configuração:** deixar de versionar `prisma/dev.db` em uma mudança explícita, mantendo migrações e seed; usar singleton em todos os acessos; avaliar índice por unidade/prazo e histórico por tarefa/data com consultas reais.
- **Operação:** erros estruturados com contexto, sem dados sensíveis; backup e exercício de restauração. Definir hospedagem e persistência antes de decidir se SQLite continua adequado ou se PostgreSQL será necessário.
- **Dependências:** revisar versões e avisos de segurança antes do piloto, com consulta às fontes oficiais no momento da atualização. Esta análise não é uma auditoria de vulnerabilidades.

## Etapa 4 — Melhorias de produto

| Melhoria | Benefício e aceite inicial |
| --- | --- |
| Lista de tarefas com busca e filtros | Filtrar por estado, ponto focal e prazo; localizar vencidas de meses anteriores sem depender da grade do mês |
| Fila de validação | Gestor vê concluídas aguardando análise; contadores de concluídas/validadas com período explícito |
| Calendário mais utilizável | Abrir mês pela visão anual; dia com muitas tarefas tem “ver todas”; boa leitura no celular |
| Acessibilidade | Modal com foco controlado, Escape e nome acessível; botões com rótulos; informações de estado além das cores |
| Lembretes | Configurar antecedência e destinatários; evitar envios duplicados e registrar tentativas. Escolher canal após definir o uso real |
| Exportação | CSV com os filtros aplicados e política de acesso igual à consulta |
| Gestão de cadastros | Administrar usuários, unidades e funcionários sem alterar o seed |

## Primeiro incremento recomendado

Com login, autorização e integridade implementados, priorizar CI e gestão de usuários, seguidas da revisão de dependências e preparação operacional antes do piloto. Lembretes e integrações vêm após estabilizar esse fluxo.
