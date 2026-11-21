import { del, put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

function backToEditor(request: Request, cardId: string, status: string, mediaType?: string) {
  const url = new URL("/dashboard/cards/" + cardId + "/edit", request.url);
  url.searchParams.set("media", status);
  if (mediaType) url.searchParams.set("mediaType", mediaType);
  return NextResponse.redirect(url, 303);
}

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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return backToEditor(request, cardId, "not-configured");
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

  const extension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];
  const pathname = "vcard/" + session.user.id + "/" + card.id + "/" + mediaType.toLowerCase() + "." + extension;
  let uploadedUrl: string | null = null;

  try {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    uploadedUrl = blob.url;

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
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });
      await tx.businessCard.update({
        where: { id: card.id },
        data: { [MEDIA_FIELDS[mediaType]]: blob.url },
      });
      if (oldMedia.length) {
        await tx.media.deleteMany({ where: { id: { in: oldMedia.map((item) => item.id) } } });
      }
    });

    if (oldMedia.length) {
      await del(oldMedia.map((item) => item.publicUrl), {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }).catch(() => undefined);
    }

    return backToEditor(request, cardId, "uploaded", mediaType);
  } catch {
    if (uploadedUrl) {
      await del(uploadedUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    }
    return backToEditor(request, cardId, "failed", mediaType);
  }
}
