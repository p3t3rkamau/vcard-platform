import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteProps = { params: Promise<{ cardId: string }> };

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const MEDIA_FIELDS = {
  PROFILE_IMAGE: "profileImageUrl",
  COVER_IMAGE: "coverImageUrl",
  COMPANY_LOGO: "companyLogoUrl",
} as const;

type UploadMediaType = keyof typeof MEDIA_FIELDS;

// Images are resized and re-encoded server-side. This (1) strips EXIF metadata such as GPS
// coordinates from photos on public profiles, (2) stops 4 MB phone photos being served into
// a 96px avatar, and (3) rejects files that only *look* like images.
const IMAGE_PROFILES: Record<UploadMediaType, { width: number; height: number; fit: "cover" | "inside" }> = {
  PROFILE_IMAGE: { width: 640, height: 640, fit: "cover" },
  COVER_IMAGE: { width: 1600, height: 900, fit: "inside" },
  COMPANY_LOGO: { width: 600, height: 600, fit: "inside" },
};

async function processImage(input: Buffer, mediaType: UploadMediaType) {
  const profile = IMAGE_PROFILES[mediaType];
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate() // apply EXIF orientation before the metadata is dropped
    .resize({ width: profile.width, height: profile.height, fit: profile.fit, withoutEnlargement: profile.fit === "inside" })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function backToEditor(request: Request, cardId: string, status: string, mediaType?: string) {
  const url = new URL("/dashboard/cards/" + cardId + "/edit", request.url);
  url.searchParams.set("media", status);
  if (mediaType) url.searchParams.set("mediaType", mediaType);
  return NextResponse.redirect(url, 303);
}

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const { cardId } = await params;
  const card = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });
  if (!(await checkRateLimit(request, "card-media-upload", 12, 60 * 60 * 1000, session.user.id))) {
    return backToEditor(request, cardId, "rate-limited");
  }


  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return backToEditor(request, cardId, "invalid");
  }

  const file = formData.get("file");
  const mediaType = String(formData.get("type") ?? "") as UploadMediaType;

  if (!(file instanceof File) || !Object.hasOwn(MEDIA_FIELDS, mediaType)) {
    return backToEditor(request, cardId, "invalid", mediaType);
  }
  if (!Object.hasOwn(ALLOWED_TYPES, file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return backToEditor(request, cardId, "invalid-file", mediaType);
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const isJpeg = file.type === "image/jpeg" && fileBytes[0] === 0xff && fileBytes[1] === 0xd8 && fileBytes[2] === 0xff;
  const isPng = file.type === "image/png" && fileBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.type === "image/webp" && fileBytes.toString("ascii", 0, 4) === "RIFF" && fileBytes.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return backToEditor(request, cardId, "invalid-file", mediaType);

  let processed: Awaited<ReturnType<typeof processImage>>;
  try {
    processed = await processImage(fileBytes, mediaType);
  } catch {
    return backToEditor(request, cardId, "invalid-file", mediaType);
  }

  const blobToken = process.env.VC_BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.error("[card-media-upload] VC_BLOB_READ_WRITE_TOKEN is not configured.");
    return backToEditor(request, cardId, "not-configured", mediaType);
  }

  const pathname = "vcard/" + session.user.id + "/" + card.id + "/" + mediaType.toLowerCase() + ".webp";
  let uploadedUrl: string | null = null;
  let failureStage: "blob" | "database" = "blob";

  try {
    const blob = await put(pathname, processed.data, {
      access: "public",
      token: blobToken,
      addRandomSuffix: true,
      contentType: "image/webp",
    });
    uploadedUrl = blob.url;
    failureStage = "database";

    const oldMedia = await prisma.media.findMany({
      where: { businessCardId: card.id, type: mediaType },
      select: { id: true, publicUrl: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.media.create({
        data: {
          ownerId: session.user!.id!,
          businessCardId: card.id,
          type: mediaType,
          publicUrl: blob.url,
          blobPath: blob.pathname,
          fileName: file.name.slice(0, 180),
          mimeType: "image/webp",
          sizeBytes: processed.data.length,
          width: processed.width,
          height: processed.height,
        },
      });
      const cardImageUpdate = mediaType === "PROFILE_IMAGE"
        ? { profileImageUrl: blob.url }
        : mediaType === "COVER_IMAGE" ? { coverImageUrl: blob.url } : { companyLogoUrl: blob.url };
      await tx.businessCard.update({ where: { id: card.id }, data: cardImageUpdate });
      if (oldMedia.length) {
        await tx.media.deleteMany({ where: { id: { in: oldMedia.map((item) => item.id) } } });
      }
    });

    if (oldMedia.length) {
      await del(oldMedia.map((item) => item.publicUrl)).catch(() => undefined);
    }

    return backToEditor(request, cardId, "uploaded", mediaType);
  } catch (error) {
    console.error("[card-media-upload] Failed during " + failureStage, error);
    if (uploadedUrl) {
      await del(uploadedUrl).catch(() => undefined);
    }
    const editorUrl = new URL("/dashboard/cards/" + cardId + "/edit", request.url);
    editorUrl.searchParams.set("media", "failed");
    editorUrl.searchParams.set("mediaType", mediaType);
    editorUrl.searchParams.set("reason", failureStage);
    return NextResponse.redirect(editorUrl, 303);
  }
}
