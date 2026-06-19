# ComputeForward

Education Platform — https://compute-forward.vercel.app/

A rigorous, student-led CS program. This repo contains the marketing site **and**
a lightweight backend that collects program applications.

---

## What's in here

| File | What it is |
|------|------------|
| `index.html` | The website (homepage). All content lives here. |
| `server.js` | The backend — serves the site and receives applications. |
| `store.js` | Saves applications to a file (`data/applications.json`). |
| `admin.html` | Private page to view applications that come in. |
| `package.json` | Project setup / dependencies. |

---

## How applications are delivered

When someone submits the form, it tries three things in order — it succeeds if **any** work:

1. **Your backend** (`POST /api/apply`) — stores the application in `data/applications.json`.
2. **Web3Forms** — emails the application to `kaushik.atla@gmail.com`.
3. **mailto** — opens the visitor's email app as a last resort.

This means the site keeps working even when the backend isn't running (e.g. the
current static Vercel deploy just uses email).

---

## Run it on your computer

You need [Node.js](https://nodejs.org) (version 18 or newer) installed.

```bash
npm install      # one time — downloads dependencies
npm start        # starts the site + backend
```

Then open:

- **Website:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

### Protecting the admin page

By default the admin token is `change-me`. Set your own before starting:

```bash
ADMIN_TOKEN="your-secret-here" npm start
```

Enter that same token on the `/admin` page to view applications.

---

## Where applications are stored

In `data/applications.json` — one entry per submission, with name, email, grade,
level, and a timestamp. This folder is git-ignored so applicant data never gets
committed to GitHub.

---

## Deploying

- **Static only (current Vercel setup):** just `index.html` is served. The form
  falls back to email automatically — no backend needed.
- **With the backend:** deploy to any Node host (Render, Railway, Fly.io, a VPS).
  Run `npm install && npm start`, and set `ADMIN_TOKEN` + `PORT` as needed.
