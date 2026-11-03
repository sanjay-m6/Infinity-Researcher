/**
 * ParticleField — GPU-accelerated 3D particle morphing scene.
 *
 * Renders thousands of particles in a flowing, organic formation
 * using Three.js BufferGeometry + Points with custom shaders.
 * Designed as the visual centerpiece for loading screens.
 *
 * Performance considerations:
 * - Uses typed Float32Arrays allocated once, mutated in-place
 * - GPU-based rendering via THREE.Points + ShaderMaterial
 * - Pauses when document is hidden
 * - Cleans up all GPU resources on unmount
 * - Adaptive particle count based on device pixel ratio
 * - No React state updates in the animation loop
 */
import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import * as THREE from "three";

export interface ParticleFieldProps {
  /** Total particle count (default adaptive: 3000–6000) */
  particleCount?: number;
  /** Primary color for particles */
  primaryColor?: string;
  /** Accent color for depth highlights */
  accentColor?: string;
  /** Animation speed multiplier (1.0 = normal) */
  speed?: number;
  /** Overall opacity of the particle field */
  opacity?: number;
  /** Whether to render (false = paused, resources retained) */
  active?: boolean;
  /** Reduced motion mode — minimal/no animation */
  reducedMotion?: boolean;
  /** Size variant */
  variant?: "full" | "compact" | "inline";
  /** Additional CSS class */
  className?: string;
}

// Vertex shader: positions particles in 3D, applies size attenuation and color mixing
const vertexShader = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uReducedMotion;
  attribute float aRandom;
  attribute float aPhase;
  attribute float aSize;
  varying float vAlpha;
  varying float vColorMix;
  varying float vDepth;

  // Simplex-like noise for organic motion
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(float p) {
    float fl = floor(p);
    float fc = fract(p);
    float a = hash(fl);
    float b = hash(fl + 1.0);
    return mix(a, b, smoothstep(0.0, 1.0, fc));
  }

  void main() {
    float t = uTime * uSpeed;
    float motionScale = 1.0 - uReducedMotion * 0.95;

    // Organic displacement from base position
    vec3 pos = position;
    float n1 = noise(aPhase + t * 0.3) * 2.0 - 1.0;
    float n2 = noise(aPhase * 1.7 + t * 0.2 + 100.0) * 2.0 - 1.0;
    float n3 = noise(aPhase * 2.3 + t * 0.25 + 200.0) * 2.0 - 1.0;

    pos.x += n1 * 0.6 * motionScale;
    pos.y += n2 * 0.5 * motionScale;
    pos.z += n3 * 0.4 * motionScale;

    // Slow global rotation
    float angle = t * 0.08 * motionScale;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec3 rotated = vec3(
      pos.x * cosA - pos.z * sinA,
      pos.y,
      pos.x * sinA + pos.z * cosA
    );

    // Gentle breathing/pulsing
    float breathe = 1.0 + sin(t * 0.4 + aPhase) * 0.06 * motionScale;
    rotated *= breathe;

    vec4 mvPosition = modelViewMatrix * vec4(rotated, 1.0);

    // Depth-based alpha and color variation
    float depth = -mvPosition.z;
    vDepth = clamp(depth / 8.0, 0.0, 1.0);
    vAlpha = mix(0.9, 0.15, vDepth) * (0.5 + aRandom * 0.5);
    vColorMix = smoothstep(0.3, 0.8, noise(aPhase * 3.0 + t * 0.15));

    // Size with depth attenuation
    float baseSize = aSize * (1.0 + sin(t * 0.6 + aPhase * 5.0) * 0.2 * motionScale);
    gl_PointSize = baseSize * (300.0 / depth);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader: soft circular particle with color variation
const fragmentShader = `
  uniform vec3 uPrimaryColor;
  uniform vec3 uAccentColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vColorMix;
  varying float vDepth;

  void main() {
    // Circular soft particle
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    float softEdge = 1.0 - smoothstep(0.2, 0.5, dist);
    vec3 color = mix(uPrimaryColor, uAccentColor, vColorMix);

    // Subtle glow for closer particles
    float glow = exp(-dist * 4.0) * (1.0 - vDepth) * 0.3;
    color += glow;

    float alpha = softEdge * vAlpha * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function getAdaptiveParticleCount(): number {
  if (typeof window === "undefined") return 3000;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Lower count on high-DPR mobile screens, higher on desktop
  return dpr > 1.5 ? 3000 : 5000;
}

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      (window as unknown as { WebGLRenderingContext?: unknown }).WebGLRenderingContext &&
      (canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/** Generate initial particle positions in a flowing organic formation */
function generateParticleFormation(count: number): {
  positions: Float32Array;
  randoms: Float32Array;
  phases: Float32Array;
  sizes: Float32Array;
} {
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // Toroidal-ish formation with organic spread
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.2 + Math.random() * 1.8;

    // Base spheroidal distribution
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.cos(phi) * 0.7; // Flatten vertically
    positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    // Add some stream/tendril offsets for organic look
    const stream = Math.sin(theta * 3 + phi * 2) * 0.4;
    positions[i3] += stream;
    positions[i3 + 1] += Math.cos(theta * 2) * 0.3;

    randoms[i] = Math.random();
    phases[i] = Math.random() * Math.PI * 2 * 10; // Wide phase spread
    sizes[i] = 1.5 + Math.random() * 2.5;
  }

  return { positions, randoms, phases, sizes };
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  particleCount,
  primaryColor = "#e2e8f0",
  accentColor = "#818cf8",
  speed = 1.0,
  opacity = 1.0,
  active = true,
  reducedMotion = false,
  variant = "full",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const isVisibleRef = useRef(true);
  const [webglSupported, setWebglSupported] = useState<boolean>(checkWebGLSupport);

  // Dynamically inherit active theme primary & accent tokens if defaults provided
  const resolvedPrimary = useMemo(() => {
    if (primaryColor !== "#e2e8f0") return primaryColor;
    if (typeof window !== "undefined") {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim();
      if (val && val.startsWith("#")) return val;
    }
    return primaryColor;
  }, [primaryColor]);

  const resolvedAccent = useMemo(() => {
    if (accentColor !== "#818cf8") return accentColor;
    if (typeof window !== "undefined") {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue("--ring")
        .trim();
      if (val && val.startsWith("#")) return val;
    }
    return accentColor;
  }, [accentColor]);

  const isParticleDisabled =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-particles") === "off";

  const count = useMemo(
    () => particleCount ?? getAdaptiveParticleCount(),
    [particleCount]
  );

  const primaryVec = useMemo(() => hexToVec3(resolvedPrimary), [resolvedPrimary]);
  const accentVec = useMemo(() => hexToVec3(resolvedAccent), [resolvedAccent]);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (pointsRef.current && sceneRef.current) {
      sceneRef.current.remove(pointsRef.current);
    }
    geometryRef.current?.dispose();
    materialRef.current?.dispose();
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.forceContextLoss();
      const canvas = rendererRef.current.domElement;
      canvas.parentNode?.removeChild(canvas);
    }
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    materialRef.current = null;
    geometryRef.current = null;
    pointsRef.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    if (!webglSupported) return;
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglSupported(false);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Particle geometry
    const { positions, randoms, phases, sizes } = generateParticleFormation(count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometryRef.current = geometry;

    // Material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uReducedMotion: { value: reducedMotion ? 1.0 : 0.0 },
        uPrimaryColor: {
          value: new THREE.Vector3(primaryVec.x, primaryVec.y, primaryVec.z),
        },
        uAccentColor: { value: new THREE.Vector3(accentVec.x, accentVec.y, accentVec.z) },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;

    // Points mesh
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // Animation loop
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      if (isVisibleRef.current && active && !isParticleDisabled) {
        const elapsed = (performance.now() - startTimeRef.current) * 0.001;
        if (materialRef.current) {
          materialRef.current.uniforms.uTime.value = elapsed;
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Visibility change — pause when hidden
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // WebGL context loss handling
    const canvas = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    const handleContextRestored = () => {
      rafRef.current = requestAnimationFrame(animate);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      cleanup();
    };
  }, [count, cleanup]); // Only re-init on particle count change

  // Update dynamic uniforms without re-initializing the scene
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uSpeed.value = speed;
    materialRef.current.uniforms.uReducedMotion.value = reducedMotion ? 1.0 : 0.0;
    materialRef.current.uniforms.uOpacity.value = opacity;
    materialRef.current.uniforms.uPrimaryColor.value.set(
      primaryVec.x,
      primaryVec.y,
      primaryVec.z
    );
    materialRef.current.uniforms.uAccentColor.value.set(
      accentVec.x,
      accentVec.y,
      accentVec.z
    );
  }, [speed, reducedMotion, opacity, primaryVec, accentVec]);

  const sizeClasses = {
    full: "w-full h-full",
    compact: "w-full h-48",
    inline: "w-24 h-24",
  }[variant];

  // CSS fallback when WebGL is unavailable
  if (!webglSupported) {
    return (
      <div
        className={`${sizeClasses} flex items-center justify-center ${className}`}
        aria-hidden="true"
      >
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div
            className="absolute inset-2 rounded-full border-2 border-blue-400/15 border-b-blue-400 animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${sizeClasses} ${className}`}
      role="img"
      aria-label="Particle loading animation"
    />
  );
};

export default ParticleField;
