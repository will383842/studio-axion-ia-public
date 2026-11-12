/**
 * Service du plan éditorial (L1-08). Les dépôts sont passés en paramètre (doublure en test).
 * Isolation : ce service n'importe jamais de fournisseur (réseau, modèle d'IA, diffuseur) et ne fait aucun appel.
 * Le journal des décalages est en AJOUT SEUL : une ligne par décalage, jamais modifiée ni effacée.
 * Rien ne part sans la validation du fondateur : ce service tient l'état du plan, il ne publie pas.
 */
import "server-only";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import { cleEnvoi } from "@/domaine/envoi-planifie";
import { transitionner, validerCreneau, heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import type { AuteurPlan, CreneauEditorial, StatutPlan } from "@/domaine/plan-editorial/types";
import type { ReseauDeclinaison } from "@/domaine/types";
import { instantParis } from "@/lib/horloge-paris";

/** Créneau du plan, avec le drapeau « à renvoyer à l'usine » (posé par un décalage, sans appel). */
export type CreneauPlan = CreneauEditorial & { aRenvoyer?: boolean };

export interface DepotsPlan {
  creneaux: Depot<CreneauPlan>;
  journal: Depot<JournalDecalage>;
}

export type DonneesCreneau = Omit<CreneauEditorial, "statut" | "decalages">;
export interface DemandeDecalage {
  nouveauJour: string;
  raison: string;
  /** Clé d'idempotence : la même clé ne produit qu'une ligne de journal et un seul décalage. */
  cle: string;
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
/** Réseaux pour lesquels un envoi planifié existe (ReseauDeclinaison). */
const RESEAUX_ENVOI: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"];

async function lire(d: DepotsPlan, id: string): Promise<CreneauPlan> {
  const c = await d.creneaux.obtenir(id);
  if (!c) throw new Error(`Créneau introuvable : ${id}`);
  return c;
}

/** Idempotent : un créneau déjà présent (même id) est rendu tel quel. Naît « propose », sans décalage. */
export async function creerCreneau(d: DepotsPlan, donnees: DonneesCreneau, _maintenant: string): Promise<CreneauPlan> {
  const existant = await d.creneaux.obtenir(donnees.id);
  if (existant) return existant;
  const c: CreneauPlan = { ...donnees, statut: "propose", decalages: 0 };
  const erreurs = validerCreneau(c);
  if (erreurs.length) throw new Error(erreurs.join(" "));
  return d.creneaux.enregistrer(c);
}

/** Un créneau est « confié » quand l'usine l'a repéré ou signé : un décalage doit alors lui être renvoyé. */
export function estConfie(c: CreneauEditorial): boolean {
  return Boolean(c.repereUsine || c.signatureUsine);
}

export async function decaler(d: DepotsPlan, id: string, demande: DemandeDecalage, maintenant: string): Promise<CreneauPlan> {
  const c = await lire(d, id);
  const idLigne = `decalage:${id}:${demande.cle}`;
  const ligne = await d.journal.obtenir(idLigne);
  // Rejeu d'une clé déjà journalisée : indépendant de l'ordre de lecture du journal. On ne réapplique que s'il reste exactement UNE ligne non
  // appliquée pour ce créneau (nombre de lignes = décalages + 1) ET que le créneau est encore à l'ancien jour de cette ligne (écriture du
  // créneau tombée en panne) ; sinon (déjà appliqué, ou décalé depuis) on rend le créneau tel quel. La ligne du journal fait foi (jour, raison).
  const lignes = await d.journal.lister((l) => l.creneauId === id);
  if (ligne) {
    if (c.jourVise !== ligne.ancienJour || lignes.length !== c.decalages + 1) return c;
  } else if (lignes.length > c.decalages) {
    // Une ligne d'un décalage précédent n'a pas été appliquée au créneau : rejouer d'abord sa clé (sinon « un décalage = une ligne » est faux).
    throw new Error(`Décalage refusé : un décalage précédent du créneau ${id} n'a pas été appliqué ; rejouer d'abord sa clé.`);
  }
  if (c.statut === "publie") throw new Error(`Décalage refusé : le créneau ${id} est publié.`);
  if (c.statut === "archive") throw new Error(`Décalage refusé : le créneau ${id} est archivé.`);
  if (c.statut === "programme" || c.statut === "echec") {
    throw new Error(`Décalage refusé : le créneau ${id} est « ${c.statut} », un envoi existe déjà ; le repasser d'abord à « valide » après retrait de l'envoi.`);
  }
  // En réapplication, la ligne du journal fait foi : une même clé n'a jamais deux effets différents.
  const nouveauJour = ligne ? ligne.nouveauJour : demande.nouveauJour;
  if (!JOUR.test(nouveauJour) || Number.isNaN(Date.parse(nouveauJour))) throw new Error("Jour invalide (AAAA-MM-JJ attendu).");
  const heures: CreneauEditorial["heuresParReseau"] = {};
  for (const [reseau, h] of Object.entries(c.heuresParReseau)) {
    if (h) heures[reseau as keyof typeof heures] = instantParis(nouveauJour, heureAffichageParis(h));
  }
  const modifie: CreneauPlan = {
    ...c, jourVise: nouveauJour, heuresParReseau: heures, decalages: c.decalages + 1,
    ...(estConfie(c) ? { aRenvoyer: true } : {}),
  };
  // Journal (ajout seul) puis créneau ; un rejeu avec la même clé réapplique le créneau si besoin, sans second journal.
  if (!ligne) await d.journal.enregistrer({ id: idLigne, creneauId: id, ancienJour: c.jourVise, nouveauJour, raison: demande.raison, creeLe: maintenant });
  return d.creneaux.enregistrer(modifie);
}

export async function changerStatut(d: DepotsPlan, id: string, vers: StatutPlan, auteur: AuteurPlan, _maintenant: string): Promise<CreneauPlan> {
  const c = await lire(d, id);
  const r = transitionner(c, vers, auteur);
  if (!r.ok) throw new Error(r.raison);
  return d.creneaux.enregistrer({ ...c, statut: vers });
}

/** Annuler = archiver (rien n'est supprimé). */
export function annuler(d: DepotsPlan, id: string, auteur: AuteurPlan, maintenant: string): Promise<CreneauPlan> {
  return changerStatut(d, id, "archive", auteur, maintenant);
}

/** Créneaux dont le jour visé est entre `du` et `au` (bornes incluses), triés par jour puis par id. */
export async function lirePeriode(d: DepotsPlan, du: string, au: string, options: { avecArchives?: boolean } = {}): Promise<CreneauPlan[]> {
  const liste = await d.creneaux.lister((c) => c.jourVise >= du && c.jourVise <= au && (options.avecArchives || c.statut !== "archive"));
  return liste.sort((a, b) => a.jourVise.localeCompare(b.jourVise) || a.id.localeCompare(b.id));
}

/** Correspondance plan → envois planifiés : une clé d'envoi par réseau géré, version = nombre de décalages. */
export function identifiantsProgrammation(c: CreneauPlan): { reseau: ReseauDeclinaison; cle: string }[] {
  const media = c.videoId ?? c.visuelId;
  if (!media) return [];
  return RESEAUX_ENVOI.filter((r) => c.heuresParReseau[r]).map((reseau) => ({ reseau, cle: cleEnvoi(media, reseau, c.decalages) }));
}

/** PORTE UNIQUE : seul un créneau validé, complet et sans renvoi en attente peut être programmé. */
export function peutProgrammer(c: CreneauPlan): { ok: true } | { ok: false; raison: string } {
  if (c.statut !== "valide") return { ok: false, raison: `Statut « ${c.statut} » : seul « valide » se programme.` };
  const erreurs = validerCreneau(c);
  if (erreurs.length) return { ok: false, raison: erreurs.join(" ") };
  if (!c.videoId && !c.visuelId) return { ok: false, raison: "Ni vidéo ni visuel." };
  if (Object.values(c.heuresParReseau).filter(Boolean).length === 0) return { ok: false, raison: "Aucune heure de publication." };
  if (c.aRenvoyer) return { ok: false, raison: "À renvoyer à l'usine après un décalage." };
  return { ok: true };
}

