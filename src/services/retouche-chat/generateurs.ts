/**
 * CHAT DE RETOUCHE SUR LES GÉNÉRATEURS (lot R3) — branche le socle R1 (comprendre, appliquer, impact, versions) sur
 * Avocat, Image → vidéo et Facecam animée. PUR : aucun accès base ni réseau ; le LLM et le rendu sont des PORTS injectés
 * (doubles dans les tests, `generateurs-studio.ts` pour le studio).
 *  - Un RÉGLAGE par générateur (`retoucheChat.*`), ÉTEINT par défaut : allumé seulement par la valeur `true` (sauf la démo face caméra, ALLUMÉE par défaut : `false` écrit l'éteint).
 *  - Un ADAPTATEUR par générateur : ce qui est retouchable (texte à l'écran, pièces, zooms, transitions), consigne
 *    ajoutée à celle de R1, liste des retouches permises. La voix n'est JAMAIS touchée sans demande explicite.
 *  - RENDU PARTIEL par empreinte de scène : seules les scènes à l'empreinte changée sont re-rendues, les autres reprennent
 *    le rendu de la version d'avant, puis le tout est assemblé.
 * Modèle de compréhension : Opus 5.5 (`MODELE_RETOUCHE_CHAT`, fixé par R1). Aucun prix, aucun refus : des remarques.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { CATALOGUE_BRIQUES, estPiece } from "@/briques/plan-scenes/catalogue";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { demandeExpliciteScript } from "./comprendre";
import type { EntreeRenduPartiel, PortsRetoucheChat, SortieRenduPartiel } from "./service";

export const GENERATEURS_RETOUCHE = ["avocat", "image-video", "facecam-animee", "tutoriel-outil", "video-longue", "demo-facecam"] as const;
export type IdGenerateurRetouche = (typeof GENERATEURS_RETOUCHE)[number];

/** Clé du réglage de la démo facecam : inscrite par N-26-a, ALLUMÉE par défaut (ALLUMER-RETOUCHE-DEMO, décision Q3 du 20/11 19:45 : retouche à 0 € seulement) ; `false` écrit au panneau l'éteint. */
export const CLE_REGLAGE_DEMO_FACECAM = "retoucheChat.demoFacecam";

/** Seuls générateurs dont le chat est allumé quand le réglage est absent. */
export const RETOUCHE_ALLUMEE_PAR_DEFAUT: readonly IdGenerateurRetouche[] = ["demo-facecam"];

export const CLES_REGLAGE_RETOUCHE: Record<IdGenerateurRetouche, string> = {
  avocat: "retoucheChat.avocat",
  "image-video": "retoucheChat.imageVideo",
  "facecam-animee": "retoucheChat.facecamAnimee",
  "tutoriel-outil": "retoucheChat.tutorielOutil",
  "video-longue": "retoucheChat.videoLongue",
  "demo-facecam": CLE_REGLAGE_DEMO_FACECAM,
};

/** Générateurs dont la voix est une prise filmée : elle ne se réécrit jamais (`modifier-script` toujours écarté). */
export const GENERATEURS_VOIX_PRISE_FILMEE = ["facecam-animee", "demo-facecam"] as const;
export const voixEstPriseFilmee = (g: string): boolean => (GENERATEURS_VOIX_PRISE_FILMEE as readonly string[]).includes(g);

/** Générateurs dont le texte lu est le script validé par Williams : `modifier-script` toujours écarté, texte à l'écran seulement s'il l'a écrit. */
export const GENERATEURS_SCRIPT_VALIDE = ["tutoriel-outil", "video-longue"] as const;
export const scriptEstValide = (g: string): boolean => (GENERATEURS_SCRIPT_VALIDE as readonly string[]).includes(g);

export const estGenerateurRetouche = (g: unknown): g is IdGenerateurRetouche => (GENERATEURS_RETOUCHE as readonly unknown[]).includes(g);

export type LireReglage = (id: string, defaut: unknown) => Promise<unknown>;

/** Allumé seulement par `true` exactement ; toute autre valeur, une absence ou une lecture en échec = éteint. */
export async function retoucheChatActif(generateur: IdGenerateurRetouche, lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLES_REGLAGE_RETOUCHE[generateur], RETOUCHE_ALLUMEE_PAR_DEFAUT.includes(generateur))) === true;
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

const REGLE_SCRIPT_VALIDE = "La voix et le texte lu ne changent jamais par ce chat : le script validé se change sur l'écran de validation.";

const REGLE_PRISE_FILMEE = "La prise et la voix ne changent jamais, même sur demande.";

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
    consigne: `Vidéo « Facecam animée » (prise de Williams, plaquettes animées autour). Retouchable : texte des plaquettes, pièces (chiffres, interface), zooms, transitions, dynamisme. La prise, les coupes et le son ne se touchent pas. ${REGLE_PRISE_FILMEE}`,
  },
  "tutoriel-outil": {
    id: "tutoriel-outil",
    nom: "Tutoriel",
    operations: ["ajuster-zoom", "decaler-scene", "changer-transition", "ajouter-dynamisme", "changer-habillage", "ajouter-piece", "retirer-piece", "remplacer-piece", "changer-brique", "changer-mot", "ajouter-chiffre"],
    consigne: `Vidéo « Tutoriel » (navigation filmée dans un outil de démonstration, voix du double de Williams). Retouchable : zooms, curseur et surbrillance, pièces posées par-dessus, transitions, dynamisme. Le film de la navigation ne se refait pas ici. ${REGLE_SCRIPT_VALIDE}`,
  },
  "video-longue": {
    id: "video-longue",
    nom: "Vidéo longue",
    operations: COMMUNES,
    consigne: `Vidéo « Vidéo longue » (16:9, découpée en chapitres, chaque chapitre est un groupe de scènes). Une retouche vise UN seul chapitre, celui que l'utilisateur a choisi : les scènes des autres chapitres ne se touchent pas. Retouchable : texte à l'écran, pièces, zooms, transitions, dynamisme. ${REGLE_SCRIPT_VALIDE}`,
  },
  "demo-facecam": {
    id: "demo-facecam",
    nom: "Démo face caméra",
    operations: COMMUNES,
    consigne: `Vidéo « Démo face caméra » (écran divisé : prise de Williams + écran de démonstration). Retouchable : texte à l'écran, pièces, zooms, transitions, dynamisme. Rien devant le visage. ${REGLE_PRISE_FILMEE}`,
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
  const priseFilmee = voixEstPriseFilmee(generateur);
  const scriptValide = scriptEstValide(generateur);
  const explicite = !priseFilmee && !scriptValide && demandeExpliciteScript(demande);
  const remarques: string[] = [];
  const gardees = operations.filter((o) => {
    if (o.type === "modifier-script") {
      if (scriptValide) remarques.push("Le texte lu est celui que vous avez validé : pour le changer, repassez par l'écran de validation.");
      else if (priseFilmee) remarques.push("La voix est votre prise filmée : elle ne se réécrit pas. Pour enlever un passage, demandez de le couper.");
      else if (!explicite) remarques.push("Le texte lu reste le vôtre : pour le changer, demandez « modifie le script ».");
      return explicite;
    }
    if (!permises.has(o.type)) {
      remarques.push(`Cette retouche (« ${o.type} ») n'existe pas pour ${adaptateurRetouche(generateur).nom}.`);
      return false;
    }
    if (scriptValide) {
      const estLeSien =
        o.type === "changer-mot"
          ? ecritParWilliams(demande, o.nouveau)
          : o.type === "ajouter-chiffre"
            ? ecritParWilliams(demande, String(o.valeur)) &&
              ecritParWilliams(demande, o.libelle) &&
              [o.prefixe, o.suffixe].every((t) => t === undefined || t.trim() === "" || ecritParWilliams(demande, t))
            : o.type === "ajouter-piece" || o.type === "remplacer-piece" || o.type === "changer-brique"
              ? textesDesParametres(o.parametres).every((t) => ecritParWilliams(demande, t))
              : true;
      if (!estLeSien) {
        remarques.push("Ce texte n'est pas le vôtre : écrivez-le dans votre message, mot pour mot.");
        return false;
      }
      if ((o.type === "ajouter-piece" || o.type === "changer-brique" || o.type === "remplacer-piece") && !parametresComplets(o.type === "remplacer-piece" ? o.nouvelle : o.piece, o.parametres)) {
        remarques.push("Dites le texte exact à afficher dans votre message.");
        return false;
      }
    }
    return true;
  });
  return { operations: gardees, remarques: [...new Set(remarques)] };
}

const normaliser = (t: string): string => t.toLowerCase().replace(/\s+/g, " ").trim();
const echapper = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Le texte figure dans la demande à frontières de mots ou de nombres (« 4 » n'est pas dans « 42 », « stock » pas dans « stocks »). */
const ecritParWilliams = (demande: string, texte: string): boolean => {
  const t = normaliser(texte);
  return t !== "" && new RegExp(`(^|[^\\p{L}\\p{N}])${echapper(t)}($|[^\\p{L}\\p{N}])`, "u").test(normaliser(demande));
};

/** `parametres` présents ET valides tels quels pour la pièce : jamais de réparation, donc jamais de texte d'exemple du catalogue à l'écran. */
function parametresComplets(piece: string, parametres: unknown): boolean {
  if (!estPiece(piece) || parametres === undefined || parametres === null) return false;
  return CATALOGUE_BRIQUES[piece].schema.safeParse(parametres).success;
}

/** Liste FERMÉE des clés techniques des `parametres` : leurs valeurs ne sont jamais affichées. Toute autre valeur texte doit être écrite par Williams. */
const CLES_TECHNIQUES = new Set(["id", "sceneid", "piece", "brique", "variante", "position", "zone", "couleur", "icone", "cle", "source", "style"]);
/** Tout texte ou nombre glissé dans les `parametres` d'une pièce (objets et listes imbriqués compris), hors clés techniques. */
function textesDesParametres(v: unknown, cle = ""): string[] {
  if (CLES_TECHNIQUES.has(cle.toLowerCase().replace(/[_\s]/g, ""))) return [];
  if (typeof v === "string") return v.trim() !== "" ? [v] : [];
  if (typeof v === "number") return [String(v)];
  if (Array.isArray(v)) return v.flatMap((x) => textesDesParametres(x, cle));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => textesDesParametres(x, k));
  return [];
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
