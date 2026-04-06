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

  uniform float uFlareIntensity;

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

    float sunBrightness = disc * 6.0 + innerCorona + outerCorona + rays;

    // Sun color gradient: white core → gold → warm red outer
    vec3 white = vec3(1.0, 0.98, 0.92);
    vec3 gold = vec3(1.0, 0.85, 0.55);
    vec3 warm = vec3(0.9, 0.5, 0.2);

    vec3 sunColor = mix(warm, gold, smoothstep(0.5, 0.12, r));
    sunColor = mix(sunColor, white, disc);

    // --- Anamorphic lens flare (JJ Abrams style) ---
    vec3 flareContrib = vec3(0.0);
    if (uFlareIntensity > 0.01) {
      vec3 flareBlue = vec3(0.6, 0.85, 1.0);

      // Main horizontal anamorphic streak
      float hStreak = exp(-pow(center.y * 45.0, 2.0)) *
                      1.0 / (1.0 + pow(center.x * 2.5, 2.0));

      // Secondary streak at slight angle
      float sa = 0.12;
      vec2 rot = vec2(
        center.x * cos(sa) + center.y * sin(sa),
        -center.x * sin(sa) + center.y * cos(sa)
      );
      float hStreak2 = exp(-pow(rot.y * 65.0, 2.0)) *
                       1.0 / (1.0 + pow(rot.x * 4.0, 2.0)) * 0.25;

      // Small circular bokeh artifacts along the streak
      float art1 = smoothstep(0.014, 0.007, length(center - vec2(0.12, 0.002))) * 0.35;
      float art2 = smoothstep(0.010, 0.005, length(center - vec2(-0.17, -0.001))) * 0.2;
      float art3 = smoothstep(0.007, 0.003, length(center - vec2(0.26, 0.004))) * 0.12;

      float flareBright = (hStreak + hStreak2 + art1 + art2 + art3) * uFlareIntensity;
      flareContrib = flareBlue * flareBright * 1.2;
    }

    vec3 finalColor = sunColor * sunBrightness + flareContrib;
    float alpha = clamp(max(max(finalColor.r, finalColor.g), finalColor.b), 0.0, 1.0);
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(finalColor, alpha);

    #ifdef USE_LOGDEPTHBUF
      gl_FragDepth = log2(vFragDepth) * logDepthBufFC * 0.5;
    #endif
  }
`;

/** Approximate sun angular radius in radians (matches discR=0.08 on billboard) */
const SUN_ANG_RADIUS = Math.atan2(BILLBOARD_SIZE * 0.08 / 2, SUN_DISTANCE);

export function createSunMesh(): {
  mesh: THREE.Mesh;
  update: (opts: {
    sunDir: THREE.Vector3;
    camera: THREE.PerspectiveCamera;
    bodies: { position: THREE.Vector3; radius: number }[];
  }) => void;
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
      uFlareIntensity: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sunBillboard';
  mesh.frustumCulled = false;

  function update({ sunDir, camera, bodies }: {
    sunDir: THREE.Vector3;
    camera: THREE.PerspectiveCamera;
    bodies: { position: THREE.Vector3; radius: number }[];
  }): void {
    // Position relative to camera (no parallax — sun is at infinity)
    mesh.position.copy(camera.position).addScaledVector(sunDir, SUN_DISTANCE);
    // Match camera orientation so flare streaks stay screen-horizontal
    mesh.quaternion.copy(camera.quaternion);

    // Update log depth buffer uniform
    material.uniforms.logDepthBufFC.value =
      2.0 / (Math.log(camera.far + 1.0) / Math.LN2);

    // Compute lens flare intensity from body occultation
    let flare = 0;
    for (const body of bodies) {
      const toBody = body.position.clone().sub(camera.position);
      const bodyDist = toBody.length();
      if (bodyDist < 0.1) continue; // camera inside body

      const angularSep = sunDir.angleTo(toBody.normalize());
      const bodyAngRadius = Math.atan2(body.radius, bodyDist);

      // t = distance from body limb in sun-radii units
      // t > 0: sun visible beyond limb, t < 0: sun behind body
      const t = (angularSep - bodyAngRadius) / SUN_ANG_RADIUS;

      // Gaussian peak at limb crossing, cut off when deep behind
      const gaussian = Math.exp(-t * t * 0.5);
      const behindFade = THREE.MathUtils.smoothstep(t, -4, -1);
      flare = Math.max(flare, gaussian * behindFade);
    }
    material.uniforms.uFlareIntensity.value = flare;
  }

  return { mesh, update };
}
