# GitHub Import Guide

This folder is a cleaned GitHub-ready copy of the ENT303TC U Use project.

## What Is Included

- Course planning and submission documents.
- Evidence Hub templates and versioned working files.
- U Use PRD.
- Next.js prototype source code under `xjtlu-market-app/`.
- `package-lock.json`, so dependencies can be restored with `npm install`.

## What Is Excluded

- `node_modules/`
- `.next/`
- `.env` files
- macOS `.DS_Store`
- competitor screenshot folder
- generated build/cache output

## Recommended GitHub Settings

Use a private repository unless all teammates have checked that no private student, interview, group chat, or supervisor information is included.

## Run The Prototype

```bash
cd xjtlu-market-app
npm install
npm run dev
```

Student app:

```text
http://localhost:3000
```

Admin app:

```text
http://localhost:3000/admin
```

## Suggested First Commit

```bash
git init
git add .
git commit -m "Initial ENT303TC U Use project package"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```
