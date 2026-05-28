# FIREBASE_SECURITY.md

Guia curto para manter o Firebase seguro em um site publico no GitHub Pages.

## Ponto principal
- A configuracao Web do Firebase e entregue ao navegador por natureza.
- `apiKey`, `projectId`, `authDomain`, `storageBucket`, `appId` e `measurementId` nao devem ser tratados como senha.
- A seguranca real deve ficar em regras do Firestore/Storage, App Check, restricoes de chave e validacao de admin no servidor/Firebase Rules.

## Ja aplicado no projeto
- Configuracao removida dos arquivos HTML principais.
- Inicializacao centralizada em `firebase-init.js`.
- Inicializacao bloqueada fora dos hosts esperados:
  - `sejaversatil.github.io`
  - `www.sejaversatil.github.io`
  - `localhost`
  - `127.0.0.1`

## Checklist no Firebase/Google Cloud
- Restringir a API key por HTTP referrer para:
  - `https://sejaversatil.github.io/*`
  - `https://www.sejaversatil.github.io/*`, se usar esse host.
- Ativar Firebase App Check para Web.
- Revisar Firestore Rules: leitura publica somente do que precisa ser publico; escrita administrativa apenas para UID presente em `/admins/{uid}` com `role == "admin"`.
- Revisar Storage Rules: upload/escrita apenas para admins; leitura publica somente das imagens que devem aparecer na loja.
- Garantir que dados sensiveis de pedidos/clientes nao sejam legiveis por usuarios nao autenticados.

## Observacao importante
Para remover a configuracao tambem do codigo publicado no navegador, seria necessario deixar de acessar Firebase direto pelo frontend e passar por um backend/Cloud Functions. Em GitHub Pages puro, qualquer dado usado pelo navegador pode ser inspecionado pelo visitante.
