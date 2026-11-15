# Lazuli agent (free)

The endpoint Ask Lazuli calls when nobody has added their own key. It runs on Cloudflare's free
Workers plan and costs nothing:

- **Gemini's free tier** writes the answer. The key lives here, never in the browser.
- **Workers AI** takes over when Gemini is busy, and for visitors in the EEA, UK and Switzerland
  (Gemini's free tier may not be used there).

Google can use free-tier prompts to improve its models. Prompts here are canvas code and a short
description, so nothing personal, but say so in the app's privacy note.

## Set it up (about 10 minutes)

1. A Cloudflare account (free) and a Gemini API key (free, https://aistudio.google.com/apikey).
2. In this folder:

   ```sh
   npx wrangler login
   npx wrangler secret put GEMINI_KEY      # paste the Gemini key when asked
   npx wrangler deploy
   ```

3. Put the Worker's URL in the playground's `.env.local`:

   ```sh
   VITE_AGENT_URL=https://lazuli-agent.<your-subdomain>.workers.dev
   ```

4. Add every site Lazuli runs on to `ALLOWED_ORIGINS` in `wrangler.toml` (comma separated), then
   `npx wrangler deploy` again.

## Limits

- Gemini's free quota per project isn't published; reports range from about 100 to 1,500
  requests a day. Workers AI adds roughly 150 to 240 a day on small models.
- When both run out, the Worker answers 429 and the app suggests adding your own key.
- The origin check stops other websites, not scripts. If someone starts burning the quota, add a
  Cloudflare rate-limiting rule on this route (free plan includes one).
