"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ContainerSpec, PlacedBox } from "@/lib/types";
import { useMemo } from "react";

interface Props {
  container: ContainerSpec;
  placedBoxes: PlacedBox[];
}

const MAX_RENDERED_BOXES = 600;

function ContainerFrame({ container }: { container: ContainerSpec }) {
  const l = container.internalLength / 1000;
  const w = container.internalWidth / 1000;
  const h = container.internalHeight / 1000;
  return (
    <group position={[0, h / 2, 0]}>
      <mesh>
        <boxGeometry args={[l, h, w]} />
        <meshBasicMaterial color="#6b7280" wireframe />
      </mesh>
    </group>
  );
}

function Box({ box, containerL, containerW }: { box: PlacedBox; containerL: number; containerW: number }) {
  const l = box.l / 1000;
  const w = box.w / 1000;
  const h = box.h / 1000;
  const x = (box.x + box.l / 2) / 1000 - containerL / 2000;
  const y = (box.z + box.h / 2) / 1000;
  const z = (box.y + box.w / 2) / 1000 - containerW / 2000;
  return (
    <mesh position={[x, y, z]}>
      <boxGeometry args={[l, h, w]} />
      <meshStandardMaterial color={box.color} opacity={box.isPalletUnit ? 0.85 : 1} transparent />
    </mesh>
  );
}

export default function Container3DView({ container, placedBoxes }: Props) {
  const truncated = placedBoxes.length > MAX_RENDERED_BOXES;
  const boxesToRender = useMemo(() => placedBoxes.slice(0, MAX_RENDERED_BOXES), [placedBoxes]);
  const maxDim = Math.max(container.internalLength, container.internalWidth, container.internalHeight) / 1000;

  return (
    <div className="relative w-full h-[420px] rounded-lg border border-black/10 dark:border-white/15 overflow-hidden bg-black/[.02] dark:bg-white/[.03]">
      <Canvas camera={{ position: [maxDim * 1.1, maxDim * 0.9, maxDim * 1.3], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        <ContainerFrame container={container} />
        {boxesToRender.map((b, i) => (
          <Box key={i} box={b} containerL={container.internalLength} containerW={container.internalWidth} />
        ))}
        <OrbitControls />
      </Canvas>
      {truncated && (
        <div className="absolute bottom-2 left-2 text-[11px] bg-black/60 text-white rounded px-2 py-1">
          표시 성능을 위해 {MAX_RENDERED_BOXES}개까지만 렌더링됨 (총 {placedBoxes.length}개 배치)
        </div>
      )}
    </div>
  );
}
