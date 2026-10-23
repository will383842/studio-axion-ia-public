/**
 * REGISTRE DES FOURNISSEURS (PLAN B.6.5, AV2.2-7).
 *
 * resoudreFournisseur(type) :
 *   1. réglage en base « fournisseur.<type> » (passé par le service via `lireParametre`),
 *   2. sinon variable d'environnement FOURNISSEUR_<TYPE> (ex. FOURNISSEUR_VOIX=elevenlabs),
 *   3. sinon la simulation.
 * Un choix « réel » non disponible (implémentation absente ou variables manquantes)
 * retombe sur la simulation et Réglages > Connexions affiche « À relier ».
 */
import { fournisseurScriptSimulation } from "./simulation/script";
import {
  fournisseurEtalonnageSimulation,
  fournisseurIllustrationSimulation,
  fournisseurMiniatureSimulation,
  fournisseurMontageSimulation,
  fournisseurNotificationSimulation,
  fournisseurPublicationSimulation,
  fournisseurSonSimulation,
  fournisseurTexteReseauxSimulation,
  fournisseurVisageSimulation,
  fournisseurVoixSimulation,
  stockageSimulation,
} from "./simulation/autres";
import { stockageR2DepuisEnv } from "./r2/stockage";
import { visagesHeygen, voixHeygen } from "./heygen/inscription";
import { illustrationsReelles } from "./illustration/inscription";
import { aligneurReel } from "./aligneur/inscription";
import { notificationsReelles } from "./notification/inscription";
import { publicationBuffer } from "./publication/inscription";
// Lot G0 (générateur) : Claude, inscrit seulement si ANTHROPIC_API_KEY existe ; actif par FOURNISSEUR_SCRIPT=claude.
import { scriptClaude, texteReseauxClaude } from "./claude/inscription";
import { fournisseurAlignementSimulation } from "./simulation/alignement";
// Vidéos sur le site (lot S3) : le site factice seul ; le vrai client (lot S4) s'y ajoutera, jamais choisi par défaut.
import { fournisseurSiteSimulation } from "./site/simulation";
import { siteHttpDepuisEnv } from "./site/http";
import { fournisseurMontageRemotionLambda, fournisseurMontageStudioRendu, remotionLambdaConfigure, studioRenduRelie } from "./rendu/montage";
// Lots R4-R5 : outils gratuits du serveur (studio-rendu), inscrits par `rendu/inscription.ts`, jamais ici.
import { outilsServeur } from "./rendu/inscription";
import type { CarteFournisseurs, EtatConnexion, FournisseurBase, ModeFournisseur, TypeFournisseur } from "./types";
import { CATALOGUE, implementationPrevue, reglagesManquants } from "./catalogue";

export type * from "./types";

type Implementations = { [K in TypeFournisseur]: Record<string, CarteFournisseurs[K]> };

/** Implémentations disponibles par type. Un vrai fournisseur s'ajoute ici, rien d'autre ne change. */
const IMPLEMENTATIONS: Implementations = {
  // Lot G0 : `claude` (anciennes méthodes déléguées à la simulation, seul `executerRole` appelle Claude, après le pré-vol).
  script: { simulation: fournisseurScriptSimulation, ...scriptClaude() },
  // Lots A1 (voix HeyGen, M0b) et B1 (Looks HeyGen) : inscrits par `heygen/inscription.ts`, jamais ici.
  visage: { simulation: fournisseurVisageSimulation, ...visagesHeygen() },
  voix: { simulation: fournisseurVoixSimulation, ...voixHeygen() },
  // studio-rendu (lot M4) : inscrit seulement si STUDIO_RENDU_URL existe ; s'active par FOURNISSEUR_MONTAGE=studio-rendu.
  // remotion-lambda (lot M4b) : écrit, ÉTEINT ; inscrit seulement si studio-rendu est relié ET Lambda configuré.
  montage: {
    simulation: fournisseurMontageSimulation,
    ...(studioRenduRelie() ? { "studio-rendu": fournisseurMontageStudioRendu } : {}),
    ...(studioRenduRelie() && remotionLambdaConfigure() ? { "remotion-lambda": fournisseurMontageRemotionLambda } : {}),
  },
  // Lot A2 (M5) : banques et fabrication réelles, inscrites par `illustration/inscription.ts`.
  illustration: { simulation: fournisseurIllustrationSimulation, ...illustrationsReelles() },
  etalonnage: { simulation: fournisseurEtalonnageSimulation, ...outilsServeur().etalonnage },
  son: { simulation: fournisseurSonSimulation, ...outilsServeur().son },
  miniature: { simulation: fournisseurMiniatureSimulation, ...outilsServeur().miniature },
  publication: { simulation: fournisseurPublicationSimulation, ...publicationBuffer() },
  "texte-reseaux": { simulation: fournisseurTexteReseauxSimulation, ...texteReseauxClaude() },
  notification: { simulation: fournisseurNotificationSimulation, ...notificationsReelles() },
  // R2 (lot M1b) : inscrit seulement si ses variables existent (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).
  // Il s'active ensuite par FOURNISSEUR_STOCKAGE=r2 (ou le réglage « fournisseur.stockage ») ; sinon la simulation reste.
  stockage: { simulation: stockageSimulation, ...avecR2() },
  // Lot « calage » (02/10, D3) : WhisperX dans `studio-aligneur`, inscrit par `aligneur/inscription.ts`, jamais ici.
  alignement: { simulation: fournisseurAlignementSimulation, ...aligneurReel() },
  // Le client réel (« http ») n'est inscrit qu'avec ses deux variables ; la simulation reste le choix par défaut.
  site: { simulation: fournisseurSiteSimulation, ...siteHttpDepuisEnv() },
};

function avecR2(): Record<string, CarteFournisseurs["stockage"]> {
  const r2 = stockageR2DepuisEnv();
  return r2 ? { r2 } : {};
}

export const TYPES_FOURNISSEURS = Object.keys(IMPLEMENTATIONS) as TypeFournisseur[];

function cleEnv(type: TypeFournisseur): string {
  return `FOURNISSEUR_${type.replace(/-/g, "_").toUpperCase()}`;
}

export interface ChoixFournisseur {
  demande: string; // ce qui est demandé (base ou env), « simulation » par défaut
  source: "base" | "environnement" | "defaut";
}

export function choixFournisseur(type: TypeFournisseur, valeurEnBase?: string | null): ChoixFournisseur {
  if (valeurEnBase) return { demande: valeurEnBase, source: "base" };
  const env = process.env[cleEnv(type)];
  if (env) return { demande: env, source: "environnement" };
  return { demande: "simulation", source: "defaut" };
}

export function resoudreFournisseur<K extends TypeFournisseur>(type: K, valeurEnBase?: string | null): CarteFournisseurs[K] {
  const { demande } = choixFournisseur(type, valeurEnBase);
  const impl = IMPLEMENTATIONS[type] as Record<string, CarteFournisseurs[K]>;
  // `Object.hasOwn`, jamais les crochets seuls : « constructor » (en base ou dans FOURNISSEUR_*) n'est pas un service.
  return Object.hasOwn(impl, demande) ? impl[demande] : impl.simulation;
}

export function etatConnexion(type: TypeFournisseur, valeurEnBase?: string | null): EtatConnexion {
  const { demande } = choixFournisseur(type, valeurEnBase);
  if (demande === "simulation") return "simulation";
  return Object.hasOwn(IMPLEMENTATIONS[type], demande) ? "relie" : "a-relier";
}

/** Le fournisseur résolu est-il une simulation ? (pastille « Essai », AV2.4-4) */
export function estSimule(type: TypeFournisseur, valeurEnBase?: string | null): boolean {
  return resoudreFournisseur(type, valeurEnBase).mode === "simulation";
}

/* ------------------------------------------------------------------ */
/* Lot R0 : les vrais choix de Réglages > Connexions (constats C1, C2)  */
/* ------------------------------------------------------------------ */

/** Un choix proposé pour un type : la simulation, puis chaque service réel prévu ou inscrit. Jamais de valeur de clé. */
export interface OptionConnexion {
  /** Identifiant EXACT, celui qu'enregistre le réglage « fournisseur.<type> ». */
  id: string;
  nom: string;
  mode: ModeFournisseur;
  /** Présent au registre (code livré ET réglages du serveur présents) : seul un choix inscrit fonctionne vraiment. */
  inscrit: boolean;
  /** Réglages du serveur complets. Prêt mais pas inscrit : le code n'est pas encore livré dans cette version. */
  pret: boolean;
  /** NOMS des réglages qui manquent sur le serveur (jamais leur valeur ; jamais affichés à l'écran, phrase simple). */
  manque: string[];
  /** Coût à l'usage, en mots simples. */
  cout: string;
  /** C'est le choix en vigueur (réglage en base, sinon variable FOURNISSEUR_<TYPE>, sinon la simulation). */
  choisi: boolean;
}

/**
 * Choix proposés pour un type (Réglages > Connexions) : la simulation, les implémentations du catalogue (inscrites ou
 * non), puis toute implémentation inscrite que le catalogue ne connaîtrait pas encore. Lit seulement la PRÉSENCE des
 * réglages du serveur.
 */
export function optionsConnexion(type: TypeFournisseur, valeurEnBase?: string | null, env: Record<string, string | undefined> = process.env): OptionConnexion[] {
  const { demande } = choixFournisseur(type, valeurEnBase);
  const inscrites = IMPLEMENTATIONS[type] as Record<string, FournisseurBase>;
  const options: OptionConnexion[] = [{ id: "simulation", nom: "Essai", mode: "simulation", inscrit: true, pret: true, manque: [], cout: "Aucun envoi, aucun coût", choisi: demande === "simulation" }];
  for (const prevue of CATALOGUE[type]) {
    const inscrit = Object.hasOwn(inscrites, prevue.id);
    const manque = inscrit ? [] : reglagesManquants(prevue, env);
    options.push({ id: prevue.id, nom: prevue.nom, mode: "reel", inscrit, pret: manque.length === 0, manque, cout: prevue.cout, choisi: demande === prevue.id });
  }
  for (const [id, f] of Object.entries(inscrites)) {
    if (options.some((o) => o.id === id)) continue;
    options.push({ id, nom: f.nom, mode: f.mode, inscrit: true, pret: true, manque: [], cout: "", choisi: demande === id });
  }
  return options;
}

/** L'identifiant fait-il partie des choix possibles pour ce type (simulation, catalogue ou registre) ? */
export function choixConnu(type: TypeFournisseur, id: string): boolean {
  // `Object.hasOwn`, jamais `in` : « constructor » ou « toString » passeraient sinon pour des services.
  return id === "simulation" || !!implementationPrevue(type, id) || Object.hasOwn(IMPLEMENTATIONS[type], id);
}
