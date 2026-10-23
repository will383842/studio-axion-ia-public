/**
 * OBJETS 3D DE L'EFFET « OBJET DANS LA MAIN » (lot F3) : géométries simples générées (aucune ressource externe),
 * charte Axion (orange #C65A2E, crème #F6EEE0, sombre chaud #16120F). Chaque objet tient dans un diamètre de 1 :
 * la composition le met à l'échelle de la paume. Le logo Axion = la tuile orange arrondie, le « A » crème et le
 * point, extrudés et biseautés.
 */
import type { ObjetMain } from "../../../../src/briques/effets-speciaux/types";
import type { Trois } from "./trois";

const ORANGE = "#C65A2E";
const ORANGE_VIF = "#E07040";
const CREME = "#F6EEE0";
const SOMBRE = "#16120F";

/** Rectangle arrondi (centré). */
function rectangleArrondi(T: Trois, l: number, h: number, r: number) {
  const s = new T.Shape();
  const x = -l / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + l - r, y);
  s.quadraticCurveTo(x + l, y, x + l, y + r);
  s.lineTo(x + l, y + h - r);
  s.quadraticCurveTo(x + l, y + h, x + l - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Le « A » géométrique du logo (jambages épais, contre-forme triangulaire), hauteur ≈ 0,62. */
function formeA(T: Trois, k = 1) {
  const s = new T.Shape();
  const p = (x: number, y: number) => [x * k, y * k] as const;
  s.moveTo(...p(-0.3, -0.31));
  s.lineTo(...p(-0.075, 0.31));
  s.lineTo(...p(0.075, 0.31));
  s.lineTo(...p(0.3, -0.31));
  s.lineTo(...p(0.165, -0.31));
  s.lineTo(...p(0.118, -0.175));
  s.lineTo(...p(-0.118, -0.175));
  s.lineTo(...p(-0.165, -0.31));
  s.closePath();
  const trou = new T.Path();
  trou.moveTo(...p(-0.073, -0.06));
  trou.lineTo(...p(0, 0.16));
  trou.lineTo(...p(0.073, -0.06));
  trou.closePath();
  s.holes.push(trou);
  return s;
}

function extruder(T: Trois, forme: unknown, profondeur: number, biseau: number) {
  const g = new T.ExtrudeGeometry(forme, { depth: profondeur, bevelEnabled: true, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 5, curveSegments: 24 });
  g.center();
  g.computeVertexNormals();
  return g;
}

function matiere(T: Trois, couleur: string, o: { rugosite?: number; metal?: number; vernis?: number; emissif?: string; intensiteEmissive?: number } = {}) {
  return new T.MeshPhysicalMaterial({
    color: new T.Color(couleur),
    roughness: o.rugosite ?? 0.34,
    metalness: o.metal ?? 0.08,
    clearcoat: o.vernis ?? 0.9,
    clearcoatRoughness: 0.16,
    ...(o.emissif ? { emissive: new T.Color(o.emissif), emissiveIntensity: o.intensiteEmissive ?? 0.4 } : {}),
  });
}

function ombres(objet: { traverse: (f: (o: { isMesh?: boolean; castShadow?: boolean }) => void) => void }) {
  objet.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
}

/** Écran du téléphone : fond sombre chaud, halo orange, logo et lignes de texte suggérées (canevas local). */
function texturEcran(T: Trois) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  const fond = g.createLinearGradient(0, 0, 0, 512);
  fond.addColorStop(0, "#211A15");
  fond.addColorStop(1, SOMBRE);
  g.fillStyle = fond;
  g.fillRect(0, 0, 256, 512);
  const halo = g.createRadialGradient(128, 200, 10, 128, 200, 190);
  halo.addColorStop(0, "rgba(224,112,64,0.85)");
  halo.addColorStop(1, "rgba(224,112,64,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, 256, 512);
  // Tuile du logo.
  g.fillStyle = ORANGE;
  g.beginPath();
  g.roundRect(78, 150, 100, 100, 24);
  g.fill();
  g.fillStyle = CREME;
  g.beginPath();
  g.moveTo(98, 228);
  g.lineTo(122, 166);
  g.lineTo(134, 166);
  g.lineTo(158, 228);
  g.lineTo(146, 228);
  g.lineTo(141, 214);
  g.lineTo(115, 214);
  g.lineTo(110, 228);
  g.closePath();
  g.moveTo(119, 202);
  g.lineTo(137, 202);
  g.lineTo(128, 178);
  g.closePath();
  g.fill("evenodd");
  g.beginPath();
  g.arc(166, 162, 5, 0, Math.PI * 2);
  g.fill();
  // Lignes de texte et bouton.
  g.fillStyle = "rgba(246,238,224,0.85)";
  g.beginPath();
  g.roundRect(58, 290, 140, 14, 7);
  g.fill();
  g.fillStyle = "rgba(246,238,224,0.4)";
  g.beginPath();
  g.roundRect(78, 316, 100, 10, 5);
  g.fill();
  g.fillStyle = ORANGE_VIF;
  g.beginPath();
  g.roundRect(64, 400, 128, 40, 20);
  g.fill();
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** Construit l'objet (groupe centré, diamètre ≈ 1, face avant vers la caméra +z). */
export function construireObjet(T: Trois, objet: ObjetMain) {
  const groupe = new T.Group();
  switch (objet) {
    case "logo-axion": {
      const tuile = new T.Mesh(extruder(T, rectangleArrondi(T, 0.82, 0.82, 0.2), 0.16, 0.045), matiere(T, ORANGE, { rugosite: 0.3, vernis: 1 }));
      const a = new T.Mesh(extruder(T, formeA(T, 0.92), 0.05, 0.014), matiere(T, CREME, { rugosite: 0.42, vernis: 0.5 }));
      a.position.z = 0.135;
      a.position.y = -0.02;
      const point = new T.Mesh(new T.SphereGeometry(0.045, 32, 16), matiere(T, CREME, { rugosite: 0.4 }));
      point.scale.z = 0.6;
      point.position.set(0.27, 0.27, 0.13);
      groupe.add(tuile, a, point);
      break;
    }
    case "telephone": {
      const corps = new T.Mesh(extruder(T, rectangleArrondi(T, 0.5, 1, 0.09), 0.055, 0.02), matiere(T, SOMBRE, { rugosite: 0.25, metal: 0.6, vernis: 1 }));
      const image = texturEcran(T);
      const ecran = new T.Mesh(new T.PlaneGeometry(0.455, 0.94), new T.MeshStandardMaterial({ map: image, emissive: new T.Color("#FFFFFF"), emissiveMap: image, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0 }));
      ecran.position.z = 0.0485;
      groupe.add(corps, ecran);
      groupe.scale.setScalar(0.95);
      break;
    }
    case "cube": {
      const cube = new T.Mesh(extruder(T, rectangleArrondi(T, 0.58, 0.58, 0.1), 0.5, 0.04), matiere(T, ORANGE, { rugosite: 0.32 }));
      const a = new T.Mesh(extruder(T, formeA(T, 0.62), 0.03, 0.01), matiere(T, CREME, { rugosite: 0.45 }));
      a.position.z = 0.3;
      groupe.add(cube, a);
      break;
    }
    case "sphere": {
      const boule = new T.Mesh(new T.SphereGeometry(0.36, 64, 32), matiere(T, ORANGE, { rugosite: 0.22, vernis: 1 }));
      const anneau = new T.Mesh(new T.TorusGeometry(0.5, 0.018, 16, 96), matiere(T, CREME, { rugosite: 0.35 }));
      anneau.rotation.x = Math.PI / 2.4;
      groupe.add(boule, anneau);
      break;
    }
    case "piece": {
      const disque = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.08, 96, 1), matiere(T, ORANGE_VIF, { metal: 0.85, rugosite: 0.28, vernis: 0.6 }));
      disque.rotation.x = Math.PI / 2;
      const bord = new T.Mesh(new T.TorusGeometry(0.42, 0.02, 12, 96), matiere(T, ORANGE, { metal: 0.9, rugosite: 0.3 }));
      bord.position.z = 0.04;
      const a = new T.Mesh(extruder(T, formeA(T, 0.75), 0.02, 0.008), matiere(T, CREME, { metal: 0.3, rugosite: 0.35 }));
      a.position.z = 0.055;
      const dos = a.clone();
      dos.position.z = -0.055;
      dos.rotation.y = Math.PI;
      groupe.add(disque, bord, a, dos);
      break;
    }
    case "etoile": {
      const s = new T.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.2 : 0.48;
        const a = Math.PI / 2 + (i * Math.PI) / 5;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.closePath();
      groupe.add(new T.Mesh(extruder(T, s, 0.12, 0.05), matiere(T, ORANGE, { rugosite: 0.28 })));
      break;
    }
    case "coeur": {
      const s = new T.Shape();
      s.moveTo(0, -0.42);
      s.bezierCurveTo(-0.08, -0.32, -0.46, -0.06, -0.46, 0.14);
      s.bezierCurveTo(-0.46, 0.34, -0.3, 0.44, -0.18, 0.44);
      s.bezierCurveTo(-0.08, 0.44, -0.02, 0.38, 0, 0.3);
      s.bezierCurveTo(0.02, 0.38, 0.08, 0.44, 0.18, 0.44);
      s.bezierCurveTo(0.3, 0.44, 0.46, 0.34, 0.46, 0.14);
      s.bezierCurveTo(0.46, -0.06, 0.08, -0.32, 0, -0.42);
      groupe.add(new T.Mesh(extruder(T, s, 0.16, 0.06), matiere(T, ORANGE, { rugosite: 0.26 })));
      break;
    }
  }
  ombres(groupe);
  return groupe;
}
