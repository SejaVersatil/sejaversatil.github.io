# TASKS.md

Controle da tarefa atual.

## Tarefa atual
- Aguardando proxima instrucao do usuario.

## Status
- Ajuste de seguranca Firebase publicado: configuracao removida dos HTMLs principais e centralizada em `firebase-init.js`.
- GitHub Pages validado sem `firebaseConfig`, `apiKey` direta ou `measurementId` no `index.html` publico.
- Proxima protecao obrigatoria deve ser feita no console Firebase/Google Cloud: restricao da API key por HTTP referrer, App Check e revisao de Rules.

## Criterios de conclusao
- HTMLs principais nao devem conter `apiKey`, `measurementId`, `firebaseConfig` ou valores diretos da configuracao Firebase.
- Firebase deve continuar inicializando na home, produto, checkout, meus pedidos e admin.
- O projeto deve registrar a orientacao de seguranca real: Rules, App Check e restricao de chave por referrer.
- Nao alterar design, textos comerciais, produtos, estoque ou fluxo de compra.
- Contexto atualizado ao final.

## Proximos passos
- Receber nova instrucao do usuario.
- Ler os arquivos de contexto antes de agir.
- Identificar os arquivos minimos necessarios para a tarefa.

## O que nao fazer
- Nao iniciar alteracoes funcionais sem pedido.
- Nao refatorar sem autorizacao explicita.
- Nao alterar layout, textos, estilos ou logica fora do escopo.
- Nao rodar comandos pesados sem necessidade.
- Nao reprocessar o projeto inteiro.

## Historico resumido
- 2026-05-14: Criado setup persistente de contexto e operacao do Codex. Nenhuma alteracao funcional realizada.
- 2026-05-14: Ajustado hero mobile para o slide V1 usar a mesma altura dos demais banners, com texto/CTA em camada no mobile.
- 2026-05-14: Preparado suporte a imagens mobile dedicadas dos heroes e fallback V1 sem corte de informacoes.
- 2026-05-14: Aplicada arte mobile final do banner V1, mantendo desktop com a arte original.
- 2026-05-14: Deploy do ajuste mobile V1 autorizado para o GitHub Pages.
- 2026-05-14: Primeiro hero trocado para Clube Versatil, com assets separados para desktop e mobile.
- 2026-05-14: Banner desktop Clube Versatil substituido por arte ajustada; popup e mensagem de 10% removidos.
- 2026-05-14: Modal do Clube Versatil criado no clique do banner, com CTA para WhatsApp e regras expansivas.
- 2026-05-14: Diagnosticadas falhas de imagens por links Imgur 403; implementado fallback, carregamento mais economico e compressao WebP em novos uploads.
- 2026-05-14: Regras completas do Clube Versatil adicionadas e fluxo de upload/cadastro manual de produto no admin reforcado.
- 2026-05-15: Otimizacao de carregamento mobile-first aplicada: preload do hero ativo, lazy/defer para imagens e videos abaixo da dobra, favicon leve e service worker enxuto.
- 2026-05-15: Deploy da otimizacao publicado e validado no GitHub Pages.
- 2026-05-15: Modal Clube Versatil redesenhado para modelo em 3 passos com Pix destacado, mantendo regras e WhatsApp.
- 2026-05-15: Icones do modal Clube Versatil corrigidos para ficarem centralizados e proporcionais como na referencia.
- 2026-05-15: Icones refinados novamente: telefone preenchido, pessoas separadas se olhando e presente maior.
- 2026-05-15: Menu hamburguer reorganizado e modal Nossa Essencia criada com texto institucional completo.
- 2026-05-15: Icone "Indique amigas" do modal Clube Versatil ajustado para duas pessoas preenchidas e separadas com coracao acima.
- 2026-05-15: Botao "Ver Produtos" da modal Nossa Essencia ajustado para ficar menor, delicado e alinhado a direita.
- 2026-05-15: Upgrade do painel admin de estoque com resumo, filtros, busca, edicao inline, exportacao CSV e melhorias responsivas.
- 2026-05-15: Guia de Medidas estruturado em modal na home/menu mobile e pagina de produto, usando a imagem oficial anexada.
- 2026-05-15: Suporte do menu mobile e footer desktop estruturado em modal unica com conteudos de frete, trocas, pagamento e atendimento.
- 2026-05-15: Prompt de notificacoes redesenhado para o visual premium da marca.
- 2026-05-15: Hero mobile Clube Versatil ajustado para manter somente a seta direita de avancar.
- 2026-05-17: Badge antiga de pre-venda normalizada para "Lançamento" e countdown removido da vitrine.
- 2026-05-27: Inicializacao Firebase centralizada fora dos HTMLs, documentacao de seguranca Firebase adicionada e publicacao validada no GitHub Pages.
