# D7 Player IPTV - Guia de ImplantaÃ§Ã£o no Netlify

Este projeto foi preparado para ser implantado no Netlify como um PWA completo com um backend de proxy para evitar problemas de CORS.

## Como Implantar no Netlify

1. **Conecte seu RepositÃ³rio:**
   - No painel do Netlify, clique em "Add new site" > "Import an existing project".
   - Conecte ao seu GitHub/GitLab/Bitbucket.

2. **ConfiguraÃ§Ãµes de Build:**
   - O Netlify deve detectar automaticamente o arquivo `netlify.toml`, mas caso precise:
   - **Build Command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `functions`

3. **VariÃ¡veis de Ambiente:**
   - Se o seu app usa chaves de API, adicione-as em "Site settings" > "Environment variables".

## Estrutura do Projeto

- `dist/`: ContÃ©m o frontend estÃ¡tico (Vite).
- `functions/api.ts`: ContÃ©m o backend Express convertido para Netlify Functions.
- `netlify.toml`: Configura as rotas e redirecionamentos para que `/api/*` funcione corretamente.

## Gerando o APK (PWA)

1. ApÃ³s o deploy, pegue a URL do seu site no Netlify (ex: `https://seu-app.netlify.app`).
2. VÃ¡ para [PWABuilder.com](https://www.pwabuilder.com/).
3. Insira a URL do seu site.
4. O PWABuilder encontrarÃ¡ o `manifest.json` e o `sw.js` automaticamente.
5. Clique em "Build & Download" para gerar o APK para Android.

## Ãcones

Certifique-se de que os arquivos `icon-192x192.png` e `icon-512x512.png` estÃ£o na pasta `public` antes de fazer o deploy.
