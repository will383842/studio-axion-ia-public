/**
 * L5-07 · sonde de publication : un envoi du calendrier échu depuis 20 minutes ou plus sans être parti passe « à vérifier »,
 * avec UNE seule alerte (cloche + e-mail, jamais de push ; marqueur durable). Lecture seule : aucun envoi, aucune promotion,
 * et SANS effet sur le statut HTTP de /api/sante. Arrêt d'urgence (envoi automatique éteint) : la sonde ne fait rien.
 */
import "server-only";
import { CLE_ENVOI_AUTOMATIQUE } from "@/domaine/interrupteurs/registre";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { instantParis } from "@/lib/horloge-paris";
import { depots, ecrireParametre, lireParametre } from "./_commun";
import { alerterHeureH } from "./notifications";

export const SEUIL_RETARD_PUBLICATION_MS = 20 * 60_000;
export const PARAM_MARQUEUR_SONDE = "sonde-publication.marques";
const DUREE_MARQUE_MS = 7 * 24 * 60 * 60_000;
/** Statuts d'un envoi qui devrait déjà être parti à son heure. */
const ATTENDUS = new Set(["valide", "programme", "confirme", "a-envoyer"]);

export const TEXTE_SONDE_PUBLICATION = {
  titre: "Une publication est à vérifier",
  message: (jour: string, heure: string) => `La publication prévue le ${jour} à ${heure} n'est pas partie à l'heure. Ouvrez le calendrier pour vérifier : rien n'a été renvoyé.`,
} as const;

export type EtatSondePublication = "ok" | "a-verifier" | "arret" | "inconnu";

/** PUR : les envois échus depuis au moins 20 minutes et pas encore partis. */
export function envoisEnRetard(entrees: Pick<EnvoiPlanifie, "cle" | "jour" | "heure" | "statut">[], instant: number): typeof entrees {
  return entrees.filter((e) => {
    if (!ATTENDUS.has(e.statut) || !e.heure) return false;
    const t = Date.parse(instantParis(e.jour, e.heure));
    return Number.isFinite(t) && instant - t >= SEUIL_RETARD_PUBLICATION_MS;
  });
}

export interface OptionsSonde {
  maintenant?: () => number;
  /** Porte (tests) ; défaut : le réglage « envoi automatique ». */
  autorisee?: () => Promise<boolean>;
}

export interface ResultatSonde {
  etat: EtatSondePublication;
  retards: number;
  alertes: number;
}

/** Ne lève jamais. Éteint : rien n'est lu ni écrit. */
export async function sonderPublication(options: OptionsSonde = {}): Promise<ResultatSonde> {
  const instant = (options.maintenant ?? Date.now)();
  try {
    const ouverte = options.autorisee ? await options.autorisee() : (await lireParametre<unknown>(CLE_ENVOI_AUTOMATIQUE, false)) === true;
    if (ouverte !== true) return { etat: "arret", retards: 0, alertes: 0 };
    const entrees = await depots().envoisPlanifies.lister((e) => ATTENDUS.has(e.statut));
    const retards = envoisEnRetard(entrees, instant);
    if (!retards.length) return { etat: "ok", retards: 0, alertes: 0 };
    const marques = await lireParametre<Record<string, string>>(PARAM_MARQUEUR_SONDE, {});
    for (const [k, v] of Object.entries(marques)) if (Date.parse(v) < instant - DUREE_MARQUE_MS) delete marques[k];
    let alertes = 0;
    for (const e of retards.sort((a, b) => a.cle.localeCompare(b.cle))) {
      const cle = `${e.cle}:${e.jour}:${e.heure ?? ""}`;
      if (marques[cle]) continue;
      // Création d'abord, marque ensuite : si la création échoue, l'alerte reviendra.
      await alerterHeureH({ titre: TEXTE_SONDE_PUBLICATION.titre, message: TEXTE_SONDE_PUBLICATION.message(e.jour, e.heure ?? "") });
      marques[cle] = new Date(instant).toISOString();
      await ecrireParametre(PARAM_MARQUEUR_SONDE, marques);
      alertes++;
    }
    return { etat: "a-verifier", retards: retards.length, alertes };
  } catch (erreur) {
    console.error("[studio] sonde de publication en échec", erreur instanceof Error ? erreur.name : "erreur");
    return { etat: "inconnu", retards: 0, alertes: 0 };
  }
}
