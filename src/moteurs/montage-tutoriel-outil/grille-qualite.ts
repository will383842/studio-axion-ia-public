// T-EXT-27 : grille de qualité CHIFFRÉE du tutoriel d'outil. PURE : aucun appel, aucun disque, aucune horloge ; ne lève jamais ; 0 €.
// Une note sur 100 calculée par des règles fixes, et UNE règle de passage : aucun défaut bloquant connu (et note ≥ 85).
// Elle juge, elle ne corrige rien. Un contrôle « non fait » (mesure absente, regardeur éteint) compte comme « à corriger » et est nommé :
// jamais comme réussi. Les seuils viennent des briques communes (importées) ; la durée vient de `DUREE_CIBLE_SEC` (seule source).
import type { ResultatControle, RapportControleImage } from "@/briques/controle-image";
import type { ResultatControleComposition } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { SEUILS_CONTROLE_IMAGE, nombre } from "@/briques/controle-image/seuils";
import type { DefautVu, VerdictRegard } from "@/briques/regardeur";
import { DUREE_CIBLE_SEC } from "./equipe/chef-de-projet";
import type { ResultatControleTutoriel, VerdictControleur } from "./equipe/controleur";

export type GraviteCritere = "bloquant" | "a-corriger" | "mineur";
export type EtatCritere = "reussi" | "echoue" | "non-fait";

export interface Critere {
  id: string;
  /** Français, sans sigle. */
  libelle: string;
  etat: EtatCritere;
  /** Gravité propre du critère (celle qui s'applique s'il échoue). Un « non fait » compte « à corriger ». */
  gravite: GraviteCritere;
  /** Ce qui a été mesuré (ou la raison du « non fait »), pour Williams. */
  mesure: string;
  seuil: string;
}

export interface GrilleTutoriel {
  note: number;
  proposable: boolean;
  criteres: Critere[];
}

/** Valeurs de la grille (proposées, à confirmer par le pilote). */
export const SON_CIBLE_LUFS = -14;
export const SON_TOLERANCE_LUFS = 0.5;
export const IMAGE_FIXE_MAX_SEC = 1.5;
export const NOTE_MIN_PROPOSABLE = 85;
export const POIDS_BLOQUANT = 25;
export const POIDS_A_CORRIGER = 8;
export const POIDS_MINEUR = 2;
/** Un instant du début (hook) est celui qui tombe avant cette seconde. */
export const HOOK_AVANT_SEC = 3;

export interface EntreeGrille {
  controleImage: RapportControleImage;
  controleur: VerdictControleur;
  regardeur?: VerdictRegard;
  dureeSec: number;
  /** Plus longue durée d'image fixe en couche principale, en secondes ; absente = non mesurée. */
  imageFixeMaxSec?: number | null;
  /** Niveau sonore mesuré (T-EXT-31). Absent : la grille reprend le contrôle « volume » du contrôle de l'image. */
  niveauSonoreLufs?: number | null;
  /**
   * QUAL-4 : contrôle objectif de la composition (`controlerComposition`). `undefined` ou `null` : contrôle PAS FAIT =
   * « non fait » (jamais réussi : la note ne peut plus être de 100) ; un résultat : réussi / échoué (un défaut bloquant
   * rend le critère bloquant).
   */
  composition?: ResultatControleComposition | null;
}

/** Ce que le moteur range dans l'état une fois le pas « regarder » branché (27b). */
export interface AvecGrille {
  grille?: GrilleTutoriel;
}

const NON_FAIT = "pas encore vérifié";

function critere(id: string, libelle: string, gravite: GraviteCritere, seuil: string, etat: EtatCritere, mesure: string): Critere {
  return { id, libelle, etat, gravite, mesure, seuil };
}

function depuisImage(rapport: RapportControleImage, id: ResultatControle["id"], libelleGrille: string, seuil: string, gravite: GraviteCritere = "bloquant"): Critere {
  const c = (Array.isArray(rapport?.controles) ? rapport.controles : []).find((x) => x.id === id);
  if (!c) return critere(`image-${id}`, libelleGrille, gravite, seuil, "non-fait", NON_FAIT);
  return critere(`image-${id}`, libelleGrille, gravite, seuil, c.etat, c.raison);
}

function controlesDe(v: VerdictControleur): ResultatControleTutoriel[] {
  return Array.isArray(v?.controles) ? v.controles : [];
}

function depuisControleur(v: VerdictControleur, id: string, libelle: string, seuil: string, gravite: GraviteCritere): Critere {
  const c = controlesDe(v).find((x) => x.id === id);
  if (!c) return critere(id, libelle, gravite, seuil, "non-fait", NON_FAIT);
  return critere(id, libelle, gravite, seuil, c.etat, c.details.join(" ") || (c.etat === "reussi" ? "conforme" : NON_FAIT));
}

function marque(v: VerdictControleur): Critere {
  const seuil = "aucun écart";
  const liste = controlesDe(v).filter((c) => c.id.startsWith("MARQUE-"));
  if (liste.length === 0) return critere("marque", "Marque Axion IA", "bloquant", seuil, "non-fait", NON_FAIT);
  const echecs = liste.filter((c) => c.etat === "echoue");
  if (echecs.length) return critere("marque", "Marque Axion IA", "bloquant", seuil, "echoue", echecs.flatMap((c) => c.details).join(" "));
  if (liste.some((c) => c.etat === "non-fait")) return critere("marque", "Marque Axion IA", "bloquant", seuil, "non-fait", NON_FAIT);
  return critere("marque", "Marque Axion IA", "bloquant", seuil, "reussi", "aucun écart");
}

function son(e: EntreeGrille): Critere {
  const seuil = `${nombre(SON_CIBLE_LUFS)} à ${nombre(SON_TOLERANCE_LUFS)} près`;
  const n = e.niveauSonoreLufs;
  if (typeof n === "number" && Number.isFinite(n)) {
    const ok = Math.abs(n - SON_CIBLE_LUFS) <= SON_TOLERANCE_LUFS + 1e-9;
    return critere("son", "Niveau du son", "bloquant", seuil, ok ? "reussi" : "echoue", `niveau mesuré ${nombre(n)}`);
  }
  const repli = depuisImage(e.controleImage, "volume", "Niveau du son", seuil);
  return { ...repli, id: "son" };
}

// Décision de Williams (18/11) : le contrôle de durée est une REMARQUE, jamais un refus → gravité « mineur » (aucun effet sur `proposable`).
function duree(dureeSec: number): Critere {
  const [bas, haut] = DUREE_CIBLE_SEC;
  const seuil = `${bas} à ${haut} s`;
  if (typeof dureeSec !== "number" || !Number.isFinite(dureeSec)) return critere("duree", "Durée de la vidéo", "mineur", seuil, "non-fait", "la durée n'est pas lisible");
  const ms = Math.round(dureeSec * 1000);
  const ok = ms >= bas * 1000 && ms <= haut * 1000;
  return critere("duree", "Durée de la vidéo", "mineur", seuil, ok ? "reussi" : "echoue", `${nombre(ms / 1000)} s`);
}

function imageFixe(max: number | null | undefined): Critere {
  const seuil = `${nombre(IMAGE_FIXE_MAX_SEC)} s au plus`;
  if (typeof max !== "number" || !Number.isFinite(max)) return critere("image-fixe", "Écran immobile", "bloquant", seuil, "non-fait", NON_FAIT);
  return critere("image-fixe", "Écran immobile", "bloquant", seuil, Math.round(max * 1000) <= IMAGE_FIXE_MAX_SEC * 1000 ? "reussi" : "echoue", `${nombre(max)} s`);
}

const BLOQUANTS_REGARD = new Set<DefautVu["code"]>(["phrase-non-choisie", "fin-absente", "page-vide", "texte-coupe"]);
const A_CORRIGER_REGARD = new Set<DefautVu["code"]>(["hors-cadre", "desynchro", "noire", "illisible"]);
/** Défauts déjà comptés par le critère « image de début » : pas comptés deux fois. */
const COMPTES_PAR_HOOK = new Set<DefautVu["code"]>(["noire", "page-vide", "illisible", "non-relue"]);
const duHook = (d: DefautVu): boolean => d.instantSec < HOOK_AVANT_SEC;

function phrases(defauts: DefautVu[]): string {
  return defauts.map((d) => `${d.detail} (à ${nombre(d.instantSec)} s)`).join(" ");
}

function regardeur(r: VerdictRegard | undefined): Critere[] {
  const libHook = "Image de début";
  const seuilHook = "relue, ni noire ni vide";
  const absent = (id: string, libelle: string, seuil: string, gravite: GraviteCritere) => critere(id, libelle, gravite, seuil, "non-fait", "le regard sur les images n'a pas eu lieu");
  if (!r || !Array.isArray(r.defauts)) {
    return [
      absent("regard-debut", libHook, seuilHook, "a-corriger"),
      absent("regard-bloquants", "Défauts vus à l'écran (bloquants)", "aucun", "bloquant"),
      absent("regard-a-corriger", "Défauts vus à l'écran (à corriger)", "aucun", "a-corriger"),
      absent("regard-non-relues", "Images relues", "toutes", "a-corriger"),
    ];
  }
  const tete = r.defauts.filter(duHook);
  const hookNonRelu = tete.some((d) => d.code === "non-relue") || r.relues === 0;
  const hookDefauts = tete.filter((d) => d.code === "noire" || d.code === "page-vide" || d.code === "illisible");
  const hook = hookDefauts.length
    ? critere("regard-debut", libHook, "a-corriger", seuilHook, "echoue", phrases(hookDefauts))
    : hookNonRelu
      ? critere("regard-debut", libHook, "a-corriger", seuilHook, "non-fait", "l'image de début n'a pas pu être relue")
      : critere("regard-debut", libHook, "a-corriger", seuilHook, "reussi", "relue, rien à signaler");
  const reste = r.defauts.filter((d) => !(duHook(d) && COMPTES_PAR_HOOK.has(d.code)));
  const bloquants = reste.filter((d) => BLOQUANTS_REGARD.has(d.code));
  const aCorriger = reste.filter((d) => A_CORRIGER_REGARD.has(d.code));
  const nonRelues = r.defauts.filter((d) => d.code === "non-relue" && !duHook(d));
  return [
    hook,
    critere("regard-bloquants", "Défauts vus à l'écran (bloquants)", "bloquant", "aucun", bloquants.length ? "echoue" : r.relues === 0 ? "non-fait" : "reussi", bloquants.length ? phrases(bloquants) : r.relues === 0 ? NON_FAIT : "aucun"),
    critere("regard-a-corriger", "Défauts vus à l'écran (à corriger)", "a-corriger", "aucun", aCorriger.length ? "echoue" : r.relues === 0 ? "non-fait" : "reussi", aCorriger.length ? phrases(aCorriger) : r.relues === 0 ? NON_FAIT : "aucun"),
    critere("regard-non-relues", "Images relues", "a-corriger", "toutes", nonRelues.length ? "non-fait" : "reussi", nonRelues.length ? `${nonRelues.length} image${nonRelues.length > 1 ? "s" : ""} non relue${nonRelues.length > 1 ? "s" : ""}` : "toutes relues"),
  ];
}

function composition(r: ResultatControleComposition | null | undefined): Critere {
  const seuil = "aucun texte trop petit, recouvert, vide ou hors du cadre";
  const libelle = "Composition de l'image";
  if (!r || !Array.isArray(r.defauts)) return critere("composition", libelle, "a-corriger", seuil, "non-fait", NON_FAIT);
  if (r.defauts.length === 0) return critere("composition", libelle, "bloquant", seuil, "reussi", "aucun défaut");
  const bloquant = r.defauts.some((d) => d.gravite === "bloquant");
  return critere("composition", libelle, bloquant ? "bloquant" : "a-corriger", seuil, "echoue", r.defauts.map((d) => d.message).join(" "));
}

/** Gravité qui compte vraiment : un « non fait » est « à corriger » au moins, jamais un succès. */
function graviteEffective(c: Critere): GraviteCritere | null {
  if (c.etat === "reussi") return null;
  if (c.etat === "non-fait") return c.gravite === "mineur" ? "mineur" : "a-corriger";
  return c.gravite;
}

/** Note = 100 − 25 × bloquants − 8 × à corriger − 2 × mineurs, bornée à [0, 100]. `proposable` : 0 bloquant ET note ≥ 85. Ne lève jamais. */
export function noterTutoriel(e: EntreeGrille): GrilleTutoriel {
  const criteres: Critere[] = [
    son(e),
    depuisImage(e.controleImage, "crete", "Pic sonore", `${nombre(SEUILS_CONTROLE_IMAGE.creteMax)} au plus`),
    duree(e.dureeSec),
    imageFixe(e.imageFixeMaxSec),
    depuisImage(e.controleImage, "image-noire", "Images noires hors fin", "aucune"),
    depuisImage(e.controleImage, "taille-texte", "Taille du texte", `${Math.round(SEUILS_CONTROLE_IMAGE.tailleTexteMin * 100)} % de la hauteur au moins`),
    depuisImage(e.controleImage, "contraste", "Contraste du texte", `${SEUILS_CONTROLE_IMAGE.contrasteTexteMin} au moins`),
    depuisImage(e.controleImage, "zone-sure", "Rien hors du cadre", "aucune sortie"),
    depuisControleur(e.controleur, "TUT-CHIFFRES", "Chiffres dits = chiffres à l'écran", "aucun écart", "bloquant"),
    marque(e.controleur),
    depuisControleur(e.controleur, "TUT-REGISTRE", "Textes visibles validés", "aucun texte absent du registre", "bloquant"),
    ...regardeur(e.regardeur),
    composition(e.composition),
    depuisControleur(e.controleur, "TUT-MOMENTS", "Moments « ça change tout »", "trois au plus", "a-corriger"),
  ];
  let bloquants = 0;
  let aCorriger = 0;
  let mineurs = 0;
  for (const c of criteres) {
    const g = graviteEffective(c);
    if (g === "bloquant") bloquants++;
    else if (g === "a-corriger") aCorriger++;
    else if (g === "mineur") mineurs++;
  }
  const brute = 100 - POIDS_BLOQUANT * bloquants - POIDS_A_CORRIGER * aCorriger - POIDS_MINEUR * mineurs;
  const note = Math.max(0, Math.min(100, brute));
  return { note, proposable: bloquants === 0 && note >= NOTE_MIN_PROPOSABLE, criteres };
}

/** Alertes pour Williams : « À vérifier · <libellé> : <mesure> (seuil <seuil>) », une par critère non réussi. */
export function alertesDeGrille(g: GrilleTutoriel): { message: string; bloquant: boolean }[] {
  return g.criteres
    .filter((c) => c.etat !== "reussi")
    .map((c) => ({ message: `À vérifier · ${c.libelle} : ${c.mesure} (seuil ${c.seuil})`, bloquant: graviteEffective(c) === "bloquant" }));
}

/** Le critère « Marque » est-il réussi ? Sert à `verifie.droits` (jamais écrit en dur quand une grille existe). */
export function marqueReussie(g: GrilleTutoriel): boolean {
  return g.criteres.find((c) => c.id === "marque")?.etat === "reussi";
}
