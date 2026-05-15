# TASKS.md

Controle da tarefa atual.

## Tarefa atual
- Aguardando proxima instrucao do usuario.

## Status
- Regras completas do Clube Versatil adicionadas ao botao "Ver regras".
- Upload local do admin reforcado para JPG/PNG/WebP, conversao WebP e envio ao Firebase Storage.
- Produto novo passa a exigir pelo menos uma imagem adicionada antes de salvar.
- Alteracao publicada em `main` e validada no site publico.
- Nenhuma tarefa funcional em andamento.

## Criterios de conclusao
- Modal do Clube Versatil deve mostrar regras completas ao clicar em "Ver regras".
- Botao "Ver regras" deve alternar para "Ocultar regras" com `aria-expanded`.
- Admin deve aceitar upload local apenas de JPG, PNG ou WebP.
- Imagem local deve ser convertida para WebP antes do upload ao Firebase Storage.
- Produto novo nao deve salvar sem pelo menos uma imagem adicionada.
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
