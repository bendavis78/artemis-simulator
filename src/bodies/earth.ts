import * as THREE from 'three';
import { EARTH_RADIUS, TEXTURES } from '../constants';

const DEBUG_PRIME_MERIDIAN = false;

const vertexShader = /* glsl */ `
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    uniform float logDepthBufFC;
  #endif

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;

    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
    #endif
  }
`;

const fragmentShader = /* glsl */ `
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    uniform float logDepthBufFC;
  #endif

  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform sampler2D cloudsTexture;
  uniform sampler2D specularTexture;
  uniform vec3 sunDirection;
  uniform float uWireframe;
  uniform float uDebugPrimeMeridian;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    if (uWireframe > 0.5) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 0.05);
      #ifdef USE_LOGDEPTHBUF
        gl_FragDepth = log2(vFragDepth) * logDepthBufFC * 0.5;
      #endif
      return;
    }

    vec3 normal = normalize(vNormal);
    float NdotL = dot(normal, sunDirection);

    // Smooth terminator transition
    float dayFactor = smoothstep(-0.1, 0.2, NdotL);

    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;
    float clouds = texture2D(cloudsTexture, vUv).r;
    float specMask = texture2D(specularTexture, vUv).r;

    // Blend day and night
    vec3 color = mix(nightColor * 1.5, dayColor, dayFactor);

    // Clouds: lit on day side, faintly visible on night side
    vec3 litCloud = vec3(1.0) * max(NdotL, 0.05);
    color = mix(color, litCloud, clouds * 0.6);

    // Specular highlight on oceans (day side only)
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfDir = normalize(sunDirection + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
    color += vec3(0.4) * spec * specMask * dayFactor;

    // Atmospheric rim glow (only on sunlit side)
    float rim = 1.0 - max(dot(normal, viewDir), 0.0);
    vec3 atmosphere = vec3(0.3, 0.6, 1.0) * pow(rim, 3.0) * 0.6;
    color += atmosphere * dayFactor;

    // Debug: draw prime meridian (u=0.5) as a red stripe
    if (uDebugPrimeMeridian > 0.5 && abs(vUv.x - 0.5) < 0.002) {
      color = vec3(1.0, 0.0, 0.0);
    }

    gl_FragColor = vec4(color, 1.0);

    #ifdef USE_LOGDEPTHBUF
      gl_FragDepth = log2(vFragDepth) * logDepthBufFC * 0.5;
    #endif
  }
`;

export function createEarth(loadingManager: THREE.LoadingManager): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
} {
  const textureLoader = new THREE.TextureLoader(loadingManager);

  const dayTex = textureLoader.load(TEXTURES.earthDay);
  const nightTex = textureLoader.load(TEXTURES.earthNight);
  const cloudsTex = textureLoader.load(TEXTURES.earthClouds);
  const specTex = textureLoader.load(TEXTURES.earthSpecular);

  // Set color space for color textures
  dayTex.colorSpace = THREE.SRGBColorSpace;
  nightTex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    defines: {
      USE_LOGDEPTHBUF: '',
    },
    uniforms: {
      dayTexture: { value: dayTex },
      nightTexture: { value: nightTex },
      cloudsTexture: { value: cloudsTex },
      specularTexture: { value: specTex },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      logDepthBufFC: { value: 0 },
      uWireframe: { value: 0.0 },
      uDebugPrimeMeridian: { value: DEBUG_PRIME_MERIDIAN ? 1.0 : 0.0 },
    },
  });

  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 64);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'earth';

  return { mesh, material };
}

/**
 * Compute Greenwich Sidereal Angle for Earth rotation.
 * Returns angle in radians.
 */
export function getGreenwichSiderealAngle(date: Date): number {
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const d = (date.getTime() - j2000) / 86400000;

  // GMST in degrees (simplified)
  const gmst = 280.46061837 + 360.98564736629 * d;
  return ((gmst % 360 + 360) % 360) * (Math.PI / 180);
}
