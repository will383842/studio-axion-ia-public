/**
 * Alerte interne « refus d'envoi réglable » : quand des messages privés sont refusés pour une raison que le fondateur peut corriger
 * par un réglage, UNE notification (cloche du Studio seulement : ni téléphone, ni e-mail) par raison et par compte, avec la marche à suivre.
 * Lecture seule de `parcours.conversations` ; seul paramètre écrit : `parcours.alertes_refus` (sujet -> date ISO de la dernière alerte).
 * Aucun changement d'envoi, aucun disjoncteur, aucune pause. Au plus une exécution toutes les 10 minutes ; une erreur ne casse jamais le tour.
 */
import "server-only";
import { alertesRefus, type RefusVu } from "@/domaine/guide-reseau/alertes-refus";
import { racineDe } from "@/domaine/guide-reseau/cles-parcours";
import { lireRaisonStockee } from "@/domaine/guide-reseau/raison-refus-lue";
import { lireParametre, ecrireParametre, sousVerrou } from "./_commun";
import { creerNotification } from "./notifications";

/** Même noms que dans `parcours-conversation.ts` (non importé : ce module n'en tire pas le parcours). */
const PARAM_CONVERSATIONS = "parcours.conversations";
export const PARAM_ALERTES_REFUS = "parcours.alertes_refus";
export const INTERVALLE_REFUS_ENVOI_MS = 10 * 60_000;
/** Mêmes états que le compteur des refus de `stats-mots`. */
const ETATS_REFUSES: readonly string[] = ["m1_refuse", "site_refuse"];

const cleMemoire = Symbol.for("studio-axion-ia.alertes-refus-envoi");
type AvecMemoire = typeof globalThis & { [cleMemoire]?: number };
/** Tests : oublie la dernière exécution. */
export function reinitialiserSurveillanceRefusEnvoi(): void {
  delete (globalThis as AvecMemoire)[cleMemoire];
}

type Brut = Record<string, Record<string, unknown>>;

function lireRefus(tout: Brut): { refus: RefusVu[]; comptes: { idCompte: string; reseau: string }[] } {
  const refus: RefusVu[] = [];
  const comptes = new Map<string, { idCompte: string; reseau: string }>();
  for (const [cle, c] of Object.entries(tout)) {
    if (c === null || typeof c !== "object") continue;
    const { idCompte, reseau } = c;
    if (typeof idCompte !== "string" || idCompte === "" || (reseau !== "facebook" && reseau !== "instagram")) continue;
    comptes.set(`${reseau}/${idCompte}`, { idCompte, reseau });
    if (typeof c.etat !== "string" || !ETATS_REFUSES.includes(c.etat)) continue;
    const raison = lireRaisonStockee(c.refusPrive);
    if (raison) refus.push({ racine: racineDe(cle), idCompte, reseau, raison });
  }
  return { refus, comptes: [...comptes.values()].sort((a, b) => (a.idCompte < b.idCompte ? -1 : a.idCompte > b.idCompte ? 1 : 0)) };
}

/** Retourne le nombre d'alertes créées. Trop tôt ou en erreur : 0. */
export async function surveillerRefusEnvoi(o: { maintenantMs?: number } = {}): Promise<number> {
  const maintenant = o.maintenantMs ?? Date.now();
  const g = globalThis as AvecMemoire;
  const derniere = g[cleMemoire];
  if (derniere !== undefined && maintenant >= derniere && maintenant - derniere < INTERVALLE_REFUS_ENVOI_MS) return 0;
  g[cleMemoire] = maintenant;
  try {
    return await sousVerrou(async () => {
      const { refus, comptes } = lireRefus(await lireParametre<Brut>(PARAM_CONVERSATIONS, {}));
      if (refus.length === 0) return 0;
      const marques = { ...(await lireParametre<Record<string, string>>(PARAM_ALERTES_REFUS, {})) };
      const alertes = alertesRefus({ refus, dejaAlertees: marques, comptesTries: comptes, maintenantMs: maintenant });
      let creees = 0;
      for (const a of alertes) {
        await creerNotification({ type: "echec", titre: "Parcours des messages privés", message: a.message, lien: "/mots" }, { cloche: true });
        marques[a.sujet] = new Date(maintenant).toISOString();
        await ecrireParametre(PARAM_ALERTES_REFUS, marques);
        creees++;
      }
      return creees;
    });
  } catch {
    console.error("Alerte des refus d'envoi : la surveillance a échoué, nouvel essai au prochain passage.");
    return 0;
  }
}
