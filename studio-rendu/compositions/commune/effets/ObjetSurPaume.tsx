/**
 * OBJET POSÉ SUR LA PAUME, RENDU PHOTORÉALISTE (lot I2). Les poses (contact, orientation complète, doigts devant)
 * viennent de la brique `effets-speciaux` (21 points MediaPipe) ; ici on ne fait que dessiner l'image demandée,
 * image par image (déterministe).
 *
 * Chaîne de rendu, pour que l'objet ne paraisse pas « collé » :
 *   1. Three.js (WebGL logiciel), matériaux physiques, reflets tirés de l'IMAGE DE LA PRISE (carte d'environnement),
 *      lumière principale dans la direction et à la température mesurées, ombre portée douce + ombre de contact ;
 *   2. rendu limité à une boîte autour de l'objet, SURÉCHANTILLONNÉ (2× par défaut) puis réduit (antialiasing) ;
 *   3. flou de mouvement : plusieurs sous-instants sur l'obturateur (180°) quand la main bouge vite ;
 *   4. profondeur de champ : le flou mesuré sur la prise autour de la main ;
 *   5. grain : bruit déterministe de l'écart type mesuré sur la prise, posé sur les seuls pixels de l'objet ;
 *   6. doigts et pouce au premier plan : la vraie image est remise par-dessus, bords adoucis.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Img, OffthreadVideo, useCurrentFrame } from "remotion";
import { elevationSurPaume } from "../../../../src/briques/effets-speciaux/main";
import type { CapsulePx, CarteEnvironnement, Lumiere, PoseObjet, ProprietesEffetObjetMain } from "../../../../src/briques/effets-speciaux/types";
import { construireLogo, construireTelephone, dessinerEcran } from "./objets-realistes";
import { construireObjet } from "./objets";
import { trois, type Trois } from "./trois";

const u01 = (v: number) => Math.min(1, Math.max(0, v));

/** Direction de la lumière principale dans la scène (x droite, y haut, z vers la caméra). */
function directionLumiere(l: Lumiere): [number, number, number] {
  const v: [number, number, number] = [l.directionX * 0.8, 0.35 + l.directionY * 0.65, 0.75];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Couleur RVB (0-1) d'une température de couleur (approximation de Tanner Helland). */
function couleurTemperature(k: number): [number, number, number] {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [r, g, b].map((v) => u01(v / 255)) as [number, number, number];
}

/**
 * Environnement HDR : la carte tirée de la prise (ou, à défaut, un dégradé d'après la lumière mesurée), plus la
 * source principale (fenêtre, lampe) dans la direction mesurée, à sa température : elle donne les reflets nets
 * du verre et du métal.
 */
function environnement(T: Trois, rendu: Trois, l: Lumiere, carte?: CarteEnvironnement) {
  const L = carte?.largeur ?? 64;
  const H = carte?.hauteur ?? 32;
  const donnees = new Float32Array(L * H * 4);
  const haut = new T.Color(l.teinte);
  const bas = new T.Color(l.ambiance);
  const [lx, ly, lz] = directionLumiere(l);
  const chaud = couleurTemperature(l.temperatureK ?? 5000);
  for (let j = 0; j < H; j++) {
    const lat = ((j + 0.5) / H - 0.5) * Math.PI;
    for (let i = 0; i < L; i++) {
      const lon = ((i + 0.5) / L - 0.5) * 2 * Math.PI;
      const dx = Math.cos(lat) * Math.cos(lon);
      const dz = Math.cos(lat) * Math.sin(lon);
      const dy = Math.sin(lat);
      const k = (j * L + i) * 4;
      let r: number, g: number, b: number;
      if (carte) {
        const p = (j * L + i) * 3;
        // Pixels sRGB → linéaires.
        const lin = (c: number) => Math.pow(c / 255, 2.2);
        r = lin(carte.pixels[p]);
        g = lin(carte.pixels[p + 1]);
        b = lin(carte.pixels[p + 2]);
      } else {
        const m = u01((dy + 0.6) / 1.4);
        r = (bas.r + (haut.r - bas.r) * m) * 0.5;
        g = (bas.g + (haut.g - bas.g) * m) * 0.5;
        b = (bas.b + (haut.b - bas.b) * m) * 0.5;
      }
      // Source principale : une « fenêtre » douce et lumineuse (HDR) dans la direction mesurée.
      const c = dx * lx + dy * ly + dz * lz;
      const tache = Math.pow(u01((c - 0.82) / 0.18), 1.6) * 7 * l.intensite;
      donnees[k] = r + tache * chaud[0];
      donnees[k + 1] = g + tache * chaud[1];
      donnees[k + 2] = b + tache * chaud[2];
      donnees[k + 3] = 1;
    }
  }
  const tex = new T.DataTexture(donnees, L, H, T.RGBAFormat, T.FloatType);
  tex.mapping = T.EquirectangularReflectionMapping;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearFilter;
  tex.needsUpdate = true;
  const pmrem = new T.PMREMGenerator(rendu);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/** Ombre de contact : tache sombre très douce, posée sur la paume sous l'objet. */
function textureContact(T: Trois) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  d.addColorStop(0, "rgba(0,0,0,0.85)");
  d.addColorStop(0.45, "rgba(0,0,0,0.45)");
  d.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = d;
  g.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

interface Scene3D {
  T: Trois;
  rendu: Trois;
  scene: Trois;
  camera: Trois;
  objet: Trois;
  soleil: Trois;
  capteur: Trois;
  contact: Trois;
  boite: number;
  ss: number;
}

/** Taille (px) de la boîte de rendu : fixe sur tout le passage (aucune réallocation image par image). */
function tailleBoite(poses: PoseObjet[]): number {
  const max = poses.reduce((m, p) => Math.max(m, p.taille), 0);
  return Math.ceil(Math.max(64, max * 1.9) / 2) * 2;
}

function creerScene(canevas: HTMLCanvasElement, p: ProprietesEffetObjetMain): Scene3D {
  const T = trois();
  const ss = Math.min(3, Math.max(1, p.surEchantillonnage ?? 2));
  const boite = tailleBoite(p.poses);
  const rendu = new T.WebGLRenderer({ canvas: canevas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  rendu.setPixelRatio(1);
  rendu.setSize(boite * ss, boite * ss, false);
  rendu.setClearColor(0x000000, 0);
  rendu.outputColorSpace = T.SRGBColorSpace;
  rendu.toneMapping = T.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 0.95 + 0.1 * (p.lumiere.intensite - 1);
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.environment = environnement(T, rendu, p.lumiere, p.environnement);
  // Caméra de la prise : 1 unité = 1 pixel dans le plan z = 0 ; on n'en rend qu'une fenêtre (setViewOffset).
  const fov = 24;
  const camera = new T.PerspectiveCamera(fov, p.largeur / p.hauteur, 10, 40000);
  camera.position.set(0, 0, p.hauteur / 2 / Math.tan((fov * Math.PI) / 360));
  camera.lookAt(0, 0, 0);
  const l = p.lumiere;
  const [r, g, b] = couleurTemperature(l.temperatureK ?? 5000);
  const soleil = new T.DirectionalLight(new T.Color(r, g, b), 2.2 * l.intensite);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  soleil.shadow.radius = 8;
  soleil.shadow.blurSamples = 16;
  soleil.shadow.bias = -0.0005;
  soleil.shadow.normalBias = 0.02;
  scene.add(soleil, soleil.target);
  scene.add(new T.HemisphereLight(new T.Color(l.teinte), new T.Color(l.ambiance), 0.35 * l.intensite));
  const objet = new T.Group();
  const corps = p.objet === "telephone" ? construireTelephone(T, dessinerEcran(), rendu.capabilities.getMaxAnisotropy()) : p.objet === "logo-axion" ? construireLogo(T) : construireObjet(T, p.objet);
  objet.add(corps);
  scene.add(objet);
  // Ombre portée (douce) et ombre de contact, sur le plan de la paume.
  const capteur = new T.Mesh(new T.CircleGeometry(1, 48), new T.ShadowMaterial({ opacity: 0.38, transparent: true }));
  capteur.receiveShadow = true;
  scene.add(capteur);
  const contact = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: textureContact(T), transparent: true, depthWrite: false, opacity: 0.55, color: new T.Color("#000000") }));
  scene.add(contact);
  return { T, rendu, scene, camera, objet, soleil, capteur, contact, boite, ss };
}

/** Place l'objet pour une pose (décalage `dx`, `dy` en px pour les sous-instants du flou de mouvement). */
function poserScene(s: Scene3D, pose: PoseObjet, p: ProprietesEffetObjetMain, dx = 0, dy = 0) {
  const { T, objet, soleil, capteur, contact } = s;
  const sp = pose.surPaume!;
  const x = pose.x + dx - p.largeur / 2;
  const y = p.hauteur / 2 - (pose.y + dy);
  const n = new T.Vector3(...sp.normale);
  const taille = pose.taille;
  const elevation = elevationSurPaume(p.objet, sp.inclinaison) * taille;
  objet.position.set(x + n.x * elevation, y + n.y * elevation, n.z * elevation);
  const q = new T.Quaternion(...sp.quaternion);
  const micro = new T.Quaternion().setFromEuler(new T.Euler(pose.rotX, pose.rotY, pose.rotZ));
  objet.quaternion.copy(q.multiply(micro));
  objet.scale.setScalar(taille);
  // Plan de la paume : orienté par sa normale, au point de contact.
  const plan = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), n);
  capteur.position.set(x, y, 0);
  capteur.quaternion.copy(plan);
  capteur.scale.setScalar(taille * 0.6);
  contact.position.set(x + n.x * 0.5, y + n.y * 0.5, n.z * 0.5);
  contact.quaternion.copy(plan);
  const portee = p.objet === "telephone" ? [taille * 0.62, taille * 1.05] : [taille * 0.8, taille * 0.8];
  contact.scale.set(portee[0], portee[1], 1);
  // L'ombre de contact suit le grand côté du téléphone.
  if (p.objet === "telephone") {
    const haut = new T.Vector3(0, 1, 0).applyQuaternion(objet.quaternion);
    const local = haut.clone().applyQuaternion(plan.clone().invert());
    contact.rotateZ(Math.atan2(local.y, local.x) - Math.PI / 2);
  }
  const [lx, ly, lz] = directionLumiere(p.lumiere);
  const d = taille * 5;
  soleil.position.set(objet.position.x + lx * d, objet.position.y + ly * d, objet.position.z + lz * d);
  soleil.target.position.copy(objet.position);
  const cam = soleil.shadow.camera;
  cam.left = -taille * 1.2;
  cam.right = taille * 1.2;
  cam.top = taille * 1.2;
  cam.bottom = -taille * 1.2;
  cam.near = 1;
  cam.far = d * 2.5;
  cam.updateProjectionMatrix();
}

/** Grain déterministe (écart type `sigma`, 0-255) ajouté aux seuls pixels de l'objet (pondéré par leur opacité). */
function ajouterGrain(g: CanvasRenderingContext2D, l: number, h: number, sigma: number, graine: number) {
  if (sigma <= 0.2) return;
  const img = g.getImageData(0, 0, l, h);
  const d = img.data;
  let etat = (graine * 2654435761) >>> 0 || 1;
  const alea = () => {
    etat ^= etat << 13;
    etat ^= etat >>> 17;
    etat ^= etat << 5;
    etat >>>= 0;
    return etat / 4294967296;
  };
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) {
      alea();
      alea();
      continue;
    }
    // Bruit gaussien (Box-Muller), luminance commune + un peu de chroma, comme un capteur.
    const u = Math.max(1e-6, alea());
    const v = alea();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma * (a / 255);
    d[i] = Math.max(0, Math.min(255, d[i] + n * 1.02));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.97));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 1.05));
  }
  g.putImageData(img, 0, 0);
}

/** Masque SVG des doigts au premier plan (bords adoucis), en image de données pour `mask-image`. */
function masqueDoigts(capsules: CapsulePx[], l: number, h: number): string {
  const flou = Math.max(1.5, capsules.reduce((m, c) => Math.max(m, c.r), 0) * 0.22);
  const traits = capsules.map((c) => `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="#fff" stroke-width="${(c.r * 2).toFixed(1)}" stroke-linecap="round"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}"><defs><filter id="f" filterUnits="userSpaceOnUse" x="0" y="0" width="${l}" height="${h}"><feGaussianBlur stdDeviation="${flou.toFixed(1)}"/></filter></defs><g filter="url(#f)">${traits}</g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/** Léger éclat à l'apparition : une petite étoile de lumière qui glisse sur l'arête de l'objet. */
function Eclat({ pose }: { pose: PoseObjet }) {
  if (pose.eclat < 0 || pose.eclat > 1) return null;
  const e = pose.eclat;
  const a = Math.sin(Math.PI * u01(e)) * 0.85;
  const t = pose.taille * (0.12 + 0.06 * Math.sin(Math.PI * e));
  const x = pose.x + pose.taille * (-0.22 + 0.44 * e);
  const y = pose.y - pose.taille * (0.18 + 0.1 * e);
  return (
    <svg style={{ position: "absolute", left: x - t, top: y - t, mixBlendMode: "screen", overflow: "visible" }} width={t * 2} height={t * 2}>
      <defs>
        <radialGradient id="halo-eclat">
          <stop offset="0" stopColor="#FFF8EE" stopOpacity={a} />
          <stop offset="1" stopColor="#FFE2C8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={t} cy={t} r={t * 0.55} fill="url(#halo-eclat)" />
      <path d={`M ${t} 0 Q ${t * 1.04} ${t * 0.96} ${t * 2} ${t} Q ${t * 1.04} ${t * 1.04} ${t} ${t * 2} Q ${t * 0.96} ${t * 1.04} 0 ${t} Q ${t * 0.96} ${t * 0.96} ${t} 0 Z`} fill="#FFFDF8" fillOpacity={a} />
    </svg>
  );
}

export function ObjetSurPaume(p: ProprietesEffetObjetMain) {
  const image = useCurrentFrame();
  const gl = useRef<HTMLCanvasElement>(null);
  const sortie = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [attente] = useState(() => delayRender("Objet posé : préparation de la scène"));
  const pose = p.poses[Math.min(image, p.poses.length - 1)];
  const boite = useMemo(() => tailleBoite(p.poses), [p.poses]);
  const visible = !!pose && !!pose.surPaume && pose.visible > 0.002;
  const bx = pose ? Math.round(pose.x - boite / 2) : 0;
  const by = pose ? Math.round(pose.y - boite / 2) : 0;
  useLayoutEffect(() => {
    if (!gl.current || !sortie.current || !pose) return;
    const g = sortie.current.getContext("2d")!;
    g.clearRect(0, 0, boite, boite);
    if (!visible) return;
    if (!scene.current) scene.current = creerScene(gl.current, p);
    const s = scene.current;
    s.camera.setViewOffset(p.largeur, p.hauteur, bx, by, boite, boite);
    s.camera.updateProjectionMatrix();
    // Flou de mouvement : obturateur à 180°, sous-instants répartis sur la demi-image écoulée.
    const vx = pose.surPaume!.vitesseX;
    const vy = pose.surPaume!.vitesseY;
    const n = Math.max(1, Math.min(5, Math.ceil(Math.hypot(vx, vy) / 5)));
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.globalCompositeOperation = n > 1 ? "lighter" : "source-over";
    for (let k = 0; k < n; k++) {
      const f = n > 1 ? -0.5 * (k / (n - 1)) : 0;
      poserScene(s, pose, p, vx * f, vy * f);
      s.rendu.render(s.scene, s.camera);
      g.globalAlpha = 1 / n;
      g.drawImage(gl.current, 0, 0, boite * s.ss, boite * s.ss, 0, 0, boite, boite);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    ajouterGrain(g, boite, boite, p.prise?.grain ?? 2.5, image + 1);
  });
  useEffect(() => {
    continueRender(attente);
  }, [attente]);
  const flou = Math.max(0, p.prise?.flouPx ?? 0);
  const doigts = visible ? pose!.surPaume!.doigts : [];
  return (
    <AbsoluteFill>
      <canvas ref={gl} width={boite * Math.min(3, Math.max(1, p.surEchantillonnage ?? 2))} height={boite * Math.min(3, Math.max(1, p.surEchantillonnage ?? 2))} style={{ display: "none" }} />
      <canvas
        ref={sortie}
        width={boite}
        height={boite}
        style={{ position: "absolute", left: bx, top: by, width: boite, height: boite, opacity: visible ? u01(pose!.visible) : 0, filter: flou > 0.3 ? `blur(${flou.toFixed(2)}px)` : undefined }}
      />
      {visible && doigts.length ? (
        <AbsoluteFill style={{ WebkitMaskImage: masqueDoigts(doigts, p.largeur, p.hauteur), WebkitMaskSize: "100% 100%", maskImage: masqueDoigts(doigts, p.largeur, p.hauteur), maskSize: "100% 100%" }}>
          {p.sourceImage ? (
            <Img src={p.source} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <OffthreadVideo src={p.source} startFrom={p.debutSourceImage} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </AbsoluteFill>
      ) : null}
      {visible ? <Eclat pose={pose!} /> : null}
    </AbsoluteFill>
  );
}
