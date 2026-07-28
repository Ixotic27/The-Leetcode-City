import { NextResponse } from "next/server";
import { validateParams } from "@/lib/validation";
import { usernameParamSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const paramValidation = validateParams(usernameParamSchema, await params);
  if (!paramValidation.success) {
    return paramValidation.response;
  }

  const { username } = paramValidation.data;
  return NextResponse.redirect(
    new URL(`/api/dev/${encodeURIComponent(username)}`, _request.url)
  );
}
