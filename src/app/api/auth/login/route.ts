import { createBrowserSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    // This route exists to prevent 404s from legacy NextAuth-style redirects.
    // We redirect to the root where the Supabase auth flow is handled.
    return NextResponse.redirect(new URL("/", request.url));
}
