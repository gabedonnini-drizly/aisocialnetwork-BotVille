#!/usr/bin/env node
/**
 * Step 1 of TZ-01: the asset pipeline.
 * Copies ONLY the files that are used from assets-src/ (not in git, the LimeZu
 * license forbids redistribution) into packages/client/public/assets/ (also in .gitignore).
 *
 * The file list is EXPLICIT — the build is reproducible: buy the packs, unpack them
 * into assets-src/ (the structure is in the README, "About the art" section) and run
 * `node scripts/sync-assets.mjs`.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'assets-src');
const PUB = join(ROOT, 'packages', 'client', 'public', 'assets');

const EXT = 'exteriors/themes';
const FARM = 'farm/16x16';
const INT = 'interiors';

/** [source in assets-src, destination in public/assets] */
const FILES = [
  // ---- District tilesets (Modern Exteriors) ----
  [`${EXT}/1_Terrains_and_Fences_16x16.png`, 'tilesets/limezu/1_Terrains_and_Fences_16x16.png'],
  [`${EXT}/2_City_Terrains_16x16.png`, 'tilesets/limezu/2_City_Terrains_16x16.png'],
  [`${EXT}/3_City_Props_16x16.png`, 'tilesets/limezu/3_City_Props_16x16.png'],
  [`${EXT}/4_Generic_Buildings_16x16.png`, 'tilesets/limezu/4_Generic_Buildings_16x16.png'],
  [`${EXT}/7_Villas_16x16.png`, 'tilesets/limezu/7_Villas_16x16.png'],
  [`${EXT}/9_Shopping_Center_and_Markets_16x16.png`, 'tilesets/limezu/9_Shopping_Center_and_Markets_16x16.png'],
  [`${EXT}/10_Vehicles_16x16.png`, 'tilesets/limezu/10_Vehicles_16x16.png'],
  [`${EXT}/16_Office_16x16.png`, 'tilesets/limezu/16_Office_16x16.png'],
  [`${EXT}/17_Garden_16x16.png`, 'tilesets/limezu/17_Garden_16x16.png'],
  [`${EXT}/24_Additional_Houses_16x16.png`, 'tilesets/limezu/24_Additional_Houses_16x16.png'],
  ['exteriors/animated/Stoplight_16x16.png', 'sprites/limezu/Stoplight_16x16.png'],

  // ---- Farm (Modern Farm) ----
  [`${FARM}/1_Terrains_16x16.png`, 'tilesets/limezu/Farm_Terrains_16x16.png'],
  [`${FARM}/2_Fences_16x16.png`, 'tilesets/limezu/Farm_Fences_16x16.png'],
  [`${FARM}/3_Props_and_Buildings_16x16.png`, 'tilesets/limezu/Farm_Props_and_Buildings_16x16.png'],
  [`${FARM}/4_Crops_16x16.png`, 'tilesets/limezu/Farm_Crops_16x16.png'],
  [`${FARM}/6_Trees_16x16.png`, 'tilesets/limezu/Farm_Trees_16x16.png'],

  // ---- Room Builders and interior themes ----
  [`${INT}/Room_Builder_16x16.png`, 'tilesets/limezu/Room_Builder_16x16.png'],
  ['office/room-builder/Room_Builder_Office_16x16.png', 'tilesets/limezu/Room_Builder_Office_16x16.png'],
  [`${INT}/themes/1_Generic_16x16.png`, 'tilesets/limezu/Interior_Generic_16x16.png'],
  [`${INT}/themes/2_LivingRoom_16x16.png`, 'tilesets/limezu/Interior_LivingRoom_16x16.png'],
  [`${INT}/themes/4_Bedroom_16x16.png`, 'tilesets/limezu/Interior_Bedroom_16x16.png'],
  [`${INT}/themes/5_Classroom_and_library_16x16.png`, 'tilesets/limezu/Interior_Library_16x16.png'],
  [`${INT}/themes/12_Kitchen_16x16.png`, 'tilesets/limezu/Interior_Kitchen_16x16.png'],
  [`${INT}/themes/16_Grocery_store_16x16.png`, 'tilesets/limezu/Interior_Grocery_16x16.png'],
  [`${INT}/themes/22_Museum.png`, 'tilesets/limezu/Interior_Museum_16x16.png'],
  [`${INT}/themes/24_Ice_Cream_Shop.png`, 'tilesets/limezu/Interior_IceCream_16x16.png'],

  // ---- Animated interior objects ----
  [`${INT}/animated/animated_coffee.png`, 'sprites/limezu/animated_coffee.png'],
  [`${INT}/animated/animated_TV_reportage.png`, 'sprites/limezu/animated_TV_reportage.png'],
  [`${INT}/animated/animated_kitchen_oven_2cookers.png`, 'sprites/limezu/animated_kitchen_oven.png'],
  [`${INT}/animated/animated_fridge.png`, 'sprites/limezu/animated_fridge.png'],
  [`${INT}/animated/animated_canteen_big_fridge_cake_16x16.png`, 'sprites/limezu/animated_cake_fridge.png'],
  [`${INT}/animated/animated_control_room_facebook_scrolling.png`, 'sprites/limezu/animated_office_screen.png'],
  [`${INT}/animated/animated_cuckoo_clock.png`, 'sprites/limezu/animated_cuckoo_clock.png'],

  // ---- UI / emotes ----
  [`${INT}/ui/UI_16x16.png`, 'sprites/limezu/UI_16x16.png'],
  [`${INT}/ui/UI_thinking_emotes_animation_16x16.png`, 'sprites/limezu/UI_thinking_emotes_animation_16x16.png'],

  // ---- Animal agents (Modern Farm) ----
  [`${FARM}/Animals_16x16/Cows/Cow_16x16.png`, 'sprites/limezu/Cow_16x16.png'],
  [`${FARM}/Animals_16x16/Pigs/Pig_Pink_16x16.png`, 'sprites/limezu/Pig_Pink_16x16.png'],
  [`${FARM}/Animals_16x16/Dogs/Dog_Labrador_Brown_16x16.png`, 'sprites/limezu/Dog_Labrador_Brown_16x16.png'],
  [`${FARM}/Animals_16x16/Chickens_and_Roosters/Chicken_White_16x16.png`, 'sprites/limezu/Chicken_White_16x16.png'],
];

// ---- District buildings and props (ready-made standalone PNGs) ----
const PROPS = [
  [`${EXT}/16_Office_Singles_16x16/ME_Singles_Office_16x16_Example_1.png`, 'office_building.png'],
  [`${EXT}/9_Shopping_Center_and_Markets_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_1.png`, 'cafe_building.png'],
  // library_building.png is generated by build-district.mjs (the BOOKS sign is stamped on)
  [`${FARM}/Single_Files_16x16/Props_and_Buildings_16x16/Barn_Small_16x16.png`, 'barn.png'],
  [`${FARM}/Single_Files_16x16/Trees_16x16/Tree_Oak_Green_Big_16x16.png`, 'tree_oak_big.png'],
  [`${FARM}/Single_Files_16x16/Trees_16x16/Tree_Oak_Green_Medium_16x16.png`, 'tree_oak_med.png'],
  [`${FARM}/Single_Files_16x16/Trees_16x16/Tree_Birch_Green_Medium_16x16.png`, 'tree_birch.png'],
  [`${EXT}/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Street_Lamp_1.png`, 'street_lamp.png'],
  [`${EXT}/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Bench_1.png`, 'bench.png'],
  [`${EXT}/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Black_Closed_Trash_Can.png`, 'trash_can.png'],
  [`${EXT}/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Hydrant_1.png`, 'hydrant.png'],
  [`${EXT}/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Right_1.png`, 'car_right_1.png'],
  [`${EXT}/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Left_5.png`, 'car_left_1.png'],
  // passing cars (day/night ambience)
  [`${EXT}/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Right_12.png`, 'car_right_2.png'],
  [`${EXT}/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Down_1.png`, 'car_down_1.png'],
  [`${EXT}/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Down_19.png`, 'car_down_2.png'],
  [`${EXT}/17_Garden_Singles_16x16/ME_Singles_Garden_16x16_Bush_1.png`, 'bush_1.png'],
  [`${EXT}/17_Garden_Singles_16x16/ME_Singles_Garden_16x16_Bush_4.png`, 'bush_2.png'],
  [`${FARM}/Single_Files_16x16/Crops_16x16/Crop_Cabbage_Ripe_16x16.png`, 'crop_cabbage.png'],
  [`${FARM}/Single_Files_16x16/Crops_16x16/Crop_Berry_Ripe_16x16.png`, 'crop_berry.png'],
  [`${FARM}/Single_Files_16x16/Fences_16x16/Topsoil_Arable_Small_Horizontal_Modular_Left_16x16.png`, 'soil_left.png'],
  [`${FARM}/Single_Files_16x16/Fences_16x16/Topsoil_Arable_Small_Horizontal_Modular_Middle_16x16.png`, 'soil_mid.png'],
  [`${FARM}/Single_Files_16x16/Fences_16x16/Topsoil_Arable_Small_Horizontal_Modular_Right_16x16.png`, 'soil_right.png'],
];
for (const part of ['Top_Left', 'Top_Middle', 'Top_Right', 'Middle_Left', 'Middle_Right', 'Bottom_Left', 'Bottom_Middle', 'Bottom_Right']) {
  PROPS.push([
    `${EXT}/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_${part}_16x16.png`,
    `fence_${part.toLowerCase()}.png`,
  ]);
}
for (const [src, name] of PROPS) FILES.push([src, `sprites/limezu/district/${name}`]);

// ---- Standalone office objects for OfficeScene (numbers from the pack) ----
const OFFICE_SINGLES = {
  99: 'plant_small', 100: 'plant_pot',
  103: 'office_chair_right', 104: 'office_chair_left',
  116: 'whiteboard', 156: 'printer',
  225: 'workstation_single', 227: 'workstation_double',
  323: 'coffee_machine',
};
for (const [n, name] of Object.entries(OFFICE_SINGLES)) {
  FILES.push([`office/singles/Modern_Office_Singles_${n}.png`, `sprites/limezu/interior/${name}.png`]);
}

// ---- Human agents: 12 premade characters (see AVATAR_VARIANTS in assetManifest.ts) ----
for (const n of [1, 2, 4, 6, 7, 8, 9, 10, 14, 15, 18, 19]) {
  const nn = String(n).padStart(2, '0');
  FILES.push([
    `${INT}/characters-premade/Premade_Character_${nn}.png`,
    `sprites/limezu/Premade_Character_${nn}.png`,
  ]);
}

let copied = 0;
const missing = [];
for (const [src, dest] of FILES) {
  const from = join(SRC, src);
  if (!existsSync(from)) { missing.push(src); continue; }
  const to = join(PUB, dest);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
}

console.log(`sync-assets: copied ${copied}/${FILES.length}`);
if (missing.length) {
  console.error('MISSING from assets-src/ (see the README, "About the art" section):');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
