/**
 * RÈGLES DE VALIDATION DU TABLEAU ANIMÉ (tâche TB-01, plan `02-FORMAT-TABLEAU-ANIME.md` § 6.3, règles 2 à 17 ; la
 * règle 1, schéma exact et version connue, est celle de `src/briques/fiche-scenes`).
 *
 * Chaque règle est une fonction PURE et nommée `(fiche, contexte) → manquements`. Tout ce qui vient de l'extérieur est
 * INJECTÉ par le `contexte` : texte validé du script, mesure du texte, mise en page prévue, sources des chiffres,
 * preuves et matières, banque de dessins, interdits de Will, date du jour. Aucun accès base, aucun réseau.
 *
 * Les messages sont en français, sans sigle ; la brique commune les préfixe de la scène et du nom de la règle
 * (« Scène s03 · règle « … » : … »). Sur une fiche non calée, les temps sont ESTIMÉS par le débit de parole ; sur une
 * fiche calée (début et fin de scène posés), les temps de la scène sont repris et les mots répartis à débit égal.
 *
 * N'importe AUCUN autre moteur. N'importe de `fiche.ts` que des types (pas de dépendance circulaire à l'exécution).
 * Importe la mise en page du tableau (`mise-en-page.ts`, règle 4) : elle n'importe rien de ce fichier (sa forme de
 * référence est dans `reference.ts`), et de `fiche.ts` que des types.
 */
import type { RegleFormat } from "@/briques/fiche-scenes";
import { dessinValide as dessinValideBanque } from "@/briques/dessins";
import { formesAdresse, utilisable } from "@/domaine/controles-script";
import { contientExpression, debutsDePhrase, mots, motsPleins, racine, texteCompare } from "@/domaine/controles-script/texte";
import type { ContexteAxion, Matiere, Preuve } from "@/domaine/types";
import { CARACTERES_PAR_SECONDE_TABLEAU, DEBUT_DOULEUR_SEC, DUREE_MAX_TABLEAU_SEC, caracteresDits } from "@/domaine/duree-tableau";
import { QUESTIONS_IA } from "@/domaine/scripts-tableau";
import { appliquerInterdits } from "@/domaine/voix";
import { cleMot, type ElementTableau, type FicheTableau, type Geste, type Marque, type NiveauLigne, type RoleLigne, type SceneTableau } from "./fiche";
import { TENUE_FIN_TOTALE_MS } from "@/briques/tableau-scene/v2/charte";
import { ErreurMiseEnPage, REFERENCE_CONTROLE, largeurMotLigne, mettreEnPage } from "./mise-en-page";
import type { MiseEnPageControle } from "./reference";
import { bornesFicheTableau, estGabarit, estGabarit3, lignesDe, regleGabarit } from "./gabarit";
import { textesPeps } from "./gabarit-3";
import { nombresDits, sansDecomptes } from "./fidelite-texte";

export type { MiseEnPageControle } from "./reference";

/* ------------------------------------------------------------------ */
/* Seuils (constantes nommées, réglables)                                */
/* ------------------------------------------------------------------ */

/** Accroche de la page 1, scène 1 : 8 mots au plus (règle 3). */
export const ACCROCHE_MOTS_MAX = 8;
/** Style « reference/3 » : l'accroche est la phrase entière de la douleur, écrite en très grand dès la première image. */
export const ACCROCHE_MOTS_MAX_3 = 14;
/**
 * Par page : 40 mots au plus, 6 lignes ÉCRITES au plus (règle 4). Les lignes sont comptées telles qu'écrites, pas en
 * rangées après coupe : la place à l'écran est déjà gardée par la mise en page réelle (la page doit tenir sans
 * descendre sous le plancher), alors que le nombre de rangées dépend de la réduction choisie (une même page fait 7
 * rangées à l'échelle 1 et moins une fois réduite) et que le découpage, qui écrit la fiche, ne peut compter que ses lignes.
 */
export const PAGE_MOTS_MAX = 40;
export const PAGE_LIGNES_MAX = 6;
/** Style « reference/2 » (gabarit clair) : la page « À retenir » écrit son titre, la liste des étapes et l'appel. */
export const PAGE_LIGNES_MAX_GABARIT = 8;
/** Taille du texte : 3 % de la hauteur au moins (règle 5). */
export const TAILLE_TEXTE_MIN_FRACTION = 0.03;
/**
 * Débit de parole (règles 10, 14, 16, 17) : LE SEUL estimateur du tableau, partagé avec le générateur de scripts
 * (`src/domaine/duree-tableau.ts`, calé le 12/10 sur la voix réelle, recalé au lot B2a : 16,9 caractères dits par seconde (165 mots/min, cible à mesurer)). L'ancien débit
 * propre aux règles (2,6 mots par seconde, supposé) surestimait la durée d'environ 30 %.
 */
export const CARACTERES_PAR_SECONDE = CARACTERES_PAR_SECONDE_TABLEAU;
/** Durée maximale (règle 14) : le plafond commun au générateur et au découpage. */
export const DUREE_MAX_MS = DUREE_MAX_TABLEAU_SEC * 1000;
/** Début de la vidéo où la douleur doit être dite (règles 10 et 17). */
export const DEBUT_DOULEUR_MS = DEBUT_DOULEUR_SEC * 1000;
/** Nombre de mots-clés de la douleur à dire et à écrire au début (règles 10 et 17) [supposé : un seul suffit]. */
export const MOTS_CLES_DOULEUR_MIN = 1;
/** Du rythme (règle 16) : un événement visuel au moins toutes les 4 s ; le stylo jamais immobile plus de 2 s. */
export const ECART_EVENEMENT_MAX_MS = 4_000;
export const IMMOBILITE_STYLO_MAX_MS = 2_000;
/** Durée du tracé de chaque élément par le stylo (≈ 1 ligne par seconde, § 7) [supposé : à régler sur la 1re vidéo]. */
export const DUREES_TRACE_MS = {
  ligne: 1_000,
  dessin: 1_000,
  chiffre: 800,
  /** Par ligne de la bulle de preuve. */
  preuve: 1_000,
  geste: 500,
  pageTournee: 300,
} as const;
/** Gestes forts du stylo (règle 17), en geste ou en marque posée sur une ligne. */
export const GESTES_FORTS: readonly Geste[] = ["entourer", "barrer"];
export const MARQUES_FORTES: readonly Marque[] = ["entoure", "barre"];
/** Phrases d'appel refusées dans les scènes (règle 12) : la fin est une pièce à part. Mot entier, sans accents. */
export const PHRASES_APPEL: readonly string[] = [
  "abonnez-vous",
  "abonnez vous",
  "abonnez",
  "abonne-toi",
  "abonnement",
  "commentez",
  "en commentaire",
  "dans les commentaires",
  "lien",
  "liens",
  "partagez",
  "likez",
  "mettez un like",
  "cliquez",
  "suivez-moi",
  "suivez-nous",
  "suivez le compte",
  "inscrivez-vous",
  "enregistrez cette video",
  "envoyez cette video",
];
/** Mots de temps refusés dans les textes (règle 13) : aucun contrôle du studio ne les porte, déclarés ici. */
export const MOTS_TEMPS_INTERDITS: readonly string[] = ["demain"];
/**
 * Numéros d'épisode refusés (règle 15), sur le texte comparé (minuscules, sans accents ni ponctuation) : un mot de série
 * SUIVI d'un numéro. Jamais « part » (le verbe : « Une demi-page part dix minutes plus tard », vidéo v-b2d772d28b97) ;
 * « un » et « une » ne comptent pas comme numéro quand ils ouvrent une locution (« une partie un peu longue »).
 */
const MOTIF_NUMERO =
  /(?:^|\s)(?:episode|episodes|ep|partie|chapitre|volet|saison|tome)\s+(?:\d+|[ivx]{1,4}|(?:un|une)(?!\s+(?:peu|fois|jour|seul|seule|autre|instant|moment|bon|bonne)(?:\s|$))|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|premier|premiere|second|seconde|deuxieme|troisieme|suivant|suivante|prochain|prochaine)(?=\s|$)/;
const MOTIF_NUMERO_BRUT = /#\s?\d+|\bép\.\s?\d+|prochain épisode|suite au prochain/i;

/* ------------------------------------------------------------------ */
/* Contexte injecté                                                      */
/* ------------------------------------------------------------------ */

/** Largeur (px) d'un mot écrit (règle 4 : mot le plus long de chaque ligne). */
export type MesureLargeur = (mot: string, taillePx: number, niveau: NiveauLigne) => number;

/** Mesure par défaut : celle de la mise en page (police, graisse et approche de l'habillage). */
export const mesureParDefaut: MesureLargeur = largeurMotLigne;

/** Mise en page réelle (règle 4) : lève `ErreurMiseEnPage` (qui nomme la page) si une page ne tient pas. */
export type MiseEnPageReelle = (fiche: FicheTableau) => unknown;

/** Forme qui distingue un rôle de ligne, en plus de sa couleur (règle 6). */
export interface FormeRole {
  couleur: string;
  forme?: { type: "pictogramme" | "cadre" | "soulignement"; nom?: string };
}

/** Formes par défaut des rôles de ligne (couleurs des posts de Will, réponses du 11/10) ; l'habillage peut les remplacer. */
export const FORMES_PAR_ROLE: Readonly<Record<RoleLigne, FormeRole>> = {
  titre: { couleur: "#110A05", forme: { type: "soulignement" } },
  regle: { couleur: "#110A05", forme: { type: "cadre" } },
  avantage: { couleur: "#110A05", forme: { type: "pictogramme", nom: "coche" } },
  condition: { couleur: "#110A05", forme: { type: "pictogramme", nom: "fleche" } },
  resultat: { couleur: "#110A05", forme: { type: "pictogramme", nom: "cible" } },
  alerte: { couleur: "#110A05", forme: { type: "pictogramme", nom: "point-exclamation" } },
};

export type PreuveConnue = Pick<Preuve, "id" | "statut" | "retrait" | "archiveLe" | "perimeLe">;
export type MatiereConnue = Pick<Matiere, "id" | "type" | "statut" | "retrait" | "archiveLe" | "perimeLe">;

export interface ContexteTableau {
  /** Texte validé du script, sans appel (règle 2). */
  texteScript: string;
  /** Date du jour, AAAA-MM-JJ (règles 9 et 11). */
  aujourdhui: string;
  /** Identifiants des sources de chiffres connues (règle 7). */
  sourcesChiffres: readonly string[];
  /** Preuves du studio (collection `preuves`) et matières (règle 9). */
  preuves: readonly PreuveConnue[];
  matieres: readonly MatiereConnue[];
  /** Mise en page prévue (règles 4 et 5) ; par défaut `REFERENCE_CONTROLE` de la mise en page. */
  mise?: Partial<MiseEnPageControle>;
  /** Mesure de largeur d'un mot (règle 4) ; par défaut celle de la mise en page. */
  mesurerLargeur?: MesureLargeur;
  /** Mise en page réelle (règle 4) ; par défaut `mettreEnPage`. */
  mettreEnPage?: MiseEnPageReelle;
  /** Formes des rôles de ligne (règle 6) ; par défaut `FORMES_PAR_ROLE`. */
  formesParRole?: Readonly<Partial<Record<RoleLigne, FormeRole>>>;
  /** Banque de dessins et registre des droits (règle 11) ; par défaut `dessinValide` de `src/briques/dessins`. */
  dessinValide?: (dessinId: string, aLaDate: string) => boolean;
  /** Interdits de Will, avec expression (règle 13, comme le contrôle de script des interdits). */
  interdits?: ContexteAxion["interdits"];
  /** Mots interdits en clair (règle 13), comparés mot entier, sans accents. */
  motsInterdits?: readonly string[];
  /**
   * Le texte dit est celui que Will a fourni lui-même (origine « will » du brouillon) : pris à l'identique, la règle 13 ne
   * contrôle ni le tutoiement ni les mots de temps sur la voix. Les textes ÉCRITS à l'écran gardent tous leurs contrôles.
   */
  texteDeWill?: boolean;
  /** Débit de parole en caractères dits par seconde (règles 10, 14, 16, 17) ; par défaut `CARACTERES_PAR_SECONDE`. */
  caracteresParSeconde?: number;
  /**
   * Mots de la douleur (règles 10 et 17), tels qu'ils sont DITS dans l'accroche : rendus par le générateur de scripts, ou
   * saisis à la main. Absents : les mots pleins du champ « douleur » de la fiche.
   */
  motsDouleur?: readonly string[];
}

/** Un manquement : la scène concernée (si possible) et ce qui ne va pas. */
export interface Manquement {
  sceneId?: string;
  detail: string;
}

export type FonctionRegle = (fiche: FicheTableau, contexte: ContexteTableau) => Manquement[];

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

const secondes = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1).replace(".", ",")} s`;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Textes ÉCRITS par un élément (rien pour un dessin ou un geste). */
export function textesEcrits(e: ElementTableau): string[] {
  switch (e.type) {
    case "ligne":
    case "mention":
      return [e.texte];
    case "chiffre":
      return [e.unite ? `${e.valeur} ${e.unite}` : e.valeur];
    case "preuve":
      return [...e.lignes];
    default:
      return [];
  }
}

const ancreDe = (e: ElementTableau) => ("ancre" in e ? e.ancre : 0);

/** Style « blocs/2 » (`fiche.habillage`) : même valeur que `STYLE_BLOCS_2` de `fiche.ts` (ce fichier n'en importe que des types). */
const STYLE_V2 = "blocs/2";
const estV2 = (fiche: Pick<FicheTableau, "habillage">) => fiche.habillage === STYLE_V2;
/**
 * Styles « reference/1 » et « reference/2 » (page blanche écrite au crayon ; le second y ajoute le gabarit de page
 * clair) : mêmes valeurs que `STYLE_REFERENCE_1` et `STYLE_REFERENCE_2` de `fiche.ts`.
 */
const STYLE_REF = "reference/1";
const estRef = (fiche: Pick<FicheTableau, "habillage">) => fiche.habillage === STYLE_REF || estGabarit(fiche);
/**
 * Styles « blocs/2 » et « reference/1 » : chaque ligne qui s'écrit est un événement visuel (elle entre, ou le crayon
 * l'écrit), la dernière scène dit et écrit l'appel, et la page de fin tient après la voix (`TENUE_FIN_TOTALE_MS`).
 */
const styleRecent = (fiche: Pick<FicheTableau, "habillage">) => estV2(fiche) || estRef(fiche);

/** Textes ÉCRITS par les écrans d'une scène (éléments de liste et leur détail). */
export function textesEcransScene(s: SceneTableau): string[] {
  return (s.ecrans ?? []).flatMap((e) => (e.liste ?? []).flatMap((it) => [it.texte, ...(it.detail ? [it.detail] : [])]));
}

/** Tous les textes écrits d'une scène : éléments, éléments de liste des écrans, visuel et bloc orange (« reference/3 »). */
const textesScene = (s: SceneTableau) => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s), ...textesPeps(s)];

/** Style « blocs/2 » : la dernière scène porte l'écran d'appel (« Écrivez … en commentaire ») ; l'appel y est permis. */
export function sceneAppelPermis(fiche: FicheTableau, s: SceneTableau): boolean {
  if (s !== fiche.scenes[fiche.scenes.length - 1]) return false;
  const ecranAppel = (s.ecrans ?? []).some((e) => e.moment === "appel");
  // Style « reference/1 » : la dernière page écrit l'appel ; la scène de fin (rôle « fin ») suffit à le permettre.
  const ligneAppel = estGabarit(fiche) && lignesDe(s).some((l) => l.bloc === "appel");
  return (estV2(fiche) && ecranAppel) || (estRef(fiche) && (ecranAppel || s.role === "fin" || ligneAppel));
}

/** Temps d'une scène : repris du calage s'il est posé, sinon estimé par le débit à la suite de la scène précédente. */
export interface TempsScene {
  scene: SceneTableau;
  debutMs: number;
  finMs: number;
  /** Mots du texte dit (même découpe que l'ancre). */
  mots: string[];
  /**
   * Fin de la parole dans la scène, quand elle finit avant la scène : dernière scène calée du style « blocs/2 », dont
   * l'écran de fin est tenu 2,9 s après la voix (blocage réel du 14/10 : la ligne du dernier mot était placée APRÈS la
   * voix, dans la tenue, d'où un faux silence de plus de 4 s). Absente : la parole occupe toute la scène.
   */
  finParoleMs?: number;
}

export function tempsScenes(fiche: FicheTableau, caracteresParSeconde = CARACTERES_PAR_SECONDE): TempsScene[] {
  let t = 0;
  const derniere = fiche.scenes.length - 1;
  const v2 = styleRecent(fiche);
  return fiche.scenes.map((scene, k) => {
    const m = mots(scene.texteDit);
    const calee = scene.debutMs !== undefined && scene.finMs !== undefined;
    const debutMs = calee ? scene.debutMs! : t;
    const finMs = calee ? scene.finMs! : t + (caracteresDits(scene.texteDit) / caracteresParSeconde) * 1000;
    t = finMs;
    // Même fin de parole que la règle du rythme (`momentsDuStylo`) : la scène calée moins la tenue de l'écran de fin.
    if (calee && v2 && k === derniere) return { scene, debutMs, finMs, mots: m, finParoleMs: Math.max(debutMs, finMs - TENUE_FIN_TOTALE_MS) };
    return { scene, debutMs, finMs, mots: m };
  });
}

/** Instant (ms) du mot n° `ancre` de la scène (mots répartis à débit égal sur la parole de la scène). */
export function instantAncre(ts: TempsScene, ancre: number): number {
  if (!ts.mots.length) return ts.debutMs;
  return ts.debutMs + (Math.min(ancre, ts.mots.length) / ts.mots.length) * ((ts.finParoleMs ?? ts.finMs) - ts.debutMs);
}

const debitDe = (c: ContexteTableau) => c.caracteresParSeconde ?? CARACTERES_PAR_SECONDE;
const miseDe = (c: ContexteTableau): MiseEnPageControle => ({
  ...REFERENCE_CONTROLE,
  ...c.mise,
  taillePx: { ...REFERENCE_CONTROLE.taillePx, ...c.mise?.taillePx },
});

/** Racines des mots-clés de la douleur (mots pleins). */
export function motsClesDouleur(douleur: string): Set<string> {
  return new Set(motsPleins(douleur).map(racine));
}

/** Les mots de la douleur cherchés par les règles 10 et 17 : ceux du contexte (dits), sinon les mots pleins du champ. */
export function motsDouleurCherches(fiche: Pick<FicheTableau, "douleur">, contexte: Pick<ContexteTableau, "motsDouleur">): string[] {
  const donnes = (contexte.motsDouleur ?? []).map((m) => m.trim()).filter((m) => motsPleins(m).length);
  if (donnes.length) return [...new Set(donnes)];
  // Sans mots donnés : les mots pleins du champ « douleur », tels qu'ils sont écrits (accents compris), sans doublon.
  const vus = new Set<string>();
  return mots(fiche.douleur)
    .map((m) => m.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((m) => {
      const cles = motsPleins(m);
      if (!cles.length || vus.has(cles.join(" "))) return false;
      vus.add(cles.join(" "));
      return true;
    });
}

/** Racines cherchées par les règles 10 et 17. */
function clesDouleur(fiche: Pick<FicheTableau, "douleur">, contexte: Pick<ContexteTableau, "motsDouleur">): Set<string> {
  return new Set(motsDouleurCherches(fiche, contexte).flatMap((m) => motsPleins(m)).map(racine));
}

/** « « passée », « journée » » : les mots à proposer dans un message (6 au plus). */
const listeMots = (ms: readonly string[]) => ms.slice(0, 6).map((m) => `« ${m} »`).join(", ");

/** Mots-clés de la douleur présents dans un texte. */
function clesPresentes(texte: string, cles: Set<string>): string[] {
  return [...new Set(motsPleins(texte).filter((m) => cles.has(racine(m))))];
}

/** Mots-clés de la douleur DITS dans les premières `limiteMs` de la première scène. */
function clesDitesAuDebut(fiche: FicheTableau, contexte: ContexteTableau, limiteMs: number): string[] {
  const ts = tempsScenes(fiche, debitDe(contexte))[0];
  if (!ts) return [];
  const dits = ts.mots.filter((_, i) => instantAncre(ts, i) < limiteMs).join(" ");
  return clesPresentes(dits, clesDouleur(fiche, contexte));
}

/* ------------------------------------------------------------------ */
/* Règle 2 : texte dit mot pour mot                                      */
/* ------------------------------------------------------------------ */

const jetons = (t: string) => t.split(/\s+/).filter(Boolean);

/** La concaténation des `texteDit` est le texte validé du script, mot pour mot (ponctuation et casse comprises). */
export function regleTexteMotPourMot(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const attendu = jetons(contexte.texteScript);
  let i = 0;
  for (const s of fiche.scenes) {
    for (const [k, mot] of jetons(s.texteDit).entries()) {
      if (i >= attendu.length) {
        return [{ sceneId: s.id, detail: `le texte dit dépasse le script validé à partir du mot ${k + 1} (« ${mot} »).` }];
      }
      if (mot !== attendu[i]) {
        return [{ sceneId: s.id, detail: `le mot ${k + 1} du texte dit est « ${mot} », le script validé dit « ${attendu[i]} ».` }];
      }
      i++;
    }
  }
  if (i < attendu.length) {
    const derniere = fiche.scenes[fiche.scenes.length - 1];
    return [{ sceneId: derniere?.id, detail: `il manque la fin du script validé, à partir de « ${attendu.slice(i, i + 6).join(" ")} ».` }];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Règle 3 : accroche courte, dès la première image                      */
/* ------------------------------------------------------------------ */

export function regleAccrocheCourte(fiche: FicheTableau): Manquement[] {
  // Style « blocs/2 » : seules les lignes écrites dès le premier mot comptent (voir plus bas).
  const s = fiche.scenes[0];
  if (!s) return [];
  const res: Manquement[] = [];
  if (s.role !== "accroche") res.push({ sceneId: s.id, detail: `la première scène doit être l'accroche, pas « ${s.role} ».` });
  const lignes = s.elements.filter((e) => e.type === "ligne");
  if (!lignes.length) {
    res.push({ sceneId: s.id, detail: "l'accroche doit être écrite sur la page : aucune ligne dans la première scène." });
    return res;
  }
  // Style « blocs/2 » : l'accroche est la phrase écrite dès le premier mot (le reste de l'écran arrive avec la voix).
  const ecrits = styleRecent(fiche) ? lignes.filter((e) => e.ancre === 0).map((e) => e.texte) : s.elements.flatMap(textesEcrits);
  const n = ecrits.reduce((t, x) => t + mots(x).length, 0);
  const max = estGabarit3(fiche) ? ACCROCHE_MOTS_MAX_3 : ACCROCHE_MOTS_MAX;
  if (n > max) res.push({ sceneId: s.id, detail: `l'accroche écrite compte ${n} mots ; ${max} au plus.` });
  if (!lignes.some((e) => e.ancre === 0)) {
    res.push({ sceneId: s.id, detail: "l'accroche doit être visible dès la première image : une ligne doit partir du premier mot." });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 4 : page lisible                                                */
/* ------------------------------------------------------------------ */

/** Mots d'une ligne tels que la mise en page les coupe : un signe isolé (« ? », « : ») reste collé au mot d'avant. */
function unitesDeCoupe(texte: string): string[] {
  const unites: string[] = [];
  for (const m of texte.split(/\s+/).filter(Boolean)) {
    if (unites.length && !/[\p{L}\p{N}]/u.test(m)) unites[unites.length - 1] += ` ${m}`;
    else unites.push(m);
  }
  return unites;
}

/**
 * Page lisible, fidèle à ce qui sera dessiné : 40 mots et 6 lignes écrites au plus par page ; le mot le plus long de
 * chaque ligne tient dans la largeur utile à la taille prévue ; et la mise en page réelle réussit (chaque page tient
 * au-dessus des sous-titres, réduite au besoin par pas de 5 %, jamais sous le plancher de 3 %).
 */
export function reglePageLisible(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  if (estV2(fiche)) return regleEcranLisible(fiche, contexte);
  const mise = miseDe(contexte);
  const mesurer = contexte.mesurerLargeur ?? mesureParDefaut;
  const res: Manquement[] = [];
  const parPage = new Map<number, { mots: number; lignes: number; motsSignale: boolean; lignesSignale: boolean }>();
  for (const s of fiche.scenes) {
    const p = parPage.get(s.page) ?? { mots: 0, lignes: 0, motsSignale: false, lignesSignale: false };
    parPage.set(s.page, p);
    for (const e of s.elements) {
      p.mots += textesEcrits(e).reduce((t, x) => t + mots(x).length, 0);
      const lignes: { texte: string; niveau: NiveauLigne }[] =
        e.type === "ligne" ? [{ texte: e.texte, niveau: e.niveau }] : e.type === "preuve" ? e.lignes.map((texte) => ({ texte, niveau: "texte" as const })) : [];
      p.lignes += lignes.length;
      // Style « reference/1 » : sa propre taille et sa colonne ; un mot trop long est nommé par sa mise en page (plus bas).
      if (estRef(fiche)) continue;
      for (const l of lignes) {
        const [mot, largeur] = unitesDeCoupe(l.texte)
          .map((m) => [m, mesurer(m, mise.taillePx[l.niveau], l.niveau)] as const)
          .reduce((a, b) => (b[1] > a[1] ? b : a), ["", 0] as const);
        if (largeur > mise.largeurUtilePx) {
          res.push({
            sceneId: s.id,
            detail: `dans la ligne « ${l.texte} », le mot « ${mot} » ne tient pas dans la largeur utile (${Math.round(largeur)} px pour ${Math.round(mise.largeurUtilePx)} px).`,
          });
        }
      }
    }
    if (p.mots > PAGE_MOTS_MAX && !p.motsSignale) {
      p.motsSignale = true;
      res.push({ sceneId: s.id, detail: `la page ${s.page} compte ${p.mots} mots écrits ; ${PAGE_MOTS_MAX} au plus par page.` });
    }
    const lignesMax = estGabarit(fiche) ? PAGE_LIGNES_MAX_GABARIT : PAGE_LIGNES_MAX;
    if (p.lignes > lignesMax && !p.lignesSignale) {
      p.lignesSignale = true;
      res.push({ sceneId: s.id, detail: `la page ${s.page} compte ${p.lignes} lignes ; ${lignesMax} au plus par page.` });
    }
  }
  try {
    (contexte.mettreEnPage ?? mettreEnPage)(fiche);
  } catch (e) {
    if (!(e instanceof ErreurMiseEnPage)) throw e;
    const derniere = fiche.scenes.filter((s) => s.page === e.page).at(-1);
    // Style « reference/1 » : la mise en page dit quoi raccourcir (aucune bande de sous-titres, taille fixe du style).
    if (estRef(fiche)) res.push({ sceneId: /scène (s\d+)/.exec(e.message)?.[1] ?? derniere?.id, detail: e.message.replace(/^Page \d+ · scène s\d+ · /, `page ${e.page} : `) });
    else res.push({ sceneId: derniere?.id, detail: `la page ${e.page} ne tient pas à l'écran au-dessus des sous-titres, même réduite jusqu'à la taille plancher (3 % de la hauteur).` });
  }
  return res;
}

/**
 * Style « blocs/2 » : un écran (une scène) lisible — 40 mots et 6 lignes écrites au plus (éléments de liste à part,
 * 6 au plus par le schéma), et la mise en page des écrans réussit (chaque écran tient dans la zone sûre au-dessus des
 * sous-titres, ses titres défilent au besoin, jamais un mot coupé).
 */
function regleEcranLisible(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const res: Manquement[] = [];
  for (const s of fiche.scenes) {
    const n = textesScene(s).reduce((t, x) => t + mots(x).length, 0);
    if (n > PAGE_MOTS_MAX) res.push({ sceneId: s.id, detail: `l'écran compte ${n} mots écrits ; ${PAGE_MOTS_MAX} au plus.` });
    const l = s.elements.filter((e) => e.type === "ligne").length;
    if (l > PAGE_LIGNES_MAX) res.push({ sceneId: s.id, detail: `l'écran compte ${l} lignes ; ${PAGE_LIGNES_MAX} au plus.` });
  }
  try {
    (contexte.mettreEnPage ?? mettreEnPage)(fiche);
  } catch (e) {
    if (!(e instanceof ErreurMiseEnPage)) throw e;
    const id = /scène (s\d+)/.exec(e.message)?.[1];
    res.push({ sceneId: id ?? fiche.scenes.filter((s) => s.page === e.page).at(-1)?.id, detail: `l'écran ne tient pas dans la zone sûre au-dessus des sous-titres : ${e.message.replace(/^Page \d+ · scène s\d+ · /, "")}` });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 5 : taille du texte                                             */
/* ------------------------------------------------------------------ */

export function regleTailleTexte(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  // Style « reference/1 » : une seule taille, celle du style (40 px de référence, jamais moins de 36) ; la taille réelle
  // est contrôlée sur la mise en page (contrôle de l'image « Taille du texte »).
  if (estRef(fiche)) return [];
  const mise = miseDe(contexte);
  const min = TAILLE_TEXTE_MIN_FRACTION * mise.hauteurImagePx;
  const res: Manquement[] = [];
  const signales = new Set<NiveauLigne>();
  for (const s of fiche.scenes) {
    for (const e of s.elements) {
      const niveau: NiveauLigne | undefined = e.type === "ligne" ? e.niveau : textesEcrits(e).length ? "texte" : undefined;
      if (!niveau || signales.has(niveau) || mise.taillePx[niveau] >= min) continue;
      signales.add(niveau);
      res.push({
        sceneId: s.id,
        detail: `le texte de niveau « ${niveau} » est prévu à ${mise.taillePx[niveau]} px ; ${Math.ceil(min)} px au moins (3 % de la hauteur de l'image).`,
      });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 6 : une forme en plus de la couleur                             */
/* ------------------------------------------------------------------ */

export function regleFormeEnPlusDeLaCouleur(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const formes: Readonly<Partial<Record<RoleLigne, FormeRole>>> = contexte.formesParRole ?? FORMES_PAR_ROLE;
  const res: Manquement[] = [];
  const vus = new Map<RoleLigne, string>();
  const parForme = new Map<string, RoleLigne>();
  for (const s of fiche.scenes) {
    for (const e of s.elements) {
      if (e.type !== "ligne" || vus.has(e.role)) continue;
      const f = formes[e.role];
      if (!f?.forme) {
        vus.set(e.role, "");
        res.push({ sceneId: s.id, detail: `le rôle « ${e.role} » n'a qu'une couleur ; il lui faut aussi une forme (pictogramme, cadre ou soulignement).` });
        continue;
      }
      const cle = `${f.forme.type}:${f.forme.nom ?? ""}`;
      vus.set(e.role, cle);
      const autre = parForme.get(cle);
      if (autre) {
        res.push({ sceneId: s.id, detail: `les rôles « ${autre} » et « ${e.role} » ont la même forme ; seule la couleur les distinguerait.` });
      } else parForme.set(cle, e.role);
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 7 : chiffres sourcés                                            */
/* ------------------------------------------------------------------ */

const CHIFFRE = /\p{Nd}/u;

/**
 * Pages d'un EXEMPLE ILLUSTRATIF (décision par défaut du 16/10/2026, vidéo d'essai v-667edcd8e3a8) : page de l'exemple
 * qui porte la mention « Exemple illustratif ». Les chiffres que la voix y dit s'écrivent (la mention, toujours
 * visible sur la page, dit qu'ils sont inventés) : `chiffres` = ceux que la voix dit sur la page (en chiffres et en
 * lettres, clés sans accent).
 * L'exemple se lit par PARTIE (scènes d'exemple qui se suivent) : quand une page de plus (`pagesDuStyle`) sépare
 * « Avant / Maintenant » de la scène qui porte la mention, la page suivante reste un exemple (brouillon
 * v-874530b87628, 17/10/2026).
 */
export function pagesExempleIllustratif(fiche: FicheTableau): Map<number, Set<string>> {
  const res = new Map<number, Set<string>>();
  const estExemple = (s: SceneTableau) => s.gabarit?.role === "exemple" || s.role === "exemple";
  const parties: SceneTableau[][] = [];
  fiche.scenes.forEach((s, i) => {
    if (!estExemple(s)) return;
    if (i > 0 && estExemple(fiche.scenes[i - 1]) && parties.length) parties[parties.length - 1].push(s);
    else parties.push([s]);
  });
  const avecMention = (partie: SceneTableau[]) => {
    const pages = new Set(partie.map((s) => s.page));
    return fiche.scenes.some((x) => pages.has(x.page) && x.elements.some((e) => e.type === "mention"));
  };
  for (const s of parties.filter(avecMention).flat()) {
    const dits = res.get(s.page) ?? new Set<string>();
    for (const x of fiche.scenes.filter((y) => y.page === s.page)) {
      for (const m of x.texteDit.split(/\s+/)) dits.add(cleMot(m));
      // Nombre composé dit en lettres (« vingt-deux heures » → 22) : brouillon v-693abee466e1, 18/10/2026.
      for (const n of nombresDits(x.texteDit)) dits.add(n);
    }
    res.set(s.page, dits);
  }
  return res;
}

const LETTRES_CHIFFRES: Readonly<Record<string, string>> = { "2": "deux", "3": "trois", "4": "quatre", "5": "cinq", "6": "six", "7": "sept", "8": "huit", "9": "neuf", "10": "dix", "11": "onze", "12": "douze", "15": "quinze", "20": "vingt", "30": "trente", "40": "quarante", "50": "cinquante", "60": "soixante", "100": "cent" };

export function regleChiffresSources(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const sources = new Set(contexte.sourcesChiffres);
  const exemples = pagesExempleIllustratif(fiche);
  const res: Manquement[] = [];
  for (const s of fiche.scenes) {
    const aChiffre = s.elements.some((e) => e.type === "chiffre");
    // Exemple illustratif : un chiffre écrit est permis s'il est dit sur la page (en chiffres ou en lettres).
    const dits = exemples.get(s.page);
    const ditSurLaPage = (t: string) => !!dits && (t.match(/\p{Nd}+/gu) ?? []).every((c) => dits.has(c) || dits.has(LETTRES_CHIFFRES[c] ?? "\u0000"));
    for (const e of s.elements) {
      if (e.type === "chiffre" && !sources.has(e.sourceId)) {
        res.push({ sceneId: s.id, detail: `le chiffre « ${e.valeur} » cite la source « ${e.sourceId} », inconnue.` });
      }
      // Un décompte annoncé (« 3 étapes », « 3 réflexes ») n'est pas un chiffre à sourcer (vidéo v-b2d772d28b97).
      if (e.type === "ligne" && !aChiffre && CHIFFRE.test(sansDecomptes(e.texte)) && !ditSurLaPage(e.texte)) {
        res.push({ sceneId: s.id, detail: `la ligne « ${e.texte} » contient un chiffre sans élément chiffre sourcé dans la scène.` });
      }
    }
    for (const t of textesEcransScene(s)) {
      if (!aChiffre && CHIFFRE.test(t)) res.push({ sceneId: s.id, detail: `l'élément de liste « ${t} » contient un chiffre sans élément chiffre sourcé dans la scène.` });
    }
    // Style « reference/3 » (peps) : le chiffre d'un visuel ou d'un bloc orange suit la même règle : un élément chiffre
    // sourcé dans la scène (il est alors montré par le visuel ou le bloc, pas écrit une seconde fois).
    for (const t of textesPeps(s)) {
      if (!aChiffre && CHIFFRE.test(t)) res.push({ sceneId: s.id, detail: `« ${t} » (visuel ou bloc orange) contient un chiffre sans élément chiffre sourcé dans la scène.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 8 : exemple illustratif signalé                                 */
/* ------------------------------------------------------------------ */

/** Mot à majuscule au milieu d'une phrase : sans doute un prénom ou un nom (repérage prudent). */
function contientNomPropre(texte: string): boolean {
  const morceaux = texte.split(/\s+/).filter(Boolean);
  return morceaux.some((m, i) => i > 0 && /^[«"“(]?\p{Lu}\p{Ll}/u.test(m) && !/[.!?…]$/.test(morceaux[i - 1]));
}

export function regleExempleIllustratif(fiche: FicheTableau): Manquement[] {
  const res: Manquement[] = [];
  for (const s of fiche.scenes) {
    if (s.role !== "exemple" || s.elements.some((e) => e.type === "mention")) continue;
    const textes = [s.texteDit, ...s.elements.flatMap(textesEcrits)];
    const chiffre = s.elements.some((e) => e.type === "chiffre") || textes.some((t) => CHIFFRE.test(t));
    const nom = textes.some(contientNomPropre);
    if (chiffre || nom) {
      res.push({ sceneId: s.id, detail: `cet exemple porte ${chiffre ? "des chiffres" : "un prénom ou un nom"} : il lui faut la mention « Exemple illustratif ».` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 9 : preuve validée à l'écran                                    */
/* ------------------------------------------------------------------ */

function etatPreuve(preuveId: string, contexte: ContexteTableau): string | null {
  const matiere = contexte.matieres.find((m) => m.id === preuveId);
  const preuve = contexte.preuves.find((p) => p.id === preuveId);
  if (matiere && matiere.type !== "demonstration" && !preuve) return `la matière « ${preuveId} » n'est pas une démonstration`;
  const x = matiere?.type === "demonstration" ? matiere : preuve;
  if (!x) return `la preuve « ${preuveId} » est inconnue`;
  if (utilisable(x, contexte.aujourdhui)) return null;
  if (x.perimeLe && x.perimeLe <= contexte.aujourdhui) return `la preuve « ${preuveId} » est périmée depuis le ${x.perimeLe}`;
  if (x.statut !== "validee") return `la preuve « ${preuveId} » n'est pas validée`;
  return `la preuve « ${preuveId} » est retirée ou archivée`;
}

export function reglePreuveValidee(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const res: Manquement[] = [];
  let bonne = false;
  for (const s of fiche.scenes) {
    for (const e of s.elements) {
      if (e.type !== "preuve") continue;
      const etat = etatPreuve(e.preuveId, contexte);
      if (etat) res.push({ sceneId: s.id, detail: `${etat} ; seule une preuve validée et non périmée s'affiche.` });
      else if (s.role === "preuve") bonne = true;
    }
  }
  if (!bonne && !res.length) {
    res.push({ detail: "aucune scène « preuve » ne montre une preuve validée et non périmée ; une vidéo montre sa preuve à l'écran." });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 10 : douleur en tête                                            */
/* ------------------------------------------------------------------ */

export function regleDouleurEnTete(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const s = fiche.scenes[0];
  const res: Manquement[] = [];
  if (!fiche.douleur.trim()) res.push({ sceneId: s?.id, detail: "la douleur est absente." });
  if (!fiche.gesteMinute.trim()) res.push({ sceneId: s?.id, detail: "le geste de la minute est absent." });
  if (!s || res.length) return res;
  const cles = clesDouleur(fiche, contexte);
  const cherches = listeMots(motsDouleurCherches(fiche, contexte));
  // Texte dit de Will : pris à l'identique, la voix n'est pas contrôlée (seuls les mots écrits le sont).
  const dits = contexte.texteDeWill ? null : clesDitesAuDebut(fiche, contexte, DEBUT_DOULEUR_MS);
  if (dits && dits.length < MOTS_CLES_DOULEUR_MIN) {
    res.push({
      sceneId: s.id,
      detail: `aucun mot de la douleur n'est dit dans les ${DEBUT_DOULEUR_MS / 1000} premières secondes : faites dire, dès le début de la première scène, un des mots ${cherches} (ou changez les mots de la douleur pour ceux que l'accroche dit).`,
    });
  }
  const ecrits = clesPresentes(s.elements.flatMap(textesEcrits).join(" "), cles);
  if (ecrits.length < MOTS_CLES_DOULEUR_MIN) {
    res.push({ sceneId: s.id, detail: `aucun mot de la douleur n'est écrit dans la première scène : écrivez dans une de ses lignes un des mots ${cherches}.` });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 11 : dessins de la banque, droits valides                       */
/* ------------------------------------------------------------------ */

export function regleDessinsAutorises(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const valide = contexte.dessinValide ?? dessinValideBanque;
  const res: Manquement[] = [];
  for (const s of fiche.scenes) {
    for (const e of s.elements) {
      if (e.type === "dessin" && !valide(e.dessinId, contexte.aujourdhui)) {
        res.push({ sceneId: s.id, detail: `le dessin « ${e.dessinId} » n'est pas dans la banque ou n'a pas de droit valide au registre.` });
      }
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 12 : aucune phrase d'appel                                      */
/* ------------------------------------------------------------------ */

/**
 * La scène de la page d'appel (celle au gabarit « appel », à défaut la dernière, comme la mise en page). Une page
 * regroupe plusieurs scènes (champ `page` partagé) : toutes les scènes de cette page sont « sur la page d'appel ».
 */
function scenesDeLaPageAppel(fiche: FicheTableau): Set<SceneTableau> {
  const sceneAppel = [...fiche.scenes].reverse().find((s) => s.gabarit?.role === "appel") ?? fiche.scenes[fiche.scenes.length - 1];
  return new Set(sceneAppel ? fiche.scenes.filter((s) => s.page === sceneAppel.page) : []);
}

/**
 * Une ligne écrite qui est la question sur l'IA, sous sa forme exacte OU raccourcie (« L'IA peut-elle vous aider ? ») :
 * l'une des formulations validées (sans son « ? »), ou « IA » avec faire / peut / aide* / servir / sert / « pour vous », posée
 * avec un « ? » (ou « peut-elle »). Sur toute scène de la page d'appel (`surPageAppel`), toute ligne écrite qui finit
 * par « ? » est refusée : l'appel n'a pas de question écrite. Ailleurs, une accroche comme « Vos réponses d'IA sont
 * vagues ? » reste permise.
 */
function questionIaEcrite(texte: string, surPageAppel: boolean): boolean {
  if (QUESTIONS_IA.some((q) => contientExpression(texte, q.replace(/\s*\?$/, "")))) return true;
  const t = texteCompare(texte);
  const interroge = /\?\s*$/.test(texte.trim());
  if (surPageAppel && interroge) return true;
  const racines = /\b(faire|peut|peuvent|aide\w*|aider|servir|sert)\b|pour vous/.test(t);
  const pose = interroge || /\b(peut|peuvent)[- ](elle|il|ils|elles)\b/.test(t);
  return /\bia\b/.test(t) && racines && pose;
}

export function regleSansAppel(fiche: FicheTableau, contexte?: Pick<ContexteTableau, "texteDeWill">): Manquement[] {
  const res: Manquement[] = [];
  const pageAppel = scenesDeLaPageAppel(fiche);
  for (const s of fiche.scenes) {
    // La question sur l'IA (Will, 18/10) est dite, jamais écrite : pas même sur la page d'appel, ni raccourcie.
    // Les lignes d'une preuve citent mot pour mot le résultat testé : elles ne sont pas contrôlées (comme la règle 13).
    const ecrits = [...s.elements.filter((e) => e.type !== "preuve").flatMap(textesEcrits), ...textesEcransScene(s), ...textesPeps(s)];
    const ecrite = ecrits.find((t) => questionIaEcrite(t, pageAppel.has(s)));
    if (ecrite) res.push({ sceneId: s.id, detail: `la question sur l'IA « ${ecrite} » est écrite ; elle est dite, jamais écrite à l'écran.` });
    // Style « blocs/2 » : l'écran d'appel de la dernière scène dit et écrit l'appel (« Écrivez CINQ en commentaire »).
    if (sceneAppelPermis(fiche, s)) continue;
    // Texte dit de Will (`texteDeWill`) : pris à l'identique, seuls les textes écrits sont contrôlés (comme la règle 13).
    const textes = [...(contexte?.texteDeWill ? [] : [s.texteDit]), ...textesScene(s)];
    const trouvees = PHRASES_APPEL.filter((p) => textes.some((t) => contientExpression(t, p)));
    if (trouvees.length) {
      res.push({ sceneId: s.id, detail: `phrase d'appel « ${trouvees[0]} » ; l'appel est une pièce à part, jamais écrite dans les scènes.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 13 : contrôles du script repassés sur les textes écrits et dits */
/* ------------------------------------------------------------------ */

/** Le nom de l'entreprise, quelle que soit sa graphie (« Axion-IA », « Axion IA », « AxionIA », « axion-ia.com »). */
const NOM_ECRIT = /\baxion/i;

/**
 * AXION-IA À L'ÉCRAN (Will, 18/10) : le nom n'est JAMAIS écrit ailleurs que sur la page d'appel validée (la dernière
 * page : la phrase en grand, le bouton, le site ; `mise-en-page-v3.ts`). Le texte dit est contrôlé par le rédacteur.
 */
export function regleNomEcritHorsAppel(fiche: FicheTableau): Manquement[] {
  const res: Manquement[] = [];
  // La page d'appel : la scène au gabarit « appel » ; à défaut, la dernière (comme la mise en page).
  // Une page regroupe plusieurs scènes (champ `page` partagé) : toute scène de cette page est exemptée.
  const pageAppel = scenesDeLaPageAppel(fiche);
  for (const s of fiche.scenes) {
    if (pageAppel.has(s)) continue;
    // Les lignes d'une preuve citent mot pour mot le résultat testé (comme la règle 13) : elles ne sont pas contrôlées.
    const ecrits = [...s.elements.filter((e) => e.type !== "preuve").flatMap(textesEcrits), ...textesEcransScene(s), ...textesPeps(s)];
    const t = ecrits.find((x) => NOM_ECRIT.test(x));
    if (t) res.push({ sceneId: s.id, detail: `« ${t} » écrit le nom Axion-IA : il n'est écrit que sur la page d'appel, à la fin.` });
  }
  return res;
}

export function regleControlesScript(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const res: Manquement[] = [...regleNomEcritHorsAppel(fiche)];
  const interdits = (contexte.interdits ?? []).filter((i) => i.regex);
  for (const s of fiche.scenes) {
    // Les lignes d'une preuve citent mot pour mot le résultat testé : comme une citation, elles ne sont pas contrôlées.
    const ecrits = [...s.elements.filter((e) => e.type !== "preuve").flatMap(textesEcrits), ...textesEcransScene(s), ...textesPeps(s)];
    // Le texte dit est le script validé, repris mot pour mot (le contrôle du script, C42, a sa propre comparaison) :
    // un brouillon déjà payé ne doit pas basculer en refus. Mots interdits de la marque et interdits de Will ne visent
    // donc que les textes écrits ; seuls le tutoiement et les mots de temps sont contrôlés aussi sur la voix, sauf si le texte
    // dit est celui de Will (`texteDeWill`) : pris à l'identique, la voix n'est pas contrôlée.
    const controler = (t: string, ecrit: boolean) => {
      if (!ecrit && contexte.texteDeWill) return;
      if (formesAdresse(t).tu) res.push({ sceneId: s.id, detail: `« ${t} » tutoie ; le format vouvoie.` });
      const motsInterdits = ecrit ? (contexte.motsInterdits ?? []) : [];
      for (const m of [...MOTS_TEMPS_INTERDITS, ...motsInterdits]) {
        if (contientExpression(t, m)) res.push({ sceneId: s.id, detail: `« ${t} » contient le mot interdit « ${m} ».` });
      }
      if (!ecrit) return;
      for (const i of appliquerInterdits(t, interdits)) {
        res.push({ sceneId: s.id, detail: `« ${t} » enfreint un interdit de Will : ${i.texte} (« ${i.extrait} »).` });
      }
    };
    controler(s.texteDit, false);
    for (const t of ecrits) controler(t, true);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 14 : durée                                                      */
/* ------------------------------------------------------------------ */

export function regleDureeMaximale(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const ts = tempsScenes(fiche, debitDe(contexte));
  const fin = ts[ts.length - 1]?.finMs ?? 0;
  if (fin <= DUREE_MAX_MS) return [];
  const depasse = ts.find((t) => t.finMs > DUREE_MAX_MS);
  const enTrop = Math.ceil(((fin - DUREE_MAX_MS) / 1000) * debitDe(contexte));
  return [
    {
      sceneId: depasse?.scene.id,
      detail: `la vidéo durerait environ ${secondes(fin)} ; ${DUREE_MAX_MS / 1000} s au plus (dépassé dans cette scène) : raccourcissez le texte dit d'au moins ${pluriel(enTrop, "caractère")} (environ ${pluriel(Math.max(1, Math.round(enTrop / 6)), "mot")}).`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Règle 15 : série sans numéro                                          */
/* ------------------------------------------------------------------ */

export function regleSansNumeroEpisode(fiche: FicheTableau, contexte?: Pick<ContexteTableau, "texteDeWill">): Manquement[] {
  const res: Manquement[] = [];
  const numerote = (t: string) => MOTIF_NUMERO.test(texteCompare(t)) || MOTIF_NUMERO_BRUT.test(t);
  if (numerote(fiche.serie.nom) || numerote(fiche.serie.code)) {
    res.push({ sceneId: fiche.scenes[0]?.id, detail: `la série « ${fiche.serie.nom} » porte un numéro ; les séries n'en ont jamais.` });
  }
  for (const s of fiche.scenes) {
    const t = [...(contexte?.texteDeWill ? [] : [s.texteDit]), ...textesScene(s)].find(numerote);
    if (t) res.push({ sceneId: s.id, detail: `« ${t} » cite un numéro d'épisode ou une suite ; chaque vidéo se suffit à elle-même.` });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 16 : du rythme                                                  */
/* ------------------------------------------------------------------ */

interface Moment {
  ms: number;
  duree: number;
  /** Événement visuel (dessin tracé, mot marqué, page tournée…) ou simple écriture. */
  evenement: boolean;
}

/** Moments où le stylo bouge, sur la fiche calée ou estimée. */
export function momentsDuStylo(fiche: FicheTableau, debit = CARACTERES_PAR_SECONDE): { moments: Moment[]; finMs: number } {
  const ts = tempsScenes(fiche, debit);
  const moments: Moment[] = [];
  const v2 = estV2(fiche);
  const lignesEvenements = styleRecent(fiche);
  ts.forEach((t, i) => {
    // Style « blocs/2 » : chaque scène ouvre un écran ; un second écran, chaque élément de liste sont des événements.
    if (v2) {
      if (i > 0) moments.push({ ms: t.debutMs, duree: DUREES_TRACE_MS.pageTournee, evenement: true });
      for (const [k, ec] of (t.scene.ecrans ?? []).entries()) {
        if (k > 0) moments.push({ ms: instantAncre(t, ec.ancre ?? 0), duree: DUREES_TRACE_MS.pageTournee, evenement: true });
        for (const it of ec.liste ?? []) moments.push({ ms: instantAncre(t, it.ancre), duree: DUREES_TRACE_MS.geste, evenement: true });
      }
    } else if (i > 0 && t.scene.page !== ts[i - 1].scene.page) moments.push({ ms: t.debutMs, duree: DUREES_TRACE_MS.pageTournee, evenement: true });
    // Style « reference/2 » : la pastille numérotée s'écrit au mot où la voix dit le numéro.
    if (t.scene.gabarit?.numero && estGabarit(fiche)) moments.push({ ms: instantAncre(t, t.scene.gabarit.numero.ancre), duree: DUREES_TRACE_MS.geste, evenement: true });
    // Style « reference/3 » (peps) : le visuel se dessine (à son mot, sinon après les lignes de la scène), le bloc orange
    // apparaît en rebond : deux événements visibles.
    const visuel = t.scene.gabarit?.visuel;
    if (visuel) moments.push({ ms: instantAncre(t, visuel.ancre ?? Math.max(0, ...t.scene.elements.map((e) => (e.type === "ligne" ? e.ancre : 0)))), duree: DUREES_TRACE_MS.dessin, evenement: true });
    if (t.scene.gabarit?.bloc) moments.push({ ms: instantAncre(t, t.scene.gabarit.bloc.ancre ?? 0), duree: DUREES_TRACE_MS.geste, evenement: true });
    for (const e of t.scene.elements) {
      const ms = instantAncre(t, ancreDe(e));
      // Style « blocs/2 » : une ligne entre à l'écran (glisse ou claque) : c'est un changement visible.
      // Style « reference/1 » : le crayon écrit le bloc, c'est aussi un événement visible.
      if (e.type === "ligne") moments.push({ ms, duree: DUREES_TRACE_MS.ligne, evenement: lignesEvenements || !!e.marque });
      else if (e.type === "dessin") moments.push({ ms, duree: DUREES_TRACE_MS.dessin, evenement: true });
      else if (e.type === "chiffre") moments.push({ ms, duree: DUREES_TRACE_MS.chiffre, evenement: true });
      else if (e.type === "preuve") moments.push({ ms, duree: DUREES_TRACE_MS.preuve * e.lignes.length, evenement: true });
      else if (e.type === "geste") moments.push({ ms, duree: DUREES_TRACE_MS.geste, evenement: true });
    }
  });
  moments.sort((a, b) => a.ms - b.ms);
  // Style « blocs/2 », fiche calée : l'écran de fin tenu après la voix n'est pas compté (il reste vivant de lui-même).
  const fin = ts[ts.length - 1];
  const tenue = lignesEvenements && fin?.scene.finMs !== undefined ? TENUE_FIN_TOTALE_MS : 0;
  return { moments, finMs: Math.max(fin ? fin.debutMs : 0, (fin?.finMs ?? 0) - tenue) };
}

/** Scène qui contient l'instant `ms`. */
function sceneA(ts: TempsScene[], ms: number): string | undefined {
  return (ts.find((t) => ms < t.finMs) ?? ts[ts.length - 1])?.scene.id;
}

/** Un trou du rythme : aucun événement visuel de `deMs` à `aMs` (plus de `ECART_EVENEMENT_MAX_MS`), dans la scène dite. */
export interface TrouRythme {
  sceneId: string | undefined;
  deMs: number;
  aMs: number;
}

/** Les trous du rythme (règle 16), au débit donné. Lu par la règle et par la réparation automatique (`rythme.ts`). */
export function trousRythme(fiche: FicheTableau, debit = CARACTERES_PAR_SECONDE): TrouRythme[] {
  const ts = tempsScenes(fiche, debit);
  const { moments, finMs } = momentsDuStylo(fiche, debit);
  const res: TrouRythme[] = [];
  let dernier = 0;
  for (const ms of [...moments.filter((m) => m.evenement).map((m) => m.ms), finMs]) {
    if (ms - dernier > ECART_EVENEMENT_MAX_MS) res.push({ sceneId: sceneA(ts, dernier + ECART_EVENEMENT_MAX_MS), deMs: dernier, aMs: ms });
    dernier = Math.max(dernier, ms);
  }
  return res;
}

/** Ancres où une ligne ajoutée dans la scène `i` se verrait (style « blocs/2 » : jamais sous l'écran d'appel ou du site). */
function ancresVisibles(fiche: FicheTableau, i: number): number[] {
  const s = fiche.scenes[i];
  const n = mots(s.texteDit).length;
  const appel = estV2(fiche) ? (s.ecrans ?? []).findIndex((e) => e.moment === "appel") : -1;
  const limite = appel < 0 ? n : appel === 0 ? 0 : (s.ecrans![appel].ancre ?? 0);
  return Array.from({ length: Math.min(n, limite) }, (_, a) => a);
}

/**
 * Essais d'un trou sur les instants des événements (même parcours que `trousRythme`) : vrai si, avec les instants
 * `ajouts` en plus (et l'instant `retire` en moins), plus aucun silence ne touche l'intervalle du trou.
 */
function essaiTrou(evenements: readonly number[], finMs: number, trou: TrouRythme) {
  return (ajouts: readonly number[], retire?: number): boolean => {
    const liste = [...evenements];
    if (retire !== undefined) liste.splice(liste.indexOf(retire), 1);
    let dernier = 0;
    for (const ms of [...liste, ...ajouts].sort((x, y) => x - y).concat(finMs)) {
      if (ms - dernier > ECART_EVENEMENT_MAX_MS && dernier < trou.aMs && ms > trou.deMs) return false;
      dernier = Math.max(dernier, ms);
    }
    return true;
  };
}

/**
 * Ce que Will peut faire d'un trou qui reste dans la scène, VÉRIFIÉ avant d'être conseillé (blocage réel du 14/10 : on
 * lui conseillait d'ajouter une ligne dans une scène où l'écran du site cachait tout, ce qui ne pouvait pas réussir).
 * Chaque geste est essayé sur les instants de la fiche : ajouter des lignes écrites ou des gestes là où ils se voient
 * (6 éléments au plus), couper la scène à une fin de phrase (10 scènes au plus ; jamais une scène d'appel : la scène
 * suivante ouvre un écran ou tourne la page), remplacer un élément par une ligne au moment du silence. Seuls ceux qui
 * comblent le silence sont proposés ; aucun : la phrase dit pourquoi.
 */
function quoiFaireRythme(fiche: FicheTableau, trou: TrouRythme, debit: number, evenements: readonly number[], finMs: number): string {
  const i = fiche.scenes.findIndex((s) => s.id === trou.sceneId);
  const s = fiche.scenes[i];
  if (!s) return "";
  const n = i + 1;
  const t = tempsScenes(fiche, debit)[i];
  const essai = essaiTrou(evenements, finMs, trou);
  // Instants où un ajout se verrait, dans le silence (un ajout ailleurs ne peut pas le combler).
  const dansLeSilence = (a: number) => instantAncre(t, a) > trou.deMs && instantAncre(t, a) < trou.aMs;
  const ancres = ancresVisibles(fiche, i).filter(dansLeSilence);
  // Ajouts : le moins de lignes possible, chacune le plus tard possible à 4 s au plus de l'événement d'avant.
  let lignes: number | null = null;
  const libres = bornesFicheTableau(fiche).elementsMax - s.elements.length;
  const ajouts: number[] = [];
  for (let k = 1; k <= libres && ancres.length; k++) {
    const depuis = Math.max(trou.deMs, ...ajouts);
    const portee = ancres.map((a) => instantAncre(t, a)).filter((ms) => ms > depuis && ms - depuis <= ECART_EVENEMENT_MAX_MS);
    if (!portee.length) break;
    ajouts.push(Math.max(...portee));
    if (essai(ajouts)) {
      lignes = k;
      break;
    }
  }
  const ajout = lignes === null ? "" : lignes === 1 ? `ajoutez une ligne écrite ou un geste dans la scène ${n}` : `ajoutez ${lignes} lignes écrites ou gestes dans la scène ${n}`;
  const coupable = fiche.scenes.length < bornesFicheTableau(fiche).scenesMax && !(s.ecrans ?? []).some((e) => e.moment === "appel");
  const coupe = coupable && debutsDePhrase(s.texteDit).some((a) => ancres.includes(a) && essai([instantAncre(t, a)])) ? `coupez la scène ${n} en deux à une fin de phrase` : "";
  const conseils = [ajout, coupe].filter(Boolean);
  if (conseils.length) {
    const phrase = conseils.join(", ou ");
    return ` ${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  }
  const v2 = estV2(fiche);
  const instantsElements = s.elements.flatMap((e) => (e.type === "mention" ? [] : [{ ms: instantAncre(t, e.ancre), evenement: e.type !== "ligne" || styleRecent(fiche) || !!e.marque }]));
  const remplace = instantsElements.some((e) => ancres.some((a) => essai([instantAncre(t, a)], e.evenement ? e.ms : undefined)));
  if (remplace) return ` Remplacez un élément de la scène ${n} par une ligne écrite au moment du silence.`;
  return ` Aucune ligne ajoutée ni coupe dans la scène ${n} ne comblerait ce silence : ${v2 && ancresVisibles(fiche, i).length < t.mots.length ? "l'écran de fin y couvre ce qui est dit" : "son texte dit est trop long pour ce qu'elle montre"}.`;
}

export function regleRythme(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const debit = debitDe(contexte);
  const ts = tempsScenes(fiche, debit);
  const { moments, finMs } = momentsDuStylo(fiche, debit);
  const evenements = moments.filter((m) => m.evenement).map((m) => m.ms);
  const res: Manquement[] = trousRythme(fiche, debit).map((t) => ({
    sceneId: t.sceneId,
    detail: `aucun événement visuel entre ${secondes(t.deMs)} et ${secondes(t.aMs)} ; un toutes les ${ECART_EVENEMENT_MAX_MS / 1000} s au moins.${quoiFaireRythme(fiche, t, debit, evenements, finMs)}`,
  }));

  // Style « blocs/2 » : le crayon n'écrit pas les lignes (elles entrent seules) ; au repos, il bouge à peine, et l'écran
  // change au moins toutes les 1,7 s (relances du plan d'animation, contrôlées par ses tests).
  // Style « reference/1 » : entre deux blocs, le crayon glisse puis reste en l'air en tremblant (jamais figé).
  if (styleRecent(fiche)) return res;
  let bouge = 0;
  for (const m of [...moments, { ms: finMs, duree: 0, evenement: false }]) {
    if (m.ms - bouge > IMMOBILITE_STYLO_MAX_MS) {
      res.push({ sceneId: sceneA(ts, bouge + IMMOBILITE_STYLO_MAX_MS), detail: `le stylo reste immobile de ${secondes(bouge)} à ${secondes(m.ms)} ; ${IMMOBILITE_STYLO_MAX_MS / 1000} s au plus.` });
    }
    bouge = Math.max(bouge, m.ms + m.duree);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Règle 17 : geste fort sur la douleur dès le début                     */
/* ------------------------------------------------------------------ */

export function regleGesteFortDouleur(fiche: FicheTableau, contexte: ContexteTableau): Manquement[] {
  const ts = tempsScenes(fiche, debitDe(contexte));
  const premiere = ts[0];
  if (!premiere) return [];
  const cles = clesDouleur(fiche, contexte);
  const cherches = listeMots(motsDouleurCherches(fiche, contexte));
  const res: Manquement[] = [];

  const lignesDouleur = new Map<string, boolean>();
  for (const t of ts) for (const e of t.scene.elements) if (e.type === "ligne") lignesDouleur.set(e.id, clesPresentes(e.texte, cles).length > 0);

  const tot = (t: TempsScene, e: ElementTableau) => instantAncre(t, ancreDe(e)) < DEBUT_DOULEUR_MS;
  const fort = ts.some((t) =>
    t.scene.elements.some(
      (e) =>
        tot(t, e) &&
        ((e.type === "geste" && GESTES_FORTS.includes(e.geste) && lignesDouleur.get(e.cibleId)) ||
          (e.type === "ligne" && !!e.marque && MARQUES_FORTES.includes(e.marque) && lignesDouleur.get(e.id))),
    ),
  );
  if (!fort) {
    res.push({
      sceneId: premiere.scene.id,
      detail: `aucun geste fort (entourer, barrer) sur un mot de la douleur dans les ${DEBUT_DOULEUR_MS / 1000} premières secondes : entourez ou barrez, au début de la première scène, une ligne qui écrit un des mots ${cherches}.`,
    });
  }
  // Texte dit de Will : pris à l'identique, la voix n'est pas contrôlée (le geste fort, lui, reste exigé).
  if (!contexte.texteDeWill && clesDitesAuDebut(fiche, contexte, DEBUT_DOULEUR_MS).length < MOTS_CLES_DOULEUR_MIN) {
    res.push({ sceneId: premiere.scene.id, detail: `aucun mot de la douleur n'est dit dans les ${DEBUT_DOULEUR_MS / 1000} premières secondes, le geste fort n'a rien à souligner : faites dire un des mots ${cherches} dès le début.` });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Références internes des écrans du style « blocs/2 » (avec la règle 1)                                */
/* ------------------------------------------------------------------ */

export const cleSimple = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Écrans cohérents avec la scène : le premier part avec la scène, le second plus tard ; ancres dans le texte dit ;
 * mots forts et mot du commentaire pris dans les lignes de la scène ; étape `n` sur `total`. Champs facultatifs : un
 * champ absent n'est jamais un refus (il prend sa valeur de repli à la mise en page).
 */
export function regleEcrans(fiche: FicheTableau): Manquement[] {
  const res: Manquement[] = [];
  for (const s of fiche.scenes) {
    const ecrans = s.ecrans ?? [];
    if (!ecrans.length) continue;
    const n = mots(s.texteDit).length;
    const motsLignes = new Set(s.elements.flatMap((e) => (e.type === "ligne" ? e.texte.split(/\s+/).map(cleSimple) : [])));
    ecrans.forEach((e, k) => {
      const nom = `l'écran ${k + 1}`;
      if (k === 0 && (e.ancre ?? 0) !== 0) res.push({ sceneId: s.id, detail: `${nom} part avec la scène : son ancre est 0 (ou absente).` });
      if (k > 0 && !((e.ancre ?? 0) > (ecrans[k - 1].ancre ?? 0))) res.push({ sceneId: s.id, detail: `${nom} doit partir après l'écran précédent (ancre plus grande).` });
      if ((e.ancre ?? 0) >= n) res.push({ sceneId: s.id, detail: `${nom} part du mot ${(e.ancre ?? 0) + 1}, mais le texte dit n'a que ${pluriel(n, "mot")}.` });
      for (const it of e.liste ?? []) if (it.ancre >= n) res.push({ sceneId: s.id, detail: `l'élément de liste « ${it.texte} » part du mot ${it.ancre + 1}, mais le texte dit n'a que ${pluriel(n, "mot")}.` });
      for (const m of e.motsForts ?? []) if (!motsLignes.has(cleSimple(m))) res.push({ sceneId: s.id, detail: `le mot fort « ${m} » n'est pas un mot d'une ligne de la scène.` });
      if (e.motCommentaire && !motsLignes.has(cleSimple(e.motCommentaire))) res.push({ sceneId: s.id, detail: `le mot à écrire en commentaire « ${e.motCommentaire} » n'est pas écrit dans une ligne de la scène.` });
      if (e.etape && e.etape.n > e.etape.total) res.push({ sceneId: s.id, detail: `l'étape ${e.etape.n} dépasse le nombre d'étapes (${e.etape.total}).` });
    });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Références internes (complément du schéma)                            */
/* ------------------------------------------------------------------ */

/** Identifiants d'élément uniques dans la fiche ; ancre dans le texte dit ; cible d'un geste dans la même scène. */
export function regleReferencesInternes(fiche: FicheTableau): Manquement[] {
  const res: Manquement[] = [];
  const ids = new Set<string>();
  for (const s of fiche.scenes) {
    const n = mots(s.texteDit).length;
    for (const e of s.elements) {
      if (ids.has(e.id)) res.push({ sceneId: s.id, detail: `l'identifiant d'élément « ${e.id} » est déjà pris.` });
      ids.add(e.id);
      if ("ancre" in e && e.ancre >= n) res.push({ sceneId: s.id, detail: `l'élément « ${e.id} » part du mot ${e.ancre + 1}, mais le texte dit n'a que ${pluriel(n, "mot")}.` });
      if (e.type === "geste" && !s.elements.some((x) => x.id === e.cibleId && x.id !== e.id && x.type !== "geste")) {
        res.push({ sceneId: s.id, detail: `le geste « ${e.id} » vise « ${e.cibleId} », absent de la scène.` });
      }
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Table des règles                                                      */
/* ------------------------------------------------------------------ */

export interface RegleTableau {
  /** Numéro du plan (§ 6.3), pour les tests et la traçabilité ; jamais montré dans un message. */
  numero: number;
  /** Nom en clair, cité dans le message. */
  nom: string;
  verifier: FonctionRegle;
}

export const REGLES_TABLEAU: readonly RegleTableau[] = [
  // Les écrans du style « blocs/2 » (ancres, mots forts, étape) sont des références internes de la scène.
  { numero: 1, nom: "références internes", verifier: (f) => [...regleReferencesInternes(f), ...regleEcrans(f)] },
  { numero: 2, nom: "texte dit mot pour mot", verifier: regleTexteMotPourMot },
  { numero: 3, nom: "accroche courte dès la première image", verifier: regleAccrocheCourte },
  { numero: 4, nom: "page lisible : 40 mots et 6 lignes au plus", verifier: reglePageLisible },
  { numero: 5, nom: "taille du texte", verifier: regleTailleTexte },
  { numero: 6, nom: "une forme en plus de la couleur", verifier: regleFormeEnPlusDeLaCouleur },
  { numero: 7, nom: "chiffres sourcés", verifier: regleChiffresSources },
  { numero: 8, nom: "exemple illustratif signalé", verifier: regleExempleIllustratif },
  { numero: 9, nom: "preuve validée à l'écran", verifier: reglePreuveValidee },
  { numero: 10, nom: "douleur en tête", verifier: regleDouleurEnTete },
  { numero: 11, nom: "dessins de la banque, droits valides", verifier: regleDessinsAutorises },
  { numero: 12, nom: "aucune phrase d'appel", verifier: (f, c) => regleSansAppel(f, c) },
  { numero: 13, nom: "contrôles du script sur les textes écrits et dits", verifier: regleControlesScript },
  { numero: 14, nom: "durée de 90 secondes au plus", verifier: regleDureeMaximale },
  { numero: 15, nom: "série sans numéro", verifier: (f, c) => regleSansNumeroEpisode(f, c) },
  { numero: 16, nom: "du rythme : un événement visuel toutes les 4 secondes", verifier: regleRythme },
  { numero: 17, nom: "geste fort sur la douleur dès le début", verifier: regleGesteFortDouleur },
  { numero: 18, nom: "gabarit de page clair (titre, phrase clé, détails, numéros dits)", verifier: (f) => regleGabarit(f) },
];

/** Règles du format pour la brique commune (`ExtensionFormat.regles`), liées au contexte injecté. */
export function reglesTableau(contexte: ContexteTableau): RegleFormat<ElementTableau>[] {
  return REGLES_TABLEAU.map((r) => ({ nom: r.nom, verifier: (fiche) => r.verifier(fiche as FicheTableau, contexte) }));
}
