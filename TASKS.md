# TASKS.md

Controle da tarefa atual.

## Tarefa atual
- Aguardando proxima instrucao do usuario.

## Status
- Otimizacoes de carregamento aplicadas, publicadas em `main` e validadas no site publico.
- Nenhuma tarefa funcional em andamento.

## Criterios de conclusao
- Mobile deve priorizar somente o hero ativo da viewport no carregamento inicial.
- Desktop deve manter qualidade visual e tambem evitar preloads desnecessarios.
- Produtos, videos e backgrounds abaixo da dobra devem carregar de forma adiada/lazy.
- Favicon e icones devem ser leves.
- Service worker deve evitar precache pesado.
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
