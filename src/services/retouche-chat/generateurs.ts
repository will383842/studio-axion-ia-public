/**
 * CHAT DE RETOUCHE SUR LES GÉNÉRATEURS (lot R3) — branche le socle R1 (comprendre, appliquer, impact, versions) sur
 * Avocat, Image → vidéo et Facecam animée. PUR : aucun accès base ni réseau ; le LLM et le rendu sont des PORTS injectés
 * (doubles dans les tests, `generateurs-studio.ts` pour le studio).
 *  - Un RÉGLAGE par générateur (`retoucheChat.*`), ÉTEINT par défaut : allumé seulement par la valeur `true`.
 *  - Un ADAPTATEUR par générateur : ce qui est retouchable (texte à l'écran, pièces, zooms, transitions), consigne
 *    ajoutée à celle de R1, liste des retouches permises. La voix n'est JAMAIS touchée sans demande explicite.
 *  - RENDU PARTIEL par empreinte de scène : seules les scènes à l'empreinte changée sont re-rendues, les autres reprennent
 *    le rendu de la version d'avant, puis le tout est assemblé.
 * Modèle de compréhension : Opus 5.5 (`MODELE_RETOUCHE_CHAT`, fixé par R1). Aucun prix, aucun refus : des remarques.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { demandeExpliciteScript } from "./comprendre";
import type { EntreeRenduPartiel, PortsRetoucheChat, SortieRenduPartiel } from "./service";

export const GENERATEURS_RETOUCHE = ["avocat", "image-video", "facecam-animee"] as const;
export type IdGenerateurRetouche = (typeof GENERATEURS_RETOUCHE)[number];

export const CLES_REGLAGE_RETOUCHE: Record<IdGenerateurRetouche, string> = {
  avocat: "retoucheChat.avocat",
  "image-video": "retoucheChat.imageVideo",
  "facecam-animee": "retoucheChat.facecamAnimee",
};

export const estGenerateurRetouche = (g: unknown): g is IdGenerateurRetouche => (GENERATEURS_RETOUCHE as readonly unknown[]).includes(g);

export type LireReglage = (id: string, defaut: unknown) => Promise<unknown>;

/** Allumé seulement par `true` exactement ; toute autre valeur, une absence ou une lecture en échec = éteint. */
export async function retoucheChatActif(generateur: IdGenerateurRetouche, lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLES_REGLAGE_RETOUCHE[generateur], false)) === true;
  } catch {
    return false;
  }
}

type TypeOperation = OperationRetouche["type"];

export interface AdaptateurRetouche {
  id: IdGenerateurRetouche;
  nom: string;
  /** Retouches permises (jamais `modifier-script` ici : il dépend de la demande, voir `filtrerOperationsGenerateur`). */
  operations: readonly TypeOperation[];
  /** Ajoutée à la consigne de R1 : ce qui est retouchable pour ce générateur. */
  consigne: string;
}

const COMMUNES: readonly TypeOperation[] = ["changer-mot", "ajouter-chiffre", "changer-brique", "decaler-scene", "changer-habillage", "ajouter-piece", "retirer-piece", "remplacer-piece", "changer-transition", "ajouter-dynamisme", "ajuster-zoom"];

const REGLE_VOIX = "La voix et le texte lu ne changent jamais, sauf demande explicite de modifier le script.";

export const ADAPTATEURS_RETOUCHE: Record<IdGenerateurRetouche, AdaptateurRetouche> = {
  avocat: {
    id: "avocat",
    nom: "Avocat",
    operations: COMMUNES,
    consigne: `Vidéo « Avocat » (personne face caméra, sous-titres et pièces par-dessus). Retouchable : texte à l'écran, pièces (chiffres, légendes), zooms, transitions, dynamisme. Rien devant le visage ; les sous-titres et les plans de caméra ne se touchent pas. ${REGLE_VOIX}`,
  },
  "image-video": {
    id: "image-video",
    nom: "Image → vidéo",
    operations: COMMUNES,
    consigne: `Vidéo « Image → vidéo » (images animées, pas de visage). Retouchable : texte à l'écran, pièces posées sur les images, zooms et mouvements, transitions entre images, dynamisme. Les images elles-mêmes ne sont pas refaites par cette retouche. ${REGLE_VOIX}`,
  },
  "facecam-animee": {
    id: "facecam-animee",
    nom: "Facecam animée",
    operations: COMMUNES,
    consigne: `Vidéo « Facecam animée » (prise de Williams, plaquettes animées autour). Retouchable : texte des plaquettes, pièces (chiffres, interface), zooms, transitions, dynamisme. La prise, les coupes et le son ne se touchent pas. ${REGLE_VOIX}`,
  },
};

export const adaptateurRetouche = (g: IdGenerateurRetouche): AdaptateurRetouche => ADAPTATEURS_RETOUCHE[g];

/** Fournisseur du générateur : la consigne propre au générateur est ajoutée APRÈS celle de R1 (modèle inchangé : Opus 5.5). */
export function appelPourGenerateur(generateur: IdGenerateurRetouche, appeler: AppelClaude): AppelClaude {
  const { consigne } = adaptateurRetouche(generateur);
  return (requete) => appeler({ ...requete, systeme: [...requete.systeme, { texte: consigne }] });
}

/**
 * Garde propre au générateur, appliquée à l'aperçu ET à l'application (les opérations reviennent du navigateur) :
 * seules les retouches de la liste passent ; `modifier-script` (la voix) seulement si la phrase demande explicitement de
 * modifier le script.
 */
export function filtrerOperationsGenerateur(generateur: IdGenerateurRetouche, operations: readonly OperationRetouche[], demande: string): { operations: OperationRetouche[]; remarques: string[] } {
  const permises = new Set<TypeOperation>(adaptateurRetouche(generateur).operations);
  const explicite = demandeExpliciteScript(demande);
  const remarques: string[] = [];
  const gardees = operations.filter((o) => {
    if (o.type === "modifier-script") {
      if (!explicite) remarques.push("Le texte lu reste le vôtre : pour le changer, demandez « modifie le script ».");
      return explicite;
    }
    if (!permises.has(o.type)) {
      remarques.push(`Cette retouche (« ${o.type} ») n'existe pas pour ${adaptateurRetouche(generateur).nom}.`);
      return false;
    }
    return true;
  });
  return { operations: gardees, remarques: [...new Set(remarques)] };
}

export interface RenduPartielGenerateur {
  /** Rend UNE scène du plan retouché ; renvoie la clé de son fichier. */
  rendreScene: (plan: PlanValide, sceneId: string) => Promise<{ cle: string }>;
  /** Assemble la vidéo : clé de rendu de chaque scène (neuve ou reprise) → fichier final. */
  assembler: (plan: PlanValide, cles: Record<string, string>, voix: boolean) => Promise<SortieRenduPartiel>;
  /** Clés de rendu par scène de la version d'avant (scène sans clé : re-rendue). */
  rendusPrecedents: (videoId: string, versionId: string) => Promise<Record<string, string>>;
}

/** Rendu partiel par empreinte de scène. Sans `rendreScene` : rien n'est branché (le plan retouché reste « prêt »). */
export function fabriquerRenduPartiel(d: Partial<RenduPartielGenerateur>): PortsRetoucheChat["rendreScenes"] | undefined {
  const { rendreScene, assembler, rendusPrecedents } = d;
  if (!rendreScene || !assembler || !rendusPrecedents) return undefined;
  return async (e: EntreeRenduPartiel) => {
    const avant = await rendusPrecedents(e.videoId, e.parentVersionId);
    const aRefaire = new Set(e.scenes);
    const cles: Record<string, string> = {};
    for (const s of e.plan.scenes) {
      const repris = avant[s.id];
      cles[s.id] = !aRefaire.has(s.id) && repris ? repris : (await rendreScene(e.plan, s.id)).cle;
    }
    return assembler(e.plan, cles, e.voix);
  };
}

/** Ports d'un générateur : ports de base (LLM, versions) + consigne, garde et rendu partiel propres au générateur. */
export function portsGenerateur(generateur: IdGenerateurRetouche, base: PortsRetoucheChat, rendu: Partial<RenduPartielGenerateur> = {}): PortsRetoucheChat {
  const rendreScenes = fabriquerRenduPartiel(rendu);
  const { rendreScenes: _ancien, ...reste } = base;
  void _ancien;
  return {
    ...reste,
    appeler: appelPourGenerateur(generateur, base.appeler),
    filtrerOperations: (operations, demande) => filtrerOperationsGenerateur(generateur, operations, demande),
    ...(rendreScenes ? { rendreScenes } : {}),
  };
}
