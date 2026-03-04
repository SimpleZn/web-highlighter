# Web Highlighter & Comments

A Chrome extension + web dashboard platform for web page highlighting and commenting. Users can highlight text on any webpage, add comments, and manage everything through a web dashboard.

## Architecture

- **Frontend**: React + TypeScript with Vite, Wouter routing, TanStack Query, Shadcn UI components
- **Backend**: Express.js REST API with CORS support for extension
- **Database**: PostgreSQL with Drizzle ORM
- **Chrome Extension**: Manifest V3, content scripts, popup, options page
- **Styling**: Tailwind CSS with dark mode support

## Data Model

- **highlight_styles**: Configurable highlight colors/styles (name, color, backgroundColor, borderColor, isDefault, sortOrder)
- **pages**: Web pages where highlights exist (url, title, favicon, lastVisited)
- **highlights**: Individual text highlights (pageId, styleId, selectedText, xpath, textOffset, textLength)
- **comments**: Comments attached to highlights (highlightId, text)

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

## Chrome Extension

Source files in `extension/` directory:
- `manifest.json` - Manifest V3 configuration
- `src/content.js` - Content script for highlighting on pages (toolbar, context menu, comment dialog)
- `src/content.css` - Styles for toolbar, highlights, popover
- `src/background.js` - Service worker for context menus, storage, sync
- `popup.html/js/css` - Extension popup UI
- `options.html/js/css` - Extension settings page

Build: `npx tsx script/build-extension.ts` outputs to `dist/extension/`

## Key Files

- `shared/schema.ts` - Data models and Zod schemas
- `server/db.ts` - Database connection
- `server/storage.ts` - Storage layer with DatabaseStorage
- `server/routes.ts` - API routes
- `server/index.ts` - Express server with CORS middleware
- `client/src/App.tsx` - Main app with sidebar layout
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/theme-provider.tsx` - Dark/light mode
- `script/build-extension.ts` - Extension build script
- `script/generate-icons.ts` - Icon generator for extension
