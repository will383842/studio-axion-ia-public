/** FICHIERS (AV2.2-3). V1 : public/demo + dépôts simulés. */
import "server-only";
import type { Fichier, Id } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, fournisseur, horodatage } from "./_commun";
import { exigerSession } from "./auth";

/** Adresse lisible d'un fichier (ou null). Interne aux services. */
export async function urlFichier(id: Id | undefined | null): Promise<string | null> {
  if (!id) return null;
  const f = await depots().fichiers.obtenir(id);
  // Dépôt simulé sans média de démonstration (PDF, police, .cube…) : pas d'adresse, jamais une image sans rapport.
  if (!f || !f.cleStockage) return null;
  return (await (await fournisseur("stockage")).urlLecture(f.cleStockage)) || null;
}

/** Résout plusieurs fichiers d'un coup. */
export async function urlsFichiers(ids: (Id | undefined | null)[]): Promise<Record<string, string>> {
  const uniques = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const paires = await Promise.all(uniques.map(async (id) => [id, await urlFichier(id)] as const));
  return Object.fromEntries(paires.filter(([, u]) => !!u)) as Record<string, string>;
}

/**
 * B5 (audit A) : un fichier VRAIMENT envoyé par le navigateur (`envoyerFichier` → `/api/depots`, `services/envois.ts`),
 * arrivé dans le stockage (« prêt »), pour la destination annoncée. Jamais une simple fiche (nom, type, taille) : un
 * ajout de Bibliothèque, de Personnages ou de l'assistant n'enregistre que des octets réellement reçus.
 */
export async function fichierEnvoye(id: unknown, typeEntite: string, entiteId?: string): Promise<Fichier> {
  await exigerSession();
  const f = typeof id === "string" && /^f-[A-Za-z0-9_-]{1,40}$/.test(id) ? await depots().fichiers.obtenir(id) : null;
  if (!f || f.origine !== "depot" || !f.cleStockage || f.cleStockage.split("/")[2] !== typeEntite || (entiteId !== undefined && f.cleStockage.split("/")[3] !== entiteId)) {
    throw new ErreurStudio("FICHIER_INCONNU", "Ce fichier n'est pas arrivé. Envoyez-le à nouveau.");
  }
  if (f.statut !== "pret") throw new ErreurStudio("ENVOI_INCOMPLET", "Le fichier n'est pas encore arrivé. Réessayez dans un instant.");
  return f;
}

/** Plusieurs fichiers envoyés (même contrôle, dans l'ordre). */
export async function fichiersEnvoyes(ids: unknown, typeEntite: string, entiteId?: string, max = 20): Promise<Fichier[]> {
  if (!Array.isArray(ids) || !ids.length) throw new ErreurStudio("FICHIERS", "Choisissez au moins un fichier.");
  const liste: Fichier[] = [];
  for (const id of ids.slice(0, max)) liste.push(await fichierEnvoye(id, typeEntite, entiteId));
  return liste;
}

/**
 * Dépôt SIMULÉ (V1) selon le contrat StockageFichiers (AV2.2-3) : preparerDepot donne la clé
 * `studio/{env}/{type}/{entiteId}/{fichierId}.{ext}`, confirmerDepot valide, urlLecture lit.
 * En simulation aucun octet n'est envoyé ; la lecture renvoie un média de démonstration du même type.
 * Brancher R2 = ajouter un fournisseur « stockage », sans toucher à ce service.
 */
export async function deposerFichierSimule(demande: { nom: string; mime: string; taille: number; typeEntite: string; entiteId: string }): Promise<Fichier> {
  await exigerSession();
  const id = nouvelId("f");
  const stockage = await fournisseur("stockage");
  const { cleStockage } = await stockage.preparerDepot({ fichierId: id, nom: demande.nom, mime: demande.mime, taille: demande.taille, typeEntite: demande.typeEntite, entiteId: demande.entiteId });
  const confirmation = await stockage.confirmerDepot(cleStockage);
  const fichier: Fichier = {
    id,
    cleStockage,
    nom: demande.nom,
    mime: demande.mime,
    taille: demande.taille,
    sha256: confirmation.sha256,
    origine: "depot",
    statut: confirmation.ok ? "pret" : "refuse",
    ...horodatage(),
  };
  return depots().fichiers.enregistrer(fichier);
}
