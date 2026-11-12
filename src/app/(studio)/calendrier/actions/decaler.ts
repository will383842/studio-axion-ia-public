"use server";

/**
 * Actions serveur du calendrier (L4-06) : décaler une entrée future. Chaque action commence par exigerSession().
 * Aucun appel au fournisseur. Fichier propre à ce geste : actions.ts ne garde que les deux actions de la fiche d'entrée.
 */
import { exigerSession } from "@/services/auth";
import { depots, maintenant } from "@/services/_commun";
import { decaler, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import { instantParis } from "@/lib/horloge-paris";

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
function jourExiste(j: string): boolean {
  const [a, m, d] = j.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const CLE = /^[A-Za-z0-9_-]{1,64}$/;

function depotsPlan(): DepotsPlan {
  const d = depots();
  return { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] };
}

export interface SaisieDecalage {
  id: string;
  /** AAAA-MM-JJ (jour de Paris) ; l'heure de Paris de chaque réseau est conservée. */
  nouveauJour: string;
  raison: string;
  /** Clé stable du formulaire ouvert (idempotence). */
  cle: string;
}

export type ResultatDecalage = { ok: true; donnees: CreneauPlan } | { ok: false; message: string };

/**
 * L4-06 : décaler une entrée FUTURE (le passé et le publié sont refusés). Aucun appel au fournisseur.
 * - Entrée confiée à l'usine (repérée ou signée) : décalée et marquée « aRenvoyer » (le service le pose) ; la reprogrammation relève de la session Zernio.
 * - Entrée déjà confiée au diffuseur (programmée ou en échec) : REFUSÉE tant que CAL-23 n'est pas livrée (« Retirez-la d'abord »), sans aucun changement de date.
 */
export async function decalerEntree(saisie: SaisieDecalage): Promise<ResultatDecalage> {
  await exigerSession();
  if (!JOUR.test(saisie.nouveauJour ?? "") || !jourExiste(saisie.nouveauJour)) return { ok: false, message: "Jour invalide (AAAA-MM-JJ attendu)." };
  if (!CLE.test(saisie.cle ?? "")) return { ok: false, message: "Clé de formulaire invalide." };
  try {
    const d = depotsPlan();
    const c = await d.creneaux.obtenir(saisie.id);
    if (!c) return { ok: false, message: `Entrée introuvable : ${saisie.id}` };
    // Un rejeu de clé déjà journalisée est rendu par le service, avant tout contrôle de date (le créneau a déjà bougé).
    const rejeu = await depots().journalDecalages.obtenir(`decalage:${saisie.id}:${saisie.cle}`);
    if (rejeu) return { ok: true, donnees: await decaler(d, saisie.id, { nouveauJour: saisie.nouveauJour, raison: saisie.raison, cle: saisie.cle }, maintenant()) };
    if (c.statut === "publie") return { ok: false, message: "Cette entrée est publiée : elle ne se décale pas." };
    if (c.statut === "archive") return { ok: false, message: "Cette entrée est archivée : elle ne se décale pas." };
    if (c.statut === "programme" || c.statut === "echec") return { ok: false, message: "Cette entrée est déjà confiée au diffuseur. Retirez-la d'abord, puis décalez-la." };
    const maintenantMs = Date.now();
    const heures = Object.values(c.heuresParReseau).filter((h): h is string => Boolean(h));
    const dejaPassee = heures.length
      ? heures.some((h) => Date.parse(h) <= maintenantMs)
      : Date.parse(instantParis(c.jourVise, "23:59")) <= maintenantMs;
    if (dejaPassee) return { ok: false, message: "Cette entrée est passée : elle ne se décale pas." };
    const nouvelles = heures.length ? heures.map((h) => instantParis(saisie.nouveauJour, heureAffichageParis(h))) : [instantParis(saisie.nouveauJour, "23:59")];
    if (nouvelles.some((h) => Date.parse(h) <= maintenantMs)) return { ok: false, message: "Ce jour est passé : choisissez une date à venir." };
    return { ok: true, donnees: await decaler(d, saisie.id, { nouveauJour: saisie.nouveauJour, raison: saisie.raison, cle: saisie.cle }, maintenant()) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Décalage impossible." };
  }
}
