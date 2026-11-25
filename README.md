# SentinelAI

SentinelAI analyzes customer feedback, detects sentiment changes, and supports
investigating trends through an interactive dashboard.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

This project uses Next.js API routes for dashboard data, uploads, alerts, and
investigations. GitHub Pages only serves static files and cannot run these
routes, so deploy the app to a Next.js host such as Vercel instead.

To deploy with Vercel:

1. Import this GitHub repository into Vercel and leave the framework preset as
   Next.js.
2. Deploy the `main` branch. Vercel will build and publish the app on each push.
3. Optionally add `GEMINI_API_KEY` for AI-assisted answers and investigations.
   The app has an offline fallback when this key is not configured.
4. Optionally add `SLACK_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL` to send alerts
   to a webhook.

Use the deployment URL shown by Vercel. A GitHub Pages URL will not serve this
server-backed app.

## Checks

```bash
npm test
npm run lint
npm run build
```
