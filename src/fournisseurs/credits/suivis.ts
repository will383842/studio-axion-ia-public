/**
 * Soldes SUIVIS par le studio (lot « crédits », 02/10, D2) : fal.ai et Claude. Leur solde ne se lit qu'avec une clé
 * ADMIN, refusée sur le serveur (risque trop élevé) : le studio le calcule au centime près (dernière recharge déclarée
 * moins le coût réel de chaque appel). « Tester la connexion » fait une lecture GRATUITE avec la clé normale.
 *  - fal.ai : `GET https://api.fal.ai/v1/models/pricing?endpoint_id=…` (tarif d'un modèle, aucune fabrication) ;
 *  - Claude : `GET https://api.anthropic.com/v1/models` (liste des modèles, aucun texte produit).
 */
import { SOURCE_API, SOURCES_ABONNEMENT } from "@/domaine/source-claude";
import type { LecteurCredit } from "../types";
import { CLE_ABSENTE, cleDans, lireJson, messageErreur, resultatTest, type Env, type Fetch } from "./commun";

export const VARIABLE_CLE_FAL = "FAL_KEY";
export const VARIABLE_CLE_ANTHROPIC = "ANTHROPIC_API_KEY";

export function creerLecteurFal(env: Env = process.env, appeler: Fetch = fetch): LecteurCredit {
  return {
    fournisseur: "fal",
    nom: "fal.ai",
    mode: "suivi",
    urlRecharge: "https://fal.ai/dashboard/billing",
    variableCle: VARIABLE_CLE_FAL,
    async testerConnexion() {
      const cle = cleDans(env, VARIABLE_CLE_FAL);
      if (!cle) return resultatTest(false, undefined, CLE_ABSENTE);
      try {
        await lireJson(appeler, "https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/nano-banana", { Authorization: `Key ${cle}` }, "fal.ai", cle);
        return resultatTest(true, cle, "Clé acceptée");
      } catch (e) {
        return resultatTest(false, cle, messageErreur(e, "fal.ai"));
      }
    },
  };
}

/**
 * La clé de Claude que le studio montre et teste : la première clé d'abonnement posée (compte 1, 2 puis 3). Si aucune
 * n'est posée, la clé payante, UNIQUEMENT pour afficher sa fin et lire /v1/models (gratuit, sans texte) : elle n'écrit jamais.
 */
export function cleClaudeAffichee(env: Env = process.env): string | undefined {
  for (const s of SOURCES_ABONNEMENT) {
    const cle = cleDans(env, s.variable);
    if (cle) return cle;
  }
  return cleDans(env, SOURCE_API.variable);
}

export function creerLecteurAnthropic(env: Env = process.env, appeler: Fetch = fetch): LecteurCredit {
  return {
    fournisseur: "anthropic",
    nom: "Claude",
    mode: "suivi",
    urlRecharge: "https://platform.claude.com/settings/billing",
    variableCle: VARIABLE_CLE_ANTHROPIC,
    async testerConnexion() {
      const cle = cleClaudeAffichee(env);
      if (!cle) return resultatTest(false, undefined, CLE_ABSENTE);
      try {
        await lireJson(appeler, "https://api.anthropic.com/v1/models?limit=1", { "x-api-key": cle, "anthropic-version": "2023-06-01" }, "Claude", cle);
        const payante = !SOURCES_ABONNEMENT.some((s) => cleDans(env, s.variable)) && cle === cleDans(env, SOURCE_API.variable);
        return resultatTest(true, cle, payante ? "Clé acceptée (API payante, utilisée seulement en mode API)" : "Clé acceptée");
      } catch (e) {
        return resultatTest(false, cle, messageErreur(e, "Claude"));
      }
    },
  };
}
