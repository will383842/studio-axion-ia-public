"use server";

/**
 * Actions serveur du calendrier (L4-06) : décaler une entrée future. Chaque action commence par exigerSession().
 * Aucun appel au fournisseur. Fichier propre à ce geste : actions.ts ne garde que les deux actions de la fiche d'entrée.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { depots, maintenant, sousVerrou } from "@/services/_commun";
import { AVERTISSEMENT_DECALAGE_BROUILLON, niveauDiffuseurDuCreneau, refusModificationCreneau } from "@/services/garde-creneau-diffuseur";
import { decaler, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import { instantParis } from "@/lib/horloge-paris";

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
function jourExiste(j: string): boolean {
  const [a, m, d] = j.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const RAISON_MAX = 200;
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

export type ResultatDecalage = { ok: true; donnees: CreneauPlan; avertissement?: string } | { ok: false; message: string };

/**
 * L4-06 : décaler une entrée FUTURE (le passé et le publié sont refusés). Aucun appel au fournisseur.
 * - Entrée confiée à l'usine (repérée ou signée) : décalée et marquée « aRenvoyer » (le service le pose) ; la reprogrammation relève de la session Zernio.
 * - Entrée déjà confiée au diffuseur (programmée ou en échec) : REFUSÉE tant que CAL-23 n'est pas livrée (« Retirez-la d'abord »), sans aucun changement de date.
 * - L5-02d : le refus couvre aussi le créneau resté « valide » mais confié au diffuseur (brouillon promu, promotion en cours, à vérifier,
 *   programmé, parti) : la garde est lue SOUS `sousVerrou`, dans la même section que l'écriture, donc jamais un post programmé ET un
 *   créneau décalé. Niveau « brouillon » seulement : décalage accepté avec un `avertissement`. Aucun appel au diffuseur.
 */
export async function decalerEntree(saisie: SaisieDecalage): Promise<ResultatDecalage> {
  await exigerSession();
  if (!JOUR.test(saisie.nouveauJour ?? "") || !jourExiste(saisie.nouveauJour)) return { ok: false, message: "Jour invalide (AAAA-MM-JJ attendu)." };
  if (!CLE.test(saisie.cle ?? "")) return { ok: false, message: "Clé de formulaire invalide." };
  const raison = (saisie.raison ?? "").trim();
  if (raison.length === 0) return { ok: false, message: "Indiquez une raison." };
  if (raison.length > RAISON_MAX) return { ok: false, message: `La raison est trop longue (${RAISON_MAX} caractères au plus).` };
  try {
    // Relecture du créneau, garde et écriture : une seule section sous le verrou partagé avec le tour d'envoi. La notification et le
    // rafraîchissement de la page restent HORS du verrou (verrou global non réentrant).
    let rejoue = false;
    const sortie = await sousVerrou<ResultatDecalage>(async () => {
      const d = depotsPlan();
      const n = await niveauDiffuseurDuCreneau(saisie.id);
      const refusGarde = refusModificationCreneau(n, "decaler");
      if (refusGarde) return { ok: false, message: refusGarde };
      const avertissement = n.niveau === "brouillon" ? { avertissement: AVERTISSEMENT_DECALAGE_BROUILLON } : {};
      const c = await d.creneaux.obtenir(saisie.id);
      if (!c) return { ok: false, message: `Entrée introuvable : ${saisie.id}` };
      // Un rejeu de clé déjà journalisée est rendu par le service, avant tout contrôle de date (le créneau a déjà bougé).
      // Les lignes du journal s'appellent `decalage:<créneau>:<clé>#<rang>` : on cherche par préfixe.
      const prefixeRejeu = `decalage:${saisie.id}:${saisie.cle}#`;
      const rejeu = (await depots().journalDecalages.lister((l: { id: string }) => l.id.startsWith(prefixeRejeu))).length > 0;
      if (rejeu) {
        rejoue = true;
        return { ok: true, donnees: await decaler(d, saisie.id, { nouveauJour: saisie.nouveauJour, raison, cle: saisie.cle }, maintenant()), ...avertissement };
      }
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
      const donnees = await decaler(d, saisie.id, { nouveauJour: saisie.nouveauJour, raison, cle: saisie.cle }, maintenant());
      return { ok: true, donnees, ...avertissement };
    });
    // Le rafraîchissement est secondaire : l'écriture a eu lieu, un échec ici ne doit pas la faire passer pour ratée.
    if (sortie.ok && !rejoue) { try { revalidatePath("/calendrier"); } catch { /* muet */ } }
    return sortie;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Décalage impossible." };
  }
}
