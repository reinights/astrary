import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";


//ChatGPT Help with shaders and converting values from ra/dec/mag to xyza.
//Conversation Link:
//https://chatgpt.com/share/67e59c36-37f8-8009-b793-568fcfbd281e
const vertexShader = `
  attribute float alpha;
  varying float vAlpha;

  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
  }
`;

export default function NightSky({ stars }: { stars: any[];}) {

  
  function convertStarsToGeometryData(stars: any[], radius: number) {
    const total = stars.length;
    const positions = new Float32Array(total * 3);
    const alphas = new Float32Array(total);
  
    let j = 0;
    let k = 0;
  
    for (let i = 0; i < total; i++) {
      const star = stars[i];
      if (star.ra == null || star.dec == null || star.mag == null) continue;
  
      const raRad = (star.ra * 15 * Math.PI) / 180;
      const decRad = (star.dec * Math.PI) / 180;
  
      const x = radius * Math.cos(decRad) * Math.cos(raRad);
      const y = radius * Math.sin(decRad);
      const z = radius * Math.cos(decRad) * Math.sin(raRad);
  
      positions[j++] = x;
      positions[j++] = y;
      positions[j++] = z;
  
      const alpha = Math.max(0, 1 - star.mag / 6);
      alphas[k++] = alpha;
    }
  
    return {
      positions: positions.subarray(0, j),
      alphas: alphas.subarray(0, k),
    };
  }
  const { positions, alphas } = useMemo(() => convertStarsToGeometryData(stars, 100), [stars]);
  return (
    <Canvas camera={{ position: [0, 1, 3] }} style={{ width: "100vw", height: "100vh" }}>
      <ambientLight intensity={0.5} />
    {/* Three.js recommends using instanced mesh with large quantities but using points seems to be the fastest way */}
    {/* https://discourse.threejs.org/t/better-performance-instanced-mesh-or-points/20293 */}
    <points>
        <bufferGeometry>
        <primitive
          attach="attributes-position"
          object={new THREE.BufferAttribute(positions, 3)}
        />
        <primitive
          attach="attributes-alpha"
          object={new THREE.BufferAttribute(alphas, 1)}
        />
        </bufferGeometry>

        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          uniforms={{
            size: { value: 3.0 },
            color: { value: new THREE.Color("white") },
          }}
        />
      </points>

      <mesh position={[0, -1.5, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[10, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="darkgreen" side={THREE.DoubleSide} />
      </mesh>

      <OrbitControls enableZoom={false} minPolarAngle={Math.PI * 0.5} maxPolarAngle={Math.PI * 0.9} />
    </Canvas>
  );
}

