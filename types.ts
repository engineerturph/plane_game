
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  BRIEFING = 'BRIEFING',
  WIN = 'WIN'
}

export enum BossPhase {
  RIVAL = 0,
  DEATH_STAR = 1,
  PLANET = 2
}

export interface PlaneConfig {
  id: string;
  name: string;
  speed: number;
  nitroSpeed: number;
  turnSpeed: number;
  rollSpeed: number;
  color: number;
  description: string;
  radius: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Entity3D {
  pos: Vector3D;
  rot: Vector3D; // Euler angles
  radius: number;
}

export interface Bullet3D {
  pos: Vector3D;
  vel: Vector3D;
  life: number;
}

export interface Obstacle3D {
  pos: Vector3D;
  size: Vector3D;
  color: string;
}

export interface Particle3D {
  pos: Vector3D;
  vel: Vector3D;
  life: number;
  color: string;
}

export interface MissionInfo {
  name: string;
  objective: string;
  pilotCallsign: string;
}
