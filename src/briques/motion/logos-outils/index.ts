/**
 * LOGOS D'OUTILS (C8-L04) — côté Studio seulement : jamais importé par le rendu. Ajout pur, rien de branché.
 * `logoUtilisable` est pure : elle dit si un logo peut être dessiné ; sinon repli en texte seul.
 */
import { droitValide, trouverDroit } from "../../droits/lecture";
import { controlerEntreeLogo } from "./manifeste";
import type { EntreeLogoOutil } from "./manifeste";

export { MANIFESTE_LOGOS, MENTION_MARQUES } from "./manifeste";

export type ResultatLogoUtilisable = { ok: true } | { ok: false; raison: string };

const refus = (raison: string): ResultatLogoUtilisable => ({ ok: false, raison });

export function logoUtilisable(entree: EntreeLogoOutil, aujourdHui: Date | string = new Date()): ResultatLogoUtilisable {
  if (entree === null || typeof entree !== "object") return refus("entrée absente");
  if (entree.statut !== "valide") return refus(`statut « ${String(entree.statut)} » : repli en texte seul`);
  if (!entree.validePar || !entree.dateValidation) return refus("validePar ou dateValidation absent");
  const fautes = controlerEntreeLogo(entree);
  if (fautes.length > 0) return refus(`entrée non conforme : ${fautes.join(", ")}`);
  if (!entree.droitId) return refus("droit absent : droitId manquant");
  const droit = trouverDroit(entree.droitId);
  if (!droit) return refus(`droit absent : « ${entree.droitId} » inconnu du registre`);
  if (droit.type !== "logo-outil") return refus(`type de droit « ${droit.type} » autre que logo-outil`);
  if (!droitValide(entree.droitId, aujourdHui)) return refus("droit périmé");
  return { ok: true };
}
