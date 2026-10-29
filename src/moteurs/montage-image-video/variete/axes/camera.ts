/**
 * Axe « caméra » de la variété (lot CAM-TRA). PUR, déterministe. Variantes (doc 72, axe 4 ; verdict v3) :
 * - CAM-B · vue d'ensemble d'abord : la première séquence de toile s'ouvre sur le schéma entier en silhouette (calque),
 *   la caméra part du zoom le plus large permis (0,8) et plonge sur le premier nœud ; la dernière séquence ressort au
 *   zoom 0,8 après le dernier mot (sauf si elle finit déjà sur une vue d'ensemble).
 * - CAM-C · le voyage du message : un point lumineux court sur le fil d'un nœud au suivant (calque) ; la caméra part
 *   plus tôt et roule plus lentement pour le suivre (même arrivée, même nombre d'images clés : mêmes bruitages).
 * - CAM-E · deux branches côte à côte : la suite des étapes d'un embranchement à deux branches devient un écran propre
 *   (bloc `variete`, axe caméra), la branche majoritaire à gauche, l'autre à droite ; elles avancent ensemble.
 * CAM-D est retirée (jamais produite).
 *
 * Règle Q15 : la trajectoire réécrite passe `controlerCamera` sans AUCUN défaut de plus que la référence ; sinon la
 * séquence garde sa trajectoire (et l'axe le dit dans `replis` s'il ne reste rien de la variante). La composition de la
 * toile recalcule sa caméra de référence : la trajectoire réécrite voyage dans `variete.donnees.camera`, et le calque
 * `studio-rendu/…/variete/camera/calque.tsx` corrige l'image de l'une vers l'autre.
 */
import { BORNES_CAMERA, boiteALEcran, cameraA, dureeMouvement, mesurerTrajectoire } from "@/briques/schema-motion/camera";
import { ECRAN_IV } from "@/briques/schema-motion/types";
import { disposerEtCadrer } from "@/briques/schema-motion/cadrage";
import { largeurAnton } from "@/briques/schema-motion/chasse-anton";
import type { EnteteSceneIV, ImageCleCamera, PoseCamera } from "@/briques/schema-motion/types";
import { type CodeVariante, type FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { controlerCamera } from "../../controles-scene";
import { cadrageToile, type BlocRenduIV, type PlanIV } from "../../mise-en-scene";
import type { AxeVarieteIV, EtapeVarieteIV, RepliVarieteIV } from "../index";

type BlocToile = Extract<BlocRenduIV, { sorte: "toile" }>;

/** Données d'une séquence de toile filmée par CAM-B ou CAM-C (lues par le calque caméra). */
export type DonneesCameraToileIV = {
  code: "CAM-B" | "CAM-C";
  /** Trajectoire réécrite (égale à `bloc.trajectoire.images`), à la place de celle que la composition recalcule. */
  trajectoire: ImageCleCamera[];
  fond: "ivoire" | "sombre";
  entetes?: EnteteSceneIV[];
  /** CAM-B : le schéma en silhouette couvre l'écran de 0 à `fin` (s), puis la caméra plonge. */
  vue?: { fin: number; noeud: string; icone?: string };
  /** CAM-C : courses du point lumineux sur le fil (de → vers), en secondes depuis le début de la séquence. */
  courses?: { de: string; vers: string; t0: number; t1: number }[];
  /** CAM-C : icônes des nœuds (cartes en attente sous les sous-titres) et vues d'ensemble (où elles s'effacent). */
  icones?: Record<string, string>;
  ensembles?: { debut: number; fin: number }[];
};

/** Une étape d'une branche de CAM-E : son libellé (sans détail chiffré), son icône, l'heure où elle s'allume. */
export type EtapeCameraEIV = { id: string; libelle: string; icone?: string; t: number };
/** Une branche de CAM-E : sa part (montrée à son mot, jamais avant), sa couleur, ses étapes. */
export type BrancheCameraEIV = { titre: string; part?: { texte: string; t: number }; couleur: "orange" | "noir"; etapes: EtapeCameraEIV[] };
/** Données du bloc `variete` de CAM-E (écran `camera/ecran.tsx`). */
export type DonneesCameraEcranIV = { code: "CAM-E"; fond: "ivoire"; branches: [BrancheCameraEIV, BrancheCameraEIV] };

/** Réglages de l'axe. */
export const REGLES_CAMERA_IV = Object.freeze({
  /** CAM-B : la silhouette d'ensemble dure jusqu'à 0,4 s après le premier mot (0,9 à 2,6 s) ; la plongée part 0,3 s avant sa fin. */
  vueMin: 0.9,
  vueMax: 2.6,
  vueApresMot: 0.4,
  plongeeAvance: 0.3,
  plongeeMin: 0.8,
  /** CAM-B : la sortie (dézoom) dure 1 s et ne commence pas avant 0,6 s après le dernier mot. */
  sortie: 1,
  apresDernierMot: 0.6,
  /** CAM-C : un nœud reste lu 0,6 s avant que la caméra ne le quitte ; une course dure 1,6 s au plus. */
  lectureAvantDepart: 0.6,
  courseMax: 1.6,
  /** CAM-C : course du point sans mouvement de caméra : finie 0,15 s avant le mot, 0,8 s au plus. */
  courseSansCamera: 0.8,
  /** CAM-E : largeur minimale d'une branche à l'écran (px) ; libellé d'étape en Anton de 76 px, 58 px au moins ; marges. */
  largeurMinBranche: 400,
  tailleEtape: 76,
  tailleMinEtape: 58,
  margeEtape: 30,
  /** Largeur où le texte se lit (zones protégées, doc 74 § 3) : 9:16 x 65 → 886, 4:5 x 60 → 1020 ; gouttière 16 px. */
  largeurTexte: { "9:16": 821, "4:5": 960 } as Record<FormatIV, number>,
  gouttiere: 16,
});

const R = REGLES_CAMERA_IV;
const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/* ------------------------------------------------------------------ */
/* Possibles                                                             */
/* ------------------------------------------------------------------ */

/** Les deux branches d'un embranchement (majoritaire d'abord), ou `null`. */
function branchesDe(carte: CarteImage) {
  const b = carte.groupes.filter((g) => g.sorte === "branche" && g.noeuds.length >= 2);
  if (b.length !== 2) return null;
  return [...b].sort((x, y) => Number(!!y.majoritaire) - Number(!!x.majoritaire));
}

/** Largeur d'une branche de CAM-E à l'écran (les deux se partagent la largeur où le texte se lit). */
export function largeurBrancheCamE(format: FormatIV): number {
  return (R.largeurTexte[format] - R.gouttiere) / 2;
}

/** Largeur qu'il faut à une branche : son mot le plus long à la plus petite taille permise, plus les marges de la carte. */
function largeurNecessaire(libelles: readonly string[]): number {
  const mots = libelles.flatMap((l) => l.toUpperCase().split(/\s+/)).filter(Boolean);
  return Math.max(0, ...mots.map((m) => largeurAnton(m, R.tailleMinEtape))) + 2 * R.margeEtape;
}

/** CAM-E est-il impossible ? La raison, sinon `null`. */
export function refusCamE(carte: CarteImage, format: FormatIV): string | null {
  const b = branchesDe(carte);
  if (!b) return "il faut un embranchement à deux branches d'au moins deux étapes";
  const dispo = largeurBrancheCamE(format);
  for (const g of b) {
    const libelles = g.noeuds.map((id) => carte.noeuds.find((n) => n.id === id)?.libelle ?? "");
    const faut = Math.max(R.largeurMinBranche, largeurNecessaire(libelles));
    if (dispo < faut) return `la branche « ${g.titre ?? g.id} » ferait ${Math.round(dispo)} px à l'écran en ${format} (${Math.round(faut)} px au moins)`;
  }
  return null;
}

function possiblesCamera(carte: CarteImage, format: FormatIV): CodeVariante<"camera">[] {
  const codes: CodeVariante<"camera">[] = [];
  if (carte.liens.length >= 3) codes.push("CAM-B");
  if (carte.liens.length >= 3 && carte.noeuds.some((n) => n.role === "declencheur")) codes.push("CAM-C");
  if (!refusCamE(carte, format)) codes.push("CAM-E");
  return codes;
}

/* ------------------------------------------------------------------ */
/* Contrôle : jamais pire que la référence                               */
/* ------------------------------------------------------------------ */

function defautsCamera(b: BlocToile, images: ImageCleCamera[]): Set<string> {
  const r = controlerCamera({ id: b.id, toile: b.toile, trajectoire: { images, alertes: b.trajectoire.alertes }, mots: b.proprietes.mots, cadrage: b.cadrage });
  return new Set([...r.q15, ...r.coupes]);
}

/** La trajectoire réécrite n'ajoute aucun défaut Q15 (vitesse, zoom, nœud entier sur son mot, lisibilité, coupe). */
export function trajectoireSure(b: BlocToile, images: ImageCleCamera[]): boolean {
  const m = mesurerTrajectoire({ images });
  if (m.vitesseMax > BORNES_CAMERA.vitesseMax + 1e-3 || m.zoomMin < BORNES_CAMERA.zoomMin - 1e-6 || m.zoomMax > BORNES_CAMERA.zoomMax + 1e-6) return false;
  const ref = defautsCamera(b, b.trajectoire.images);
  for (const d of defautsCamera(b, images)) if (!ref.has(d)) return false;
  return true;
}

const memePose = (a: PoseCamera, b: PoseCamera) => Math.abs(a.cx - b.cx) < 1e-6 && Math.abs(a.cy - b.cy) < 1e-6 && Math.abs(a.zoom - b.zoom) < 1e-6;
const dansEnsemble = (b: BlocToile, t0: number, t1: number) => (b.proprietes.ensembles ?? []).some((e) => e.debut - 0.3 < t1 && e.fin > t0);

/* ------------------------------------------------------------------ */
/* CAM-B · vue d'ensemble, plongée, sortie                               */
/* ------------------------------------------------------------------ */

/** Poses larges candidates (zoom 0,8 d'abord) autour d'une pose : même centre, puis centre de la toile. */
function posesLarges(b: BlocToile, p: PoseCamera): PoseCamera[] {
  const c = { cx: b.toile.largeur / 2, cy: b.toile.hauteur / 2 };
  const zooms = [BORNES_CAMERA.zoomMin, 0.9, Math.max(BORNES_CAMERA.zoomMin, p.zoom * 0.85)];
  return [...zooms.map((zoom) => ({ cx: p.cx, cy: p.cy, zoom })), ...zooms.map((zoom) => ({ ...c, zoom }))].filter((x) => x.zoom < p.zoom - 1e-6);
}

/** Ouverture en plan large : O (0 → plongée), plongée vers la première pose. `null` si la place manque ou si Q15 refuse. */
function ouvrirLarge(b: BlocToile, images: ImageCleCamera[], vueFin: number): ImageCleCamera[] | null {
  if (images.length === 0 || dansEnsemble(b, 0, vueFin + R.plongeeMin)) return null;
  const p0 = images[0];
  const suivante = images[1]?.t ?? b.proprietes.dureeSec;
  for (const o of posesLarges(b, p0)) {
    const duree = Math.max(R.plongeeMin, dureeMouvement(o, p0));
    // La plongée de la caméra part 0,3 s avant la fin de la silhouette, ou plus tôt (cachée dessous) s'il le faut.
    const debut = arrondi(Math.min(vueFin - R.plongeeAvance, suivante - duree));
    const fin = arrondi(debut + duree);
    if (debut < 0.3) continue;
    const essai = [{ t: 0, ...o }, { t: debut, ...o }, { t: fin, cx: p0.cx, cy: p0.cy, zoom: p0.zoom }, ...images.slice(1)];
    if (trajectoireSure(b, essai)) return essai;
  }
  return null;
}

/** Sortie en plan large après le dernier mot (la dernière image clé tient la pose jusqu'à la fin). */
function sortirLarge(b: BlocToile, images: ImageCleCamera[]): ImageCleCamera[] | null {
  const duree = b.proprietes.dureeSec;
  const dernierMot = Math.max(0, ...b.proprietes.mots.map((m) => m.t));
  const debut = arrondi(duree - R.sortie);
  if (images.length < 2 || debut < dernierMot + R.apresDernierMot || dansEnsemble(b, debut, duree)) return null;
  const fin = images[images.length - 1];
  const tenue = images[images.length - 2];
  if (!memePose(fin, tenue) || tenue.t > debut + 1e-9) return null;
  for (const o of posesLarges(b, fin)) {
    const essai = [...images.slice(0, -1), { ...tenue, t: debut }, { t: arrondi(duree), ...o }];
    if (trajectoireSure(b, essai)) return essai;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* CAM-C · le point lumineux sur le fil                                  */
/* ------------------------------------------------------------------ */

/**
 * Temps (s) pendant lequel une carte reste COUPÉE par le haut du cadre (sous l'en-tête) entre `t0` et `t1` : une part
 * au-dessus de la ligne, une part dessous (lot F : sinon le titre de l'en-tête chevauche une carte à moitié effacée
 * pendant tout un mouvement lent).
 */
export function tempsCoupeCadreIV(b: BlocToile, images: readonly ImageCleCamera[], t0: number, t1: number): number {
  const ligne = (b.cadrage?.cadre?.haut ?? 0) * ECRAN_IV.hauteur;
  if (!ligne) return 0;
  const pas = 0.05;
  let n = 0;
  for (let t = t0; t < t1 - 1e-9; t += pas) {
    const pose = cameraA({ images: [...images] }, t);
    if (b.toile.boites.some((x) => {
      const e = boiteALEcran(x, pose);
      return e.y < ligne - 10 && e.y + e.hauteur > ligne + 10;
    })) n++;
  }
  return n * pas;
}

/** Allonge chaque mouvement vers un nœud relié par un fil (départ plus tôt, même arrivée) et pose les courses du point. */
function suivreLeMessage(b: BlocToile): { images: ImageCleCamera[]; courses: NonNullable<DonneesCameraToileIV["courses"]> } {
  const mots = [...b.proprietes.mots].sort((x, y) => x.t - y.t || x.noeud.localeCompare(y.noeud));
  const fils = new Set(b.toile.fleches.map((f) => `${f.de}>${f.vers}`));
  const images = b.trajectoire.images.map((x) => ({ ...x }));
  const courses: NonNullable<DonneesCameraToileIV["courses"]> = [];
  for (let i = 1; i < mots.length; i++) {
    const a = mots[i - 1];
    const v = mots[i];
    if (a.noeud === v.noeud || !fils.has(`${a.noeud}>${v.noeud}`)) continue;
    // Le mouvement de caméra qui arrive pour ce mot : image k (arrivée) précédée de la tenue k − 1.
    const k = images.findIndex((x, j) => j > 0 && x.t > a.t && x.t <= v.t + 1e-9 && !memePose(images[j - 1], x));
    if (k > 0 && !dansEnsemble(b, images[k - 1].t, images[k].t)) {
      const tenue = images[k - 1];
      const plusTot = Math.max(a.t + R.lectureAvantDepart, images[k - 2]?.t ?? 0, images[k].t - R.courseMax);
      if (k >= 2 && plusTot < tenue.t - 0.05 && memePose(images[k - 2], tenue) && !dansEnsemble(b, plusTot, images[k].t)) {
        // Du départ le plus tôt au départ d'origine : le premier qui tient Q15 sans couper une carte plus longtemps que
        // la caméra de référence sous l'en-tête.
        const coupeRef = tempsCoupeCadreIV(b, images, plusTot, images[k].t);
        for (let depart = plusTot; depart < tenue.t - 0.05; depart += 0.1) {
          const essai = images.map((x, j) => (j === k - 1 ? { ...x, t: arrondi(depart) } : x));
          if (tempsCoupeCadreIV(b, essai, plusTot, images[k].t) <= coupeRef + 0.1 + 1e-9 && trajectoireSure(b, essai)) {
            images[k - 1] = essai[k - 1];
            break;
          }
        }
      }
      // Un mouvement court : le point part plus tôt que la caméra (0,8 s de course au plus, jamais avant le mot d'avant).
      const t1 = images[k].t;
      const t0 = arrondi(Math.min(images[k - 1].t, Math.max(a.t + 0.3, t1 - R.courseSansCamera)));
      if (!dansEnsemble(b, t0, t1)) courses.push({ de: a.noeud, vers: v.noeud, t0, t1 });
    } else {
      const t1 = arrondi(v.t - 0.15);
      const t0 = arrondi(Math.max(a.t + 0.3, t1 - R.courseSansCamera));
      if (t1 - t0 >= 0.3 && !dansEnsemble(b, t0, t1)) courses.push({ de: a.noeud, vers: v.noeud, t0, t1 });
    }
  }
  return { images, courses };
}

/* ------------------------------------------------------------------ */
/* CAM-E · deux branches côte à côte                                     */
/* ------------------------------------------------------------------ */

/** Coupe une séquence de toile à `fin` (relative) : mots, coches, en-têtes, ensembles d'avant ; caméra recalculée. */
function couperToile(b: BlocToile, fin: number): BlocToile {
  const p = b.proprietes;
  const avant = <T extends { t: number }>(l?: T[]) => (l ?? []).filter((x) => x.t < fin);
  const mots = avant(p.mots);
  const separations = avant(p.separations);
  const coches = avant(p.coches);
  const entetes = (p.entetes ?? []).filter((e) => e.debut < fin).map((e) => ({ ...e, fin: Math.min(e.fin, fin) }));
  const ensembles = (p.ensembles ?? []).filter((e) => e.fin <= fin);
  const proprietes = {
    ...p,
    dureeSec: arrondi(fin),
    mots,
    ...(separations.length ? { separations } : { separations: undefined }),
    ...(coches.length ? { coches } : { coches: undefined }),
    ...(entetes.length ? { entetes } : { entetes: undefined }),
    ...(ensembles.length ? { ensembles } : { ensembles: undefined }),
  };
  for (const k of ["separations", "coches", "entetes", "ensembles"] as const) if (proprietes[k] === undefined) delete proprietes[k];
  const cadree = disposerEtCadrer(p.schema, mots, proprietes.dureeSec, (toile) => cadrageToile({ ...proprietes, hauteur: p.hauteur }, toile));
  return { ...b, fin: arrondi(b.debut + fin), proprietes, trajectoire: cadree.trajectoire, toile: cadree.toile, cadrage: cadree.cadrage };
}

/** Pose CAM-E sur la séquence de toile où l'on parle des étapes de la branche majoritaire. */
function cotesACote(e: EtapeVarieteIV): { blocs: BlocRenduIV[]; repli?: string } {
  const refus = refusCamE(e.carte, e.format);
  if (refus) return { blocs: e.blocs, repli: refus };
  const [maj, autre] = branchesDe(e.carte)!;
  const i = e.blocs.findIndex((b) => b.sorte === "toile" && b.proprietes.mots.some((m) => maj.noeuds.includes(m.noeud)));
  if (i < 0) return { blocs: e.blocs, repli: "aucune séquence de toile ne parle de la branche majoritaire" };
  const b = e.blocs[i] as BlocToile;
  const motsMaj = b.proprietes.mots.filter((m) => maj.noeuds.includes(m.noeud)).sort((x, y) => x.t - y.t);
  const coupe = arrondi(Math.max(0, motsMaj[0].t - 0.3));
  if (coupe < 1) return { blocs: e.blocs, repli: "la branche commence avec la séquence : rien pour l'amener" };
  const avant = couperToile(b, coupe);
  if (!trajectoireSureSeule(avant)) return { blocs: e.blocs, repli: "la séquence coupée ne tient pas Q15" };
  const noeud = (id: string) => e.carte.noeuds.find((n) => n.id === id);
  const iconeSchema = (id: string) => b.proprietes.schema.noeuds.find((n) => n.id === id)?.icone;
  const heures = motsMaj.filter((m, k, l) => l.findIndex((x) => x.noeud === m.noeud) === k).map((m) => arrondi(m.t - coupe));
  const etapes = (g: typeof maj): EtapeCameraEIV[] =>
    g.noeuds.map((id, k) => ({ id, libelle: noeud(id)?.libelle ?? id, ...(iconeSchema(id) ? { icone: iconeSchema(id) } : {}), t: heures[Math.min(k, heures.length - 1)] ?? 0 }));
  // La part n'apparaît qu'une fois dite (jamais un chiffre avant son mot) ; dite plus tard, elle n'est pas montrée ici.
  const lien = (g: typeof maj) => e.carte.liens.find((l) => g.noeuds.includes(l.vers) && l.part !== undefined);
  const dureeVar = arrondi(b.fin - b.debut - coupe);
  const part = (g: typeof maj): BrancheCameraEIV["part"] => {
    const l = lien(g);
    if (!l) return undefined;
    const texte = `${l.part} %`;
    const dit = e.chiffresDits.find((c) => c.brut.replace(/\s+/g, " ") === texte);
    if (!dit) return undefined;
    const t = arrondi(Math.max(0, dit.t - (b.debut + coupe)));
    return t < dureeVar ? { texte, t } : undefined;
  };
  const donnees: DonneesCameraEcranIV = {
    code: "CAM-E",
    fond: "ivoire",
    branches: [
      { titre: maj.titre ?? "", ...(part(maj) ? { part: part(maj) } : {}), couleur: "orange", etapes: etapes(maj) },
      { titre: autre.titre ?? "", ...(part(autre) ? { part: part(autre) } : {}), couleur: "noir", etapes: etapes(autre) },
    ],
  };
  const ecran: BlocRenduIV = { id: `${b.id}-cam-e`, debut: avant.fin, fin: b.fin, sorte: "variete", axe: "camera", code: "CAM-E", donnees, ...(b.variete ? { variete: b.variete } : {}) };
  const manque = changementNonDessineCamE(b, coupe, donnees, e.plans);
  if (manque) return { blocs: e.blocs, repli: manque };
  return { blocs: [...e.blocs.slice(0, i), avant, ecran, ...e.blocs.slice(i + 1)] };
}

/** Écart permis entre un changement compté (Q14) et ce que l'écran dessine (règle d'or, relecture de #323). */
const ECART_DESSIN_SEC = 0.4;

/**
 * Règle d'or « rien de compté qui ne soit dessiné » (intégration de la variété) : CAM-E remplace la fin d'une toile ; tout
 * ce que la toile faisait changer après la coupe (mot d'un nœud, coche, séparation, en-tête, vue d'ensemble, début de
 * plan) et que les contrôles comptent doit avoir un changement de l'écran côte à côte à ± 0,4 s, et tout nœud parlé doit
 * être une étape d'une des deux branches. Sinon la raison du repli (CAM-A garde la toile), jamais un écran qui se fige
 * pendant que le rythme compté avance. `null` : CAM-E dessine tout.
 */
function changementNonDessineCamE(b: BlocToile, coupe: number, d: DonneesCameraEcranIV, plans: readonly PlanIV[]): string | null {
  const p = b.proprietes;
  const etapes = new Set(d.branches.flatMap((x) => x.etapes.map((y) => y.id)));
  const dessines = [0, ...d.branches.flatMap((x) => [...x.etapes.map((y) => y.t), ...(x.part ? [x.part.t] : [])])];
  const parles = [...p.mots, ...(p.separations ?? []), ...(p.coches ?? [])].filter((m) => m.t >= coupe);
  const etranger = parles.find((m) => !etapes.has(m.noeud));
  if (etranger) return `l'écran côte à côte ne montre pas le nœud ${etranger.noeud} dont parle la voix`;
  const comptes = [
    ...parles.map((m) => m.t),
    ...(p.entetes ?? []).map((x) => x.debut),
    ...(p.ensembles ?? []).flatMap((x) => [x.debut, x.fin]),
    ...plans.map((x) => x.debut - b.debut),
  ].filter((t) => t > coupe + 1e-6 && t < b.fin - b.debut - 1e-6);
  const seul = comptes.find((t) => !dessines.some((x) => Math.abs(x - (t - coupe)) <= ECART_DESSIN_SEC + 1e-6));
  return seul === undefined ? null : `l'écran côte à côte ne change pas à ${arrondi(b.debut + seul)} s, où le rythme compte un changement`;
}

function trajectoireSureSeule(b: BlocToile): boolean {
  const r = controlerCamera({ id: b.id, toile: b.toile, trajectoire: b.trajectoire, mots: b.proprietes.mots, cadrage: b.cadrage });
  return r.q15.length === 0 && r.coupes.length === 0;
}

/* ------------------------------------------------------------------ */
/* Application                                                           */
/* ------------------------------------------------------------------ */

function poserDonnees(b: BlocToile, d: DonneesCameraToileIV): BlocToile {
  const v = b.variete!;
  return { ...b, trajectoire: { ...b.trajectoire, images: d.trajectoire }, variete: { ...v, donnees: { ...v.donnees, camera: d } } };
}

function appliquerCamera(e: EtapeVarieteIV): EtapeVarieteIV {
  const code = e.recette.camera;
  if (code === "CAM-A" || code === "CAM-D") return e;
  const repli = (raison: string): EtapeVarieteIV => ({ ...e, replis: [...e.replis, { axe: "camera", code, raison } satisfies RepliVarieteIV] });
  if (code === "CAM-E") {
    const r = cotesACote(e);
    return r.repli ? repli(r.repli) : { ...e, blocs: r.blocs };
  }
  const toiles = e.blocs.map((b, i) => (b.sorte === "toile" && b.variete ? i : -1)).filter((i) => i >= 0);
  if (!toiles.length) return repli("aucune séquence de toile");
  const blocs = [...e.blocs];
  let pose = false;
  if (code === "CAM-B") {
    const premier = toiles[0];
    const dernier = toiles[toiles.length - 1];
    for (const i of new Set([premier, dernier])) {
      const b = blocs[i] as BlocToile;
      let images = b.trajectoire.images;
      let vue: DonneesCameraToileIV["vue"];
      if (i === premier) {
        const premierMot = [...b.proprietes.mots].sort((x, y) => x.t - y.t)[0];
        const vueFin = arrondi(Math.min(R.vueMax, Math.max(R.vueMin, (premierMot?.t ?? 0) + R.vueApresMot)));
        const o = premierMot ? ouvrirLarge(b, images, vueFin) : null;
        if (o && premierMot) {
          images = o;
          const icone = b.proprietes.schema.noeuds.find((n) => n.id === premierMot.noeud)?.icone;
          vue = { fin: vueFin, noeud: premierMot.noeud, ...(icone ? { icone } : {}) };
        }
      }
      if (i === dernier) images = sortirLarge({ ...b, trajectoire: { ...b.trajectoire, images } }, images) ?? images;
      if (images === b.trajectoire.images) continue;
      blocs[i] = poserDonnees(b, { code, trajectoire: images, fond: b.proprietes.fond, ...(b.proprietes.entetes ? { entetes: b.proprietes.entetes } : {}), ...(vue ? { vue } : {}) });
      pose = true;
    }
  } else {
    for (const i of toiles) {
      const b = blocs[i] as BlocToile;
      const s = suivreLeMessage(b);
      if (!s.courses.length) continue;
      const icones = Object.fromEntries(b.proprietes.schema.noeuds.filter((n) => n.icone).map((n) => [n.id, n.icone!]));
      const ensembles = (b.proprietes.ensembles ?? []).map((x) => ({ debut: x.debut, fin: x.fin }));
      blocs[i] = poserDonnees(b, { code, trajectoire: s.images, fond: b.proprietes.fond, ...(b.proprietes.entetes ? { entetes: b.proprietes.entetes } : {}), courses: s.courses, icones, ...(ensembles.length ? { ensembles } : {}) });
      pose = true;
    }
  }
  return pose ? { ...e, blocs } : repli(code === "CAM-B" ? "aucune séquence ne laisse la place d'un plan large (Q15)" : "aucun fil à parcourir");
}

export const AXE_CAMERA: AxeVarieteIV = {
  axe: "camera",
  possibles: possiblesCamera,
  appliquer: appliquerCamera,
};

