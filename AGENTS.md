# AGENTS.md

Instrucao permanente de trabalho para o Codex neste projeto.

## Objetivo do projeto
- A confirmar.
- Este arquivo existe para manter contexto persistente, reduzir releitura e orientar execucoes futuras sem depender do historico da conversa.

## Fontes principais de contexto
Antes de qualquer acao, leia primeiro:
1. `PROJECT_CONTEXT.md`
2. `TASKS.md`
3. `CHANGELOG_CODEX.md`

Use estes arquivos como fonte principal de contexto. Nao dependa do historico temporario da conversa.

## Regras de trabalho
- Faca uma tarefa por vez.
- Prefira alteracoes pequenas, cirurgicas e diretamente ligadas ao pedido.
- Nunca refatore por conta propria sem pedido explicito.
- Nao mude design, estrutura, textos, estilos, layout ou comportamento alem do escopo solicitado.
- Nao crie solucoes genericas se o projeto ja tiver estrutura, padroes ou helpers existentes.
- Preserve alteracoes ja aplicadas. Nao refaca nem reverta mudancas sem necessidade clara.
- Se houver duvida, inspecione o minimo necessario antes de agir.

## Economia de contexto
- Nao reanalise o projeto inteiro a cada comando.
- Nao reabra arquivos ja analisados, a menos que sejam diretamente necessarios para a tarefa atual.
- Leia primeiro arquivos de contexto e depois somente os arquivos minimos ligados ao escopo.
- Evite abrir arquivos grandes sem necessidade.
- Evite comandos pesados sem motivo claro.
- Nao repetir na resposta contexto ja salvo nos arquivos.

## Como decidir quais arquivos ler
- Comece por `PROJECT_CONTEXT.md`, `TASKS.md` e, se houver historico relevante, `CHANGELOG_CODEX.md`.
- Identifique a area afetada pela tarefa.
- Leia arquivos de entrada, configuracao ou componentes diretamente relacionados.
- Use buscas pontuais para localizar simbolos, rotas, componentes ou funcoes.
- Pare de explorar assim que houver contexto suficiente para agir com seguranca.

## Como lidar com tarefas
- Pequenas: ler contexto, localizar o arquivo exato, alterar o minimo, validar rapidamente e registrar.
- Medias: mapear os arquivos envolvidos, executar em etapas curtas, validar cada parte importante e registrar decisoes.
- Grandes: dividir em subtarefas, confirmar escopo quando necessario, evitar mudancas amplas sem autorizacao e manter `TASKS.md` atualizado.

## Validacao
- Validar somente o necessario para a alteracao feita.
- Preferir comandos leves e especificos.
- Nao rodar build pesado, testes longos ou comandos destrutivos sem necessidade ou pedido.
- Se nao for possivel validar, registrar o motivo na resposta e no changelog.

## O que nao fazer sem autorizacao
- Refatorar codigo.
- Alterar identidade visual, layout, textos, estilos ou comportamento fora do escopo.
- Trocar bibliotecas, frameworks ou arquitetura.
- Remover arquivos, dependencias ou configuracoes.
- Reverter alteracoes do usuario.
- Rodar comandos destrutivos ou pesados sem justificativa.

## Ao terminar uma tarefa
- Atualize `PROJECT_CONTEXT.md` se houver nova decisao, padrao ou estado importante.
- Atualize `TASKS.md` com status, criterios e proximos passos.
- Atualize `CHANGELOG_CODEX.md` com resumo curto.
- Responda de forma objetiva com: arquivos alterados, o que foi feito e como validar.
