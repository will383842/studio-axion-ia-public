/**
 * OBJETS RÉALISTES POSÉS SUR LA PAUME (lot I2) : un smartphone modélisé comme un vrai (proportions d'un téléphone
 * récent 71,5 × 147,6 × 8,25 mm, angles arrondis, cadre en métal brossé, verre avant et arrière, bloc photo à trois
 * objectifs, boutons latéraux, écran allumé avec un vrai contenu) et le logo Axion en objet physique (le « A » en métal
 * anodisé orange, poli et vernis, debout sur un petit socle en aluminium brossé). Matériaux physiques
 * (MeshPhysicalMaterial : métal, verre, vernis). Aucune ressource externe : géométries et écran générés ici.
 *
 * Repères locaux (hauteur totale = 1, origine au centre) :
 *   - téléphone : x = largeur, y = grand côté (haut de l'écran), z = normale de l'écran ;
 *   - logo : y = vers le haut (normale de la paume), z = face tournée vers la caméra.
 */
import type { Trois } from "./trois";

const ORANGE = "#C65A2E";
const ORANGE_VIF = "#E07040";
const CREME = "#F6EEE0";

/** Proportions d'un smartphone récent (hauteur = 1). */
export const TELEPHONE = { largeur: 71.5 / 147.6, epaisseur: 8.25 / 147.6, rayon: 0.074, bordEcran: 0.0115 } as const;

function rectangleArrondi(T: Trois, l: number, h: number, r: number) {
  const s = new T.Shape();
  const x = -l / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + l - r, y);
  s.absarc(x + l - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + l, y + h - r);
  s.absarc(x + l - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** UV d'une ShapeGeometry ramenées à 0-1 sur sa boîte (l × h centrée). */
function uvSurBoite(g: Trois, l: number, h: number) {
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / l + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

function ombres(objet: Trois) {
  objet.traverse((o: Trois) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Écran allumé                                                        */
/* ------------------------------------------------------------------ */

/** Icône d'application : carré arrondi dégradé, pictogramme simple. */
function icone(g: CanvasRenderingContext2D, x: number, y: number, t: number, haut: string, bas: string, dessin: (cx: number, cy: number, t: number) => void) {
  const d = g.createLinearGradient(x, y, x, y + t);
  d.addColorStop(0, haut);
  d.addColorStop(1, bas);
  g.fillStyle = d;
  g.beginPath();
  g.roundRect(x, y, t, t, t * 0.23);
  g.fill();
  g.save();
  dessin(x + t / 2, y + t / 2, t);
  g.restore();
}

/**
 * Contenu de l'écran (1 170 × 2 532, comme un vrai téléphone) : écran d'accueil sobre — fond chaud, heure et date,
 * widget Axion, grille d'icônes, dock, barre d'état et barre d'accueil. Lisible, sans marque tierce.
 */
export function dessinerEcran(): HTMLCanvasElement {
  const W = 1170;
  const H = 2532;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  // Fond d'écran : dégradé chaud profond, deux halos doux.
  const fond = g.createLinearGradient(0, 0, W * 0.3, H);
  fond.addColorStop(0, "#3A2318");
  fond.addColorStop(0.45, "#7A3A1E");
  fond.addColorStop(1, "#1B120E");
  g.fillStyle = fond;
  g.fillRect(0, 0, W, H);
  const halo = (x: number, y: number, r: number, couleur: string) => {
    const h = g.createRadialGradient(x, y, 0, x, y, r);
    h.addColorStop(0, couleur);
    h.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = h;
    g.fillRect(0, 0, W, H);
  };
  halo(W * 0.85, H * 0.32, 900, "rgba(240,140,80,0.55)");
  halo(W * 0.1, H * 0.8, 800, "rgba(198,90,46,0.35)");
  const police = (taille: number, graisse = 600) => `${graisse} ${taille}px Inter, "Helvetica Neue", Arial, sans-serif`;
  g.fillStyle = "#FFFFFF";
  g.textBaseline = "alphabetic";
  // Barre d'état.
  g.font = police(50, 600);
  g.textAlign = "left";
  g.fillText("9:41", 120, 112);
  // Batterie, réseau.
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.beginPath();
  g.roundRect(W - 196, 80, 86, 40, 11);
  g.strokeStyle = "rgba(255,255,255,0.6)";
  g.lineWidth = 4;
  g.stroke();
  g.beginPath();
  g.roundRect(W - 189, 87, 64, 26, 6);
  g.fill();
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.roundRect(W - 360 + i * 22, 112 - (i + 1) * 9, 14, (i + 1) * 9, 3);
    g.fill();
  }
  g.beginPath();
  g.arc(W - 250, 116, 36, Math.PI * 1.25, Math.PI * 1.75);
  g.lineWidth = 9;
  g.strokeStyle = "#FFFFFF";
  g.stroke();
  // Îlot de la caméra frontale.
  g.fillStyle = "#000000";
  g.beginPath();
  g.roundRect(W / 2 - 190, 34, 380, 108, 54);
  g.fill();
  // Date et heure.
  g.textAlign = "center";
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.font = police(64, 600);
  g.fillText("jeudi 9 octobre", W / 2, 360);
  g.fillStyle = "#FFFFFF";
  g.font = police(300, 700);
  g.fillText("9:41", W / 2, 640);
  // Widget Axion (carte translucide).
  g.fillStyle = "rgba(255,245,235,0.16)";
  g.beginPath();
  g.roundRect(84, 760, W - 168, 420, 64);
  g.fill();
  g.fillStyle = ORANGE;
  g.beginPath();
  g.roundRect(140, 816, 150, 150, 36);
  g.fill();
  g.fillStyle = CREME;
  g.beginPath();
  g.moveTo(170, 940);
  g.lineTo(206, 842);
  g.lineTo(224, 842);
  g.lineTo(260, 940);
  g.lineTo(240, 940);
  g.lineTo(232, 916);
  g.lineTo(198, 916);
  g.lineTo(190, 940);
  g.closePath();
  g.moveTo(203, 897);
  g.lineTo(227, 897);
  g.lineTo(215, 862);
  g.closePath();
  g.fill("evenodd");
  g.textAlign = "left";
  g.fillStyle = "#FFFFFF";
  g.font = police(62, 700);
  g.fillText("Axion", 330, 880);
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = police(44, 500);
  g.fillText("Votre vidéo est prête", 330, 944);
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.roundRect(140, 1030, W - 280, 22, 11);
  g.fill();
  g.fillStyle = ORANGE_VIF;
  g.beginPath();
  g.roundRect(140, 1030, (W - 280) * 0.72, 22, 11);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.font = police(38, 500);
  g.fillText("Montage terminé · 1 min 12 s", 140, 1120);
  // Grille d'icônes (4 × 2) et leurs noms.
  const noms = ["Messages", "Photos", "Caméra", "Agenda", "Notes", "Météo", "Musique", "Réglages"];
  const couleurs: [string, string][] = [
    ["#6EE07A", "#2DB84A"],
    ["#FFFFFF", "#ECECEC"],
    ["#B9BDC4", "#7E838C"],
    ["#FFFFFF", "#F2F2F2"],
    ["#FFE27A", "#F5C52B"],
    ["#5BB8FF", "#1D74E0"],
    ["#FF6A7F", "#E8344F"],
    ["#A9ADB4", "#6B7078"],
  ];
  const t = 216;
  const ecart = (W - 2 * 96 - 4 * t) / 3;
  noms.forEach((nom, i) => {
    const x = 96 + (i % 4) * (t + ecart);
    const y = 1320 + Math.floor(i / 4) * 330;
    icone(g, x, y, t, couleurs[i][0], couleurs[i][1], (cx, cy, s) => {
      g.fillStyle = i === 1 || i === 3 ? "#E07040" : "rgba(255,255,255,0.95)";
      if (i === 3) {
        g.fillStyle = "#E8344F";
        g.font = police(s * 0.16, 600);
        g.textAlign = "center";
        g.fillText("JEU.", cx, cy - s * 0.17);
        g.fillStyle = "#1A1A1A";
        g.font = police(s * 0.42, 400);
        g.fillText("9", cx, cy + s * 0.25);
        return;
      }
      if (i === 1) {
        for (let k = 0; k < 6; k++) {
          g.fillStyle = ["#F9B233", "#E8344F", "#8E5BD9", "#1D74E0", "#2DB84A", "#F5C52B"][k];
          g.beginPath();
          g.ellipse(cx + Math.cos((k * Math.PI) / 3) * s * 0.14, cy + Math.sin((k * Math.PI) / 3) * s * 0.14, s * 0.13, s * 0.07, (k * Math.PI) / 3, 0, Math.PI * 2);
          g.fill();
        }
        return;
      }
      if (i === 2) {
        g.fillStyle = "#2B2D31";
        g.beginPath();
        g.roundRect(cx - s * 0.3, cy - s * 0.18, s * 0.6, s * 0.4, s * 0.07);
        g.fill();
        g.fillStyle = "#9AA0A8";
        g.beginPath();
        g.arc(cx, cy + s * 0.02, s * 0.12, 0, Math.PI * 2);
        g.fill();
        return;
      }
      if (i === 0) {
        g.beginPath();
        g.ellipse(cx, cy - s * 0.02, s * 0.3, s * 0.24, 0, 0, Math.PI * 2);
        g.fill();
        return;
      }
      if (i === 5) {
        g.fillStyle = "#FFD54A";
        g.beginPath();
        g.arc(cx - s * 0.08, cy - s * 0.08, s * 0.15, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#FFFFFF";
        g.beginPath();
        g.ellipse(cx + s * 0.05, cy + s * 0.1, s * 0.24, s * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        return;
      }
      if (i === 4) {
        g.fillStyle = "#FFFDF4";
        g.fillRect(cx - s * 0.5, cy - s * 0.18, s, s * 0.68);
        g.fillStyle = "rgba(0,0,0,0.12)";
        for (let k = 0; k < 4; k++) g.fillRect(cx - s * 0.36, cy - s * 0.04 + k * s * 0.12, s * 0.72, s * 0.02);
        return;
      }
      if (i === 6) {
        g.beginPath();
        g.arc(cx - s * 0.1, cy + s * 0.16, s * 0.09, 0, Math.PI * 2);
        g.arc(cx + s * 0.16, cy + s * 0.1, s * 0.09, 0, Math.PI * 2);
        g.fill();
        g.fillRect(cx - s * 0.03, cy - s * 0.25, s * 0.05, s * 0.42);
        g.fillRect(cx + s * 0.23, cy - s * 0.31, s * 0.05, s * 0.42);
        g.fillRect(cx - s * 0.03, cy - s * 0.31, s * 0.31, s * 0.08);
        return;
      }
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.lineWidth = s * 0.07;
      g.beginPath();
      g.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, s * 0.07, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.font = police(38, 500);
    g.textAlign = "center";
    g.fillText(nom, x + t / 2, y + t + 56);
  });
  // Dock translucide et ses 4 icônes.
  g.fillStyle = "rgba(255,240,230,0.2)";
  g.beginPath();
  g.roundRect(48, H - 400, W - 96, 270, 92);
  g.fill();
  const dock: [string, string][] = [
    ["#6EE07A", "#2DB84A"],
    ["#5BB8FF", "#1D74E0"],
    [ORANGE_VIF, ORANGE],
    ["#FF8A5C", "#E8344F"],
  ];
  dock.forEach((cl, i) => {
    const x = 96 + i * (t + ecart);
    icone(g, x, H - 374, t, cl[0], cl[1], (cx, cy, s) => {
      g.fillStyle = "rgba(255,255,255,0.95)";
      if (i === 2) {
        g.font = police(s * 0.55, 800);
        g.textAlign = "center";
        g.fillText("A", cx, cy + s * 0.2);
      } else {
        g.beginPath();
        g.arc(cx, cy, s * 0.2, 0, Math.PI * 2);
        g.fill();
      }
    });
  });
  // Barre d'accueil.
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.beginPath();
  g.roundRect(W / 2 - 200, H - 48, 400, 15, 8);
  g.fill();
  return c;
}

/* ------------------------------------------------------------------ */
/* Téléphone                                                           */
/* ------------------------------------------------------------------ */

function metalBrosse(T: Trois, couleur: string, rugosite = 0.3) {
  return new T.MeshPhysicalMaterial({ color: new T.Color(couleur), metalness: 1, roughness: rugosite, anisotropy: 0.7, clearcoat: 0.25, clearcoatRoughness: 0.2 });
}

export function construireTelephone(T: Trois, ecran: HTMLCanvasElement, anisotropie = 8) {
  const { largeur: l, epaisseur: e, rayon: r } = TELEPHONE;
  const groupe = new T.Group();
  // Cadre en métal brossé (titane naturel) : rectangle arrondi extrudé, chanfreins doux.
  const biseau = e * 0.12;
  const cadre = new T.ExtrudeGeometry(rectangleArrondi(T, l - 2 * biseau, 1 - 2 * biseau, r - biseau), { depth: e - 2 * biseau, bevelEnabled: true, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 4, curveSegments: 20 });
  cadre.center();
  cadre.computeVertexNormals();
  groupe.add(new T.Mesh(cadre, metalBrosse(T, "#8C8E91", 0.3)));
  // Verre avant : l'écran allumé sous un verre vernis (reflet net de la pièce par-dessus le contenu).
  const texture = new T.CanvasTexture(ecran);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = anisotropie;
  const avant = uvSurBoite(new T.ShapeGeometry(rectangleArrondi(T, l - 0.006, 1 - 0.006, r - 0.003), 24), l - 0.006, 1 - 0.006);
  const bord = TELEPHONE.bordEcran;
  // Le contenu est réduit dans la bordure noire : on décale ses UV.
  const uv = avant.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const ku = (l - 0.006) / (l - 0.006 - 2 * bord);
    const kv = (1 - 0.006) / (1 - 0.006 - 2 * bord);
    uv.setXY(i, (u - 0.5) * ku + 0.5, (v - 0.5) * kv + 0.5);
  }
  texture.wrapS = T.ClampToEdgeWrapping;
  texture.wrapT = T.ClampToEdgeWrapping;
  const ecranMat = new T.MeshPhysicalMaterial({
    color: new T.Color("#050505"),
    roughness: 0.18,
    metalness: 0,
    emissive: new T.Color("#FFFFFF"),
    emissiveMap: texture,
    emissiveIntensity: 0.92,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    ior: 1.52,
    specularIntensity: 0.6,
  });
  // Bordure noire : on borne l'émission à la zone utile (au-delà des UV 0-1, la texture est noire grâce au bord).
  ecranMat.onBeforeCompile = (s: Trois) => {
    s.fragmentShader = s.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n{ vec2 q = vEmissiveMapUv; float dedans = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0); totalEmissiveRadiance *= dedans; }",
    );
  };
  const ecranMesh = new T.Mesh(avant, ecranMat);
  ecranMesh.position.z = e / 2 + 0.0004;
  groupe.add(ecranMesh);
  // Verre arrière dépoli, teinte titane sombre.
  const arriere = new T.Mesh(new T.ShapeGeometry(rectangleArrondi(T, l - 0.008, 1 - 0.008, r - 0.004), 24), new T.MeshPhysicalMaterial({ color: new T.Color("#4A4C50"), roughness: 0.42, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.35 }));
  arriere.rotation.y = Math.PI;
  arriere.position.z = -e / 2 - 0.0004;
  groupe.add(arriere);
  // Bloc photo : plateau en verre, trois objectifs cerclés de métal, flash.
  const bloc = new T.ExtrudeGeometry(rectangleArrondi(T, 0.215, 0.215, 0.05), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 16 });
  bloc.center();
  const plateau = new T.Mesh(bloc, new T.MeshPhysicalMaterial({ color: new T.Color("#55585D"), roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const bx = -l / 2 + 0.03 + 0.1075;
  const by = 0.5 - 0.03 - 0.1075;
  plateau.position.set(bx, by, -e / 2 - 0.006);
  groupe.add(plateau);
  const objectifs: [number, number][] = [
    [-0.048, 0.048],
    [-0.048, -0.048],
    [0.05, 0],
  ];
  for (const [ox, oy] of objectifs) {
    const bague = new T.Mesh(new T.CylinderGeometry(0.041, 0.043, 0.014, 48), metalBrosse(T, "#9A9CA0", 0.22));
    bague.rotation.x = Math.PI / 2;
    bague.position.set(bx + ox, by + oy, -e / 2 - 0.015);
    const lentille = new T.Mesh(new T.CircleGeometry(0.032, 48), new T.MeshPhysicalMaterial({ color: new T.Color("#06070A"), roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.6, iridescenceIOR: 1.6 }));
    lentille.rotation.y = Math.PI;
    lentille.position.set(bx + ox, by + oy, -e / 2 - 0.0225);
    groupe.add(bague, lentille);
  }
  const flash = new T.Mesh(new T.CircleGeometry(0.014, 24), new T.MeshPhysicalMaterial({ color: new T.Color("#E8DCC0"), roughness: 0.3 }));
  flash.rotation.y = Math.PI;
  flash.position.set(bx + 0.05, by + 0.07, -e / 2 - 0.0105);
  groupe.add(flash);
  // Boutons latéraux (volume à gauche, marche à droite).
  const bouton = (x: number, y: number, h: number) => {
    const b = new T.Mesh(new T.CapsuleGeometry(0.0045, h, 4, 12), metalBrosse(T, "#9A9CA0", 0.26));
    b.position.set(x, y, 0);
    groupe.add(b);
  };
  bouton(-l / 2 - 0.002, 0.23, 0.05);
  bouton(-l / 2 - 0.002, 0.15, 0.05);
  bouton(l / 2 + 0.002, 0.19, 0.08);
  ombres(groupe);
  return groupe;
}

/* ------------------------------------------------------------------ */
/* Logo Axion : « A » en métal anodisé orange sur un socle             */
/* ------------------------------------------------------------------ */

/** Le « A » géométrique du logo (hauteur 0,62 pour k = 1). */
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

export function construireLogo(T: Trois) {
  const groupe = new T.Group();
  // Hauteur totale 1 : socle 0,1, « A » 0,9 (k = 0,9 / 0,62 × 0,97).
  const k = 1.4;
  const a = new T.ExtrudeGeometry(formeA(T, k), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.018, bevelSegments: 6, curveSegments: 8 });
  a.center();
  a.computeVertexNormals();
  // Aluminium anodisé orange : métal teinté, satiné sous un vernis brillant (reflets nets de la pièce par-dessus).
  const metalOrange = new T.MeshPhysicalMaterial({ color: new T.Color("#EE7A45"), metalness: 0.55, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.25, sheenColor: new T.Color(ORANGE_VIF) });
  const lettre = new T.Mesh(a, metalOrange);
  const hauteurA = 0.62 * k + 0.044;
  const socleH = 0.1;
  lettre.position.y = -0.5 + socleH + hauteurA / 2;
  // Point du logo : petite bille polie crème, posée sur le socle au pied droit du « A ».
  const point = new T.Mesh(new T.SphereGeometry(0.06, 48, 24), new T.MeshPhysicalMaterial({ color: new T.Color(CREME), metalness: 0.05, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 }));
  point.position.set(0.37, -0.5 + socleH + 0.06, 0.16);
  // Socle : pierre noire polie (diélectrique : reflets discrets), chanfrein en métal brossé.
  const socle = new T.Mesh(new T.CylinderGeometry(0.46, 0.48, socleH, 96, 1), new T.MeshPhysicalMaterial({ color: new T.Color("#141416"), metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));
  socle.position.y = -0.5 + socleH / 2;
  const chanfrein = new T.Mesh(new T.TorusGeometry(0.46, 0.008, 12, 96), metalBrosse(T, "#B8BABE", 0.18));
  chanfrein.rotation.x = Math.PI / 2;
  chanfrein.position.y = -0.5 + socleH;
  groupe.add(socle, chanfrein, lettre, point);
  ombres(groupe);
  return groupe;
}
