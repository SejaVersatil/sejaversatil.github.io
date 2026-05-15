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
- O primeiro hero foi trocado para Clube Versatil: desktop usa `assets/home/hero-clube-versatil.webp` e mobile usa `assets/home/hero-clube-versatil-mobile.webp`.
- Clique no banner Clube Versatil abre um modal premium na home com fluxo em 3 passos, icones refinados conforme referencia (telefone preenchido, duas pessoas preenchidas e separadas com coracao acima, e presente maior), destaque de Pix, botao "Quero meu codigo" para WhatsApp e botao "Ver regras".
- "Ver regras" do Clube Versatil agora exibe regras completas, valores de cashback, validacao, restricoes, validade e chamada final para solicitar codigo.
- Menu hamburguer mobile organizado em grupos: Explore, Conta, Categorias, Colecoes e Suporte. "Nossa Essencia" abre modal propria com o texto institucional completo; link do footer "Nossa Essencia" abre a mesma modal.
- Modal Nossa Essencia usa CTA discreto "Ver Produtos", com capitalizacao normal, tamanho menor e alinhamento no canto direito da area de conteudo.
- Itens de suporte e Guia de Medidas no menu mobile direcionam ao WhatsApp com mensagem especifica.
- Popup promocional de 10% removido da home.
- Mensagem de 10% removida dos banners rotativos de topo da home, produto e meus pedidos.
- Imagens quebradas em produtos antigos foram diagnosticadas como URLs externas do Imgur retornando 403, nao como limite confirmado do Firebase. Produtos com assets locais em `assets/products` carregam corretamente.
- Home prioriza imagens locais quando existem, carrega menos imagens do carrossel ao mesmo tempo e tenta a proxima imagem antes de mostrar fallback visual.
- Upload local de novas imagens pelo admin aceita JPG/PNG/WebP, converte para WebP antes de enviar ao Firebase Storage e registra o download URL no produto.
- Produto novo no admin nao recebe mais imagem/gradiente padrao automaticamente; e necessario adicionar pelo menos uma imagem antes de salvar.
- Performance mobile foi priorizada: a home carrega primeiro apenas o hero ativo correto por viewport, adia heroes secundarios, imagens abaixo da dobra, produtos e videos, e usa favicon/icones leves.
- Service worker passou a manter cache inicial enxuto, com app shell, icones pequenos e hero ativo; imagens/estaticos continuam com estrategia cache-first apos requisicao.
- Projeto aguardando proxima instrucao do usuario.

## Pontos sensiveis
- Nao alterar design, layout, textos, estilos ou comportamento sem pedido explicito.
- Nao refatorar sem autorizacao.
- Nao reanalisar o projeto inteiro em tarefas futuras.
- Nao substituir padroes existentes por solucoes genericas quando a estrutura do projeto for identificada.
- Cuidado com regras duplicadas no fim de `css2.css`; as regras finais costumam sobrescrever blocos anteriores.
- Nao transformar o slide V1 desktop sem pedido, pois ele usa informacao embutida na imagem original.
- Produtos antigos com todas as fotos no Imgur precisam ter fotos reenviadas/migradas para `assets/products` ou Firebase Storage; fallback visual nao recupera imagem removida/bloqueada na origem.

## Pendencias atuais
- Confirmar fluxo de deploy/publicacao desejado.
- Produzir/substituir imagens mobile dedicadas dos outros heroes, se necessario, na proporcao 9:16.
- Confirmar comandos de lint/testes, se existirem.
- Reenviar/migrar fotos dos produtos antigos que ainda dependem exclusivamente do Imgur, como Conjunto Resist e Conjunto Mouve.
- Acompanhar desempenho real no celular apos deploy e repetir teste em rede movel se houver nova lentidao percebida.

## Observacoes para proximas sessoes
- Antes de qualquer nova tarefa, ler `AGENTS.md`, `PROJECT_CONTEXT.md`, `TASKS.md` e consultar `CHANGELOG_CODEX.md` se houver necessidade de historico.
- Tratar cada nova acao como tarefa isolada.
- Atualizar estes arquivos ao final de cada tarefa com registros curtos.
