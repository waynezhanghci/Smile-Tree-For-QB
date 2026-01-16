import p5 from "p5";
import { TreeState, FlowerStyle } from "../types";

export type TreeEventType = 'bloom' | 'wither';

export const createSketch = (
  getTreeState: () => TreeState,
  getFlowerStyle: () => FlowerStyle,
  getSceneMode: () => number
) => (p: p5) => {
  let currentMood = 0; // smoothed mood
  let currentWind = 0; // smoothed wind (signed)
  let currentSceneMode = 0; // Tracker for mode changes

  // Particle system for falling leaves/flowers
  interface Particle {
    pos: p5.Vector;
    vel: p5.Vector;
    acc: p5.Vector;
    color: p5.Color;
    size: number;
    life: number; 
    type: 'leaf' | 'flower';
    angle: number;
    angleVel: number;
    flip: number;
    flipSpeed: number;
    swayPhase: number;
    swayFreq: number;
    swayAmp: number;
  }

  // Baked Tree Structure Interface
  interface Branch {
    len: number;
    thick: number;
    depth: number;
    angleOffset: number; 
    children: Branch[];
    noiseThreshold: number; 
    hasFlower: boolean;
    lenMult: number; 
  }

  // A tree instance in the forest
  interface TreeInstance {
    xRatio: number; // 0 to 1 relative to width
    scale: number;
    branch: Branch;
    seed: number;
  }
  
  let particles: Particle[] = [];
  let forest: TreeInstance[] = [];
  
  // Configuration
  const MAX_PARTICLES = 400; 
  
  // Palette variables
  let COL_TRUNK_DORMANT: p5.Color;
  let COL_TRUNK_THRIVE: p5.Color;
  let COL_LEAF_TENDER: p5.Color;
  let COL_FLOWER_PINK: p5.Color;

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30); 
    
    COL_TRUNK_DORMANT = p.color(35, 30, 30); 
    COL_TRUNK_THRIVE = p.color(100, 70, 50); 
    COL_LEAF_TENDER = p.color(120, 210, 100, 230); 
    COL_FLOWER_PINK = p.color(255, 140, 170, 240); 
    
    rebuildForest();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    rebuildForest(); // Rebuild because screen ratios change
  };

  const rebuildForest = () => {
    const mode = getSceneMode();
    currentSceneMode = mode;
    forest = [];

    // Determine max depth based on mode to save performance on many trees
    // Mode 1: Depth 9, Mode 2: Depth 8, Mode 3: Depth 7 (Increased from 6 for more flowers)
    let depthLimit = 9;
    
    if (mode === 1) {
      // Single Tree
      depthLimit = 9;
      forest.push({
        xRatio: 0.5,
        scale: 1.0,
        seed: 1234,
        branch: buildTreeSkeleton(depthLimit, 1234)
      });
    } else if (mode === 2) {
      // Double Tree
      depthLimit = 8;
      // Tree 1
      forest.push({
        xRatio: 0.3,
        scale: 0.75,
        seed: 2222,
        branch: buildTreeSkeleton(depthLimit, 2222)
      });
      // Tree 2
      forest.push({
        xRatio: 0.7,
        scale: 0.75,
        seed: 3333,
        branch: buildTreeSkeleton(depthLimit, 3333)
      });
    } else {
      // Forest (10 trees)
      depthLimit = 7; // Increased depth for significantly more flowers
      const count = 10;
      for (let i = 0; i < count; i++) {
        // Distribute from 0.05 to 0.95
        const t = i / (count - 1);
        const x = 0.05 + t * 0.9;
        
        // Use a chaotic multiplier for the seed to ensure random height distribution
        // and avoid the "6 high, 4 low" grouping.
        const seed = 5555 + i * 937;
        p.randomSeed(seed);
        
        // Random scale variance: Base 0.30 to 0.42
        // Natural slight differences, not too extreme
        const sc = p.random(0.30, 0.42);
        
        forest.push({
          xRatio: x,
          scale: sc,
          seed: seed,
          branch: buildTreeSkeleton(depthLimit, seed)
        });
      }
    }
  };

  const buildTreeSkeleton = (maxDepth: number, seed: number): Branch => {
    p.randomSeed(seed);

    const isMobile = p.width < 600;
    const trunkLenRatio = isMobile ? 0.22 : 0.26;
    const trunkLen = p.height * trunkLenRatio;
    const trunkThick = p.width < 600 ? 18 : 28;

    const createBranch = (depth: number): Branch => {
      const branch: Branch = {
        len: 0, 
        thick: 0,
        depth,
        angleOffset: 0,
        children: [],
        noiseThreshold: p.random(0.05, 0.95), 
        // Increased probability of flowers from 50% to 75%
        hasFlower: p.random(1) > 0.25, 
        lenMult: 0.72 + p.random(-0.08, 0.08)
      };

      if (depth < maxDepth) {
        const numBranches = 2;
        const baseAngle = p.PI / 5.0; 
        
        for (let i = 0; i < numBranches; i++) {
          const child = createBranch(depth + 1);
          let angle = p.map(i, 0, numBranches - 1, -baseAngle, baseAngle);
          angle += p.random(-0.15, 0.15); 
          child.angleOffset = angle;
          child.thick = 0; 
          branch.children.push(child);
        }
      }
      return branch;
    };

    const root = createBranch(0);
    root.len = trunkLen;
    root.thick = trunkThick;
    return root;
  };

  // --- Flower Drawing Helpers ---
  const drawFlowerShape = (style: FlowerStyle, size: number) => {
    p.noStroke();
    switch (style) {
      case 'sakura':
        p.fill(COL_FLOWER_PINK);
        for(let i=0; i<5; i++) {
            p.push();
            p.rotate(p.TWO_PI/5 * i);
            const pLen = size * 0.85; 
            const pWidth = size * 0.45;
            p.beginShape();
            p.vertex(0, 0); 
            p.quadraticVertex(-pWidth, -pLen * 0.5, 0, -pLen);
            p.quadraticVertex(pWidth, -pLen * 0.5, 0, 0);
            p.endShape(p.CLOSE);
            p.pop();
        }
        p.fill(255, 255, 255, 220); 
        p.circle(0, 0, size * 0.2);
        break;

      case 'delonix':
        p.fill(COL_FLOWER_PINK);
        for(let i=0; i<5; i++) {
           p.push();
           p.rotate(p.TWO_PI/5 * i);
           const totalLen = size * 0.95;
           const headWidth = size * 0.35;
           const headHeight = size * 0.4;
           const stemLen = totalLen - headHeight * 0.8;
           const stemHalfWidth = size * 0.04; 
           p.beginShape();
           p.vertex(0, 0);
           p.vertex(-stemHalfWidth, -stemLen);
           p.bezierVertex(-headWidth, -stemLen - headHeight * 0.2, -headWidth, -totalLen, 0, -totalLen);
           p.bezierVertex(headWidth, -totalLen, headWidth, -stemLen - headHeight * 0.2, stemHalfWidth, -stemLen);
           p.vertex(0, 0);
           p.endShape(p.CLOSE);
           p.pop();
        }
        p.fill(255, 200, 100, 150); 
        p.circle(0, 0, size * 0.15);
        break;

      case 'peach':
      default:
        p.fill(COL_FLOWER_PINK);
        for(let i=0; i<5; i++) {
            p.rotate(p.TWO_PI/5);
            p.ellipse(0, size*0.4, size*0.5, size*0.6);
        }
        p.fill(255, 220, 100); 
        p.circle(0, 0, size * 0.3);
        break;
    }
  };

  p.draw = () => {
    // 1. Check Scene Mode & Rebuild if needed
    const mode = getSceneMode();
    if (mode !== currentSceneMode) {
      rebuildForest();
    }

    // 2. Get State
    const state = getTreeState();
    const flowerStyle = getFlowerStyle();
    
    // Mood Smoothing
    if (state.mood >= currentMood) {
      currentMood = p.lerp(currentMood, state.mood, 0.1); 
    } else {
      currentMood = p.lerp(currentMood, state.mood, 0.03); 
    }
    
    const targetWind = state.windForce;
    currentWind = p.lerp(currentWind, targetWind, 0.12);

    // 3. Background
    p.clear();
    p.push();
    p.noStroke();
    if (currentMood > 0) {
        p.fill(255, 230, 200, currentMood * 20); 
    } else {
        p.fill(5, 5, 15, Math.abs(currentMood) * 180);
    }
    p.rect(0, 0, p.width, p.height);
    p.pop();

    // 4. Wind Physics
    const time = p.millis() * 0.001;
    const noiseSway = p.map(p.noise(time * 0.6), 0, 1, -0.04, 0.04);
    const windSign = currentWind < 0 ? -1 : 1;
    const effectiveWind = windSign * Math.pow(Math.abs(currentWind), 1.4);
    const activeSway = Math.sin(time * 2.5) * (effectiveWind * 0.1) + (effectiveWind * 0.3);
    const totalWindAngle = noiseSway + activeSway;

    // 5. Draw Forest
    for (const tree of forest) {
        p.push();
        // Base X position based on ratio
        const startX = p.width * tree.xRatio;
        const startY = p.height;
        
        p.translate(startX, startY);
        
        // Render tree with scaled dimensions
        renderBranch(
            tree.branch, 
            tree.branch.len * tree.scale, 
            tree.branch.thick * tree.scale, 
            totalWindAngle, 
            startX, 
            startY, 
            0, 
            flowerStyle,
            tree.scale // Pass scale for flower sizing
        );
        p.pop();
    }

    // 6. Particles
    updateParticles(currentWind, flowerStyle);
  };

  const renderBranch = (
    branch: Branch,
    len: number, 
    thick: number, 
    windAngle: number,
    x: number, 
    y: number, 
    cumAngle: number,
    flowerStyle: FlowerStyle,
    scale: number
  ) => {
    const bloomFactor = p.map(currentMood, 0, 1, 0, 1, true); 
    let branchCol = p.lerpColor(COL_TRUNK_DORMANT, COL_TRUNK_THRIVE, bloomFactor);

    p.stroke(branchCol);
    p.strokeWeight(thick);
    p.strokeCap(p.ROUND);
    p.line(0, 0, 0, -len);
    
    // Calculate tip position in World Coordinates
    const tipX = x + Math.sin(cumAngle) * len;
    const tipY = y - Math.cos(cumAngle) * len;

    p.translate(0, -len);

    const maxDepth = currentSceneMode === 3 ? 7 : (currentSceneMode === 2 ? 8 : 9);

    if (branch.depth > maxDepth - 4) {
      const isAttached = bloomFactor > branch.noiseThreshold;

      if (isAttached) {
         drawAttachedFoliage(windAngle, branch.hasFlower, bloomFactor, flowerStyle, scale);
      }

      const time = p.millis();
      // Use tipX/tipY world coords for noise seed so trees don't sync up perfectly
      const spawnNoise = p.noise(tipX * 0.1, tipY * 0.1, time * 0.008);
      
      // Reduce spawn rate for forest mode (mode 3) because there are many more branches now
      const spawnChance = currentSceneMode === 3 ? 0.002 : 0.02;

      if (bloomFactor > 0.3) {
          if ((spawnNoise * 100) % 1.0 < spawnChance) {
              spawnFallingParticle(tipX, tipY, scale);
          }
      }
    }

    if (branch.depth >= maxDepth || len < 4) return;

    const flexibility = p.map(branch.depth, 0, maxDepth, 0.05, 1.3);
    const localWind = windAngle * flexibility;

    for (const child of branch.children) {
      p.push();
      const nextAngle = child.angleOffset + localWind;
      p.rotate(nextAngle);
      
      renderBranch(
        child,
        len * child.lenMult, 
        thick * 0.7, 
        windAngle, 
        tipX, 
        tipY, 
        cumAngle + nextAngle,
        flowerStyle,
        scale
      );
      p.pop();
    }
  };

  const drawAttachedFoliage = (windAngle: number, hasFlower: boolean, bloomFactor: number, style: FlowerStyle, scale: number) => {
    p.noStroke();
    const breathe = 1 + Math.sin(p.millis() * 0.004) * 0.08;
    const foliageSway = windAngle * 3.0;
    
    const growthScale = p.constrain(bloomFactor * 1.5, 0.5, 1);
    const baseLeafSize = 11 * scale; 
    const leafSize = baseLeafSize * breathe * growthScale; 
    
    p.push();
    p.rotate(p.PI / 4 + foliageSway); 
    p.fill(COL_LEAF_TENDER);
    p.ellipse(0, 0, leafSize, leafSize * 0.5);
    p.pop();
    
    p.push();
    p.rotate(-p.PI / 4 + foliageSway);
    p.fill(COL_LEAF_TENDER);
    p.ellipse(0, 0, leafSize, leafSize * 0.5);
    p.pop();

    if (hasFlower && bloomFactor > 0.25) {
        const baseFlowerSize = 14 * scale;
        const flowerSize = baseFlowerSize * breathe * growthScale;
        p.push();
        p.rotate(foliageSway);
        drawFlowerShape(style, flowerSize);
        p.pop();
    }
  };

  const spawnFallingParticle = (x: number, y: number, scale: number) => {
    if (x < -50 || x > p.width + 50 || y > p.height) return;

    const vx = p.random(-0.5, 0.5) + currentWind * 2.5;
    const vy = p.random(1.5, 3.5); 
    const isFlower = p.random(1) > 0.5;
    const baseSize = isFlower ? p.random(7, 12) : p.random(7, 12);
    
    particles.push({
      pos: p.createVector(x, y), 
      vel: p.createVector(vx, vy), 
      acc: p.createVector(0, 0), 
      color: isFlower ? COL_FLOWER_PINK : COL_LEAF_TENDER, 
      type: isFlower ? 'flower' : 'leaf',
      size: baseSize * scale, // Scale particle
      life: 255, 
      angle: p.random(p.TWO_PI),
      angleVel: p.random(-0.15, 0.15),
      flip: p.random(p.TWO_PI),
      flipSpeed: p.random(0.05, 0.2),
      swayPhase: p.random(p.TWO_PI),
      swayFreq: p.random(0.05, 0.1),
      swayAmp: p.random(0.02, 0.05)
    });
  };

  const updateParticles = (windForce: number, currentStyle: FlowerStyle) => {
    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const part = particles[i];

      part.acc.set(0, 0.1); 
      const turbulence = p.noise(part.pos.x * 0.01, part.pos.y * 0.01, p.frameCount * 0.02) - 0.5;
      const windEffect = windForce * 0.25; 
      part.acc.x += windEffect + (turbulence * 0.15);
      const swayForce = Math.sin(p.frameCount * part.swayFreq + part.swayPhase) * part.swayAmp;
      part.acc.x += swayForce;

      part.vel.add(part.acc);
      part.vel.mult(0.94);
      part.pos.add(part.vel);

      part.angle += part.angleVel;
      part.flip += part.flipSpeed;
      
      part.life -= 2;

      if (part.life <= 0 || part.pos.y > p.height + 100) {
        particles.splice(i, 1);
        continue;
      }

      p.push();
      p.translate(part.pos.x, part.pos.y);
      p.rotate(part.angle); 
      
      const tumbleScale = Math.cos(part.flip);
      const renderScale = Math.abs(tumbleScale);
      
      p.scale(1, Math.max(0.1, renderScale)); 
      
      // Simple alpha fade
      const alpha = part.life;
      
      if (part.type === 'flower') {
        drawFlowerShapeWithAlpha(currentStyle, part.size, alpha);
      } else {
        const c = p.color(part.color);
        c.setAlpha(alpha);
        p.fill(c);
        p.noStroke();
        p.ellipse(0, 0, part.size, part.size * 0.7);
      }
      p.pop();
    }
  };

  const drawFlowerShapeWithAlpha = (style: FlowerStyle, size: number, alpha: number) => {
      p.noStroke();
      p.fill(p.red(COL_FLOWER_PINK), p.green(COL_FLOWER_PINK), p.blue(COL_FLOWER_PINK), alpha);
      
      if (style === 'sakura') {
        for(let i=0; i<5; i++) {
            p.push();
            p.rotate(p.TWO_PI/5 * i);
            const pLen = size * 0.85; 
            const pWidth = size * 0.45;
            p.beginShape();
            p.vertex(0, 0); 
            p.quadraticVertex(-pWidth, -pLen * 0.5, 0, -pLen);
            p.quadraticVertex(pWidth, -pLen * 0.5, 0, 0);
            p.endShape(p.CLOSE);
            p.pop();
        }
        p.fill(255, 255, 255, alpha); 
        p.circle(0, 0, size * 0.2);
      } else if (style === 'delonix') {
        for(let i=0; i<5; i++) {
           p.push();
           p.rotate(p.TWO_PI/5 * i);
           const totalLen = size * 0.95;
           const headWidth = size * 0.35;
           const headHeight = size * 0.4;
           const stemLen = totalLen - headHeight * 0.8;
           const stemHalfWidth = size * 0.04; 
           p.beginShape();
           p.vertex(0, 0);
           p.vertex(-stemHalfWidth, -stemLen);
           p.bezierVertex(-headWidth, -stemLen - headHeight * 0.2, -headWidth, -totalLen, 0, -totalLen);
           p.bezierVertex(headWidth, -totalLen, headWidth, -stemLen - headHeight * 0.2, stemHalfWidth, -stemLen);
           p.vertex(0, 0);
           p.endShape(p.CLOSE);
           p.pop();
        }
        p.fill(255, 200, 100, alpha * 0.6); 
        p.circle(0, 0, size * 0.15);
      } else {
        for(let i=0; i<5; i++) {
            p.rotate(p.TWO_PI/5);
            p.ellipse(0, size*0.4, size*0.5, size*0.6);
        }
        p.fill(255, 220, 100, alpha); 
        p.circle(0, 0, size * 0.3);
      }
  };
};