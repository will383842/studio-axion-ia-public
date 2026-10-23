/**
 * EFFET « OBJET 3D DANS LA MAIN » (lot F3) : la piste montée, et par-dessus un objet 3D (Three.js, WebGL logiciel)
 * posé sur la paume. Les poses sont calculées d'avance par la brique `effets-speciaux` (suivi MediaPipe Hands,
 * lissage sans retard, visage jamais caché) : ici, on ne fait que dessiner l'image demandée — rendu déterministe.
 *
 * Lumière accordée à la prise : direction, teinte et intensité de la lumière principale lues sur le visage ; ombre
 * portée de l'objet sur la paume (plan qui ne reçoit que l'ombre) ; reflet orange de l'objet sur la main.
 * Apparition : éclat (flash, onde, étincelles étirées par le mouvement) ; disparition : l'objet se résorbe.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Img, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import type { Lumiere, PoseObjet, ProprietesEffetObjetMain } from "../../../../src/briques/effets-speciaux/types";
import { construireObjet } from "./objets";
import { ObjetSurPaume } from "./ObjetSurPaume";
import { trois, type Trois } from "./trois";

const ORANGE_VIF = "#E07040";
const CREME = "#F6EEE0";

/** Hasard déterministe 0-1. */
const hasard = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const u01 = (v: number) => Math.min(1, Math.max(0, v));
const sortieExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * u01(x)));

/** Environnement de reflets (studio chaud) : lumière principale dans la direction mesurée, contre-jour orange. */
function environnement(T: Trois, rendu: Trois, l: Lumiere) {
  const scene = new T.Scene();
  const ciel = new T.Mesh(
    new T.SphereGeometry(50, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      uniforms: { haut: { value: new T.Color(l.teinte).multiplyScalar(0.55) }, bas: { value: new T.Color(l.ambiance).multiplyScalar(0.5) } },
      vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 haut; uniform vec3 bas; varying vec3 p; void main(){ gl_FragColor = vec4(mix(bas, haut, smoothstep(-0.6, 0.8, p.y)), 1.0); }",
    }),
  );
  scene.add(ciel);
  const panneau = (couleur: string, force: number, x: number, y: number, z: number, taille: number) => {
    const m = new T.Mesh(new T.PlaneGeometry(taille, taille), new T.MeshBasicMaterial({ color: new T.Color(couleur).multiplyScalar(force), side: T.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panneau(l.teinte, 3.2 * l.intensite, l.directionX * 30, 20 + l.directionY * 18, 30, 26);
  panneau(ORANGE_VIF, 1.6, -l.directionX * 34, 6, -24, 22);
  panneau(CREME, 0.9, 0, -30, 20, 30);
  const pmrem = new T.PMREMGenerator(rendu);
  const env = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  return env;
}

interface Scene3D {
  T: Trois;
  rendu: Trois;
  scene: Trois;
  camera: Trois;
  objet: Trois;
  soleil: Trois;
  capteur: Trois;
}

function creerScene(canevas: HTMLCanvasElement, p: ProprietesEffetObjetMain): Scene3D {
  const T = trois();
  const rendu = new T.WebGLRenderer({ canvas: canevas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  rendu.setPixelRatio(1);
  rendu.setSize(p.largeur, p.hauteur, false);
  rendu.setClearColor(0x000000, 0);
  rendu.outputColorSpace = T.SRGBColorSpace;
  rendu.toneMapping = T.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.environment = environnement(T, rendu, p.lumiere);
  // Caméra : 1 unité = 1 pixel dans le plan z = 0 (l'objet se place en pixels de l'image).
  const fov = 24;
  const camera = new T.PerspectiveCamera(fov, p.largeur / p.hauteur, 10, 40000);
  camera.position.set(0, 0, p.hauteur / 2 / Math.tan((fov * Math.PI) / 360));
  camera.lookAt(0, 0, 0);
  const l = p.lumiere;
  const soleil = new T.DirectionalLight(new T.Color(l.teinte), 2.6 * l.intensite);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  soleil.shadow.radius = 6;
  soleil.shadow.bias = -0.0004;
  scene.add(soleil, soleil.target);
  scene.add(new T.HemisphereLight(new T.Color(l.teinte), new T.Color(l.ambiance), 0.55 * l.intensite));
  const contre = new T.DirectionalLight(new T.Color(ORANGE_VIF), 0.9);
  contre.position.set(-l.directionX * 600, 200, -500);
  scene.add(contre);
  const objet = construireObjet(T, p.objet);
  scene.add(objet);
  // Capteur d'ombre : un disque sur la paume, invisible, qui ne montre que l'ombre de l'objet.
  const capteur = new T.Mesh(new T.CircleGeometry(1, 48), new T.ShadowMaterial({ opacity: 0.42, transparent: true }));
  capteur.receiveShadow = true;
  scene.add(capteur);
  return { T, rendu, scene, camera, objet, soleil, capteur };
}

function poserScene(s: Scene3D, pose: PoseObjet, p: ProprietesEffetObjetMain) {
  const { objet, soleil, capteur } = s;
  const x = pose.x - p.largeur / 2;
  const y = p.hauteur / 2 - pose.y;
  const echelle = Math.max(0.0001, pose.taille * pose.visible);
  objet.visible = pose.visible > 0.001;
  objet.position.set(x, y, pose.taille * 0.15);
  objet.scale.setScalar(echelle);
  objet.rotation.set(pose.rotX, pose.rotY, pose.rotZ);
  // Lumière principale : direction mesurée sur la prise, ombre serrée autour de l'objet.
  const l = p.lumiere;
  const dir = new s.T.Vector3(l.directionX * 0.8, 0.35 + l.directionY * 0.65, 0.9).normalize();
  soleil.position.set(x + dir.x * pose.taille * 6, y + dir.y * pose.taille * 6, dir.z * pose.taille * 6);
  soleil.target.position.set(x, y, 0);
  const cam = soleil.shadow.camera;
  const r = pose.taille * 1.8;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = 1;
  cam.far = pose.taille * 14;
  cam.updateProjectionMatrix();
  // Capteur d'ombre : sur la paume, derrière l'objet, de la taille de la main.
  capteur.visible = objet.visible;
  capteur.position.set(pose.paumeX - p.largeur / 2, p.hauteur / 2 - pose.paumeY, -pose.taille * 0.35);
  capteur.scale.setScalar(pose.taille * 0.85);
  capteur.material.opacity = 0.42 * Math.min(1, pose.visible);
}

/** Éclat d'apparition et de disparition, reflet orange sur la paume (calques 2D, mélange « screen »). */
function Eclats({ pose, graine }: { pose: PoseObjet; graine: number }) {
  const elements: React.ReactNode[] = [];
  const T = pose.taille;
  if (pose.visible > 0.01) {
    // Reflet de l'objet sur la main : lumière orange douce sur la paume.
    elements.push(
      <div
        key="reflet"
        style={{
          position: "absolute",
          left: pose.paumeX - T * 0.9,
          top: pose.paumeY - T * 0.75,
          width: T * 1.8,
          height: T * 1.5,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, rgba(224,112,64,${(0.32 * Math.min(1, pose.visible)).toFixed(3)}), rgba(224,112,64,0))`,
          mixBlendMode: "screen",
        }}
      />,
    );
  }
  if (pose.eclat >= 0) {
    const e = pose.eclat;
    const flash = Math.max(0, 1 - e / 0.45) * Math.min(1, e / 0.06 + 0.25);
    const rf = T * (0.5 + 1.6 * sortieExpo(e * 1.4));
    elements.push(
      <div
        key="flash"
        style={{ position: "absolute", left: pose.x - rf, top: pose.y - rf, width: rf * 2, height: rf * 2, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(255,246,232,${(0.95 * flash).toFixed(3)}), rgba(224,112,64,${(0.55 * flash).toFixed(3)}) 45%, rgba(224,112,64,0))`, mixBlendMode: "screen" }}
      />,
    );
    const ro = T * (0.35 + 1.5 * sortieExpo(e));
    const ao = Math.max(0, 1 - e);
    elements.push(
      <svg key="onde" style={{ position: "absolute", left: pose.x - ro - 20, top: pose.y - ro - 20, overflow: "visible" }} width={ro * 2 + 40} height={ro * 2 + 40}>
        <circle cx={ro + 20} cy={ro + 20} r={ro} fill="none" stroke={ORANGE_VIF} strokeOpacity={ao * 0.9} strokeWidth={Math.max(0.5, 10 * ao)} style={{ filter: "blur(1.5px)" }} />
        <circle cx={ro + 20} cy={ro + 20} r={ro * 0.92} fill="none" stroke={CREME} strokeOpacity={ao * 0.6} strokeWidth={Math.max(0.5, 3 * ao)} />
      </svg>,
    );
    // Étincelles : traits étirés dans le sens du mouvement (flou de mouvement), ralentis par la traîne.
    const traits: React.ReactNode[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + hasard(graine + i) * 0.5;
      const v = 0.8 + hasard(graine * 3 + i) * 1.1;
      const d = T * (0.3 + v * 1.25 * sortieExpo(e * 1.2));
      const d0 = T * (0.3 + v * 1.25 * sortieExpo(Math.max(0, e - 0.07) * 1.2));
      const alpha = Math.max(0, 1 - e * (1.1 + hasard(graine + i * 7) * 0.6));
      if (alpha <= 0) continue;
      const couleur = i % 3 === 0 ? CREME : ORANGE_VIF;
      traits.push(<line key={i} x1={Math.cos(a) * d0} y1={Math.sin(a) * d0} x2={Math.cos(a) * d} y2={Math.sin(a) * d} stroke={couleur} strokeOpacity={alpha} strokeWidth={T * 0.018 + 2} strokeLinecap="round" />);
    }
    elements.push(
      <svg key="etincelles" style={{ position: "absolute", left: pose.x, top: pose.y, overflow: "visible", mixBlendMode: "screen" }} width={1} height={1}>
        {traits}
      </svg>,
    );
  }
  if (pose.fuite >= 0) {
    const f = pose.fuite;
    const alpha = Math.sin(Math.PI * u01(f));
    const traits: React.ReactNode[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + hasard(graine * 5 + i);
      const d = T * (0.75 - 0.6 * f);
      traits.push(<circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={T * 0.02 + 2} fill={i % 2 ? CREME : ORANGE_VIF} fillOpacity={alpha} />);
    }
    elements.push(
      <svg key="fuite" style={{ position: "absolute", left: pose.x, top: pose.y, overflow: "visible", mixBlendMode: "screen" }} width={1} height={1}>
        {traits}
      </svg>,
    );
  }
  return <>{elements}</>;
}

function Objet3D(p: ProprietesEffetObjetMain) {
  const image = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [attente] = useState(() => delayRender("Objet 3D : préparation de la scène"));
  const pose = p.poses[Math.min(image, p.poses.length - 1)];
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (!scene.current) scene.current = creerScene(ref.current, p);
    const s = scene.current;
    poserScene(s, pose, p);
    s.rendu.render(s.scene, s.camera);
  });
  useEffect(() => {
    continueRender(attente);
  }, [attente]);
  return <canvas ref={ref} width={p.largeur} height={p.hauteur} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

export function EffetObjetMain(p: ProprietesEffetObjetMain) {
  const image = useCurrentFrame();
  const pose = p.poses[Math.min(image, p.poses.length - 1)];
  const graine = useMemo(() => Math.round((p.poses[0]?.rotY ?? 0) * 1000) % 997, [p.poses]);
  const surPaume = useMemo(() => p.poses.some((x) => x.surPaume), [p.poses]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#16120F" }}>
      {p.sourceImage ? (
        <Img src={p.source} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Sequence from={0} layout="none">
          <OffthreadVideo src={p.source} startFrom={p.debutSourceImage} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      )}
      {/* Lot I2 : avec les 21 points de la main, l'objet REPOSE sur la paume (rendu photoréaliste). */}
      {surPaume ? (
        <ObjetSurPaume {...p} />
      ) : (
        <>
          <AbsoluteFill>{pose ? <Eclats pose={pose} graine={graine} /> : null}</AbsoluteFill>
          <Objet3D {...p} />
        </>
      )}
    </AbsoluteFill>
  );
}
