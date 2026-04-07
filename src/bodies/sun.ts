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
const DISC_BILLBOARD = 300; // corona + disc quad size
const RAYS_BILLBOARD = 600; // starburst quad size (rays extend further)

// --- Disc + Corona layer (depth-tested, gets occluded by bodies) ---

const discVertexShader = /* glsl */ `
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

const discFragmentShader = /* glsl */ `
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    uniform float logDepthBufFC;
  #endif

  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float r = length(center) * 2.0;

    // Sun disc
    float discR = 0.08;
    float disc = smoothstep(discR, discR - 0.006, r);

    // Limb darkening
    float limbDark = 1.0 - 0.5 * pow(r / discR, 2.0);
    disc *= max(limbDark, 0.0);

    // Inner corona
    float dr = max(r - discR, 0.0);
    float innerCorona = 0.6 * exp(-dr * 18.0);

    // Outer corona
    float outerCorona = 0.08 / (1.0 + pow(r * 4.5, 2.5));

    // Soft radial structure in corona (not the starburst — that's the rays layer)
    float angle = atan(center.y, center.x);
    float coronaRays = pow(0.5 + 0.5 * sin(angle * 13.0), 6.0) * 0.15
                     + pow(0.5 + 0.5 * cos(angle * 7.0 + 0.7), 8.0) * 0.08;
    coronaRays *= exp(-r * 6.0) * 0.12;

    float brightness = disc * 6.0 + innerCorona + outerCorona + coronaRays;

    // Color gradient
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

// --- Starburst rays layer (NO depth test — renders on top of everything) ---

const raysVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const raysFragmentShader = /* glsl */ `
  uniform float uVisibility; // 0 = fully occluded, 1 = fully visible
  uniform float uFlareIntensity; // 0 = no occultation, peaks at limb crossing
  uniform vec2 uRayOffset; // screen-space offset toward visible sun sliver

  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5 - uRayOffset;
    float r = length(center) * 2.0;
    float angle = atan(center.y, center.x);

    // --- Diffraction starburst ---
    // Multiple overlapping spike sets at different angles, counts, and intensities
    float spikes = 0.0;
    angle += 0.05; // ~3 degree rotation

    // 6 strong primary spikes
    spikes += pow(abs(cos(angle * 3.0)), 90.0) * 1.0;
    // 8 medium spikes, rotated
    spikes += pow(abs(cos(angle * 4.0 + 0.25)), 100.0) * 0.6;
    // 10 finer spikes
    spikes += pow(abs(cos(angle * 5.0 + 0.7)), 120.0) * 0.35;
    // 14 subtle spikes
    spikes += pow(abs(cos(angle * 7.0 + 1.2)), 150.0) * 0.18;
    // 4 faint wide spikes (cross-hatch feel)
    spikes += pow(abs(cos(angle * 2.0 + 0.5)), 60.0) * 0.12;

    // Shorter radial falloff
    float radialFade = exp(-r * 5.5);
    float tailFade = exp(-r * 3.0) * 0.2;

    float rayBrightness = spikes * (radialFade + tailFade);

    // Central glow to anchor the rays
    float centralGlow = exp(-r * 10.0) * 0.4;
    rayBrightness += centralGlow;

    // Scale by sun visibility — rays diminish as sun is occluded
    rayBrightness *= uVisibility * 2.5;

    // --- Anamorphic lens flare (JJ Abrams) during occultation ---
    if (uFlareIntensity > 0.01) {
      vec3 flareBlue = vec3(0.6, 0.85, 1.0);

      // Main horizontal streak — tapers to a point at the ends
      float hDist = abs(center.x);
      float vTightness = 45.0 + hDist * 300.0; // gets thinner further out
      float hStreak = exp(-pow(center.y * vTightness, 2.0)) *
                      exp(-pow(center.x * 1.6, 2.0));

      // Secondary angled streak
      float sa = 0.12;
      vec2 rot = vec2(
        center.x * cos(sa) + center.y * sin(sa),
        -center.x * sin(sa) + center.y * cos(sa)
      );
      float hDist2 = abs(rot.x);
      float vTight2 = 65.0 + hDist2 * 400.0;
      float hStreak2 = exp(-pow(rot.y * vTight2, 2.0)) *
                       exp(-pow(rot.x * 2.5, 2.0)) * 0.25;

      // --- Lens ghost circles (internal reflections) ---
      // Ghosts anchor to optical axis (sun center), not the offset ray center
      vec2 optCenter = vUv - 0.5;
      float ga = 0.52; // ~30 degrees
      float gcos = cos(ga);
      float gsin = sin(ga);

      // Ghost positions along the angled axis
      vec2 gp1 = vec2(-0.10 * gcos, -0.10 * gsin);
      vec2 gp2 = vec2(-0.22 * gcos, -0.22 * gsin);
      vec2 gp3 = vec2( 0.15 * gcos,  0.15 * gsin);
      vec2 gp4 = vec2(-0.32 * gcos, -0.32 * gsin);
      vec2 gp5 = vec2( 0.28 * gcos,  0.28 * gsin);

      float ghost1 = abs(length(optCenter - gp1) - 0.020);
      ghost1 = exp(-pow(ghost1 * 170.0, 2.0)) * 0.35;

      float ghost2 = abs(length(optCenter - gp2) - 0.028);
      ghost2 = exp(-pow(ghost2 * 130.0, 2.0)) * 0.22;

      float ghost3 = exp(-pow(length(optCenter - gp3) * 55.0, 2.0)) * 0.28;

      float ghost4 = abs(length(optCenter - gp4) - 0.016);
      ghost4 = exp(-pow(ghost4 * 200.0, 2.0)) * 0.15;

      float ghost5 = exp(-pow(length(optCenter - gp5) * 45.0, 2.0)) * 0.18;

      // Tint each ghost with subtle chromatic color
      vec3 ghostColor = vec3(0.0);
      ghostColor += vec3(0.5, 0.8, 1.0) * ghost1;  // blue ring
      ghostColor += vec3(0.4, 1.0, 0.6) * ghost2;  // green ring
      ghostColor += vec3(1.0, 0.7, 0.4) * ghost3;  // warm dot
      ghostColor += vec3(0.8, 0.5, 1.0) * ghost4;  // purple ring
      ghostColor += vec3(0.5, 0.9, 0.9) * ghost5;  // cyan dot

      // --- Broad haze circle (large faint internal reflection) ---
      vec2 hazePos = vec2(-0.14 * gcos, -0.14 * gsin);
      float haze = abs(length(optCenter - hazePos) - 0.07);
      haze = exp(-pow(haze * 32.0, 2.0)) * 0.07;
      ghostColor += vec3(0.6, 0.75, 1.0) * haze;

      float flareBright = (hStreak + hStreak2) * uFlareIntensity * 0.85;

      // Blend flare with ray color and ghost artifacts
      vec3 flareColor = flareBlue * flareBright + ghostColor * uFlareIntensity;
      vec3 rayColor = vec3(1.0, 0.95, 0.85) * rayBrightness;
      vec3 combined = rayColor + flareColor;

      float alpha = clamp(max(max(combined.r, combined.g), combined.b), 0.0, 1.0);
      if (alpha < 0.003) discard;
      gl_FragColor = vec4(combined, alpha);
      return;
    }

    // Ray color — warm white
    vec3 color = vec3(1.0, 0.95, 0.85) * rayBrightness;

    float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

// Reusable temp vectors to avoid per-frame allocations
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/** Approximate sun angular radius in radians (matches discR=0.08 on billboard) */
const SUN_ANG_RADIUS = Math.atan2(DISC_BILLBOARD * 0.08 / 2, SUN_DISTANCE);

export function createSunMesh(): {
  group: THREE.Group;
  update: (opts: {
    sunDir: THREE.Vector3;
    camera: THREE.PerspectiveCamera;
    bodies: { position: THREE.Vector3; radius: number }[];
  }) => void;
} {
  const group = new THREE.Group();
  group.name = 'sunGroup';

  // --- Disc + corona mesh (depth-tested) ---
  const discGeom = new THREE.PlaneGeometry(DISC_BILLBOARD, DISC_BILLBOARD);
  const discMat = new THREE.ShaderMaterial({
    vertexShader: discVertexShader,
    fragmentShader: discFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    defines: { USE_LOGDEPTHBUF: '' },
    uniforms: {
      logDepthBufFC: { value: 0 },
    },
  });
  const discMesh = new THREE.Mesh(discGeom, discMat);
  discMesh.frustumCulled = false;
  group.add(discMesh);

  // --- Starburst rays mesh (NO depth test — renders on top) ---
  const raysGeom = new THREE.PlaneGeometry(RAYS_BILLBOARD, RAYS_BILLBOARD);
  const raysMat = new THREE.ShaderMaterial({
    vertexShader: raysVertexShader,
    fragmentShader: raysFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: {
      uVisibility: { value: 1.0 },
      uFlareIntensity: { value: 0.0 },
      uRayOffset: { value: new THREE.Vector2(0, 0) },
    },
  });
  const raysMesh = new THREE.Mesh(raysGeom, raysMat);
  raysMesh.frustumCulled = false;
  raysMesh.renderOrder = 999; // render after everything
  group.add(raysMesh);

  function update({ sunDir, camera, bodies }: {
    sunDir: THREE.Vector3;
    camera: THREE.PerspectiveCamera;
    bodies: { position: THREE.Vector3; radius: number }[];
  }): void {
    // Position relative to camera (no parallax)
    group.position.copy(camera.position).addScaledVector(sunDir, SUN_DISTANCE);
    // Match camera orientation so flare streaks stay screen-horizontal
    group.quaternion.copy(camera.quaternion);

    // Update log depth buffer uniform
    discMat.uniforms.logDepthBufFC.value =
      2.0 / (Math.log(camera.far + 1.0) / Math.LN2);

    // Compute sun visibility and flare intensity from body occultation
    let minVisibility = 1.0;
    let flare = 0;
    let primaryOccluderDir: THREE.Vector3 | null = null;

    for (const body of bodies) {
      const toBody = body.position.clone().sub(camera.position);
      const bodyDist = toBody.length();
      if (bodyDist < 0.1) continue;

      const bodyDir = toBody.normalize();
      const angularSep = sunDir.angleTo(bodyDir);
      const bodyAngRadius = Math.atan2(body.radius, bodyDist);

      // t = sun center distance from body limb, in sun-radii units
      const t = (angularSep - bodyAngRadius) / SUN_ANG_RADIUS;

      // Visibility: 1 when sun fully clear, 0 when fully behind
      // Ramps from 1 to 0 as t goes from +1 (sun just touching limb) to -1 (fully behind)
      const vis = THREE.MathUtils.smoothstep(t, -1.0, 1.0);
      if (vis < minVisibility) {
        minVisibility = vis;
        primaryOccluderDir = bodyDir;
      }

      // Flare: Gaussian peak at limb crossing, fades deep behind
      const gaussian = Math.exp(-t * t * 0.5);
      const behindFade = THREE.MathUtils.smoothstep(t, -4, -1);
      flare = Math.max(flare, gaussian * behindFade);
    }

    // Compute ray center offset toward the visible sliver of sun.
    // Project occluder direction into camera screen space, then shift rays
    // away from the body (toward the exposed crescent).
    const offset = raysMat.uniforms.uRayOffset.value as THREE.Vector2;
    offset.set(0, 0);

    if (primaryOccluderDir && minVisibility < 0.98) {
      // Difference between occluder and sun direction projected onto screen axes
      const diff = _v.copy(primaryOccluderDir).sub(sunDir);
      const camRight = _v2.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const screenX = diff.dot(camRight);
      const camUp = _v2.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const screenY = diff.dot(camUp);
      const len = Math.sqrt(screenX * screenX + screenY * screenY);

      if (len > 1e-6) {
        // Shift away from the occluder, scaled by how much is hidden.
        // Max offset ~0.03 in UV space (≈ sun disc radius on the rays billboard)
        const amount = (1.0 - minVisibility) * 0.03;
        offset.set(-screenX / len * amount, -screenY / len * amount);
      }
    }

    raysMat.uniforms.uVisibility.value = minVisibility;
    raysMat.uniforms.uFlareIntensity.value = flare;
  }

  return { group, update };
}
