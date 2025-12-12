import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Todo } from '../types';

interface StarryNightProps {
  goals?: Todo[];
}

const StarryNight: React.FC<StarryNightProps> = ({ goals = [] }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // ThreeJS References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const goalGroupRef = useRef<THREE.Group | null>(null);
  
  // Data References for animation loop
  const goalsRef = useRef<Todo[]>(goals);
  const labelElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Optimization Refs
  const textureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const spriteMaterialsRef = useRef<Map<string, THREE.SpriteMaterial>>(new Map());
  const nodesRef = useRef<any[]>([]);
  const physicsFrameRef = useRef(0);
  
  // Animation state ref
  const animationRef = useRef<{
    frameId: number | null;
    starData: { x: number; y: number; z: number; speed: number }[];
    geometry: THREE.BufferGeometry | null;
    galaxySystem: THREE.Points | null;
  }>({
    frameId: null,
    starData: [],
    geometry: null,
    galaxySystem: null
  });
  
  // Track if component is mounted to handle cleanup properly
  const isMountedRef = useRef(false);

  // Update goals ref whenever prop changes to keep it fresh in animate loop
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  // Texture Generation Helper (Cached)
  const getTexture = (type: 'star' | 'planet', tier: string) => {
      const key = `${type}-${tier}`;
      if (textureCacheRef.current.has(key)) {
          return textureCacheRef.current.get(key)!;
      }

      const canvas = document.createElement('canvas');
      if (type === 'star') {
        canvas.width = 512; 
        canvas.height = 512;
        const context = canvas.getContext('2d');
        if (context) {
            const cx = 256;
            const cy = 256;
            context.clearRect(0, 0, 512, 512);
            context.globalCompositeOperation = 'lighter';

            // Colors based on tier
            let mainR = 255, mainG = 240, mainB = 100; // Gold
            if (tier === 'silver') { mainR = 220; mainG = 240; mainB = 255; }
            if (tier === 'bronze') { mainR = 255; mainG = 180; mainB = 120; }
            if (tier === 'normal') { mainR = 180; mainG = 140; mainB = 255; } 

            const colorString = (alpha: number) => `rgba(${mainR}, ${mainG}, ${mainB}, ${alpha})`;

            // Glows
            const glow1 = context.createRadialGradient(cx, cy, 20, cx, cy, 250);
            glow1.addColorStop(0, colorString(0.3));
            glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.fillStyle = glow1;
            context.fillRect(0, 0, 512, 512);

            const glow2 = context.createRadialGradient(cx, cy, 5, cx, cy, 100);
            glow2.addColorStop(0, colorString(0.6));
            glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.fillStyle = glow2;
            context.fillRect(0, 0, 512, 512);

            // Spikes
            const drawSpike = (angle: number, length: number, width: number, alpha: number) => {
                context.save();
                context.translate(cx, cy);
                context.rotate(angle);
                const grd = context.createLinearGradient(0, 0, length, 0);
                grd.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                grd.addColorStop(0.3, colorString(alpha * 0.8));
                grd.addColorStop(1, 'rgba(0,0,0,0)');
                context.fillStyle = grd;
                context.beginPath();
                context.moveTo(0, -width);
                context.lineTo(length, 0);
                context.lineTo(0, width);
                context.fill();
                context.rotate(Math.PI);
                context.beginPath();
                context.moveTo(0, -width);
                context.lineTo(length, 0);
                context.lineTo(0, width);
                context.fill();
                context.restore();
            };

            drawSpike(0, 240, 4, 1.0);
            drawSpike(Math.PI / 2, 240, 4, 1.0);
            drawSpike(Math.PI / 4, 140, 2, 0.7);
            drawSpike(-Math.PI / 4, 140, 2, 0.7);
            
            context.globalCompositeOperation = 'source-over'; 
            
            // Bright Core
            const core = context.createRadialGradient(cx, cy, 0, cx, cy, 16);
            core.addColorStop(0, 'rgba(255, 255, 255, 1)');
            core.addColorStop(0.6, 'rgba(255, 255, 255, 1)');
            core.addColorStop(1, 'rgba(255, 255, 255, 0)');
            context.fillStyle = core;
            context.beginPath();
            context.arc(cx, cy, 16, 0, Math.PI * 2);
            context.fill();
        }
      } else {
        // PLANET
        canvas.width = 64; 
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const cx = 32, cy = 32, r = 24;
            let mainR = 255, mainG = 255, mainB = 255;
            if (tier === 'gold') { mainR = 255; mainG = 220; mainB = 100; }
            if (tier === 'silver') { mainR = 200; mainG = 230; mainB = 255; }
            if (tier === 'bronze') { mainR = 255; mainG = 160; mainB = 100; }
            if (tier === 'normal') { mainR = 180; mainG = 140; mainB = 255; }
            
            const grd = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
            grd.addColorStop(0, `rgba(255, 255, 255, 1)`);
            grd.addColorStop(0.4, `rgba(${mainR}, ${mainG}, ${mainB}, 0.8)`);
            grd.addColorStop(1, `rgba(${mainR}, ${mainG}, ${mainB}, 0)`);
            
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      textureCacheRef.current.set(key, texture);
      return texture;
  };

  // Main ThreeJS Setup
  useEffect(() => {
    if (!mountRef.current) return;
    
    isMountedRef.current = true;

    // Mobile Optimization: Reduce particle count
    const isMobile = window.innerWidth < 768;
    const galaxyCount = isMobile ? 1000 : 4000;
    const starCount = isMobile ? 500 : 1500;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02); 
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Container for Goal Stars
    const goalGroup = new THREE.Group();
    scene.add(goalGroup);
    goalGroupRef.current = goalGroup;

    // --- Galaxy Background ---
    const galaxyGeometry = new THREE.BufferGeometry();
    const galaxyPositions = new Float32Array(galaxyCount * 3);
    const galaxyColors = new Float32Array(galaxyCount * 3);
    
    for(let i = 0; i < galaxyCount; i++) {
        const x = (Math.random() - 0.5) * 250;
        const spread = (Math.random() - 0.5) * 40;
        const y = x * 0.3 + spread; 
        const z = -50 - Math.random() * 50; 

        galaxyPositions[i*3] = x;
        galaxyPositions[i*3+1] = y;
        galaxyPositions[i*3+2] = z;

        const dist = Math.abs(spread);
        const normDist = Math.max(0, 1 - dist / 20);

        let r, g, b;
        if (Math.random() > 0.95) {
            r = 0.9; g = 0.9; b = 1.0;
        } else {
            r = 0.3 * normDist + 0.1; 
            g = 0.1 * normDist;
            b = 0.5 * normDist + 0.2; 
        }
        
        const intensity = Math.random() * 0.4 + 0.1;
        galaxyColors[i*3] = r * intensity;
        galaxyColors[i*3+1] = g * intensity;
        galaxyColors[i*3+2] = b * intensity;
    }
    
    galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
    galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));
    
    const galaxyMaterial = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const galaxySystem = new THREE.Points(galaxyGeometry, galaxyMaterial);
    scene.add(galaxySystem);
    animationRef.current.galaxySystem = galaxySystem;

    // --- Star Field (Warp lines) ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 2 * 3);
    const colors = new Float32Array(starCount * 2 * 3);
    const starData: { x: number; y: number; z: number; speed: number }[] = [];

    const getSpawnZ = () => -Math.random() * 80 - 20; 
    const getSpawnX = () => (Math.random() - 0.5) * 100;
    const getSpawnY = () => (Math.random() - 0.5) * 60;

    for (let i = 0; i < starCount; i++) {
      const x = getSpawnX();
      const y = getSpawnY();
      const z = getSpawnZ();
      const speed = (Math.random() * 0.5 + 0.1) * 0.05; 

      starData.push({ x, y, z, speed });

      const brightness = Math.random() * 0.4 + 0.1;
      colors[i * 6 + 0] = brightness;
      colors[i * 6 + 1] = brightness;
      colors[i * 6 + 2] = brightness + 0.2; 
      colors[i * 6 + 3] = 0.05;
      colors[i * 6 + 4] = 0.05;
      colors[i * 6 + 5] = 0.1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Store starData in ref for animation loop
    animationRef.current.starData = starData;
    animationRef.current.geometry = geometry;

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    const starSystem = new THREE.LineSegments(geometry, material);
    scene.add(starSystem);

    // --- Animation Loop ---
    const vector = new THREE.Vector3();
    const MIN_DIST = 2.8;

    const animate = () => {
      if (!isMountedRef.current) return;
      
      animationRef.current.frameId = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;
      
      const currentStarData = animationRef.current.starData;
      const currentGeometry = animationRef.current.geometry;
      const currentGalaxySystem = animationRef.current.galaxySystem;

      // 0. Animate Galaxy
      if (currentGalaxySystem) {
        currentGalaxySystem.rotation.z = time * 0.01;
      }

      // 1. Animate Background Stars
      if (currentGeometry && currentStarData.length > 0) {
        const positionsAttribute = currentGeometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < currentStarData.length; i++) {
          const star = currentStarData[i];
          star.z += star.speed;
          if (star.z > 0) {
            star.z = -100; 
            star.x = getSpawnX();
            star.y = getSpawnY();
          }
          const streakLength = star.speed * 40; 
          const headIndex = i * 2;
          const tailIndex = i * 2 + 1;
          positionsAttribute.setXYZ(headIndex, star.x, star.y, star.z);
          positionsAttribute.setXYZ(tailIndex, star.x, star.y, star.z - streakLength);
        }
        positionsAttribute.needsUpdate = true;
      }

      // 2. Physics Simulation (Throttled)
      // Run for first 120 frames to settle positions
      if (physicsFrameRef.current < 120) {
          const nodes = nodesRef.current;
          for (let i = 0; i < nodes.length; i++) {
              const n1 = nodes[i];
              
              if (n1.tier === 'gold') {
                  n1.x = 0; n1.y = 0;
                  continue;
              }

              const currentDist = Math.sqrt(n1.x * n1.x + n1.y * n1.y) || 0.1;
              const distDiff = currentDist - n1.idealRadius;
              const correction = distDiff * 0.1; 
              n1.x -= (n1.x / currentDist) * correction;
              n1.y -= (n1.y / currentDist) * correction;

              for (let j = i + 1; j < nodes.length; j++) {
                  const n2 = nodes[j];
                  const dx = n1.x - n2.x;
                  const dy = n1.y - n2.y;
                  const dSq = dx*dx + dy*dy;
                  
                  if (dSq < MIN_DIST * MIN_DIST && dSq > 0.001) {
                      const dist = Math.sqrt(dSq);
                      const overlap = MIN_DIST - dist;
                      const force = overlap * 0.5;
                      
                      const fx = (dx / dist) * force;
                      const fy = (dy / dist) * force;

                      if (n1.tier !== 'gold') {
                          n1.x += fx;
                          n1.y += fy;
                      }
                      if (n2.tier !== 'gold') {
                          n2.x -= fx;
                          n2.y -= fy;
                      }
                  }
              }
              
              // Apply computed position to mesh target
              if (n1.mesh && n1.mesh.userData) {
                  n1.mesh.userData.targetX = n1.x;
                  n1.mesh.userData.targetY = n1.y;
              }
          }
          physicsFrameRef.current++;
      }

      // 3. Animate Goal Stars (Primary) & Planets (Nested)
      if (goalGroupRef.current) {
        const parentPositions = new Map<string, THREE.Vector3>();

        // Update Stars
        goalGroupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Sprite && child.userData.type === 'star') {
                const u = child.userData;
                const phase = u.phase || 0;
                
                const flicker = Math.sin(time * 8 + phase * 3) * 0.05 + 
                                Math.sin(time * 15 + phase) * 0.03 + 
                                Math.sin(time * 30 + phase) * 0.02;
                child.material.opacity = 0.95 + flicker; 

                const baseScale = u.baseScale || 3;
                const scaleVar = Math.sin(time * 2 + phase) * (baseScale * 0.03); 
                child.scale.set(baseScale + scaleVar, baseScale + scaleVar, 1);
                
                child.material.rotation = Math.sin(time * 0.1 + phase) * 0.1;

                if (u.targetX !== undefined && u.targetY !== undefined) {
                    const floatX = Math.sin(time * 0.5 + phase) * 0.1; 
                    const floatY = Math.cos(time * 0.3 + phase * 1.5) * 0.1;
                    
                    child.position.x = u.targetX + floatX;
                    child.position.y = u.targetY + floatY;
                    child.position.z = -14;
                    
                    parentPositions.set(u.id, child.position.clone());
                }
            }
        });

        // Update Planets
        goalGroupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Sprite && child.userData.type === 'planet') {
                const u = child.userData;
                const parentPos = parentPositions.get(u.parentId);

                if (parentPos) {
                    const orbitSpeed = u.orbitSpeed || 0.2;
                    const orbitRadius = u.orbitRadius || 1.0;
                    const phase = u.phase || 0;
                    
                    const offsetX = Math.cos(time * orbitSpeed + phase) * orbitRadius;
                    const offsetY = Math.sin(time * orbitSpeed + phase) * orbitRadius;

                    child.position.set(
                        parentPos.x + offsetX,
                        parentPos.y + offsetY,
                        parentPos.z + 0.1 
                    );
                    
                    const pPulse = Math.sin(time * 3 + phase) * 0.1 + 0.9;
                    child.scale.set(u.baseScale * pPulse, u.baseScale * pPulse, 1);
                } else {
                    child.scale.set(0,0,0);
                }
            }
        });
      }

      // 4. Animate Goal Labels
      if (goalGroupRef.current && cameraRef.current && mountRef.current) {
        goalGroupRef.current.children.forEach((child) => {
            if (child.userData.type !== 'star') return;

            const goalId = child.userData.id;
            const element = labelElementsRef.current.get(goalId);
            const tier = child.userData.tier;
            
            if (element) {
                if (tier === 'normal') {
                    element.style.opacity = '0';
                    return;
                }

                child.getWorldPosition(vector);
                vector.project(cameraRef.current);

                const x = (vector.x * 0.5 + 0.5) * mountRef.current!.clientWidth;
                const y = (-(vector.y * 0.5) + 0.5) * mountRef.current!.clientHeight;

                let vOffset = 20;
                if (tier === 'gold') vOffset = 30;
                if (tier === 'silver') vOffset = 22;
                if (tier === 'bronze') vOffset = 18;

                element.style.transform = `translate(${x}px, ${y + vOffset}px) translate(-50%, 0)`;
                element.style.opacity = (vector.z > 1 || Math.abs(vector.x) > 1.2 || Math.abs(vector.y) > 1.2) ? '0' : '1';
            }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      if (animationRef.current.frameId) {
        cancelAnimationFrame(animationRef.current.frameId);
        animationRef.current.frameId = null;
      }
      // Safely remove canvas
      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      // Dispose resources
      geometry.dispose();
      galaxyGeometry.dispose();
      material.dispose();
      galaxyMaterial.dispose();
      renderer.dispose();
      
      // Dispose cached textures (important for StrictMode re-mount)
      textureCacheRef.current.forEach((texture) => texture.dispose());
      textureCacheRef.current.clear();
      
      // Clear all refs for clean re-mount
      animationRef.current.starData = [];
      animationRef.current.geometry = null;
      animationRef.current.galaxySystem = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      goalGroupRef.current = null;
      nodesRef.current = [];
      physicsFrameRef.current = 0;
      labelElementsRef.current.clear();
    };
  }, []);

  // Sync Goal Meshes with Props & setup Physics Nodes
  useEffect(() => {
    if (!goalGroupRef.current || !sceneRef.current || !isMountedRef.current) return;

    // 1. Manage Children (Add/Remove)
    const currentMeshIds = new Set(goalGroupRef.current.children.map(c => c.userData.id));
    const newGoalIds = new Set(goals.map(g => g.id));

    // Remove old
    for (let i = goalGroupRef.current.children.length - 1; i >= 0; i--) {
        const child = goalGroupRef.current.children[i];
        if (!newGoalIds.has(child.userData.id)) {
            goalGroupRef.current.remove(child);
            if (child instanceof THREE.Sprite) {
                // Dispose the sprite's material (texture is cached separately)
                child.material.dispose();
                spriteMaterialsRef.current.delete(child.userData.id);
            }
        }
    }

    const goalMap = new Map(goals.map(g => [g.id, g]));

    // Add new (Roots & Planets)
    goals.forEach((goal) => {
        if (!currentMeshIds.has(goal.id)) {
            const isRoot = !goal.parentId || !goalMap.has(goal.parentId);
            
            let tier = goal.goalCategory || (goal.label === 'goal' ? 'gold' : 'normal');
            
            if (!isRoot && goal.parentId) {
                let curr = goalMap.get(goal.parentId);
                while(curr) {
                    if (curr.goalCategory) {
                        tier = curr.goalCategory;
                        break;
                    }
                    if (curr.label === 'normal' && !curr.parentId) {
                        tier = 'normal';
                        break;
                    }
                    if (curr.parentId) curr = goalMap.get(curr.parentId);
                    else break;
                }
            }

            // USE CACHED TEXTURE
            const texture = getTexture(isRoot ? 'star' : 'planet', tier);
            // Create a NEW material instance so we can flicker opacity independently
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture, 
                color: 0xffffff, 
                transparent: true, 
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: false
            });
            // Track material for disposal
            spriteMaterialsRef.current.set(goal.id, spriteMaterial);

            let sprite: THREE.Sprite;
            
            if (isRoot) {
                sprite = new THREE.Sprite(spriteMaterial);
                sprite.userData = { 
                    id: goal.id, 
                    type: 'star',
                    tier: tier,
                    phase: Math.random() * Math.PI * 2,
                    targetX: 0, // Init
                    targetY: 0
                };
            } else {
                sprite = new THREE.Sprite(spriteMaterial);
                const pScale = 0.4; 
                sprite.scale.set(pScale, pScale, 1);
                
                sprite.userData = {
                    id: goal.id,
                    type: 'planet',
                    tier: tier,
                    parentId: goal.parentId,
                    phase: Math.random() * Math.PI * 2,
                    orbitSpeed: (Math.random() * 0.05 + 0.02) * (Math.random() > 0.5 ? 1 : -1),
                    baseOrbitRadius: 0.4 + Math.random() * 0.4,
                    baseScale: pScale
                };
            }
            
            goalGroupRef.current?.add(sprite);
        }
    });

    // 2. SETUP PHYSICS NODES (But don't run simulation loop here)
    const newNodes: any[] = [];
    
    const RADIUS_MAP: Record<string, number> = {
        gold: 0,
        silver: 2.2,
        bronze: 4.2,
        normal: 6.5
    };
    const SCALE_MAP: Record<string, number> = {
        gold: 3.5,
        silver: 2.0,
        bronze: 1.2,
        normal: 0.6
    };

    if (goalGroupRef.current) {
        // Filter for STAR meshes only
        const children = goalGroupRef.current.children.filter(c => c.userData.type === 'star');
        
        // Sort by tier
        const tierOrder = { gold: 0, silver: 1, bronze: 2, normal: 3 };
        const sortedChildren = children.sort((a, b) => {
            return tierOrder[a.userData.tier as keyof typeof tierOrder] - tierOrder[b.userData.tier as keyof typeof tierOrder];
        });

        const byTier: Record<string, any[]> = { gold: [], silver: [], bronze: [], normal: [] };
        sortedChildren.forEach(c => byTier[c.userData.tier].push(c));

        Object.entries(byTier).forEach(([tier, tierNodes]) => {
            tierNodes.forEach((node, i) => {
                const count = tierNodes.length;
                const idealRadius = RADIUS_MAP[tier];
                
                // Initialize positions if new, or keep existing if they exist in userData?
                // For layout stability, re-calculating ideal angle is usually better, physics will drift them.
                // But we want to avoid jumping. 
                // Simple approach: Re-assign ideal positions, physics will smooth transition if we were interpolating,
                // but here we are setting simulation nodes. 
                // Let's set initial x/y based on ideal circle.
                
                let angleOffset = 0;
                if (tier === 'bronze') angleOffset = Math.PI / 4; 
                if (tier === 'normal') angleOffset = Math.PI / 8;

                const angle = (i / count) * Math.PI * 2 + angleOffset;
                
                const startX = Math.cos(angle) * idealRadius;
                const startY = Math.sin(angle) * idealRadius;

                // Apply scale immediately
                const scale = SCALE_MAP[tier] || 1;
                node.userData.baseScale = scale;

                newNodes.push({
                    mesh: node,
                    x: startX, // Start at ideal
                    y: startY,
                    idealRadius: idealRadius,
                    tier: tier
                });
            });
        });
    }

    // Update Refs
    nodesRef.current = newNodes;
    physicsFrameRef.current = 0; // Restart settling animation

    // PLANETS Orbit Radius adjustment
    if (goalGroupRef.current) {
        const starMap = new Map();
        newNodes.forEach(n => starMap.set(n.mesh.userData.id, n.tier));

        goalGroupRef.current.children.forEach(c => {
            if (c.userData.type === 'planet') {
                 const parentTier = starMap.get(c.userData.parentId);
                 let extraRadius = 0;
                 if (parentTier === 'gold') extraRadius = 1.4;
                 else if (parentTier === 'silver') extraRadius = 0.7;
                 else if (parentTier === 'bronze') extraRadius = 0.2;
                 
                 const base = c.userData.baseOrbitRadius || 0.5;
                 c.userData.orbitRadius = base + extraRadius;
            }
        });
    }

  }, [goals]);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full bg-gradient-to-b from-black via-[#020617] to-[#0f172a] relative overflow-hidden will-change-transform"
    >
        <div className="absolute top-6 left-6 pointer-events-none select-none z-10">
            <h1 className="text-lg font-thin tracking-[0.2em] text-white opacity-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                NORTH STAR
            </h1>
            <p className="text-[10px] text-slate-400 tracking-widest mt-1 uppercase">Constellation of Goals</p>
        </div>

        {goals.map(goal => {
             if (goal.parentId) return null;
             const tier = goal.goalCategory || (goal.label === 'goal' ? 'gold' : 'normal');
             if (tier === 'normal') return null;

             let borderColor = 'border-yellow-500/40';
             let fontSize = 'text-[9px]';
             let px = 'px-3';
             
             if (tier === 'silver') {
                borderColor = 'border-cyan-400/40';
                fontSize = 'text-[7px]';
                px = 'px-2';
             } else if (tier === 'bronze') {
                borderColor = 'border-orange-500/40';
                fontSize = 'text-[6px]';
                px = 'px-1.5';
             }

            return (
                <div
                    key={goal.id}
                    ref={(el) => {
                        if (el) labelElementsRef.current.set(goal.id, el);
                        else labelElementsRef.current.delete(goal.id);
                    }}
                    className={`absolute top-0 left-0 pointer-events-none text-center will-change-transform z-20 flex flex-col items-center justify-center transition-opacity duration-300 opacity-100`}
                    style={{
                        transform: 'translate(-1000px, -1000px)',
                        width: '150px'
                    }}
                >
                    <div className={`${fontSize} font-black uppercase tracking-[0.15em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] whitespace-nowrap bg-gradient-to-r from-transparent via-slate-900/60 to-transparent ${px} py-0.5 rounded-full border-b ${borderColor}`}>
                        {goal.text}
                    </div>
                </div>
            );
        })}
    </div>
  );
};

export default React.memo(StarryNight, (prev, next) => {
    if (prev.goals?.length !== next.goals?.length) return false;
    const p = prev.goals || [];
    const n = next.goals || [];

    for (let i = 0; i < p.length; i++) {
        if (p[i].id !== n[i].id) return false;
        if (p[i].text !== n[i].text) return false;
        if (p[i].label !== n[i].label) return false;
        if (p[i].goalCategory !== n[i].goalCategory) return false;
        if (p[i].parentId !== n[i].parentId) return false;
        if (p[i].completed !== n[i].completed) return false;
        if (p[i].status !== n[i].status) return false;
    }
    return true;
});