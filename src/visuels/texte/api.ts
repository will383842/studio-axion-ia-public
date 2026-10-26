import { PAGES, TYPES_PAGE } from "../../briques/visuels/registre-pages";
import { consigneTrame, type Intention } from "../../briques/visuels/trames";
import type { DemandeTexteCarrousel, EmpreinteCarrousel, FournisseurTexteCarrousel, ReponseTexteCarrousel } from "../../domaine/visuels/contrats";
import { lirePaquetSession } from "./session";
import { ErreurTexteCarrousel, exigerApiDeverrouillee } from "./verrou-api";

export interface DependancesApi {
  appeler: (consigne: string, entree: string) => Promise<string>;
}

/** Consigne de mécanisme : format du paquet et budgets des types de pages, rien d'autre. */
export const CONSIGNE_API = [
  "Répondre uniquement par un objet JSON de version paquet-session-carrousel/1 avec les clés sujet, titre, pourquoi et spec.",
  "La spec a la version carrousel/1, un champ alt et une liste de pages.",
  `Types de pages admis et longueur maximale du titre : ${TYPES_PAGE.filter((t) => PAGES[t].titreMax > 0).map((t) => `${t} (${PAGES[t].titreMax})`).join(", ")}.`,
  "La première page est une couverture, la dernière est T21, sans aucun champ.",
].join("\n");

/** Consigne de l'API, suivie du plan et des consignes d'écriture de la trame quand le carrousel a une intention (L12). */
export function consigneApi(intention?: Intention, eviter: readonly EmpreinteCarrousel[] = []): string {
  const base = intention ? `${CONSIGNE_API}\n${consigneTrame(intention)}` : CONSIGNE_API;
  const suites = [...new Set(eviter.map((e) => e.suite))].slice(0, 3);
  // Anti-répétition (L7) dite au rédacteur AVANT l'écriture : les 3 dernières suites de pages et leurs couvertures ne sont pas reprises.
  if (!suites.length) return base;
  const couvertures = [...new Set(eviter.slice(0, 3).map((e) => e.couverture.split(":")[0]).filter(Boolean))];
  return `${base}\nVariété : ne pas reprendre la suite de pages d'un des derniers carrousels (${suites.join(" | ")})${couvertures.length ? ` ni leur modèle de couverture (${couvertures.join(", ")}) quand un autre convient` : ""}.`;
}

/** Fournisseur « api » : verrouillé. La première instruction d'`ecrire` refuse tant que le verrou n'est pas levé par Will. */
export function creerFournisseurApi(deps: DependancesApi): FournisseurTexteCarrousel {
  return {
    mode: "api",
    async ecrire(demande: DemandeTexteCarrousel): Promise<ReponseTexteCarrousel> {
      exigerApiDeverrouillee();
      if (demande.type !== "sujet") throw new ErreurTexteCarrousel("SUJET_INVALIDE", "Le fournisseur API attend un sujet.");
      const sortie = await deps.appeler(consigneApi(demande.intention, demande.eviter), demande.sujet);
      return { ...lirePaquetSession(sortie), mode: "api" };
    },
  };
}
