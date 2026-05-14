# CHANGELOG_CODEX.md

Registro objetivo das alteracoes feitas pelo Codex.

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
