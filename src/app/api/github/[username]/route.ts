import { NextResponse } from "next/server";
import { z } from "zod";
import { validateParams } from "@/lib/validation";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const resolvedParams = await params;
  const validation = validateParams(resolvedParams, paramsSchema);
  if (!validation.success) {
    return validation.response;
  }

  const { username } = validation.data;
  return NextResponse.redirect(
    new URL(`/api/dev/${encodeURIComponent(username)}`, _request.url)
  );
}
