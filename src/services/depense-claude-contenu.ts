/**
 * DÉPENSE CLAUDE RATTACHÉE À TOUT CONTENU (L3-02, D4-08).
 *
 * Porte d'entrée générique au-dessus du chemin vidéo (`executerRolePourVideo`, signature inchangée) : le contenu
 * (vidéo, vidéo importée) est désigné par son type et son identifiant, et la dépense reste rattachée à cet identifiant.
 * Règles :
 *  - origine « usine » (fabrication automatique) : SEUL le quota de quantité arrête la fabrication. Ce quota est un
 *    nombre d'appels Claude par jour (réglage `claude.quotaAppelsParJour`), jamais un montant ; atteint, la fabrication
 *    automatique s'arrête et un message apparaît dans le journal du cockpit ;
 *  - origine « studio » : on prévient (journal) sans bloquer ; une action lancée à la main (`parWill`) n'est jamais bloquée ;
 *  - crédit Claude réellement épuisé chez le fournisseur : « en-attente-credit » ;
 *  - aucun message ne contient de montant (phrase fixe par cause) ;
 *  - le chemin commun est appelé en mode `quotaSeul` : plafond par vidéo, limite du mois et budget usine ne font que prévenir.
 * Cette porte ne dépense rien elle-même : elle garde puis délègue, les gardes d'argent restent dans le chemin commun.
 */
import "server-only";
import type { z } from "zod";
import type { Id } from "@/domaine/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { cleJour } from "@/lib/dates";
import { depots, journaliser, lireParametre } from "./_commun";
import type { OrigineLancement } from "./budget-mensuel";
import { executerRolePourVideo, type ResultatVideo } from "./depense-claude-video";
import { origineDeLaVideo } from "./mode-budget";

/** Contenus pris en charge : une vidéo, ou une vidéo importée (qui a aussi un enregistrement vidéo). */
export interface ContenuRef {
  type: "video" | "video-importee";
  id: Id;
}

export const PARAM_QUOTA_APPELS_JOUR = "claude.quotaAppelsParJour";
export const QUOTA_APPELS_JOUR_DEFAUT = 300;

export type ResultatContenu<T = unknown> = ResultatVideo<T> | { ok: false; arret: "quota-quantite"; message: string };

export async function quotaAppelsJour(): Promise<number> {
  const v = await lireParametre<number>(PARAM_QUOTA_APPELS_JOUR, QUOTA_APPELS_JOUR_DEFAUT);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : QUOTA_APPELS_JOUR_DEFAUT;
}

/** Nombre de dépenses Claude enregistrées aujourd'hui (une dépense = un appel). */
export async function appelsClaudeDuJour(): Promise<number> {
  const jour = cleJour(new Date());
  const l = await depots().depenses.lister((x) => cleJour(x.date) === jour && x.lignes.some((g) => g.fournisseur === "anthropic"));
  return l.length;
}

const MESSAGE_QUOTA = "Quota d'appels du jour atteint : la fabrication automatique s'arrête, elle reprendra demain.";
const MESSAGE_CREDIT = "En attente de crédit Claude : le texte actuel est gardé.";
const MESSAGE_INTERNE = "Limite interne atteinte : le texte actuel est gardé.";
const MESSAGE_AUTRE = "L'étape n'a pas été lancée : le texte actuel est gardé.";

/** Phrase FIXE par cause (jamais le message brut, donc jamais de montant). Le crédit n'est « épuisé » que s'il l'est chez le fournisseur. */
function phraseDuRefus(r: { arret: string; message: string }): string {
  if (r.arret === "en-attente-credit") {
    // Plafonds internes (limite du mois, budget du mois) : pas un crédit épuisé chez le fournisseur.
    return /^(limite claude du mois|budget du mois)/i.test(r.message.trim()) ? MESSAGE_INTERNE : MESSAGE_CREDIT;
  }
  return r.arret === "budget-usine" || r.arret === "plafond-video" ? MESSAGE_INTERNE : MESSAGE_AUTRE;
}

export async function executerRolePourContenu<S extends z.ZodType>(
  contenu: ContenuRef,
  role: DefinitionRole<S>,
  entree: EntreeRole,
  options: { etape: string; origine?: OrigineLancement; parWill?: boolean },
): Promise<ResultatContenu<z.infer<S>>> {
  const origine: OrigineLancement = options.origine ?? (options.parWill ? "studio" : await origineDeLaVideo(contenu.id));

  if (!options.parWill) {
    const atteint = (await appelsClaudeDuJour()) >= (await quotaAppelsJour());
    if (atteint) {
      if (origine === "usine") {
        await journaliser("publication", "Quota d'appels Claude du jour atteint : fabrication automatique arrêtée", { type: "video", id: contenu.id });
        return { ok: false, arret: "quota-quantite", message: MESSAGE_QUOTA };
      }
      await journaliser("publication", "Quota d'appels Claude du jour atteint : rien n'est arrêté", { type: "video", id: contenu.id });
    }
  }

  const r = await executerRolePourVideo(contenu.id, role, entree, { etape: options.etape, origine, quotaSeul: true, ...(options.parWill ? { parWill: true } : {}) });
  if (r.ok) return r;
  return { ...r, message: phraseDuRefus(r) };
}
