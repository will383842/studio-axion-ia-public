/** BIBLIOTHÈQUE (B.8 #15) : éléments de style, illustrations, sons, prononciations. */
import "server-only";
import type { ElementBibliotheque, Id, Licence, TypeElement, ValeurElement } from "@/domaine/types";
import { listerFormats } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { contient } from "@/lib/textes";
import { depots, fournisseur, ErreurStudio, filtreExemples, horodatage, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { versVueElement } from "./presentation";
import type { VueElement } from "./vues";

export interface FiltresElements {
  type?: TypeElement | TypeElement[];
  q?: string;
  motCle?: string;
  formatId?: string;
  /** true : seulement les éléments rangés (liste « Rangés ») ; sinon ils sont exclus. */
  ranges?: boolean;
}

/** Un élément rangé n'est proposé nulle part (ni liste, ni défaut, ni moteur), mais reste retrouvable. */
export const estRange = (e: { archiveLe?: string }) => !!e.archiveLe;

export async function listerElements(filtres: FiltresElements = {}): Promise<VueElement[]> {
  const exemples = await filtreExemples<ElementBibliotheque>();
  const types = filtres.type ? (Array.isArray(filtres.type) ? filtres.type : [filtres.type]) : null;
  const liste = await depots().elements.lister(
    (e) =>
      exemples(e) &&
      estRange(e) === !!filtres.ranges &&
      (!types || types.includes(e.type)) &&
      (!filtres.q || contient(e.nom, filtres.q) || e.motsCles.some((m) => contient(m, filtres.q!))) &&
      (!filtres.motCle || e.motsCles.includes(filtres.motCle)) &&
      (!filtres.formatId || e.formatsParDefaut.includes(filtres.formatId)),
  );
  liste.sort((a, b) => Number(!!b.favori) - Number(!!a.favori) || a.nom.localeCompare(b.nom, "fr"));
  return Promise.all(liste.map(versVueElement));
}

/** Élément tel qu'enregistré (licence complète), pour les modifications. */
export async function obtenirElementBrut(id: Id): Promise<ElementBibliotheque | null> {
  await exigerSession();
  return depots().elements.obtenir(id);
}

export async function obtenirElement(id: Id): Promise<VueElement | null> {
  const e = await depots().elements.obtenir(id);
  return e ? versVueElement(e) : null;
}

/** Nombre d'éléments par type (tuiles de la Bibliothèque sur mobile). */
export async function compterElementsParType(): Promise<Record<TypeElement, number>> {
  const exemples = await filtreExemples<ElementBibliotheque>();
  const liste = await depots().elements.lister((e) => exemples(e) && !estRange(e));
  const c = {} as Record<TypeElement, number>;
  // Les images de Will sont comptées dans « Mes images » (lot A2), pas dans « Images » ni « Vidéos ».
  for (const e of liste) if (e.origine !== "personnelle") c[e.type] = (c[e.type] ?? 0) + 1;
  return c;
}

export async function creerElement(donnees: { type: TypeElement; nom: string; motsCles?: string[]; valeur: ValeurElement; fichierId?: Id; vignetteFichierId?: Id; licence?: Licence }): Promise<Id> {
  await exigerSession();
  const e: ElementBibliotheque = {
    id: nouvelId("el"),
    type: donnees.type,
    nom: donnees.nom.trim(),
    motsCles: donnees.motsCles ?? [],
    valeur: donnees.valeur,
    fichierId: donnees.fichierId,
    vignetteFichierId: donnees.vignetteFichierId ?? donnees.fichierId,
    licence: donnees.licence ?? { type: "a-verifier", usageCommercial: false, reseaux: [] },
    formatsParDefaut: [],
    marqueId: "marque-axion",
    ...horodatage(),
  };
  await depots().elements.enregistrer(e);
  await journaliser("bibliotheque", `Ajouté à la bibliothèque : ${e.nom}`, { type: "element", id: e.id });
  return e.id;
}

export async function modifierElement(id: Id, patch: Partial<Pick<ElementBibliotheque, "nom" | "motsCles" | "valeur" | "licence" | "favori">>): Promise<void> {
  await exigerSession();
  await depots().elements.modifier(id, patch);
}

/** Range l'élément : il disparaît des listes et des choix, mais n'est jamais effacé (rien n'est purgé). */
export async function rangerElement(id: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e) throw new ErreurStudio("INTROUVABLE", "Cet élément n'existe plus.");
  await d.elements.modifier(id, { archiveLe: new Date().toISOString() });
  await journaliser("bibliotheque", `Rangé : ${e.nom}`, { type: "element", id });
}

/** Remet un élément rangé dans la Bibliothèque. */
export async function remettreElement(id: Id): Promise<void> {
  await exigerSession();
  await depots().elements.modifier(id, { archiveLe: undefined });
}

/** Fait de cet élément le style par défaut d'un format (un seul par type et par format). */
export async function definirParDefaut(elementId: Id, formatId: string): Promise<void> {
  await exigerSession();
  const d = depots();
  const el = await d.elements.obtenir(elementId);
  if (!el) throw new ErreurStudio("INTROUVABLE", "Cet élément n'existe plus.");
  for (const autre of await d.elements.lister((e) => e.type === el.type && e.formatsParDefaut.includes(formatId))) {
    await d.elements.modifier(autre.id, { formatsParDefaut: autre.formatsParDefaut.filter((f) => f !== formatId) });
  }
  await d.elements.modifier(elementId, { formatsParDefaut: Array.from(new Set([...el.formatsParDefaut, formatId])) });
}

/** Défauts par format pour un type (onglet LUT : « LUT par défaut par format »). */
export async function defautsParFormat(type: TypeElement): Promise<{ formatId: string; formatNom: string; elementId?: string }[]> {
  const elements = await depots().elements.lister((e) => e.type === type && !estRange(e));
  return listerFormats().map((f) => ({ formatId: f.id, formatNom: f.nom, elementId: elements.find((e) => e.formatsParDefaut.includes(f.id))?.id }));
}

/** Valide un fichier .cube à l'import (AV2.3-5). */
export async function validerLutCube(contenu: string): Promise<{ ok: true; taille: number } | { ok: false; erreur: string }> {
  await exigerSession();
  return (await fournisseur("etalonnage")).validerCube(contenu);
}

/* --- Prononciations : service à part depuis le 02/10 (lot A1), ré-exporté ici pour les appels existants --- */
export { ajouterPrononciation, listerPrononciations, rangerPrononciation, remettrePrononciation } from "./prononciations";
