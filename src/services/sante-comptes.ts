/**
 * L8-05 · Santé des comptes (LECTURE SEULE, sans IA, sans écriture).
 * Lit la liste des comptes par une fonction de lecture déjà existante du client du diffuseur (`listerComptes`) et en tire un état simple par compte.
 * Aucun appel réel ici : l'appelant fournit le client (faux diffuseur dans les tests). La reconnexion est un geste de la personne chez le diffuseur : rien ne la fait ici.
 * Les ALERTES (cloche) restent à STU-JETONS (`alertesJetonsZernio`) : ce fichier ne les double pas ; il s'en sert pour savoir qui est en règle.
 * Un champ absent ou illisible ne déclenche JAMAIS d'alerte (on n'invente rien). Les libellés n'ont ni nom, ni pseudo, ni nom de prestataire.
 */
import { alertesJetonsZernio, compteSurveilleDepuisZernio } from "@/fournisseurs/publication/zernio-alertes-jetons";
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

const RESEAUX: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
  x: "X",
  threads: "Threads",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  googlebusiness: "Google Business",
};
const libelleReseau = (nom: string): string => RESEAUX[nom.trim().toLowerCase()] ?? "Autre réseau";

function enMs(v: string | number | null | undefined): number {
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
  // Les règles (déconnecté, expiré, moins de 7 jours) sont celles de STU-JETONS : un compte est en règle s'il n'a aucune alerte.
  const aSignaler = new Set(alertesJetonsZernio({ comptes: vus, maintenant: e.maintenant }).map((a) => a.sujet));
  const parLibelle = new Map<string, string[]>();
  for (const c of vus) parLibelle.set(libelleReseau(c.nom), [...(parLibelle.get(libelleReseau(c.nom)) ?? []), c.id].sort());
  const comptes = vus.map((c): SanteCompte => {
    const base = libelleReseau(c.nom);
    const ids = parLibelle.get(base) ?? [];
    const libelle = ids.length > 1 ? `${base} n°${ids.indexOf(c.id) + 1}` : base;
    if (!aSignaler.has(`jeton:${c.id}`)) return { id: c.id, libelle, etat: "ok", message: "Le compte est en règle." };
    if (c.actif === false || c.aReconnecter === true) {
      return { id: c.id, libelle, etat: "deconnecte", message: "Le compte n'est plus relié. Reconnectez-le pour que les publications repartent." };
    }
    const fin = enMs(c.expireLe);
    if (fin <= e.maintenant) return { id: c.id, libelle, etat: "expire", message: "L'accès au compte est expiré. Reconnectez-le." };
    if (!Number.isFinite(fin)) return { id: c.id, libelle, etat: "deconnecte", message: "Le compte demande votre attention. Reconnectez-le." };
    const jours = Math.max(1, Math.ceil((fin - e.maintenant) / (24 * 3600_000)));
    return { id: c.id, libelle, etat: "bientot", message: `L'accès au compte expire dans ${jours} jour${jours > 1 ? "s" : ""}. Reconnectez-le avant.` };
  });
  return { lecture: "ok", comptes };
}
