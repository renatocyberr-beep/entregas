# Prime Entregas — Sistema de Controle de Ponto

Sistema web de ponto eletrônico com registro por **foto**, **geolocalização** e **relatórios exportáveis**.

## O que o sistema faz

**Para os colaboradores** (tela inicial, `/`):
- Login simples por matrícula + PIN
- Bater ponto: Entrada, Saída, Início de Intervalo, Fim de Intervalo
- Tira a foto pela câmera do celular na hora do registro
- Captura a localização GPS automaticamente
- Funciona em qualquer celular com navegador (não precisa instalar app)

**Para o gestor** (painel admin, `/admin/login.html`):
- Cadastro, edição e desativação de colaboradores (com PIN)
- Relatório de todos os registros, com filtro por colaborador e período
- Foto e localização (link direto pro Google Maps) de cada registro
- Exportação do relatório em Excel (.xlsx)

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org) instalado (versão 18 ou superior).

```bash
cd prime-entregas-ponto
npm install
npm start
```

O sistema sobe em: **http://localhost:3000**

- Tela de bater ponto: `http://localhost:3000/`
- Painel admin: `http://localhost:3000/admin/login.html`

## Acesso inicial (criado automaticamente no primeiro start)

| Perfil | Usuário/Matrícula | Senha/PIN |
|---|---|---|
| Admin | `admin` | `prime123` |
| Colaborador de teste | `001` | `1234` |

**Troque a senha do admin e o PIN do colaborador de teste assim que possível** (pelo próprio painel, em Colaboradores → Editar; a troca de senha do admin ainda precisa ser feita direto no banco — posso adicionar essa tela se você quiser).

## Onde ficam os dados

- Banco de dados: `data/ponto.db` (SQLite — arquivo único, fácil de fazer backup)
- Fotos dos registros: `public/uploads/`

## Colocando no ar para os colaboradores usarem de verdade (Render.com — grátis)

Para os entregadores acessarem pelo celular de qualquer lugar, o sistema precisa estar num endereço público com HTTPS (a câmera e a localização do navegador só funcionam em conexão segura). Abaixo o passo a passo usando o Render, que tem plano gratuito sem cartão de crédito.

**1. Subir o código no GitHub** (o Render hospeda a partir de um repositório):
- Crie uma conta grátis em github.com, se ainda não tiver.
- Clique em "New repository", dê um nome (ex: `prime-entregas-ponto`) e crie (pode ser privado).
- Na página do repositório recém-criado, clique em "uploading an existing file" e arraste para lá todos os arquivos e pastas do projeto (a pasta `prime-entregas-ponto` extraída do zip), **exceto** a pasta `node_modules` (ela não existe se você não rodou `npm install` — tudo bem, o Render instala sozinho) e a pasta `data` (o banco será criado automaticamente). Depois clique em "Commit changes".

**2. Criar o serviço no Render**:
- Crie uma conta grátis em render.com (dá pra entrar direto com a conta do GitHub, facilita).
- Clique em "New +" → "Web Service" e conecte o repositório que você acabou de criar.
- Configure:
  - **Runtime**: Node
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
  - **Plan**: Free
- Em "Environment Variables", adicione uma variável `JWT_SECRET` com um valor aleatório e seguro (posso gerar um pra você).
- Clique em "Create Web Service" e aguarde o deploy (2 a 5 minutos).

Ao final, o Render te dá um link público, algo como `https://prime-entregas-ponto.onrender.com` — esse é o link que os colaboradores vão usar no celular (a tela de bater ponto já é a página inicial).

**Limitações importantes do plano gratuito do Render:**
- O serviço "dorme" depois de ~15 minutos sem uso, e o primeiro acesso depois disso demora uns 30-60 segundos para acordar.
- O disco é temporário: se o serviço reiniciar ou for atualizado, o banco de dados (`data/ponto.db`) e as fotos enviadas (`public/uploads/`) **são apagados**. Isso é ótimo para testar, mas para uso real no dia a dia da empresa (sem perder os registros de ponto), o ideal é migrar para o plano pago com "Persistent Disk" (a partir de ~US$7/mês) — posso te ajudar a fazer essa migração quando for a hora.

Se der algum erro durante o deploy, me manda a mensagem de erro (o Render mostra os logs na própria tela) que eu te ajudo a resolver.

## Possíveis melhorias futuras

- Tela para o admin trocar a própria senha
- Cálculo automático de horas trabalhadas / horas extras / atrasos no relatório
- Notificação (WhatsApp/e-mail) quando alguém não bate ponto até certo horário
- Geofencing (só permitir bater ponto dentro de um raio da base/rota)
- Reconhecimento facial para validar que a foto é da pessoa cadastrada
