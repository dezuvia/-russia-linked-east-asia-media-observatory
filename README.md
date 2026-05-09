# PutinIsland Frontend

Dashboard frontend for the local PutinIsland SQLite dataset.

## Local Dashboard

Runs the React app plus the local read-only API that reads SQLite.

```bash
npm install
npm run dev
```

Default data paths:

- SQLite: `/Users/chia-shuotang/Documents/PutinIsland/data/putinisland.sqlite`
- Source candidate markdown: `/Users/chia-shuotang/Documents/PutinIsland/sources/media_candidates.md`

Override with:

```bash
PUTINISLAND_DB_PATH=/path/to/putinisland.sqlite \
PUTINISLAND_MEDIA_CANDIDATES_PATH=/path/to/media_candidates.md \
npm run dev
```

## Public Static Mode

Public mode exports a safe JSON snapshot under `public/data/` and builds a static
site for GitHub Pages. It does not publish SQLite, raw captured article text, or
local `content_path` values.

```bash
npm run build:public
```

For GitHub Pages project URLs, set the repository base path:

```bash
VITE_BASE_PATH=/PutinIsland_frontend/ npm run build:public
```
