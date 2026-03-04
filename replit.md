# Web Highlighter & Comments

A Chrome extension + web dashboard platform for web page highlighting and commenting. Users can highlight text on any webpage, add comments, and manage everything through a web dashboard.

## Architecture

- **Frontend**: React + TypeScript with Vite, Wouter routing, TanStack Query, Shadcn UI components
- **Backend**: Express.js REST API with CORS support for extension
- **Database**: PostgreSQL with Drizzle ORM
- **Chrome Extension**: Manifest V3, React-based UI (shared with client), content scripts, background service worker
- **Styling**: Tailwind CSS with dark mode support
- **Extension Build**: Vite multi-page build with chrome.storage adapter layer

## Data Model

- **highlight_styles**: Configurable highlight colors/styles (name, color, backgroundColor, borderColor, isDefault, sortOrder)
- **pages**: Web pages where highlights exist (url, title, favicon, lastVisited)
- **highlights**: Individual text highlights (pageId, styleId, selectedText, xpath, textOffset, textLength)
- **comments**: Comments attached to highlights (highlightId, text) — supports Markdown rendering

## Pages

- `/` - Dashboard with overview stats and recent pages
- `/highlights` - Browse all highlights with search/filter
- `/pages/:id` - Page detail with highlights and comments
- `/settings` - Manage highlight styles, export data
- `/extension` - Chrome extension features, installation guide, architecture docs

## API Endpoints

- `GET/POST /api/styles` - Highlight styles CRUD
- `PATCH/DELETE /api/styles/:id`
- `GET/POST /api/pages` - Pages
- `GET /api/pages/:id`
- `GET/POST /api/highlights` - Highlights (query param: pageId)
- `DELETE /api/highlights/:id`
- `POST /api/comments` - Add comment
- `PATCH/DELETE /api/comments/:id`
- `POST /api/sync` - Sync endpoint for Chrome extension
- `GET /api/export` - Export all data as JSON

## Chrome Extension (Shared React Architecture)

The extension UI shares the same React components as the web client. Vite builds the extension from client code, using a chrome.storage adapter layer instead of API calls.

### Source Structure

**Extension metadata** (`extension/` directory):
- `manifest.json` - Manifest V3 configuration (source template)
- `icons/` - Extension icons (generated via script/generate-icons.ts)

**All extension source** (`client/src/extension/` directory):
- `content.ts` - Content script for highlighting on pages (toolbar, context menu, comment dialog)
- `content.css` - Styles for toolbar, highlights, popover
- `background.ts` - Service worker for context menus, storage, sync
- `popup/` - Extension popup UI (compact view of highlights, style selector, toggle)
- `dashboard/` - Full dashboard app with sidebar, routing (hash-based), all pages
- `options/` - Settings page rendered standalone

### Data Layer

- `client/src/lib/chrome-storage.ts` - Adapter that transforms chrome.storage.local data into API-compatible shapes (PageWithHighlights, HighlightStyle, etc.)
- `client/src/lib/chrome-query-client.ts` - Drop-in replacement for `queryClient.ts` that routes TanStack Query calls to chrome.storage instead of the API
- Vite alias `@/lib/queryClient` → `chrome-query-client.ts` during extension build

### Build

- `npx tsx script/build-extension.ts` - Builds extension to `dist/extension/`
- Uses `vite.extension.config.ts` for multi-page Vite build (popup, dashboard, options)
- Uses `vite.extension-scripts.config.ts` for content.ts and background.ts (IIFE/ES bundles)
- Copies content.css, icons, and generates manifest.json

## Key Files

- `shared/schema.ts` - Data models and Zod schemas
- `server/db.ts` - Database connection
- `server/storage.ts` - Storage layer with DatabaseStorage
- `server/routes.ts` - API routes
- `server/index.ts` - Express server with CORS middleware
- `client/src/App.tsx` - Main app with sidebar layout
- `client/src/lib/queryClient.ts` - API-based query client (web)
- `client/src/lib/chrome-query-client.ts` - Chrome storage query client (extension)
- `client/src/lib/chrome-storage.ts` - Chrome storage adapter functions
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/theme-provider.tsx` - Dark/light mode
- `client/src/components/markdown-comment.tsx` - Markdown renderer for comments (react-markdown)
- `vite.extension.config.ts` - Vite config for extension UI pages build
- `vite.extension-scripts.config.ts` - Vite config for extension scripts (content.ts, background.ts)
- `script/build-extension.ts` - Extension build script (two Vite builds + copy)
- `script/generate-icons.ts` - Icon generator for extension
