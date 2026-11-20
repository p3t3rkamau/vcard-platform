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

See `.env.example`. Never commit `.env` or expose server secrets through `NEXT_PUBLIC_*` variables.

## Architecture principles

- No payment or subscription system in the initial product.
- No unrelated QR generators.
- Never store uploaded image bytes or Base64 image data in PostgreSQL; store Blob URLs and metadata.
- Public visitors can only read published, public profile fields.
- Profile URLs and QR codes remain valid when card details or templates change.
- All writes require server-side validation and authorization.
