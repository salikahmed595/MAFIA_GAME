import { Canvas, useFrame } from "@react-three/fiber";
import { Component, useRef, type ReactNode } from "react";
import * as THREE from "three";

function Building({
  x,
  z,
  h,
  w = 1,
  variant = 0,
}: {
  x: number;
  z: number;
  h: number;
  w?: number;
  variant?: number;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.95]} />
        <meshStandardMaterial
          color={["#536065", "#455251", "#6c655a", "#3c494d"][variant % 4]}
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[0, h + 0.22, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
      >
        <coneGeometry args={[w * 0.88, 0.7, 4]} />
        <meshStandardMaterial color="#293539" />
      </mesh>
      {[0, 1, 2]
        .filter((i) => i < h / 0.5)
        .map((i) => (
          <group key={i}>
            {[-0.25, 0.25].map((wx, j) => (
              <mesh key={j} position={[wx * w, 0.4 + i * 0.46, 0.482]}>
                <planeGeometry args={[0.15, 0.22]} />
                <meshStandardMaterial
                  color="#eac580"
                  emissive="#e7b75f"
                  emissiveIntensity={1.7}
                />
              </mesh>
            ))}
          </group>
        ))}
      <mesh position={[0, 0.19, 0.485]}>
        <planeGeometry args={[0.2, 0.38]} />
        <meshStandardMaterial color="#212a29" />
      </mesh>
      <mesh position={[w * 0.27, h + 0.52, -0.1]} castShadow>
        <boxGeometry args={[0.18, 0.65, 0.18]} />
        <meshStandardMaterial color="#465052" />
      </mesh>
    </group>
  );
}
function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 0.9, 5]} />
        <meshStandardMaterial color="#655741" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.85 + i * 0.38, 0]} castShadow>
          <coneGeometry args={[0.53 - i * 0.12, 0.85, 6]} />
          <meshStandardMaterial color={i % 2 ? "#344c43" : "#263d35"} />
        </mesh>
      ))}
    </group>
  );
}
function Village({ motion }: { motion: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current && motion)
      group.current.rotation.y = Math.sin(clock.elapsedTime * 0.07) * 0.075;
  });
  return (
    <group ref={group} rotation={[0, -0.25, 0]}>
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[5.4, 4.8, 0.8, 12]} />
        <meshStandardMaterial color="#374342" />
      </mesh>
      <mesh
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[5.3, 12]} />
        <meshStandardMaterial color="#59615a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[1.5, 2.35, 32]} />
        <meshStandardMaterial color="#96927e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[1.43, 32]} />
        <meshStandardMaterial color="#646d62" />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.75, 0.9, 0.4, 12]} />
        <meshStandardMaterial color="#8f978a" />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.63, 0.63, 0.06, 24]} />
        <meshStandardMaterial
          color="#83a39b"
          metalness={0.6}
          roughness={0.15}
        />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.17, 0.8, 8]} />
        <meshStandardMaterial color="#a6ad97" />
      </mesh>
      <mesh position={[0, 1.24, 0]}>
        <sphereGeometry args={[0.19, 8, 8]} />
        <meshStandardMaterial
          color="#d9bb7e"
          emissive="#ba8b43"
          emissiveIntensity={0.4}
        />
      </mesh>
      <Building x={-2.4} z={-2.2} h={1.8} w={1.2} />
      <Building x={-0.8} z={-3.3} h={2.4} variant={1} />
      <Building x={0.65} z={-3.25} h={1.7} variant={2} />
      <Building x={2.2} z={-2.5} h={2.6} w={1.3} variant={3} />
      <Building x={3.4} z={-0.9} h={1.7} variant={2} />
      <Building x={3.2} z={1} h={1.4} variant={1} />
      <Building x={-3.4} z={-0.4} h={1.9} variant={2} />
      <Building x={-3.2} z={1.4} h={1.4} />
      <Building x={1.8} z={2.6} h={1.35} variant={3} />
      <Building x={-1.3} z={3} h={1.1} variant={1} />
      {[
        [-4, -2],
        [-3, -3.4],
        [3.7, -2.4],
        [4, 1.8],
        [-3, 3],
        [0.2, 4],
        [2.6, 3.2],
        [-4.1, 0.8],
      ].map(([x, z], i) => (
        <Tree key={i} x={x} z={z} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return (
          <group key={i} position={[Math.sin(a) * 2.25, 0, Math.cos(a) * 2.25]}>
            <mesh position={[0, 0.46, 0]}>
              <cylinderGeometry args={[0.027, 0.035, 0.92, 6]} />
              <meshStandardMaterial color="#232d2c" />
            </mesh>
            <mesh position={[0, 0.98, 0]}>
              <boxGeometry args={[0.14, 0.22, 0.14]} />
              <meshStandardMaterial
                color="#ffe0a0"
                emissive="#ffc16c"
                emissiveIntensity={3}
              />
            </mesh>
            <pointLight
              position={[0, 1.1, 0]}
              color="#ffc67b"
              intensity={1.6}
              distance={2}
            />
          </group>
        );
      })}
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        ☾<span>Blackthorn sleeps. Secrets don’t.</span>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function Town({
  motion = true,
  quality = "high",
}: {
  motion?: boolean;
  quality?: string;
}) {
  return (
    <SceneBoundary>
      <Canvas
        shadows={quality === "high"}
        dpr={quality === "high" ? [1, 1.6] : 1}
        camera={{ position: [9, 9, 11], fov: 37 }}
        gl={{ antialias: quality === "high", alpha: true }}
        frameloop={motion ? "always" : "demand"}
      >
        <ambientLight intensity={1.5} color="#a5c6d0" />
        <directionalLight
          position={[-5, 8, 4]}
          intensity={2.5}
          color="#e4d9b5"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[5, 2, -5]} intensity={2} color="#60888f" />
        <Village motion={motion} />
      </Canvas>
    </SceneBoundary>
  );
}
