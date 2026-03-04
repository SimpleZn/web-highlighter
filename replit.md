# Web Highlighter & Comments

A Chrome extension management platform for web page highlighting and commenting. Users can highlight text on any webpage, add comments, and manage everything through a web dashboard.

## Architecture

- **Frontend**: React + TypeScript with Vite, Wouter routing, TanStack Query, Shadcn UI components
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
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
- `/extension` - Chrome extension installation guide and source files

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

## Key Files

- `shared/schema.ts` - Data models and Zod schemas
- `server/db.ts` - Database connection
- `server/storage.ts` - Storage layer with DatabaseStorage
- `server/routes.ts` - API routes
- `client/src/App.tsx` - Main app with sidebar layout
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/theme-provider.tsx` - Dark/light mode
