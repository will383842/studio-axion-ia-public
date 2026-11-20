/**
 * BILAN DURABLE DES DÉCOUPAGES DU TABLEAU (FIX-DECOUPAGE-COMPTEUR-c) : écrit, pour chaque découpage, le bilan des refus
 * dans le dépôt `evenements` (type `tableau-bilan-decoupage`), et le relit pour la page « Refus du découpage ».
 * Ne lance JAMAIS d'erreur : un bilan perdu ne doit rien casser.
 */
import "server-only";
import { chiffreRefusDecoupage, idBilan, TYPE_EVENEMENT_BILAN_DECOUPAGE, type ChiffreRefusDecoupage, type EvenementBilanDecoupage } from "@/domaine/tableau-bilan-decoupage";
import type { BilanDecoupage } from "@/moteurs/montage-tableau/bilan-refus";
import { depots, horodatage, maintenant } from "./_commun";

/** Issues d'arrêt sans jugement des règles : jamais consignées (« Réessayer » reprend la même tâche, le vrai bilan viendra). */
const ISSUES_SANS_JUGEMENT: readonly string[] = ["budget", "appel", "simulation"];

/** Consigne le bilan d'un découpage. Identifiant stable par (vidéo, tâche, version) : rejouer n'écrit pas deux fois. */
export async function consignerBilanDecoupage(bilan: BilanDecoupage, { tacheId, estDemo }: { tacheId: string; estDemo: boolean }): Promise<void> {
  try {
    if (ISSUES_SANS_JUGEMENT.includes(bilan.issue)) return;
    // Vidéo supprimée (pendant l'appel ou avant) : rien n'est écrit ni recréé (règle D2).
    if (!(await depots().videos.obtenir(bilan.videoId))) return;
    const id = idBilan(bilan.videoId, tacheId, bilan.versionId);
    if (await depots().evenements.obtenir(id)) return;
    const ev: EvenementBilanDecoupage = {
      id,
      type: TYPE_EVENEMENT_BILAN_DECOUPAGE,
      message: "Découpage du tableau : bilan consigné",
      entite: "video",
      entiteId: bilan.videoId,
      estDemo,
      date: maintenant(),
      ...horodatage(),
      bilan,
    };
    await depots().evenements.enregistrer(ev);
  } catch {
    /* jamais d'erreur : le bilan durable est un plus */
  }
}

/** Le chiffre des `joursMax` derniers jours, vidéos d'exemple exclues. Liste vide si la lecture échoue. */
export async function lireChiffreRefusDecoupage({ joursMax = 30 }: { joursMax?: number } = {}): Promise<ChiffreRefusDecoupage> {
  try {
    const limite = Date.now() - joursMax * 86_400_000;
    const evenements = await depots().evenements.lister((e) => e.type === TYPE_EVENEMENT_BILAN_DECOUPAGE && !e.estDemo && new Date(e.date).getTime() >= limite);
    return chiffreRefusDecoupage(evenements.map((e) => (e as Partial<EvenementBilanDecoupage>).bilan).filter((b): b is BilanDecoupage => !!b));
  } catch {
    return chiffreRefusDecoupage([]);
  }
}
