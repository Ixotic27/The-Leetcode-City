import * as fs from "fs";
import * as path from "path";

const ARTIFACT_DIR = "C:/Users/HP/.gemini/antigravity-ide/brain/c5fb50f4-cc4f-43a2-883d-992e98435916";
const DEST_DIR = path.join(process.cwd(), "public/assets/items");

const FILES_TO_COPY: Record<string, string> = {
  "items_potions_labeled_1780424147252.png": "potions.png",
  "items_orbs_crystals_1780424163690.png": "orbs.png",
  "items_weapons_gear_1780424178579.png": "weapons.png",
  "items_buffs_accessories_1780424196578.png": "accessories.png",
  "items_legendary_labeled_1780424207566.png": "legendary.png",
  "items_rank_badges_1780424370444.png": "badges.png",
  "items_crafting_materials_1780424382676.png": "materials.png",
  "items_pets_companions_1780424393277.png": "companions.png",
  "items_scrolls_tomes_1780424405208.png": "scrolls.png",
  "arena_items_spritesheet_1780423185178.png": "spritesheet_core.png",
  "arena_potions_buffs_1780423216094.png": "spritesheet_potions.png",
  "arena_legendary_items_1780423241481.png": "spritesheet_legendary.png"
};

function main() {
  console.log("Copying pixel-art item assets from artifacts directory...");
  
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`Created destination directory: ${DEST_DIR}`);
  }

  let copiedCount = 0;

  for (const [srcName, destName] of Object.entries(FILES_TO_COPY)) {
    const srcPath = path.join(ARTIFACT_DIR, srcName);
    const destPath = path.join(DEST_DIR, destName);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied: ${srcName} -> ${destName}`);
      copiedCount++;
    } else {
      console.warn(`⚠️ Source file not found: ${srcPath}`);
    }
  }

  console.log(`Copy complete. Copied ${copiedCount} assets.`);
}

main();
