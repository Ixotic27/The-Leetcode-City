"use client";

import { useMemo } from "react";
import * as THREE from "three";

// ─── Glass Texture Generator (Optimized via direct ImageData pixel manipulation) ───

const textureCache = new Map<string, THREE.CanvasTexture>();

function blendColors(fg: number, bg: number, alpha: number): number {
  const fgR = fg & 255;
  const fgG = (fg >> 8) & 255;
  const fgB = (fg >> 16) & 255;

  const bgR = bg & 255;
  const bgG = (bg >> 8) & 255;
  const bgB = (bg >> 16) & 255;

  const r = Math.round(fgR * alpha + bgR * (1 - alpha));
  const g = Math.round(fgG * alpha + bgG * (1 - alpha));
  const b = Math.round(fgB * alpha + bgB * (1 - alpha));

  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function getABGR(colorStr: string): number {
  const c = new THREE.Color(colorStr);
  return (255 << 24) | (Math.round(c.b * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.r * 255);
}

export function createGlassTex(
  cols: number,
  rows: number,
  seed: number,
  litColors: string[],
  offColor: string,
  faceColor: string,
  accentColor?: string,
  logoBM?: number[][],
  logoCol?: number,
  logoRow?: number,
  cellW = 16,
  cellH = 16,
): THREE.CanvasTexture {
  const cacheKey = `${cols}_${rows}_${seed}_${faceColor}_${offColor}_${accentColor}_${logoBM ? JSON.stringify(logoBM) : ""}_${logoCol}_${logoRow}_${cellW}_${cellH}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const w = cols * cellW, h = rows * cellH;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const faceABGR = getABGR(faceColor);
  
  const shellC = new THREE.Color(faceColor);
  shellC.multiplyScalar(1.8);
  const gridColorHex = "#" + shellC.getHexString();
  const gridABGR = getABGR(gridColorHex);
  
  const offABGR = getABGR(offColor);
  const litABGRs = litColors.map(getABGR);
  const accentABGR = accentColor ? getABGR(accentColor) : 0;

  const imageData = ctx.createImageData(w, h);
  const buf32 = new Uint32Array(imageData.data.buffer);
  buf32.fill(faceABGR);

  // Grid lines
  for (let r = 0; r <= rows; r++) {
    const y = Math.min(h - 1, r * cellH);
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      buf32[rowOffset + x] = gridABGR;
    }
  }
  for (let c = 0; c <= cols; c++) {
    const x = Math.min(w - 1, c * cellW);
    for (let y = 0; y < h; y++) {
      buf32[y * w + x] = gridABGR;
    }
  }

  // Windows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hash = ((r * 13 + c * 23 + seed) * 2654435761) >>> 0;

      let isLogo = false;
      let nearLogo = false;
      if (logoBM && logoCol != null && logoRow != null) {
        const lr = r - logoRow, lc = c - logoCol;
        if (lr >= 0 && lr < logoBM.length && lc >= 0 && lc < logoBM[0].length && logoBM[lr][lc])
          isLogo = true;
        if (!isLogo && lr >= -1 && lr <= logoBM.length && lc >= -1 && lc <= logoBM[0].length)
          nearLogo = true;
      }

      let fillABGR = offABGR;
      const gapX = cellW > 10 ? 2 : 1;
      const gapY = cellH > 10 ? 2 : 1;

      if (isLogo && accentColor) {
        const startX = c * cellW + gapX;
        const startY = r * cellH + gapY;
        const endX = c * cellW + cellW - gapX;
        const endY = r * cellH + cellH - gapY;
        for (let y = startY; y < endY; y++) {
          const rowOffset = y * w;
          for (let x = startX; x < endX; x++) {
            buf32[rowOffset + x] = accentABGR;
          }
        }
        
        const blendedAccent = blendColors(accentABGR, faceABGR, 0.3);
        const glowStartX = Math.max(0, c * cellW - 1);
        const glowStartY = Math.max(0, r * cellH - 1);
        const glowEndX = Math.min(w, c * cellW + cellW + 1);
        const glowEndY = Math.min(h, r * cellH + cellH + 1);
        for (let y = glowStartY; y < glowEndY; y++) {
          const rowOffset = y * w;
          for (let x = glowStartX; x < glowEndX; x++) {
            if (x < startX || x >= endX || y < startY || y >= endY) {
              buf32[rowOffset + x] = blendedAccent;
            }
          }
        }
        continue;
      } else if (nearLogo) {
        fillABGR = blendColors(offABGR, faceABGR, 0.25);
      } else {
        const lit = (hash % 100) < 45;
        if (lit) {
          const rawLit = litABGRs[hash % litABGRs.length];
          const opacity = 0.45 + (hash % 20) / 100;
          fillABGR = blendColors(rawLit, faceABGR, opacity);
        } else {
          fillABGR = blendColors(offABGR, faceABGR, 0.55);
        }
      }

      const startX = c * cellW + gapX;
      const startY = r * cellH + gapY;
      const endX = c * cellW + cellW - gapX;
      const endY = r * cellH + cellH - gapY;
      for (let y = startY; y < endY; y++) {
        const rowOffset = y * w;
        for (let x = startX; x < endX; x++) {
          buf32[rowOffset + x] = fillABGR;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.dispose = () => {}; // Protect cached texture from unmount disposal
  textureCache.set(cacheKey, tex);
  return tex;
}

// ─── Corner Accent Strips ───────────────────────────────────
export function CornerStrips({ w, d, h, yC, accent }: {
  w: number; d: number; h: number; yC: number; accent: string;
}) {
  const hw = w / 2, hd = d / 2;
  return (
    <>
      {([[hw, hd], [hw, -hd], [-hw, hd], [-hw, -hd]] as [number, number][]).map(([cx, cz], i) => (
        <mesh key={i} position={[cx, yC, cz]}>
          <boxGeometry args={[0.6, h, 0.6]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

// ─── Glass Facade Plane ─────────────────────────────────────
export function GlassFacade({ tex, w, h, pos, rotY, emColor }: {
  tex: THREE.Texture; w: number; h: number;
  pos: [number, number, number]; rotY: number; emColor: string;
}) {
  return (
    <mesh position={pos} rotation={[0, rotY, 0]}>
      <planeGeometry args={[w - 4, h - 4]} />
      <meshStandardMaterial
        map={tex}
        emissive={emColor}
        emissiveMap={tex}
        emissiveIntensity={0.7}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

// ─── Complete Box Section with Facades ──────────────────────
export function BoxSection({ w, h, d, y, shellColor, glassFront, glassSide, emColor, accent }: {
  w: number; h: number; d: number; y: number;
  shellColor: string; glassFront: THREE.Texture; glassSide: THREE.Texture;
  emColor: string; accent: string;
}) {
  return (
    <group>
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={shellColor} roughness={0.25} metalness={0.8} />
      </mesh>
      <GlassFacade tex={glassFront} w={w} h={h} pos={[0, y, d / 2 + 0.3]} rotY={0} emColor={emColor} />
      <GlassFacade tex={glassFront} w={w} h={h} pos={[0, y, -d / 2 - 0.3]} rotY={Math.PI} emColor={emColor} />
      <GlassFacade tex={glassSide} w={d} h={h} pos={[w / 2 + 0.3, y, 0]} rotY={Math.PI / 2} emColor={emColor} />
      <GlassFacade tex={glassSide} w={d} h={h} pos={[-w / 2 - 0.3, y, 0]} rotY={-Math.PI / 2} emColor={emColor} />
      <CornerStrips w={w} d={d} h={h} yC={y} accent={accent} />
    </group>
  );
}

// ─── Accent Separator Band ──────────────────────────────────
export function AccentBand({ w, d, y, accent }: {
  w: number; d: number; y: number; accent: string;
}) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[w + 2, 1.5, d + 2]} />
      <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} toneMapped={false} />
    </mesh>
  );
}

// ─── Platform Base ──────────────────────────────────────────
export function PlatformBase({ w, d, accent, shellColor }: {
  w: number; d: number; accent: string; shellColor: string;
}) {
  return (
    <group>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[w + 20, 3, d + 20]} />
        <meshStandardMaterial color={shellColor} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[w + 22, 1, d + 22]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Antenna + Beacon ───────────────────────────────────────
export function AntennaBeacon({ y, accent, shellColor, beaconRef }: {
  y: number; accent: string; shellColor: string;
  beaconRef?: React.RefObject<THREE.Mesh | null>;
}) {
  return (
    <group>
      <mesh position={[0, y, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh ref={beaconRef} position={[0, y + 28, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.5}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>
      <pointLight position={[0, y + 28, 0]} color={accent} intensity={20} distance={100} decay={2} />
    </group>
  );
}

// ─── Shell Color Helpers ────────────────────────────────────
export function useShellColors(faceColor: string) {
  const shellColor = useMemo(() => {
    const c = new THREE.Color(faceColor);
    c.multiplyScalar(1.8);
    return "#" + c.getHexString();
  }, [faceColor]);

  const windowOff = useMemo(() => {
    const c = new THREE.Color(faceColor);
    c.multiplyScalar(0.6);
    return "#" + c.getHexString();
  }, [faceColor]);

  return { shellColor, windowOff };
}
