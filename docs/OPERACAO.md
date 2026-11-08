# Backup e recuperação local

Os comandos usam o SQLite configurado no `.env`, sem publicar dados em serviços externos. Requerem dependências instaladas e cliente Prisma gerado (`npm run db:prepare`). O banco deve conter as tabelas de domínio/autenticação/auditoria e o histórico de migrações; arquivos incompletos ou de outro projeto são recusados.

## Criar backup

```bash
npm run db:backup
# Ou escolha um arquivo novo:
npm run db:backup -- --output backups/antes-da-atualizacao.db
```

Sem `--output`, a cópia recebe data/hora UTC na pasta `backups/`. O caminho de origem é obtido de DATABASE_URL: caminhos relativos, como `file:./dev.db`, são resolvidos a partir de `prisma/`, seguindo o schema. O destino informado na linha de comando é relativo à pasta de execução.

O comando usa [VACUUM INTO do SQLite](https://www.sqlite.org/lang_vacuum.html#vacuuminto) para uma cópia consistente, incluindo dados confirmados no WAL. Ele escreve primeiro em diretório temporário privado junto ao destino, verifica integridade, chaves estrangeiras, tabelas esperadas e migrações incompletas, sincroniza o arquivo e só então disponibiliza o destino. Um arquivo existente nunca é substituído. Em falhas normais, os temporários são removidos; uma interrupção abrupta pode deixar uma pasta `.agenda-snapshot-*` para inspeção/limpeza posterior.

Os arquivos finais recebem permissão 0600; a pasta padrão nova recebe 0700 em sistemas Unix. Os backups contêm dados, hashes de senhas e sessões. Não possuem criptografia automática. `backups/` está no gitignore; guarde cópias externas protegidas e não envie arquivos de banco ao repositório. A ferramenta não agenda backups nem remove versões antigas.

## Restaurar em um arquivo novo

```bash
npm run db:restore -- --source backups/arquivo.db --output backups/restaurado.db
```

O comando valida a origem, cria uma cópia em destino novo, revoga as sessões somente nessa cópia e verifica o resultado. Preserva tarefas, histórico, usuários, senhas, índices, migrações e triggers. Recusa destinos existentes e não altera o `.env` ou o banco ativo. Usuários deverão entrar novamente quando a aplicação passar a usar o banco restaurado.

A restauração reflete o estado do backup, incluindo senhas/perfis daquela data. Revogar sessões não desfaz essa característica de recuperação para um ponto anterior.

## Exercício de recuperação

1. Crie um backup antes de atualizar a aplicação ou aplicar migrações.
2. Restaure em arquivo novo, mantendo a origem e o banco ativo intactos.
3. Confira o banco restaurado com seu caminho absoluto:

   ```bash
   DATABASE_URL="file:/caminho/completo/restaurado.db" npm run db:status
   DATABASE_URL="file:/caminho/completo/restaurado.db" npm run db:check
   ```

4. Se precisar de migrações pendentes, aplique-as **na cópia restaurada**, usando o mesmo DATABASE_URL com `npm run db:prepare`. Não execute seed ou reset para recuperar dados.
5. Confira tarefas, históricos e vínculos. Para testar a aplicação, utilize esse banco em um servidor separado antes de trocar a instalação principal.
6. Pare a aplicação antes de alterar seu DATABASE_URL para o arquivo recuperado; reinicie e confira o acesso. O comando de restauração não faz essa troca automaticamente.

`db:check` compara estrutura de tabelas/índices, mas não verifica triggers. O exercício automatizado de recuperação também altera uma tarefa na cópia para comprovar a manutenção do trigger de busca.

## Limites

Backup e restauração são comandos administrativos locais, sem interface web ou agendamento. Falta de espaço, bloqueio prolongado do banco ou permissões podem interromper a operação; o destino final não é anunciado antes da verificação. Não há retenção automática, criptografia, envio externo ou teste de recuperação em outra máquina nesta entrega. O banco local `prisma/dev.db` ainda é versionado; removê-lo do controle de versão permanece uma mudança separada.
