/**
 * Porte v2, appels 2 bis et 3 : ce que l'écran « À valider » de l'Usine montre, et la validation qui en vient.
 * Écrit en avance (empilé sur L5-02a, avant CAL-21).
 *
 * Une commande est un créneau du calendrier (`cmd-<clé>` ou `prog-<clé>`). Ce service ne programme ni n'envoie rien :
 * la validation est UN appel à la fonction injectée `validerEntree` (celle de CAL-21, auteur « usine:<compte> »).
 * Il n'écrit lui-même que « a_valider » (passage permis à l'Usine) et l'archivage d'un refus (rien n'est supprimé).
 * ISOLATION : aucun fournisseur, aucun port d'envoi.
 */
import "server-only";
import { createHash } from "node:crypto";
import { etatInterne, refuserProposition } from "@/domaine/plan-editorial/statuts";
import { changerStatut, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";
import { validerEntreeServeur } from "@/services/valider-entree";

export const CLE_COMMANDE = /^[A-Za-z0-9._:-]{8,100}$/;
export const VALIDE_PAR = /^[a-z0-9._-]{1,60}$/;
export const CODES_REFUS = ["hors_cible", "deja_vu", "faux_ou_douteux", "accroche_faible", "voix_ou_rythme", "image"] as const;
export type CodeRefus = (typeof CODES_REFUS)[number];
export const NOTE_MAX = 300;

/** Forme de `validerEntreeServeur` (CAL-21) : refus = message en vouvoiement. */
export type ValiderEntree = (id: string, par: string) => Promise<{ ok: true; donnees?: unknown } | { ok: false; message: string; code?: string }>;

/** Câblage serveur : `validerEntreeServeur(id, par)` de CAL-21 (`services/valider-entree.ts`). Réglages fermés par défaut, aucun envoi. */
export const validerEntreeDuServeur: ValiderEntree = (id, par) => validerEntreeServeur(id, par);

export interface DepsPorteValidation {
  depots: DepotsPlan;
  validerEntree: ValiderEntree;
  maintenant: () => string;
}

export type SortiePorte<T> = { ok: true; corps: T } | { ok: false; http: number; code: string; message: string };
const refus = (http: number, code: string, message: string): { ok: false; http: number; code: string; message: string } => ({ ok: false, http, code, message });

type EtatCommande = "recue" | "a_valider";

/* --- Recherche du créneau ----------------------------------------------- */
export async function trouverCreneau(d: DepotsPlan, cle: string): Promise<SortiePorte<CreneauPlan>> {
  if (!CLE_COMMANDE.test(cle)) return refus(404, "introuvable", "Commande introuvable.");
  const [cmd, prog] = await Promise.all([d.creneaux.obtenir(`cmd-${cle}`), d.creneaux.obtenir(`prog-${cle}`)]);
  if (cmd && prog) return refus(409, "etat_incompatible", "Cette clé désigne deux entrées : rien n'est écrit.");
  const c = cmd ?? prog;
  return c ? { ok: true, corps: c } : refus(404, "introuvable", "Commande introuvable.");
}

/* --- Empreinte ----------------------------------------------------------- */
function canonique(v: unknown): string {
  if (v === undefined || v === null) return "null";
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** SHA-256 du JSON canonique de ce que l'Usine a vu ; ni statut, ni validation. */
export function empreinteCreneau(c: CreneauPlan): string {
  const { id, jourVise, heuresParReseau, compteCible, videoId, visuelId, textes, decalages } = c;
  return createHash("sha256").update(canonique({ id, jourVise, heuresParReseau, compteCible, videoId, visuelId, textes, decalages })).digest("hex");
}

function etatDe(c: CreneauPlan): EtatCommande | null {
  if (c.statut === "propose") return "recue";
  return c.statut === "a_valider" || c.statut === "valide" ? "a_valider" : null;
}

/* --- Appel 2 bis : lecture seule ---------------------------------------- */
export async function lireAValider(d: DepotsPlan, cle: string) {
  const t = await trouverCreneau(d, cle);
  if (!t.ok) return t;
  const c = t.corps;
  const etat = etatDe(c);
  if (!etat) return refus(409, "etat_incompatible", "Cette entrée n'est plus à valider.");
  const reseau = (Object.keys(c.heuresParReseau)[0] ?? null) as keyof CreneauPlan["heuresParReseau"] | null;
  const instant = reseau ? c.heuresParReseau[reseau] : undefined;
  const texte = reseau ? c.textes?.[reseau] : undefined;
  const media = c.videoId ? { type: "video" as const, id: c.videoId } : c.visuelId ? { type: "visuel" as const, id: c.visuelId } : null;
  return {
    ok: true as const,
    corps: {
      etape: "video" as const,
      etat,
      reseau,
      jour: c.jourVise,
      ...(instant ? { instant } : {}),
      compteCible: c.compteCible,
      media,
      textes: texte ? { texte: texte.texte, premierCommentaire: texte.premierCommentaire } : null,
      empreinte: empreinteCreneau(c),
      ...(c.valideeLe ? { valideeLe: c.valideeLe } : {}),
    },
  };
}

/* --- Appel 3 -------------------------------------------------------------- */
export interface DemandeValidation {
  etape: "video" | "script";
  decision: "valide" | "refuse";
  empreinte: string;
  validePar: string;
  refusCode?: CodeRefus;
  note?: string;
}

const verrous = new Map<string, Promise<unknown>>();
/** Sérialise les appels d'un même créneau (une seule instance du Studio, limite assumée par la garde). */
async function sousVerrou<T>(id: string, f: () => Promise<T>): Promise<T> {
  const precedent = verrous.get(id) ?? Promise.resolve();
  const courant = precedent.then(f, f);
  const trace = courant.catch(() => undefined);
  verrous.set(id, trace);
  try {
    return await courant;
  } finally {
    if (verrous.get(id) === trace) verrous.delete(id);
  }
}

const INCOMPATIBLE = "Cette entrée ne peut plus être décidée par ce moyen.";

export function traiterValidation(deps: DepsPorteValidation, cle: string, demande: DemandeValidation) {
  type Corps = { etat: "a_valider"; valideeLe: string; deja: boolean } | { etat: "refusee"; refuseLe: string; deja: boolean };
  return (async (): Promise<SortiePorte<Corps>> => {
    if (demande.etape === "script") return refus(409, "etat_incompatible", "Le Studio ne reçoit pas encore de script à valider.");
    const t = await trouverCreneau(deps.depots, cle);
    if (!t.ok) return t;
    return sousVerrou(t.corps.id, async (): Promise<SortiePorte<Corps>> => {
      const d = deps.depots;
      const id = t.corps.id;
      let c = await d.creneaux.obtenir(id);
      if (!c) return refus(404, "introuvable", "Commande introuvable.");

      if (demande.decision === "refuse") {
        if (c.statut === "archive" && c.refuseLe) return { ok: true, corps: { etat: "refusee", refuseLe: c.refuseLe, deja: true } };
        if (c.statut !== "propose" && c.statut !== "a_valider") return refus(409, "etat_incompatible", "Une entrée validée se retire dans le Studio.");
        if (empreinteCreneau(c) !== demande.empreinte) return refus(409, "version_perimee", "L'entrée a changé depuis votre lecture : relisez-la.");
        const motif = demande.refusCode ? (demande.note ? `${demande.refusCode} : ${demande.note}` : demande.refusCode) : undefined;
        const maintenant = deps.maintenant();
        const r = refuserProposition(c, "studio", motif, maintenant);
        if (!r.ok) return refus(409, "etat_incompatible", INCOMPATIBLE);
        await d.creneaux.enregistrer(r.creneau);
        return { ok: true, corps: { etat: "refusee", refuseLe: maintenant, deja: false } };
      }

      // decision « valide »
      if (c.statut === "valide" && c.valideeLe) return { ok: true, corps: { etat: "a_valider", valideeLe: c.valideeLe, deja: true } };
      if (c.statut !== "propose" && c.statut !== "a_valider") return refus(409, "etat_incompatible", INCOMPATIBLE);
      if (empreinteCreneau(c) !== demande.empreinte) return refus(409, "version_perimee", "L'entrée a changé depuis votre lecture : relisez-la.");
      if (etatInterne(c, deps.maintenant()) === "manquee") return refus(409, "etat_incompatible", "Heure passée : déplacez la publication avant de la valider.");
      if (c.statut === "propose") c = await changerStatut(d, id, "a_valider", "usine", deps.maintenant());
      const r = await deps.validerEntree(id, `usine:${demande.validePar}`);
      if (!r.ok) return refus(409, "etat_incompatible", r.message);
      const apres = await d.creneaux.obtenir(id);
      return { ok: true, corps: { etat: "a_valider", valideeLe: apres?.valideeLe ?? deps.maintenant(), deja: false } };
    });
  })();
}
