/**
 * ÉCRANS DU TABLEAU ANIMÉ (tâche TB-21, plan `02-FORMAT-TABLEAU-ANIME.md` § 15) : ce que les écrans lisent, en PUR.
 * Aucun import de service ni d'écran : la fiche de scènes, les refus et le travail sont reçus tels quels.
 *
 * - `etapesSuivi` : les étapes du moteur regroupées en 4 étapes parlantes (§ 15, n° 2).
 * - `pagesDeLaFiche` : pages et scènes en blocs lisibles, chaque refus à côté de sa scène.
 * - `coutVoixCentimes` : le prix de la voix, annoncé avant le lancement.
 */
import { trouverDessin } from "@/briques/dessins";
import { VISUELS_3 } from "@/briques/tableau-scene/reference/visuels-3";
import type { ProblemeFiche } from "@/briques/fiche-scenes";
import type { ElementTableau, FicheTableau, Geste, Marque, SceneTableau } from "@/moteurs/montage-tableau/fiche";

/* ------------------------------------------------------------------ */
/* Suivi de fabrication                                                 */
/* ------------------------------------------------------------------ */

export type StatutParlant = "a-venir" | "en-cours" | "faite" | "echec";

export interface EtapeSuivie {
  nom: string;
  statut: StatutParlant;
}

/** Étape du moteur, telle que le travail la porte. */
export interface EtapeMoteurLue {
  cle: string;
  statut: "en_attente" | "en_cours" | "terminee" | "echec" | "ignoree";
}

/**
 * Les 4 étapes parlantes et les étapes du moteur qu'elles couvrent (`src/moteurs/montage-tableau/etapes.ts`). Le calage
 * (texte posé sur les mots de la voix, une fois par sortie) compte avec « Les pages » : « La voix » est faite dès que la
 * voix est lue et payée, et le calage raté d'une sortie ne la montre jamais en échec (incident du 12/10).
 */
const GROUPES: readonly { nom: string; cles: readonly string[] }[] = [
  { nom: "Le découpage", cles: ["decoupage", "fiche"] },
  { nom: "La voix", cles: ["voix"] },
  { nom: "Les pages", cles: ["calage", "pages", "scenes"] },
  { nom: "Les finitions", cles: ["montage", "controle"] },
];

/**
 * Regroupe les étapes du moteur ; une étape inconnue compte dans « Les finitions ». Un groupe vide n'est pas montré.
 * `arrete` (travail en échec ou arrêté) : plus rien ne tourne, aucun groupe n'est « en cours ».
 */
export function etapesSuivi(etapes: readonly EtapeMoteurLue[], options: { arrete?: boolean } = {}): EtapeSuivie[] {
  const groupeDe = (cle: string) => {
    const i = GROUPES.findIndex((g) => g.cles.includes(cle));
    return i < 0 ? GROUPES.length - 1 : i;
  };
  const res: EtapeSuivie[] = [];
  GROUPES.forEach((g, i) => {
    const siennes = etapes.filter((e) => groupeDe(e.cle) === i);
    if (!siennes.length) return;
    // Sans découpage (fiche fournie), le premier groupe n'est qu'une relecture.
    const nom = i === 0 && !siennes.some((e) => e.cle === "decoupage") ? "La relecture" : g.nom;
    const statut: StatutParlant = siennes.some((e) => e.statut === "echec")
      ? "echec"
      : siennes.every((e) => e.statut === "terminee" || e.statut === "ignoree")
        ? "faite"
        : !options.arrete && siennes.some((e) => e.statut === "en_cours" || e.statut === "terminee")
          ? "en-cours"
          : "a-venir";
    res.push({ nom, statut });
  });
  return res;
}

/**
 * La fabrication s'est arrêtée à la relecture de la fiche (étape « fiche » du moteur : fiche et contrôles d'avant la
 * voix) : rien de la voix n'est payé ; la page propose « Corriger la fiche » et « Relancer ».
 */
export function arretALaRelecture(t: { statut: string; etapes: readonly EtapeMoteurLue[] }): boolean {
  return t.statut === "echec" && t.etapes.some((e) => (e.cle === "fiche" || e.cle === "decoupage") && e.statut === "echec");
}

/** Bouton proposé après un arrêt ; chacun a son chemin côté serveur (`relancerTableau`, `rouvrirFicheTableau`). */
export type IssueArret = "relancer" | "corriger";

/**
 * ISSUES APRÈS UN ARRÊT (une table, la même pour la page et le serveur) : après TOUT échec, « Corriger la fiche » et
 * « Relancer » (relecture : nouvelle relecture puis prix de la voix ; après la voix : l'étape en échec et les suivantes,
 * sur le journal, sans repayer) ; après un arrêt par Will, « Reprendre la fiche » (le brouillon, la voix gardée).
 */
export function issuesApresArret(t: { statut: string }): IssueArret[] {
  if (t.statut === "echec") return ["corriger", "relancer"];
  if (t.statut === "annule") return ["corriger"];
  return [];
}

/** Erreur lue sur le travail ou sur l'étape en échec. */
export interface ErreurLue {
  reessayable: boolean;
  messagePourWill: string;
}

/**
 * Message clair et possibilité de réessayer. Valeur prudente : sans erreur décrite, « Réessayer » est proposé (comme
 * l'attente face caméra) ; une erreur marquée non réessayable ne le propose jamais.
 */
export function erreurEnClair(travail: { erreur?: ErreurLue; etapes: readonly { statut: string; erreur?: ErreurLue }[] }): { message: string; reessayable: boolean } {
  const e = travail.erreur ?? travail.etapes.find((x) => x.statut === "echec")?.erreur;
  return {
    message: e?.messagePourWill?.trim() || "Une étape n'a pas abouti.",
    reessayable: e ? e.reessayable : true,
  };
}

/** « 1ʳᵉ dans la file », « 3ᵉ dans la file » (même tournure que le suivi commun). */
export function placeDansLaFile(rang: number | undefined): string | null {
  if (!rang || rang < 1) return null;
  return `${rang === 1 ? "1ʳᵉ" : `${rang}ᵉ`} dans la file`;
}

/* ------------------------------------------------------------------ */
/* Fiche de scènes                                                      */
/* ------------------------------------------------------------------ */

const NOMS_ROLES_SCENE: Readonly<Record<SceneTableau["role"], string>> = {
  accroche: "L'accroche",
  douleur: "Le problème",
  "idee-recue": "L'idée reçue",
  etape: "Le geste",
  exemple: "L'exemple",
  preuve: "La preuve",
  resultat: "Le résultat",
  fin: "La fin",
};

const MARQUES_LUES: Readonly<Record<Marque, string>> = {
  souligne: "souligné",
  entoure: "entouré",
  barre: "barré",
  surligne: "surligné",
};

const GESTES_LUS: Readonly<Record<Geste, string>> = {
  souligner: "souligne",
  entourer: "entoure",
  barrer: "barre",
  cocher: "coche",
  pointer: "pointe",
};

/** Un bloc de scène, prêt à lire. */
export interface SceneLue {
  /** Clé de liste (jamais affichée). */
  cle: string;
  numero: number;
  nom: string;
  /** Ce que dit la voix. */
  dit: string;
  /** Ce que le stylo écrit, dans l'ordre. */
  ecrit: string[];
  dessins: string[];
  /** Style « reference/3 » (peps) : le visuel dessiné de la scène, en clair (« Liste cochée »), et son bloc orange. */
  visuel?: string;
  gestes: string[];
  importants: string[];
  /** Les refus des règles pour cette scène, en phrases simples. */
  refus: string[];
}

export interface PageLue {
  numero: number;
  scenes: SceneLue[];
}

/** Libellé d'un dessin de la banque ; à défaut, son identifiant rendu lisible. */
function nomDessin(dessinId: string): string {
  const nom = trouverDessin(dessinId)?.nom ?? dessinId.replace(/[-_]+/g, " ");
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

/** Texte montré d'un élément ciblé par un geste. */
function texteCible(e: ElementTableau | undefined): string | null {
  if (!e) return null;
  if (e.type === "ligne" || e.type === "mention") return e.texte;
  if (e.type === "chiffre") return [e.valeur, e.unite].filter(Boolean).join(" ");
  if (e.type === "preuve") return "la preuve";
  if (e.type === "dessin") return nomDessin(e.dessinId).toLowerCase();
  return null;
}

/** Retire le préfixe technique d'un refus (« Scène s03 · règle « … » : ») et met une majuscule. */
export function phraseDuRefus(message: string): string {
  const sansPrefixe = message.replace(/^.*?·\s*règle\s*«[^»]*»\s*:\s*/, "").trim();
  const texte = sansPrefixe || message.trim();
  const phrase = texte.charAt(0).toUpperCase() + texte.slice(1);
  return /[.!?…]$/.test(phrase) ? phrase : `${phrase}.`;
}

function lireScene(scene: SceneTableau, numero: number, refus: string[]): SceneLue {
  const parId = new Map(scene.elements.map((e) => [e.id, e] as const));
  const ecrit: string[] = [];
  const dessins: string[] = [];
  const gestes: string[] = [];
  const importants: string[] = [];
  for (const e of scene.elements) {
    if (e.type === "ligne") {
      ecrit.push(e.marque ? `${e.texte} (${MARQUES_LUES[e.marque]})` : e.texte);
      if (e.importants?.length) importants.push(...e.importants);
      else if (e.marque) importants.push(e.texte);
    } else if (e.type === "chiffre") {
      ecrit.push([e.valeur, e.unite].filter(Boolean).join(" "));
    } else if (e.type === "preuve") {
      ecrit.push(...e.lignes);
    } else if (e.type === "mention") {
      ecrit.push(e.texte);
    } else if (e.type === "dessin") {
      dessins.push(nomDessin(e.dessinId));
    } else if (e.type === "geste") {
      const cible = texteCible(parId.get(e.cibleId));
      gestes.push(cible ? `Le stylo ${GESTES_LUS[e.geste]} « ${cible} »` : `Le stylo ${GESTES_LUS[e.geste]}`);
      const ciblee = parId.get(e.cibleId);
      if (ciblee?.type === "ligne" && !importants.includes(ciblee.texte)) importants.push(ciblee.texte);
    }
  }
  const v = scene.gabarit?.visuel;
  const b = scene.gabarit?.bloc;
  const peps = [...(v ? [VISUELS_3[v.id]?.nom ?? v.id] : []), ...(b ? [`bloc orange « ${b.compteur ? `${b.compteur.a} ` : ""}${b.texte} »`] : [])].join(" · ");
  return { cle: scene.id, numero, nom: NOMS_ROLES_SCENE[scene.role] ?? "Une scène", dit: scene.texteDit, ecrit, dessins, gestes, importants: [...new Set(importants)], refus, ...(peps ? { visuel: peps } : {}) };
}

/** Pages et scènes de la fiche ; chaque refus rangé sous sa scène, les autres rendus à part. */
export function pagesDeLaFiche(fiche: Pick<FicheTableau, "scenes">, problemes: readonly ProblemeFiche[] = []): { pages: PageLue[]; refusGeneraux: string[] } {
  const ids = new Set(fiche.scenes.map((s) => s.id));
  const refusDe = (id: string) => problemes.filter((p) => p.sceneId === id).map((p) => phraseDuRefus(p.message));
  const pages: PageLue[] = [];
  fiche.scenes.forEach((s, i) => {
    let page = pages.find((p) => p.numero === s.page);
    if (!page) {
      page = { numero: s.page, scenes: [] };
      pages.push(page);
    }
    page.scenes.push(lireScene(s, i + 1, refusDe(s.id)));
  });
  pages.sort((a, b) => a.numero - b.numero);
  const refusGeneraux = problemes.filter((p) => !p.sceneId || !ids.has(p.sceneId)).map((p) => phraseDuRefus(p.message));
  return { pages, refusGeneraux };
}

/* ------------------------------------------------------------------ */
/* Coût de la voix                                                      */
/* ------------------------------------------------------------------ */

/** Caractères dits (les `texteDit` mis bout à bout, comme le moteur les envoie à la voix). */
export function caracteresDits(fiche: Pick<FicheTableau, "scenes">): number {
  return fiche.scenes.map((s) => s.texteDit).join(" ").length;
}

/** Prix de la voix en centimes, arrondi au centime supérieur (jamais sous-estimé). */
export function coutVoixCentimes(fiche: Pick<FicheTableau, "scenes">, tarifCentimesParCaractere: number): number {
  if (!Number.isFinite(tarifCentimesParCaractere) || tarifCentimesParCaractere <= 0) return 0;
  return Math.ceil(caracteresDits(fiche) * tarifCentimesParCaractere);
}

/* ------------------------------------------------------------------ */
/* Retouches                                                            */
/* ------------------------------------------------------------------ */

/** Une opération de retouche, telle que l'écran la reçoit (la liste fermée vit dans le moteur). */
export interface OperationRetouche {
  /** Clé de liste (jamais affichée). */
  cle: string;
  libelle: string;
  payant: boolean;
}

/**
 * Le refus d'un découpage n'est plus d'actualité : la DERNIÈRE version de la fiche (corrigée à la main, ou d'un
 * découpage suivant) passe les règles. L'écran de création ne montre plus alors le bandeau « Découpage refusé par les
 * règles » ni ses motifs (relecture du 12/10/2026).
 */
export function refusDecoupagePerime(b: { tache: { type: string; statut: string } | null; fiche: unknown; problemes: readonly unknown[]; ficheACorriger: boolean } | null | undefined): boolean {
  return !!b?.tache && b.tache.type === "decoupage" && b.tache.statut === "refusee" && !!b.fiche && b.problemes.length === 0 && !b.ficheACorriger;
}
