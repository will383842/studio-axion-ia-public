/**
 * LOT R1 — RÈGLES PURES DE LA PUBLICATION BUFFER (aucun appel, aucune base).
 *
 * - Correspondance réseau → compte(s) Buffer : les cases cochées à l'envoi d'abord (lot R1b), sinon le dernier choix
 *   mémorisé, sinon le SEUL compte du bon service ; plusieurs comptes (deux LinkedIn : profil et page) sans choix → Will
 *   choisit, jamais deviné ; YouTube et YouTube Shorts → le même compte.
 * - Statut Buffer → statut du studio ; libellé honnête d'une publication (« Brouillon dans Buffer », « À vérifier »).
 * - Retrouver un envoi dont la réponse s'est perdue : même compte, même texte, créé après le début de l'envoi.
 */
import type { CanalPublication, EtatPublicationExterne } from "@/fournisseurs/types";
import { listerReseaux, obtenirReseau } from "@/reseaux";
import type { Tonalite } from "./libelles";
import type { IdReseau, Publication } from "./types";

/** Service Buffer d'un réseau du studio (registre des réseaux, une seule source). */
export function serviceBuffer(reseau: IdReseau): string {
  return obtenirReseau(reseau).serviceBuffer;
}

/** Nom lisible d'un service Buffer : celui du premier réseau qui y part (« youtube » → « YouTube »). */
export function nomService(service: string): string {
  return listerReseaux().find((r) => r.serviceBuffer === service)?.nom ?? "Autre compte";
}

/**
 * Lot R1b : compte(s) mémorisé(s) par réseau — le dernier choix de Will à l'envoi, ou le compte proposé par défaut
 * dans Réglages. Une chaîne (avant R1b : un seul compte choisi dans Réglages) ou une liste (un, l'autre ou les deux).
 */
export type CorrespondanceBuffer = Partial<Record<IdReseau, string | string[]>>;

/** Les identifiants mémorisés pour un réseau, quelle que soit la forme enregistrée (sans doublon). */
export function idsMemorises(valeur: string | string[] | undefined): string[] {
  return [...new Set(valeur === undefined ? [] : Array.isArray(valeur) ? valeur : [valeur])];
}

export type CanalPourReseau =
  | { ok: true; canal: CanalPublication; source: "choisi" | "auto" }
  | { ok: false; raison: "aucun" | "plusieurs" | "deconnecte"; candidats: CanalPublication[]; message: string };

/** Le compte Buffer où part un réseau (PUR). Un choix de Will qui n'existe plus chez Buffer n'est jamais suivi. */
export function canalPourReseau(reseau: IdReseau, canaux: CanalPublication[], correspondance: CorrespondanceBuffer = {}): CanalPourReseau {
  const c = comptesPourReseau(reseau, canaux, correspondance);
  if (!c.ok) return { ...c, raison: c.raison === "inconnu" ? "plusieurs" : c.raison };
  if (c.canaux.length > 1) return { ok: false, raison: "plusieurs", candidats: canaux.filter((x) => x.service === serviceBuffer(reseau)), message: messagePlusieurs(reseau) };
  return { ok: true, canal: c.canaux[0], source: c.source === "auto" ? "auto" : "choisi" };
}

export type ComptesPourReseau =
  | { ok: true; canaux: CanalPublication[]; source: "choisi" | "memorise" | "auto" }
  | { ok: false; raison: "aucun" | "plusieurs" | "deconnecte" | "inconnu"; candidats: CanalPublication[]; message: string };

const messagePlusieurs = (reseau: IdReseau, deconnectes: CanalPublication[] = []) => {
  const nom = nomService(serviceBuffer(reseau));
  const dont = deconnectes.length ? ` (${listeNoms(deconnectes)} ${deconnectes.length > 1 ? "sont déconnectés" : "est déconnecté"})` : "";
  return `Plusieurs comptes ${nom} dans Buffer${dont} : choisissez le compte ${nom} une première fois, en envoyant une vidéo.`;
};

/** « « A » », « « A » et « B » », « « A », « B » et « C » ». */
function listeNoms(canaux: CanalPublication[]): string {
  const noms = canaux.map((c) => `« ${c.nom} »`);
  return noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : (noms[0] ?? "");
}

/** Phrase d'un ou plusieurs comptes déconnectés, qui les NOMME (« Le compte LinkedIn « Page » est déconnecté… »). */
export function messageDeconnectes(reseau: IdReseau, deconnectes: CanalPublication[]): string {
  const nom = nomService(serviceBuffer(reseau));
  return deconnectes.length > 1
    ? `Les comptes ${nom} ${listeNoms(deconnectes)} sont déconnectés dans Buffer : reconnectez-les dans Buffer.`
    : `Le compte ${nom} ${listeNoms(deconnectes)} est déconnecté dans Buffer : reconnectez-le dans Buffer.`;
}

/**
 * Lot R1b — les comptes Buffer où part un réseau (PUR) :
 *  - `choisis` (cases cochées par Will à l'envoi) : exactement ceux-là, s'ils sont bien de ce réseau ;
 *  - sinon les comptes mémorisés (dernier choix, ou compte proposé par défaut), s'ils existent encore ;
 *  - sinon le SEUL compte du réseau ; plusieurs comptes sans choix ni mémoire → « plusieurs » (jamais deviné).
 * Un compte déconnecté n'est jamais retenu ; le message le NOMME.
 */
export function comptesPourReseau(reseau: IdReseau, canaux: CanalPublication[], correspondance: CorrespondanceBuffer = {}, choisis?: string[]): ComptesPourReseau {
  const service = serviceBuffer(reseau);
  const nom = nomService(service);
  const candidats = canaux.filter((c) => c.service === service);
  const deconnecte = (comptes: CanalPublication[]) => ({ ok: false as const, raison: "deconnecte" as const, candidats, message: messageDeconnectes(reseau, comptes) });
  if (!candidats.length) return { ok: false, raison: "aucun", candidats, message: `Aucun compte ${nom} n'est relié dans Buffer.` };
  if (choisis) {
    const ids = [...new Set(choisis)];
    const retenus = ids.map((id) => candidats.find((c) => c.id === id));
    if (!ids.length) return { ok: false, raison: "plusieurs", candidats, message: `Cochez au moins un compte ${nom}.` };
    if (retenus.some((c) => !c)) return { ok: false, raison: "inconnu", candidats, message: `Ce compte n'est pas un compte ${nom} relié dans Buffer : actualisez les comptes.` };
    const hors = (retenus as CanalPublication[]).filter((c) => c.deconnecte);
    if (hors.length) return deconnecte(hors);
    return { ok: true, canaux: retenus as CanalPublication[], source: "choisi" };
  }
  const memorises = idsMemorises(correspondance[reseau])
    .map((id) => candidats.find((c) => c.id === id))
    .filter((c): c is CanalPublication => !!c);
  const retenus = memorises.length ? memorises : candidats.length === 1 ? candidats : [];
  const hors = retenus.filter((c) => c.deconnecte);
  if (hors.length) return deconnecte(hors);
  if (retenus.length) return { ok: true, canaux: retenus, source: memorises.length ? "memorise" : "auto" };
  // Plusieurs comptes, aucun choix : tous déconnectés → on le dit ; sinon Will choisit (les déconnectés sont nommés).
  const deconnectes = candidats.filter((c) => c.deconnecte);
  if (deconnectes.length === candidats.length) return deconnecte(deconnectes);
  return { ok: false, raison: "plusieurs", candidats, message: messagePlusieurs(reseau, deconnectes) };
}

/** Statut Buffer (`PostStatus` relevé : draft, needs_approval, scheduled, sending, sent, error) → statut du studio. */
export function statutDepuisBuffer(status: string | null | undefined): EtatPublicationExterne["statut"] {
  switch (status) {
    case "draft":
      return "brouillon";
    case "sent":
      return "publiee";
    case "error":
      return "echec";
    // scheduled, sending, needs_approval (et tout statut futur inconnu) : programmée, jamais « publiée » par erreur.
    default:
      return "programmee";
  }
}

const normaliser = (t: string) =>
  t
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Même texte, aux espaces et aux adresses près (Buffer peut retoucher les retours à la ligne et raccourcir les liens). */
export function memeTexte(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return normaliser(a) === normaliser(b);
}

/** Retard possible de l'horloge de Buffer sur celle du studio (lecture ET filtre d'un envoi perdu). */
export const MARGE_HORLOGE_MS = 60_000;

/** Parmi les publications relues d'un compte, celle qui est cet envoi (la plus ancienne créée après son début). */
export function retrouverEnvoi(relues: EtatPublicationExterne[], envoi: { canalId: string; texte: string; depuis: string }): EtatPublicationExterne | null {
  const marge = new Date(new Date(envoi.depuis).getTime() - MARGE_HORLOGE_MS).toISOString();
  const siennes = relues.filter((p) => (!p.canalId || p.canalId === envoi.canalId) && (!p.creeeLe || p.creeeLe >= marge) && memeTexte(p.texte, envoi.texte));
  siennes.sort((a, b) => (a.creeeLe ?? "").localeCompare(b.creeeLe ?? ""));
  return siennes[0] ?? null;
}

/** Un envoi « à vérifier » que Buffer n'a toujours pas après ce délai est déclaré absent (et peut être refait). */
export const DELAI_ABSENCE_MS = 30 * 60_000;

/** La publication occupe-t-elle déjà ce réseau chez Buffer (un second message serait un doublon) ? */
export function occupeBuffer(p: Pick<Publication, "via" | "statut" | "etatEnvoi">): boolean {
  if (p.via !== "buffer") return false;
  if (p.etatEnvoi === "refuse" || p.etatEnvoi === "absent") return false;
  return p.statut !== "echec";
}

/** Libellé HONNÊTE d'une publication (calendrier, historique). */
export function libellePublication(p: Pick<Publication, "via" | "statut" | "etatEnvoi">): { libelle: string; ton: Tonalite } {
  if (p.via === "simulation") return { libelle: "Essai", ton: "ambre" };
  if (p.via === "buffer") {
    if (p.etatEnvoi === "en-cours") return { libelle: "Envoi en cours", ton: "neutre" };
    if (p.etatEnvoi === "a-verifier") return { libelle: "À vérifier", ton: "ambre" };
    if (p.etatEnvoi === "refuse" || p.etatEnvoi === "absent" || p.statut === "echec") return { libelle: "Échec", ton: "brique" };
    if (p.statut === "brouillon") return { libelle: "Brouillon dans Buffer", ton: "neutre" };
  }
  switch (p.statut) {
    case "brouillon":
      return { libelle: "Brouillon", ton: "neutre" };
    case "programmee":
      return { libelle: "Programmée", ton: "orange" };
    case "publiee":
      return { libelle: "Publiée", ton: "sauge" };
    default:
      return { libelle: "Échec", ton: "brique" };
  }
}
