# natsel

**Continuous product evolution by natural selection.** LLMs breed small, isolated
changes to your product ("genes"); live traffic decides which ones survive.
No control version, no hand-run experiments: losing genes get their code deleted,
winning genes get merged and their flag removed.

> Status: 💡 concept. The site explains the idea; specs, SDK and Control Plane come next.

📖 **Site and docs:** https://vvapnik.github.io/natsel/

## What's here

| Path | What |
|---|---|
| `docs/` | Landing page, concept and guides. Published to GitHub Pages on every push to `main`. |
| `diagrams/` | TakeSix sources of the site diagrams; rendered HTML goes to `docs/assets/diagrams/`. |
| `mkdocs.yml` | Site config (MkDocs Material). |
| `.github/workflows/pages.yml` | Builds the site with `mkdocs build --strict` and deploys it. |

## Docs locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-docs.txt
.venv/bin/mkdocs serve
```

A new page = a Markdown file in `docs/` plus a line in `nav` in `mkdocs.yml`.

## License

MIT, see [LICENSE](LICENSE).

## AI-assisted development

natsel is developed with the help of [Claude Code](https://claude.com/claude-code) (Anthropic).
