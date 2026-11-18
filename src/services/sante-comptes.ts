/**
 * L8-05 · Santé des comptes (LECTURE SEULE, sans IA, sans écriture).
 * Lit la liste des comptes par une fonction de lecture déjà existante du client du diffuseur (`listerComptes`) et en tire un état simple par compte.
 * Aucun appel réel ici : l'appelant fournit le client (faux diffuseur dans les tests). La reconnexion est un geste de la personne chez le diffuseur : rien ne la fait ici.
 * Un champ absent ou illisible ne déclenche JAMAIS d'alerte (on n'invente rien). Les libellés n'ont ni nom, ni pseudo, ni nom de prestataire.
 */
import { JETON_ALERTE_JOURS, compteSurveilleDepuisZernio } from "@/fournisseurs/publication/zernio-alertes-jetons";
import type { CompteZernio } from "@/fournisseurs/publication/zernio-client";

export type EtatSante = "ok" | "bientot" | "expire" | "deconnecte";

export interface SanteCompte {
  id: string;
  /** Réseau en mots simples, plus un rang quand plusieurs comptes du même réseau existent. */
  libelle: string;
  etat: EtatSante;
  /** Phrase affichable (vouvoiement), sans nom de personne ni de prestataire. */
  message: string;
}
export interface SanteComptes {
  /** « inconnue » : la lecture a échoué ou n'existe pas ; aucune alerte dans ce cas. */
  lecture: "ok" | "inconnue";
  comptes: SanteCompte[];
}
export interface AlerteSante {
  /** Un sujet = au plus une alerte par jour. */
  sujet: string;
  message: string;
}

const RESEAUX: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube" };
const JOUR_MS = 24 * 3600_000;

function dateEnMs(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : NaN;
  return Date.parse(v);
}

export async function lireSanteComptes(e: { client: { listerComptes(): Promise<CompteZernio[]> }; maintenant: number }): Promise<SanteComptes> {
  let brut: CompteZernio[];
  try {
    brut = await e.client.listerComptes();
  } catch {
    return { lecture: "inconnue", comptes: [] };
  }
  if (!Array.isArray(brut)) return { lecture: "inconnue", comptes: [] };
  const vus = brut.map(compteSurveilleDepuisZernio);
  const parReseau = new Map<string, string[]>();
  for (const c of vus) parReseau.set(c.nom, [...(parReseau.get(c.nom) ?? []), c.id].sort());
  const comptes = vus.map((c): SanteCompte => {
    const ids = parReseau.get(c.nom) ?? [];
    const base = RESEAUX[c.nom.toLowerCase()] ?? "Compte";
    const libelle = ids.length > 1 ? `${base} n°${ids.indexOf(c.id) + 1}` : base;
    if (c.actif === false || c.aReconnecter === true) {
      return { id: c.id, libelle, etat: "deconnecte", message: "Le compte n'est plus relié. Reconnectez-le pour que les publications repartent." };
    }
    const fin = dateEnMs(c.expireLe);
    if (Number.isFinite(fin)) {
      if (fin <= e.maintenant) return { id: c.id, libelle, etat: "expire", message: "L'accès au compte est expiré. Reconnectez-le." };
      if (fin - e.maintenant < JETON_ALERTE_JOURS * JOUR_MS) {
        const jours = Math.max(1, Math.ceil((fin - e.maintenant) / JOUR_MS));
        return { id: c.id, libelle, etat: "bientot", message: `L'accès au compte expire dans ${jours} jour${jours > 1 ? "s" : ""}. Reconnectez-le avant.` };
      }
    }
    return { id: c.id, libelle, etat: "ok", message: "Le compte est en règle." };
  });
  return { lecture: "ok", comptes };
}

/** Alertes pour la cloche seule (ni bandeau, ni pastille, ni notification poussée). Rien à signaler = liste vide. */
export function alertesSanteComptes(comptes: readonly SanteCompte[]): AlerteSante[] {
  return comptes.filter((c) => c.etat !== "ok").map((c) => ({ sujet: `sante:${c.id}`, message: `${c.libelle} : ${c.message}` }));
}
