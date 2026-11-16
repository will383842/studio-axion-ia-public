/**
 * Archive des vidéos livrées (C3-UT-3.4) : licence la plus restrictive d'un ensemble de licences. Pur : aucun service,
 * aucune date implicite. L'état (ok / expirée / à vérifier) se lit ensuite avec `etatLicence` (`@/domaine/derivations`).
 */
import type { IdReseau, Licence, TypeLicence } from "@/domaine/types";

/** Du moins contraignant au plus contraignant (hors `a-verifier`, qui l'emporte toujours). */
const RANG: TypeLicence[] = ["propriete", "generee-ia", "achat", "abonnement", "libre"];

export function licencePlusRestrictive(licences: Licence[]): Licence {
  let type: TypeLicence = "propriete";
  let usageCommercial = true;
  let reseaux: IdReseau[] = [];
  let reseauxLimites = false;
  let intersectionVide = false;
  let expireLe: string | undefined;
  const credits: string[] = [];

  for (const l of licences) {
    if (type !== "a-verifier") {
      if (l.type === "a-verifier") type = "a-verifier";
      else if (RANG.indexOf(l.type) > RANG.indexOf(type)) type = l.type;
    }
    usageCommercial = usageCommercial && l.usageCommercial;
    if (l.reseaux.length > 0) {
      if (!reseauxLimites) {
        reseaux = [...new Set(l.reseaux)];
        reseauxLimites = true;
      } else {
        reseaux = reseaux.filter((r) => l.reseaux.includes(r));
      }
      if (reseaux.length === 0) intersectionVide = true;
    }
    if (l.expireLe && (!expireLe || new Date(l.expireLe) < new Date(expireLe))) expireLe = l.expireLe;
    if (l.creditObligatoire && !credits.includes(l.creditObligatoire)) credits.push(l.creditObligatoire);
  }

  // Intersection vide de listes non vides : jamais « tous » (liste vide) par erreur, on bloque en `a-verifier`.
  if (intersectionVide) type = "a-verifier";

  return {
    type,
    usageCommercial,
    reseaux,
    ...(credits.length > 0 ? { creditObligatoire: credits.join(" · ") } : {}),
    ...(expireLe ? { expireLe } : {}),
  };
}
