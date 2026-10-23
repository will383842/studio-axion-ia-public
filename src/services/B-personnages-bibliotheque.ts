/**
 * COMPLÉMENTS DE SERVICES du groupe B (Personnages, Bibliothèque).
 * Nouveau fichier, sans toucher aux signatures existantes de personnages.ts / bibliotheque.ts.
 * À fusionner par le QA dans les services d'origine si besoin.
 */
import "server-only";
import type { ElementBibliotheque, Id, Rush, ValeurElement, Voix } from "@/domaine/types";
import { listerFormats } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, filtreExemples, horodatage, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { urlFichier } from "./fichiers";
import { listerElements } from "./bibliotheque";
import { obtenirPersonnage } from "./personnages";
import type { VueElement, VuePersonnage } from "./vues";
import { estMoiReel } from "@/domaine/moi";

/* ------------------------------------------------------------------ */
/* Personnages                                                         */
/* ------------------------------------------------------------------ */

export interface VueFichePersonnage extends VuePersonnage {
  /** Document d'accord déposé (personne réelle). */
  accordDocument: { nom: string; url: string | null } | null;
  /** Échantillon de la voix (si présent). */
  voixEchantillon: string | null;
}

export async function obtenirFichePersonnage(id: Id): Promise<VueFichePersonnage | null> {
  const p = await obtenirPersonnage(id);
  if (!p) return null;
  const d = depots();
  const docId = p.personnage.accord?.documentFichierId;
  const doc = docId ? await d.fichiers.obtenir(docId) : null;
  const voix = p.voix[0];
  return {
    ...p,
    accordDocument: doc ? { nom: doc.nom, url: await urlFichier(doc.id) } : null,
    voixEchantillon: await urlFichier(voix?.echantillonFichierId ?? voix?.fichierIds[0]),
  };
}

/** « Moi » existe déjà (on ne peut pas l'ajouter deux fois). */
export async function moiExiste(): Promise<boolean> {
  // TEST-UI-REEL U1 : le personnage d'EXEMPLE ne compte pas (Will doit pouvoir se créer).
  return !!(await depots().personnages.trouver(estMoiReel));
}

/** Donne au visage une vignette (photo du personnage) s'il n'en a pas. */
export async function completerVignetteVisage(visageId: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const v = await d.visages.obtenir(visageId);
  if (!v || v.vignetteFichierId) return;
  const p = await d.personnages.obtenir(v.personnageId);
  if (p?.photoFichierId) await d.visages.modifier(visageId, { vignetteFichierId: p.photoFichierId });
}

export async function changerLangueVoix(voixId: Id, langue: Voix["langue"]): Promise<void> {
  await exigerSession();
  if (!["fr-FR", "en-US", "es-ES"].includes(langue)) throw new ErreurStudio("LANGUE", "Cette langue n'est pas encore prise en charge.");
  const d = depots();
  if (!(await d.voix.obtenir(voixId))) throw new ErreurStudio("INTROUVABLE", "Cette voix n'existe plus.");
  await d.voix.modifier(voixId, { langue });
}

/* ------------------------------------------------------------------ */
/* Bibliothèque : LUT, aperçu, défauts, rushs                          */
/* ------------------------------------------------------------------ */

export interface VueLut extends VueElement {
  avant: string | null;
  apres: string | null;
  intensite: number;
  tailleCube: number;
}

export async function listerLuts(): Promise<VueLut[]> {
  const elements = await listerElements({ type: "lut" });
  return Promise.all(
    elements.map(async (e) => {
      const v = e.valeur.type === "lut" ? e.valeur : null;
      return {
        ...e,
        avant: await urlFichier(v?.avantFichierId),
        apres: await urlFichier(v?.apresFichierId),
        intensite: v?.intensiteParDefaut ?? 70,
        tailleCube: v?.tailleCube ?? 33,
      };
    }),
  );
}

/** Image « avant » de référence pour une LUT importée (pas encore traitée par le moteur). */
export async function fichierAvantDeReference(): Promise<Id | undefined> {
  const lut = await depots().elements.trouver((e) => e.valeur.type === "lut" && !!e.valeur.avantFichierId);
  return lut && lut.valeur.type === "lut" ? lut.valeur.avantFichierId : undefined;
}

export interface FormatCourt {
  id: string;
  nom: string;
  icone: string;
}

export async function formatsCourts(): Promise<FormatCourt[]> {
  return listerFormats().map((f) => ({ id: f.id, nom: f.nom, icone: f.icone }));
}

/** Retire un élément des styles par défaut d'un format (inverse de definirParDefaut). */
export async function retirerParDefaut(elementId: Id, formatId: string): Promise<void> {
  await exigerSession();
  const d = depots();
  const el = await d.elements.obtenir(elementId);
  if (!el) throw new ErreurStudio("INTROUVABLE", "Cet élément n'existe plus.");
  await d.elements.modifier(elementId, { formatsParDefaut: el.formatsParDefaut.filter((f) => f !== formatId) });
}

/** Modifie la valeur typée d'un élément en vérifiant qu'elle garde son type. */
export async function modifierValeurElement(elementId: Id, valeur: ValeurElement): Promise<void> {
  await exigerSession();
  const d = depots();
  const el = await d.elements.obtenir(elementId);
  if (!el) throw new ErreurStudio("INTROUVABLE", "Cet élément n'existe plus.");
  if (el.valeur.type !== valeur.type) throw new ErreurStudio("TYPE", "Ce réglage ne correspond pas à cet élément.");
  await d.elements.modifier(elementId, { valeur });
}

export interface DonneesApercuImage {
  luts: { id: string; nom: string; avant: string | null; apres: string | null; intensite: number }[];
  sousTitres: { id: string; nom: string; valeur: Extract<ValeurElement, { type: "style-sous-titres" }> }[];
  habillages: { id: string; nom: string; valeur: Extract<ValeurElement, { type: "habillage" }> }[];
  logo: string | null;
  /** Choix par défaut du format de référence (avocat). */
  defauts: { lutId?: string; sousTitresId?: string; habillageId?: string };
}

/** Données de l'aperçu en direct d'une image de vidéo avec les choix appliqués. */
export async function donneesApercuImage(formatId = "avocat"): Promise<DonneesApercuImage> {
  const [luts, st, hab, logos] = await Promise.all([
    listerLuts(),
    listerElements({ type: "style-sous-titres" }),
    listerElements({ type: "habillage" }),
    listerElements({ type: "logo" }),
  ]);
  const parDefaut = (l: VueElement[]) => l.find((e) => e.formatsParDefaut.includes(formatId))?.id ?? l[0]?.id;
  return {
    luts: luts.map((l) => ({ id: l.id, nom: l.nom, avant: l.avant, apres: l.apres, intensite: l.intensite })),
    sousTitres: st.flatMap((e) => (e.valeur.type === "style-sous-titres" ? [{ id: e.id, nom: e.nom, valeur: e.valeur }] : [])),
    habillages: hab.flatMap((e) => (e.valeur.type === "habillage" ? [{ id: e.id, nom: e.nom, valeur: e.valeur }] : [])),
    logo: logos[0]?.vignette ?? null,
    defauts: { lutId: parDefaut(luts), sousTitresId: parDefaut(st), habillageId: parDefaut(hab) },
  };
}

/** Rushs (images réellement tournées), présentés comme des éléments de bibliothèque. */
export interface VueRush {
  id: string;
  type: "illustration-video";
  nom: string;
  motsCles: string[];
  vignette: string | null;
  url: string | null;
  etatLicence: "ok";
  licence: ElementBibliotheque["licence"];
  formatsParDefaut: string[];
  dureeSec: number;
  personnageNom?: string;
}

export async function listerRushs(): Promise<VueRush[]> {
  const exemples = await filtreExemples<Rush>();
  const d = depots();
  const rushs = await d.rushs.lister(exemples);
  rushs.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  return Promise.all(
    rushs.map(async (r) => {
      const p = r.personnageId ? await d.personnages.obtenir(r.personnageId) : null;
      const url = await urlFichier(r.fichierId);
      return {
        id: r.id,
        type: "illustration-video" as const,
        nom: r.nom,
        motsCles: r.motsCles,
        vignette: url && /\.mp4$/i.test(url) ? url.replace(/\.mp4$/i, ".jpg") : url,
        url,
        etatLicence: "ok" as const,
        licence: { type: "propriete" as const, usageCommercial: true, reseaux: [] },
        formatsParDefaut: [],
        dureeSec: r.dureeSec,
        personnageNom: p?.nom,
      };
    }),
  );
}

export async function compterRushs(): Promise<number> {
  const exemples = await filtreExemples<Rush>();
  return depots().rushs.compter(exemples);
}

export async function ajouterRush(donnees: { nom: string; fichierId: Id; dureeSec: number; motsCles: string[]; personnageId?: Id }): Promise<Id> {
  await exigerSession();
  const r: Rush = { id: nouvelId("rush"), nom: donnees.nom.trim() || "Rush", fichierId: donnees.fichierId, dureeSec: Math.max(1, Math.round(donnees.dureeSec)), motsCles: donnees.motsCles, personnageId: donnees.personnageId, ...horodatage() };
  await depots().rushs.enregistrer(r);
  await journaliser("bibliotheque", `Rush ajouté : ${r.nom}`, { type: "rush", id: r.id });
  return r.id;
}
