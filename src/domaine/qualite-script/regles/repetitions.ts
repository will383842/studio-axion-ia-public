/**
 * SOCLE QUALITÉ · RÉPÉTITIONS (RP). PUR. Observation seulement.
 *  RP-01 aucune phrase redite à l'identique, presque identique, ni la même idée sous trop de phrases, et pas de phrases de remplissage seules (≥ 20 %).
 * L'appel final (partie « appel ») est hors du corps : il n'est jamais compté comme redite d'une phrase du corps.
 */
import { trouverRepetitions } from "../repetitions";
import type { Contexte, ResultatRegle } from "../types";
import { resultat } from "./outils";

export function reglesRepetitions(c: Contexte): ResultatRegle[] {
  const corps = c.script.lignes.filter((l) => l.partie !== "appel");
  const appel = c.script.lignes.filter((l) => l.partie === "appel").map((l) => l.dit).join(" ");
  const trouvees = trouverRepetitions(corps.map((l) => l.dit), appel);
  if (!trouvees.length) return [resultat(c, "RP-01", "forme", "alerte", "ok", "Aucune répétition dans le script.")];
  const premiere = trouvees[0];
  const ligne = corps.find((l) => l.dit.includes(premiere.phrase));
  return [resultat(c, "RP-01", "forme", "alerte", "ecart", `${premiere.message}${trouvees.length > 1 ? ` (+ ${trouvees.length - 1} autre${trouvees.length > 2 ? "s" : ""})` : ""}`, ligne ? { ligneId: ligne.id } : {})];
}
