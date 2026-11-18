# HKD ERP — Authentication foundation

Minimal login/registration foundation for the ERP.

- `frontend/` — Next.js App Router, JavaScript, Tailwind CSS
- `backend/` — Express, MySQL, Drizzle ORM

## Authentication (no JWT, no tokens, no sessions, no cookies)

1. Login (or registration) returns the user object from the API.
2. The frontend saves it in `localStorage` under `erp_user`.
3. `AppShell` (wrapper of every protected page) reads `localStorage`:
   no user → redirect to `/login`; user → render the page.
4. `/login` does the opposite: a stored user → redirect to `/`.
5. Sign out removes `erp_user` and redirects to `/login`.

The Navbar shows the username and designation from that stored object.

For the admin endpoints the browser sends the signed-in user's id in an
`x-user-id` header; the server loads that user from MySQL and checks
`work.designation === 'Admin'`. Everything here is client-side state, so this is
a development template: anyone can edit `localStorage`.

## Setup

1. Install both projects:

   ```bash
   npm run install:all
   ```

2. Create the database and set the credentials in `backend/.env`:

   ```sql
   CREATE DATABASE HKD_ERP_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Create the tables from `backend/models/model.js`:

   ```bash
   npm run db:push
   ```

4. Run both servers (separate terminals):

   ```bash
   npm run dev:backend    # http://localhost:5000
   npm run dev:frontend   # http://localhost:3000
   ```

## API (Express)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register (multipart form + optional picture), return the user |
| POST | `/api/auth/login` | Check user name + password, return the user |
| GET | `/api/users` | List users (admin, `x-user-id` header) |
| PATCH | `/api/users/:id` | Edit a user (admin) |
| DELETE | `/api/users/:id` | Delete a user (admin) |

## Structure

```
backend/
  server.js                              Express app (CORS, static uploads, errors)
  config/db.js                           MySQL pool + Drizzle instance
  models/model.js                        All Drizzle schemas (single `users` table)
  routes/route.js                        All API route definitions
  controllers/userControllers/userController.js    register / login
  controllers/userControllers/adminController.js   user management (admin)
  middleware/authMiddleware.js           x-user-id guard + admin check
  uploads/                               Saved profile pictures

frontend/
  app/(Auth-Pages)/login/page.js         Login
  app/(Auth-Pages)/register/page.js      Registration
  app/page.js                            Dashboard (protected)
  app/users/page.js                      Manage users (admin only)
  app/components/AppShell.js             localStorage login check + layout
  app/components/SideNavBar.js           Navbar with user details
```

## Development notes

- **Passwords are stored as plain text** in this local development version.
- The registration form accepts **Admin** as a designation, so a new admin can be
  created there. Admin rights still come from the database row (`work.designation`),
  not from localStorage.
- Dropdown options are defined at the top of the register page (and the users
  page for admins), so no extra options table or file is needed.
