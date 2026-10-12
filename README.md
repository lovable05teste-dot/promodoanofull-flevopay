# Sales Page Clone

clone esta pagina de vendas

This project was built with [Lovable](https://lovable.dev).

## Comprovantes de pagamento

O painel fica em `/admin`. Configure `ADMIN_PASSWORD` somente no ambiente do servidor.

- Em Vercel, conecte um Vercel Blob privado ao projeto. A integração cria `BLOB_READ_WRITE_TOKEN` automaticamente.
- Em desenvolvimento local ou VPS, os arquivos são gravados em `./uploads`. Para trocar a pasta, configure `UPLOAD_DIR`.
- O upload aceita JPG, PNG, WEBP, GIF e PDF de até 4 MB.

**Live app**: https://atividadesinfantilpro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3dbedfd1-52b0-48de-ac98-9fd2d062a3d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
