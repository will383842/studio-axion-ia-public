/**
 * GUIDES PDF (lot G5) · client signé vers la route du site qui fabrique le PDF : POST /api/interne/guides-reseau/contenu.
 * Même signature HMAC et même secret que les autres routes signées du Studio vers le site (`signerAppel`, secret
 * SITE_GUIDES_RESEAU_SECRET, adresse SITE_VIDEOS_URL) : aucune nouvelle variable. Le `fetch` est injectable (faux fetch des essais).
 * La route peut ne pas être en ligne : 404, 503, coupure ou délai deviennent une phrase claire, jamais une panne ; l'appelant
 * n'enregistre « fabriqué » que sur un 201. Ni le secret, ni une signature, ni le texte du guide ne sont journalisés.
 */
import "server-only";
import { CHEMIN_GUIDES_CONTENU, PHRASES_FABRICATION, lireReponseSite, type CorpsContenuGuide, type IssueSite } from "@/domaine/guides-pdf/guide-fabrique";
import { creerTransportHttp } from "@/fournisseurs/site/http";
import { signerAppel } from "@/fournisseurs/site/signature";
import { SECRET_SITE_LONGUEUR_MIN, VARIABLE_SECRET_SITE_GUIDES } from "./parcours-mot";

/** Le rendu d'un PDF est plus long qu'une simple lecture : 60 s au plus. */
export const DELAI_FABRICATION_MS = 60_000;

export type ResultatEnvoiContenu = IssueSite | { issue: "non_relie" | "incertain"; phrase: string };

export async function envoyerContenuGuide(o: {
  corps: CorpsContenuGuide;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  maintenantMs?: number;
}): Promise<ResultatEnvoiContenu> {
  const env = o.env ?? process.env;
  const secret = env[VARIABLE_SECRET_SITE_GUIDES]?.trim();
  const url = env.SITE_VIDEOS_URL?.trim();
  if (!secret || secret.length < SECRET_SITE_LONGUEUR_MIN || !url || !/^https?:\/\//i.test(url)) return { issue: "non_relie", phrase: PHRASES_FABRICATION.non_relie };
  const corps = JSON.stringify(o.corps);
  const entetes = signerAppel({ secret, methode: "POST", chemin: CHEMIN_GUIDES_CONTENU, corps, horodatageSec: Math.floor((o.maintenantMs ?? Date.now()) / 1000) });
  const transport = creerTransportHttp({ url, fetch: o.fetch ?? ((...a) => fetch(...a)), delaiMs: DELAI_FABRICATION_MS });
  try {
    const r = await transport({ methode: "POST", chemin: CHEMIN_GUIDES_CONTENU, corps, entetes });
    return lireReponseSite(r.statut, r.corps);
  } catch {
    // Appel parti, réponse non arrivée (coupure, délai, redirection refusée) : le site a pu fabriquer ; rien n'est noté.
    return { issue: "incertain", phrase: PHRASES_FABRICATION.incertain };
  }
}
