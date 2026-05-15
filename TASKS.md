# TASKS.md

Controle da tarefa atual.

## Tarefa atual
- Aguardando proxima instrucao do usuario.

## Status
- Causa identificada: imagens antigas do Imgur retornando 403.
- Fallback e tentativa automatica de proxima imagem implementados na home.
- Priorizacao de assets locais implementada na home e pagina de produto.
- Compressao WebP para novos uploads no Firebase implementada.
- Alteracao publicada e validada no site publico.
- Nenhuma tarefa funcional em andamento.

## Criterios de conclusao
- Produtos com imagem local carregam antes de tentar Imgur.
- Se uma URL falhar, o card tenta a proxima imagem do produto.
- Se nenhuma imagem carregar, o card mostra fallback limpo sem icone quebrado.
- Novos uploads sao otimizados antes de ir ao Firebase Storage.
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
