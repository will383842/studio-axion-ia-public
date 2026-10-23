/**
 * ÉTAPES DU MOTEUR « TABLEAU ANIMÉ » (tâche TB-11, plan `02-FORMAT-TABLEAU-ANIME.md` § 4.2) : le graphe déclaré par
 * `etapes()`, avec des libellés parlants, et la correspondance avec les étapes de la chaîne `fabriquerTableau`.
 *
 *   decoupage  « Le découpage »          § 4.2 n° 1 — seulement quand la vidéo part d'un script (aucune fiche fournie)
 *   fiche      « La relecture de la fiche » n° 2 — chaîne : fiche + script (contrôles d'avant la voix)
 *   voix       « La voix »               n° 3 — seulement avec un personnage qui prête sa voix
 *   calage     « Le calage sur la voix »  n° 4
 *   pages      « Les pages »             n° 5 — chaîne : mise-en-page + fin commune provisoire
 *   scenes     « Le dessin des scènes »  n° 6
 *   montage    « Les finitions »         n° 7 — composition complète (voix, sous-titres, export, mesures)
 *   controle   « La vérification »       n° 11 — contrôles finaux
 * Les fins par réseau (n° 9) et la couverture (n° 10) ne sont pas encore dans la chaîne (version 2) : non déclarées.
 * PUR.
 */
import type { CommandeFabrication } from "@/domaine/types";
import type { EtapeFabrication } from "./fabriquer";
import type { CaseDejaVu } from "./controles";
import { estSortie, type IdSortie } from "./formats-sortie";

/* Contrat commun des moteurs (TYPES seulement, `src/moteurs/types.ts`) : lu par `import()` de type. Le test d'isolement
 * (TB-01) refuse toute ligne d'import vers `src/moteurs/`, faite pour écarter les AUTRES moteurs ; le contrat n'en est
 * pas un. */
type DefinitionEtapeMoteur = import("@/moteurs/types").DefinitionEtapeMoteur;

/** Clé des entrées de la vidéo (et donc de la commande) propres au tableau. */
export const ENTREE_TABLEAU = "tableau";

/**
 * `Video.entrees.tableau` : où est la fiche de scènes (stockage), son empreinte et sa version ; les formats de sortie
 * (tirés des réseaux cochés), le mot à commenter de la fin, la trace du script généré.
 */
export interface EntreesTableau {
  ficheScenesCle?: string;
  empreinte?: string;
  version?: number;
  sorties?: IdSortie[];
  mot?: string;
  /** Réglage de la fiche (14/10) : objectif forcé de la fin de TikTok et Shorts (ENREGISTRER, PARTAGER, QUESTION, LIEN_PROFIL). */
  finLiens?: string;
  /** Mots de la douleur (règles « douleur en tête » et « geste fort ») : ceux validés avec la fiche à la création. */
  motsDouleur?: string[];
  /** Texte dit fourni par Will, pris à l'identique (règle 13 : ni tutoiement ni mots de temps contrôlés sur ce texte). */
  origine?: "will";
  traceScriptId?: string;
  /** Case « Ce conseil n'est pas en première page d'une recherche », cochée à la création (avec sa date). */
  dejaVu?: CaseDejaVu;
  /**
   * Voix déjà payée par une fabrication arrêtée de la même vidéo (même texte dit) : sa part du journal (voix, lectures,
   * recettes, rangées par empreinte), reprise au lancement. Rien n'est relu si l'empreinte de la voix n'a pas changé.
   */
  voixPayee?: VoixPayee;
}

/** Part « voix » du journal d'une fabrication arrêtée (forme du journal de `fabriquer.ts`, gardée telle quelle). */
export interface VoixPayee {
  /** Travail qui a payé la voix. */
  travailId: string;
  journal: { version: string; etapes: { voix: { empreinte: string; dureeMs: number; sortie: unknown } }; voix?: unknown; lectures?: unknown; recettes?: unknown };
}

/** Lecture tolérante de la voix déjà payée (au moindre doute : rien, la voix sera lue). */
export function lireVoixPayee(brut: unknown): VoixPayee | undefined {
  if (!brut || typeof brut !== "object") return undefined;
  const b = brut as { travailId?: unknown; journal?: { version?: unknown; etapes?: { voix?: { empreinte?: unknown } } } };
  if (typeof b.travailId !== "string" || typeof b.journal?.version !== "string" || typeof b.journal.etapes?.voix?.empreinte !== "string") return undefined;
  return b as VoixPayee;
}

/** Lecture tolérante de `entrees.tableau` (au moindre doute : rien). */
export function lireEntreesTableau(entrees: CommandeFabrication["entrees"] | undefined): EntreesTableau {
  const brut = (entrees as Record<string, unknown> | undefined)?.[ENTREE_TABLEAU];
  if (!brut || typeof brut !== "object") return {};
  const b = brut as Record<string, unknown>;
  return {
    ...(typeof b.ficheScenesCle === "string" && b.ficheScenesCle ? { ficheScenesCle: b.ficheScenesCle } : {}),
    ...(typeof b.empreinte === "string" ? { empreinte: b.empreinte } : {}),
    ...(typeof b.version === "number" ? { version: b.version } : {}),
    ...(Array.isArray(b.sorties) && b.sorties.some((x) => typeof x === "string" && estSortie(x)) ? { sorties: [...new Set(b.sorties.filter((x): x is IdSortie => typeof x === "string" && estSortie(x)))] } : {}),
    ...(typeof b.mot === "string" && b.mot.trim() ? { mot: b.mot.trim() } : {}),
    ...(typeof b.finLiens === "string" && b.finLiens.trim() ? { finLiens: b.finLiens.trim() } : {}),
    ...(Array.isArray(b.motsDouleur) && b.motsDouleur.some((x) => typeof x === "string" && x.trim()) ? { motsDouleur: b.motsDouleur.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) } : {}),
    ...(b.origine === "will" ? { origine: "will" as const } : {}),
    ...(typeof b.traceScriptId === "string" && b.traceScriptId ? { traceScriptId: b.traceScriptId } : {}),
    ...(lireDejaVu(b.dejaVu) ? { dejaVu: lireDejaVu(b.dejaVu)! } : {}),
    ...(lireVoixPayee(b.voixPayee) ? { voixPayee: lireVoixPayee(b.voixPayee)! } : {}),
  };
}

/** Lecture tolérante de la case « déjà vu » (cochée, date AAAA-MM-JJ) ; au moindre doute : rien. */
export function lireDejaVu(brut: unknown): CaseDejaVu | undefined {
  if (!brut || typeof brut !== "object") return undefined;
  const c = brut as Record<string, unknown>;
  if (c.coche !== true) return undefined;
  return { coche: true, ...(typeof c.le === "string" ? { le: c.le } : {}) };
}

/** Une fiche de scènes est fournie : le découpage est sauté. */
export function ficheFournie(commande: Pick<CommandeFabrication, "entrees">): boolean {
  return !!lireEntreesTableau(commande.entrees).ficheScenesCle;
}

export type CleEtapeTableau = "decoupage" | "fiche" | "voix" | "calage" | "pages" | "scenes" | "montage" | "controle";

/** Étapes de la chaîne couvertes par chaque étape du moteur (le découpage est hors chaîne). */
export const ETAPES_CHAINE: Readonly<Record<Exclude<CleEtapeTableau, "decoupage">, readonly EtapeFabrication[]>> = {
  fiche: ["fiche", "script"],
  voix: ["voix"],
  calage: ["calage"],
  pages: ["mise-en-page", "fin"],
  scenes: ["scenes"],
  montage: ["composition"],
  controle: ["controles"],
};

/** Étape du moteur qui couvre une étape de la chaîne. */
export function etapeDuMoteur(e: EtapeFabrication): Exclude<CleEtapeTableau, "decoupage"> {
  const trouvee = (Object.entries(ETAPES_CHAINE) as [Exclude<CleEtapeTableau, "decoupage">, readonly EtapeFabrication[]][]).find(([, liste]) => liste.includes(e));
  return trouvee ? trouvee[0] : "controle";
}

/** Durée d'une scène rendue, en secondes de file [supposé : à mesurer à l'essai réel, TB-06b]. */
const SECONDES_PAR_SCENE = 45;
/** Une scène tous les 10 s de vidéo environ (scènes de 6 à 15 s, § 4.1). */
const SECONDES_DE_VIDEO_PAR_SCENE = 10;

/**
 * Graphe des étapes pour cette commande. `ficheConnue` : la fiche tirée d'un découpage précédent est reprise (retouche
 * d'une vidéo partie d'un script) : pas de nouveau découpage.
 */
export function etapesTableau(commande: Pick<CommandeFabrication, "entrees" | "distribution" | "dureeCibleSec">, options: { ficheConnue?: boolean } = {}): DefinitionEtapeMoteur[] {
  const scenes = Math.max(1, Math.ceil((commande.dureeCibleSec || 30) / SECONDES_DE_VIDEO_PAR_SCENE)) + 1;
  const e: DefinitionEtapeMoteur[] = [];
  if (!ficheFournie(commande) && !options.ficheConnue) e.push({ cle: "decoupage", nom: "Le découpage", icone: "ciseaux", dependDe: [], dureeEstimeeSec: 30 });
  e.push({ cle: "fiche", nom: "La relecture de la fiche", icone: "liste", dependDe: e.length ? ["decoupage"] : [], dureeEstimeeSec: 2 });
  const avecVoix = commande.distribution.length > 0;
  if (avecVoix) e.push({ cle: "voix", nom: "La voix", icone: "micro", dependDe: ["fiche"], dureeEstimeeSec: 20 });
  e.push({ cle: "calage", nom: "Le calage sur la voix", icone: "horloge", dependDe: [avecVoix ? "voix" : "fiche"], dureeEstimeeSec: 2 });
  e.push({ cle: "pages", nom: "Les pages", icone: "page", dependDe: ["calage"], dureeEstimeeSec: 2 });
  e.push({ cle: "scenes", nom: "Le dessin des scènes", icone: "crayon", dependDe: ["pages"], dureeEstimeeSec: scenes * SECONDES_PAR_SCENE });
  e.push({ cle: "montage", nom: "Les finitions", icone: "film", dependDe: ["scenes"], dureeEstimeeSec: 90 });
  e.push({ cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 });
  return e;
}
