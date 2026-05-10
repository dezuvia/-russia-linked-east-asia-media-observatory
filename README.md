# Russia-Linked East Asia Media Observatory

Static and local dashboard for monitoring Russia-linked media narratives about
East Asia.

中文名稱：俄羅斯關聯東亞媒體觀測站

## Local Dashboard

Runs the React app plus a local read-only API that reads SQLite.

```bash
npm install
npm run dev
```

The local API reads dataset paths from environment variables:

```bash
PUTINISLAND_DB_PATH=/path/to/putinisland.sqlite \
PUTINISLAND_MEDIA_CANDIDATES_PATH=/path/to/media_candidates.md \
npm run dev
```

## Public Static Mode

Public mode exports a safe JSON snapshot under `public/data/` and builds a
static site for GitHub Pages. It does not publish SQLite, raw captured article
text, or local `content_path` values.

The public export first runs keyword translation enrichment against the local
SQLite database, so new DB keywords are added to `scripts/keyword-translations.json`
before `public/data/articles.json` is regenerated.

```bash
npm run build:public
```

For GitHub Pages project URLs, set the repository base path:

```bash
VITE_BASE_PATH=/russia-linked-east-asia-media-observatory/ npm run build:public
```
