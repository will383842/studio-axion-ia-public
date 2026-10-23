/**
 * Axe « transitions » de la variété (lot CAM-TRA). PUR, déterministe. UNE transition principale par vidéo (celle de la
 * recette) + la coupe franche partout ailleurs (doc 72, axe 7) :
 * - TRA-B · raccord d'objet : la coche verte du dernier nœud coché grossit jusqu'à couvrir l'écran ; l'écran suivant
 *   s'ouvre depuis ce vert ;
 * - TRA-C · balayage orange : une bande orange inclinée descend et couvre l'écran ; elle continue sa course sur l'écran
 *   suivant, qu'elle révèle ;
 * - TRA-D · on entre dedans : la carte dont on parle grandit jusqu'à remplir l'écran ; l'écran suivant sort de son blanc.
 * TRA-E est retirée (jamais produite).
 *
 * Les blocs restent rendus séparément puis mis bout à bout : la SORTIE est dessinée dans les 0,4 dernières secondes du
 * bloc A, l'ENTRÉE dans les 0,4 premières du bloc B, et l'image de la jointure est la même des deux côtés (écran plein
 * orange, vert ou blanc, la marque restant visible au-dessus). Données posées dans `variete.donnees.transitions`, lues par
 * `studio-rendu/…/variete/transitions/calque.tsx`. Jointures choisies : au plus une sur deux, au plus 3, jamais contre une
 * phrase-choc, jamais sur un écran emprunté au cas concret (il n'a pas de calque), jamais pendant une vue d'ensemble.
 */
import { boiteALEcran, cameraA } from "@/briques/schema-motion/camera";
import { ECRAN_IV } from "@/briques/schema-motion/types";
import { type CodeVariante, type FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { BlocRenduIV } from "../../mise-en-scene";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";

/** Rectangle en pixels de l'écran de référence 1080 × 1920. */
export type RectEcranIV = { x: number; y: number; l: number; h: number };
/** TRA-B : centre et rayon de la coche de départ ; `posee` : la coche n'existait pas, elle se pose d'abord sur la carte. */
export type SortieTransitionIV = { code: "TRA-B"; x: number; y: number; r: number; posee?: true } | { code: "TRA-C" } | { code: "TRA-D"; carte: RectEcranIV };
export type EntreeTransitionIV = { code: "TRA-B" | "TRA-C" | "TRA-D" };
/** Ce que porte un bloc aux jointures choisies. */
export type DonneesTransitionsIV = { duree: number; sortie?: SortieTransitionIV; entree?: EntreeTransitionIV };

export const REGLES_TRANSITIONS_IV = Object.freeze({
  /** Durée de la sortie (fin du bloc A) et de l'entrée (début du bloc B), en secondes. */
  duree: 0.4,
  /** Un bloc plus court que ceci ne porte pas de transition (elle mangerait le bloc). */
  blocMin: 1.2,
  /** Au plus 3 jointures par vidéo (une transition principale, pas un effet partout). */
  max: 3,
  /** Rayon de la pastille de coche d'un nœud (`Noeud.tsx`) et son retrait sur le coin. */
  rayonCoche: 46,
  retraitCoche: 14,
  /** Marge : la carte ou la coche de départ doit être entière à l'écran, sous la marque (y ≥ 230) et au-dessus des sous-titres. */
  haut: 230,
  bas: 1152,
});
const R = REGLES_TRANSITIONS_IV;
const arrondi = (x: number) => Math.round(x * 1000) / 1000;

type BlocToile = Extract<BlocRenduIV, { sorte: "toile" }>;

function possiblesTransitions(carte: CarteImage, format: FormatIV): CodeVariante<"transitions">[] {
  void format;
  const codes: CodeVariante<"transitions">[] = [];
  if (carte.liens.length >= 1 && carte.noeuds.some((n) => n.role === "resultat")) codes.push("TRA-B");
  codes.push("TRA-C");
  if (carte.liens.length >= 1) codes.push("TRA-D");
  return codes;
}

/** Le bloc est-il dessiné par une composition qui porte l'habillage de variété ? (Les écrans du cas concret, non.) */
const habille = (b: BlocRenduIV) => b.sorte !== "ecran";
const phraseChoc = (b: BlocRenduIV) => b.sorte === "moments" && b.moments.some((m) => m.sorte === "phrase-choc");
const ensembleSur = (b: BlocRenduIV, t0: number, t1: number) => b.sorte === "toile" && (b.proprietes.ensembles ?? []).some((e) => e.debut - 0.3 < t1 && e.fin + 0.2 > t0);
const fondDe = (b: BlocRenduIV) => (b.sorte === "toile" ? b.proprietes.fond : b.sorte === "objets" ? b.fond : b.sorte === "moments" ? b.moments[0]?.fond : "ivoire");

/** Rectangle d'une boîte de toile à l'écran à l'instant `t` (relatif au bloc), s'il y est entier. */
function aLEcran(b: BlocToile, id: string, t: number): RectEcranIV | null {
  const boite = b.toile.boites.find((x) => x.id === id);
  if (!boite) return null;
  const e = boiteALEcran(boite, cameraA(b.trajectoire, t));
  const r = { x: e.x, y: e.y, l: e.largeur, h: e.hauteur };
  return r.x >= 0 && r.x + r.l <= ECRAN_IV.largeur && r.y >= R.haut && r.y + r.h <= R.bas ? r : null;
}

/** Sortie possible de ce bloc pour ce code (TRA-B : coche visible ; TRA-D : carte dont on parle visible), sinon null. */
function sortiePour(code: "TRA-B" | "TRA-C" | "TRA-D", a: BlocRenduIV): SortieTransitionIV | null {
  if (code === "TRA-C") return { code };
  if (a.sorte !== "toile") return null;
  const t = arrondi(a.fin - a.debut - R.duree);
  const mots = [...a.proprietes.mots].filter((m) => m.t <= t).sort((x, y) => x.t - y.t);
  const courant = mots[mots.length - 1];
  if (code === "TRA-B") {
    // La coche d'un nœud déjà coché et visible (la plus récente) ; sinon, si la séquence a des étapes cochées, la coche
    // se pose sur la carte dont on parle, puis grossit.
    const coches = [...(a.proprietes.coches ?? [])].filter((c) => c.t + 0.4 <= t).sort((x, y) => y.t - x.t);
    const vue = coches.map((c) => aLEcran(a, c.noeud, t)).find((r) => r);
    const r = vue ?? (coches.length && courant ? aLEcran(a, courant.noeud, t) : null);
    if (!r) return null;
    const z = cameraA(a.trajectoire, t).zoom;
    return { code, x: arrondi(r.x + r.l - R.retraitCoche * z), y: arrondi(r.y + R.retraitCoche * z), r: arrondi(R.rayonCoche * z), ...(vue ? {} : { posee: true as const }) };
  }
  const r = courant && aLEcran(a, courant.noeud, t);
  return r ? { code, carte: { x: arrondi(r.x), y: arrondi(r.y), l: arrondi(r.l), h: arrondi(r.h) } } : null;
}

/** Jointures retenues (indice du bloc A) avec la sortie de A ; au plus une sur deux, au plus `max`, fond qui change d'abord. */
export function jointuresIV(blocs: readonly BlocRenduIV[], code: "TRA-B" | "TRA-C" | "TRA-D"): { i: number; sortie: SortieTransitionIV }[] {
  const candidates: { i: number; sortie: SortieTransitionIV; change: boolean }[] = [];
  for (let i = 0; i + 1 < blocs.length; i++) {
    const a = blocs[i];
    const b = blocs[i + 1];
    if (!habille(a) || !habille(b) || phraseChoc(a) || phraseChoc(b)) continue;
    if (a.fin - a.debut < R.blocMin || b.fin - b.debut < R.blocMin) continue;
    if (ensembleSur(a, a.fin - a.debut - R.duree, a.fin - a.debut) || ensembleSur(b, 0, R.duree)) continue;
    const sortie = sortiePour(code, a);
    if (sortie) candidates.push({ i, sortie, change: fondDe(a) !== fondDe(b) });
  }
  const ordre = [...candidates].sort((x, y) => Number(y.change) - Number(x.change) || x.i - y.i);
  const pris: { i: number; sortie: SortieTransitionIV }[] = [];
  for (const c of ordre) {
    if (pris.length >= R.max) break;
    if (pris.some((p) => Math.abs(p.i - c.i) < 2)) continue;
    pris.push({ i: c.i, sortie: c.sortie });
  }
  return pris.sort((x, y) => x.i - y.i);
}

function poser(b: BlocRenduIV, ajout: Partial<DonneesTransitionsIV>): BlocRenduIV {
  const v = b.variete!;
  const avant = (v.donnees?.transitions as DonneesTransitionsIV | undefined) ?? { duree: R.duree };
  return { ...b, variete: { ...v, donnees: { ...v.donnees, transitions: { ...avant, ...ajout } } } } as BlocRenduIV;
}

function appliquerTransitions(e: EtapeVarieteIV): EtapeVarieteIV {
  const code = e.recette.transitions;
  if (code === "TRA-A" || code === "TRA-E") return e;
  const js = jointuresIV(e.blocs, code);
  if (!js.length) return { ...e, replis: [...e.replis, { axe: "transitions", code, raison: "aucune jointure ne s'y prête (coupe franche partout)" }] };
  const blocs = [...e.blocs];
  for (const j of js) {
    blocs[j.i] = poser(blocs[j.i], { sortie: j.sortie });
    blocs[j.i + 1] = poser(blocs[j.i + 1], { entree: { code } });
  }
  return { ...e, blocs };
}

export const AXE_TRANSITIONS: AxeVarieteIV = {
  axe: "transitions",
  possibles: possiblesTransitions,
  appliquer: appliquerTransitions,
};
