/**
 * SORTIES PAR RÉSEAU (plan « formats par réseau », tâche T1). PUR : importable côté client et côté serveur.
 *
 * Tout est lu dans le registre des réseaux (`./index.ts`) :
 *  - `dimensions(ratio)` : la taille de l'image d'un format ;
 *  - `zoneSure(ratio, reseaux)` : les marges où rien d'important n'est écrit, pour un format et des réseaux ;
 *  - `sortiesVoulues(reseaux)` : les fichiers dont ces réseaux ont besoin ;
 *  - `meilleureSortie(reseau, sorties)` : le fichier à envoyer à un réseau parmi ceux fabriqués ;
 *  - `formatsVoulus(base, reseaux, capacites)` : les formats d'une vidéo, préférés des réseaux compris (T5) ;
 *  - `fichierDejaFait(existants, sortie)` : un fichier du même format, de la même fin et des mêmes réseaux est déjà
 *    enregistré ;
 *  - `libelleFichierEnvoye(sortie)` : « Fichier envoyé : 4:5 · 1080 × 1350 », affiché dans le kit.
 *
 * Un FICHIER = un format d'image ET une variante de fin : avec la fin « Écrivez MOT en commentaire » (permise sur
 * Instagram et Facebook seulement) ou sans elle.
 *
 * T1 = ajout seul. T4 : le kit et l'envoi (`services/publications.ts`) choisissent le fichier de chaque réseau avec
 * `meilleureSortie`, l'enregistrement des fichiers (`services/travaux.ts`) reconnaît un fichier avec `fichierDejaFait`.
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { ZONES_SURES } from "@/briques/motion/jetons";
import { listerReseaux, obtenirReseau, type ZoneProtegee } from "./index";

/** Ordre des formats d'image (affichage, liste des fichiers voulus). */
const ORDRE_RATIOS: readonly Ratio[] = ["9:16", "4:5", "1:1", "16:9"];

/** Taille d'une image, en pixels. */
export interface Dimensions {
  largeur: number;
  hauteur: number;
}

/**
 * Taille de l'image d'un format, lue dans la résolution d'export du registre (« 1080x1350 » → 1080 × 1350).
 * Lève une erreur claire pour un format qu'aucun réseau ne connaît, ou si deux réseaux disent deux tailles.
 */
export function dimensions(ratio: Ratio): Dimensions {
  const valeurs = new Set(listerReseaux().map((r) => r.export.resolution[ratio]).filter((v): v is string => !!v));
  if (valeurs.size !== 1) throw new Error(`Dimensions inconnues ou contradictoires pour le format « ${ratio} » (${[...valeurs].join(", ") || "aucune"}).`);
  const m = /^(\d+)x(\d+)$/.exec([...valeurs][0]);
  if (!m) throw new Error(`Résolution illisible pour le format « ${ratio} ».`);
  return { largeur: Number(m[1]), hauteur: Number(m[2]) };
}

/* ------------------------------------------------------------------ */
/* Zones sûres                                                          */
/* ------------------------------------------------------------------ */

/** Le plus prudent des deux, bord par bord. */
function union(a: ZoneProtegee, b: ZoneProtegee): ZoneProtegee {
  return { haut: Math.max(a.haut, b.haut), droite: Math.max(a.droite, b.droite), bas: Math.max(a.bas, b.bas), gauche: Math.max(a.gauche, b.gauche) };
}

/** Zone de la charte motion (fractions : 0,07) → pourcentages (7), sans reste de virgule flottante. */
function charteEnPourcent(ratio: keyof typeof ZONES_SURES): ZoneProtegee {
  const z = ZONES_SURES[ratio];
  const p = (f: number): number => Math.round(f * 10000) / 100;
  return { haut: p(z.haut), droite: p(z.droite), bas: p(z.bas), gauche: p(z.gauche) };
}

/**
 * Plancher de chaque format, en POURCENTAGES : la charte motion (`ZONES_SURES`) pour 9:16, 4:5 et 1:1 ; pour le 16:9,
 * le « titre sûr » de la télévision et de YouTube (6 % en haut, 5 % sur les côtés, 12 % en bas). Même règle que le face
 * caméra (`briques/formats-facecam/zones.ts`, `PLANCHER_ZONES`), qui la lira ici à la tâche T3.
 */
export const PLANCHER_ZONE_SURE: Readonly<Record<Ratio, ZoneProtegee>> = Object.freeze({
  "9:16": charteEnPourcent("9:16"),
  "4:5": charteEnPourcent("4:5"),
  "1:1": charteEnPourcent("1:1"),
  "16:9": { haut: 6, droite: 5, bas: 12, gauche: 5 },
});

/**
 * Zone d'un réseau pour un format, en pourcentages : l'union de sa zone protégée, de sa zone complémentaire et des
 * zones de ses emplacements dans ce format. `null` si le réseau n'accepte pas ce format ou n'en connaît aucune zone.
 */
export function zoneDuReseau(id: IdReseau, ratio: Ratio): ZoneProtegee | null {
  const r = obtenirReseau(id);
  if (!r.ratios.includes(ratio)) return null;
  const zones = [r.zonesProtegees[ratio], r.zonesComplementaires?.[ratio], ...r.emplacements.filter((e) => e.ratio === ratio).map((e) => e.zone)].filter(
    (z): z is ZoneProtegee => !!z,
  );
  return zones.length ? zones.reduce(union) : null;
}

/**
 * Zone sûre d'un format pour des réseaux, en POURCENTAGES (comme le registre) : l'union la plus stricte des zones de
 * ces réseaux et du plancher du format. Sans réseau donné : tous les réseaux qui acceptent ce format.
 */
export function zoneSure(ratio: Ratio, reseaux: readonly IdReseau[] = []): ZoneProtegee {
  const ids = reseaux.length ? reseaux : listerReseaux().filter((r) => r.ratios.includes(ratio)).map((r) => r.id);
  return ids.reduce<ZoneProtegee>((acc, id) => {
    const z = zoneDuReseau(id, ratio);
    return z ? union(acc, z) : acc;
  }, { ...PLANCHER_ZONE_SURE[ratio] });
}

/* ------------------------------------------------------------------ */
/* Fichiers voulus et choix du fichier                                  */
/* ------------------------------------------------------------------ */

/** Un fichier dont des réseaux ont besoin. */
export interface SortieVoulue {
  ratio: Ratio;
  /** Vrai : la fin « Écrivez MOT en commentaire » ; faux : fin propre, sans appel au mot. */
  appelAuMot: boolean;
  /** Les réseaux servis par ce fichier, dans l'ordre du registre. */
  reseaux: IdReseau[];
  /** « 9:16 » ou « 9:16 · sans appel au mot ». */
  libelle: string;
}

/**
 * Les fichiers dont ces réseaux ont besoin : pour chaque réseau, son format préféré (`ratioPrefere`), avec la fin au
 * mot s'il la permet, sans elle sinon. Les réseaux qui veulent le même fichier sont regroupés. Ordre : 9:16, 4:5, 1:1,
 * 16:9 ; pour un même format, le fichier avec la fin au mot d'abord. Aucun réseau : aucun fichier.
 */
export function sortiesVoulues(reseaux: readonly IdReseau[]): SortieVoulue[] {
  const voulus = new Set(reseaux);
  const sorties: SortieVoulue[] = [];
  for (const r of listerReseaux()) {
    if (!voulus.has(r.id)) continue;
    const auMot = finVoulue(r.id, r.ratioPrefere);
    const existante = sorties.find((s) => s.ratio === r.ratioPrefere && s.appelAuMot === auMot);
    if (existante) existante.reseaux.push(r.id);
    else sorties.push({ ratio: r.ratioPrefere, appelAuMot: auMot, reseaux: [r.id], libelle: auMot ? r.ratioPrefere : `${r.ratioPrefere} · sans appel au mot` });
  }
  return sorties.sort((a, b) => ORDRE_RATIOS.indexOf(a.ratio) - ORDRE_RATIOS.indexOf(b.ratio) || Number(b.appelAuMot) - Number(a.appelAuMot));
}

/**
 * T5 : formats d'image VOULUS d'une vidéo. `base` (les formats déjà choisis, dans leur ordre, jamais retirés), plus le
 * format préféré (`ratioPrefere`) de chaque réseau, limité à ce que le moteur sait faire (`capacites`). Les formats
 * ajoutés viennent après la base, dans l'ordre 9:16, 4:5, 1:1, 16:9.
 * Décision 3 de Will (18/10) : jamais de 16:9 ajouté d'office quand le format maître est vertical (prise verticale : un
 * 16:9 demanderait un zoom ou un fond inventé). Format maître non donné : 9:16 (jamais de 16:9 ajouté sans un format
 * maître horizontal dit). Un réseau dont le préféré n'est pas faisable ne reçoit rien de plus : `meilleureSortie` lui
 * choisira le meilleur fichier fait (T4).
 */
export function formatsVoulus(base: readonly Ratio[], reseaux: readonly IdReseau[], capacites: readonly Ratio[], ratioMaitre: Ratio = "9:16"): Ratio[] {
  const voulus = new Set(reseaux.map((id) => obtenirReseau(id).ratioPrefere));
  const vertical = ratioMaitre !== "16:9";
  const ajouts = ORDRE_RATIOS.filter((r) => voulus.has(r) && capacites.includes(r) && !(vertical && r === "16:9"));
  return [...new Set([...base, ...ajouts])];
}

/** Ce que `meilleureSortie` regarde d'un fichier fabriqué. */
export interface SortieCandidate {
  ratio: Ratio;
  /** Vrai : la fin dit « Écrivez MOT en commentaire » ; faux : fin propre ; absent : fichier d'avant, fin inconnue. */
  appelAuMot?: boolean;
  /** Réseaux pour lesquels ce fichier a été fait (absent : fichier d'avant). */
  reseaux?: readonly IdReseau[];
}

/**
 * Décision de Will du 18/10 16 h 55 : YouTube garde par défaut le fichier au mot (écrivez MOT en commentaire) sur son 16:9. Le registre
 * dit `fin.auMot` faux pour YouTube, mais son 16:9 reçoit la fin au mot, comme avant T4 : ce format est permis à ce
 * réseau avec la fin au mot, et c'est celui qu'il préfère (`finVoulue`). Jamais TikTok, Shorts ni LinkedIn.
 */
export const FIN_AU_MOT_TOLEREE: Readonly<Partial<Record<IdReseau, readonly Ratio[]>>> = Object.freeze({ youtube: ["16:9"] });

/** La fin voulue par ce réseau sur ce format : au mot si le registre la permet, ou si le format est toléré (YouTube 16:9). */
function finVoulue(reseau: IdReseau, ratio: Ratio): boolean {
  return obtenirReseau(reseau).fin.auMot || !!FIN_AU_MOT_TOLEREE[reseau]?.includes(ratio);
}

/**
 * La fin de ce fichier est-elle permise sur ce réseau ? Une fin au mot ne l'est que si le registre la permet
 * (`fin.auMot`), ou pour un format toléré (`FIN_AU_MOT_TOLEREE`, décision de Will du 18/10 16 h 55). Une fin propre l'est
 * partout. Une fin inconnue (fichier fait avant T1) est permise, comme aujourd'hui.
 */
export function finPermise(reseau: IdReseau, sortie: Pick<SortieCandidate, "appelAuMot"> & { ratio?: Ratio }): boolean {
  if (sortie.appelAuMot !== true || obtenirReseau(reseau).fin.auMot) return true;
  return !!sortie.ratio && !!FIN_AU_MOT_TOLEREE[reseau]?.includes(sortie.ratio);
}

/**
 * Le fichier à envoyer à un réseau, ou `null` (« Aucun fichier au bon format »). Seuls comptent les fichiers d'un
 * format accepté par le réseau et d'une fin permise sur lui. Parmi eux, dans cet ordre :
 *  1. un fichier fait pour ce réseau ;
 *  2. le format préféré du réseau, puis ses autres formats : dans l'ordre du registre pour un fichier qui dit ses
 *     réseaux ou sa fin ; pour un fichier d'avant (ni `reseaux` ni `appelAuMot`), tous à égalité (l'ordre des fichiers
 *     décide, comme avant T4) ;
 *  3. pour un même format, la fin prévue pour ce réseau (au mot si permise, sinon propre), puis une fin inconnue ;
 *  4. à égalité, l'ordre des fichiers reçus.
 */
export function meilleureSortie<T extends SortieCandidate>(reseau: IdReseau, sorties: readonly T[]): T | null {
  const r = obtenirReseau(reseau);
  const ordreRatios = [r.ratioPrefere, ...r.ratios.filter((x) => x !== r.ratioPrefere)];
  const dAvant = (s: SortieCandidate): boolean => !s.reseaux && s.appelAuMot === undefined;
  const rangRatio = (s: SortieCandidate): number => (s.ratio === r.ratioPrefere ? 0 : dAvant(s) ? 1 : ordreRatios.indexOf(s.ratio));
  const rangFin = (s: SortieCandidate): number => (s.appelAuMot === undefined ? 1 : s.appelAuMot === finVoulue(reseau, s.ratio) ? 0 : 2);
  const rang = (s: SortieCandidate): number[] => [s.reseaux?.includes(reseau) ? 0 : 1, rangRatio(s), rangFin(s)];
  let meilleure: T | null = null;
  for (const s of sorties) {
    if (!r.ratios.includes(s.ratio) || !finPermise(reseau, s)) continue;
    if (!meilleure || avant(rang(s), rang(meilleure))) meilleure = s;
  }
  return meilleure;
}

/** Vrai si le rang `a` passe strictement avant le rang `b` (comparaison terme à terme). */
function avant(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Mêmes réseaux (ensemble, ordre indifférent) ; absent = absent. */
function memesReseaux(a: readonly IdReseau[] | undefined, b: readonly IdReseau[] | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.length === b.length && a.every((r) => b.includes(r));
}

/**
 * Un fichier du même format, de la même fin ET des mêmes réseaux est-il déjà enregistré ? Les deux verticaux du
 * tableau animé (celui des Reels, celui de TikTok et Shorts) sont deux fichiers, même quand les deux ont une fin
 * propre. Une fin inconnue (fichier d'avant, réexport, moteur qui ne la dit pas) ne se confond qu'avec une fin
 * inconnue, quels que soient les réseaux : même format = déjà fait, comme avant T4 (pas de 9:16 en double après
 * « Réessayer » d'une version d'avant T4).
 */
export function fichierDejaFait(
  existants: readonly Pick<SortieCandidate, "ratio" | "appelAuMot" | "reseaux">[],
  sortie: Pick<SortieCandidate, "ratio" | "appelAuMot" | "reseaux">,
): boolean {
  return existants.some(
    (x) => x.ratio === sortie.ratio && x.appelAuMot === sortie.appelAuMot && (sortie.appelAuMot === undefined || memesReseaux(x.reseaux, sortie.reseaux)),
  );
}

/**
 * « Fichier envoyé : 4:5 · 1080 × 1350 » : le format et la taille RÉELLE du fichier (sa résolution, « 1080x1350 »),
 * ou celle du registre si la résolution est illisible.
 */
export function libelleFichierEnvoye(sortie: { ratio: Ratio; resolution?: string }): string {
  const m = /^(\d+)x(\d+)$/.exec(sortie.resolution ?? "");
  const { largeur, hauteur } = m ? { largeur: Number(m[1]), hauteur: Number(m[2]) } : dimensions(sortie.ratio);
  return `Fichier envoyé : ${sortie.ratio} · ${largeur} × ${hauteur}`;
}
