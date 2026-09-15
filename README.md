# TechCulture Backoffice API

Node.js Express API for admin login, Blog CMS, and Careers jobs.

## Setup

```bash
cd techculture-backoffice-api
npm install
npm run seed
npm run dev
```

API: `http://localhost:5050`

## Admin login

- Email: `admin@techculture.ai`
- Password: `Admin@123`

(Change in `.env`)

## Key endpoints

### Auth
- `POST /api/auth/login` `{ email, password }`
- `GET /api/auth/me` (Bearer token)

### Blog (public — for website)
- `GET /api/blogs/public`
- `GET /api/blogs/public/:slug`

### Blog (admin)
- `GET /api/blogs`
- `POST /api/blogs`
- `PUT /api/blogs/:id`
- `DELETE /api/blogs/:id`

### Careers (public)
- `GET /api/careers/public`
- `GET /api/careers/public/:id`

### Careers (admin)
- `GET /api/careers`
- `POST /api/careers`
- `PUT /api/careers/:id`
- `DELETE /api/careers/:id`

## Seed data

`npm run seed` loads:
- All posts from `techculture-ai-new/src/lib/blog.js` → `data/db/blogs.json`
- Jobs from `techculture-ai-new/src/lib/careers/jobs.js` → `data/db/jobs.json`
