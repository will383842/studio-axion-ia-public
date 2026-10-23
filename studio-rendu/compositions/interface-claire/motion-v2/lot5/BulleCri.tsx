/**
 * ÉLÉMENT 23 « BULLE-CRI » (`bulle-cri`) — motion v2, lot 5 « Organique & objets » (standard DA du 16/10/2026, § D lot 5).
 *
 * Quand : Will CITE quelqu'un (« j'ai pas le temps ! »). Le texte affiché est la citation dite par Will, telle quelle.
 * Visage : ENTIER. Fiche : E3 droite (x 0,75-1,0 L, y 0,14-0,36 H) · bulle de bande dessinée à BORD EN DENTS DE SCIE, ivoire,
 * contour encre 0,006 L, inclinée de +9° · M4 : claquement avec secousse FORTE de l'élément (A = 0,016 L) · `click_003` + `minimize_004`.
 *
 * La queue vise la bouche mais s'arrête à Z + 0,02 : sa pointe est posée à x = 0,775 L, y = 0,45 H (Z finit à 0,73 L, marge 0,02 → 0,75 L ;
 * la secousse la déplace de 0,016 L au plus). Le claquement se fait AUTOUR DE LA POINTE : le corps grandit depuis la queue,
 * donc rien de la bulle n'entre jamais dans la zone du visage, même à l'échelle 1,4 et à +20° (voir `controleZoneBulleCri`).
 *
 * Mouvement (i0 = le premier mot de la citation est dit ; 30 i/s) :
 *  - i-1 : pré-éclat (point orange de 0,03 L) au centre de la bulle ;
 *  - i0 → i7 : échelle 1,25 → 1 avec `CLAQUER` ; rotation +21° → +9° avec le même ressort ; opacité 0 → 1 en 2 i ;
 *  - i3 : 4 traits d'impact encre (0,05 L) aux coins, en 2 images, effacés à i7 ; les 3 traits de « cri » orange jaillissent ;
 *  - i3 → i11 : secousse amortie de la bulle SEULE, A = 0,016 L (jamais la prise) ;
 *  - pose : oscillation de ±1° sur 1,6 s ; sortie : anticipation 2 i à 97 % puis ENVOL vers la droite en 4 images, rotation +16°.
 *
 * Calque au-dessus de la prise (qui ne bouge JAMAIS). Texte ≥ 48 px à 1 080 de large (citation courte, 3 mots), en Montserrat ExtraBold.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { FPS, aspiration, borne, cheminPolygone, hasard, lineaire, ressort, secousse, type Pt } from "./commun";

export const ID_BULLE_CRI = "bulle-cri";

export type DonneesBulleCri = {
  /** Instant (s) où Will dit la citation. */
  a: number;
  /** Fin souhaitée (s) ; la durée est ramenée à 0,8 s au moins. */
  fin: number;
  /** La citation dite par Will (court, 3 à 5 mots), ponctuation comprise. */
  texte: string;
};

export const EXEMPLE_BULLE_CRI: DonneesBulleCri = { a: 0.5, fin: 2.5, texte: "Trop cher !" };
export const INSTANTS_BULLE_CRI = Object.freeze({ bande: [0, 2, 4, 8, 20], sortie: [-6, -4, -2] });

export const FICHE_BULLE_CRI = Object.freeze({
  id: ID_BULLE_CRI,
  nom: "Bulle-cri",
  emplacement: "E3" as const,
  forme: "F3 (bulle dentelée)" as const,
  mouvement: "M4" as const,
  visage: "entier" as const,
  sortie: "envol" as const,
  quandUtiliser: "Will cite quelqu'un (« j'ai pas le temps ! »).",
});

export const BRUITAGES_BULLE_CRI = Object.freeze([
  { image: 0, fichier: "click_003", volume: 0.05 },
  { image: 3, fichier: "minimize_004", volume: 0.06 },
]);

/** Géométrie de la bulle posée (fractions) : centre, demi-axes ; pointe de la queue. */
/** Bulle AGRANDIE (0,28 L × 0,30 H, environ 6,6 % de l'image) : centre (0,865 L ; 0,20 H), bord gauche à 0,73 L, bord droit à 1,0 L, tout le texte DANS le cadre. */
const CORPS = { x: 0.865, y: 0.2, rx: 0.135, ry: 0.15 };
const POINTE = { x: 0.795, y: 0.45 };
const INCLINAISON = 9;
const NB_DENTS = 22;
const DUREE_SORTIE = 4;

export function dureeBulleCri(d: DonneesBulleCri): number {
  return Math.max(0.8, d.fin - d.a) * FPS;
}

/** Contour en dents de scie : rayons alternés 1,00 / 0,84, avec un léger aléa FIXE (jamais deux dents identiques). */
function contourDente(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const pts: Pt[] = [];
  for (let j = 0; j < NB_DENTS * 2; j++) {
    const ang = (j / (NB_DENTS * 2)) * 2 * Math.PI - Math.PI / 2;
    const pointe = j % 2 === 0;
    const r = pointe ? 1 + (hasard(j, 3) - 0.5) * 0.07 : 0.84 + (hasard(j, 5) - 0.5) * 0.04;
    pts.push([cx + Math.cos(ang) * rx * r, cy + Math.sin(ang) * ry * r]);
  }
  return pts;
}

/** Meilleure coupe en lignes : le plus grand corps de texte qui tient dans (largeurMax × hauteurMax). */
function meilleureCoupe(texte: string, largeurMax: number, hauteurMax: number): { lignes: string[]; taille: number } {
  const mots = texte.trim().toUpperCase().split(/\s+/).filter(Boolean).reduce<string[]>((acc, m) => {
    // Une ponctuation seule (« ! », « ? ») reste collée au mot qui la précède : jamais seule sur une ligne.
    if (/^[!?]+$/.test(m) && acc.length) acc[acc.length - 1] += " " + m;
    else acc.push(m);
    return acc;
  }, []);
  const candidates: string[][] = [[mots.join(" ")]];
  for (let i = 1; i < mots.length; i++) candidates.push([mots.slice(0, i).join(" "), mots.slice(i).join(" ")]);
  for (let i = 1; i < mots.length; i++) for (let j = i + 1; j < mots.length; j++) candidates.push([mots.slice(0, i).join(" "), mots.slice(i, j).join(" "), mots.slice(j).join(" ")]);
  let meilleure = { lignes: candidates[0], taille: 0 };
  for (const c of candidates) {
    const em = Math.max(...c.map((x) => largeurTexte(x, 1))) * 0.92;
    const taille = Math.min(78, largeurMax / em, hauteurMax / (c.length * 1.1));
    if (taille > meilleure.taille + 0.5) meilleure = { lignes: c, taille };
  }
  return meilleure;
}

/** Pointe de la queue dans le repère du corps (avant inclinaison de +6° autour du centre). */
function pointeLocale(W: number, H: number): Pt {
  const a = (-INCLINAISON * Math.PI) / 180;
  const dx = POINTE.x * W - CORPS.x * W;
  const dy = POINTE.y * H - CORPS.y * H;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

export function BulleCri({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_BULLE_CRI }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesBulleCri }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const f = (t - d.a) * FPS;
  const total = dureeBulleCri(d);
  if (f < -1 || f >= total) return null;

  const cx = CORPS.x * W;
  const cy = CORPS.y * H;
  const rx = CORPS.rx * W;
  const ry = CORPS.ry * H;

  if (f < 0) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={0.015 * W} fill={COULEURS.orange} />
      </svg>
    );
  }

  const [tx, ty] = pointeLocale(W, H);
  const T = { x: cx + tx * Math.cos((INCLINAISON * Math.PI) / 180) - ty * Math.sin((INCLINAISON * Math.PI) / 180), y: cy + tx * Math.sin((INCLINAISON * Math.PI) / 180) + ty * Math.cos((INCLINAISON * Math.PI) / 180) };

  // Entrée : claquement autour de la pointe.
  const c = ressort("CLAQUER", f);
  const echelle = 1.25 - 0.25 * c;
  const extra = 12 * (1 - c);
  const opacite = lineaire(f, 0, 2);
  // Secousse FORTE de l'élément seul, i3 → i11.
  const dx = f >= 3 && f < 12 ? secousse(f - 3, 0.016 * W) : 0;
  const dy = f >= 3 && f < 12 ? secousse(f - 3 + 0.8, 0.007 * W) : 0;
  // Micro-vie.
  const oscille = f > 11 ? Math.sin((2 * Math.PI * (f - 11)) / 48) * 1 : 0;
  // Sortie : anticipation 2 i à 97 %, envol 4 i.
  const debutEnvol = total - DUREE_SORTIE;
  const anti = f >= debutEnvol - 2 && f < debutEnvol ? 0.97 : 1;
  const v = aspiration(f, debutEnvol, DUREE_SORTIE);
  const envolX = v * 0.34 * W;
  const envolY = -v * 0.05 * H;
  const envolRot = v * 16;

  const corps = contourDente(cx, cy, rx, ry);
  const { lignes, taille } = meilleureCoupe(d.texte, rx * 2 * 0.84 * 0.88, ry * 2 * 0.84 * 0.78);
  const base1: Pt = [cx + Math.cos(1.95) * rx * 0.84, cy + Math.sin(1.95) * ry * 0.84];
  const base2: Pt = [cx + Math.cos(2.45) * rx * 0.84, cy + Math.sin(2.45) * ry * 0.84];
  const queue: Pt[] = [base1, [cx + tx, cy + ty], base2];
  const contour = 0.006 * W;
  const ombre = 0.008 * W;

  // Traits d'impact (i3 → i7) aux 4 coins de la boîte de la bulle.
  const impact = f >= 3 && f < 7 ? lineaire(f, 3, 2) * (1 - lineaire(f, 5, 2)) : 0;
  const coins = [
    { sx: -1, sy: -1 },
    { sx: 1, sy: -1 },
    { sx: 1, sy: 1 },
    { sx: -1, sy: 1 },
  ];
  // Traits de « cri » orange, en haut à droite (jamais du côté du visage).
  const cri = ressort("JAILLIR", f, 3);
  const angCri = [-102, -76, -50];

  const chemin = cheminPolygone(corps);
  const cheminQueue = cheminPolygone(queue);
  const marche = Math.max(0, opacite);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={marche} transform={`translate(${dx + envolX} ${dy + envolY}) rotate(${envolRot} ${cx} ${cy}) translate(${T.x} ${T.y}) rotate(${extra}) scale(${echelle * anti}) translate(${-T.x} ${-T.y})`}>
        <g transform={`rotate(${INCLINAISON + oscille} ${cx} ${cy})`}>
          {/* Ombre dure encre, vers le bas-droit. */}
          <g transform={`translate(${ombre} ${ombre})`} fill={COULEURS.encre}>
            <path d={chemin} />
            <path d={cheminQueue} />
          </g>
          {/* Contour (trait doublé), puis remplissage qui efface la jointure corps/queue et laisse la moitié extérieure du trait. */}
          <g fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={contour * 2} strokeLinejoin="miter" strokeMiterlimit={3}>
            <path d={chemin} />
            <path d={cheminQueue} />
          </g>
          <g fill={COULEURS.ivoire}>
            <path d={chemin} />
            <path d={cheminQueue} />
          </g>
          {lignes.map((ligne, i) => {
            const y = cy - 6 + (i - (lignes.length - 1) / 2) * taille * 1.1;
            return (
              <text key={i} x={cx} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={POLICES.titre} fontWeight={800} fontSize={taille} fill={COULEURS.encre}>
                {ligne.split(/([!?])/).map((morceau, k) => (
                  <tspan key={k} fill={/[!?]/.test(morceau) ? COULEURS.orange : COULEURS.encre}>
                    {morceau}
                  </tspan>
                ))}
              </text>
            );
          })}
          {/* Traits de cri. */}
          {angCri.map((a, i) => {
            const r = (a * Math.PI) / 180;
            const r0 = 1.14 + i * 0.01;
            const r1 = r0 + 0.2 * borne(cri, 0, 1.2);
            return (
              <line
                key={i}
                x1={cx + Math.cos(r) * rx * r0}
                y1={cy + Math.sin(r) * ry * r0}
                x2={cx + Math.cos(r) * rx * r1}
                y2={cy + Math.sin(r) * ry * r1}
                stroke={COULEURS.orange}
                strokeWidth={0.011 * W}
                strokeLinecap="round"
                opacity={cri > 0 ? 1 : 0}
              />
            );
          })}
        </g>
      </g>
      {impact > 0 &&
        coins.map((k, i) => {
          const x0 = cx + k.sx * (rx + 0.02 * W);
          const y0 = cy + k.sy * (ry * 0.98 + 0.02 * W);
          const L = 0.05 * W * impact;
          return <line key={i} x1={x0} y1={y0} x2={x0 + k.sx * 0.7071 * L} y2={y0 + k.sy * 0.7071 * L} stroke={COULEURS.encre} strokeWidth={0.007 * W} strokeLinecap="round" />;
        })}
    </svg>
  );
}

/**
 * Contrôle de zone (pour les tests) : abscisse minimale (fraction de L) atteinte par la bulle ou sa queue pendant l'entrée, sans
 * secousse. Doit rester au-dessus de 0,73 (bord de la zone du visage) ; la marge visée est 0,75.
 */
export function controleZoneBulleCri(W = 1080, H = 1920): number {
  let min = 1;
  for (let f = 0; f <= 12; f++) {
    const c = ressort("CLAQUER", f);
    const s = 1.25 - 0.25 * c;
    const extra = ((12 * (1 - c)) * Math.PI) / 180;
    const [tx, ty] = pointeLocale(W, H);
    const a = (INCLINAISON * Math.PI) / 180;
    const T = { x: CORPS.x * W + tx * Math.cos(a) - ty * Math.sin(a), y: CORPS.y * H + tx * Math.sin(a) + ty * Math.cos(a) };
    const pts: Pt[] = [[T.x, T.y]];
    for (const p of contourDente(CORPS.x * W, CORPS.y * H, CORPS.rx * W, CORPS.ry * H)) {
      const rx = p[0] - CORPS.x * W;
      const ry = p[1] - CORPS.y * H;
      pts.push([CORPS.x * W + rx * Math.cos(a) - ry * Math.sin(a), CORPS.y * H + rx * Math.sin(a) + ry * Math.cos(a)]);
    }
    for (const p of pts) {
      const rx = p[0] - T.x;
      const ry = p[1] - T.y;
      const x = T.x + (rx * Math.cos(extra) - ry * Math.sin(extra)) * s;
      min = Math.min(min, x / W);
    }
  }
  return min;
}
