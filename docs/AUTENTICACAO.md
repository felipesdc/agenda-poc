# Login por e-mail e senha

A agenda usa Better Auth 1.7.18 com adaptador Prisma e SQLite. A integração segue a [documentação do adaptador Prisma](https://better-auth.com/docs/adapters/prisma) e do [login por senha](https://better-auth.com/docs/authentication/email-password). Não há serviço de autenticação externo nem cadastro público.

## Preparar a instalação

Use Node 20.19 ou superior; o projeto fixa Node 22 em `.nvmrc`, versão usada na verificação deste incremento.

```bash
npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
```

Em um banco novo de desenvolvimento, o seed opcional cria os usuários e funcionários fictícios: `npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts`. Ele redefine os perfis demo quando executado novamente; não o use para atualizar bancos existentes.

Em instalação existente, preserve o seu `.env` e apenas acrescente as variáveis novas. Faça backup do banco antes de aplicar migrações. O novo conjunto de tabelas é aditivo; a migração não altera usuários, perfis, unidades ou tarefas existentes.

Gere um segredo:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Cole o resultado apenas no `.env` local como `BETTER_AUTH_SECRET`. O exemplo versionado mantém esse valor vazio. Configure também:

```dotenv
BETTER_AUTH_URL="http://localhost:3000"
DEMO_MODE="false"
```

`BETTER_AUTH_URL` deve corresponder à origem usada no navegador. Para produção, use a origem HTTPS e um segredo próprio. O servidor rejeita configuração de login de produção com HTTP. Reinicie a aplicação após mudar a configuração. O segredo deve ter pelo menos 32 caracteres; use o gerador acima, não uma frase previsível.

## Provisionar o primeiro acesso

O usuário precisa existir no diretório `User`, com nome, e-mail, perfil e unidade. O seed cria Alice, Bob e Carlos para desenvolvimento, sem senhas padrão. Para atribuir uma senha a Alice:

```bash
npm run auth:provision -- --email admin@banco.com
```

O terminal pede a senha e a confirmação sem exibir o que foi digitado. São aceitos 12 a 128 caracteres. Não há argumento de senha na linha de comando. O comando também aceita uma senha por stdin para automação em ambiente controlado.

O provisionamento cria/atualiza a identidade vinculada ao usuário existente, grava o hash produzido pelo Better Auth e preserva seu perfil/unidade. Não cria usuários de domínio automaticamente. E-mails administrativos devem estar normalizados em minúsculas, como os do seed.

Depois:

```bash
npm run dev
```

Abra http://localhost:3000/login. Usuários autenticados veem o botão **Sair** na agenda.

## Redefinir uma senha

Execute o mesmo comando de provisionamento para o e-mail desejado. A nova senha substitui a anterior e todas as sessões desse usuário são revogadas na mesma transação. Só quem tem acesso administrativo ao servidor/banco deve executar esse comando.

Este incremento não envia e-mail de recuperação e não oferece MFA. A interface orienta o usuário a contatar o administrador. Gestores administram os usuários da unidade em `/usuarios`.

## Sessões e autorização

As tabelas `AuthUser`, `AuthAccount`, `AuthSession`, `AuthVerification` e `AuthRateLimit` guardam a autenticação. O ID de `AuthUser` referencia o mesmo `User` do domínio; uma identidade não pode existir sem esse vínculo.

O cookie de sessão é gerenciado e assinado pelo Better Auth, com HttpOnly e SameSite=Lax; origens HTTPS usam Secure. O login da interface usa cookie de sessão de navegador (`rememberMe=false`). A sessão no banco tem expiração de 8 horas e pode ser renovada durante uso, com intervalo de atualização de uma hora. Cookies e expiração não substituem o botão Sair: o logout revoga o registro da sessão.

A aplicação consulta a sessão no servidor e depois busca perfil/unidade no diretório atual. Não usa o cookie antigo `userId`, dados de perfil enviados pelo formulário ou cache de identidade para autorizar as ações. Uma mudança de perfil/unidade vale na requisição seguinte. As Server Actions continuam validando suas permissões e o escopo da tarefa.

O cadastro público e os endpoints de alteração pública da identidade ficam fechados. Login e logout são servidos em `/api/auth/[...all]`, sem cache HTTP. A página `/login` é dinâmica, inclusive quando a configuração é fornecida apenas ao iniciar o servidor após o build.

## Tentativas e origem

A [limitação de requisições do Better Auth](https://better-auth.com/docs/concepts/rate-limit) está ativada com armazenamento em banco. Login permite até 10 tentativas por minuto. Enquanto a topologia de proxy não estiver definida, o limite é compartilhado por caminho: cabeçalhos de IP enviados pelo cliente não são confiados. Antes de ampliar o piloto, configurar os proxies confiáveis conforme a hospedagem para separar os contadores por cliente.

Validação de origem e CSRF ficam explicitamente habilitadas, inclusive nos testes. A configuração aceita apenas a origem do próprio app; não há curinga de origens.

## Modo demonstração

Para continuar usando a troca de perfis sem senha localmente, mantenha `BETTER_AUTH_SECRET` vazio e defina `DEMO_MODE=true`. Isso só funciona fora de produção. Ao configurar um segredo, o seletor e o cookie de demonstração deixam de ser aceitos, mesmo que `DEMO_MODE=true` permaneça no ambiente.

## Evidências e limites

Os testes usam a biblioteca real, SQLite temporário e o handler HTTP: login válido/inválido, cookie forjado, expiração, logout, atualização de perfil, revogação após redefinição, bloqueio de cadastro/origem externa, limite de tentativas e cookie Secure em HTTPS.

O fluxo também foi exercitado contra o servidor Next com um banco copiado e segredo efêmero. O comando de provisionamento foi executado sobre essa cópia. O banco original e as senhas de usuários reais não foram alterados. Navegador real não foi verificado: o host de automação estava indisponível. As interações dos componentes estão cobertas no JSDOM.

## Cadastro pela interface

Gestores podem criar o perfil de usuários da própria unidade em `/usuarios`, antes do provisionamento de senha. A edição de nome/perfil sincroniza a identidade e revoga sessões em uma transação. A consulta da sessão continua buscando o perfil atual no domínio. E-mail/unidade permanecem fixos; a tela permite desativar/reativar, sem exclusão física.

## Contas desativadas

O gestor pode desativar outras contas de sua unidade em `/usuarios`. A alteração revoga sessões, bloqueia a criação de novas sessões por senha e impede o uso da sessão demo. A leitura do usuário autenticado exige isActive=true em cada acesso. O login mantém mensagem genérica para falha. A reativação exige novo login e preserva a senha existente. Provisionar/redefinir senha não reativa contas.

## Preparação não destrutiva da demonstração

`npm run demo:prepare` cria apenas os perfis fictícios ausentes, incluindo leitor@banco.com (Carlos). Exige modo demo, ambiente fora de produção e ausência de BETTER_AUTH_SECRET. Usa a unidade do administrador demo existente e não redefine nomes, papéis ou situação das contas. O seletor mostra erros quando o perfil não existe ou está desativado. A preparação por CLI, assim como o seed, não gera auditoria de alterações administrativas da interface.
