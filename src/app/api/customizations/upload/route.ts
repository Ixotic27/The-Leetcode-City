import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAGIC_BYTES_TO_READ = 12;

function detectMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < MAGIC_BYTES_TO_READ) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A (full 8-byte signature)
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  // Auth required
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // Validate developer
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, claimed, claimed_by")
    .eq("claimed_by", user.id)
    .single();

  const githubLogin = dev?.github_login ?? "";

  if (!dev || !dev.claimed || dev.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "Building not found or not yours" },
      { status: 403 }
    );
  }

  // Count completed billboard purchases
  const { count: billboardCount } = await sb
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", dev.id)
    .eq("item_id", "billboard")
    .eq("status", "completed");

  if (!billboardCount || billboardCount === 0) {
    return NextResponse.json(
      { error: "You don't own the billboard item" },
      { status: 403 }
    );
  }

  // Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) { console.warn("[app/api/customizations/upload/route.ts] error:", err); return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
   }
  const file = formData.get("file") as File | null;
  const slotIndexRaw = formData.get("slot_index");

  if (slotIndexRaw === null || slotIndexRaw instanceof File) {
    return NextResponse.json(
      { error: "Invalid slot_index" },
      { status: 400 }
    );
  }

  const slotIndex = parseInt(slotIndexRaw, 10);
  if (!Number.isFinite(slotIndex) || slotIndex < 0) {
    return NextResponse.json(
      { error: "Invalid slot_index" },
      { status: 400 }
    );
  }

  if (slotIndex >= billboardCount) {
    return NextResponse.json(
      { error: `Invalid slot_index (you have ${billboardCount} billboard slots)` },
      { status: 400 }
    );
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Use PNG, JPEG, WebP, or GIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 2 MB)" },
      { status: 400 }
    );
  }

  // Ensure billboards bucket exists
  const { data: buckets } = await sb.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === "billboards");
  if (!bucketExists) {
    await sb.storage.createBucket("billboards", { public: true });
  }

  // Upload file (overwrite on re-upload)
  const fileBuffer = await file.arrayBuffer();

  // Detect MIME type from magic bytes — file.type comes from the client-controlled
  // Content-Type part header and cannot be trusted. Use the detected type as the
  // source of truth: reject if unknown, reject if not in ALLOWED_TYPES.
  const detectedType = detectMimeFromBytes(new Uint8Array(fileBuffer.slice(0, MAGIC_BYTES_TO_READ)));
  if (!detectedType || !ALLOWED_TYPES.has(detectedType)) {
    return NextResponse.json(
      { error: "File content does not match an allowed image type" },
      { status: 400 }
    );
  }

  const ext = detectedType.split("/")[1] === "jpeg" ? "jpg" : detectedType.split("/")[1];
  const filePath = `${dev.id}_${slotIndex}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("billboards")
    .upload(filePath, fileBuffer, {
      contentType: detectedType,
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = sb.storage
    .from("billboards")
    .getPublicUrl(filePath);

  const imageUrl = urlData.publicUrl;

  // Read existing config to build images array
  const { data: existingConfig } = await sb
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "billboard")
    .maybeSingle();

  let images: string[] = [];
  if (existingConfig) {
    const cfg = existingConfig.config as Record<string, unknown>;
    if (Array.isArray(cfg?.images)) {
      images = [...(cfg.images as string[])];
    } else if (typeof cfg?.image_url === "string") {
      // Migrate legacy single image to array
      images = [cfg.image_url];
    }
  }

  // Extend array if needed and set the slot
  while (images.length <= slotIndex) {
    images.push("");
  }
  images[slotIndex] = imageUrl;

  // Upsert customization with images array
  const { error: upsertError } = await sb
    .from("developer_customizations")
    .upsert(
      {
        developer_id: dev.id,
        item_id: "billboard",
        config: { images },
      },
      { onConflict: "developer_id,item_id" }
    );

  if (upsertError) {
    console.error("Upsert error:", upsertError);
    return NextResponse.json(
      { error: "Failed to save customization" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, image_url: imageUrl, slot_index: slotIndex, images });
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function DELETE(request: Request) {
  // Auth required
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // Validate developer
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, claimed, claimed_by")
    .eq("claimed_by", user.id)
    .single();

  if (!dev || !dev.claimed || dev.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "Building not found or not yours" },
      { status: 403 }
    );
  }

  const { slot_index } = await request.json();
  if (typeof slot_index !== "number" || slot_index < 0) {
    return NextResponse.json(
      { error: "Invalid slot_index" },
      { status: 400 }
    );
  }

  // Read existing config
  const { data: existingConfig } = await sb
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "billboard")
    .maybeSingle();

  let images: string[] = [];
  if (existingConfig) {
    const cfg = existingConfig.config as Record<string, unknown>;
    if (Array.isArray(cfg?.images)) {
      images = [...(cfg.images as string[])];
    } else if (typeof cfg?.image_url === "string") {
      images = [cfg.image_url];
    }
  }

  if (slot_index >= images.length || !images[slot_index]) {
    return NextResponse.json(
      { error: "Slot is already empty" },
      { status: 400 }
    );
  }

  // Try to remove the file from storage (best-effort)
  try {
    const oldUrl = images[slot_index];
    const fileName = oldUrl.split("/").pop();
    if (fileName) {
      await sb.storage.from("billboards").remove([fileName]);
    }
  } catch (err) {
    console.warn("[app/api/customizations/upload/route.ts] non-critical storage cleanup error:", err);
  }

  // Clear the slot
  images[slot_index] = "";

  // Upsert customization
  const { error: upsertError } = await sb
    .from("developer_customizations")
    .upsert(
      {
        developer_id: dev.id,
        item_id: "billboard",
        config: { images },
      },
      { onConflict: "developer_id,item_id" }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "Failed to update customization" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, slot_index, images });
}
