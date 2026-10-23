/**
 * ÉLÉMENT 22 « DALLE CLAQUÉE » (`dalle-claquee`) — motion v2, lot 5 « Organique & objets » : le COUP DE POING P1 du § C.
 *
 * Quand : la phrase choc, un basculement (« fuite », « stop »). Visage : COUVERT (aplat plein écran, E7).
 * Règles d'emploi (au réalisateur) : jamais avant 10 s ; 1er coup de poing entre 10 et 16 s ; 18 à 30 s d'écart entre deux ;
 * ensuite au moins 1 s de Will seul. Les motifs de mots répétés au fond sont RÉSERVÉS à cet élément.
 * Fiche : E7 · F7 + F11 (aplat orange grainé + mot géant) · P1, sortie en MORPH vers un blob · `drop_004` + « boum » (à sourcer).
 *
 * Chorégraphie (i0 = le mot est dit ; 30 i/s) :
 *  - i-1 : pré-éclat (point orange de 0,04 L au centre) ;
 *  - i0 : COUPE FRANCHE, aplat orange plein écran avec grain 5 % ; le mot (encre, 0,80 L de large, incliné de -4°) passe de
 *    l'échelle 1,20 à 1 (0,96 L au plus : il reste entier dans le cadre) avec `CLAQUER` (i0 → i5) ;
 *  - i4 → i8 : 4 traits d'impact ivoire aux coins du mot ; i4 → i12 : secousse de la dalle ET du mot ensemble (A = 0,010 L) ;
 *  - i5 → i14 : un soulignement encre se TRACE sous le mot (M6) ; derrière, le même mot en creux défile de 0,3 % L par image ;
 *  - i19 → i22 : anticipation, le mot gonfle à 1,04 ; i22 → i26 : le mot est aspiré vers le coin haut-droit (échelle 0,2,
 *    rotation +24°) et la dalle devient un BLOB organique dès i23 (table `SORTIE`), 0,45 L à i24, 0,30 L à i25 sur un arc vers
 *    le coin haut-droit. Visage partiellement couvert à i23 et i24 SEULEMENT (2 images) ; entièrement dégagé dès i25.
 * Durée 27 images (0,9 s) ; si `fin - a` est plus long, c'est le plateau (i14 → anticipation) qui s'allonge.
 * Après : Will seul, 30 images au moins (sous-titres seulement).
 *
 * Calque transparent hors de la dalle. Seul texte : le mot dit par Will (1-2 mots, 12 lettres au plus). Aucun chiffre ajouté.
 */
import React from "react";
import { Easing, interpolate } from "remotion";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { FPS, FiltreGrain, borne, cheminLisse, cheminPolygone, lineaire, ressort, secousse, type Pt } from "./commun";

export const ID_DALLE_CLAQUEE = "dalle-claquee";

export type DonneesDalleClaquee = {
  /** Instant (s) où Will dit le mot : la dalle claque à cet instant précis. */
  a: number;
  /** Fin souhaitée (s) ; la durée est ramenée à 0,9 s au moins. */
  fin: number;
  /** Le mot dit par Will (1-2 mots, 12 lettres au plus). */
  mot: string;
};

export const EXEMPLE_DALLE_CLAQUEE: DonneesDalleClaquee = { a: 0.5, fin: 1.4, mot: "stop" };
export const INSTANTS_DALLE_CLAQUEE = Object.freeze({ bande: [0, 2, 4, 8, 16], sortie: [22, 24, 25] });

export const FICHE_DALLE_CLAQUEE = Object.freeze({
  id: ID_DALLE_CLAQUEE,
  nom: "Dalle claquée",
  emplacement: "E7" as const,
  forme: "F7+F11" as const,
  mouvement: "P1" as const,
  visage: "couvert" as const,
  sortie: "morph-blob" as const,
  pasAvant: 10,
  quandUtiliser: "La phrase choc, un basculement (« fuite », « stop »). Jamais avant 10 s.",
});

/** Bruitages (images depuis i0). « boum » est à sourcer (CC0). */
export const BRUITAGES_DALLE_CLAQUEE = Object.freeze([
  { image: 0, fichier: "drop_004", volume: 0.06 },
  { image: 0, fichier: "boum (à sourcer)", volume: 0.07 },
  { image: 22, fichier: "whoosh-out", volume: 0.18 },
]);

const NB = 64; // points du contour (16 par côté)
const SURPLUS = 0.03; // la dalle dépasse du cadre de 3 % pour qu'aucun bord ne se voie pendant la secousse
const DUREE_BASE = 27;
const DEBUT_ANTICIPATION = 19;
const DEBUT_SORTIE = 22;
const DUREE_SORTIE = 4;
/**
 * Sortie : MORPH en blob, image par image (k = images depuis i22). Chaque ligne = un blob organique (super-ellipse d'exposant n,
 * rayons déformés de `amp`), centre (cx, cy) en fraction de L (cy aussi en L : 0,889 = milieu de H), demi-axes a et b en fraction de L,
 * échelle du mot. Arc vers le haut à droite : i23 grand blob (visage partiel), i24 0,45 L de large (visage partiel : 2e et dernière
 * image), i25 0,30 L entièrement à droite de la zone du visage (x ≥ 0,74 L), i26 0,20 L au coin.
 */
const SORTIE = [
  null,
  { a: 0.4, b: 0.62, n: 3, cx: 0.58, cy: 0.8, amp: 0.12, mot: 0.55 },
  { a: 0.225, b: 0.225, n: 2.2, cx: 0.8, cy: 0.39, amp: 0.2, mot: 0.22 },
  { a: 0.15, b: 0.15, n: 2, cx: 0.89, cy: 0.21, amp: 0.2, mot: 0.12 },
  { a: 0.1, b: 0.1, n: 2, cx: 0.94, cy: 0.1, amp: 0.2, mot: 0.07 },
] as const;

/** Lignes du mot (même règle que le mot géant : on ne coupe jamais un mot). */
function lignes(mot: string): string[] {
  const m = mot.trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 2);
  if (m.length === 2 && m.join("").length <= 12) return m.join("").length > 8 ? m : [m.join(" ")];
  return [m[0] ?? ""];
}

/** Contour du rectangle étendu, NB points répartis le long du périmètre à partir du coin haut-gauche (sens horaire). */
function pointsRectangle(W: number, H: number): Pt[] {
  const x0 = -SURPLUS * W;
  const x1 = W * (1 + SURPLUS);
  const y0 = -SURPLUS * H;
  const y1 = H * (1 + SURPLUS);
  const c = NB / 4;
  const pts: Pt[] = [];
  for (let k = 0; k < c; k++) pts.push([x0 + ((x1 - x0) * k) / c, y0]);
  for (let k = 0; k < c; k++) pts.push([x1, y0 + ((y1 - y0) * k) / c]);
  for (let k = 0; k < c; k++) pts.push([x1 - ((x1 - x0) * k) / c, y1]);
  for (let k = 0; k < c; k++) pts.push([x0, y1 - ((y1 - y0) * k) / c]);
  return pts;
}

/** Contour du blob de l'image k de la sortie (1 à 4) : super-ellipse déformée, 32 points lissés. */
function pointsBlob(k: number, W: number): Pt[] {
  const s = SORTIE[Math.min(4, Math.max(1, k))]!;
  const pts: Pt[] = [];
  const N = 32;
  for (let j = 0; j < N; j++) {
    const phi = (2 * Math.PI * j) / N;
    const c = Math.cos(phi);
    const si = Math.sin(phi);
    const e = 2 / s.n;
    const deform = 1 + s.amp * (0.6 * Math.sin(3 * phi + 1) + 0.4 * Math.sin(5 * phi + 2));
    pts.push([(s.cx + s.a * Math.sign(c) * Math.pow(Math.abs(c), e) * deform) * W, (s.cy + s.b * Math.sign(si) * Math.pow(Math.abs(si), e) * deform) * W]);
  }
  return pts;
}

export function dureeDalleClaquee(d: DonneesDalleClaquee): number {
  return Math.max(DUREE_BASE, Math.round((d.fin - d.a) * FPS));
}

export function DalleClaquee({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_DALLE_CLAQUEE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesDalleClaquee }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const f = (t - d.a) * FPS;
  const total = dureeDalleClaquee(d);
  if (f < -1 || f >= total) return null;

  // Pré-éclat.
  if (f < 0) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <circle cx={W / 2} cy={H * 0.45} r={0.02 * W} fill={COULEURS.orange} />
      </svg>
    );
  }

  const decalage = total - DUREE_BASE; // plateau allongé
  const debutAnti = DEBUT_ANTICIPATION + decalage;
  const debutSortie = DEBUT_SORTIE + decalage;
  const u = interpolate(f, [debutSortie, debutSortie + DUREE_SORTIE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });

  // Secousse de l'élément seul (jamais de la prise) : dalle ET mot ensemble, i4 → i12.
  const dx = f >= 4 && f < 13 ? secousse(f - 4, 0.01 * W) : 0;
  const dy = f >= 4 && f < 13 ? secousse(f - 4 + 0.75, 0.006 * W) : 0;

  // Le mot.
  const l = lignes(d.mot);
  const texteSeul = l.join(" ");
  // Mot à 0,80 L de large au repos ; à l'entrée il ne dépasse JAMAIS 0,97 L : jamais un texte coupé.
  const tailles = l.map((x) => Math.min(H * (l.length > 1 ? 0.15 : 0.21), (W * 0.8) / Math.max(1e-6, largeurTexte(x, 1))));
  const interligne = 0.98;
  const hBloc = tailles.reduce((s, x) => s + x * interligne, 0);
  const centre = { x: W / 2, y: H * 0.45 };
  const claque = ressort("CLAQUER", f);
  const gonfle = f >= debutAnti ? 1 + 0.04 * lineaire(f, debutAnti, 3) : 1;
  const echelleMot = (1.2 - 0.2 * claque) * gonfle;
  const rotationMot = -4;

  // Sortie : image k = f - debutSortie ; k >= 1 → la dalle EST déjà un blob (table SORTIE), le mot est dans son centre.
  const k = Math.round(f - debutSortie);
  const sk = k >= 1 ? SORTIE[Math.min(4, k)]! : null;
  const motX = sk ? sk.cx * W : centre.x;
  const motY = sk ? sk.cy * W : centre.y;
  const motEchelle = sk ? sk.mot : echelleMot;
  const motRot = rotationMot + 24 * u;
  const cheminDalle = sk ? cheminLisse(pointsBlob(k, W)) : cheminPolygone(pointsRectangle(W, H));

  // Traits d'impact (i4 → i8) aux coins du mot.
  const largeurMot = Math.max(...l.map((x, i) => largeurTexte(x, tailles[i]))) * 0.92;
  const demiL = (largeurMot * echelleMot) / 2;
  const demiH = (hBloc * 0.72 * echelleMot) / 2;
  const trait = f >= 4 && f < 8 ? lineaire(f, 4, 2) * (1 - lineaire(f, 6, 2) * 0.6) : 0;
  const epaisseurTrait = 0.008 * W;
  const longueurTrait = 0.05 * W;
  const coins: { sx: number; sy: number }[] = [
    { sx: -1, sy: -1 },
    { sx: 1, sy: -1 },
    { sx: 1, sy: 1 },
    { sx: -1, sy: 1 },
  ];

  // Soulignement tracé (M6) i5 → i14 : courbe de Bézier fixe, légèrement irrégulière.
  const tracé = borne((f - 5) / 9, 0, 1);
  const tracéLisse = interpolate(tracé, [0, 1], [0, 1], { easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const ySou = hBloc * 0.5 + 0.035 * H;
  const lSou = largeurMot * 0.54;

  // Mot en creux, derrière : défile de 0,3 % L par image.
  const tailleEcho = (W * 1.5) / Math.max(1e-6, largeurTexte(texteSeul, 1));
  const derive = -f * 0.003 * W;
  const echo = Array.from({ length: 4 }, () => texteSeul).join("   ·   ");
  const echoHaut = Array.from({ length: 4 }, () => texteSeul).join("   ·   ");

  const trouble = u > 0 ? 6 * u : 0;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <FiltreGrain id="dalle-claquee-grain" graine={5} force={0.55} />
        <clipPath id="dalle-claquee-clip">
          <path d={cheminDalle} />
        </clipPath>
      </defs>
      <g transform={`translate(${dx * (1 - u)} ${dy * (1 - u)})`}>
        <path d={cheminDalle} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={trouble} strokeLinejoin="round" />
        <g clipPath="url(#dalle-claquee-clip)">
          <rect x={-SURPLUS * W} y={-SURPLUS * H} width={W * (1 + 2 * SURPLUS)} height={H * (1 + 2 * SURPLUS)} fill="#000" filter="url(#dalle-claquee-grain)" />
          {/* Motif en creux (mots répétés) : encre à 22 %, défile de 0,3 % L par image. */}
          <g opacity={1 - u}>
            <text x={derive} y={H * 0.45} fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleEcho} fill="none" stroke="rgba(17,10,5,0.24)" strokeWidth={3} dominantBaseline="central">
              {echo}
            </text>
            <text x={-derive * 0.8 - W * 0.4} y={H * 0.78} fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleEcho * 0.42} fill="none" stroke="rgba(17,10,5,0.2)" strokeWidth={2.5} dominantBaseline="central">
              {echoHaut}
            </text>
          </g>
        </g>
        {/* Le mot géant, ses traits d'impact et son soulignement. */}
        <g transform={`translate(${motX} ${motY}) rotate(${motRot}) scale(${motEchelle})`}>
          {l.map((ligne, i) => {
            const y = (i - (l.length - 1) / 2) * tailles[i] * interligne;
            return (
              <g key={ligne}>
                <text x={0.011 * W} y={y + 0.011 * W} textAnchor="middle" dominantBaseline="central" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailles[i]} fill={COULEURS.ivoire}>
                  {ligne}
                </text>
                <text x={0} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailles[i]} fill={COULEURS.encre}>
                  {ligne}
                </text>
              </g>
            );
          })}
          {trait > 0 &&
            coins.map((c, i) => {
              const x0 = (c.sx * demiL) / echelleMot + c.sx * 0.02 * W;
              const y0 = (c.sy * demiH) / echelleMot + c.sy * 0.02 * W;
              const L = (longueurTrait * trait) / echelleMot;
              const nx = c.sx * 0.7071;
              const ny = c.sy * 0.7071;
              return <line key={i} x1={x0} y1={y0} x2={x0 + nx * L} y2={y0 + ny * L} stroke={COULEURS.ivoire} strokeWidth={epaisseurTrait / echelleMot} strokeLinecap="round" />;
            })}
          {tracé > 0 && (
            <path
              d={`M ${-lSou} ${ySou + 4} C ${-lSou * 0.35} ${ySou - 9}, ${lSou * 0.2} ${ySou + 12}, ${lSou} ${ySou - 3}`}
              fill="none"
              stroke={COULEURS.encre}
              strokeWidth={0.014 * W}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - tracéLisse}
            />
          )}
        </g>
      </g>
    </svg>
  );
}
