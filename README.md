# SentinelAI

SentinelAI analyzes customer feedback, detects sentiment changes, and supports
investigating trends through an interactive dashboard.

- **Live App (GitHub Pages):** [https://naveenk8288.github.io/sentrine/](https://naveenk8288.github.io/sentrine/)
- **Live App (Vercel Full Server Edition):** [https://sentinel-ai-beta-ten.vercel.app](https://sentinel-ai-beta-ten.vercel.app)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

### GitHub Pages (Static Edition)

This repository includes [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml),
which builds a static export (`npm run build:pages`) with client-side VADER
sentiment scoring, anomaly detection, CSV upload analysis, and grounded
extractive Q&A.

To publish on GitHub Pages, set **Settings -> Pages -> Build and deployment -> Source**
to **GitHub Actions**.

### Vercel (Full Server + Gemini AI / Webhooks)

1. Import this GitHub repository into Vercel and leave the framework preset as
   Next.js.
2. Deploy the `main` branch. Vercel builds server API routes (`/api/*`) on each push.
3. Optionally add `GEMINI_API_KEY` for Gemini-powered answers and investigations
   (falls back cleanly to extractive mode when unset).
4. Optionally add `SLACK_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL` for live alerts.

## Checks

```bash
npm test
npm run lint
npm run build
npm run build:pages
```
