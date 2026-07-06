# Render Deployment

This project deploys as a Render Node service without Docker.

## Settings

- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:prod`
- Root Directory: repository root

## Environment

```env
NODE_VERSION=16.20.2
NODE_ENV=production
DATABASE_URL=<Render PostgreSQL URL>
JWT_SECRET=<strong secret>
JWT_EXPIRES_IN=7d
CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32 byte key>
APP_URL=https://your-api.onrender.com
CHECKOUT_URL=https://your-checkout-app.example
```

Generate a credential key with:

```bash
openssl rand -base64 32
```
