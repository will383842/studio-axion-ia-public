/**
 * ENVOIS DE FICHIERS PAR MORCEAUX (lot M1b, B.9 ter) — côté studio : il ne fait que SIGNER ; les octets vont
 * directement du navigateur au seau R2. Sans R2 (simulation), aucun octet n'est envoyé et le fichier est
 * enregistré tel quel (comme `deposerFichierSimule`). Utilisé par `/api/depots`.
 */
import "server-only";
import type { Fichier } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { tailleMorceau } from "@/lib/envoi-multipart";
import { TAILLE_MAX_ENVOI, tailleMaxEnvoi } from "@/formats";
import { assurerEmpreinte, estEntreeControlee, signalerEmpreinteManquante } from "./empreintes-fichiers";
import { depots, ErreurStudio, fournisseur, horodatage } from "./_commun";

/** Forme d'une clé de dépôt acceptée (aucune autre clé ne peut être signée). */
const CLE_VALIDE = /^studio\/(dev|prod)\/[a-z0-9-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[a-z0-9]{1,8}$/;
/** Types d'entité qui reçoivent des fichiers. */
const TYPES_ENTITE = new Set(["visage", "voix", "personnage", "element", "video", "rush", "accord", "plan", "entree"]);
/** 4 Go au plus par fichier (règle commune) ; une prise d'un format qui en déclare plus (facecam : 15 Go) y a droit. */
const TAILLE_MAX = TAILLE_MAX_ENVOI;

export interface DescriptifEnvoi {
  nom: string;
  mime: string;
  taille: number;
  typeEntite: string;
  entiteId: string;
}

/**
 * Plafond de taille d'un envoi. Plan facecam v4 (lot A) : une prise (`rush`) envoyée à une séance ou à une version d'un
 * format qui le déclare (facecam : 15 Go) ; tout le reste, avocat compris, garde 4 Go.
 */
async function tailleMaxDe(d: DescriptifEnvoi): Promise<number> {
  if (d.typeEntite !== "rush" || !/^[A-Za-z0-9_-]{1,80}$/.test(d.entiteId)) return TAILLE_MAX;
  const depot = depots();
  const seance = await depot.sessionsTournage.obtenir(d.entiteId);
  const varianteIds = seance ? seance.varianteIds : [d.entiteId];
  const formats = await Promise.all(varianteIds.map(async (id) => (await depot.variantes.obtenir(id))?.formatId));
  return tailleMaxEnvoi(formats);
}

function libelleTaille(octets: number): string {
  return `${Math.round(octets / (1024 * 1024 * 1024))} Go`;
}

async function verifierDescriptif(d: DescriptifEnvoi): Promise<number> {
  if (!d.nom || typeof d.nom !== "string" || d.nom.length > 200) throw new ErreurStudio("NOM_INVALIDE", "Ce fichier n'a pas de nom valable.");
  if (!TYPES_ENTITE.has(d.typeEntite) || !/^[A-Za-z0-9_-]{1,80}$/.test(d.entiteId)) throw new ErreurStudio("CIBLE_INVALIDE", "Destination inconnue.");
  const max = d.taille > TAILLE_MAX ? await tailleMaxDe(d) : TAILLE_MAX;
  if (!Number.isFinite(d.taille) || d.taille < 0 || d.taille > max) throw new ErreurStudio("TAILLE_INVALIDE", `Ce fichier dépasse ${libelleTaille(max)}.`);
  return max;
}

export function verifierCle(cle: unknown): string {
  if (typeof cle !== "string" || !CLE_VALIDE.test(cle)) throw new ErreurStudio("CLE_INVALIDE", "Envoi inconnu.");
  return cle;
}

export async function commencerEnvoi(d: DescriptifEnvoi): Promise<{ fichierId: string; cle: string; idEnvoi?: string; simulation: boolean; tailleMorceau: number }> {
  await verifierDescriptif(d);
  const stockage = await fournisseur("stockage");
  const fichierId = nouvelId("f");
  const { cleStockage } = await stockage.preparerDepot({ fichierId, nom: d.nom, mime: d.mime, taille: d.taille, typeEntite: d.typeEntite, entiteId: d.entiteId });
  if (!stockage.multipart) return { fichierId, cle: cleStockage, simulation: true, tailleMorceau: tailleMorceau(d.taille) };
  const { idEnvoi } = await stockage.multipart.commencer(cleStockage, d.mime || "application/octet-stream");
  return { fichierId, cle: cleStockage, idEnvoi, simulation: false, tailleMorceau: tailleMorceau(d.taille) };
}

export async function signerMorceaux(cle: unknown, idEnvoi: unknown, numeros: unknown): Promise<Record<number, string>> {
  const stockage = await fournisseur("stockage");
  if (!stockage.multipart || typeof idEnvoi !== "string") throw new ErreurStudio("PAS_DE_STOCKAGE", "Envoi indisponible.");
  const liste = Array.isArray(numeros) ? numeros.filter((n): n is number => Number.isInteger(n)).slice(0, 50) : [];
  return stockage.multipart.signerMorceaux(verifierCle(cle), idEnvoi, liste);
}

export async function morceauxRecus(cle: unknown, idEnvoi: unknown) {
  const stockage = await fournisseur("stockage");
  if (!stockage.multipart || typeof idEnvoi !== "string") return [];
  try {
    return await stockage.multipart.morceauxRecus(verifierCle(cle), idEnvoi);
  } catch (e) {
    // Envoi inconnu du seau (déjà terminé, ou expiré) : refus net, le navigateur recommence l'envoi au lieu de réessayer sans fin.
    if ((e as { statut?: unknown } | null)?.statut === 404) throw new ErreurStudio("ENVOI_EXPIRE", "Cet envoi n'existe plus : il repart du début.");
    throw e;
  }
}

/** Fin de l'envoi : le stockage assemble les morceaux, puis le fichier est enregistré (statut « prêt » si le seau le confirme). */
export async function terminerEnvoi(d: DescriptifEnvoi & { fichierId: string; cle: unknown; idEnvoi?: unknown; morceaux?: unknown }): Promise<Fichier> {
  const max = await verifierDescriptif(d);
  const cle = verifierCle(d.cle);
  if (!/^f[A-Za-z0-9_-]*$/.test(d.fichierId) || !cle.includes(`/${d.fichierId}.`)) throw new ErreurStudio("CLE_INVALIDE", "Envoi inconnu.");
  const existant = await depots().fichiers.obtenir(d.fichierId);
  if (existant) return existant;
  const stockage = await fournisseur("stockage");
  if (stockage.multipart && typeof d.idEnvoi === "string") {
    const morceaux = (Array.isArray(d.morceaux) ? d.morceaux : []).filter((m): m is { numero: number; etag: string } => !!m && Number.isInteger(m.numero) && typeof m.etag === "string");
    if (!morceaux.length) throw new ErreurStudio("ENVOI_INCOMPLET", "L'envoi n'est pas complet. Réessayez.");
    try {
      await stockage.multipart.terminer(cle, d.idEnvoi, morceaux);
    } catch (e) {
      // Fin redemandée après un redémarrage (la première a assemblé le fichier, sa réponse s'est perdue) : le fichier est là, on l'enregistre.
      if (!(await stockage.confirmerDepot(cle).catch(() => ({ ok: false }))).ok) throw e;
    }
  }
  const confirmation = await stockage.confirmerDepot(cle);
  // Lot R7 (relecture sécurité n° 5) : la taille RÉELLE confirmée par le stockage, quand il la donne, doit être celle
  // annoncée par le navigateur, et sous le plafond (la taille annoncée seule ne prouve rien).
  if (confirmation.ok && confirmation.taille !== undefined && (confirmation.taille !== d.taille || confirmation.taille > max)) {
    throw new ErreurStudio("ENVOI_INCOMPLET", "Le fichier reçu ne correspond pas à celui envoyé. Envoyez-le à nouveau.");
  }
  const fichier: Fichier = { id: d.fichierId, cleStockage: cle, nom: d.nom, mime: d.mime, taille: d.taille, sha256: confirmation.sha256, origine: "depot", statut: confirmation.ok ? "pret" : "en_attente", ...horodatage() };
  const enregistre = await depots().fichiers.enregistrer(fichier);
  // Anti-doublon de sujets : l'empreinte d'une image / d'une prise d'entrée se calcule EN ARRIÈRE-PLAN (jamais attendue ici :
  // lire 15 Go prend des minutes). Un échec est consigné. Le rattrapage
  // `rattraperEmpreintesEntrees` repasse sur les fichiers restés sans empreinte : il est appelé, borné, juste avant le contrôle
  // « déjà traité » des dépôts (image → vidéo, lot, face caméra animée). Travail de fond : après les dépôts dans la file de lectures.
  // ASSUMÉ : ce calcul de fond lit R2 même quand le réglage `sujets.garde` est « eteint » (comme avant cette PR : aucune
  // décision ne dépend de lui, il prépare seulement le contrôle si Will rallume la garde). Seuls les dépôts respectent « eteint ».
  if (enregistre.statut === "pret" && estEntreeControlee(cle)) {
    void assurerEmpreinte(enregistre, { fond: true }).catch((e) => {
      console.error("[empreinte]", d.fichierId, e);
      signalerEmpreinteManquante(); // le rattrapage repassera sur ce fichier
    });
  }
  return enregistre;
}
