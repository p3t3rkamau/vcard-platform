/**
 * Token for the PUBLIC Vercel Blob store that holds card images.
 *
 * Vercel names the variable "<PREFIX>_READ_WRITE_TOKEN" after the prefix chosen when the store is
 * connected (e.g. VC_READ_WRITE_TOKEN). First name that is set wins, so put the one you want first.
 * BLOB_READ_WRITE_TOKEN (Vercel's default) is last on purpose: it often belongs to an older store.
 */
const TOKEN_VARIABLES = [
  "VC_READ_WRITE_TOKEN",
  "VCARD_READ_WRITE_TOKEN",
  "VC_BLOB_READ_WRITE_TOKEN",
  "VCARD_BLOB_READ_WRITE_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
] as const;

export function getBlobConfig(): { token: string; source: string } | null {
  for (const source of TOKEN_VARIABLES) {
    const token = process.env[source]?.trim();
    if (token) return { token, source };
  }
  return null;
}

/** Names that are set (never their values), for diagnostics. */
export function configuredBlobVariables() {
  return TOKEN_VARIABLES.filter((name) => Boolean(process.env[name]?.trim()));
}

/** Tokens look like vercel_blob_rw_<storeId>_<secret>; the store id is not secret and identifies the store. */
export function storeIdFromToken(token: string) {
  return /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1] ?? null;
}

export type BlobFailure = "token" | "access-mode" | "store-missing" | "store-suspended" | "blob";

/** Turns a Vercel Blob SDK error into a reason the editor can explain to the user. */
export function classifyBlobError(error: unknown): BlobFailure {
  const name = error instanceof Error ? error.constructor.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "BlobStoreNotFoundError") return "store-missing";
  if (name === "BlobStoreSuspendedError") return "store-suspended";
  if (/\b(private|public)\b/i.test(message) && /access|store/i.test(message)) return "access-mode";
  if (name === "BlobAccessError") return "token";
  return "blob";
}
