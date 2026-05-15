# CHANGELOG_CODEX.md

Registro objetivo das alteracoes feitas pelo Codex.

## 2026-05-14
- Tipo: funcional/admin
- Arquivos alterados:
  - `index.html`
  - `css2.css`
  - `script2.js`
  - `sw.js`
  - arquivos de contexto Codex
- Resumo: regras completas do Clube Versatil adicionadas ao modal; painel admin agora orienta upload local permanente, aceita apenas JPG/PNG/WebP, converte para WebP antes do Firebase Storage, grava metadata do upload e impede salvar produto sem imagem adicionada.
- Validacao: `node --check script2.js`; `git diff --check`; Playwright local confirmou regras no modal, estado vazio de imagens no admin, accept do upload, texto de ajuda e conversao PNG para WebP; site publico confirmou `index.html`, `script2.js?v=1.1.14` e `sw.js` atualizados.
- Proxima acao: aguardar proxima instrucao do usuario.

## 2026-05-14
- Tipo: performance/resiliencia
- Arquivos alterados:
  - `index.html`
  - `css2.css`
  - `script2.js`
  - `produto.html`
  - `produto.js`
  - `sw.js`
  - arquivos de contexto Codex
- Resumo: diagnosticado que produtos antigos com imagens quebradas usam URLs do Imgur retornando 403; home agora prioriza assets locais, carrega menos imagens de carrossel, tenta a proxima imagem quando uma URL falha e mostra fallback limpo se todas falharem. Novos uploads no admin passam por redimensionamento/compressao WebP antes do Firebase Storage.
- Validacao: `node --check script2.js`; `node --check produto.js`; `git diff --check`; Playwright local confirmou Nyra/Juna carregando via assets locais, Resist/Mouve usando fallback quando Imgur retorna 403; Playwright publico confirmou pagina 4 carregando Resist/Nyra/Mouve/Juna sem imagem quebrada e produto Juna usando apenas assets locais.
- Proxima acao: reenviar/migrar fotos dos produtos que ainda dependem so do Imgur.

## 2026-05-14
- Tipo: funcional/conversao
- Arquivos alterados:
  - `index.html`
  - `css2.css`
  - `script2.js`
  - `sw.js`
  - arquivos de contexto Codex
- Resumo: clique no banner Clube Versatil agora abre um modal no proprio site com beneficios de cashback, botao para WhatsApp com mensagem automatica e regras expansivas.
- Validacao: `node --check script2.js`; `git diff --check`; Playwright local e publico confirmaram modal em desktop/mobile, beneficios R$10/R$25/R$40, regras visiveis ao clicar e WhatsApp `5571993333570` com mensagem correta.
- Proxima acao: aguardar proxima instrucao do usuario.

## 2026-05-14
- Tipo: ajuste visual/conteudo
- Arquivos alterados:
  - `assets/home/hero-clube-versatil.webp`
  - `css2.css`
  - `index.html`
  - `produto.html`
  - `meus_pedidos.html`
  - `script2.js`
  - `sw.js`
  - arquivos de contexto Codex
- Resumo: banner desktop do Clube Versatil substituido pela arte ajustada; popup promocional de 10% removido; mensagem de 10% removida dos banners rotativos de topo.
- Validacao: imagem desktop convertida para WebP em 1600x733; `node --check script2.js`; Playwright confirmou desktop com `hero-clube-versatil.webp` em `cover`, mobile preservado com `hero-clube-versatil-mobile.webp`, popup ausente e topo sem mensagem de 10%.
- Proxima acao: publicar em `main` e validar no site publico.

## 2026-05-14
- Tipo: ajuste visual/deploy
- Arquivos alterados:
  - `assets/home/hero-clube-versatil.webp`
  - `assets/home/hero-clube-versatil-mobile.webp`
  - `index.html`
  - `css2.css`
  - `script2.js`
  - `sw.js`
  - arquivos de contexto Codex
- Resumo: primeiro hero "Vista sua melhor versao" substituido pelo banner Clube Versatil, com arte exclusiva para desktop e outra para mobile. Texto/CTA antigo em HTML removido desse slide para nao sobrepor o banner.
- Validacao: imagens convertidas para WebP em 1600x900 e 900x1600; `node --check script2.js`; Playwright confirmou desktop usando `hero-clube-versatil.webp` e mobile usando `hero-clube-versatil-mobile.webp`.
- Proxima acao: publicar em `main` e validar no site publico.

## 2026-05-14
- Tipo: deploy
- Arquivos alterados:
  - `assets/home/hero-v1-collection-mobile.webp`
  - `index.html`
  - `css2.css`
  - `script2.js`
  - `sw.js`
  - arquivos de contexto Codex
- Resumo: deploy autorizado para publicar o banner V1 exclusivo de mobile no GitHub Pages, mantendo desktop com o banner original.
- Validacao: `node --check script2.js`, `git diff --check`, Playwright mobile/desktop confirmando assets corretos.
- Proxima acao: acompanhar propagacao do GitHub Pages e validar no celular real.

## 2026-05-14
- Tipo: asset/mobile
- Arquivos alterados:
  - `assets/home/hero-v1-collection-mobile.webp`
  - `index.html`
  - `css2.css`
  - `sw.js`
  - `PROJECT_CONTEXT.md`
  - `TASKS.md`
  - `CHANGELOG_CODEX.md`
- Resumo: adicionada a arte final exclusiva do V1 para mobile, mantendo o banner desktop original; preload e cache incluem o novo asset.
- Validacao: imagem convertida para WebP em 941x1672; Playwright Pixel 5 confirmou mobile usando `hero-v1-collection-mobile.webp` com classe `hero-slide-has-mobile-art`; desktop confirmou uso de `hero-v1-collection.webp`.
- Proxima acao: aguardar validacao visual do usuario ou instrucao de deploy.

## 2026-05-14
- Tipo: ajuste visual/mobile
- Arquivos alterados:
  - `css2.css`
  - `script2.js`
  - `sw.js`
  - `PROJECT_CONTEXT.md`
  - `TASKS.md`
  - `CHANGELOG_CODEX.md`
- Resumo: preparado suporte automatico a artes mobile dos heroes; V1 agora evita corte de informacoes quando usa arte horizontal e passa a usar `assets/home/*-mobile.webp` quando esses arquivos existirem.
- Validacao: `node --check script2.js`; Playwright Pixel 5 confirmou hero com 636px de altura, V1 em fallback sem corte e classe `hero-slide-mobile-art-missing`.
- Proxima acao: criar/enviar imagens mobile 9:16 para acabamento final profissional.

## 2026-05-14
- Tipo: ajuste visual/mobile
- Arquivos alterados:
  - `css2.css`
  - `script2.js`
  - `PROJECT_CONTEXT.md`
  - `TASKS.md`
  - `CHANGELOG_CODEX.md`
  - `CODEX_COMMANDS.md`
- Resumo: removida a altura mobile especial do slide V1, padronizando a proporcao do hero; V1 agora exibe informacoes completas em texto/CTA no mobile e preserva o banner original no desktop.
- Validacao: comparacao mobile com referencia da Live; Playwright em Pixel 5 confirmou os 3 slides com 570px de altura e `background-size: cover`; desktop confirmou conteudo V1 oculto para evitar duplicacao.
- Proxima acao: aguardar validacao visual do usuario ou instrucao de deploy.

## 2026-05-14
- Tipo: setup/contexto
- Arquivos alterados:
  - `AGENTS.md`
  - `PROJECT_CONTEXT.md`
  - `TASKS.md`
  - `CHANGELOG_CODEX.md`
  - `CODEX_WORKFLOW.md`
  - `CODEX_COMMANDS.md`
- Resumo: criada estrutura persistente de contexto, tarefas, fluxo de trabalho e comandos uteis. Nenhuma alteracao funcional, visual, textual de produto, estilo ou logica foi feita.
- Validacao: checagem leve da raiz antes da criacao dos arquivos; arquivos de contexto confirmados apos escrita.
- Proxima acao: aguardar nova instrucao do usuario.

## Proximos registros
- Tipo:
- Arquivos alterados:
- Resumo:
- Validacao:
- Proxima acao:
