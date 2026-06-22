"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const ROAD_Y = 2.5;
const MAX_CARS_PER_ROUTE = 5;
const CAR_SCALE = 8;

const CAR_MODELS = [
  "/models/traffic/car-compact.glb",
  "/models/traffic/car-sedan.glb",
  "/models/traffic/car-van.glb",
];

type TrafficRoute = {
  name: string;
  maxCars: number;
  laneOffset: number;
  curve: THREE.Curve<THREE.Vector3>;
};

type CarData = {
  routeIndex: number;
  progress: number;
  speed: number;
  variant: number;
};

function createClosedLinePath(points: THREE.Vector3[]) {
  const path = new THREE.CurvePath<THREE.Vector3>();

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    path.add(new THREE.LineCurve3(current, next));
  }

  path.arcLengthDivisions = points.length * 50;
  return path;
}

function createRectRoute(
  name: string,
  xMin: number,
  xMax: number,
  zMin: number,
  zMax: number,
  maxCars: number,
  laneOffset = 0
): TrafficRoute {
  const points = [
    new THREE.Vector3(xMin, ROAD_Y, zMin),
    new THREE.Vector3(xMax, ROAD_Y, zMin),
    new THREE.Vector3(xMax, ROAD_Y, zMax),
    new THREE.Vector3(xMin, ROAD_Y, zMax),
  ];

  return {
    name,
    maxCars: Math.min(maxCars, MAX_CARS_PER_ROUTE),
    laneOffset,
    curve: createClosedLinePath(points),
  };
}

function TrafficCarModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    return clone;
  }, [scene]);

  return <primitive object={clonedScene} />;
}

export default function TrafficSystem() {
  const carRefs = useRef<Array<THREE.Group | null>>([]);

  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempTangent = useMemo(() => new THREE.Vector3(), []);
  const tempLaneNormal = useMemo(() => new THREE.Vector3(), []);

  const routes = useMemo<TrafficRoute[]>(() => {
    return [
      // Left-side open street corridor.
      createRectRoute("west-open-street", -920, -620, -520, 520, 5, 8),

      // Right-side open street corridor.
      createRectRoute("east-open-street", 620, 920, -520, 520, 5, -8),

      // Front open road, kept away from Daily Quest / E.Arcade.
      createRectRoute("front-open-street", -560, 560, 860, 1040, 4, 8),

      // Back open road behind central landmarks.
      createRectRoute("back-open-street", -560, 560, -940, -760, 4, -8),

      // Safe center-left corridor. This adds visible center traffic
      // without entering the central landmark collision zone.
      createRectRoute("center-left-corridor", -620, -380, -360, 360, 3, 6),

      // Safe center-right corridor, kept outside the Daily Quest block.
      createRectRoute("center-right-corridor", 520, 720, -360, 360, 3, -6),

      // Outer city ring for background traffic.
      createRectRoute("outer-city-ring", -1100, 1100, -900, 900, 5, -12),
    ];
  }, []);

  const cars = useMemo<CarData[]>(() => {
    return routes.flatMap((route, routeIndex) => {
      return Array.from({ length: route.maxCars }, (_, carIndex) => ({
        routeIndex,
        progress: (carIndex / route.maxCars + routeIndex * 0.11) % 1,
        speed: 0.012 + ((carIndex + routeIndex) % 3) * 0.003,
        variant: (carIndex + routeIndex) % CAR_MODELS.length,
      }));
    });
  }, [routes]);

  const initialProgresses = useMemo(() => cars.map((car) => car.progress), [cars]);
  const progressRef = useRef<number[]>(initialProgresses);


  useFrame((_, delta) => {
    for (let i = 0; i < cars.length; i++) {
      const group = carRefs.current[i];
      if (!group) continue;

      const car = cars[i];
      const route = routes[car.routeIndex];

      const nextProgress = (progressRef.current[i] + car.speed * delta) % 1;
      progressRef.current[i] = nextProgress;

      route.curve.getPointAt(nextProgress, tempPosition);
      route.curve.getTangentAt(nextProgress, tempTangent).normalize();

      tempLaneNormal.set(-tempTangent.z, 0, tempTangent.x).normalize();
      tempPosition.addScaledVector(tempLaneNormal, route.laneOffset);

      group.position.copy(tempPosition);
      group.rotation.y = Math.atan2(tempTangent.x, tempTangent.z);
      group.scale.setScalar(CAR_SCALE);
    }
  });

  return (
    <group name="ring-street-traffic">
      {cars.map((car, index) => (
        <group
          key={`${car.routeIndex}-${index}`}
          ref={(node) => {
            carRefs.current[index] = node;
          }}
        >
          <TrafficCarModel modelPath={CAR_MODELS[car.variant]} />
        </group>
      ))}
    </group>
  );
}

CAR_MODELS.forEach((modelPath) => useGLTF.preload(modelPath));