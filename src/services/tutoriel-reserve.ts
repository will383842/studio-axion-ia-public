/**
 * RÉSERVE DE TUTORIELS · stockage (plan PLAN-RESERVE-TUTORIELS-21-11, § 3.3 et § 4.2). Aucune migration : tout vit dans
 * `parametres`, sous le préfixe `tutoriel.reserve.`. SANS session : les gardes de session sont dans les actions.
 * Aucun appel payant, aucun fournisseur. La prise est atomique (verrou du processus + bail entre machines).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { prendreBail, rendreBail } from "@/donnees/memoire";
import {
  CLE_BAIL_TIRAGE,
  CLE_TIRAGE_VALIDE,
  HISTORIQUE_MAX,
  ID_ELEMENT_VALIDE,
  PARAM_RESERVE_HISTORIQUE,
  PARAM_RESERVE_INDEX,
  PARAM_RESERVE_REGLAGES,
  REGLAGES_RESERVE_DEFAUT,
  cleElementReserve,
  cleTirageReserve,
  controlerReglagesReserve,
  lireReglagesReserveBrut,
  suivantFifo,
  transition,
  type DeclencheurTirage,
  type ElementReserve,
  type EtatElementReserve,
  type LigneHistorique,
  type ReglagesReserve,
  type TirageReserve,
} from "@/domaine/tutoriel-reserve";
import { ecrireParametre, ErreurStudio, lireParametre, maintenant, sousVerrou } from "./_commun";

const DUREE_BAIL_MS = 60_000;
const TITRE_MAX = 80;
const SCRIPT_MAX = 8000;

// ─── Réglages ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lecture en échec fermé : une lecture qui lève ou une forme imprévue donne le défaut éteint. */
export async function lireReglagesReserve(): Promise<ReglagesReserve> {
  try {
    return lireReglagesReserveBrut(await lireParametre<unknown>(PARAM_RESERVE_REGLAGES, null));
  } catch {
    return { ...REGLAGES_RESERVE_DEFAUT };
  }
}

export async function ecrireReglagesReserve(r: ReglagesReserve): Promise<void> {
  const refus = controlerReglagesReserve(r);
  if (refus) throw new ErreurStudio("RESERVE_REGLAGE", refus.message);
  await ecrireParametre(PARAM_RESERVE_REGLAGES, lireReglagesReserveBrut(r));
}

// ─── Lecture ─────────────────────────────────────────────────────────────────────────────────────────────────────────

async function lireIndex(): Promise<string[]> {
  const v = await lireParametre<unknown>(PARAM_RESERVE_INDEX, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function lireElementReserve(id: string): Promise<ElementReserve | null> {
  if (!ID_ELEMENT_VALIDE.test(id)) return null;
  const v = await lireParametre<ElementReserve | null>(cleElementReserve(id), null);
  return v && typeof v === "object" && v.id === id ? v : null;
}

export async function listerReserve(): Promise<ElementReserve[]> {
  const elements = await Promise.all((await lireIndex()).map((id) => lireElementReserve(id)));
  return elements.filter((e): e is ElementReserve => e !== null);
}

export async function lireTirageReserve(cle: string): Promise<TirageReserve | null> {
  if (!CLE_TIRAGE_VALIDE.test(cle)) return null;
  return lireParametre<TirageReserve | null>(cleTirageReserve(cle), null);
}

export async function historiqueTiragesReserve(): Promise<LigneHistorique[]> {
  const v = await lireParametre<unknown>(PARAM_RESERVE_HISTORIQUE, []);
  return Array.isArray(v) ? (v as LigneHistorique[]) : [];
}

// ─── Écriture ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Idempotent par `id` : déjà présent → rend l'existant, n'écrit rien. Ajoute l'id en FIN d'index. */
export async function ajouterElementReserve(e: Omit<ElementReserve, "etat" | "tentatives" | "passages" | "version">): Promise<ElementReserve> {
  if (!ID_ELEMENT_VALIDE.test(e.id)) throw new ErreurStudio("RESERVE_ELEMENT", "Cet identifiant de la réserve n'est pas valide.");
  if (e.script !== undefined && e.script.length > SCRIPT_MAX) throw new ErreurStudio("RESERVE_ELEMENT", "Le script est trop long pour la réserve.");
  return sousVerrou(async () => {
    const existant = await lireElementReserve(e.id);
    if (existant) return existant;
    const element: ElementReserve = {
      ...e,
      titre: e.titre.slice(0, TITRE_MAX),
      etat: "en_reserve",
      tentatives: 0,
      passages: [{ le: e.ajouteLe, de: null, vers: "en_reserve" }],
      version: 1,
    };
    await ecrireParametre(cleElementReserve(e.id), element);
    const index = await lireIndex();
    if (!index.includes(e.id)) await ecrireParametre(PARAM_RESERVE_INDEX, [...index, e.id]);
    return element;
  });
}

/** Sous sousVerrou. Transition interdite → ErreurStudio("RESERVE_TRANSITION"). `patch` ne touche que prise/tentatives/source/motif. */
export async function changerEtatReserve(
  id: string,
  vers: EtatElementReserve,
  o?: { motif?: string; patch?: Partial<Pick<ElementReserve, "prise" | "tentatives" | "source" | "motif">> },
): Promise<ElementReserve> {
  return sousVerrou(async () => {
    const e = await lireElementReserve(id);
    if (!e) throw new ErreurStudio("RESERVE_INTROUVABLE", "Cet élément n'est plus dans la réserve.");
    const t = transition(e, vers, maintenant(), o?.motif);
    if (!t) throw new ErreurStudio("RESERVE_TRANSITION", "Ce changement d'état n'est pas permis pour cet élément.");
    const p = o?.patch ?? {};
    const suivant: ElementReserve = { ...t };
    if ("prise" in p) {
      if (p.prise === undefined) delete suivant.prise;
      else suivant.prise = p.prise;
    }
    if (p.tentatives !== undefined) suivant.tentatives = p.tentatives;
    if (p.source !== undefined) suivant.source = p.source;
    if (p.motif !== undefined) suivant.motif = p.motif;
    await ecrireParametre(cleElementReserve(id), suivant);
    return suivant;
  });
}

/** PRISE ATOMIQUE (sousVerrou + bail CLE_BAIL_TIRAGE 60 s). Rejeu de `cle` → { element, deja: true }. Bail occupé → "bail_occupe". Rien à prendre → null. */
export async function prendreSuivantReserve(
  o: { cle: string; declencheur: DeclencheurTirage; elementId?: string; maintenant?: string },
  dep?: { prendreBail?: typeof prendreBail; rendreBail?: typeof rendreBail },
): Promise<{ element: ElementReserve; deja: boolean } | null | "bail_occupe"> {
  if (!CLE_TIRAGE_VALIDE.test(o.cle)) throw new ErreurStudio("RESERVE_CLE", "La clé de ce tirage n'est pas valide.");
  const prendre = dep?.prendreBail ?? prendreBail;
  const rendre = dep?.rendreBail ?? rendreBail;
  return sousVerrou(async () => {
    const titulaire = `reserve-${randomUUID()}`;
    if (!(await prendre(CLE_BAIL_TIRAGE, titulaire, DUREE_BAIL_MS))) return "bail_occupe";
    try {
      // Relecture SOUS verrou : rejeu d'abord, puis choix de l'élément.
      const deja = await lireTirageReserve(o.cle);
      if (deja) {
        const element = await lireElementReserve(deja.elementId);
        return element ? { element, deja: true } : null;
      }
      let candidat: ElementReserve | null;
      if (o.elementId !== undefined) {
        const demande = await lireElementReserve(o.elementId);
        candidat = demande && demande.etat === "en_reserve" ? demande : null;
      } else {
        const index = await lireIndex();
        const elements = new Map<string, ElementReserve>();
        for (const id of index) {
          const e = await lireElementReserve(id);
          if (e) elements.set(id, e);
        }
        candidat = suivantFifo(index, elements);
      }
      if (!candidat) return null;
      const le = o.maintenant ?? maintenant();
      const pris = transition(candidat, "pris", le);
      if (!pris) return null;
      const element: ElementReserve = { ...pris, prise: { cle: o.cle, declencheur: o.declencheur, le } };
      // Ordre : élément pris, fiche de tirage, historique.
      await ecrireParametre(cleElementReserve(element.id), element);
      const tirage: TirageReserve = { cle: o.cle, declencheur: o.declencheur, le, elementId: element.id };
      await ecrireParametre(cleTirageReserve(o.cle), tirage);
      const historique = await historiqueTiragesReserve();
      await ecrireParametre(PARAM_RESERVE_HISTORIQUE, [...historique, { le, declencheur: o.declencheur, elementId: element.id }].slice(-HISTORIQUE_MAX));
      return { element, deja: false };
    } finally {
      await rendre(CLE_BAIL_TIRAGE, titulaire);
    }
  });
}

/** Écrit le `videoId` sur la fiche de tirage ET sur `element.prise`. */
export async function noterVideoDuTirage(cle: string, elementId: string, videoId: string): Promise<void> {
  await sousVerrou(async () => {
    const tirage = await lireTirageReserve(cle);
    if (tirage) await ecrireParametre(cleTirageReserve(cle), { ...tirage, videoId });
    const e = await lireElementReserve(elementId);
    if (e?.prise) await ecrireParametre(cleElementReserve(elementId), { ...e, prise: { ...e.prise, videoId } });
  });
}
