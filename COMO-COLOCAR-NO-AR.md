# Santos & Veloso: publicar e administrar o site

O site público pode ficar no GitHub Pages. O painel usa Supabase para autenticação, banco de dados e fotos; não depende da Netlify.

- **Demonstração pública:** https://cacetius.github.io/santos-e-veloso-site/
- **Código:** https://github.com/cacetius/santos-e-veloso-site
- A vitrine lê o catálogo do Supabase. Se o projeto ainda não estiver configurado, mostra os dados de demonstração de `public/imoveis.json`.

## 1. Criar e configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com/). Guarde a senha do banco no seu gerenciador de senhas; ela não é a senha do painel.
2. No projeto, abra **SQL Editor**, copie todo o conteúdo de [`supabase/setup.sql`](./supabase/setup.sql) e execute.
3. Em **Authentication → Users**, crie um usuário para cada pessoa autorizada a editar. Use e-mails individuais, senhas longas e únicas. Não habilite cadastro público de usuários.
4. Copie o UUID do usuário autorizado. No SQL Editor, execute a consulta abaixo substituindo o UUID pelo valor mostrado no Supabase:

   ```sql
   insert into public.site_admins (user_id)
   values ('UUID-DO-USUARIO-AUTORIZADO');
   ```

   Só usuários listados em `site_admins` podem alterar imóveis ou enviar fotos. A chave pública do site não concede essa permissão.

5. Em **Project Settings → API Keys**, copie a URL do projeto e a chave **publishable** (ou a chave pública `anon`, se a interface ainda mostrar esse nome).
6. No arquivo [`public/supabase-config.js`](./public/supabase-config.js), preencha `url` e `anonKey` com esses dois valores públicos.
7. Faça commit e push na branch `main`. O GitHub Actions atualizará o GitHub Pages automaticamente. A primeira publicação pode levar alguns minutos.
8. Abra a demonstração, pressione **Ctrl + Alt + L** (ou **Cmd + Option + L** no Mac) e entre com o e-mail e a senha do usuário autorizado.

**Nunca coloque a chave `service_role` ou outra chave secreta em `public/`, no GitHub, neste guia ou no chat.** A configuração do navegador só deve conter a URL e a chave pública `publishable`/`anon`; a segurança de gravação é feita pelas políticas RLS aplicadas pelo SQL.

## 2. Como editar

- **Abrir o painel:** no computador, pressione **Ctrl + Alt + L**. No celular, segure a logo por 2 segundos.
- **Editar imóvel:** selecione-o, altere os campos e salve.
- **Adicionar:** use **＋ Adicionar imóvel**, preencha os dados e envie as fotos. A primeira foto vira a capa.
- **Preço vazio:** aparece “Consulte o valor”.
- **Excluir:** abra o imóvel e confirme duas vezes; salve para publicar a alteração.
- **Sair:** use **Sair**. A sessão fica no armazenamento da aba do navegador e expira conforme a configuração de autenticação do Supabase.

## 3. Cuidados de segurança

- Mantenha o cadastro público de usuários desativado e conceda acesso somente aos e-mails necessários.
- Ative MFA na conta Supabase e GitHub.
- A tabela e o bucket são públicos para leitura porque a vitrine precisa mostrar imóveis e fotos. A gravação é restrita por RLS aos usuários cadastrados em `site_admins`.
- Não coloque endereço residencial, documentos, dados de proprietários ou informações que não devam ser públicas nos anúncios.
- Para remover um administrador, apague seu registro de `public.site_admins`; para bloquear o login, desative também a conta em **Authentication → Users**.
- A demonstração GitHub Pages é pública e serve só os arquivos estáticos; o Supabase atende a leitura, autenticação e gravação.

## 4. Testes e implementação

- `npm test` roda os testes de segurança da API Netlify antiga, mantida no repositório, mas não utilizada pelo painel atual.
- O painel atual usa [`public/supabase.js`](./public/supabase.js) e as permissões definidas em [`supabase/setup.sql`](./supabase/setup.sql).
- A configuração pública do navegador fica em `public/supabase-config.js`; não use ali uma chave secreta.
