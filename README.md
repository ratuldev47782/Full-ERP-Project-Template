# ERP Authentication (Next.js frontend + Express backend)

A minimal foundation for the ERP: user registration and user login only.

- `frontend/` — Next.js App Router, JavaScript, Tailwind CSS
- `backend/` — Express, MySQL, Drizzle ORM

## Setup

1. Install both projects:

   ```bash
   npm run install:all
   ```

2. Create the MySQL database:

   ```sql
   CREATE DATABASE erp_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Set your MySQL credentials in `backend/.env`.

4. Create the table defined in `backend/models/model.js`:

   ```bash
   npm run db:push
   ```

5. Run both servers (separate terminals):

   ```bash
   npm run dev:backend    # http://localhost:5000
   npm run dev:frontend   # http://localhost:3000
   ```

   Open http://localhost:3000 → you are redirected to `/login`.

## Pages

| Page | Path | Notes |
| --- | --- | --- |
| Login | `/login` | User name + password |
| Registration | `/register` | 7 fields incl. profile picture |
| Protected home | `/` | Only reachable while signed in |

## API (Express)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register (multipart form + optional picture) |
| POST | `/api/auth/login` | Log in and start the session cookie |
| POST | `/api/auth/logout` | End the session |
| GET | `/api/auth/me` | Current user (401 when signed out) |

## Structure

```
backend/
  server.js                              Express app (CORS, cookies, static uploads, errors)
  config/db.js                           MySQL pool + Drizzle instance
  models/model.js                        All Drizzle schemas (single `users` table)
  routes/route.js                        All API route definitions
  controllers/userControllers/userController.js
  middleware/authMiddleware.js           Session cookie check for protected routes
  uploads/                               Saved profile pictures

frontend/
  middleware.js                          Redirects signed-out visitors to /login
  app/login/page.js
  app/register/page.js
  app/page.js                            Protected page
```

## Development notes

- **Passwords are stored as plain text** in this local development version.
  Add hashing and secure session management before deploying anywhere real.
- The session is a simple `httpOnly` cookie (`erp_session`); no auth library.
- Dropdown options are defined at the top of `frontend/app/register/page.js`,
  so no extra options table or file is needed.
