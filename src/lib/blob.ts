/**
 * Token for the PUBLIC Vercel Blob store that holds card images.
 *
 * Vercel names the variable after the prefix chosen when the store is connected, so accept the
 * names this project has used, then Vercel's default. First one that is set wins.
 */
const TOKEN_VARIABLES = ["VCARD_BLOB_READ_WRITE_TOKEN", "VC_BLOB_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN"] as const;

export function getBlobToken() {
  for (const name of TOKEN_VARIABLES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export const BLOB_TOKEN_HELP = "Create a Public Vercel Blob store, connect it to this project and add its read-write token as BLOB_READ_WRITE_TOKEN (or VCARD_BLOB_READ_WRITE_TOKEN), then redeploy.";
