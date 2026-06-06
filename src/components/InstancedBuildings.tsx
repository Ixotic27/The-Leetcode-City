"use client";

// @ts-nocheck
import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

export default function InstancedBuildings({
  cityLayoutId,
  buildings,
  onInitComplete,
  ...rest
}: any) {
  
  const containerRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  
  // Core tracking ref to capture the asynchronous WebGL initialization macro-task timer safely
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize geometry structures to maximize WebGL pipeline resource efficiency
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const buildingMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.1,
    });
  }, []);

  // Primary Lifecycle Setup Effect Initialization Hook Block
  useEffect(() => {
    // Immediately clear any active background initialization queue frames from previous layout state loops
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    const currentBuildings = buildings || rest.buildingData;
    if (!containerRef.current || !currentBuildings || currentBuildings.length === 0) return;

    // Stagger the heavy 3D rendering setup configurations on a structural delay threshold execution frame
    initTimeoutRef.current = setTimeout(() => {
      try {
        const totalBuildings = currentBuildings.length;
        const instancedMesh = new THREE.InstancedMesh(
          boxGeometry,
          buildingMaterial,
          totalBuildings
        );

        const dummyObject = new THREE.Object3D();

        currentBuildings.forEach((building: any, index: number) => {
          if (!building || !building.position) return;
          
          const [posX, posY, posZ] = building.position;
          dummyObject.position.set(posX, posY, posZ);

          if (building.rotation) {
            const [rotX, rotY, rotZ] = building.rotation;
            dummyObject.rotation.set(rotX, rotY, rotZ);
          } else {
            dummyObject.rotation.set(0, 0, 0);
          }

          if (building.scale) {
            const [scaleX, scaleY, scaleZ] = building.scale;
            dummyObject.scale.set(scaleX, scaleY, scaleZ);
          } else {
            dummyObject.scale.set(1, 1, 1);
          }

          dummyObject.updateMatrix();
          instancedMesh.setMatrixAt(index, dummyObject.matrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        meshRef.current = instancedMesh;

        console.log(`[WebGL Engine] Successfully instantiated building instances safely.`);

        if (onInitComplete) {
          onInitComplete();
        }
      } catch (error) {
        console.error("[WebGL Engine] Dynamic structural mesh setup error encountered: ", error);
      }
    }, 100);

    // Mandatory Cleanup Routine: Flush the pending macro-task queue safely upon unmount or dependency rotations
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [cityLayoutId, buildings, rest.buildingData, onInitComplete, boxGeometry, buildingMaterial]);

  return (
    <div 
      ref={containerRef} 
      className="instanced-buildings-container" 
      style={{ display: "none" }}
    >
      {/* 3D Core WebGL Spatial Component Blueprint Instances Wrapper */}
    </div>
  );
}
