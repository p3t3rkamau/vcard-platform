# vCard Platform

A free, mobile-first digital business card and vCard QR platform for individuals and organizations.

## Product scope

This application is exclusively for creating and sharing digital vCards through QR codes. Public profiles use permanent platform-owned URLs:

`/p/[slug]`

The business card UUID is the stable record identity. Slugs are readable URL identifiers; changing a slug must preserve the previous URL through a permanent redirect.

## Technology

- Next.js App Router, React and TypeScript
- SCSS Modules
- Neon PostgreSQL and Prisma ORM
- Auth.js
- Vercel Blob
- `qr-code-styling`
- Zod

## Local development

1. Install Node.js 20.9 or newer and pnpm.
2. Copy `.env.example` to `.env` and fill in the required values.
3. Install dependencies with `pnpm install`.
4. Start the development server with `pnpm dev`.
5. Open http://localhost:3000.

## Environment variables

See `.env.example`. Never commit `.env` or expose server secrets through `NEXT_PUBLIC_*` variables.\n\nFor Vercel production, set `NEXT_PUBLIC_APP_URL` to your real public HTTPS domain. Auth.js v5 detects the Vercel request hostname automatically, so do not set `AUTH_URL` or `NEXTAUTH_URL` to localhost in Vercel. `AUTH_URL` is only needed for a non-standard Auth.js base path.

## Architecture principles

- No payment or subscription system in the initial product.
- No unrelated QR generators.
- Never store uploaded image bytes or Base64 image data in PostgreSQL; store Blob URLs and metadata.
- Public visitors can only read published, public profile fields.
- Profile URLs and QR codes remain valid when card details or templates change.
- All writes require server-side validation and authorization.


## Profile addresses and redirects

Owners can change a card's address from the card builder. The previous address is stored in `SlugRedirect` and permanently (308) redirects to the new one, so shared links and printed QR codes keep working. Retired slugs cannot be claimed by other cards.

## Operations

- `GET /api/health/db` reports database connectivity only (no counts).
- Rate-limit buckets are pruned opportunistically; no cron job is required.
- Analytics events accumulate indefinitely. Consider a periodic retention job (for example, delete events older than 24 months) as traffic grows.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint and a production build on every push and pull request.

## Feature setup

### Local account registration without SMTP

For local development only, set this in your local `.env`:

```env
ALLOW_UNVERIFIED_LOGIN="true"
```

This lets you register and sign in locally before configuring an email provider. The bypass is disabled automatically in production, even if the variable is accidentally set to true. Keep the value false in production.

### Vercel Blob images

1. Open your Vercel project and go to **Storage**.
2. Create a **Blob** store and connect it to this project.
3. Enable the store for the environments you use.
4. Ensure `VCARD_BLOB_READ_WRITE_TOKEN` (the token of the **public** store) is present in local `.env` and Vercel Environment Variables.

Profile photos, cover images and company logos accept JPG, PNG and WebP files up to 4 MB. Uploads are resized and re-encoded to WebP on the server, which also strips EXIF metadata (such as GPS location) from photos.

### Platform administrator

Set `ADMIN_EMAILS` to a comma-separated list of trusted account email addresses. Only those accounts can open `/dashboard/admin`.

### Database update after pulling

The current feature set adds profile reports and persistent rate-limit storage. After pulling the latest `main` branch, run:

```bash
pnpm install
pnpm exec prisma format
pnpm exec prisma validate
pnpm exec prisma db push
pnpm exec prisma generate
pnpm typecheck
pnpm lint
pnpm build
```

Do not enable the platform for public use until these checks pass and email delivery, Blob storage, admin access and production environment variables have been configured.
