# PROJECT_CONTEXT.md

Memoria objetiva do projeto para orientar proximas sessoes do Codex.

## Nome e descricao
- Nome: Seja Versátil (`sejaversatil.github.io`).
- Descricao: site estatico de e-commerce de moda fitness feminina publicado via GitHub Pages.

## Objetivo comercial
- Vender moda fitness feminina com foco em colecoes, produtos em destaque, carrinho e conversao por WhatsApp/checkout.

## Identidade visual e posicionamento
- Identidade visual: estetica premium fitness, contraste preto/branco, logo serifada com espacemento amplo e imagens editoriais de performance.
- Posicionamento: moda fitness feminina versatil para treino, rua e rotina.
- Tom de comunicacao: direto, promocional e aspiracional.

## Decisoes ja tomadas
- Criar uma estrutura persistente de contexto para reduzir releitura, gasto de tokens e dependencia do historico da conversa.
- Usar `AGENTS.md`, `PROJECT_CONTEXT.md`, `TASKS.md`, `CHANGELOG_CODEX.md`, `CODEX_WORKFLOW.md` e `CODEX_COMMANDS.md` como base operacional.
- Mobile da home deve manter os banners do hero na mesma proporcao/altura, seguindo referencia da Live: quadro vertical consistente, imagem em `cover` e informacoes completas em camada de texto/CTA.
- O slide V1 deve preservar o banner original no desktop, mas no mobile deve usar texto/CTA em HTML para evitar banner horizontal achatado.
- Para o resultado mobile ideal, os heroes precisam de artes mobile dedicadas em `assets/home/hero-spin-mobile.webp`, `assets/home/hero-performance-mobile.webp` e `assets/home/hero-v1-collection-mobile.webp`.
- Proporcao recomendada para heroes mobile: 9:16, idealmente 1080x1920 px em WebP. Manter informacoes importantes dentro da area segura central.

## Estrutura geral do projeto
- Estrutura tecnica: HTML/CSS/JS estatico.
- Home principal em `index.html`, estilos globais em `css2.css` e logica principal em `script2.js`.
- Pagina de produto em `produto.html`, `produto.css` e `produto.js`.
- Checkout em `checkout.html`, `checkout.css` e `checkout.js`.
- Assets principais em `assets/home` e `assets/products`.

## Arquivos principais
- `index.html`
- `css2.css`
- `script2.js`
- `produto.html`
- `produto.css`
- `produto.js`
- `checkout.html`
- `checkout.css`
- `checkout.js`

## Padroes importantes
- Design: mobile com header fixo, top banner rotativo e hero em tela vertical com setas/dots.
- Textos: CTAs curtos em caixa alta e chamadas comerciais objetivas.
- Navegacao: categorias, favoritos, carrinho, busca e WhatsApp flutuante.
- Logica: carousel do hero em `script2.js`; responsividade do hero em `css2.css`.
- Validacao: servidor estatico local e Playwright/mobile quando houver ajuste visual.

## Estado atual conhecido
- Setup de contexto criado.
- Banner mobile V1 ajustado para usar a mesma altura/proporcao dos demais slides do hero.
- Codigo do hero preparado para trocar automaticamente para artes mobile quando os arquivos `*-mobile.webp` existirem.
- O V1 ja possui arte mobile dedicada em `assets/home/hero-v1-collection-mobile.webp`; desktop continua usando `assets/home/hero-v1-collection.webp`.
- Projeto aguardando proxima instrucao do usuario.

## Pontos sensiveis
- Nao alterar design, layout, textos, estilos ou comportamento sem pedido explicito.
- Nao refatorar sem autorizacao.
- Nao reanalisar o projeto inteiro em tarefas futuras.
- Nao substituir padroes existentes por solucoes genericas quando a estrutura do projeto for identificada.
- Cuidado com regras duplicadas no fim de `css2.css`; as regras finais costumam sobrescrever blocos anteriores.
- Nao transformar o slide V1 desktop sem pedido, pois ele usa informacao embutida na imagem original.

## Pendencias atuais
- Confirmar fluxo de deploy/publicacao desejado.
- Produzir/substituir imagens mobile dedicadas dos outros heroes, se necessario, na proporcao 9:16.
- Confirmar comandos de lint/testes, se existirem.

## Observacoes para proximas sessoes
- Antes de qualquer nova tarefa, ler `AGENTS.md`, `PROJECT_CONTEXT.md`, `TASKS.md` e consultar `CHANGELOG_CODEX.md` se houver necessidade de historico.
- Tratar cada nova acao como tarefa isolada.
- Atualizar estes arquivos ao final de cada tarefa com registros curtos.
