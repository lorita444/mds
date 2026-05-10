// Central asset registry — all require() calls must be static (Metro bundler constraint)

// Planets
const PLANET_STARTER = require('../assets/planets/starter/planet_starter_v1.png.png');
const PLANET_COMMON = require('../assets/planets/common/planet_common_v1.png.png');
const PLANET_FROZEN = require('../assets/planets/uncommon/planet_frozen_v1.png.png');
const PLANET_OCEAN = require('../assets/planets/uncommon/planet_ocean_v1.png.png');
const PLANET_RARE = require('../assets/planets/rare/planet_rare_v1.png.png');
const PLANET_VOLCANIC = require('../assets/planets/rare/planet_volcanic_v1.png.png');
const PLANET_NEBULA = require('../assets/planets/epic/planet_nebula_v1.png.png');
const PLANET_LEGENDARY = require('../assets/planets/legendary/planet_legendary_v1.png.png');
const PLANET_CRYSTAL = require('../assets/planets/legendary/planet_crystal_v1.png.png');

// Aliens
const ALIEN_STARTER = require('../assets/aliens/starter/alien_starter_v1.png.png');
const ALIEN_MOONLING = require('../assets/aliens/common/alien_moonling_v1.png.png');
const ALIEN_AQUATIC = require('../assets/aliens/uncommon/alien_aquatic_v1.png.png');
const ALIEN_SCHOLAR = require('../assets/aliens/rare/alien_scholar_v1.png.png');
const ALIEN_ROBOTIC = require('../assets/aliens/rare/alien_robotic_v1.png.png');
const ALIEN_GLOWING = require('../assets/aliens/epic/alien_glowing_v1.png.png');
const ALIEN_COSMIC = require('../assets/aliens/legendary/alien_cosmic_v1.png.png');
const ALIEN_LEGENDARY_IMG = require('../assets/aliens/legendary/alien_legendary_v1.png.png');

// Structures
const STRUCTURE_HABITAT = require('../assets/structures/common/structure_habitat_v1.png.png');
const STRUCTURE_RESEARCH = require('../assets/structures/uncommon/structure_research_station_v1.png.png');
const STRUCTURE_LIBRARY = require('../assets/structures/rare/structure_alien_library_v1.png.png');
const STRUCTURE_OBSERVATORY = require('../assets/structures/rare/structure_observatory_v1.png.png');
const STRUCTURE_PORTAL = require('../assets/structures/epic/structure_portal_v1.png.png');
const STRUCTURE_CIVILIZATION = require('../assets/structures/legendary/structure_civilization_core_v1.png.png');
const STRUCTURE_MONUMENT = require('../assets/structures/legendary/structure_cosmic_monument_v1.png.png');

// Species
const SPECIES_CRYSTALLINE = require('../assets/species/species_crystalline_v1.png.png');
const SPECIES_FLOATING = require('../assets/species/species_floating_v1.png.png');
const SPECIES_BIOMECHANICAL = require('../assets/species/species_biomechanical_v1.png.png');
const SPECIES_ENERGY = require('../assets/species/species_energy_v1.png.png');

// Rewards
export const CRYSTAL_ICON = require('../assets/rewards/icons/crystal_icon_v1.png.png');
export const REWARD_CAPSULE = require('../assets/rewards/capsules/reward_capsule_v1.png.png');
export const BADGE_STREAK = require('../assets/rewards/badges/badge_streak_gold_v1.png.png');
export const BADGE_COOP = require('../assets/rewards/badges/badge_coop_v1.png.png');
export const FRAME_LEGENDARY = require('../assets/rewards/frames/frame_legendary_v1.png.png');

// UI
export const AI_AVATAR = require('../assets/ui/ai/ai_avatar_v1.png.png');
export const APP_ICON = require('../assets/ui/icons/app_icon_v1.png.png');
export const SPLASH_SCREEN = require('../assets/ui/splash/splash_screen_v1.png.png');
export const MISSION_BG = require('../assets/ui/backgrounds/mission_background_v1.png.png');

// Onboarding
export const ONBOARDING_UNIVERSE = require('../assets/ui/onboarding/onboarding_universe_v1.png.png');
export const ONBOARDING_PORTFOLIO = require('../assets/ui/onboarding/onboarding_portfolio_v1.png.png');
export const ONBOARDING_AI = require('../assets/ui/onboarding/onboarding_ai_v1.png.png');
export const ONBOARDING_FOCUS = require('../assets/ui/onboarding/onboarding_focus_v1.png.png');
export const ONBOARDING_COOP = require('../assets/ui/onboarding/onboarding_coop_v1.png.png');

// Backgrounds
export const BG_STARS = require('../assets/backgrounds/stars_layer_v1.png.png');
export const BG_NEBULA_OVERLAY = require('../assets/backgrounds/nebula_overlay_v1.png.png');
export const BG_COSMIC_DEEP = require('../assets/backgrounds/cosmic_deep_v1.webp.png');
export const BG_GALAXY = require('../assets/backgrounds/galaxy_layer_v1.webp.png');
export const BG_PARTICLES = require('../assets/backgrounds/particles_ambient_v1.png.png');

// All assets in a flat array — used for bulk preloading at startup
export const ALL_ASSETS = [
  PLANET_STARTER, PLANET_COMMON, PLANET_FROZEN, PLANET_OCEAN,
  PLANET_RARE, PLANET_VOLCANIC, PLANET_NEBULA, PLANET_LEGENDARY, PLANET_CRYSTAL,
  ALIEN_STARTER, ALIEN_MOONLING, ALIEN_AQUATIC, ALIEN_SCHOLAR, ALIEN_ROBOTIC,
  ALIEN_GLOWING, ALIEN_COSMIC, ALIEN_LEGENDARY_IMG,
  STRUCTURE_HABITAT, STRUCTURE_RESEARCH, STRUCTURE_LIBRARY, STRUCTURE_OBSERVATORY,
  STRUCTURE_PORTAL, STRUCTURE_CIVILIZATION, STRUCTURE_MONUMENT,
  SPECIES_CRYSTALLINE, SPECIES_FLOATING, SPECIES_BIOMECHANICAL, SPECIES_ENERGY,
  CRYSTAL_ICON, REWARD_CAPSULE, BADGE_STREAK, BADGE_COOP, FRAME_LEGENDARY,
  AI_AVATAR, APP_ICON, SPLASH_SCREEN, MISSION_BG,
  ONBOARDING_UNIVERSE, ONBOARDING_PORTFOLIO, ONBOARDING_AI, ONBOARDING_FOCUS, ONBOARDING_COOP,
  BG_STARS, BG_NEBULA_OVERLAY, BG_COSMIC_DEEP, BG_GALAXY, BG_PARTICLES,
] as const;

// Species map
export const SPECIES = {
  crystalline: SPECIES_CRYSTALLINE,
  floating: SPECIES_FLOATING,
  biomechanical: SPECIES_BIOMECHANICAL,
  energy: SPECIES_ENERGY,
} as const;

// Stable hash — no Math.random() so value is deterministic per render
function stableHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[stableHash(seed) % arr.length];
}

export type PlanetRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AlienRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type StructureRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export function getPlanetImage(rarity: PlanetRarity, seed = 'default') {
  switch (rarity) {
    case 'starter': return PLANET_STARTER;
    case 'common': return PLANET_COMMON;
    case 'uncommon': return pick([PLANET_FROZEN, PLANET_OCEAN], seed);
    case 'rare': return pick([PLANET_RARE, PLANET_VOLCANIC], seed);
    case 'epic': return PLANET_NEBULA;
    case 'legendary': return pick([PLANET_LEGENDARY, PLANET_CRYSTAL], seed);
  }
}

export function getAlienImage(rarity: AlienRarity, seed = 'default') {
  switch (rarity) {
    case 'starter': return ALIEN_STARTER;
    case 'common': return ALIEN_MOONLING;
    case 'uncommon': return ALIEN_AQUATIC;
    case 'rare': return pick([ALIEN_SCHOLAR, ALIEN_ROBOTIC], seed);
    case 'epic': return ALIEN_GLOWING;
    case 'legendary': return pick([ALIEN_COSMIC, ALIEN_LEGENDARY_IMG], seed);
  }
}

export function getStructureImage(rarity: StructureRarity, seed = 'default') {
  switch (rarity) {
    case 'common': return STRUCTURE_HABITAT;
    case 'uncommon': return STRUCTURE_RESEARCH;
    case 'rare': return pick([STRUCTURE_LIBRARY, STRUCTURE_OBSERVATORY], seed);
    case 'epic': return STRUCTURE_PORTAL;
    case 'legendary': return pick([STRUCTURE_CIVILIZATION, STRUCTURE_MONUMENT], seed);
  }
}
