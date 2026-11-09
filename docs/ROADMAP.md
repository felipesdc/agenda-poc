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

O incremento 4 abaixo entrega login por senha, normalização de mês/ano e cores anuais. O incremento 5 entrega CI; gestão de usuários e revisão operacional continuam pendentes.

## Incremento 4 entregue — autenticação por senha e calendário

- Better Auth com SQLite/Prisma, sem cadastro público, vinculado ao diretório de perfis/unidades existente.
- Login, logout, sessões verificadas no servidor, expiração e revogação após redefinição de senha.
- Provisionamento administrativo por terminal; seed sem senhas padrão e migração aditiva sem modificar os dados do domínio.
- Rate limit em banco, proteção de origem/CSRF e configuração de produção com HTTPS; modo de demonstração desativado quando um segredo real é configurado.
- Filtros de mês/ano normalizados no servidor e na interface, intervalo 1900–2100, botões com nomes acessíveis e navegação dentro dos limites.
- Mesma prioridade de cores na visão mensal/anual; concluídas em azul e validadas em cinza, com rótulos acessíveis nas marcações anuais.

Próximos incrementos: gestão administrativa de usuários, revisão de dependências e preparação operacional do piloto. Recuperação de senha por e-mail, MFA e definição dos proxies confiáveis ainda não foram implementados. A redefinição atual é administrativa.

## Incremento 5 entregue — integração contínua e preparação do banco

- GitHub Actions em pull requests, pushes na main e execução manual, com permissão somente de leitura.
- Node alinhado à `.nvmrc`, instalação pelo lockfile, lint, testes, build e tipos.
- SQLite temporário vazio, aplicação das migrações e comparação com o schema para detectar migração esquecida.
- Comandos explícitos de preparação, situação e comparação do banco; orientação para o erro P2022 sem reset de dados.
- Execução remota depende do envio do workflow ao GitHub; proteção de branch é configuração do repositório.

## Incremento 6 entregue — gestão administrativa de usuários

- Tela `/usuarios` com listagem, cadastro de nome/e-mail/perfil e edição de nome/perfil na unidade da sessão.
- Acesso exclusivo do gestor, validação no servidor, e-mail normalizado sem duplicação e bloqueio do próprio rebaixamento.
- Nome sincronizado com identidade e sessões revogadas atomicamente após edição.
- Situação de provisionamento visível; senhas continuam provisionadas pelo terminal, sem senha padrão.
- Testes de autorização, isolamento, validação, rollback e formulários.

## Incremento 7 entregue — auditoria administrativa

- Registros de cadastro/edição na mesma transação da alteração de perfil, identidade e sessões.
- Autoria, data e snapshots de nome/perfil; sem eventos ao salvar sem mudanças.
- Consulta dos últimos 100 eventos da unidade, exclusiva do gestor, na tela de usuários.
- Migração aditiva e testes de isolamento, retenção, limites e rollback.
- Cobertura limitada às ações da interface, sem reconstruir histórico anterior ou auditar CLI/seed.

## Incremento 8 entregue — desativação e reativação de contas

- Situação ativa/desativada na tela de usuários, com confirmação e restrição à própria unidade.
- Autodesativação bloqueada; gestor desativado perde acesso administrativo.
- Sessões revogadas e login real/demo bloqueados; reativação permite novo login sem recuperar sessões antigas.
- Transições auditadas atomicamente, preservando senha, tarefas e vínculos.
- Migração aditiva mantém contas existentes ativas e testes cobrem permissões, autenticação, interface e rollback.

Próximos passos: revisão de dependências e preparação operacional do piloto; busca e filtros de tarefas como próxima melhoria de produto.

## Incremento 9 entregue — visão anual interativa

- Dias com tarefas selecionáveis, lista completa do dia e contadores por mês.
- Mesmo TaskModal da visão mensal, recebendo usuário, funcionários e tarefas com histórico.
- Detalhes, histórico e ações respeitam as permissões já implementadas.
- Atalho para abrir o mês e atualização da seleção a partir dos dados revalidados.
- Testes de consulta, edição com falha/sucesso, visualizador, validação pelo gestor, mudança de prazo e ano.

## Incremento 10 entregue — detalhes pelos quadros de prazo

- Quadros de vencidas, atenção e no prazo expandem listas por clique, toque e teclado.
- Lista ordenada por prazo, restrita a pendências ativas do período da agenda.
- Modal compartilhado para detalhes, histórico, edição e ações conforme perfil.
- Revalidação atualiza contadores/listas; testes de todas as faixas, edição, visualizador e teclado.

## Incremento 11 entregue — lista com busca e filtros

- Rota `/tarefas`, acessível pela agenda, consulta tarefas ativas da unidade em todos os períodos.
- Busca por título/descrição, estado e opção Todas as vencidas, incluindo meses e anos anteriores.
- Paginação de 25 resultados com filtros na URL e ordenação estável por prazo/id.
- Modal compartilhado para consulta e ações conforme perfil.
- Testes de parâmetros, consulta real com SQLite, isolamento, paginação e interface.
- Ponto focal e datas foram entregues no incremento 14; busca sem acentos foi entregue no incremento 16.

## Incremento 12 entregue — consistência visual, temas e acessibilidade

- Temas Sistema/Claro/Escuro, preferência local e cores de superfície/texto compartilhadas.
- Ajustes de contraste para formulários, cartões, calendários, listas, login, arquivo e gestão de usuários.
- Cabeçalho com navegação e indicação da página atual; espaçamentos e layouts responsivos.
- Calendário mensal com rolagem em telas estreitas e dias que crescem; anual com largura disponível.
- Modal com foco inicial/restauração, contenção de Tab, Escape e bloqueio da rolagem de fundo.
- Verificação visual no Chrome nativo dos temas claro/escuro, detalhes e edição, sem salvar alterações.

## Incremento 13 entregue — teclado, orientação e formulários

- Abas semânticas com navegação por setas/Home/End e painéis associados.
- Rascunho preservado entre abas; foco inicial na edição, retorno ao cancelar e foco em campos inválidos.
- Contenção de foco ignora painéis ocultos e controles fora da ordem de tabulação.
- Hoje preserva visão/filtros, data atual marcada e período anunciado.
- Controles de formulário maiores e tema temporário quando armazenamento está bloqueado.
- Verificação por teclado no Chrome e testes automatizados dos novos comportamentos.

## Incremento 14 entregue — ponto focal e intervalo de prazo

- Filtros combináveis por ponto focal e datas inclusivas, com um ou dois limites opcionais.
- Preservação na URL/paginação e combinação com texto, estado e vencidas.
- Opções limitadas a vínculos em tarefas ativas da unidade, sem diretório global para visualizadores.
- Validação de datas/matrícula e erro explícito para intervalo inválido, sem ampliar a busca.
- Testes de parâmetros, limites de dias, combinações, isolamento e formulário.

## Incremento 15 entregue — fila de validação

- Rota `/validacoes` exclusiva do gestor, com contador global da unidade na agenda.
- Concluídas ativas de todos os períodos, busca por título/descrição e paginação.
- Conclusões mais antigas primeiro e identificação de registros legados sem data.
- Mesmo modal e ação transacional de validação; agenda/lista/fila revalidadas explicitamente.
- Testes de autorização, unidade/estados, ordenação, paginação, recorrência e falha/sucesso no modal.

## Incremento 16 entregue — busca sem acentos

- Mesma busca normalizada na lista e na fila de validação.
- Acentos portugueses/latinos comuns e diferenças de maiúsculas/minúsculas, preservando texto original.
- Campo auxiliar com backfill e triggers transacionais para criação/edição/recorrência.
- Migração aditiva, testes de equivalência, Unicode decomposto, atualização e permissões.

## Incremento 17 entregue — backup e recuperação

- Comandos administrativos db:backup/db:restore para SQLite, sem sobrescrever destinos.
- Snapshot consistente via VACUUM INTO, verificação de integridade/vínculos/migrações e publicação após validação.
- Restauração em banco novo, sessões revogadas apenas na cópia e sem alteração de .env.
- Pasta de backups ignorada pelo Git e procedimento de recuperação documentado.
- Testes de WAL, histórico/triggers, destino existente, corrupção e migração incompleta.
- Remoção do banco local do versionamento, retenção, envio externo e revisão de dependências continuam pendentes.

## Incremento 18 entregue — exportação CSV

- Exportação dos filtros aplicados na lista, com todas as páginas até 5.000 tarefas.
- Mesma autenticação e escopo de unidade, sem tarefas arquivadas ou campos internos.
- UTF-8/BOM, separador ponto e vírgula, rótulos em português e escape de células.
- Mitigação de prefixos de fórmula, download com feedback e erros claros sem truncamento.
- Testes de escopo/perfis, filtros, limite, todas as páginas, formato e interface.

## Correção após o incremento 18 — demonstração e atalhos

- Diagnóstico: banco legado sem o usuário leitor@banco.com, apesar do botão Carlos estar visível.
- Comando demo:prepare cria somente perfis faltantes e preserva cadastros existentes; bloqueado fora do modo demo.
- Seletor mostra erros e estado de processamento; contas desativadas continuam bloqueadas.
- Atalhos da agenda separados em navegação com espaçamento e aparência consistente.
- Entrada como Carlos/VIEWER confirmada no Chrome.

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
- **CI:** instalação pelo lockfile, geração do Prisma, lint, tipos, testes e build. Verificar migrações em banco vazio. Pipeline implementado no incremento 5.
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

Com login, autorização e integridade implementados, priorizar gestão de usuários, seguidas da revisão de dependências e preparação operacional antes do piloto. Lembretes e integrações vêm após estabilizar esse fluxo.

## Incremento 19 — Meu dia e duplicação (entregue)

- `/meu-dia`: pendências da unidade por vencidas, hoje e próximos sete dias, filtro por ponto focal, contadores e acesso ao painel existente de detalhes/ações.
- Até 25 tarefas por grupo, com ligação para a consulta completa na lista; somente pendentes e não arquivadas.
- Duplicação pelo painel compartilhado: campos revisáveis, prazo inicialmente vazio, nova tarefa pendente com auditoria própria; permissões do cadastro mantidas no servidor.
- Sem migração de banco. Associação automática entre usuário e ponto focal permanece uma decisão futura.

## Incremento 20 — Filtros favoritos (entregue)

- Consultas nomeadas na lista, com aplicação por link, indicação da consulta atual e remoção.
- Preserva filtros aplicados e reinicia a paginação; datas fixas e vencidas relativas ao dia atual.
- Armazenamento local versionado, separado por usuário e unidade, com limite de dez favoritos; sem migração de banco.
- Validação de nomes e destinos, recuperação de dados corrompidos, falhas de armazenamento com nova tentativa e atualização entre abas.
- Sincronização entre dispositivos e compartilhamento de favoritos permanecem fora desta versão.

## Incremento 21 — Comentários nas tarefas (entregue)

- Seção recolhível no painel compartilhado de detalhes, sem modificar as abas de detalhes e histórico.
- Publicação por administradores/operadores em tarefas não arquivadas da própria unidade; leitura também para visualizadores e tarefas arquivadas.
- Autor registrado no momento da publicação, data e texto limitado a 2.000 caracteres; sem edição/exclusão.
- Carregamento sob demanda, paginação de 20 itens, estados de erro com nova tentativa e preservação de rascunho em falha.
- Migração aditiva `20261109000000_task_comments`, aplicada localmente após backup. Comentários não são copiados em duplicações ou recorrências.

## Incremento 22 — Central de pendências (entregue)

- `/pendencias` acessível pela navegação, com lista unificada e categorias: vencidas, hoje, próximos 15 dias e validações exclusivas do gestor.
- Contadores por categoria, paginação de 25 registros e reaproveitamento do painel compartilhado de detalhes/ações/comentários.
- Consultas por unidade e perfil no servidor, sem arquivadas ou validadas; validações de todos os períodos.
- Botão de atualização manual, horário da última consulta e revalidação da rota após ações de tarefas.
- Sem migração, notificações externas ou rastreamento de leitura. “Meu dia” e fila de validação mantêm suas funções existentes.
