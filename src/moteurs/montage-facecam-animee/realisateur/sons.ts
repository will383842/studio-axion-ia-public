/**
 * BRUITAGES DÉRIVÉS DU PLAN (lot C, préfigure le lot E) — PUR.
 *
 * Mêmes VOLUMES que `bruitagesGalerie()` (`studio-rendu/compositions/interface-claire/Galerie.tsx`), validés à l'oreille
 * (10 à 13 dB sous la voix). Règle R6 du directeur artistique (15/10, vidéo 5 : « drop » faisait 53 % des sons) :
 * - CHAQUE FAMILLE A SON BRUITAGE PROPRE (`CATALOGUE_FAMILLES[f].sons`, `familles.ts`) : carte → drop_002 par
 *   sous-élément ; fenêtre → drop_004 (étiquette posée dessus), minimize_004 (noir et blanc) ; étiquette →
 *   maximize_004 (apparition et icônes), tick_001 (pas du compteur) ; chaque motion → son propre son à l'entrée et à
 *   chaque sous-élément (mot géant maximize_008, écran partagé select_001, téléphone click_001, carte de France
 *   select_002, notifications drop_001, chiffre maximize_006, trait click_003, volet minimize_006, ruban tick_002,
 *   horloge tick_004, jauge drop_003, bulles click_002) ;
 * - les WHOOSH sont réservés à ce qui ENTRE ou SORT du cadre (carte, fenêtre, écran partagé, volet, écran de fin) ;
 * - un même bruitage (famille de son : drop, tick, whoosh…) forme 30 % des sons au plus (contrôlé dans `regles.ts`).
 * Les sons sont les fichiers `studio-rendu/compositions/interface-claire/sons/<nom>.wav`. AUCUNE MUSIQUE (règle de
 * Will) : seuls les bruitages de `SONS_DISPONIBLES` sortent d'ici.
 */
import type { CalquePlan, ContenuCarte, MotionPlan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { ficheV3 } from "./catalogue-v3";
import { CATALOGUE_FAMILLES } from "./familles";

export type Bruitage = [number, string, number];

/** Les sons disponibles (fichiers du dossier `sons` du rendu, licence Kenney CC0). */
export const SONS_DISPONIBLES = Object.freeze([
  "whoosh-in", "whoosh-out", "drop_001", "drop_002", "drop_003", "drop_004", "minimize_004", "minimize_006", "maximize_004", "maximize_006", "maximize_008",
  "tick_001", "tick_002", "tick_004", "click_001", "click_002", "click_003", "select_001", "select_002", "confirmation_002",
] as const);

/** Cascade des cases cochées d'une liste (une case toutes les 0,08 s, comme le composant). */
const PAS_CASCADE_SEC = 0.08;
/** Le cadenas d'une pile de logos claque 0,22 s après son apparition (anse qui se ferme). */
const CADENAS_SEC = 0.22;
/** Tics d'un compteur au plus dans la bande-son (R6 : « tick » ne doit pas dépasser 30 % des sons). */
const TICS_COMPTEUR_MAX = 6;

/**
 * Copie de `ticsCompteur` (`etiquettes-plus.tsx`) : inverse de la courbe « ralentie en fin » — les tics se resserrent au
 * début et s'espacent à la fin ; 14 tics au plus.
 */
export function ticsCompteur(debut: number, de: number, a: number, dureeDefilement = 1.5, max = 14): number[] {
  const pas = Math.min(max, Math.abs(a - de));
  const tics: number[] = [];
  for (let i = 1; i <= pas; i++) {
    const p = i / pas;
    tics.push(debut + dureeDefilement * (1 - Math.pow(1 - p, 1 / 3)));
  }
  return tics;
}

/** Instants des « pops » d'une carte : ses sous-éléments, comme la galerie les a choisis type par type. */
export function popsCarte(c: ContenuCarte): number[] {
  const p: number[] = [];
  switch (c.type) {
    case "frise":
      p.push(...c.etapes.map((x) => x.a), ...(c.puces ?? []).map((x) => x.a));
      if (c.cocheA !== undefined) p.push(c.cocheA);
      if (c.badge) p.push(c.badge.a);
      break;
    case "chat":
      // La réponse qui s'écrit n'a pas de pop : sa première puce en a un.
      p.push(c.message.a, ...c.puces.map((x) => x.a));
      break;
    case "grille":
      for (const v of c.vignettes) {
        p.push(v.a);
        if (v.contenu.type === "fiche" && v.contenu.iconeA !== undefined) p.push(v.contenu.iconeA);
      }
      break;
    case "liste":
      p.push(...c.lignes.map((x) => x.a));
      if (c.cocheA !== undefined) c.lignes.forEach((_, k) => p.push(c.cocheA! + k * PAS_CASCADE_SEC));
      if (c.badge) p.push(c.badge.a);
      break;
    case "calendrier":
      p.push(...c.pastilles.map((x) => x.a), ...(c.rangee ?? []).map((x) => x.a));
      break;
    case "graphique":
      p.push(...c.barres.map((x) => x.a), ...(c.pastilles ?? []).map((x) => x.a));
      break;
    case "statuts":
      for (const l of c.lignes) {
        p.push(l.a);
        if (l.bascule !== undefined) p.push(l.bascule);
      }
      break;
    case "calcul":
      p.push(...c.avant.lignes.map((x) => x.a), c.avant.totalA, ...c.apres.lignes.map((x) => x.a), c.apres.totalA);
      if (c.badge) p.push(c.badge.a);
      break;
    case "logos":
      p.push(...c.tuiles.map((x) => x.a));
      if (c.cadenas) p.push(c.cadenas.a + CADENAS_SEC);
      break;
    case "commentaire":
      p.push(c.champ.a, c.bouton.a, c.commentaire.a);
      if (c.commentaire.jaimeA !== undefined) p.push(c.commentaire.jaimeA);
      if (c.notification) p.push(c.notification.a);
      break;
  }
  return p.sort((x, y) => x - y);
}

/** Instants des « pops » d'un calque (le premier est son apparition) et de ses tics de compteur. */
export function popsCalque(c: CalquePlan): { pops: number[]; tics: number[] } {
  if (c.type === "compteur") return { pops: [], tics: ticsCompteur(c.debut, c.de, c.a, c.dureeDefilement ?? 1.5, TICS_COMPTEUR_MAX) };
  const sous = c.type === "etiquette" ? (c.icones ?? []).map((x) => x.a) : c.type === "logos" ? c.logos.map((x) => x.a) : [];
  const pops = [c.debut];
  for (const a of [...sous].sort((x, y) => x - y)) if (a > pops[pops.length - 1] + 0.01) pops.push(a);
  return { pops, tics: [] };
}

/** Instants des sous-éléments d'une motion (tout champ `a` de son contenu), triés. */
export function instantsMotion(m: Pick<MotionPlan, "contenu">): number[] {
  const r: number[] = [];
  const parcourir = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(parcourir);
    if (!x || typeof x !== "object") return;
    for (const [cle, v] of Object.entries(x)) {
      if (typeof v === "number" && (cle === "a" || cle === "eclatA" || cle === "barreGaucheA")) r.push(v);
      else if (v && typeof v === "object") parcourir(v);
    }
  };
  parcourir(m.contenu);
  return r.sort((x, y) => x - y);
}

const arrondi = (x: number) => Math.round(Math.max(0, x) * 1000) / 1000;

/** La liste `sons` du plan : [instant, son, volume], triée dans le temps. */
export function bruitagesDuPlan(plan: Pick<PlanFacecamAnimee, "cartes" | "fenetres" | "calques" | "zooms" | "mouvements" | "fin"> & { motions?: readonly MotionPlan[]; elementsV3?: PlanFacecamAnimee["elementsV3"] }): Bruitage[] {
  const s: Bruitage[] = [];
  const [popCarte] = CATALOGUE_FAMILLES.carte.sons;
  const [etiquetteFenetre, noirEtBlanc] = CATALOGUE_FAMILLES.fenetre.sons;
  const [popEtiquette, ticCompteur] = CATALOGUE_FAMILLES.etiquette.sons;
  for (const c of plan.cartes) {
    s.push([c.debut - 0.02, "whoosh-in", 0.25], [c.fin - 0.12, "whoosh-out", 0.18]);
    for (const a of popsCarte(c.contenu)) s.push([a, popCarte, 0.04]);
  }
  for (const f of plan.fenetres) {
    s.push([f.debut - 0.02, "whoosh-in", 0.25], [f.fin - 0.12, "whoosh-out", 0.18]);
    if (f.etiquette) s.push([f.etiquette.a, etiquetteFenetre, 0.04]);
    if (f.noirEtBlancA !== undefined) s.push([f.noirEtBlancA, noirEtBlanc, 0.06]);
  }
  for (const c of plan.calques) {
    const { pops, tics } = popsCalque(c);
    pops.forEach((a, i) => s.push([a, popEtiquette, i === 0 ? 0.07 : 0.04]));
    tics.forEach((a) => s.push([a, ticCompteur, 0.05]));
  }
  for (const m of plan.motions ?? []) {
    const fiche = CATALOGUE_FAMILLES[m.famille];
    const [son] = fiche.sons;
    if (fiche.traverseCadre) s.push([m.debut - 0.02, "whoosh-in", 0.22], [m.fin - 0.12, "whoosh-out", 0.16]);
    else s.push([m.debut, son, 0.06]);
    // Le son d'entrée (posé sur le début) vaut pour un sous-élément qui tombe au même instant.
    for (const a of instantsMotion(m)) if (fiche.traverseCadre || Math.abs(a - m.debut) > 0.05) s.push([a, son, 0.05]);
  }
  // Éléments v3 : les bruitages de leur fiche (`catalogue-v3.ts`), calés sur leur début ou leur fin. Aucune musique.
  for (const e of plan.elementsV3 ?? []) {
    const fiche = ficheV3(e.id);
    if (fiche) for (const b of fiche.bruitages) s.push([(b.ref === "debut" ? e.debut : e.fin) + b.decalage, b.son, b.volume]);
  }
  // Anciens plans seulement (zooms et mouvements refusés depuis le 15/10).
  for (const [a] of plan.zooms) s.push([a, "click_002", 0.05]);
  for (const m of plan.mouvements ?? []) s.push(m.type === "zoom-rapide" ? [m.debut, "whoosh-in", 0.12] : m.type === "recul" ? [m.debut, "whoosh-out", 0.12] : [m.debut, "click_002", 0.05]);
  const f = plan.fin.debut;
  s.push([f - 0.02, "whoosh-in", 0.3], [f + 0.25, "drop_004", 0.05]);
  plan.fin.tuiles.forEach((_, i) => s.push([f + 0.45 + i * 0.09, "tick_001", 0.05]));
  s.push([f + 0.95, "confirmation_002", 0.06]);
  return s.map(([a, son, v]): Bruitage => [arrondi(a), son, v]).sort((x, y) => x[0] - y[0]);
}
