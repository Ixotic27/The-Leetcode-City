import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import RoadmapClient from "./RoadmapClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Roadmap - LeetCode City",
  description:
    "See what's coming next for LeetCode City. Vote on the features you want most.",
};

export default async function RoadmapPage() {
  const admin = getSupabaseAdmin();

  // Fetch vote counts per item
  const { data: voteCounts } = await admin
    .from("roadmap_votes")
    .select("item_id")
    .then(({ data }) => {
    .catch(err => console.error(err))