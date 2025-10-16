# Deployment Guide

This document outlines how to deploy the Next.js Voice Agent starter to both Heroku and Vercel. The repository now includes a `Procfile` and an explicit Node.js engine declaration so the app runs the same way on either platform.

## Shared preparation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables:
   ```bash
   cp sample.env .env
   ```
3. Replace `DEEPGRAM_API_KEY` with a valid key in `.env`.
4. Run `npm run build` locally to verify the project compiles before deploying.

## Heroku deployment

### Prerequisites

- A Heroku account.
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed and authenticated (`heroku login`).

### Configure the app

1. Create the Heroku application (choose a unique name):
   ```bash
   heroku create your-app-name
   ```
   The default Node.js buildpack is suitable; no additional buildpacks are required.

2. Ensure the new `Procfile` is committed so Heroku exposes the Next.js production server:
   ```
   web: npm run start -- --port $PORT
   ```

3. Set required environment variables on Heroku. At minimum, provide the Deepgram API key:
   ```bash
   heroku config:set DEEPGRAM_API_KEY=your_real_key --app your-app-name
   ```

4. Push the code to Heroku. If using the main branch:
   ```bash
   git push heroku main
   ```

   Heroku runs `npm install` followed by `npm run build` (via the `heroku-postbuild` script) and starts the server with `npm run start`.

5. Visit the deployed app:
   ```bash
   heroku open --app your-app-name
   ```

### Optional adjustments

- **Custom domain**: Follow [Heroku’s domain documentation](https://devcenter.heroku.com/articles/custom-domains).
- **Scaling**: Use `heroku ps:scale web=1` (or more) to adjust dyno counts.
- **Logging**: Tail logs with `heroku logs --tail --app your-app-name`.

## Vercel deployment

Vercel remains the primary zero-config platform for Next.js. No repository changes are required beyond the ones already present.

1. Install the [Vercel CLI](https://vercel.com/docs/cli) and run `vercel login`.
2. From the project root, run:
   ```bash
   vercel
   ```
   Follow the prompts to create or link a Vercel project.
3. When prompted for environment variables, add `DEEPGRAM_API_KEY`. You can import variables from `.env` with:
   ```bash
   vercel env add
   ```
4. Subsequent deployments can be triggered with:
   ```bash
   vercel --prod
   ```

Vercel automatically handles builds (`npm run build`) and starts the optimized Next.js serverless runtime. The explicit Node.js engine setting (`20.x`) keeps local, Heroku, and Vercel environments aligned.

## Post-deployment checklist

- Confirm audio input permissions when visiting the deployed site.
- Test conversational flows to verify Deepgram integration.
- Monitor platform dashboards (Heroku or Vercel) for build/output logs.
