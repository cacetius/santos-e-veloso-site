# Santos & Veloso: como colocar o site no ar

O site tem duas partes:

- **Vitrine** (pasta `public/`): o que os clientes veem.
- **Servidor** (pasta `netlify/`): confere a senha do painel e guarda os imóveis e as fotos.

Por causa do servidor, o site **não pode mais ser publicado arrastando arquivos** na Netlify Drop. Ele precisa ir pelo GitHub. Você faz isso uma vez; depois, editar imóveis é só pelo painel.

---

## 1. Subir o projeto no GitHub (uns 10 minutos)

1. Crie uma conta grátis em github.com, se ainda não tiver.
2. Clique em **New repository**.
   - Nome: `santos-e-veloso-site`
   - Marque **Private**.
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Descompacte o zip que eu te mandei. Abra a pasta `santos-e-veloso-site` e arraste **tudo o que está dentro dela** para a página do GitHub:
   - as pastas `public`, `netlify` e `tests`;
   - os arquivos `netlify.toml`, `package.json` e este guia.
5. Clique em **Commit changes**.

> Confira no GitHub se o `netlify.toml` ficou na raiz, e não dentro de outra pasta. Se ficar dentro de outra pasta, o site não funciona.

## 2. Ligar o GitHub à Netlify

1. Entre em app.netlify.com com a sua conta.
2. Abra o site que você já tem (o `keen-trifle-817f35` ou o nome que você deu).
3. Vá em **Site configuration → Build & deploy → Link repository**, escolha **GitHub** e depois o repositório `santos-e-veloso-site`.
4. A Netlify lê as configurações do `netlify.toml` sozinha. Se ela perguntar:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
   - Build command: deixe vazio
5. Clique em **Deploy**.

Se não aparecer a opção de ligar o repositório nesse site, use **Add new site → Import an existing project → GitHub**. Depois troque o nome em **Site configuration → Change site name**.

## 3. Criar a senha do painel (o passo mais importante)

Em **Site configuration → Environment variables → Add a variable**, crie estas duas:

| Nome | Valor |
| --- | --- |
| `ADMIN_SENHA` | A senha que você vai digitar no painel. Mínimo de 10 caracteres; use 14 ou mais, misturando palavras e números. |
| `SESSAO_SEGREDO` | Uma sequência aleatória de **40 ou mais caracteres**. Ninguém precisa decorar. Use o gerador de senhas do iPhone ou do Google e cole aqui. |

Depois vá em **Deploys → Trigger deploy → Deploy site**. As variáveis só valem depois desse novo deploy.

> Sem essas duas variáveis, o painel não abre para ninguém, nem para você. Isso é proposital: o site nunca roda com senha vazia ou fraca.

## 4. Testar

1. Abra o site no computador e aperte **Ctrl + Alt + L** (no Mac, **Cmd + Option + L**).
2. Digite a senha e confira se a lista de imóveis aparece.
3. Toque em **Salvar** e depois atualize a página: a alteração aparece para todo mundo.
4. No celular, **segure o dedo no logo do topo por 2 segundos** para abrir o painel.

## 5. Usar no dia a dia

- **Abrir o painel:** no computador, entre em **Contato** e aperte **Ctrl + Alt + L**. Digite a senha. No Mac, use **Cmd + Option + L**. No celular, segure o logo por 2 segundos.
- **Mudar um dado:** toque no imóvel, edite e toque em **Salvar**. As alterações só valem depois de salvar.
- **Adicionar imóvel:** no painel, toque em "＋ Adicionar imóvel", preencha os campos e coloque as fotos. Depois toque em **Salvar**. A primeira foto vira a capa.
- **Fotos:** podem ser tiradas direto do celular. O site reduz cada foto para no máximo 1600 px antes de enviar. A primeira foto vira a capa; a estrela troca a capa.
- **Preço:** deixe vazio para aparecer "Consulte o valor".
- **Vendeu?** Abra o imóvel e toque em **Excluir imóvel** duas vezes. Depois toque em **Salvar**.
- **Corretores:** use **Falar com os corretores** no topo do site para escolher Leandro ou Juan e abrir o WhatsApp. Os números são configurados no código do site.
- **Anunciar para venda:** preencha o formulário da aba **Vender**; a mensagem com os dados do imóvel será preparada no WhatsApp do Leandro.
- **Simulação:** a aba abre os simuladores e páginas oficiais da CAIXA, POUPEX, Itaú e Santander. As condições são definidas por cada instituição.
- **Desfazer:** a cada salvamento, o servidor guarda a versão anterior. Se alguém apagar algo por engano, dá para recuperar.
- **Sair:** use "Sair" no painel quando usar um computador que não é seu. O login também expira sozinho em 8 horas.

## 6. Domínio próprio (opcional)

1. Registre `santoseveloso.com.br` em registro.br, no CPF ou CNPJ do cliente (cerca de R$ 40 por ano).
2. Na Netlify, vá em **Domain management → Add a domain** e siga as instruções de DNS.
3. O certificado de segurança (o cadeado) é instalado automaticamente.

## Segurança: o que protege o painel

- **O atalho não é a proteção, a senha é.** Qualquer pessoa que descobrir o Ctrl+Alt+L só vê uma tela pedindo senha. Quem confere a senha é o servidor, nunca o navegador.
- **Limite de tentativas:** depois de 5 senhas erradas, aquele aparelho fica bloqueado por 15 minutos.
- **Login com prazo:** o acesso é uma "chave" assinada pelo servidor que vence em 8 horas. Para derrubar todos os logins na hora, troque o `SESSAO_SEGREDO` e faça um novo deploy.
- **Trocar a senha:** altere o `ADMIN_SENHA` e faça um novo deploy.
- Para trocar a senha: na Netlify, abra **Site configuration → Environment variables**, edite `ADMIN_SENHA` e depois faça **Deploys → Trigger deploy → Deploy site**. A senha não é alterada dentro do painel de imóveis.
- **Dados conferidos:** o servidor recusa códigos repetidos, preços inválidos, fotos de outros sites e qualquer texto com `<` ou `>`. Com isso, ninguém consegue injetar código pelo painel.
- **Fotos conferidas:** só aceita JPG, PNG ou WEBP de verdade (o servidor confere o conteúdo, não só o nome), com até 4 MB.
- **Cabeçalhos de segurança** no `netlify.toml`: bloqueiam scripts de outros sites, impedem que o site seja aberto dentro de outro site e forçam HTTPS.

## Para quem programa

- `npm install` e depois `npm test` rodam os 12 testes de segurança da API.
- `ADMIN_SENHA=senha-local-123 SESSAO_SEGREDO=$(openssl rand -hex 24) node tests/servidor-local.mjs` abre o site em http://localhost:8888, com o painel funcionando e os dados guardados em memória.
- O código do servidor fica em `netlify/lib/api.mjs`. As funções em `netlify/functions/` só ligam esse código ao Netlify Blobs.
