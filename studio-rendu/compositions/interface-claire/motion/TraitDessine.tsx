import React from "react";
/**
 * GARNITURE « TRAIT DESSINÉ » (hors cartes, designer n° 2 — refonte du 15/10/2026 après la critique) : soulignement,
 * encadré, cercle ou flèche tracés au FEUTRE ORANGE autour d'UN mot du sous-titre.
 *
 * Ce n'est PAS une famille à part entière (critique du 15/10 : le geste couvre moins de 5 % de l'image, c'est un
 * ACCENT) : c'est une GARNITURE qui accompagne une autre motion, ou qui sert de respiration entre deux objets lourds. Le
 * réalisateur ne la compte pas dans la variété des familles (`FICHE_TRAIT_DESSINE.role`).
 *
 * Gestes (tous BORNÉS à la boîte du mot visé, mesurée avec la mise en page de `SousTitres.tsx`) :
 *  - « souligne » : un trait épais sous le mot (boîte du mot + 10 % au plus), un retour plus court dessous, et trois
 *                   rayons d'accent au-dessus, détachés des lettres ;
 *  - « entoure »  : un ovale à main levée calé sur la boîte du mot avec une marge ;
 *  - « encadre »  : un rectangle à main levée, coins qui débordent comme au feutre ;
 *  - « fleche »   : une flèche courbe qui plonge du côté libre et s'arrête à 10 px AU-DESSUS de la plaque.
 * Ovale et encadré passent forcément entre le mot et ses voisins : ils sont REFUSÉS si un mot voisin est à moins de
 * 20 px (`traitPossible`) ; le passage depuis le plan se replie alors sur « souligne ».
 * Le trait est tracé en 4 à 6 images, en orange (lisere encre fin, AUCUNE ombre dure décalée), puis il « bout »
 * légèrement (points qui tremblent toutes les 2 images), reste 0,8 s et se retire en 0,1 s.
 *
 *  - Visage : ENTIER (le geste reste dans la bande des sous-titres).
 *  - Bruitage : feutre qui crisse (`feutre`), un coup par passage.
 *  - Permis dès 1 s.
 */
import { COULEURS } from "../charte";
import { poserGroupe } from "../SousTitres";
import type { GroupeSousTitre, MotSousTitre } from "../SousTitres";
import { progression } from "../mouvement";

export type FormeTrait = "souligne" | "entoure" | "encadre" | "fleche";

export type DonneesTraitDessine = {
  /** Instant du mot visé (le trait part dessus). */
  debut: number;
  /** Fin (défaut : fin du tracé + 0,8 s). */
  fin?: number;
  forme: FormeTrait;
  /** Groupe de sous-titres affiché à cet instant (le même que celui passé à `SousTitres`). */
  groupe: MotSousTitre[];
  /** Rang du mot visé dans le groupe. */
  rangMot: number;
  /** Centre vertical des sous-titres (fraction de la hauteur), comme `y` de `SousTitres`. */
  ySousTitres: number;
  /** Rang du premier mot fort du groupe dans la vidéo (inclinaison des plaques, comme `SousTitres`). */
  rangFort?: number;
  /** Côté d'où part la flèche (défaut : le côté le plus libre). */
  cote?: "gauche" | "droite";
};

export const FICHE_TRAIT_DESSINE = Object.freeze({
  id: "trait-dessine",
  nom: "Soulignement ou encadré dessiné autour d'un mot du sous-titre",
  visage: "entier" as const,
  /** Garniture : accompagne une autre motion ou fait respirer ; ne compte pas comme une famille de plus. */
  role: "garniture" as const,
  dureeMin: 1,
  dureeMax: 1.3,
  quandUtiliser: "Pour mettre l'accent sur le mot fort d'une phrase sans rien poser par-dessus, en garniture d'une autre motion ou en respiration entre deux objets lourds (permise dès 1 s).",
});

export const EXEMPLE_PHRASE_TRAIT_DESSINE = "Vos relances partent toutes seules.";
/** Groupe de sous-titres de l'exemple (« partent toutes seules »), mot visé : « seules ». */
export const EXEMPLE_GROUPE_TRAIT_DESSINE: MotSousTitre[] = [
  { w: "partent", a: 0.55 },
  { w: "toutes", a: 0.85 },
  { w: "seules", a: 1.1, fort: true },
];
/** Groupe d'un seul mot (ovale et encadré n'ont la place qu'ici). */
export const EXEMPLE_GROUPE_SEUL_TRAIT_DESSINE: MotSousTitre[] = [{ w: "seules", a: 1.1, fort: true }];
export const EXEMPLE_TRAIT_DESSINE: DonneesTraitDessine = {
  debut: 1.15,
  forme: "souligne",
  groupe: EXEMPLE_GROUPE_TRAIT_DESSINE,
  rangMot: 2,
  ySousTitres: 0.66,
};
/** Instants de contrôle : geste en cours de tracé, puis geste complet. */
export const INSTANT_CONSTRUCTION_TRAIT_DESSINE = 1.25;
export const INSTANT_TRAIT_DESSINE = 1.65;

/** Durées des passages de feutre (s) : très rapides, comme un vrai geste. */
const DUREES: Record<FormeTrait, number[]> = { souligne: [0.14, 0.09, 0.08], entoure: [0.24], encadre: [0.09, 0.08, 0.09, 0.08], fleche: [0.17, 0.08] };
const RETRAIT = 0.1;
const TENUE = 0.8;
/** Épaisseur du feutre (px). */
const ep = (W: number) => Math.max(9, W * 0.018);
/** Écart minimal avec un mot voisin pour un ovale ou un encadré (px). */
const ECART_VOISIN = 20;
/** Distance minimale entre la pointe de la flèche et le haut de la plaque (px). */
const AIR_FLECHE = 10;

const dureeTrace = (f: FormeTrait) => DUREES[f].reduce((s, x) => s + x, 0);
/** Fin effective du trait. */
export const finTraitDessine = (d: DonneesTraitDessine) => d.fin ?? d.debut + dureeTrace(d.forme) + TENUE + RETRAIT;

/** Pseudo-hasard déterministe dans [-1, 1]. */
const alea = (n: number) => {
  const x = Math.sin(n * 91.7 + 47.3) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
};

type Point = [number, number];
/** Chemin lissé (Catmull-Rom → Bézier) passant par tous les points. */
function cheminLisse(p: Point[]): string {
  if (p.length < 2) return "";
  let s = `M ${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)];
    const b = p[i];
    const c = p[i + 1];
    const e = p[Math.min(p.length - 1, i + 2)];
    s += ` C ${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return s;
}

/** Boîte du mot visé (px), calculée comme `SousTitres` le pose au repos, et écart libre avec ses voisins. */
export function boiteMotSousTitre(d: Pick<DonneesTraitDessine, "groupe" | "rangMot" | "ySousTitres" | "rangFort">, W: number, H: number) {
  const pose = poserGroupe(d.groupe, W, H, d.rangFort ?? 0);
  const rang = Math.min(d.rangMot, pose.mots.length - 1);
  let x = (W - pose.largeur) / 2;
  for (let k = 0; k < rang; k++) x += pose.mots[k].largeur + pose.espace;
  const mot = pose.mots[rang];
  const cy = d.ySousTitres * H;
  const libreG = rang > 0 ? pose.espace : Infinity;
  const libreD = rang < pose.mots.length - 1 ? pose.espace : Infinity;
  return { x0: x, x1: x + mot.largeur, y0: cy - mot.hauteur / 2, y1: cy + mot.hauteur / 2, libreG, libreD };
}

/** Faux si le geste demandé ne peut pas être tracé sans toucher un mot voisin. */
export function traitPossible(d: DonneesTraitDessine, W: number, H: number): boolean {
  if (d.forme !== "entoure" && d.forme !== "encadre") return true;
  const b = boiteMotSousTitre(d, W, H);
  return Math.min(b.libreG, b.libreD) >= ECART_VOISIN;
}

/** Passages de feutre (listes de points, px) pour chaque forme. Un `NaN` sépare deux traits d'un même passage. */
function passages(d: DonneesTraitDessine, W: number, H: number): Point[][] {
  const b = boiteMotSousTitre(d, W, H);
  const lm = b.x1 - b.x0;
  const hm = b.y1 - b.y0;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const e = ep(W);
  if (d.forme === "souligne") {
    // Borné à la boîte du mot + 10 % (5 % de chaque côté).
    const x0 = b.x0 - lm * 0.05;
    const x1 = b.x1 + lm * 0.05;
    const y = b.y1 + e * 0.9;
    const aller: Point[] = Array.from({ length: 9 }, (_, i) => [x0 + ((x1 - x0) * i) / 8, y + Math.sin((i / 8) * Math.PI) * hm * 0.06 - (i / 8) * hm * 0.08]);
    const retour: Point[] = Array.from({ length: 7 }, (_, i) => [x1 - (x1 - x0) * 0.12 - ((x1 - x0) * 0.6 * i) / 6, y + e * 1.25 + Math.sin((i / 6) * Math.PI) * hm * 0.05]);
    // Rayons d'accent : démarrent à 0,5 hauteur de mot au-dessus des lettres (jamais dessus).
    const accents: Point[] = [];
    [-0.7, 0, 0.7].forEach((k, i) => {
      const ang = -Math.PI / 2 + k * 0.6;
      const bx = cx + k * lm * 0.42;
      const by = b.y0 - hm * 0.5 - e * 0.5;
      const lg = hm * (i === 1 ? 0.7 : 0.55);
      accents.push([bx, by], [bx + Math.cos(ang) * lg, by + Math.sin(ang) * lg], [Number.NaN, Number.NaN]);
    });
    return [aller, retour, accents];
  }
  // Marges autour du mot : horizontalement, ce que laissent les voisins (l'ovale passe dans l'espace entre les mots).
  const mxVoulue = Math.max(lm * 0.08, 18);
  const mx = Math.min(mxVoulue, Math.min(b.libreG, b.libreD) - e * 0.5 - 4);
  const my = Math.max(hm * 0.32, 14) + e * 0.5;
  if (d.forme === "encadre") {
    // Rectangle à main levée : 4 traits, coins qui débordent.
    const g = b.x0 - mx;
    const dr = b.x1 + mx;
    const h = b.y0 - my;
    const bas = b.y1 + my;
    const deb = e * 0.9;
    const ligne = (p: Point, q: Point, k: number): Point[] => Array.from({ length: 5 }, (_, i) => [p[0] + ((q[0] - p[0]) * i) / 4 + alea(k * 10 + i) * 1.5, p[1] + ((q[1] - p[1]) * i) / 4 + alea(k * 20 + i) * 1.5]);
    return [ligne([g - deb, h + 2], [dr + deb * 0.6, h - 3], 1), ligne([dr - 2, h - deb], [dr + 3, bas + deb * 0.7], 2), ligne([dr + deb, bas + 1], [g - deb * 0.5, bas + 4], 3), ligne([g + 2, bas + deb], [g - 2, h - deb * 0.5], 4)];
  }
  if (d.forme === "entoure") {
    // Ovale : son grand axe passe dans l'espace entre les mots ; sa hauteur est calculée pour contenir les coins du mot.
    const rx = lm / 2 + mx;
    const a = lm / 2 / rx;
    const ry = Math.max(hm / 2 + my, (hm / 2 + e * 0.5) / Math.sqrt(Math.max(0.05, 1 - a * a)));
    const ryBorne = Math.min(ry, H * 0.06);
    const N = 64;
    const tours = 1.1;
    const depart = Math.PI * 1.1;
    return [
      Array.from({ length: N + 1 }, (_, i): Point => {
        const u = i / N;
        const ang = depart + u * tours * 2 * Math.PI;
        const f = 1 + 0.03 * Math.sin(ang * 2 + 0.8) - 0.04 * u;
        return [cx + Math.cos(ang) * rx * f, cy + Math.sin(ang) * ryBorne * f];
      }),
    ];
  }
  // Flèche : part d'au-dessus, du côté le plus libre, plonge sur le mot et s'arrête à 10 px au-dessus de la plaque.
  const s = d.cote ? (d.cote === "droite" ? 1 : -1) : cx >= W / 2 ? 1 : -1;
  const pointe: Point = [cx + s * lm * 0.1, b.y0 - AIR_FLECHE - e * 0.6];
  const bord = W * 0.05 + e;
  const depart: Point = [Math.min(W - bord, Math.max(bord, pointe[0] + s * W * 0.24)), pointe[1] - H * 0.075];
  const ctrl: Point = [Math.min(W - bord, Math.max(bord, pointe[0] + s * W * 0.03)), pointe[1] - H * 0.07];
  const fut: Point[] = Array.from({ length: 13 }, (_, i) => {
    const u = i / 12;
    return [(1 - u) ** 2 * depart[0] + 2 * (1 - u) * u * ctrl[0] + u * u * pointe[0], (1 - u) ** 2 * depart[1] + 2 * (1 - u) * u * ctrl[1] + u * u * pointe[1]];
  });
  const [ax, ay] = fut[fut.length - 2];
  const ang = Math.atan2(pointe[1] - ay, pointe[0] - ax);
  const lg = Math.max(hm * 0.8, W * 0.065);
  const v: Point[] = [
    [pointe[0] + Math.cos(ang + Math.PI - 0.55) * lg, pointe[1] + Math.sin(ang + Math.PI - 0.55) * lg],
    pointe,
    [pointe[0] + Math.cos(ang + Math.PI + 0.55) * lg, pointe[1] + Math.sin(ang + Math.PI + 0.55) * lg],
  ];
  return [fut, v];
}

function segments(p: Point[]): Point[][] {
  const r: Point[][] = [[]];
  for (const q of p) {
    if (Number.isNaN(q[0])) r.push([]);
    else r[r.length - 1].push(q);
  }
  return r.filter((x) => x.length > 1);
}

export function TraitDessine({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_TRAIT_DESSINE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesTraitDessine }) {
  const d = donnees;
  const fin = finTraitDessine(d);
  if (t < d.debut || t >= fin || !traitPossible(d, W, H)) return null;
  const e = ep(W);
  const lisere = Math.max(2, W * 0.0028);
  const cran = Math.floor((t - d.debut) * 12.5);
  const amp = W * 0.002;
  const durees = DUREES[d.forme];
  const retrait = progression(t, fin - RETRAIT, RETRAIT);
  let debutPassage = d.debut;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {passages(d, W, H).map((pts, i) => {
        const a = debutPassage;
        debutPassage += durees[i] ?? 0.08;
        if (t < a) return null;
        const p = 1 - (1 - progression(t, a, durees[i] ?? 0.08)) ** 2;
        const visible = Math.max(0, p - retrait);
        const tremble = pts.map(([x, y], k): Point => (Number.isNaN(x) ? [x, y] : [x + alea(k * 13 + cran * 7 + i) * amp, y + alea(k * 29 + cran * 11 + i) * amp]));
        return segments(tremble).map((seg, j) => {
          const chemin = cheminLisse(seg);
          const style = { strokeDasharray: "1 1", strokeDashoffset: 1 - visible };
          return (
            <g key={`${i}-${j}`}>
              <path d={chemin} pathLength={1} stroke={COULEURS.encre} strokeWidth={e + 2 * lisere} style={style} />
              <path d={chemin} pathLength={1} stroke={COULEURS.orange} strokeWidth={e} style={style} />
              <path d={chemin} pathLength={1} stroke={COULEURS.ivoire} strokeOpacity={0.3} strokeWidth={e * 0.16} transform={`translate(${-e * 0.16} ${-e * 0.16})`} style={style} />
            </g>
          );
        });
      })}
    </svg>
  );
}

/** Contenu de la famille dans le plan (`SCHEMAS_CONTENU_MOTION["trait-dessine"]`). */
export type ContenuPlanTraitDessine = { forme: "souligne" | "encadre" | "entoure"; traits: { mot: string; a: number }[] };
const normaliser = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9']/g, "");
/**
 * Passe du plan du réalisateur aux données du composant : un trait par mot visé, retrouvé dans le groupe de sous-titres
 * affiché à son instant. Ovale ou encadré impossibles (voisin à moins de 20 px) → repli sur « souligne ».
 */
export function traitsDessinesDepuisPlan(c: ContenuPlanTraitDessine, groupes: GroupeSousTitre[], ySousTitres: number, W: number, H: number): DonneesTraitDessine[] {
  const r: DonneesTraitDessine[] = [];
  for (const tr of c.traits) {
    const gi = groupes.findIndex((g) => tr.a >= g.mots[0].a - 0.05 && tr.a < g.fin);
    if (gi < 0) continue;
    const g = groupes[gi];
    const cible = normaliser(tr.mot);
    let rang = g.mots.findIndex((m) => normaliser(m.w) === cible);
    if (rang < 0) rang = g.mots.findIndex((m) => normaliser(m.w).includes(cible) || cible.includes(normaliser(m.w)));
    if (rang < 0) continue;
    let rangFort = 0;
    for (let k = 0; k < gi; k++) rangFort += groupes[k].mots.filter((m) => m.fort).length;
    const debut = Math.max(tr.a, g.mots[rang].a);
    const voulu: DonneesTraitDessine = { debut, fin: Math.min(g.fin, debut + dureeTrace(c.forme) + TENUE + RETRAIT), forme: c.forme, groupe: g.mots, rangMot: rang, ySousTitres, rangFort };
    r.push(traitPossible(voulu, W, H) ? voulu : { ...voulu, forme: "souligne", fin: Math.min(g.fin, debut + dureeTrace("souligne") + TENUE + RETRAIT) });
  }
  return r;
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume] — le format que lit `VideoAnimee`. */
export type BruitageMotion = [number, string, number];

/** Un crissement de feutre par passage. */
export function bruitagesTraitDessine(d: DonneesTraitDessine = EXEMPLE_TRAIT_DESSINE): BruitageMotion[] {
  const s: BruitageMotion[] = [];
  let a = d.debut;
  DUREES[d.forme].forEach((x) => {
    s.push([a, "feutre", 0.06]);
    a += x;
  });
  return s;
}
