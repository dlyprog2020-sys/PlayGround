import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

const WHEEL_R = 0.34
const REAR_HUB = new THREE.Vector3(-0.66, WHEEL_R, 0)
const FRONT_HUB = new THREE.Vector3(0.66, WHEEL_R, 0)
const BB = new THREE.Vector3(-0.1, 0.325, 0)
const SEAT_TOP = new THREE.Vector3(-0.34, 0.955, 0)
const HEAD_TOP = new THREE.Vector3(0.435, 0.975, 0)
const HEAD_BOTTOM = new THREE.Vector3(0.5, 0.71, 0)

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function makeCanvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  draw(ctx, w, h)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function radialTexture(inner, outer, size = 512) {
  return makeCanvasTexture(size, size, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, inner)
    g.addColorStop(0.55, inner)
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

function shadowTexture(size = 256) {
  return makeCanvasTexture(size, size, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.9)')
    g.addColorStop(0.42, 'rgba(0,0,0,0.5)')
    g.addColorStop(0.75, 'rgba(0,0,0,0.14)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

function glowTexture(size = 256) {
  return makeCanvasTexture(size, size, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.18, 'rgba(255,255,255,0.6)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

function makeDecalTexture(title, subtitle) {
  return makeCanvasTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#f4f5f0'
    ctx.textBaseline = 'middle'
    ctx.font = '700 116px "Space Grotesk", "Arial Narrow", Arial, sans-serif'
    if ('letterSpacing' in ctx) ctx.letterSpacing = '22px'
    ctx.fillText(title, 44, 102)
    ctx.fillStyle = 'rgba(244,245,240,0.6)'
    ctx.font = '500 34px "Space Grotesk", Arial, sans-serif'
    if ('letterSpacing' in ctx) ctx.letterSpacing = '15px'
    ctx.fillText(subtitle, 48, 199)
  })
}

export function createBikeExperience({ container, accent = '#c8ff3d', paint = '#25282e', onReady }) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const hotspots = Array.from(container.querySelectorAll('.hotspot'))

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    container.classList.add('no-webgl')
    onReady?.()
    return null
  }

  const gl = renderer.getContext()
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const gpuName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : ''
  const isSoftware = /swiftshader|software|llvmpipe|basic render/i.test(String(gpuName))

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftware ? 1 : 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x07080a, 4.6, 13.5)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envRT = pmrem.fromScene(room, 0.04)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.62
  room.dispose?.()
  pmrem.dispose()

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.055
  controls.enablePan = false
  controls.enableZoom = false
  controls.autoRotate = false
  controls.autoRotateSpeed = 0.42
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.47
  controls.target.set(0, 0.62, 0)

  /* ---------------- Materials ---------------- */

  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paint),
    metalness: 0.12,
    roughness: 0.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.45,
  })
  const paintTarget = new THREE.Color(paint)

  const tireBump = makeCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#101010'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#e8e8e8'
    ctx.lineWidth = 3
    for (let x = -h; x < w + h; x += 14) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + h, h)
      ctx.stroke()
    }
    ctx.strokeStyle = '#9a9a9a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, h * 0.22)
    ctx.lineTo(w, h * 0.22)
    ctx.moveTo(0, h * 0.78)
    ctx.lineTo(w, h * 0.78)
    ctx.stroke()
  })
  tireBump.wrapS = THREE.RepeatWrapping
  tireBump.wrapT = THREE.RepeatWrapping
  tireBump.repeat.set(9, 1)
  tireBump.anisotropy = 8

  const alloy = new THREE.MeshStandardMaterial({
    color: 0xb4bac2,
    metalness: 1,
    roughness: 0.27,
    envMapIntensity: 0.95,
  })
  const darkAlloy = new THREE.MeshStandardMaterial({
    color: 0x2e3238,
    metalness: 0.92,
    roughness: 0.34,
  })
  const blackMetal = new THREE.MeshStandardMaterial({
    color: 0x141619,
    metalness: 0.7,
    roughness: 0.42,
  })
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x121316,
    metalness: 0.05,
    roughness: 0.9,
    bumpMap: tireBump,
    bumpScale: 0.014,
  })
  const leather = new THREE.MeshStandardMaterial({
    color: 0x0e0f11,
    metalness: 0.02,
    roughness: 0.68,
  })
  const carbon = new THREE.MeshPhysicalMaterial({
    color: 0x181a1e,
    metalness: 0.35,
    roughness: 0.38,
    clearcoat: 0.8,
    clearcoatRoughness: 0.28,
  })
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accent),
    emissive: new THREE.Color(accent),
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.35,
  })
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff6df,
    emissive: 0xfff2d4,
    emissiveIntensity: 4.2,
    metalness: 0.1,
    roughness: 0.2,
  })
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3324,
    emissive: 0xff2a18,
    emissiveIntensity: 3,
    metalness: 0.1,
    roughness: 0.3,
  })
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0f0a,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.85,
    metalness: 0.4,
    roughness: 0.25,
  })

  /* ---------------- Helpers ---------------- */

  function finish(mesh, cast = true, receive = true) {
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    return mesh
  }

  function tube(a, b, radius, material, radialSegments = 16) {
    const dir = new THREE.Vector3().subVectors(b, a)
    const length = dir.length()
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1), material)
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
    return finish(mesh)
  }

  function curvedTube(points, radius, material, tubularSegments = 42, radialSegments = 14) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), material)
    return finish(mesh)
  }

  function sphere(position, radius, material) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material)
    mesh.position.copy(position)
    return finish(mesh)
  }

  function box(w, h, d, radius, material) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), material)
    return finish(mesh)
  }

  function orientAlong(mesh, a, b, localAxis = X_AXIS) {
    const dir = new THREE.Vector3().subVectors(b, a).normalize()
    mesh.quaternion.setFromUnitVectors(localAxis, dir)
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    return mesh
  }

  /* ---------------- Bike ---------------- */

  const bike = new THREE.Group()
  scene.add(bike)

  const rotors = []
  const chainring = new THREE.Group()

  function buildWheel(isRear) {
    const wheel = new THREE.Group()

    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.042, 20, 128), rubber)
    tire.castShadow = true
    tire.receiveShadow = true
    wheel.add(tire)

    for (const side of [-1, 1]) {
      const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.301, 0.0022, 5, 110), new THREE.MeshStandardMaterial({
        color: 0x8c9199,
        metalness: 0.2,
        roughness: 0.55,
      }))
      sidewall.position.z = side * 0.0392
      wheel.add(sidewall)
    }

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.264, 0.0145, 12, 96), alloy)
    rim.castShadow = true
    wheel.add(rim)

    const rimInner = new THREE.Mesh(new THREE.TorusGeometry(0.247, 0.008, 8, 80), darkAlloy)
    wheel.add(rimInner)

    const accentArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.277, 0.0034, 6, 40, Math.PI * 0.62),
      accentMaterial,
    )
    accentArc.rotation.z = 1.15
    accentArc.position.z = 0.007
    wheel.add(accentArc)

    const spokes = []
    const count = isSoftware ? 20 : 28
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2
      const side = i % 2 === 0 ? 1 : -1
      const inner = new THREE.Vector3(Math.cos(angle) * 0.033, Math.sin(angle) * 0.033, side * 0.012)
      const outer = new THREE.Vector3(Math.cos(angle) * 0.252, Math.sin(angle) * 0.252, side * 0.026)
      const length = inner.distanceTo(outer)
      const geometry = new THREE.CylinderGeometry(0.0015, 0.0015, length, 5, 1)
      const dir = outer.clone().sub(inner)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
      const position = inner.clone().add(outer).multiplyScalar(0.5)
      geometry.applyMatrix4(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1)))
      spokes.push(geometry)
    }
    const spokeMesh = new THREE.Mesh(mergeGeometries(spokes, false), alloy)
    spokeMesh.castShadow = true
    wheel.add(spokeMesh)

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.11, 24), darkAlloy)
    hub.rotation.x = Math.PI / 2
    hub.castShadow = true
    wheel.add(hub)

    const hubCapGeometry = new THREE.CylinderGeometry(0.036, 0.03, 0.016, 24)
    const hubCapA = new THREE.Mesh(hubCapGeometry, alloy)
    hubCapA.rotation.x = Math.PI / 2
    hubCapA.position.z = 0.056
    wheel.add(hubCapA)
    const hubCapB = hubCapA.clone()
    hubCapB.position.z = -0.056
    wheel.add(hubCapB)

    const rotor = new THREE.Group()
    const rotorDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.0035, 64), alloy)
    rotorDisc.rotation.x = Math.PI / 2
    rotor.add(rotorDisc)
    const rotorRing = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.005, 6, 56), darkAlloy)
    rotor.add(rotorRing)
    for (let i = 0; i < 6; i += 1) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 8), darkAlloy)
      bolt.rotation.x = Math.PI / 2
      bolt.position.set(Math.cos((i / 6) * Math.PI * 2) * 0.083, Math.sin((i / 6) * Math.PI * 2) * 0.083, 0)
      rotor.add(bolt)
    }
    rotor.position.z = 0.058
    wheel.add(rotor)
    rotors.push(rotor)

    if (isRear) {
      for (let i = 0; i < 7; i += 1) {
        const r = 0.057 - i * 0.0045
        const cog = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.0055, 40), darkAlloy)
        cog.rotation.x = Math.PI / 2
        cog.position.z = 0.072 + i * 0.007
        wheel.add(cog)
      }
    }

    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.034, 6), alloy)
    valve.position.set(0.03, 0.283, 0)
    valve.rotation.z = -0.35
    wheel.add(valve)

    return wheel
  }

  const rearWheel = buildWheel(true)
  rearWheel.position.copy(REAR_HUB)
  rearWheel.rotation.z = 0.4
  bike.add(rearWheel)

  const frontWheel = buildWheel(false)
  frontWheel.position.copy(FRONT_HUB)
  frontWheel.rotation.z = 2.1
  bike.add(frontWheel)

  /* Frame */

  bike.add(
    finish(tube(HEAD_BOTTOM, HEAD_TOP, 0.047, paintMaterial, 20)),
    finish(tube(SEAT_TOP, HEAD_TOP, 0.034, paintMaterial, 18)),
    finish(tube(SEAT_TOP, BB, 0.036, paintMaterial, 18)),
  )

  const batteryA = HEAD_BOTTOM.clone()
  const batteryB = BB.clone()
  const batteryLength = batteryA.distanceTo(batteryB)
  const batteryCasing = new THREE.Mesh(
    new RoundedBoxGeometry(batteryLength * 0.99, 0.118, 0.088, 5, 0.038),
    paintMaterial,
  )
  orientAlong(batteryCasing, batteryA, batteryB)
  finish(batteryCasing)
  bike.add(batteryCasing)

  const batteryCap = box(0.032, 0.124, 0.094, 0.012, darkAlloy)
  batteryCap.position.copy(batteryA)
  batteryCap.quaternion.copy(batteryCasing.quaternion)
  batteryCap.position.add(new THREE.Vector3(-0.012, -0.008, 0))
  bike.add(batteryCap)

  const batteryMid = batteryA.clone().add(batteryB).multiplyScalar(0.5)
  const batteryDir = batteryB.clone().sub(batteryA).normalize()
  const batteryAngle = Math.atan2(batteryDir.y, batteryDir.x)

  for (const side of [-1, 1]) {
    const strip = box(batteryLength * 0.6, 0.006, 0.0035, 0.0015, accentMaterial)
    strip.position.copy(batteryMid)
    strip.position.z = side * 0.0454
    strip.rotation.z = batteryAngle
    bike.add(strip)
  }

  bike.add(
    finish(sphere(SEAT_TOP, 0.034, paintMaterial)),
    finish(sphere(HEAD_TOP, 0.047, paintMaterial)),
    finish(sphere(HEAD_BOTTOM, 0.046, paintMaterial)),
  )

  for (const side of [-1, 1]) {
    bike.add(finish(curvedTube([
      new THREE.Vector3(BB.x, BB.y, side * 0.038),
      new THREE.Vector3(-0.36, 0.295, side * 0.052),
      new THREE.Vector3(REAR_HUB.x, REAR_HUB.y, side * 0.05),
    ], 0.017, paintMaterial, 28, 12)))

    bike.add(finish(curvedTube([
      new THREE.Vector3(SEAT_TOP.x, SEAT_TOP.y - 0.015, side * 0.026),
      new THREE.Vector3(-0.48, 0.68, side * 0.045),
      new THREE.Vector3(REAR_HUB.x, REAR_HUB.y, side * 0.05),
    ], 0.015, paintMaterial, 28, 10)))
  }

  const dropout = box(0.075, 0.05, 0.022, 0.008, darkAlloy)
  dropout.position.set(REAR_HUB.x, REAR_HUB.y, 0.055)
  bike.add(dropout)

  /* Fork */

  const crown = box(0.085, 0.052, 0.15, 0.018, blackMetal)
  crown.position.copy(HEAD_BOTTOM)
  crown.position.y -= 0.005
  bike.add(crown)

  for (const side of [-1, 1]) {
    bike.add(finish(tube(
      new THREE.Vector3(0.505, 0.705, side * 0.055),
      new THREE.Vector3(0.578, 0.505, side * 0.055),
      0.021,
      alloy,
    )))

    bike.add(finish(curvedTube([
      new THREE.Vector3(0.578, 0.51, side * 0.055),
      new THREE.Vector3(0.612, 0.43, side * 0.052),
      new THREE.Vector3(FRONT_HUB.x, FRONT_HUB.y, side * 0.05),
    ], 0.028, carbon, 24, 14)))
  }

  const forkBridge = box(0.045, 0.032, 0.13, 0.012, blackMetal)
  forkBridge.position.set(0.583, 0.507, 0)
  bike.add(forkBridge)

  const frontAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 16), alloy)
  frontAxle.rotation.x = Math.PI / 2
  frontAxle.position.copy(FRONT_HUB)
  bike.add(frontAxle)

  /* Cockpit */

  bike.add(finish(tube(HEAD_TOP, new THREE.Vector3(0.505, 1.045, 0), 0.016, alloy)))

  const bar = curvedTube([
    new THREE.Vector3(0.5, 1.052, -0.29),
    new THREE.Vector3(0.512, 1.062, -0.16),
    new THREE.Vector3(0.52, 1.068, 0),
    new THREE.Vector3(0.512, 1.062, 0.16),
    new THREE.Vector3(0.5, 1.052, 0.29),
  ], 0.0125, darkAlloy, 40, 12)
  bike.add(bar)

  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.115, 20), rubber)
    grip.rotation.x = Math.PI / 2
    grip.position.set(0.503, 1.053, side * 0.245)
    grip.castShadow = true
    bike.add(grip)

    const barEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 20), accentMaterial)
    barEnd.rotation.x = Math.PI / 2
    barEnd.position.set(0.503, 1.053, side * 0.304)
    bike.add(barEnd)

    bike.add(finish(curvedTube([
      new THREE.Vector3(0.535, 1.055, side * 0.19),
      new THREE.Vector3(0.6, 1.035, side * 0.185),
      new THREE.Vector3(0.625, 1.0, side * 0.18),
    ], 0.0055, blackMetal, 14, 6)))
  }

  const display = box(0.085, 0.028, 0.058, 0.011, blackMetal)
  display.position.set(0.57, 1.078, 0.07)
  display.rotation.y = -0.08
  bike.add(display)

  const screen = box(0.062, 0.003, 0.042, 0.001, screenMaterial)
  screen.position.set(0.57, 1.093, 0.07)
  screen.rotation.y = -0.08
  bike.add(screen)

  /* Saddle */

  const saddleShape = new THREE.Shape()
  saddleShape.moveTo(0.175, 0)
  saddleShape.quadraticCurveTo(0.12, 0.032, 0.06, 0.056)
  saddleShape.quadraticCurveTo(-0.02, 0.078, -0.1, 0.086)
  saddleShape.quadraticCurveTo(-0.17, 0.086, -0.19, 0.052)
  saddleShape.lineTo(-0.19, -0.052)
  saddleShape.quadraticCurveTo(-0.17, -0.086, -0.1, -0.086)
  saddleShape.quadraticCurveTo(-0.02, -0.078, 0.06, -0.056)
  saddleShape.quadraticCurveTo(0.12, -0.032, 0.175, 0)

  const saddleGeometry = new THREE.ExtrudeGeometry(saddleShape, {
    depth: 0.034,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.011,
    bevelSegments: 4,
    curveSegments: 24,
  })
  const saddle = new THREE.Mesh(saddleGeometry, leather)
  saddle.rotation.x = -Math.PI / 2
  saddle.position.set(-0.37, 1.03, 0)
  saddle.rotation.z = -0.02
  saddle.castShadow = true
  bike.add(saddle)

  bike.add(finish(tube(
    new THREE.Vector3(SEAT_TOP.x, SEAT_TOP.y - 0.01, 0),
    new THREE.Vector3(-0.365, 1.035, 0),
    0.0155,
    alloy,
  )))

  for (const side of [-1, 1]) {
    bike.add(finish(tube(
      new THREE.Vector3(-0.35, 1.032, side * 0.03),
      new THREE.Vector3(-0.49, 1.03, side * 0.028),
      0.0055,
      darkAlloy,
      8,
    )))
  }

  const seatClamp = box(0.045, 0.022, 0.05, 0.008, darkAlloy)
  seatClamp.position.set(-0.337, 0.982, 0)
  bike.add(seatClamp)

  const derailleur = box(0.05, 0.085, 0.032, 0.012, blackMetal)
  derailleur.position.set(-0.585, 0.272, 0.102)
  derailleur.rotation.z = 0.38
  bike.add(derailleur)

  for (const [x, y] of [[-0.605, 0.242], [-0.56, 0.228]]) {
    const jockey = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.008, 20), darkAlloy)
    jockey.rotation.x = Math.PI / 2
    jockey.position.set(x, y, 0.114)
    bike.add(jockey)
  }

  const cage = box(0.012, 0.06, 0.008, 0.004, darkAlloy)
  cage.position.set(-0.584, 0.243, 0.114)
  cage.rotation.z = 0.35
  bike.add(cage)

  for (const side of [-1, 1]) {
    const caliper = box(0.034, 0.058, 0.024, 0.01, blackMetal)
    caliper.position.set(side > 0 ? 0.622 : -0.628, 0.44, side > 0 ? 0.062 : 0.055)
    caliper.rotation.z = side > 0 ? -0.25 : 0.35
    bike.add(caliper)
  }

  bike.add(finish(curvedTube([
    new THREE.Vector3(0.535, 1.03, 0.18),
    new THREE.Vector3(0.58, 0.9, 0.12),
    new THREE.Vector3(0.6, 0.64, 0.085),
    new THREE.Vector3(0.626, 0.47, 0.072),
  ], 0.0028, blackMetal, 24, 6)))

  bike.add(finish(curvedTube([
    new THREE.Vector3(0.5, 1.03, -0.17),
    new THREE.Vector3(0.4, 1.0, -0.05),
    new THREE.Vector3(0.1, 0.99, -0.02),
    new THREE.Vector3(-0.33, 0.955, -0.02),
  ], 0.0026, blackMetal, 26, 6)))

  /* Drivetrain */

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.079, 0.079, 0.155, 36), blackMetal)
  motor.rotation.x = Math.PI / 2
  motor.position.copy(BB)
  motor.castShadow = true
  bike.add(motor)

  const motorRing = new THREE.Mesh(new THREE.TorusGeometry(0.0795, 0.0035, 8, 48), accentMaterial)
  motorRing.position.copy(BB)
  motorRing.position.z = 0.079
  bike.add(motorRing)

  const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.006, 36), darkAlloy)
  motorCap.rotation.x = Math.PI / 2
  motorCap.position.copy(BB)
  motorCap.position.z = -0.081
  bike.add(motorCap)

  chainring.position.copy(BB)
  chainring.position.z = 0.088
  const ringDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.004, 52), darkAlloy)
  ringDisc.rotation.x = Math.PI / 2
  chainring.add(ringDisc)
  const ringTeeth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 8, 64), alloy)
  chainring.add(ringTeeth)
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2
    const arm = tube(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(angle) * 0.085, Math.sin(angle) * 0.085, 0),
      0.007,
      alloy,
      8,
    )
    chainring.add(arm)
  }
  const chainringAccent = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0025, 6, 40), accentMaterial)
  chainring.add(chainringAccent)
  bike.add(chainring)

  const chainTop = tube(
    new THREE.Vector3(BB.x, BB.y + 0.101, 0.09),
    new THREE.Vector3(REAR_HUB.x, REAR_HUB.y + 0.052, 0.09),
    0.0048,
    darkAlloy,
    6,
  )
  const chainBottom = tube(
    new THREE.Vector3(BB.x, BB.y - 0.101, 0.09),
    new THREE.Vector3(REAR_HUB.x, REAR_HUB.y - 0.052, 0.09),
    0.0048,
    darkAlloy,
    6,
  )
  bike.add(chainTop, chainBottom)

  const crankGeometry = new RoundedBoxGeometry(0.042, 0.175, 0.021, 3, 0.009)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(crankGeometry, darkAlloy)
    arm.castShadow = true
    const angle = side === 1 ? -0.62 : 2.52
    arm.position.copy(BB)
    arm.position.z = side * 0.108
    arm.position.x += Math.cos(angle) * 0.082
    arm.position.y += Math.sin(angle) * 0.082
    arm.rotation.z = angle - Math.PI / 2
    bike.add(arm)

    const pedal = box(0.105, 0.02, 0.072, 0.008, blackMetal)
    pedal.position.copy(BB)
    pedal.position.z = side * 0.148
    pedal.position.x += Math.cos(angle) * 0.168
    pedal.position.y += Math.sin(angle) * 0.168
    pedal.rotation.z = angle * 0.1
    bike.add(pedal)

    const pedalPin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), alloy)
    pedalPin.rotation.x = Math.PI / 2
    pedalPin.position.copy(pedal.position)
    bike.add(pedalPin)
  }

  /* Lights */

  const headlight = box(0.06, 0.068, 0.088, 0.022, blackMetal)
  headlight.position.set(0.535, 0.812, 0)
  bike.add(headlight)

  const headlightLens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 28), headlightMaterial)
  headlightLens.position.set(0.567, 0.812, 0)
  headlightLens.rotation.y = Math.PI / 2
  bike.add(headlightLens)

  const headlightRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0032, 8, 40), accentMaterial)
  headlightRing.position.copy(headlightLens.position)
  headlightRing.rotation.y = Math.PI / 2
  bike.add(headlightRing)

  const tail = box(0.018, 0.042, 0.05, 0.008, blackMetal)
  tail.position.set(-0.298, 0.835, 0)
  bike.add(tail)
  const tailLens = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.026), tailMaterial)
  tailLens.position.set(-0.309, 0.835, 0)
  tailLens.rotation.y = -Math.PI / 2
  bike.add(tailLens)

  const headlightBeam = new THREE.SpotLight(0xfff0cf, 2.2, 4.2, 0.55, 0.9, 1.7)
  headlightBeam.position.set(0.62, 0.83, 0)
  headlightBeam.target.position.set(2.6, 0.2, 0)
  bike.add(headlightBeam, headlightBeam.target)

  const decalTexture = makeDecalTexture('VOLTRA', 'A U R O R A   E - 1')
  const decalMaterial = new THREE.MeshBasicMaterial({
    map: decalTexture,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.0825), decalMaterial)
  decal.position.copy(batteryMid)
  decal.position.z = 0.0452
  decal.rotation.z = Math.PI - batteryAngle
  bike.add(decal)

  const topDecalTexture = makeCanvasTexture(1024, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(244,245,240,0.82)'
    ctx.textBaseline = 'middle'
    ctx.font = '600 64px "Space Grotesk", Arial, sans-serif'
    if ('letterSpacing' in ctx) ctx.letterSpacing = '18px'
    ctx.fillText('AURORA E-1', 30, h / 2)
  })
  const topDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.0375),
    new THREE.MeshBasicMaterial({
      map: topDecalTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  )
  topDecal.position.set(0.06, 0.968, 0.0355)
  topDecal.rotation.z = 0.03
  bike.add(topDecal)

  /* Glow sprites */

  const glowMap = glowTexture()
  const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap,
    color: 0xfff0cf,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }))
  headGlow.scale.setScalar(0.25)
  headGlow.position.set(0.585, 0.812, 0)
  bike.add(headGlow)

  const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap,
    color: 0xff3a26,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }))
  tailGlow.scale.setScalar(0.16)
  tailGlow.position.set(-0.318, 0.835, 0)
  bike.add(tailGlow)

  /* ---------------- Stage ---------------- */

  const floorMap = radialTexture('#141619', '#07080a', 1024)
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(120, 160),
    new THREE.MeshStandardMaterial({
      map: floorMap,
      color: 0xffffff,
      metalness: 0.06,
      roughness: 0.82,
      envMapIntensity: 0.18,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  )
  contact.rotation.x = -Math.PI / 2
  contact.position.y = 0.003
  contact.position.z = 0.02
  scene.add(contact)

  const stageRing = new THREE.Mesh(
    new THREE.RingGeometry(1.31, 1.322, 160),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  stageRing.rotation.x = -Math.PI / 2
  stageRing.position.y = 0.004
  scene.add(stageRing)

  const stageRingOuter = new THREE.Mesh(
    new THREE.RingGeometry(1.62, 1.624, 160),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  stageRingOuter.rotation.x = -Math.PI / 2
  stageRingOuter.position.y = 0.004
  scene.add(stageRingOuter)

  /* Lights */

  scene.add(new THREE.HemisphereLight(0x8da4c4, 0x050607, 0.32))

  const key = new THREE.DirectionalLight(0xfff4e6, 3.5)
  key.position.set(2.6, 4.6, 3.2)
  key.castShadow = true
  key.shadow.mapSize.set(isSoftware ? 1024 : 2048, isSoftware ? 1024 : 2048)
  key.shadow.camera.left = -2.2
  key.shadow.camera.right = 2.2
  key.shadow.camera.top = 2.2
  key.shadow.camera.bottom = -2.2
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 12
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  key.shadow.radius = 4
  scene.add(key)

  const rimLight = new THREE.DirectionalLight(0xa8c0e6, 3.2)
  rimLight.position.set(-3.6, 2.4, -2.4)
  scene.add(rimLight)

  const accentLight = new THREE.DirectionalLight(0x9adfff, 2.0)
  accentLight.position.set(2.8, 1.2, -3.4)
  scene.add(accentLight)

  const warmFill = new THREE.PointLight(0xffc89a, 7, 9, 2)
  warmFill.position.set(3.2, 2.4, 3.6)
  scene.add(warmFill)

  const rearRim = new THREE.PointLight(0xbcd2f2, 5.5, 6.5, 2)
  rearRim.position.set(-2.4, 1.1, -2.1)
  scene.add(rearRim)

  const frontRim = new THREE.PointLight(0xffd8b0, 4.5, 6, 2)
  frontRim.position.set(2.1, 0.9, -2.2)
  scene.add(frontRim)

  const stageGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 4.2),
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: 0x94add8,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  stageGlow.rotation.x = -Math.PI / 2
  stageGlow.position.y = 0.002
  scene.add(stageGlow)

  /* Dust */

  const dustCount = isSoftware ? 40 : 130
  const dustPositions = new Float32Array(dustCount * 3)
  const dustSpeeds = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 4.6
    dustPositions[i * 3 + 1] = Math.random() * 2.4
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 2.6
    dustSpeeds[i] = 0.01 + Math.random() * 0.025
  }
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xdbe6f5,
      size: 0.009,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  )
  scene.add(dust)

  /* ---------------- Layout & interaction ---------------- */

  let width = 1
  let height = 1
  let isMobile = false
  const baseCamera = new THREE.Vector3()
  const introStart = new THREE.Vector3()
  let introElapsed = 0
  let introDone = reduceMotion
  let paused = false
  let visible = true
  let lastFrameTime = performance.now()
  let elapsedTime = 0

  let firstLayout = true

  function baseCameraFor(distance) {
    const azimuth = isMobile ? 0.72 : 0.64
    const polar = isMobile ? 1.42 : 1.44
    const radius = Math.sin(polar) * distance
    return new THREE.Vector3(
      Math.sin(azimuth) * radius,
      controls.target.y + Math.cos(polar) * distance,
      Math.cos(azimuth) * radius,
    )
  }

  function layout() {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    isMobile = window.matchMedia('(max-width: 1080px)').matches
    const isCompact = !isMobile && width < 1180

    const previousTarget = controls.target.clone()
    const previousOffset = camera.position.clone().sub(previousTarget)

    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.fov = isMobile ? 36 : isCompact ? 34.5 : 32

    camera.setViewOffset(
      width,
      height,
      -width * (isMobile ? -0.035 : isCompact ? 0.085 : 0.128),
      height * (isMobile ? 0.2 : 0),
      width,
      height,
    )
    camera.updateProjectionMatrix()

    controls.target.set(0, isMobile ? 0.55 : 0.59, 0)
    const distance = isMobile ? 6.25 : isCompact ? 4.9 : 4.15

    if (!introDone) {
      baseCamera.copy(baseCameraFor(distance))
      introStart.copy(baseCamera).add(new THREE.Vector3(1.15, 0.55, 1.0))
      camera.position.copy(introStart)
    } else if (firstLayout) {
      baseCamera.copy(baseCameraFor(distance))
      camera.position.copy(baseCamera)
    } else {
      const spherical = new THREE.Spherical().setFromVector3(previousOffset)
      spherical.radius = distance
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
    }

    firstLayout = false
    controls.minDistance = 2.6
    controls.maxDistance = 8
    if (introDone) controls.autoRotate = false
    controls.update()
  }

  function setPaint(hex) {
    paintTarget.set(hex)
  }

  function setAccent(hex) {
    const color = new THREE.Color(hex)
    accentMaterial.color.copy(color)
    accentMaterial.emissive.copy(color)
    screenMaterial.emissive.copy(color)
    stageRing.material.color.copy(color)
    stageRingOuter.material.color.copy(color)
  }

  const layoutObserver = new ResizeObserver(layout)
  layoutObserver.observe(container)
  layout()

  if (!reduceMotion) {
    controls.enabled = false
  }

  const heroObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true
    },
    { threshold: 0.02 },
  )
  heroObserver.observe(container)

  let firstFrame = true

  function projectHotspot(element, anchor) {
    const vector = anchor.clone().project(camera)
    const x = (vector.x * 0.5 + 0.5) * width
    const y = (-vector.y * 0.5 + 0.5) * height
    const inView = vector.z < 1 && x > 12 && x < width - 12 && y > 50 && y < height - 12
    element.classList.toggle('is-visible', inView)
    element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
  }

  const anchors = {
    motor: new THREE.Vector3(BB.x, BB.y, 0.12),
    battery: new THREE.Vector3(0.24, 0.5, 0.09),
    cockpit: new THREE.Vector3(0.515, 1.075, 0.02),
    wheels: new THREE.Vector3(FRONT_HUB.x, FRONT_HUB.y, 0.08),
  }

  function animate() {
    const now = performance.now()
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05)
    lastFrameTime = now

    if (paused || !visible || document.hidden) return

    elapsedTime += dt

    if (!introDone) {
      introElapsed += dt
      const t = clamp(introElapsed / 2.1, 0, 1)
      const eased = easeOutCubic(t)
      camera.position.lerpVectors(introStart, baseCamera, eased)
      if (t >= 1) {
        introDone = true
        controls.enabled = true
        controls.autoRotate = false
      }
    } else {
      controls.update()
    }

    paintMaterial.color.lerp(paintTarget, 1 - Math.exp(-9 * dt))

    const time = elapsedTime
    stageRing.material.opacity = 0.2 + Math.sin(time * 1.2) * 0.05
    headGlow.material.opacity = 0.66 + Math.sin(time * 2.4) * 0.06

    const positions = dustGeometry.attributes.position.array
    for (let i = 0; i < dustCount; i += 1) {
      positions[i * 3 + 1] += dustSpeeds[i] * dt
      if (positions[i * 3 + 1] > 2.6) positions[i * 3 + 1] = 0
    }
    dustGeometry.attributes.position.needsUpdate = true
    dust.rotation.y += dt * 0.015

    if (!isMobile) {
      for (const element of hotspots) {
        const anchor = anchors[element.dataset.anchor]
        if (anchor) projectHotspot(element, anchor)
      }
    }

    renderer.render(scene, camera)

    if (firstFrame) {
      firstFrame = false
      onReady?.()
    }
  }

  renderer.setAnimationLoop(animate)

  return {
    setPaint,
    setAccent,
    setPaused(value) {
      paused = value
    },
    dispose() {
      renderer.setAnimationLoop(null)
      layoutObserver.disconnect()
      heroObserver.disconnect()
      controls.dispose()
      pmrem.dispose()
      envRT.dispose()
      renderer.dispose()
      container.querySelector('canvas')?.remove()
    },
  }
}
