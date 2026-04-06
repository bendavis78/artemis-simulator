import * as THREE from 'three';

export function createSunLight(): {
  directional: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  fill: THREE.HemisphereLight;
} {
  const directional = new THREE.DirectionalLight(0xffffff, 2.0);
  directional.name = 'sunLight';

  const ambient = new THREE.AmbientLight(0x111122, 0.15);

  const fill = new THREE.HemisphereLight(0x222233, 0x111111, 0.15);

  return { directional, ambient, fill };
}

// --- Visible Sun Billboard ---

const SUN_DISTANCE = 1500; // scene units from camera (within far plane)
const BILLBOARD_SIZE = 300; // full width/height of glow quad

const sunVertexShader = /* glsl */ `
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    uniform float logDepthBufFC;
  #endif

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
    #endif
  }
`;

const sunFragmentShader = /* glsl */ `
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    uniform float logDepthBufFC;
  #endif

  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float r = length(center) * 2.0; // 0 at center, 1 at billboard edge

    // Sun disc (~0.5 degree angular size)
    float discR = 0.08;
    float disc = smoothstep(discR, discR - 0.006, r);

    // Limb darkening
    float limbDark = 1.0 - 0.5 * pow(r / discR, 2.0);
    disc *= max(limbDark, 0.0);

    // Inner corona — tight glow just outside the disc
    float dr = max(r - discR, 0.0);
    float innerCorona = 0.6 * exp(-dr * 18.0);

    // Outer corona — wide soft glow
    float outerCorona = 0.08 / (1.0 + pow(r * 4.5, 2.5));

    // Radial ray structure
    float angle = atan(center.y, center.x);
    float rays = pow(0.5 + 0.5 * sin(angle * 13.0), 6.0) * 0.4
               + pow(0.5 + 0.5 * cos(angle * 7.0 + 0.7), 8.0) * 0.2;
    rays *= exp(-r * 5.0) * 0.15;

    float brightness = disc * 6.0 + innerCorona + outerCorona + rays;

    // Color gradient: white core → gold → warm red outer
    vec3 white = vec3(1.0, 0.98, 0.92);
    vec3 gold = vec3(1.0, 0.85, 0.55);
    vec3 warm = vec3(0.9, 0.5, 0.2);

    vec3 color = mix(warm, gold, smoothstep(0.5, 0.12, r));
    color = mix(color, white, disc);

    float alpha = clamp(brightness, 0.0, 1.0);
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(color * brightness, alpha);

    #ifdef USE_LOGDEPTHBUF
      gl_FragDepth = log2(vFragDepth) * logDepthBufFC * 0.5;
    #endif
  }
`;

export function createSunMesh(): {
  mesh: THREE.Mesh;
  update: (sunDir: THREE.Vector3, camera: THREE.PerspectiveCamera) => void;
} {
  const geometry = new THREE.PlaneGeometry(BILLBOARD_SIZE, BILLBOARD_SIZE);
  const material = new THREE.ShaderMaterial({
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    defines: {
      USE_LOGDEPTHBUF: '',
    },
    uniforms: {
      logDepthBufFC: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sunBillboard';
  mesh.frustumCulled = false;

  function update(sunDir: THREE.Vector3, camera: THREE.PerspectiveCamera): void {
    // Position relative to camera (no parallax — sun is at infinity)
    mesh.position.copy(camera.position).addScaledVector(sunDir, SUN_DISTANCE);
    mesh.lookAt(camera.position);

    // Update log depth buffer uniform
    material.uniforms.logDepthBufFC.value =
      2.0 / (Math.log(camera.far + 1.0) / Math.LN2);
  }

  return { mesh, update };
}
