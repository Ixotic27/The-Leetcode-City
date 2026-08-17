"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CityBuilding,
  CityBridge,
  CityCanal,
  CityRiver,
} from "@/lib/github";

import {
  getMinimapCollectibles,
  subscribeMinimapCollectibles,
  type MiniMapCollectible,
} from "@/lib/collectibles";

// ----------------------------------------------------
// Types
// ----------------------------------------------------

interface MiniMapProps {
  buildings: CityBuilding[];

  bridges?: CityBridge[];

  canals?: CityCanal[];

  river?: CityRiver | null;

  playerX: number;
  playerZ: number;

  // Current aircraft/player heading.
  // Pass the actual yaw from CityCanvas.
  playerYaw?: number;

  visible: boolean;

  currentDistrict?: string | null;
}

// ----------------------------------------------------
// Constants
// ----------------------------------------------------

// Internal canvas resolution.
// Keep this low for the pixel-art look.
const RES = 128;

// Actual displayed size.
// Smaller than your previous 256px map.
const DISPLAY = 210;

// Zoom
const DEFAULT_ZOOM = 900;
const MIN_ZOOM = 350;
const MAX_ZOOM = 1800;
const ZOOM_STEP = 100;

// Colors
const BACKGROUND = [5, 5, 8] as const;

const BUILDING_COLOR = [
  65,
  65,
  72,
] as const;

const WATER_COLOR = [
  25,
  75,
  110,
] as const;

const BRIDGE_COLOR = [
  110,
  235,
  185,
] as const;

// ----------------------------------------------------
// District colors
// ----------------------------------------------------

const DISTRICT_RGB: Record<
  string,
  [number, number, number]
> = {
  downtown: [255, 161, 22],
  frontend: [232, 220, 200],
  backend: [200, 184, 156],
  fullstack: [204, 129, 17],
  mobile: [90, 122, 0],
  data_ai: [6, 182, 212],
  devops: [220, 38, 38],
  security: [59, 130, 246],
  gamedev: [236, 72, 153],
  vibe_coder: [139, 92, 246],
  creator: [234, 179, 8],
};

// ----------------------------------------------------
// Utility
// ----------------------------------------------------

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

// ----------------------------------------------------
// Component
// ----------------------------------------------------

export default function MiniMap({
  buildings,
  bridges = [],
  canals = [],
  river = null,
  playerX,
  playerZ,
  playerYaw = 0,
  visible,
  currentDistrict,
}: MiniMapProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const [
    zoom,
    setZoom,
  ] = useState(
    DEFAULT_ZOOM,
  );

  const [
    collectibleRevision,
    setCollectibleRevision,
  ] = useState(0);

  // --------------------------------------------------
  // Collectible subscription
  // --------------------------------------------------

  useEffect(() => {
    return subscribeMinimapCollectibles(
      () => {
        setCollectibleRevision(
          (value) => value + 1,
        );
      },
    );
  }, []);

  const collectibles =
    useMemo<MiniMapCollectible[]>(
      () =>
        getMinimapCollectibles(),
      [collectibleRevision],
    );

  // --------------------------------------------------
  // Keyboard controls
  // --------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      const target =
        event.target as HTMLElement | null;

      // Don't hijack typing.
      if (
        target &&
        (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
      ) {
        return;
      }

      // Zoom in/out
      if (event.key === "[") {
        event.preventDefault();

        setZoom(
          (value) =>
            clamp(
              value + ZOOM_STEP,
              MIN_ZOOM,
              MAX_ZOOM,
            ),
        );
      }

      if (event.key === "]") {
        event.preventDefault();

        setZoom(
          (value) =>
            clamp(
              value - ZOOM_STEP,
              MIN_ZOOM,
              MAX_ZOOM,
            ),
        );
      }

      // M is intentionally not toggling here.
      // Your HUD can handle visibility.
      if (
        event.key.toLowerCase() === "m"
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  // --------------------------------------------------
  // Nearby distance
  // --------------------------------------------------

  const maxDistance =
    zoom * 1.1;

  const maxDistanceSq =
    maxDistance * maxDistance;

  // --------------------------------------------------
  // Nearby buildings
  // --------------------------------------------------

  const nearbyBuildings =
    useMemo(() => {
      return buildings.filter(
        (building) => {
          const dx =
            building.position[0] -
            playerX;

          const dz =
            building.position[2] -
            playerZ;

          return (
            dx * dx +
              dz * dz <=
            maxDistanceSq
          );
        },
      );
    }, [
      buildings,
      playerX,
      playerZ,
      maxDistanceSq,
    ]);

  // --------------------------------------------------
  // Nearby bridges
  // --------------------------------------------------

  const nearbyBridges =
    useMemo(() => {
      return bridges.filter(
        (bridge) => {
          const dx =
            bridge.position[0] -
            playerX;

          const dz =
            bridge.position[2] -
            playerZ;

          return (
            dx * dx +
              dz * dz <=
            maxDistanceSq
          );
        },
      );
    }, [
      bridges,
      playerX,
      playerZ,
      maxDistanceSq,
    ]);

  // --------------------------------------------------
  // Nearby canals
  // --------------------------------------------------

  const nearbyCanals =
    useMemo(() => {
      return canals.filter(
        (canal) => {
          const dx =
            canal.position[0] -
            playerX;

          const dz =
            canal.position[2] -
            playerZ;

          return (
            dx * dx +
              dz * dz <=
            maxDistanceSq
          );
        },
      );
    }, [
      canals,
      playerX,
      playerZ,
      maxDistanceSq,
    ]);

  // --------------------------------------------------
  // Nearby collectibles
  // --------------------------------------------------

  const nearbyCollectibles =
    useMemo(() => {
      return collectibles.filter(
        (item) => {
          if (item.collected) {
            return false;
          }

          const dx =
            item.x -
            playerX;

          const dz =
            item.z -
            playerZ;

          return (
            dx * dx +
              dz * dz <=
            maxDistanceSq
          );
        },
      );
    }, [
      collectibles,
      playerX,
      playerZ,
      maxDistanceSq,
    ]);

  // --------------------------------------------------
  // World → minimap
  // --------------------------------------------------

  const worldToMap =
    useCallback(
      (
        worldX: number,
        worldZ: number,
      ): [
        number,
        number,
      ] => {
        const scale =
          RES /
          (zoom * 2);

        return [
          RES / 2 +
            (worldX -
              playerX) *
              scale,

          RES / 2 +
            (worldZ -
              playerZ) *
              scale,
        ];
      },
      [
        playerX,
        playerZ,
        zoom,
      ],
    );

  // --------------------------------------------------
  // Draw helper
  // --------------------------------------------------

  const drawRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => {
    ctx.fillStyle = color;

    ctx.fillRect(
      x,
      y,
      width,
      height,
    );
  };

  // --------------------------------------------------
  // Draw map
  // --------------------------------------------------

  const draw =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.clearRect(
        0,
        0,
        RES,
        RES,
      );

      ctx.imageSmoothingEnabled =
        false;

      // ==================================================
      // BACKGROUND
      // ==================================================

      ctx.fillStyle =
        `rgb(${BACKGROUND[0]},${BACKGROUND[1]},${BACKGROUND[2]})`;

      ctx.fillRect(
        0,
        0,
        RES,
        RES,
      );

      // ==================================================
      // GRID
      // ==================================================

      ctx.strokeStyle =
        "rgba(255,255,255,0.035)";

      ctx.lineWidth = 0.5;

      const gridSize = 16;

      for (
        let x = 0;
        x <= RES;
        x += gridSize
      ) {
        ctx.beginPath();

        ctx.moveTo(
          x,
          0,
        );

        ctx.lineTo(
          x,
          RES,
        );

        ctx.stroke();
      }

      for (
        let y = 0;
        y <= RES;
        y += gridSize
      ) {
        ctx.beginPath();

        ctx.moveTo(
          0,
          y,
        );

        ctx.lineTo(
          RES,
          y,
        );

        ctx.stroke();
      }

      // ==================================================
      // RIVER
      // ==================================================

      if (river) {
        const leftX =
          river.x -
          river.width / 2;

        const rightX =
          river.x +
          river.width / 2;

        const topZ =
          river.centerZ -
          river.length / 2;

        const bottomZ =
          river.centerZ +
          river.length / 2;

        const [
          x1,
          y1,
        ] =
          worldToMap(
            leftX,
            topZ,
          );

        const [
          x2,
          y2,
        ] =
          worldToMap(
            rightX,
            bottomZ,
          );

        ctx.fillStyle =
          `rgb(${WATER_COLOR[0]},${WATER_COLOR[1]},${WATER_COLOR[2]})`;

        ctx.fillRect(
          x1,
          y1,
          x2 - x1,
          y2 - y1,
        );
      }

      // ==================================================
      // CANALS
      // ==================================================

      for (
        const canal of nearbyCanals
      ) {
        const [
          cx,
          cy,
        ] =
          worldToMap(
            canal.position[0],
            canal.position[2],
          );

        const scale =
          RES /
          (zoom * 2);

        const width =
          Math.max(
            1,
            canal.width *
              scale,
          );

        const length =
          Math.max(
            1,
            canal.length *
              scale,
          );

        ctx.save();

        ctx.translate(
          cx,
          cy,
        );

        ctx.rotate(
          -canal.rotation,
        );

        ctx.fillStyle =
          `rgb(${WATER_COLOR[0]},${WATER_COLOR[1]},${WATER_COLOR[2]})`;

        ctx.fillRect(
          -length / 2,
          -width / 2,
          length,
          width,
        );

        ctx.restore();
      }

      // ==================================================
      // BUILDINGS
      // ==================================================

      for (
        const building of nearbyBuildings
      ) {
        const [
          x,
          y,
        ] =
          worldToMap(
            building.position[0],
            building.position[2],
          );

        const scale =
          RES /
          (zoom * 2);

        const width =
          Math.max(
            1,
            building.width *
              scale,
          );

        const depth =
          Math.max(
            1,
            building.depth *
              scale,
          );

        const district =
          building.district ??
          "fullstack";

        const rgb =
          DISTRICT_RGB[
            district
          ] ??
          BUILDING_COLOR;

        const color =
          `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

        ctx.save();

        // ----------------------------
        // DATA / AI
        // ----------------------------

        if (
          district ===
          "data_ai"
        ) {
          ctx.translate(
            x,
            y,
          );

          ctx.rotate(
            Math.PI / 4,
          );

          drawRect(
            ctx,
            -Math.max(
              1,
              width / 2,
            ),
            -Math.max(
              1,
              depth / 2,
            ),
            Math.max(
              2,
              width,
            ),
            Math.max(
              2,
              depth,
            ),
            color,
          );
        }

        // ----------------------------
        // SECURITY
        // ----------------------------

        else if (
          district ===
          "security"
        ) {
          drawRect(
            ctx,
            x -
              Math.max(
                1,
                width / 2,
              ),
            y - 0.5,
            Math.max(
              2,
              width,
            ),
            1,
            color,
          );

          drawRect(
            ctx,
            x - 0.5,
            y -
              Math.max(
                1,
                depth / 2,
              ),
            1,
            Math.max(
              2,
              depth,
            ),
            color,
          );
        }

        // ----------------------------
        // NORMAL
        // ----------------------------

        else {
          drawRect(
            ctx,
            x -
              width / 2,
            y -
              depth / 2,
            Math.max(
              1,
              width,
            ),
            Math.max(
              1,
              depth,
            ),
            color,
          );
        }

        ctx.restore();
      }

      // ==================================================
      // BRIDGES
      // ==================================================

      for (
        const bridge of nearbyBridges
      ) {
        const [
          x,
          y,
        ] =
          worldToMap(
            bridge.position[0],
            bridge.position[2],
          );

        const scale =
          RES /
          (zoom * 2);

        /*
         * CityBridge in your current data
         * uses width as its bridge length.
         */
        const length =
          Math.max(
            4,
            bridge.width *
              scale,
          );

        ctx.save();

        ctx.translate(
          x,
          y,
        );

        ctx.rotate(
          -bridge.rotation,
        );

        // Soft bridge body
        ctx.strokeStyle =
          "rgba(110,235,185,0.25)";

        ctx.lineWidth = 3;

        ctx.setLineDash([]);

        ctx.beginPath();

        ctx.moveTo(
          -length / 2,
          0,
        );

        ctx.lineTo(
          length / 2,
          0,
        );

        ctx.stroke();

        // Bright bridge line
        ctx.strokeStyle =
          `rgb(${BRIDGE_COLOR[0]},${BRIDGE_COLOR[1]},${BRIDGE_COLOR[2]})`;

        ctx.lineWidth = 1;

        ctx.setLineDash([
          3,
          2,
        ]);

        ctx.beginPath();

        ctx.moveTo(
          -length / 2,
          0,
        );

        ctx.lineTo(
          length / 2,
          0,
        );

        ctx.stroke();

        ctx.restore();
      }

      // ==================================================
      // COLLECTIBLES
      // ==================================================

      for (
        const item of nearbyCollectibles
      ) {
        const [
          x,
          y,
        ] =
          worldToMap(
            item.x,
            item.z,
          );

        let color =
          "#ffd166";

        let radius = 1.5;

        // ----------------------------
        // RARE
        // ----------------------------

        if (
          item.type ===
          "rare"
        ) {
          color =
            "#c084fc";

          radius = 2;
        }

        // ----------------------------
        // EPIC
        // ----------------------------

        if (
          item.type ===
          "epic"
        ) {
          color =
            "#facc15";

          radius = 2.5;
        }

        // Glow
        ctx.globalAlpha =
          0.18;

        ctx.fillStyle =
          color;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          radius + 2,
          0,
          Math.PI * 2,
        );

        ctx.fill();

        // Actual dot
        ctx.globalAlpha =
          1;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          radius,
          0,
          Math.PI * 2,
        );

        ctx.fill();
      }

      // ==================================================
      // PLAYER
      // ==================================================

      const center =
        RES / 2;

      ctx.save();

      ctx.translate(
        center,
        center,
      );

      // --------------------------------------------------
      // PLAYER OUTER GLOW
      // --------------------------------------------------

      ctx.fillStyle =
        "rgba(255,255,255,0.2)";

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        5,
        0,
        Math.PI * 2,
      );

      ctx.fill();

      // --------------------------------------------------
      // PLAYER DOT
      // --------------------------------------------------

      ctx.fillStyle =
        "#ffffff";

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        2.5,
        0,
        Math.PI * 2,
      );

      ctx.fill();

      // Tiny bright center
      ctx.fillStyle =
        "#ffffff";

      ctx.fillRect(
        -0.5,
        -0.5,
        1,
        1,
      );

      ctx.restore();

      // ==================================================
      // COMPASS
      // ==================================================

      ctx.font =
        "bold 7px monospace";

      ctx.textAlign =
        "center";

      ctx.textBaseline =
        "middle";

      ctx.fillStyle =
        "rgba(255,255,255,0.8)";

      // N
      ctx.fillText(
        "N",
        center,
        5,
      );

      // S
      ctx.fillText(
        "S",
        center,
        RES - 5,
      );

      // W
      ctx.fillText(
        "W",
        5,
        center,
      );

      // E
      ctx.fillText(
        "E",
        RES - 5,
        center,
      );

      // ==================================================
      // CENTER RING
      // ==================================================

      ctx.strokeStyle =
        "rgba(255,255,255,0.15)";

      ctx.lineWidth = 0.5;

      ctx.beginPath();

      ctx.arc(
        center,
        center,
        8,
        0,
        Math.PI * 2,
      );

      ctx.stroke();

      // ==================================================
      // BORDER
      // ==================================================

      ctx.strokeStyle =
        "rgba(255,255,255,0.12)";

      ctx.lineWidth = 1;

      ctx.strokeRect(
        0.5,
        0.5,
        RES - 1,
        RES - 1,
      );
    }, [
      nearbyBuildings,
      nearbyBridges,
      nearbyCanals,
      nearbyCollectibles,
      river,
      worldToMap,
      zoom,
    ]);

  // --------------------------------------------------
  // Redraw
  // --------------------------------------------------

  useEffect(() => {
    if (!visible) {
      return;
    }

    draw();
  }, [
    visible,
    draw,
  ]);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  if (
    !visible ||
    buildings.length === 0
  ) {
    return null;
  }

  const activeDistricts =
    Object.keys(
      DISTRICT_RGB,
    ).filter(
      (district) =>
        buildings.some(
          (building) =>
            building.district ===
            district,
        ),
    );

  return (
    <div
      className="
        pointer-events-none
        fixed
        left-3
        top-3
        z-30
        flex
        items-start
        gap-2
        sm:left-4
        sm:top-4
      "
    >
      {/* ================================================== */}
      {/* LEGEND */}
      {/* ================================================== */}

      <div
        style={{
          width: 86,

          background:
            "rgba(5,5,7,0.88)",

          border:
            "1px solid rgba(42,42,48,0.7)",

          padding: 6,

          backdropFilter:
            "blur(4px)",
        }}
      >
        {/* Title */}

        <div
          style={{
            fontSize: 7,
            fontFamily:
              "monospace",
            color:
              "#ffffff",
            marginBottom: 5,
            letterSpacing:
              "0.08em",
          }}
        >
          MAP
        </div>

        {/* Districts */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "1fr 1fr",

            gap:
              "3px 5px",
          }}
        >
          {activeDistricts.map(
            (district) => {
              const [
                r,
                g,
                b,
              ] =
                DISTRICT_RGB[
                  district
                ];

              const active =
                district ===
                currentDistrict;

              return (
                <div
                  key={
                    district
                  }
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap: 3,

                    opacity:
                      active
                        ? 1
                        : 0.5,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,

                      backgroundColor:
                        `rgb(${r},${g},${b})`,

                      flexShrink: 0,
                    }}
                  />

                  <span
                    style={{
                      fontSize: 6,

                      fontFamily:
                        "monospace",

                      color:
                        active
                          ? `rgb(${r},${g},${b})`
                          : "#707078",

                      whiteSpace:
                        "nowrap",

                      overflow:
                        "hidden",

                      textOverflow:
                        "ellipsis",
                    }}
                  >
                    {district.replace(
                      "_",
                      " ",
                    )}
                  </span>
                </div>
              );
            },
          )}
        </div>

        {/* Special markers */}

        <div
          style={{
            marginTop: 7,

            paddingTop: 5,

            borderTop:
              "1px solid rgba(255,255,255,0.08)",

            display:
              "flex",

            flexDirection:
              "column",

            gap: 3,
          }}
        >
          <div
            style={{
              fontSize: 6,

              fontFamily:
                "monospace",

              color:
                "#707078",
            }}
          >
            SPECIAL
          </div>

          {/* Coin */}

          <div
            style={{
              fontSize: 6,

              fontFamily:
                "monospace",

              color:
                "#ffd166",
            }}
          >
            ● COIN
          </div>

          {/* Bridge */}

          <div
            style={{
              fontSize: 6,

              fontFamily:
                "monospace",

              color:
                "#6ee7b7",
            }}
          >
            ┄ BRIDGE
          </div>

          {/* Water */}

          <div
            style={{
              fontSize: 6,

              fontFamily:
                "monospace",

              color:
                "#4b9bc4",
            }}
          >
            ▬ WATER
          </div>

          {/* Player */}

          <div
            style={{
              fontSize: 6,

              fontFamily:
                "monospace",

              color:
                "#ffffff",
            }}
          >
            ● YOU
          </div>
        </div>

        {/* Controls */}

        <div
          style={{
            marginTop: 7,

            paddingTop: 5,

            borderTop:
              "1px solid rgba(255,255,255,0.08)",

            fontSize: 6,

            lineHeight: 1.5,

            fontFamily:
              "monospace",

            color:
              "#66666f",
          }}
        >
          [ / ] ZOOM
        </div>
      </div>

      {/* ================================================== */}
      {/* MAP */}
      {/* ================================================== */}

      <div
        style={{
          position:
            "relative",

          width:
            DISPLAY,

          height:
            DISPLAY,

          background:
            "#050508",

          border:
            "1px solid rgba(42,42,48,0.7)",

          boxShadow:
            "0 4px 20px rgba(0,0,0,0.35)",

          overflow:
            "hidden",
        }}
      >
        <canvas
          ref={canvasRef}

          width={RES}

          height={RES}

          style={{
            width:
              DISPLAY,

            height:
              DISPLAY,

            imageRendering:
              "pixelated",

            display:
              "block",
          }}
        />

        {/* Zoom indicator */}

        <div
          style={{
            position:
              "absolute",

            right: 5,

            bottom: 5,

            fontSize: 6,

            fontFamily:
              "monospace",

            color:
              "rgba(255,255,255,0.4)",

            background:
              "rgba(0,0,0,0.45)",

            padding:
              "2px 3px",
          }}
        >
          {zoom}m
        </div>

        {/* Player label */}

        <div
          style={{
            position:
              "absolute",

            left:
              "50%",

            top:
              "50%",

            transform:
              "translate(-50%, 9px)",

            fontSize: 6,

            fontFamily:
              "monospace",

            color:
              "#ffffff",

            textShadow:
              "0 1px 2px #000",

            pointerEvents:
              "none",
          }}
        >
          YOU
        </div>
      </div>
    </div>
  );
}