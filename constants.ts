export const WORLD_SIZE = {
  width: 8000,
  height: 2500,
  depth: 8000,
};

export const PLAYER_PLANES = [
  {
    id: "intercept",
    name: "X-15 INTERCEPTOR",
    speed: 2.2,
    nitroSpeed: 6.0,
    turnSpeed: 0.045,
    rollSpeed: 0.08,
    color: 0xcbd5e1, // Slate
    description: "Balanced performance for all-round combat.",
    radius: 65, // Increased radius to match visual model scale
  },
  {
    id: "viper",
    name: "V-22 VIPER",
    speed: 2.8,
    nitroSpeed: 7.5,
    turnSpeed: 0.035,
    rollSpeed: 0.06,
    color: 0xfacc15, // Yellow
    description: "High top speed, lower maneuverability. Built for chasing.",
    radius: 60,
  },
  {
    id: "phantom",
    name: "F-99 PHANTOM",
    speed: 1.9,
    nitroSpeed: 5.0,
    turnSpeed: 0.065,
    rollSpeed: 0.12,
    color: 0x818cf8, // Indigo
    description: "Superior agility for tight dodging. Slower engines.",
    radius: 62,
  },
];

// Fallback if needed, though we primarily use the array above now
export const PLANE_STATS = PLAYER_PLANES[0];

export const RIVAL_PLANE_STATS = {
  speed: 1.4,
  escapeSpeed: 4.0,
  turnSpeed: 0.05,
  rollSpeed: 0.1,
  radius: 14,
  color: 0xef4444, // Bright Red
  score: 500,
  avoidanceDistance: 400,
  panicDistance: 1500,
};

export const BOSS_STATS = {
  deathStar: {
    hp: 500,
    radius: 240, // 2x Bigger (was 120)
    score: 2000,
    color: 0x94a3b8,
  },
  planet: {
    hp: 200, // HP of the Mansion
    radius: 800, // Planet size
    mansionRadius: 60,
    score: 5000,
    turretCooldown: 25, // Faster fire rate (was 40)
    turretSpeed: 6.0, // Faster bullets (was 3.5)
  },
};

export const AI_PLANE_STATS = {
  count: 15,
  speed: 1.8,
  radius: 12,
  color: 0xff4444, // Red
  score: 5,
};

export const GATE_STATS = {
  radius: 30,
  thickness: 2,
  color: 0xfacc15, // Golden yellow
  passedColor: 0x22c55e, // Success green
  spawnCount: 35,
};

export const BULLET_STATS = {
  speed: 25, // Faster bullets for aiming
  radius: 1.0,
  cooldown: 400, // Slower fire rate (milliseconds)
  life: 100,
  color: 0x38bdf8, // Cyan bullets
};

export const OBSTACLE_COUNT = 300;
export const RED_ASTEROID_SCORE = 25;
export const EXPLOSION_PARTICLES = 60;

// New constants for procedural generation
export const ASTEROID_MAX_SPEED = 0.5;
export const ASTEROID_SPAWN_RADIUS = 4000;
export const ASTEROID_DESPAWN_RADIUS = 4500;
