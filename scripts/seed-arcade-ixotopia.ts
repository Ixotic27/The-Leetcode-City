import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Reading map JSON from public/pokemon_resources/ixotopia-converted.json...");
  const mapPath = path.join(process.cwd(), "public", "pokemon_resources", "ixotopia-converted.json");
  
  let mapJson;
  try {
    const fileContent = fs.readFileSync(mapPath, "utf-8");
    mapJson = JSON.parse(fileContent);
  } catch (err: any) {
    console.error("❌ Failed to read or parse map JSON:", err.message);
    process.exit(1);
  }

  const ixotopiaRoom = {
    slug: "ixotopia",
    name: "🕹️ Ixotopia",
    room_type: "official_floor",
    floor_number: 3,
    max_players: 50,
    visibility: "open",
    category: "social",
    description: "Explore the Pokémon-style Ixotopia Overworld Town!",
    is_featured: true,
    portals: [
      { x: 20, y: 16, width: 1, type: "door", destination: "lobby", label: "Enter E.Arcade Lobby" }
    ],
    map_json: mapJson,
    updated_at: new Date().toISOString()
  };

  console.log("Upserting ixotopia room into arcade_rooms table in Supabase...");
  const { data, error } = await supabase
    .from("arcade_rooms")
    .upsert(ixotopiaRoom, { onConflict: "slug" })
    .select("slug, name");

  if (error) {
    console.error("❌ Database upsert failed:", error.message);
    process.exit(1);
  }

  console.log("✅ Successfully seeded ixotopia room into database:", data);
}

seed();
