import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Compass, Layers, Radio } from 'lucide-react';

interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'overview',
    label: 'Ward Overview',
    position: [13, 9.5, 14],
    target: [0, 1.4, 0],
  },
  {
    id: 'lora',
    label: 'LoRa Mesh Tower',
    position: [6.5, 5.8, 7.2],
    target: [3.4, 2.8, -1.6],
  },
  {
    id: 'hazard',
    label: 'Road & Drainage Hazard',
    position: [-5.5, 4.2, 6.2],
    target: [-2.2, 0.2, 1.2],
  },
  {
    id: 'streetlight',
    label: 'Streetlight Assembly',
    position: [-4.5, 6.4, -2.5],
    target: [-3.8, 3.2, -3.5],
  },
];

interface InspectedPartInfo {
  name: string;
  subsystem: string;
  detail: string;
}

export const CivicTwin3DView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglUnsupported, setWebglUnsupported] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('overview');
  const [streetlightOn, setStreetlightOn] = useState(true);
  const [meshPulseActive, setMeshPulseActive] = useState(true);
  const [inspectedPart, setInspectedPart] = useState<InspectedPartInfo>({
    name: 'Ward 01 Civic & CEMN Diorama',
    subsystem: 'Interactive 3D Twin',
    detail: 'Click any infrastructure or mesh tower component to inspect telemetry.',
  });

  const presetGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    animating: boolean;
  }>({
    pos: new THREE.Vector3(13, 9.5, 14),
    target: new THREE.Vector3(0, 1.4, 0),
    animating: false,
  });

  const streetlightStateRef = useRef(streetlightOn);
  streetlightStateRef.current = streetlightOn;
  const meshPulseRef = useRef(meshPulseActive);
  meshPulseRef.current = meshPulseActive;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Software WebGL & capability guard before creating renderer
    const probeCanvas = document.createElement('canvas');
    const gl =
      probeCanvas.getContext('webgl2') ||
      probeCanvas.getContext('webgl') ||
      probeCanvas.getContext('experimental-webgl');

    if (!gl) {
      setWebglUnsupported('WebGL is disabled or unavailable in this browser environment.');
      return;
    }

    const debugExt = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      const rendererName = String(
        (gl as WebGLRenderingContext).getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || ''
      );
      if (/SwiftShader|llvmpipe|Microsoft Basic Render/i.test(rendererName)) {
        setWebglUnsupported(
          `Hardware 3D acceleration unavailable (${rendererName}). Showing static architectural summary.`
        );
        return;
      }
    }

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 160);
    camera.position.set(13, 9.5, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minDistance = 4;
    controls.maxDistance = 32;
    controls.target.set(0, 1.4, 0);

    // Three-point calibrated studio lighting
    const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 0.55);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    keyLight.position.set(12, 16, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-10, 8, -12);
    scene.add(rimLight);

    const clickableMeshes: THREE.Mesh[] = [];
    const registerClickable = (
      mesh: THREE.Mesh,
      name: string,
      subsystem: string,
      detail: string
    ) => {
      mesh.userData = { name, subsystem, detail };
      clickableMeshes.push(mesh);
    };

    // 1. Roadway Base & Intersection Plinth
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.05,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.78,
      metalness: 0.04,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.85,
    });

    const roadDeck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 14), asphaltMat);
    roadDeck.position.set(0, -0.15, 0);
    roadDeck.receiveShadow = true;
    scene.add(roadDeck);

    // Sidewalks (North & South curbs)
    const northSidewalk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.24, 3.6), sidewalkMat);
    northSidewalk.position.set(0, 0.12, -5.2);
    northSidewalk.receiveShadow = true;
    scene.add(northSidewalk);

    const southSidewalk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.24, 3.2), sidewalkMat);
    southSidewalk.position.set(0, 0.12, 5.4);
    southSidewalk.receiveShadow = true;
    scene.add(southSidewalk);

    // Crosswalk markings
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    for (let i = -3; i <= 3; i += 1.2) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 2.4), stripeMat);
      stripe.position.set(i, 0.01, -1.6);
      scene.add(stripe);
    }

    // 2. Road Pothole & Stormwater Drainage Grate Assembly (3+ parts)
    const hazardGroup = new THREE.Group();
    const potholeRim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
    );
    potholeRim.position.set(-2.2, 0.01, 1.2);
    registerClickable(
      potholeRim,
      'Collapsed Asphalt Pothole (CF-2026-0421)',
      'Roads & Drainage Dept',
      '1.2m water-filled carriageway cavity near storm culvert; urgent surface repair logged.'
    );
    hazardGroup.add(potholeRim);

    const waterFill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.05, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x0ea5e9,
        roughness: 0.08,
        metalness: 0.1,
        clearcoat: 1.0,
      })
    );
    waterFill.position.set(-2.2, 0.03, 1.2);
    hazardGroup.add(waterFill);

    const drainGrate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.7), steelMat);
    drainGrate.position.set(-2.2, 0.03, 3.1);
    registerClickable(
      drainGrate,
      'Stormwater Culvert Grate #W1-14',
      'Stormwater Drainage',
      'Silt buildup 45%; linked to flood mitigation audit.'
    );
    hazardGroup.add(drainGrate);

    // Safety cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.65, 16),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
    );
    cone.position.set(-3.4, 0.33, 1.4);
    cone.castShadow = true;
    hazardGroup.add(cone);
    scene.add(hazardGroup);

    // 3. 5-Part Municipal Streetlight Mast Assembly
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-3.8, 0.24, -3.5);

    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.45, 16), steelMat);
    lampBase.position.y = 0.22;
    lampBase.castShadow = true;
    lampGroup.add(lampBase);

    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 4.6, 16), steelMat);
    lampPole.position.y = 2.5;
    lampPole.castShadow = true;
    lampGroup.add(lampPole);

    const lampArm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.14), steelMat);
    lampArm.position.set(0.75, 4.75, 0);
    lampArm.castShadow = true;
    lampGroup.add(lampArm);

    const lampHousing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.34), steelMat);
    lampHousing.position.set(1.45, 4.68, 0);
    lampGroup.add(lampHousing);

    const lampBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const lampBulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.24), lampBulbMat);
    lampBulb.position.set(1.45, 4.58, 0);
    registerClickable(
      lampBulb,
      'Smart LED Luminaire Mast #SL-208',
      'Municipal Lighting',
      'Crosswalk illumination unit; toggle power state using the bottom dock.'
    );
    lampGroup.add(lampBulb);

    const streetPointLight = new THREE.PointLight(0xfde047, 4.5, 9, 2);
    streetPointLight.position.set(1.45, 4.3, 0);
    lampGroup.add(streetPointLight);
    scene.add(lampGroup);

    // 4. 6-Part Deployable Solar LoRa + Wi-Fi Mesh Repeater Tower (CEMN)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(3.4, 0.24, -1.6);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), steelMat);
    plinth.position.y = 0.15;
    plinth.castShadow = true;
    towerGroup.add(plinth);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 4.2, 16), steelMat);
    mast.position.y = 2.25;
    mast.castShadow = true;
    towerGroup.add(mast);

    const nemaBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.9, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.3 })
    );
    nemaBox.position.set(0, 1.65, 0.35);
    nemaBox.castShadow = true;
    registerClickable(
      nemaBox,
      'CEMN Solar LoRa Repeater (LORA-GW-01)',
      'Emergency Mesh Network',
      '868 MHz LoRaWAN + 2.4 GHz Wi-Fi Mesh gateway with 94% LiFePO4 battery reserve.'
    );
    towerGroup.add(nemaBox);

    const solarPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.06, 1.0),
      new THREE.MeshPhysicalMaterial({
        color: 0x0c4a6e,
        roughness: 0.15,
        metalness: 0.65,
        clearcoat: 0.9,
      })
    );
    solarPanel.position.set(0, 3.35, 0.2);
    solarPanel.rotation.x = Math.PI / 6;
    solarPanel.castShadow = true;
    towerGroup.add(solarPanel);

    const whip1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5, roughness: 0.3 })
    );
    whip1.position.set(-0.22, 4.9, 0);
    towerGroup.add(whip1);

    const whip2 = whip1.clone();
    whip2.position.set(0.22, 4.9, 0);
    towerGroup.add(whip2);

    const beaconRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
    });
    const beaconRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.045, 12, 32),
      beaconRingMat
    );
    beaconRing.rotation.x = Math.PI / 2;
    beaconRing.position.y = 4.35;
    towerGroup.add(beaconRing);
    scene.add(towerGroup);

    // 5. Civic Ward Buildings + Mobile Responder Peer + Multi-Hop RF Arcs
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.15,
    });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.4, 2.4), buildingMat);
    b1.position.set(4.5, 1.9, -5.2);
    b1.castShadow = true;
    b1.receiveShadow = true;
    registerClickable(
      b1,
      'Ward 01 Relief Shelter & Clinic',
      'Municipal Civic Facility',
      'Backup diesel + battery microgrid ready; hosts shelter Wi-Fi mesh access point.'
    );
    scene.add(b1);

    const peerPhoneNode = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.7, 16),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.6,
      })
    );
    peerPhoneNode.position.set(-2.2, 0.5, 4.9);
    registerClickable(
      peerPhoneNode,
      'Android BLE/Wi-Fi Direct Peer (AND-BLE-104)',
      'Citizen Mesh Relay',
      'Relaying SOS packets via 2-hop BLE -> LoRa gateway route.'
    );
    scene.add(peerPhoneNode);

    // RF Propagation Curve between Android Peer and LoRa Tower
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-2.2, 0.9, 4.9),
      new THREE.Vector3(0.6, 5.1, 1.6),
      new THREE.Vector3(3.4, 4.35, -1.6)
    );
    const rfTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.04, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.75,
      })
    );
    scene.add(rfTube);

    const pulseSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.8,
      })
    );
    scene.add(pulseSphere);

    // Raycaster interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handleCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const u = hits[0].object.userData as InspectedPartInfo;
        setInspectedPart(u);
      }
    };
    renderer.domElement.addEventListener('click', handleCanvasClick);

    const handleResize = () => {
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Streetlight state sync
      const lit = streetlightStateRef.current;
      streetPointLight.intensity = lit ? 4.5 : 0;
      lampBulbMat.emissiveIntensity = lit ? 1.8 : 0.05;

      // RF Mesh Pulse animation along Bezier curve
      const pulseOn = meshPulseRef.current;
      rfTube.visible = pulseOn;
      pulseSphere.visible = pulseOn;
      if (pulseOn) {
        const t = (elapsed * 0.45) % 1;
        pulseSphere.position.copy(curve.getPointAt(t));
        const s = 1 + Math.sin(elapsed * 4) * 0.15;
        beaconRing.scale.set(s, s, 1);
      }

      // Smooth damped camera preset lerp
      if (presetGoalRef.current.animating) {
        camera.position.lerp(presetGoalRef.current.pos, 0.08);
        controls.target.lerp(presetGoalRef.current.target, 0.08);
        if (camera.position.distanceTo(presetGoalRef.current.pos) < 0.05) {
          presetGoalRef.current.animating = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      envTexture.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const selectPreset = (preset: CameraPreset) => {
    setActivePreset(preset.id);
    presetGoalRef.current.pos.set(...preset.position);
    presetGoalRef.current.target.set(...preset.target);
    presetGoalRef.current.animating = true;
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            3D Ward Infrastructure & CEMN Mesh Twin
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Interactive Three.js spatial inspection of municipal road hazards, streetlight mast
            assemblies, and LoRa/BLE multi-hop SOS propagation.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-500">
          Drag to orbit · Scroll to zoom · Click assets to inspect
        </span>
      </div>

      {/* Main Spatial Viewport */}
      <div className="relative h-[560px] w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-900">
        {webglUnsupported || contextLost ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-200 space-y-3">
            <Layers className="h-8 w-8 text-sky-400" />
            <p className="text-sm font-semibold">
              {contextLost
                ? '3D Graphics Context Suspended'
                : '2D Architectural Fallback View'}
            </p>
            <p className="max-w-md text-xs text-slate-400">
              {webglUnsupported ||
                'Hardware WebGL context was reclaimed by the browser. Reload the tab or switch hardware acceleration.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl w-full pt-2 text-left">
              <div className="rounded border border-slate-700 bg-slate-800 p-3">
                <p className="text-xs font-semibold text-sky-300">LORA-GW-01 Tower</p>
                <p className="text-[11px] text-slate-300 mt-1">868 MHz Solar Repeater · 94% LiFePO4</p>
              </div>
              <div className="rounded border border-slate-700 bg-slate-800 p-3">
                <p className="text-xs font-semibold text-amber-300">Pothole CF-2026-0421</p>
                <p className="text-[11px] text-slate-300 mt-1">1.2m cavity adjacent to culvert #W1-14</p>
              </div>
              <div className="rounded border border-slate-700 bg-slate-800 p-3">
                <p className="text-xs font-semibold text-emerald-300">AND-BLE-104 Peer</p>
                <p className="text-[11px] text-slate-300 mt-1">2-hop BLE relay active</p>
              </div>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}

        {/* Top-Left Compact Inspected Part Readout (no backdrop-filter over WebGL) */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-sm rounded-md border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-white">
          <p className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
            {inspectedPart.subsystem}
          </p>
          <p className="text-xs font-semibold mt-0.5">{inspectedPart.name}</p>
          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
            {inspectedPart.detail}
          </p>
        </div>

        {/* Collapsible Bottom Control Dock (<= 15% height, solid opaque dark surface) */}
        <div className="absolute bottom-3 left-3 right-3 z-10 rounded-md border border-slate-700 bg-slate-950/95 px-3 py-2 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-sky-400 mr-1" />
              {!dockCollapsed &&
                CAMERA_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      activePreset === preset.id
                        ? 'bg-[#0f4c81] text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-2">
              {!dockCollapsed && (
                <>
                  <button
                    type="button"
                    onClick={() => setStreetlightOn((v) => !v)}
                    className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                  >
                    Streetlight: {streetlightOn ? 'ON' : 'FAULT'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeshPulseActive((v) => !v)}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                  >
                    <Radio className="h-3 w-3 text-sky-400" />
                    RF Relay: {meshPulseActive ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setDockCollapsed((c) => !c)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Toggle 3D controls dock"
              >
                {dockCollapsed ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
