# natsel

**Continuous product evolution by natural selection.** LLMs breed small, isolated
changes to your product ("genes"); live traffic decides which ones survive.
No control version, no hand-run experiments: losing genes get their code deleted,
winning genes get merged and their flag removed.

> Status: 💡 concept. The site explains the idea; specs, SDK and Control Plane come next.

📖 **Site and docs:** https://natsel.vapnik.de/

## What's here

| Path | What |
|---|---|
| `docs/` | Landing page, concept and guides. Deployed to Cloudflare on every push to `main`. |
| `diagrams/` | TakeSix sources of the site diagrams; rendered HTML goes to `docs/assets/diagrams/`. |
| `mkdocs.yml` | Site config (MkDocs Material). |
| `wrangler.jsonc` | Cloudflare Worker that serves the built site (`site/`) at natsel.vapnik.de. |
| `redirect/` | Stub published to GitHub Pages: the old vvapnik.github.io/natsel/ redirects to the new address. |
| `.github/workflows/deploy.yml` | Builds the site with `mkdocs build --strict`, deploys it with wrangler, publishes the redirect stub. |

## Docs locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-docs.txt
.venv/bin/mkdocs serve
```

A new page = a Markdown file in `docs/` plus a line in `nav` in `mkdocs.yml`.

## Deploy

The site runs on a Cloudflare Worker with static assets (free plan). Every push to `main`
deploys it from GitHub Actions. One-time setup:

1. The `vapnik.de` zone is on Cloudflare. The Worker claims `natsel.vapnik.de` as a custom
   domain on first deploy (DNS record and certificate are created automatically).
2. Create an API token: Cloudflare dashboard → My Profile → API Tokens → template
   **Edit Cloudflare Workers**, limited to your account and the `vapnik.de` zone.
3. Add repository secrets (Settings → Secrets and variables → Actions):
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (Workers & Pages overview, right column).
4. GitHub Pages stays enabled with source **GitHub Actions**: it serves only the redirect stub.

Manual deploy from a laptop:

```bash
.venv/bin/mkdocs build --strict
npx wrangler deploy
```

## License

MIT, see [LICENSE](LICENSE).

## AI-assisted development

natsel is developed with the help of [Claude Code](https://claude.com/claude-code) (Anthropic).
