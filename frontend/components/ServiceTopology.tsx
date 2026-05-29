"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type TopologyNode = {
  name: string;
  tone: "healthy" | "warn" | "critical" | "active";
};

const TONE_COLOR: Record<TopologyNode["tone"], string> = {
  healthy: "#34d399",
  warn: "#fbbf24",
  critical: "#fb7185",
  active: "#22d3ee",
};

function Edge({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
    });
    return new THREE.Line(geometry, material);
  }, [from, to, color]);
  return <primitive object={line} />;
}

function Node({
  position,
  color,
  label,
  radius,
  pulse,
  onHover,
}: {
  position: THREE.Vector3;
  color: string;
  label: string;
  radius: number;
  pulse?: boolean;
  onHover: (label: string | null) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const seed = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position.y + Math.sin(t * 0.8 + seed) * 0.12;
    const targetScale = hovered ? 1.45 : pulse ? 1 + Math.sin(t * 2.2) * 0.08 : 1;
    ref.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.15
    );
  });

  return (
    <mesh
      ref={ref}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(label);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <icosahedronGeometry args={[radius, 2]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 1.4 : 0.7}
        roughness={0.35}
        metalness={0.4}
      />
    </mesh>
  );
}

function Scene({
  nodes,
  onHover,
}: {
  nodes: TopologyNode[];
  onHover: (label: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  const positions = useMemo(() => {
    const count = Math.max(nodes.length, 1);
    return nodes.map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const r = 2.6;
      return new THREE.Vector3(
        Math.cos(angle) * r,
        Math.sin(angle * 1.3) * 0.5,
        Math.sin(angle) * r
      );
    });
  }, [nodes]);

  const core = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.12;
    // gentle parallax tilt toward pointer
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -pointer.y * 0.25,
      0.05
    );
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 6, 6]} intensity={120} color="#22d3ee" />
      <pointLight position={[-6, -4, -6]} intensity={80} color="#a78bfa" />

      {positions.map((pos, i) => (
        <Edge
          key={`edge-${i}`}
          from={core}
          to={pos}
          color={TONE_COLOR[nodes[i].tone]}
        />
      ))}

      {/* core */}
      <mesh position={core}>
        <icosahedronGeometry args={[0.75, 4]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={1.1}
          roughness={0.2}
          metalness={0.6}
          wireframe
        />
      </mesh>

      {positions.map((pos, i) => (
        <Node
          key={nodes[i].name}
          position={pos}
          color={TONE_COLOR[nodes[i].tone]}
          label={nodes[i].name}
          radius={0.42}
          pulse={nodes[i].tone === "active" || nodes[i].tone === "critical"}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

export function ServiceTopology({ nodes }: { nodes: TopologyNode[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="relative h-[300px] w-full">
      <Canvas
        camera={{ position: [0, 1.6, 7], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene nodes={nodes} onHover={setHovered} />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 backdrop-blur-md">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Live topology
        </p>
        <p className="text-sm font-bold text-white">
          {hovered || `${nodes.length} services monitored`}
        </p>
      </div>
    </div>
  );
}

export default ServiceTopology;
