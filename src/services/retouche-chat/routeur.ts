/**
 * S-14-a : routeur PUR du chat unique. Pour une vidéo (son format), dit où va la demande de Williams : plan de scènes (un des
 * générateurs inscrits), tableau animé, cas concret, « Mon monteur », film du tutoriel, démo face caméra, ou « pas de chat pour ce
 * format » avec une phrase simple. ÉTEINT : aucun importeur ; la clé `retoucheChat.porteUnique` ne s'allume que par `true` exact.
 * Aucun accès base ni réseau : la lecture du réglage est INJECTÉE (aucun `lireParametre(` ici). Jamais de montant dans une phrase.
 */
import { CLE_REGLAGE_DEMO_FACECAM, estGenerateurRetouche, type IdGenerateurRetouche, type LireReglage } from "./generateurs";

export const CLE_REGLAGE_PORTE_UNIQUE = "retoucheChat.porteUnique";
export const PHRASE_SANS_CHAT = "Pour ce type de vidéo, la retouche par message n'est pas encore possible. Vous pouvez la refaire depuis sa création.";

export type RouteChat =
  | { porte: "plan-scenes"; generateur: IdGenerateurRetouche }
  | { porte: "film-tutoriel"; generateur: "tutoriel-outil" }
  | { porte: "tableau" }
  | { porte: "cas-concret" }
  | { porte: "monteur" }
  | { porte: "demo"; generateur: "demo-facecam"; cle: typeof CLE_REGLAGE_DEMO_FACECAM }
  | { porte: "aucune"; phrase: string };

/** Table FERMÉE par format. Un format absent n'a pas de chat (jamais de devinette). */
const PORTES_PAR_FORMAT: Readonly<Record<string, RouteChat>> = {
  avocat: { porte: "plan-scenes", generateur: "avocat" },
  "image-video": { porte: "plan-scenes", generateur: "image-video" },
  "facecam-animee": { porte: "plan-scenes", generateur: "facecam-animee" },
  "video-longue": { porte: "plan-scenes", generateur: "video-longue" },
  "tutoriel-outil": { porte: "film-tutoriel", generateur: "tutoriel-outil" },
  "tableau-anime": { porte: "tableau" },
  "cas-concret": { porte: "cas-concret" },
  facecam: { porte: "monteur" },
  "demo-facecam": { porte: "demo", generateur: "demo-facecam", cle: CLE_REGLAGE_DEMO_FACECAM },
};

/** La porte d'un format (table seule, sans lire de réglage). */
export function routeDuFormat(formatId: string): RouteChat {
  const route = Object.hasOwn(PORTES_PAR_FORMAT, formatId) ? PORTES_PAR_FORMAT[formatId] : undefined;
  if (route) {
    if (route.porte === "plan-scenes" && !estGenerateurRetouche(route.generateur)) return { porte: "aucune", phrase: PHRASE_SANS_CHAT };
    return route;
  }
  return { porte: "aucune", phrase: PHRASE_SANS_CHAT };
}

/** Allumé seulement par `true` exactement ; absent, `"true"`, `1` ou lecture en échec = éteint. */
export async function porteUniqueActive(lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLE_REGLAGE_PORTE_UNIQUE, false)) === true;
  } catch {
    return false;
  }
}

export type ChoixPorte = { mode: "portes-actuelles" } | { mode: "porte-unique"; route: RouteChat };

/** Éteint : « portes d'aujourd'hui » (rien ne change). Allumé : la porte du format. */
export async function choisirPorte(formatId: string, lire: LireReglage): Promise<ChoixPorte> {
  if (!(await porteUniqueActive(lire))) return { mode: "portes-actuelles" };
  return { mode: "porte-unique", route: routeDuFormat(formatId) };
}
