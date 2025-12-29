
import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, BossPhase, PlaneConfig } from '../types';
import { RIVAL_PLANE_STATS, WORLD_SIZE, GATE_STATS, BULLET_STATS, OBSTACLE_COUNT, EXPLOSION_PARTICLES, AI_PLANE_STATS, RED_ASTEROID_SCORE, ASTEROID_DESPAWN_RADIUS, ASTEROID_SPAWN_RADIUS, ASTEROID_MAX_SPEED, BOSS_STATS } from '../constants';

interface GameCanvasProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  onGameWin: (score: number) => void;
  onDistanceUpdate: (distance: number) => void;
  onBossHealthUpdate: (hp: number, maxHp: number, name: string) => void;
  gameState: GameState;
  selectedPlane: PlaneConfig;
}

const MAIN_LAYER = 0;
const TRAIL_MAX_POINTS = 50;

interface GateEntity {
  mesh: THREE.Group;
  passed: boolean;
  id: string;
}

interface AIEntity {
  mesh: THREE.Group;
  id: string;
}

interface RivalEntity {
    mesh: THREE.Group;
    velocity: THREE.Vector3;
    isPanic: boolean;
}

interface BossEntity {
  mesh: THREE.Group;
  type: BossPhase;
  hp: number;
  maxHp: number;
  weakPointMesh?: THREE.Mesh; // Specifically for the Planet Mansion
  lastShot?: number;
  revealed: boolean;
}

interface ObstacleEntity {
  mesh: THREE.Mesh;
  radius: number; 
  isRed: boolean;
  velocity: THREE.Vector3;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onScoreUpdate, onGameOver, onGameWin, onDistanceUpdate, onBossHealthUpdate, gameState, selectedPlane }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use a ref to access the latest plane config inside the animation loop without restarting it
  const planeConfigRef = useRef(selectedPlane);
  
  // Use refs for callbacks to prevent re-initialization of the scene when parent state changes
  const callbacksRef = useRef({
    onScoreUpdate,
    onGameOver,
    onGameWin,
    onDistanceUpdate,
    onBossHealthUpdate
  });

  useEffect(() => {
    callbacksRef.current = {
        onScoreUpdate,
        onGameOver,
        onGameWin,
        onDistanceUpdate,
        onBossHealthUpdate
    };
  }, [onScoreUpdate, onGameOver, onGameWin, onDistanceUpdate, onBossHealthUpdate]);
  
  useEffect(() => {
      planeConfigRef.current = selectedPlane;
  }, [selectedPlane]);

  const stateRef = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    plane: null as THREE.Group | null,
    nitroMesh: null as THREE.Mesh | null,
    targetIndicator: null as THREE.Group | null,
    
    // Phase Management
    phase: BossPhase.RIVAL,
    rival: null as RivalEntity | null,
    boss: null as BossEntity | null,
    
    rivalTrail: null as THREE.Line | null,
    rivalTrailPoints: [] as THREE.Vector3[],
    wingtips: { left: new THREE.Object3D(), right: new THREE.Object3D() },
    trails: { left: null as THREE.Line | null, right: null as THREE.Line | null },
    trailPoints: { left: [] as THREE.Vector3[], right: [] as THREE.Vector3[] },
    gates: [] as GateEntity[],
    aiPlanes: [] as AIEntity[],
    bullets: [] as { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; isEnemy?: boolean }[],
    obstacles: [] as ObstacleEntity[],
    particles: [] as THREE.Points[],
    keys: {} as Record<string, boolean>,
    mouse: new THREE.Vector2(),
    lastShot: 0,
    isMouseDown: false,
    score: 0,
    frameId: 0,
    clock: new THREE.Clock()
  });

  const createExplosion = (pos: THREE.Vector3, color: number, scale = 1) => {
    const geo = new THREE.BufferGeometry();
    const count = EXPLOSION_PARTICLES * scale;
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 8 * scale,
        (Math.random() - 0.5) * 8 * scale,
        (Math.random() - 0.5) * 8 * scale
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 4 * scale, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    stateRef.current.scene?.add(points);
    
    const explosion = { points, velocities, life: 1.0 };
    (points as any).userData = explosion;
    stateRef.current.particles.push(points);
  };

  const createPlayerPlaneModel = (color: number) => {
    const planeGroup = new THREE.Group();
    const planeMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.8 });
    const fuselageMain = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 18, 16), planeMat);
    fuselageMain.rotation.x = Math.PI / 2;
    planeGroup.add(fuselageMain);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 16), planeMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 13.5;
    planeGroup.add(nose);
    const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.8, 5, 16), planeMat);
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.z = -11.5;
    planeGroup.add(tailCone);
    
    // Vertical Stabilizer (Tail)
    const tailFinShape = new THREE.Shape();
    tailFinShape.moveTo(0, 0); tailFinShape.lineTo(6, 0); tailFinShape.lineTo(2, 6); tailFinShape.lineTo(0, 6);
    const tailFinGeo = new THREE.ExtrudeGeometry(tailFinShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
    const tailFin = new THREE.Mesh(tailFinGeo, planeMat);
    tailFin.rotation.y = -Math.PI / 2;
    tailFin.position.set(0.3, 1.5, -12);
    planeGroup.add(tailFin);

    const cockpit = new THREE.Mesh( new THREE.CapsuleGeometry(2.0, 6, 4, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0.9 }));
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.set(0, 2.0, 4);
    planeGroup.add(cockpit);
    const rightWingShape = new THREE.Shape();
    rightWingShape.moveTo(0, 2); rightWingShape.lineTo(12, -4); rightWingShape.lineTo(12, -12); rightWingShape.lineTo(0, -8);
    const rightWingGeo = new THREE.ExtrudeGeometry(rightWingShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
    const rightWing = new THREE.Mesh(rightWingGeo, planeMat);
    rightWing.rotation.x = -Math.PI / 2; rightWing.position.set(2.5, 0, 0);
    planeGroup.add(rightWing);
    const leftWingShape = new THREE.Shape();
    leftWingShape.moveTo(0, 2); leftWingShape.lineTo(-12, -4); leftWingShape.lineTo(-12, -12); leftWingShape.lineTo(0, -8);
    const leftWingGeo = new THREE.ExtrudeGeometry(leftWingShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
    const leftWing = new THREE.Mesh(leftWingGeo, planeMat);
    leftWing.rotation.x = -Math.PI / 2; leftWing.position.set(-2.5, 0, 0);
    planeGroup.add(leftWing);
    
    // Engine Glow
    const engineGlow = new THREE.Mesh( new THREE.CircleGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
    engineGlow.rotation.y = Math.PI; engineGlow.position.z = -14.1;
    planeGroup.add(engineGlow);
    const nitroGeo = new THREE.ConeGeometry(1.5, 12, 16);
    const nitroMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const nitroFlame = new THREE.Mesh(nitroGeo, nitroMat);
    nitroFlame.rotation.x = -Math.PI / 2; nitroFlame.position.set(0, 0, -20); nitroFlame.visible = false;
    planeGroup.add(nitroFlame);
    (planeGroup as any).nitroMesh = nitroFlame; 
    
    // Indicator
    const indicatorGroup = new THREE.Group();
    const arrowHeadGeo = new THREE.ConeGeometry(0.8, 3, 8);
    arrowHeadGeo.rotateX(Math.PI / 2);
    const arrowHead = new THREE.Mesh(arrowHeadGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    arrowHead.position.z = 2;
    indicatorGroup.add(arrowHead);
    const arrowShaftGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    arrowShaftGeo.rotateX(Math.PI / 2);
    const arrowShaft = new THREE.Mesh(arrowShaftGeo, new THREE.MeshBasicMaterial({ color: 0xcc0000 }));
    indicatorGroup.add(arrowShaft);
    indicatorGroup.position.set(0, 8, 2);
    planeGroup.add(indicatorGroup);
    (planeGroup as any).targetIndicator = indicatorGroup;

    // SCALED UP 3x FROM ORIGINAL 1.8 -> 5.4
    planeGroup.scale.set(5.4, 5.4, 5.4);
    return planeGroup;
};

  const createDeathStar = (pos: THREE.Vector3) => {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: BOSS_STATS.deathStar.color, roughness: 0.5, metalness: 0.7 });
      
      // Main sphere
      const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(BOSS_STATS.deathStar.radius, 3), mat);
      group.add(sphere);

      // Trench
      const trenchGeo = new THREE.TorusGeometry(BOSS_STATS.deathStar.radius * 1.01, 8, 16, 100);
      const trench = new THREE.Mesh(trenchGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
      group.add(trench);

      // Eye/Dish
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(BOSS_STATS.deathStar.radius * 0.25, 5, 15, 32), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      dish.rotation.x = Math.PI / 2;
      dish.position.set(0, BOSS_STATS.deathStar.radius * 0.6, BOSS_STATS.deathStar.radius * 0.7);
      group.add(dish);

      // Surface Greebles
      for(let i=0; i<150; i++) {
        const size = Math.random() * 8 + 4;
        const greeble = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color: 0x777777 }));
        
        // Random position on surface
        const phi = Math.acos( -1 + ( 2 * i ) / 150 );
        const theta = Math.sqrt( 150 * Math.PI ) * phi;
        const r = BOSS_STATS.deathStar.radius;
        
        greeble.position.setFromSphericalCoords(r, phi, theta);
        greeble.lookAt(0,0,0);
        group.add(greeble);
      }

      group.position.copy(pos);
      return group;
  };

  const createPlanetBoss = (pos: THREE.Vector3) => {
      const group = new THREE.Group();
      
      // Planet Base
      const planetMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.8, metalness: 0.2 }); // Darker ocean blue
      const planet = new THREE.Mesh(new THREE.SphereGeometry(BOSS_STATS.planet.radius, 64, 64), planetMat);
      group.add(planet);

      // Add Terrain / Trees
      for(let i=0; i<80; i++) {
         const size = Math.random() * 40 + 20;
         const terrainType = Math.random() > 0.5 ? 0x166534 : 0x15803d; // Green shades
         const geo = Math.random() > 0.3 ? new THREE.ConeGeometry(size, size * 2, 5) : new THREE.DodecahedronGeometry(size);
         const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: terrainType, roughness: 1.0 }));
         
         // Random pos
         const phi = Math.random() * Math.PI;
         const theta = Math.random() * Math.PI * 2;
         mesh.position.setFromSphericalCoords(BOSS_STATS.planet.radius, phi, theta);
         mesh.lookAt(0,0,0);
         group.add(mesh);
      }

      // Mansion (Weak Point) - Detailed
      const mansionGroup = new THREE.Group();
      const mansionMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2 }); // White marble
      const mansionBase = new THREE.Mesh(new THREE.BoxGeometry(80, 40, 60), mansionMat);
      
      // Pillars
      const pillarGeo = new THREE.CylinderGeometry(3, 3, 40, 8);
      for(let x=-30; x<=30; x+=20) {
          const p = new THREE.Mesh(pillarGeo, mansionMat);
          p.position.set(x, 0, 32);
          mansionGroup.add(p);
      }

      // Wings
      const wingGeo = new THREE.BoxGeometry(30, 30, 40);
      const leftWing = new THREE.Mesh(wingGeo, mansionMat); leftWing.position.set(-55, -5, 0);
      const rightWing = new THREE.Mesh(wingGeo, mansionMat); rightWing.position.set(55, -5, 0);
      mansionGroup.add(leftWing);
      mansionGroup.add(rightWing);

      // Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(60, 40, 4), new THREE.MeshStandardMaterial({ color: 0x9f1239 })); // Red roof
      roof.position.y = 40;
      roof.rotation.y = Math.PI / 4;
      
      mansionGroup.add(mansionBase);
      mansionGroup.add(roof);

      // Position Mansion on surface (North Pole)
      mansionGroup.position.set(0, BOSS_STATS.planet.radius, 0);
      group.add(mansionGroup);

      // Add Turrets - Detailed
      for(let i=0; i<8; i++) {
          const turretGroup = new THREE.Group();
          
          // Base
          const base = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 15), new THREE.MeshStandardMaterial({ color: 0x333333 }));
          turretGroup.add(base);

          // Rotating Head
          const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 16), new THREE.MeshStandardMaterial({ color: 0x660000 }));
          head.position.y = 8;
          turretGroup.add(head);

          // Barrels
          const barrelGeo = new THREE.CylinderGeometry(2, 2, 20, 8);
          const b1 = new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x111111 }));
          b1.rotation.x = Math.PI/2;
          b1.position.set(-4, 8, 10);
          const b2 = b1.clone();
          b2.position.set(4, 8, 10);
          turretGroup.add(b1);
          turretGroup.add(b2);
          
          // Position them in a ring around the North Pole
          const angle = (i/8) * Math.PI * 2;
          const distFromPole = 140; // slightly wider ring
          
          turretGroup.position.set(
             Math.cos(angle) * distFromPole,
             BOSS_STATS.planet.radius - 10, 
             Math.sin(angle) * distFromPole
          );
          
          turretGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), turretGroup.position.clone().normalize());
          
          group.add(turretGroup);
      }

      group.position.copy(pos);
      // Return group and specific reference to mansion for hit detection (use base box)
      return { group, weakPoint: mansionBase }; 
  };

  const spawnAIPlane = (pos?: THREE.Vector3) => {
    const state = stateRef.current;
    if (!state.scene) return;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: AI_PLANE_STATS.color, roughness: 0.4, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(2, 10, 8), mat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const wingGeo = new THREE.BoxGeometry(12, 0.5, 5);
    const wings = new THREE.Mesh(wingGeo, mat);
    wings.position.z = 1;
    group.add(wings);
    const spawnPos = pos || new THREE.Vector3((Math.random() - 0.5) * WORLD_SIZE.width, (Math.random() - 0.5) * WORLD_SIZE.height * 0.8, (Math.random() - 0.5) * WORLD_SIZE.depth);
    group.position.copy(spawnPos);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.layers.set(MAIN_LAYER);
    state.scene.add(group);
    state.aiPlanes.push({ mesh: group, id: Math.random().toString() });
  };

  const createGate = (pos: THREE.Vector3, rot: THREE.Euler): GateEntity => {
    const gateGroup = new THREE.Group();
    const torus = new THREE.Mesh( new THREE.TorusGeometry(GATE_STATS.radius, GATE_STATS.thickness, 6, 24), new THREE.MeshStandardMaterial({ color: GATE_STATS.color, emissive: GATE_STATS.color, emissiveIntensity: 3, roughness: 0.1, metalness: 0.8 }));
    gateGroup.add(torus);
    const energyField = new THREE.Mesh( new THREE.CircleGeometry(GATE_STATS.radius, 6), new THREE.MeshBasicMaterial({ color: GATE_STATS.color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    gateGroup.add(energyField);
    gateGroup.position.copy(pos);
    gateGroup.quaternion.setFromEuler(rot);
    gateGroup.layers.set(MAIN_LAYER);
    stateRef.current.scene?.add(gateGroup);
    return { mesh: gateGroup, passed: false, id: Math.random().toString(36).slice(2, 11) };
  };

  const createTrail = (scene: THREE.Scene, color = 0x38bdf8): THREE.Line => {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.layers.set(MAIN_LAYER);
    scene.add(line);
    return line;
  };

  const spawnGates = useCallback((count: number) => {
    const state = stateRef.current;
    if (!state.scene || !state.plane) return;
    for (let i = 0; i < count; i++) {
      const forward = new THREE.Vector3(0,0,1).applyQuaternion(state.plane.quaternion);
      const spawnCenter = state.plane.position.clone().add(forward.clone().multiplyScalar(1000 + Math.random() * 2000));
      const spawnVolume = 2000;
      const px = spawnCenter.x + (Math.random() - 0.5) * spawnVolume;
      const py = spawnCenter.y + (Math.random() - 0.5) * spawnVolume;
      const pz = spawnCenter.z + (Math.random() - 0.5) * spawnVolume;
      const rot = new THREE.Euler( Math.random() * Math.PI, Math.random() * Math.PI, 0 );
      state.gates.push(createGate(new THREE.Vector3(px, py, pz), rot));
    }
  }, []);

  const spawnSingleObstacle = useCallback((pos?: THREE.Vector3) => {
    const state = stateRef.current;
    if (!state.scene) return;
    const rockColors = [0x334155, 0x475569, 0x1e293b, 0x57534e];
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const isRed = Math.random() < 0.15;
    const color = isRed ? 0xff3333 : rockColors[Math.floor(Math.random() * rockColors.length)];
    const obsMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, flatShading: true, emissive: isRed ? 0x550000 : 0x000000, emissiveIntensity: 0.5 });
    const obs = new THREE.Mesh(rockGeo, obsMat);
    const scaleBase = Math.random();
    let scale = 1;
    if (scaleBase > 0.95) scale = Math.random() * 180 + 120;
    else if (scaleBase > 0.7) scale = Math.random() * 100 + 50;
    else scale = Math.random() * 40 + 15;
    obs.scale.set( scale * (0.8 + Math.random() * 0.4), scale * (0.8 + Math.random() * 0.4), scale * (0.8 + Math.random() * 0.4) );
    const spawnPos = pos || new THREE.Vector3( (Math.random() - 0.5) * WORLD_SIZE.width, (Math.random() - 0.5) * WORLD_SIZE.height, (Math.random() - 0.5) * WORLD_SIZE.depth );
    obs.position.copy(spawnPos);
    obs.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    obs.layers.set(MAIN_LAYER);
    state.scene.add(obs);
    const maxScale = Math.max(obs.scale.x, obs.scale.y, obs.scale.z);
    const velocity = new THREE.Vector3( (Math.random() - 0.5) * ASTEROID_MAX_SPEED, (Math.random() - 0.5) * ASTEROID_MAX_SPEED, (Math.random() - 0.5) * ASTEROID_MAX_SPEED );
    const obstacleEntity: ObstacleEntity = { mesh: obs, radius: maxScale * 0.85, isRed, velocity };
    state.obstacles.push(obstacleEntity);
  }, []);

  const startDeathStarPhase = (pos: THREE.Vector3) => {
      const state = stateRef.current;
      if (!state.scene) return;
      const deathStarMesh = createDeathStar(pos);
      state.scene.add(deathStarMesh);
      state.boss = {
          mesh: deathStarMesh,
          type: BossPhase.DEATH_STAR,
          hp: BOSS_STATS.deathStar.hp,
          maxHp: BOSS_STATS.deathStar.hp,
          revealed: false // Initially hidden logic
      };
      state.phase = BossPhase.DEATH_STAR;
      // Do not reveal UI yet
  };

  const startPlanetPhase = (pos: THREE.Vector3) => {
      const state = stateRef.current;
      if (!state.scene) return;
      const { group, weakPoint } = createPlanetBoss(pos);
      state.scene.add(group);
      state.boss = {
          mesh: group,
          type: BossPhase.PLANET,
          hp: BOSS_STATS.planet.hp,
          maxHp: BOSS_STATS.planet.hp,
          weakPointMesh: weakPoint,
          lastShot: 0,
          revealed: false // Initially hidden logic
      };
      state.phase = BossPhase.PLANET;
      // Do not reveal UI yet
  };

  const fireEnemyBullet = (origin: THREE.Vector3, target: THREE.Vector3) => {
      const state = stateRef.current;
      if (!state.scene) return;
      const direction = target.clone().sub(origin).normalize();
      const bullet = new THREE.Mesh( new THREE.SphereGeometry(3), new THREE.MeshBasicMaterial({ color: 0xff0000 }) ); // Slightly larger enemy bullets
      bullet.position.copy(origin);
      state.scene.add(bullet);
      state.bullets.push({ mesh: bullet, vel: direction.multiplyScalar(BOSS_STATS.planet.turretSpeed), life: 200, isEnemy: true });
  };

  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    const state = stateRef.current;
    if (state.renderer) {
      containerRef.current.removeChild(state.renderer.domElement);
      state.renderer.dispose();
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);
    scene.fog = new THREE.FogExp2(0x0a0f1e, 0.0003);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 30000);
    camera.layers.enable(MAIN_LAYER);
    
    // REMOVED logarithmicDepthBuffer: true to fix compatibility/blank screen issues
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0f1e, 1); // Explicitly set clear color
    
    containerRef.current.appendChild(renderer.domElement);
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xfff0dd, 2);
    sunLight.position.set(2000, 3000, 2000);
    scene.add(sunLight);
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(10000 * 3);
    for(let i=0; i<10000; i++) {
        starPositions[i*3] = (Math.random() - 0.5) * 30000;
        starPositions[i*3+1] = (Math.random() - 0.5) * 30000;
        starPositions[i*3+2] = (Math.random() - 0.5) * 30000;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 8, sizeAttenuation: false });
    const stars = new THREE.Points(starGeo, starMat);
    stars.layers.set(MAIN_LAYER);
    scene.add(stars);

    const currentConfig = planeConfigRef.current;
    const planeGroup = createPlayerPlaneModel(currentConfig.color);
    
    state.nitroMesh = (planeGroup as any).nitroMesh;
    state.targetIndicator = (planeGroup as any).targetIndicator;
    state.wingtips.left.position.set(-20, 0, -12);
    state.wingtips.right.position.set(20, 0, -12);
    planeGroup.add(state.wingtips.left);
    planeGroup.add(state.wingtips.right);
    planeGroup.layers.set(MAIN_LAYER);
    scene.add(planeGroup);
    
    // Spawn Rival (Phase 0)
    const rivalGroup = createPlayerPlaneModel(RIVAL_PLANE_STATS.color);
    // Reset scale for rival as we want player to feel big, but rival can be normal or slightly bigger
    rivalGroup.scale.set(3.5, 3.5, 3.5); 

    rivalGroup.traverse(child => {
        if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({ 
                color: RIVAL_PLANE_STATS.color, 
                roughness: 0.3, 
                metalness: 0.8, 
                emissive: RIVAL_PLANE_STATS.color, 
                emissiveIntensity: 0.8
            });
        }
    });
    const rivalPointLight = new THREE.PointLight(RIVAL_PLANE_STATS.color, 500, 400);
    rivalGroup.add(rivalPointLight);
    const rivalIndicator = (rivalGroup as any).targetIndicator;
    if (rivalIndicator) rivalIndicator.visible = false;

    // Start rival at 10,000m random angle
    const spawnDist = 10000;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * 0.5;
    const rivalPos = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi) * spawnDist,
        Math.sin(phi) * spawnDist,
        Math.sin(theta) * Math.cos(phi) * spawnDist
    );
    rivalGroup.position.copy(rivalPos);
    rivalGroup.lookAt(new THREE.Vector3(0,0,0));
    rivalGroup.rotateY(Math.PI);
    
    scene.add(rivalGroup);
    
    // REMOVED Raycaster from state.rival to prevent CPU freeze on frame 1
    state.rival = { mesh: rivalGroup, velocity: new THREE.Vector3(), isPanic: false };
    state.phase = BossPhase.RIVAL;
    state.boss = null;
    
    state.rivalTrail = createTrail(scene, 0xff0000);
    state.rivalTrailPoints = [];

    state.trails.left = createTrail(scene); state.trails.right = createTrail(scene);
    state.trailPoints.left = []; state.trailPoints.right = [];
    
    state.scene = scene; state.camera = camera; state.renderer = renderer; state.plane = planeGroup;
    state.obstacles = []; state.gates = []; state.bullets = []; state.particles = []; state.aiPlanes = []; state.score = 0;
    
    for (let i = 0; i < OBSTACLE_COUNT; i++) { spawnSingleObstacle(); }
    
    callbacksRef.current.onScoreUpdate(0); 
    callbacksRef.current.onDistanceUpdate(0); 
    spawnGates(GATE_STATS.spawnCount);
    for(let i=0; i < AI_PLANE_STATS.count; i++) spawnAIPlane();
    callbacksRef.current.onBossHealthUpdate(0, 100, "");

  }, [spawnGates, spawnSingleObstacle]);

  const fireBullet = () => {
    const state = stateRef.current;
    const now = Date.now();
    if (now - state.lastShot < BULLET_STATS.cooldown || !state.plane || !state.scene || !state.camera) return;
    
    // Raycasting Logic
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(state.mouse, state.camera);

    // Find a point far away in the direction of the cursor to aim at
    const targetPoint = new THREE.Vector3();
    raycaster.ray.at(1000, targetPoint); // Get point 1000 units away

    // Calculate direction from plane to that target point
    const direction = targetPoint.sub(state.plane.position).normalize();

    const bullet = new THREE.Mesh( new THREE.SphereGeometry(BULLET_STATS.radius * 2), new THREE.MeshBasicMaterial({ color: BULLET_STATS.color }) ); // Larger bullets for larger plane
    bullet.position.copy(state.plane.position).add(direction.clone().multiplyScalar(50)); // Spawn further out
    bullet.layers.set(MAIN_LAYER);
    state.scene.add(bullet);
    state.bullets.push({ mesh: bullet, vel: direction.multiplyScalar(BULLET_STATS.speed), life: BULLET_STATS.life, isEnemy: false });
    state.lastShot = now;
  };

  const update = () => {
    const state = stateRef.current;
    if (!state.plane || !state.camera || !state.renderer || !state.scene || gameState !== GameState.PLAYING) return;
    
    const currentConfig = planeConfigRef.current;

    // Movement
    let yaw = 0, pitch = 0, roll = 0;
    if (state.keys['a'] || state.keys['arrowleft']) yaw = currentConfig.turnSpeed;
    if (state.keys['d'] || state.keys['arrowright']) yaw = -currentConfig.turnSpeed;
    if (state.keys['w'] || state.keys['arrowup']) pitch = -currentConfig.turnSpeed;
    if (state.keys['s'] || state.keys['arrowdown']) pitch = currentConfig.turnSpeed;
    if (state.keys['e']) roll = currentConfig.rollSpeed;
    if (state.keys['q']) roll = -currentConfig.rollSpeed;
    state.plane.rotateY(yaw); state.plane.rotateX(pitch); state.plane.rotateZ(roll);
    const isNitro = state.keys[' '];
    const currentSpeed = isNitro ? currentConfig.nitroSpeed : currentConfig.speed;
    state.plane.translateZ(currentSpeed);
    
    // DEFINED HERE TO AVOID REFERENCE ERROR IN BULLET LOOP
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(state.plane.quaternion);

    if (state.nitroMesh) {
      state.nitroMesh.visible = !!isNitro;
      if (isNitro) {
        const scale = 0.8 + Math.random() * 0.4;
        state.nitroMesh.scale.set(scale, scale, 2.5 * scale);
        (state.nitroMesh.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.random() * 0.4;
      }
    }

    const leftPos = new THREE.Vector3(), rightPos = new THREE.Vector3();
    state.wingtips.left.getWorldPosition(leftPos); state.wingtips.right.getWorldPosition(rightPos);
    state.trailPoints.left.push(leftPos.clone()); state.trailPoints.right.push(rightPos.clone());
    if (state.trailPoints.left.length > TRAIL_MAX_POINTS) { state.trailPoints.left.shift(); state.trailPoints.right.shift(); }
    if (state.trails.left && state.trails.right) { state.trails.left.geometry.setFromPoints(state.trailPoints.left); state.trails.right.geometry.setFromPoints(state.trailPoints.right); }
    if (state.isMouseDown) fireBullet();

    const playerPos = state.plane.position;
    const despawnRadiusSq = ASTEROID_DESPAWN_RADIUS * ASTEROID_DESPAWN_RADIUS;
    
    // --- PHASE 0: RIVAL (OPTIMIZED) ---
    // Removed expensive Raycasting. Replaced with simple distance check for dodging.
    if (state.phase === BossPhase.RIVAL && state.rival) {
        const rival = state.rival;
        const distanceToPlayer = playerPos.distanceTo(rival.mesh.position);
        
        // Basic Fleeing logic
        const fleeVector = rival.mesh.position.clone().sub(playerPos).normalize();
        
        // Simple Obstacle Avoidance (Check only the closest obstacles)
        const avoidance = new THREE.Vector3();
        let nearObstacles = 0;
        
        // Only check a subset or nearby obstacles to prevent freezing
        // For performance, we actually iterate all but perform simple distance checks, 
        // which is much faster than raycasting.
        const avoidanceDistSq = 400 * 400; // 400 units squared
        for(let i=0; i<state.obstacles.length; i++) {
            const obs = state.obstacles[i];
            const distSq = rival.mesh.position.distanceToSquared(obs.mesh.position);
            if (distSq < avoidanceDistSq) {
                // Push away
                const push = rival.mesh.position.clone().sub(obs.mesh.position).normalize();
                avoidance.add(push);
                nearObstacles++;
                // Break early if we found enough threats to react to
                if (nearObstacles > 3) break; 
            }
        }

        let desiredDirection = fleeVector;
        if (nearObstacles > 0) {
            desiredDirection.add(avoidance).normalize();
        }

        let targetSpeed = RIVAL_PLANE_STATS.speed;
        if (distanceToPlayer < RIVAL_PLANE_STATS.panicDistance) {
            targetSpeed = RIVAL_PLANE_STATS.escapeSpeed;
            rival.isPanic = true;
        } else {
            rival.isPanic = false;
        }

        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), desiredDirection);
        rival.mesh.quaternion.slerp(targetQuaternion, RIVAL_PLANE_STATS.turnSpeed);
        rival.mesh.translateZ(targetSpeed);
        
        state.rivalTrailPoints.push(rival.mesh.position.clone());
        if (state.rivalTrailPoints.length > TRAIL_MAX_POINTS) state.rivalTrailPoints.shift();
        if (state.rivalTrail) state.rivalTrail.geometry.setFromPoints(state.rivalTrailPoints);

        callbacksRef.current.onDistanceUpdate(Math.floor(distanceToPlayer));
        if (state.targetIndicator) {
            state.targetIndicator.visible = true;
            state.targetIndicator.lookAt(rival.mesh.position);
        }
    } 
    // --- PHASE 1 & 2: BOSSES ---
    else if (state.boss) {
        const boss = state.boss;
        const dist = playerPos.distanceTo(boss.mesh.position);
        callbacksRef.current.onDistanceUpdate(Math.floor(dist));
        
        // Reveal Logic: Trigger UI only when close or shot at
        if (!boss.revealed && dist <= 5000) {
            boss.revealed = true;
            callbacksRef.current.onBossHealthUpdate(boss.hp, boss.maxHp, boss.type === BossPhase.DEATH_STAR ? "DEATH STAR" : "THE PLANET");
        }

        if (state.targetIndicator) {
            // Only show target indicator if revealed
            state.targetIndicator.visible = boss.revealed;
            if (boss.revealed) {
                state.targetIndicator.lookAt(boss.mesh.position);
            }
        }

        if (boss.type === BossPhase.DEATH_STAR) {
            boss.mesh.rotation.y += 0.005;
            boss.mesh.rotation.z += 0.002;
        } else if (boss.type === BossPhase.PLANET) {
            boss.mesh.rotation.y += 0.001;
            // Only shoot if revealed (player is close)
            if (boss.revealed && state.frameId % BOSS_STATS.planet.turretCooldown === 0) {
                // Shoot from random turret (indices 2-9)
                const turretIdx = 2 + Math.floor(Math.random() * 8); // Mansion is 0, planet is 1
                // Wait, in createPlanetBoss:
                // 0: Planet sphere
                // 1...80: Trees (80 trees)
                // 81: Mansion Group
                // 82...89: Turret Groups (8 turrets)
                
                // Need to find turrets dynamically or use known index offset
                // Base children count: 1 (sphere) + 80 (trees) + 1 (mansion) + 8 (turrets) = 90
                // Turrets are at the end.
                const totalChildren = boss.mesh.children.length;
                const turretStartIndex = totalChildren - 8;
                const randomTurretOffset = Math.floor(Math.random() * 8);
                const turretGroup = boss.mesh.children[turretStartIndex + randomTurretOffset];

                if (turretGroup) {
                    const spawnPoint = new THREE.Vector3();
                    turretGroup.getWorldPosition(spawnPoint);
                    // Add a slight upward offset so bullet doesn't spawn inside turret base
                    spawnPoint.y += 10; 
                    fireEnemyBullet(spawnPoint, playerPos);
                }
            }
        }
    } else {
        if (state.targetIndicator) state.targetIndicator.visible = false;
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        obs.mesh.position.add(obs.velocity);

        // NEW COLLISION LOGIC HERE
        if (playerPos.distanceTo(obs.mesh.position) < currentConfig.radius + obs.radius) {
             createExplosion(playerPos, currentConfig.color, 2);
             callbacksRef.current.onGameOver(state.score);
             return; 
        }

        if (obs.mesh.position.distanceToSquared(playerPos) > despawnRadiusSq) {
            state.scene.remove(obs.mesh);
            state.obstacles.splice(i, 1);
        }
    }
    
    while(state.obstacles.length < OBSTACLE_COUNT) {
        const spawnCenter = playerPos.clone().add(forward.clone().multiplyScalar(ASTEROID_SPAWN_RADIUS));
        const spawnVolume = 4000;
        const pos = new THREE.Vector3( spawnCenter.x + (Math.random() - 0.5) * spawnVolume, spawnCenter.y + (Math.random() - 0.5) * spawnVolume, spawnCenter.z + (Math.random() - 0.5) * spawnVolume );
        spawnSingleObstacle(pos);
    }

    // AI Planes Logic
    for (let i = state.aiPlanes.length - 1; i >= 0; i--) {
        const ai = state.aiPlanes[i];
        ai.mesh.translateZ(AI_PLANE_STATS.speed);
        if (ai.mesh.position.distanceToSquared(playerPos) > despawnRadiusSq) {
            state.scene.remove(ai.mesh); state.aiPlanes.splice(i, 1);
        } 
        if (playerPos.distanceTo(ai.mesh.position) < currentConfig.radius + AI_PLANE_STATS.radius) {
            createExplosion(playerPos, currentConfig.color); callbacksRef.current.onGameOver(state.score);
        }
    }
    while (state.aiPlanes.length < AI_PLANE_STATS.count) {
      const spawnCenter = playerPos.clone().add(forward.clone().multiplyScalar(ASTEROID_SPAWN_RADIUS));
      const spawnVolume = 4000;
      const pos = new THREE.Vector3( spawnCenter.x + (Math.random() - 0.5) * spawnVolume, spawnCenter.y + (Math.random() - 0.5) * spawnVolume, spawnCenter.z + (Math.random() - 0.5) * spawnVolume );
      spawnAIPlane(pos);
    }
    
    // Bullet Logic
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.mesh.position.add(b.vel); b.life -= 1; 
      let hit = false;
      
      if (b.isEnemy) {
          if (b.mesh.position.distanceTo(playerPos) < currentConfig.radius) {
              createExplosion(playerPos, currentConfig.color, 2);
              callbacksRef.current.onGameOver(state.score);
              hit = true;
          }
      } else {
          // Player Bullets
          if (state.phase === BossPhase.RIVAL && state.rival && b.mesh.position.distanceTo(state.rival.mesh.position) < RIVAL_PLANE_STATS.radius * 2) { // Increased hit radius for rival slightly
              createExplosion(state.rival.mesh.position, RIVAL_PLANE_STATS.color, 2.5);
              state.scene.remove(state.rival.mesh);
              state.score += RIVAL_PLANE_STATS.score; callbacksRef.current.onScoreUpdate(state.score);
              state.rival = null; 
              hit = true;
              const spawnPos = playerPos.clone().add(forward.clone().multiplyScalar(8000));
              startDeathStarPhase(spawnPos);
          }
          if (!hit && state.boss) {
             const boss = state.boss;
             if (boss.type === BossPhase.DEATH_STAR) {
                 if (b.mesh.position.distanceTo(boss.mesh.position) < BOSS_STATS.deathStar.radius) {
                     hit = true;
                     boss.revealed = true; // Reveal on hit
                     boss.hp -= 10;
                     callbacksRef.current.onBossHealthUpdate(boss.hp, boss.maxHp, "DEATH STAR");
                     createExplosion(b.mesh.position, 0xffaa00, 0.5);
                     if (boss.hp <= 0) {
                         createExplosion(boss.mesh.position, BOSS_STATS.deathStar.color, 10);
                         state.scene.remove(boss.mesh);
                         state.score += BOSS_STATS.deathStar.score; callbacksRef.current.onScoreUpdate(state.score);
                         state.boss = null;
                         const spawnPos = playerPos.clone().add(forward.clone().multiplyScalar(8000));
                         startPlanetPhase(spawnPos);
                     }
                 }
             } else if (boss.type === BossPhase.PLANET && boss.weakPointMesh) {
                 const weakPointWorldPos = new THREE.Vector3();
                 boss.weakPointMesh.getWorldPosition(weakPointWorldPos);
                 
                 // Increase hit radius for mansion
                 if (b.mesh.position.distanceTo(weakPointWorldPos) < BOSS_STATS.planet.mansionRadius + 40) {
                     hit = true;
                     boss.revealed = true; // Reveal on hit
                     boss.hp -= 5;
                     callbacksRef.current.onBossHealthUpdate(boss.hp, boss.maxHp, "THE PLANET");
                     createExplosion(b.mesh.position, 0xff0000, 0.8);
                     if (boss.hp <= 0) {
                         createExplosion(boss.mesh.position, 0x3b82f6, 30);
                         state.scene.remove(boss.mesh);
                         state.score += BOSS_STATS.planet.score; callbacksRef.current.onScoreUpdate(state.score);
                         state.boss = null;
                         callbacksRef.current.onGameWin(state.score);
                     }
                 } else if (b.mesh.position.distanceTo(boss.mesh.position) < BOSS_STATS.planet.radius) {
                     hit = true;
                     // Optional: hitting the planet body could also reveal it
                     if (!boss.revealed) {
                        boss.revealed = true;
                        callbacksRef.current.onBossHealthUpdate(boss.hp, boss.maxHp, "THE PLANET");
                     }
                     createExplosion(b.mesh.position, 0x555555, 0.2);
                 }
             }
          }
          if (!hit) {
            for (let j = state.aiPlanes.length - 1; j >= 0; j--) {
              const ai = state.aiPlanes[j];
              if (b.mesh.position.distanceTo(ai.mesh.position) < AI_PLANE_STATS.radius + 10) {
                  createExplosion(ai.mesh.position, AI_PLANE_STATS.color); state.scene.remove(ai.mesh);
                  state.aiPlanes.splice(j, 1); state.score += AI_PLANE_STATS.score; callbacksRef.current.onScoreUpdate(state.score);
                  hit = true; break;
              }
            }
          }
          if (!hit) {
            for (let j = state.obstacles.length - 1; j >= 0; j--) {
              const obs = state.obstacles[j];
              if (obs.isRed && b.mesh.position.distanceTo(obs.mesh.position) < obs.radius + 10) {
                  createExplosion(obs.mesh.position, 0xff0000); state.scene.remove(obs.mesh);
                  state.obstacles.splice(j, 1); state.score += RED_ASTEROID_SCORE; callbacksRef.current.onScoreUpdate(state.score);
                  hit = true; break;
              }
            }
          }
      }
      if (hit || b.life <= 0) { state.scene?.remove(b.mesh); state.bullets.splice(i, 1); }
    }

    // ADJUST CAMERA FOR LARGER PLANE
    // Previously was (0, 32, -85) for scale 1.8. Now scale is 5.4 (3x).
    // Multiply offset by 3 to maintain visual framing.
    const offset = new THREE.Vector3(0, 96, -255).applyQuaternion(state.plane.quaternion); 
    const camPos = state.plane.position.clone().add(offset);
    state.camera.position.lerp(camPos, 0.12);
    state.camera.lookAt(state.plane.position);
    
    state.renderer.render(state.scene, state.camera);
  };

  const animate = () => {
    update();
    stateRef.current.frameId = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initScene();
      stateRef.current.frameId = requestAnimationFrame(animate);
    } else if (stateRef.current.frameId) {
      cancelAnimationFrame(stateRef.current.frameId);
    }
    return () => cancelAnimationFrame(stateRef.current.frameId);
  }, [gameState, initScene]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => stateRef.current.keys[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => stateRef.current.keys[e.key.toLowerCase()] = false;
    const handleMouseDown = () => stateRef.current.isMouseDown = true;
    const handleMouseUp = () => stateRef.current.isMouseDown = false;
    
    // ADDED: Mouse move handler to track cursor position
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse coordinates to -1 to +1 range
      stateRef.current.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      stateRef.current.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleResize = () => {
      if (stateRef.current.camera && stateRef.current.renderer) {
        stateRef.current.camera.aspect = window.innerWidth / window.innerHeight;
        stateRef.current.camera.updateProjectionMatrix();
        stateRef.current.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown); window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove); // Added listener
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown); window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove); // Removed listener
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full cursor-crosshair overflow-hidden" />;
};

export default GameCanvas;
