# Guia da Agenda da Unidade

Este guia descreve o uso da aplicação. Para instalação e comandos, consulte o [README](../README.md); para senhas, [autenticação](AUTENTICACAO.md); para cópias e recuperação do banco, [operação](OPERACAO.md).

## Acesso e perfis

Entre com e-mail e senha em `/login`. O gestor cadastra usuários da unidade, mas a senha é provisionada pelo responsável pelo ambiente usando `npm run auth:provision -- --email email-do-usuario`. O cadastro público é fechado; recuperação de senha é administrativa. Em desenvolvimento, o modo demo permite alternar entre perfis quando não há segredo de autenticação configurado. Use **Sair** para encerrar uma sessão por senha.

| Ação na própria unidade | Visualizador | Operador | Gestor |
| --- | --- | --- | --- |
| Consultar agenda, arquivo, lista, comentários e etapas | Sim | Sim | Sim |
| Criar, duplicar, editar e concluir tarefa pendente | Não | Sim | Sim |
| Comentar tarefa ativa e editar etapas de tarefa pendente | Não | Sim | Sim |
| Planejar cópias anuais e substituir ponto focal em lote | Não | Sim | Sim |
| Consultar fila de validação e validar conclusão | Não | Não | Sim |
| Arquivar/restaurar tarefas e administrar usuários | Não | Não | Sim |
| Exportar resultados da lista para CSV | Sim | Sim | Sim |

Tarefas arquivadas permitem consulta, mas não edição, conclusão, validação ou novos comentários. O gestor pode restaurá-las. Ações e consultas são limitadas à unidade da sessão.

## Tarefas e ciclo de vida

Na agenda, preencha **Novo compromisso** com título e prazo, escolha periodicidade e pontos focais e adicione detalhes se necessário. O título e o prazo são obrigatórios. Abra uma tarefa em uma visão para consultar **Detalhes**, **Histórico**, comentários e etapas. O operador ou gestor pode editar e concluir uma tarefa pendente. Após a conclusão, o gestor valida; uma tarefa validada encerra o ciclo.

Uma tarefa recorrente gera a próxima ocorrência ao ser validada, com base no prazo anterior. Sem repetição e eventual não geram ocorrência automática. Ao editar ou duplicar, confira a periodicidade: uma cópia recorrente também poderá gerar nova ocorrência após validação.

Em **Ver etapas**, acompanhe até 100 itens. Operadores e gestores podem adicionar, marcar e remover etapas enquanto a tarefa estiver pendente e ativa. Etapas não bloqueiam a conclusão. Em **Ver comentários**, publique ou consulte mensagens de até 2.000 caracteres; elas são independentes do histórico automático. Comentários publicados não têm edição ou exclusão pela interface.

Para **Duplicar tarefa**, abra os detalhes, selecione a ação, revise os campos e informe um novo prazo. A nova tarefa nasce pendente e preserva título, descrição, periodicidade e pontos focais. Histórico, comentários, etapas e vínculo de recorrência não são copiados. Na fila de validação e no arquivo, o formulário mostra os pontos focais originais; para adicionar outros, edite a cópia pendente depois de criá-la.

O gestor pode arquivar informando motivo e confirmação. **Arquivadas** mostra tarefas da unidade de todos os períodos; abra uma e escolha **Restaurar tarefa** para retorná-la com prazo e estado anteriores. O histórico é preservado.

## Acompanhar e localizar

- **Calendário:** alterne entre mês e ano, navegue pelos períodos ou use **Hoje**. Na visão anual, selecione um dia com tarefas e depois uma tarefa. Nos quadros de prazo da agenda, abra a faixa desejada para detalhar suas pendências.
- **Meu dia:** reúne vencidas, hoje e próximos sete dias. **Toda a unidade** aceita filtro por ponto focal. **Minhas tarefas** usa o vínculo da conta com um ponto focal; sem vínculo, peça ao gestor que o configure. Cada grupo mostra até 25 itens e oferece acesso à lista completa.
- **Pendências:** agrupa vencidas, prazo hoje e próximos 15 dias. Para gestores, inclui tarefas aguardando validação. Os contadores filtram uma lista paginada; use **Atualizar pendências** para buscar alterações de outras pessoas.
- **Lista de tarefas:** busque parte do título ou descrição com ou sem acentos e combine estado, ponto focal, datas de prazo e **Todas as vencidas**. A opção de vencidas considera pendências anteriores a hoje e prevalece sobre o estado escolhido. Clique em **Aplicar filtros** antes de exportar ou salvar a consulta. Resultados são paginados por prazo.
- **Favoritos:** na lista, nomeie e salve uma consulta aplicada para reutilizá-la na conta, inclusive em outro dispositivo. Há até dez por unidade. Favoritos da versão anterior podem ser importados do navegador; duplicados ou excedentes permanecem locais para revisão.
- **Exportar CSV:** exporta os resultados da consulta aplicada, de todas as páginas, até 5.000 tarefas. Acima disso, refine os filtros. O arquivo contém título, descrição, prazo, estado, periodicidade e nomes dos pontos focais.
- **Resumo:** escolha mês e ano para consultar indicadores de tarefas ativas por mês de prazo e abrir as listas correspondentes.
- **Fila de validação:** exclusiva do gestor, reúne conclusões ativas de todos os períodos, ordenadas pela data de conclusão. Abra uma tarefa, confira os dados e valide. Registros antigos sem data aparecem identificados.

Os prazos usam dias civis no fuso do servidor para filtros e agrupamentos; configure o ambiente com o fuso da unidade. Indicadores dos quadros da agenda abrangem o período exibido, enquanto a central e a fila de validação possuem escopos próprios.

## Planejamento anual

Abra **Planejamento anual** e informe ano de conclusão, ano de destino e, se desejar, quem concluiu. O ano é o da conclusão, não o do prazo. O resultado inclui concluídas, validadas e arquivadas da unidade; registros sem data de conclusão não entram. Usuários desativados continuam disponíveis no filtro.

Selecione até 25 tarefas da página, confira informações e descrição, escolha um prazo no ano de destino para cada uma e confirme. As cópias seguem as mesmas regras da duplicação individual. A tela avisa sobre cópias feitas anteriormente pelo planejamento e sobre a próxima ocorrência recorrente no ano de destino. Ela não detecta todas as cópias manuais nem outras ocorrências: confira a lista quando necessário. Se ocorrer erro de conexão, **Tentar novamente** envia os mesmos dados e chave para evitar duplicar o mesmo lote.

## Substituição de ponto focal

Na **Lista de tarefas**, gestores e operadores podem abrir **Substituir ponto focal em lote**. Escolha a pessoa atual e a substituta, consulte a prévia e confirme. A operação inclui tarefas pendentes e não arquivadas da unidade com prazo a partir de hoje. Os demais pontos focais são preservados, e o substituto não é duplicado quando já participa da tarefa.

Cada confirmação processa até 200 tarefas. Se houver mais, repita a consulta para continuar. Uma mudança nas tarefas depois da prévia exige nova consulta. Cada alteração é registrada no histórico, e o lote é revertido se a gravação falhar. O cadastro de funcionários é global; esta operação não altera o vínculo entre a conta e o funcionário. Ocorrências futuras geradas por recorrência herdam os pontos focais da tarefa validada.

## Administração e aparência

Em **Gerenciar usuários**, o gestor cadastra usuários, altera nome e perfil e pode desativar ou reativar outras contas da unidade. Alterações de perfil e situação revogam sessões; desativar bloqueia o acesso sem excluir histórico. O gestor não pode se rebaixar ou desativar. O histórico administrativo mostra os últimos 100 eventos da unidade.

Na seção **Vínculo com ponto focal**, associe uma conta a um funcionário presente em tarefa da unidade. Uma matrícula pode estar vinculada a uma única conta; a associação é auditada. O cadastro global de funcionários não possui gestão de lotação pela interface.

O seletor **Tema** oferece Sistema, Claro e Escuro. A preferência fica no navegador. A interface oferece navegação por teclado, foco visível, atalho para o conteúdo e nomes para controles; o diálogo de tarefa mantém o foco interno e aceita Escape quando não há operação em andamento.
