import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

export default function NightSky() {
  return (
    <Canvas camera={{ position: [0, 1, 3] }} style={{ width: "100vw", height: "100vh" }}>
      <ambientLight intensity={0.5} />

      <Stars radius={100} depth={50} count={2500} factor={4} saturation={0} fade />

      <mesh position={[0, -1.5, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[10, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="darkgreen" side={THREE.DoubleSide} />
      </mesh>

      <OrbitControls enableZoom={false} minPolarAngle={Math.PI * 0.5} maxPolarAngle={Math.PI * 0.9} />
    </Canvas>
  );
}

