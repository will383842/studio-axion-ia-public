/**
 * L0-09 · annexe de boucle « promotion et heure H » : un brouillon du calendrier qui n'est pas promu à l'approche de
 * son heure donne UNE alerte (cloche + e-mail, jamais de push), une seule par créneau et par cause (marqueur durable).
 * ÉTEINTE par défaut : protégée par `publication.editoriale_active` (créé par L7-08, faux par défaut) et par le
 * réglage séparé d'envoi du calendrier. Lecture seule : aucun appel au diffuseur, aucun envoi, aucune promotion.
 * Auto-limitée à une exécution toutes les 5 minutes ; une erreur ne casse jamais le tour de boucle.
 */
import "server-only";
import { TEXTE_ALERTE_HEURE_H } from "@/domaine/notifications-textes";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { instantParis } from "@/lib/horloge-paris";
import { depots, ecrireParametre, lireParametre } from "./_commun";
import { alerterHeureH } from "./notifications";
import { publicationEditorialeAutorisee } from "./zernio";

/** Recopié de L7-08 (`PARAM_ENVOI_CALENDRIER`, services/zernio.ts) ; le test échoue si les deux diffèrent. */
export const REGLAGE_ENVOI_CALENDRIER = "zernio.envoi_calendrier_autorise";
/** Recopié de L7-08 (`PARAM_EDITORIALE_ACTIVE`, services/zernio.ts) ; même contrôle par le test. */
export const REGLAGE_EDITORIALE_ACTIVE = "publication.editoriale_active";
/** Seuil d'alerte : 40 minutes avant l'heure (10 minutes avant le plancher de 30 minutes de la promotion). */
export const SEUIL_ALERTE_HEURE_H_MS = 40 * 60_000;
/** Auto-limite : au plus une exécution toutes les 5 minutes. */
export const INTERVALLE_SURVEILLANCE_HEURE_H_MS = 5 * 60_000;
/** Marqueur persistant des alertes déjà envoyées (clé = créneau + cause). */
export const PARAM_MARQUEUR_HEURE_H = "surveillance.heure-h";
/** Une marque plus vieille que ce délai est retirée : l'alerte part dans les 40 minutes avant l'heure, le créneau est passé depuis longtemps. */
export const DUREE_MARQUE_HEURE_H_MS = 24 * 60 * 60_000;
const PARAM_DERNIERE_EXECUTION = "surveillance.heure-h.derniere";

export type CauseHeureH = "non-promu";

/** Une clé d'alerte par créneau et par cause. */
export const cleAlerteHeureH = (e: Pick<EnvoiPlanifie, "cle" | "jour" | "heure">, cause: CauseHeureH): string => `${e.cle}:${e.jour}:${e.heure ?? ""}:${cause}`;

export interface OptionsSurveillanceHeureH {
  /** Horloge (tests : simulée). */
  maintenant?: () => number;
  /** Porte de l'annexe (tests) ; défaut : `publicationEditorialeAutorisee` (tout fermé par défaut). */
  autorisee?: () => Promise<boolean>;
}

/** Retourne le nombre d'alertes créées. Éteint, trop tôt ou en erreur : 0, rien n'est lu ni écrit. */
export async function surveillerHeureH(options: OptionsSurveillanceHeureH = {}): Promise<number> {
  const instant = (options.maintenant ?? Date.now)();
  try {
    if ((await (options.autorisee ?? publicationEditorialeAutorisee)()) !== true) return 0;
    const derniere = await lireParametre<number>(PARAM_DERNIERE_EXECUTION, 0);
    if (typeof derniere === "number" && instant - derniere < INTERVALLE_SURVEILLANCE_HEURE_H_MS && instant >= derniere) return 0;
    await ecrireParametre(PARAM_DERNIERE_EXECUTION, instant);
    const marques = await lireParametre<Record<string, string>>(PARAM_MARQUEUR_HEURE_H, {});
    // Retrait des clés passées (marqueur technique : aucune donnée de personne). Marque illisible : conservée.
    let retire = false;
    for (const [k, v] of Object.entries(marques)) {
      const posee = Date.parse(v);
      if (Number.isFinite(posee) && instant - posee > DUREE_MARQUE_HEURE_H_MS) {
        delete marques[k];
        retire = true;
      }
    }
    if (retire) await ecrireParametre(PARAM_MARQUEUR_HEURE_H, marques);
    const entrees = await depots().envoisPlanifies.lister((e) => e.statut === "brouillon" || e.statut === "valide");
    let n = 0;
    for (const e of entrees.sort((a, b) => a.cle.localeCompare(b.cle))) {
      if (!e.heure) continue;
      const t = Date.parse(instantParis(e.jour, e.heure));
      if (!Number.isFinite(t)) continue;
      const reste = t - instant;
      if (reste <= 0 || reste > SEUIL_ALERTE_HEURE_H_MS) continue;
      const cle = cleAlerteHeureH(e, "non-promu");
      if (marques[cle]) continue;
      // Création d'abord, marque ensuite : si la création échoue, rien n'est marqué et l'alerte reviendra.
      await alerterHeureH({ titre: TEXTE_ALERTE_HEURE_H.titre, message: TEXTE_ALERTE_HEURE_H.message(e.jour, e.heure) });
      marques[cle] = new Date(instant).toISOString();
      await ecrireParametre(PARAM_MARQUEUR_HEURE_H, marques);
      n++;
    }
    return n;
  } catch (erreur) {
    console.error("[studio] surveillance heure H en échec", erreur instanceof Error ? erreur.name : "erreur");
    return 0;
  }
}
