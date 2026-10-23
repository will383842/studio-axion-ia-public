/**
 * DÉCOUPAGE AUTOMATIQUE EN SCÈNES DU TABLEAU ANIMÉ (tâche TB-12, plan `02-FORMAT-TABLEAU-ANIME.md` § 4.2 étapes 1 et
 * 2, § 5, § 6 ; risque « découpage par IA qui dérive du script », § 18). PUR : l'appel Claude et le budget sont INJECTÉS.
 *
 * Entrée : texte VALIDÉ du script, structure, série, douleur, geste de la minute, preuves disponibles, banque de dessins
 * (identifiants et mots-clés). Sortie : la fiche de scènes BRUTE (sans calage), validée par `validerFicheTableau`.
 *
 * Déroulé, au plus DEUX appels :
 *  1. coût estimé au PIRE (tarifs du studio) puis réservation par l'outil budget injecté, AVANT l'appel ; refusée →
 *     aucun appel, échec motivé ;
 *  2. UN appel Claude (`roleDecoupageTableau`, modèle d'écriture du studio, jamais un modèle Haiku), même contrat que le
 *     monteur face caméra : le service le branche sur le chemin de dépense existant (`executerRolePourVideo`) ;
 *  3. la réponse (JSON) est lue, contrôlée (champs fixes, dessins et preuves fournis) puis validée par
 *     `validerFicheTableau` (règles 1 à 17, dont le texte dit mot pour mot) ;
 *  4. refusée → UNE relance automatique, avec la liste des refus (étapes 1 à 3) ; encore refusée → échec motivé (refus en
 *     français), la main revient à Will. Jamais de troisième appel.
 * Trois issues distinctes (constat du 12/10 en production) : fiche valide ; fiche REFUSÉE par les règles (liste des
 * règles, et la fiche lisible rendue à part pour être gardée « à corriger » : le travail payé n'est jamais jeté) ;
 * réponse COUPÉE (`stopReason` « max_tokens ») ou illisible. Une réponse coupée n'est JAMAIS rejouée à l'identique :
 * l'échec « tronquee » est rendu tout de suite, sans relance.
 * Rien n'est corrigé en silence, sauf quatre remises en forme déterministes et nommées (`remettreEnForme`), faites aussi
 * à l'enregistrement d'une correction à la main : les mots forts et importants (`normaliserEcrans`), les FORMES
 * (`reparerFormes`, `formes.ts` : ancres ramenées dans le texte dit, identifiants renumérotés, gestes orphelins
 * rattachés, pages remises en ordre), la DENSITÉ (`reparerDensite`, `densite.ts` : scène de plus de 6 éléments coupée à
 * une fin de phrase, page trop chargée passée à une page de plus), puis le RYTHME (`reparerRythme`, `rythme.ts` : ancres redistribuées sur les mots
 * dits, gestes sûrs ajoutés, scène coupée à une fin de phrase). Le texte dit n'est jamais retouché, aucun texte écrit
 * n'est inventé.
 *
 * N'importe aucun fournisseur en direct ni aucun autre moteur ; du générateur, des TYPES seulement.
 */
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { QUESTIONS_IA, type IdPartie, type PartieScript } from "@/domaine/scripts-tableau";
import { MODELE_ECRITURE, jetonsEstimes, pireCasUsd } from "@/fournisseurs/claude/tarifs";
import {
  BORNES_TABLEAU,
  BORNES_ECRAN,
  COTES,
  DESCRIPTIONS_STRUCTURES,
  GABARITS_ECRAN,
  MOMENTS_ECRAN,
  STYLE_BLOCS_2,
  STYLE_PAR_DEFAUT_TABLEAU,
  STYLE_REFERENCE_1,
  STYLE_REFERENCE_2,
  STYLE_REFERENCE_3,
  ROLES_PAGE_3,
  BLOCS_GABARIT,
  BORNES_GABARIT,
  CONSEIL_GABARIT,
  ROLES_PAGE,
  FORMAT_TABLEAU,
  GESTES,
  MARQUES,
  MENTION_EXEMPLE,
  NIVEAUX_LIGNE,
  ROLES_LIGNE,
  ROLES_SCENE_TABLEAU,
  avecStyleTableau,
  cleMot,
  validerFicheTableau,
  type FicheTableau,
  type StructureTableau,
} from "./fiche";
import { styleTableauDe } from "@/briques/tableau-scene/trois-styles/styles";
import { reparerFormes } from "./formes";
import { BORNES_BLOC_3, BORNES_GABARIT_3, CONSEIL_GABARIT_3 } from "./gabarit-3";
import { IDS_VISUELS_3 } from "@/briques/tableau-scene/reference/visuels-3";
import { estPageEcriteCrayon, numerosDits, type RolePage } from "./gabarit";
import { diagnosticPageDePlus, pageTropChargee, reparerDensite, type OptionsDensite, type RetraitAllegement } from "./densite";
import { ECART_VISE_MS, reparerRythme, type ReglagesRythme } from "./rythme";
import { CARACTERES_DITS_MAX_TABLEAU, caracteresEn } from "@/domaine/duree-tableau";
import { cleSimple, REGLES_TABLEAU, ACCROCHE_MOTS_MAX, CARACTERES_PAR_SECONDE, DUREE_MAX_MS, ECART_EVENEMENT_MAX_MS, PAGE_LIGNES_MAX, PAGE_MOTS_MAX, type ContexteTableau } from "./regles";

/* ------------------------------------------------------------------ */
/* Réglages                                                              */
/* ------------------------------------------------------------------ */

/** Appels Claude au plus : le premier et UNE relance (§ 4.2, étape 2). */
export const APPELS_MAX = 2;
/** Libellé de l'étape (dépense rattachée à la vidéo). */
export const ETAPE_DECOUPAGE = "Tableau · découpage en scènes";
/** Préfixe des appels (réservations retrouvables). */
export const PREFIXE_APPEL_DECOUPAGE = "tbdec";
/** Jetons d'entrée ajoutés à l'estimation pour les phrases fixes que le chemin de dépense joint à toute consigne. */
const MARGE_PHRASES_FIXES = 400;

/* ------------------------------------------------------------------ */
/* Contrat                                                               */
/* ------------------------------------------------------------------ */

/** Un dessin de la banque, tel que montré à Claude. */
export interface DessinPropose {
  id: string;
  motsCles: readonly string[];
}

/** Une preuve que la fiche peut montrer (matière « demonstration » ou `Preuve` validée du studio). */
export interface PreuveProposee {
  id: string;
  /** Ce que la preuve montre (Claude en tire 1 ou 2 lignes courtes). */
  resume: string;
}

export interface EntreeDecoupage {
  /** Texte VALIDÉ du script, sans appel : les `texteDit` mis bout à bout doivent le redonner mot pour mot. */
  texteScript: string;
  structure: StructureTableau;
  serie: { code: string; nom: string };
  douleur: string;
  gesteMinute: string;
  preuves: readonly PreuveProposee[];
  dessins: readonly DessinPropose[];
  /** Champs fixes de la fiche, recopiés tels quels. */
  videoId: string;
  versionId: string;
  /** Style (`fiche.habillage`) ; absent : le style par défaut des nouvelles fiches, « reference/2 ». */
  habillage?: string;
  stylo: string;
  ratio: FicheTableau["ratio"];
  /** Ce que la validation lit en plus du script (date, sources, statut des preuves et matières, mise en page…). */
  controle: Omit<ContexteTableau, "texteScript">;
  /**
   * Facultatif (style « reference/3 ») : les PARTIES NOMMÉES du texte dit, telles que le générateur de scripts v3 les
   * rend (`DonneesScriptTableau.parties`, contrat de `docs/formats/tableau-anime-scripts/REGLES.md` § 9 : `partie`,
   * `libelle`, `texte`, `ecran`, `numero`, `etape`, `mention`). Données : elles vont dans la demande, et elles
   * fixent la partie de chaque page de la fiche rendue (`appliquerParties`) ; absentes : Claude classe chaque phrase.
   */
  parties?: readonly PartieScript[];
}

/** Partie de page (« reference/3 ») d'une partie du script : une étape et la promesse sont « solution ». */
export const PAGE_DE_PARTIE: Readonly<Record<IdPartie, RolePage>> = { accroche: "accroche", douleur: "douleur", solution: "solution", etape: "solution", exemple: "exemple", "a-retenir": "retenir", appel: "appel" };

/** Au plus 11 parties : 3 fixes (accroche, douleur, solution), 5 étapes au plus, l'exemple, « à retenir » et l'appel. */
export const PARTIES_MAX = 11;

/**
 * Les parties d'un script (donnée non sûre), lues selon le contrat EXACT (REGLES § 9) : `partie` parmi les parties
 * connues, `libelle` et `texte` (texte), `ecran` (liste de textes), `numero` (étape), `etape` (action, comment,
 * résultat), `mention` (exemple). Une entrée mal formée rend le tout illisible (`undefined`) : le découpage relit
 * alors le texte sans elles.
 */
export function partiesDuDecoupage(brut: unknown): PartieScript[] | undefined {
  if (!Array.isArray(brut) || !brut.length || brut.length > PARTIES_MAX) return undefined;
  const connues = new Set<string>(Object.keys(PAGE_DE_PARTIE));
  const res: PartieScript[] = [];
  for (const x of brut) {
    if (!x || typeof x !== "object") return undefined;
    const o = x as Record<string, unknown>;
    if (typeof o.partie !== "string" || !connues.has(o.partie) || typeof o.libelle !== "string" || typeof o.texte !== "string" || !o.texte.trim()) return undefined;
    const etape = o.etape && typeof o.etape === "object" ? (o.etape as Record<string, unknown>) : null;
    res.push({
      partie: o.partie as IdPartie,
      libelle: o.libelle,
      texte: o.texte,
      ecran: Array.isArray(o.ecran) ? o.ecran.filter((e): e is string => typeof e === "string") : [],
      ...(typeof o.numero === "number" && Number.isInteger(o.numero) ? { numero: o.numero } : {}),
      ...(etape ? { etape: { action: String(etape.action ?? ""), comment: String(etape.comment ?? ""), resultat: String(etape.resultat ?? "") } } : {}),
      ...(typeof o.mention === "string" ? { mention: o.mention } : {}),
    });
  }
  return res;
}

/**
 * Applique les parties du script à une fiche « reference/3 » rendue (PUR) : chaque page prend la partie où commence
 * sa première scène (une étape et la promesse : « solution »), et la scène où commence une étape porte son numéro dit
 * (« Un. », « Deux. »…). Rien n'est changé si les parties ne redonnent pas, mot pour mot, le texte dit des scènes.
 */
export function appliquerParties<T>(brute: T, parties: readonly PartieScript[] | undefined): T {
  if (!parties?.length || !estObjet(brute) || brute.habillage !== STYLE_REFERENCE_3 || !Array.isArray(brute.scenes)) return brute;
  const scenes = brute.scenes.filter(estObjet);
  if (scenes.length !== brute.scenes.length || scenes.some((s) => typeof s.texteDit !== "string" || typeof s.page !== "number")) return brute;
  const motsDe = (t: string) => t.split(/\s+/).filter(Boolean);
  const dit = scenes.flatMap((s) => motsDe(s.texteDit as string));
  if (dit.join(" ") !== parties.flatMap((p) => motsDe(p.texte)).join(" ")) return brute;
  // Mot de départ de chaque partie et de chaque scène.
  const departs: { debut: number; p: PartieScript }[] = [];
  let n = 0;
  for (const p of parties) {
    departs.push({ debut: n, p });
    n += motsDe(p.texte).length;
  }
  const partieAu = (mot: number) => [...departs].reverse().find((d) => d.debut <= mot)!;
  const copie = structuredClone(brute) as Record<string, unknown> & { scenes: Record<string, unknown>[] };
  const roleDePage = new Map<number, RolePage>();
  let m = 0;
  for (const s of copie.scenes) {
    const nb = motsDe(s.texteDit as string).length;
    const d = partieAu(m);
    if (!roleDePage.has(s.page as number)) roleDePage.set(s.page as number, PAGE_DE_PARTIE[d.p.partie]);
    // Numéro d'étape : la scène où commence l'étape (ou qui la contient) et qui dit son numéro.
    const gab = (estObjet(s.gabarit) ? { ...s.gabarit } : {}) as Record<string, unknown>;
    delete gab.numero;
    for (const e of departs.filter((x) => x.p.partie === "etape" && x.p.numero && x.debut >= m && x.debut < m + nb)) {
      const dits = numerosDits(s.texteDit as string).find((x) => x.n === e.p.numero);
      if (dits) gab.numero = { n: dits.n, ancre: dits.ancre };
    }
    s.gabarit = gab;
    m += nb;
  }
  for (const s of copie.scenes) (s.gabarit as Record<string, unknown>).role = roleDePage.get(s.page as number);
  return copie as T;
}

/** Réponse d'un appel Claude telle que la rend le chemin de dépense (`executerRolePourVideo`), comme le monteur face
 * caméra. `donnees` : l'objet lu, ou le texte JSON rendu par Claude. `stopReason` : la raison d'arrêt du modèle
 * (« max_tokens » : réponse coupée) ; `coutUsd` et `jetons` : le coût réel de l'appel, gardés au journal de la tâche. */
export type ReponseAppelDecoupage =
  | { ok: true; simule: boolean; donnees?: unknown; invalide?: string; stopReason?: string | null; coutUsd?: number; jetons?: { entree: number; cacheLu: number; cacheEcrit: number; sortie: number } }
  | { ok: false; arret: string; message: string };

/** Demande de réservation : un appel, au coût PIRE estimé. */
export interface DemandeReservation {
  appelId: string;
  videoId: string;
  etape: string;
  modele: string;
  coutEstimeUsd: number;
}

export interface OutilsDecoupage {
  /** UN appel Claude du rôle fourni (branché par le service sur le chemin de dépense existant). */
  appeler: (role: DefinitionRole, entree: EntreeRole) => Promise<ReponseAppelDecoupage>;
  /** Budget du studio : réserve le coût estimé AVANT l'appel ; refus → aucun appel. */
  budget: { reserver: (demande: DemandeReservation) => Promise<{ ok: true } | { ok: false; message: string }> };
}

/** `refusee` : fiche lisible refusée par les règles ; `tronquee` : réponse coupée ; `illisible` : réponse vide ou hors JSON. */
export type MotifEchec = "refusee" | "tronquee" | "illisible" | "budget" | "appel" | "simulation";

export type ResultatDecoupage =
  /** `retraits` : ce que l'allègement de dernier recours a retiré de la fiche (page trop chargée), s'il y en a eu. */
  | { ok: true; fiche: FicheTableau; appels: number; relance: boolean; retraits?: RetraitAllegement[] }
  /** `aCorriger` : la dernière fiche LISIBLE refusée par les règles (champs fixes remis à leur valeur), à garder. */
  | { ok: false; motif: MotifEchec; message: string; refus: string[]; appels: number; aCorriger?: FicheTableau };

/* ------------------------------------------------------------------ */
/* Rôle et consigne                                                      */
/* ------------------------------------------------------------------ */

const liste = (xs: readonly string[]) => xs.map((x) => `« ${x} »`).join(", ");

/** Durée dite au-delà de laquelle une scène est coupée, ou porte un événement toutes les 3 s (consigne, version 6). */
export const SCENE_LONGUE_SEC = 8;

/** Consigne fixe du rôle (en cache côté service). Les règles sont celles de la validation (`regles.ts`). */
export const CONSIGNE_DECOUPAGE = `Tu découpes un script VALIDÉ en fiche de scènes d'une vidéo « tableau animé » : un stylo écrit et dessine sur une page blanche pendant que la voix dit le script.

RÈGLES ABSOLUES (la fiche est refusée sinon) :
- Les « texteDit » des scènes, mis bout à bout dans l'ordre, redonnent le script MOT POUR MOT, dans l'ordre, sans rien ajouter ni retirer : même ponctuation, même casse, mêmes apostrophes. Tu ne corriges, ne reformules, ne résumes jamais le script ; tu le coupes seulement entre deux mots.
- Chaque « dessinId » vient de la liste <dessins> fournie, à l'identique. Aucun autre dessin.
- Chaque « preuveId » vient de la liste <preuves> fournie, à l'identique. Au moins une scène de rôle « preuve » porte un élément « preuve ».
- Chaque « chiffre » porte un « sourceId » de la liste <sources_chiffres> ; aucun chiffre écrit dans une ligne sans élément « chiffre ». Exception : sur la page de l'EXEMPLE qui porte la mention « Exemple illustratif », écris en chiffres ceux que la voix dit (« 10 min », « 3 min »). Ailleurs, sans source, n'écris pas le chiffre ET ne tronque jamais la phrase : jamais « des minutes » pour « dix minutes », jamais « Tâches à… » pour « Trois tâches à… » ; reformule une phrase complète et juste sans quantité (« Les tâches à apprendre en premier »). Un DÉCOMPTE annoncé (« Trois réflexes pour… », « 3 étapes », « Cinq erreurs ») n'est pas un chiffre à sourcer : écris-le tel que la voix le dit, en lettres ou en chiffres, jamais « Les réflexes pour… » ; seule la quantité mesurée sans source (« en dix minutes ») se reformule. Une phrase clé ne répète pas le titre de sa page (titre « Faites rédiger », phrase « Faites rédiger les réponses… » : écris la phrase entière, l'écran retire le titre).
- Aucune phrase d'appel dans les textes écrits (${liste(["abonnez-vous", "commentez", "lien", "partagez", "likez", "cliquez"])}…) : la fin est une pièce à part, « appelId » vaut null.
- Vouvoiement dans tout texte écrit ; jamais « demain ».
- Aucun numéro d'épisode ni « partie 2 », nulle part (la série n'a pas de numéro).

FORME (JSON seul, COMPACT : sans indentation ni retour à la ligne, aucun texte autour, aucun champ en plus) :
{ "version": "fiche-scenes/1", "formatId": "${FORMAT_TABLEAU}", "videoId", "versionId", "habillage", "stylo", "ratio", "structure", "serie": { "code", "nom" }, "douleur", "gesteMinute", "appelId": null, "scenes": [...] }
Les champs fixes (<fiche_fixe>, <structure>, <serie>, <douleur>, <geste_minute>) sont recopiés tels quels.
Scène : { "id": "s01"…"s10" dans l'ordre, "role": ${liste(ROLES_SCENE_TABLEAU)}, "page": 1 à 6 (nouvelle page = page blanche), "texteDit", "elements": 1 à 6 }. 4 à 10 scènes (6 à 9 conseillées). Pas de « debutMs » ni « finMs ». Habillage "${STYLE_REFERENCE_2}" : 1 à 8 pages, 4 à 14 scènes, et chaque scène porte en plus « gabarit » (voir plus bas). Habillage "${STYLE_REFERENCE_3}" : 4 à 12 pages, 4 à 16 scènes, « gabarit » sur chaque scène, « bloc » sur chaque ligne, et « code » sur un élément de liste à pastilles (voir « GABARIT PAR PARTIES »).
Éléments (« id » unique dans la fiche, « e01 »…, « ancre » = index du mot du texteDit de la scène où il apparaît, 0 = premier mot) :
- ligne : { "id", "type": "ligne", "texte" (court ; page écrite "${STYLE_REFERENCE_1}" : une phrase presque complète, voir plus bas), "niveau": ${liste(NIVEAUX_LIGNE)}, "role": ${liste(ROLES_LIGNE)}, "marque"? : ${liste(MARQUES)}, "bloc" (habillages "${STYLE_REFERENCE_2}" et "${STYLE_REFERENCE_3}" seulement, obligatoire) : ${liste(BLOCS_GABARIT)}, "code"? (habillage "${STYLE_REFERENCE_3}", bloc « code ») : « vert », « orange » ou « rouge », "ancre" }
- dessin : { "id", "type": "dessin", "dessinId", "cote": ${liste(COTES)}, "ancre" }
- chiffre : { "id", "type": "chiffre", "valeur", "unite"?, "sourceId", "ancre" }
- preuve : { "id", "type": "preuve", "preuveId", "lignes": ${BORNES_TABLEAU.lignesPreuveMin} ou ${BORNES_TABLEAU.lignesPreuveMax} lignes courtes, "ancre" }
- geste : { "id", "type": "geste", "geste": ${liste(GESTES)}, "cibleId" (élément de la même scène), "ancre" }
- mention : { "id", "type": "mention", "texte": "${MENTION_EXEMPLE}" } — d'office sur une scène « exemple » avec prénom ou chiffres.

LISIBILITÉ ET RYTHME :
- Scène s01, page 1 : accroche de ${ACCROCHE_MOTS_MAX} mots au plus, écrite dès le mot 0.
- Par page : ${PAGE_MOTS_MAX} mots écrits au plus, ${PAGE_LIGNES_MAX} lignes au plus.
- Les mots de la douleur (<mots_douleur> s'ils sont donnés, sinon les mots-clés de <douleur>) sont dits ET écrits dans les 3 premières secondes, avec un geste fort (entourer ou barrer, en geste ou en marque) sur la ligne qui les écrit.
- Aucun mot de <mots_interdits> ni rien de ce qu'interdit <interdits_de_will> (s'ils sont donnés) dans les textes écrits (titres, blocs, écrans, peps).
- Un événement visuel (ligne, dessin, geste, élément de liste, page tournée) au moins toutes les ${ECART_EVENEMENT_MAX_MS / 1000} secondes ; débit de la voix : ${String(CARACTERES_PAR_SECONDE).replace(".", ",")} caractères dits par seconde, espaces compris ; ${DUREE_MAX_MS / 1000} secondes au plus (${CARACTERES_DITS_MAX_TABLEAU} caractères dits).
- Une scène qui dit plus de ${SCENE_LONGUE_SEC} secondes (environ ${caracteresEn(SCENE_LONGUE_SEC)} caractères) est coupée en deux à une fin de phrase, ou porte un événement toutes les ${ECART_VISE_MS / 1000} secondes : ses ancres sont RÉPARTIES sur toute la scène (chaque ligne au mot où ses mots sont dits ; un dessin ou un geste dans chaque silence), jamais toutes au début.
- Chaque scène suit le déroulé de la structure donnée.

ÉCRANS (seulement si l'habillage vaut "${STYLE_BLOCS_2}" ; sinon, pas de champ « ecrans ») :
Chaque scène porte « ecrans » : 1 écran (2 au plus : le second part plus tard dans la scène, à son « ancre »). Chaque écran choisit un gabarit et dit ce qu'il montre ; un champ absent prend une valeur de repli, jamais un échec.
{ "moment": ${liste(MOMENTS_ECRAN)}, "gabarit"? : ${liste(GABARITS_ECRAN)}, "etiquette"? (${BORNES_ECRAN.etiquetteMax} caractères au plus : « Le constat », « Ce que ça coûte », « La méthode », « Exemple », « En résumé », « À vous » ; jamais « problème »), "etape"? : { "n", "total", "nom" (court, « Tâche ») } pour le moment « etape », "motsForts"? : des mots SEULS (un seul mot par entrée), recopiés d'une ligne de la scène, ${BORNES_ECRAN.motsFortsMax} au plus (mis en bloc orange), "liste"? : 1 à ${BORNES_ECRAN.itemsMax} éléments { "texte" (court), "detail"?, "ancre" }, "motCommentaire"? (le mot à écrire en commentaire, écrit dans une ligne), "ancre"? (second écran seulement) }
Choix du gabarit, par moment : accroche → « accroche-cases » (des essais barrés : « liste » des cases) ou « accroche-compteur » (un « chiffre ») ; douleur → « constat » ; retournement → « idee-recue » (la ligne barrée, « marque » « barre », est l'idée reçue) ; promesse → « semaine » (jours L M M J V) ; etape → « etape » (cartes de la « liste ») ou « liste » (lignes qui se remplissent : « texte » = libellé court, « detail » = ce qu'on ajoute) ou « semaine » ; exemple → « exemple » (avant/après : la preuve à 2 lignes, et la mention « ${MENTION_EXEMPLE} ») ; recapitulatif → « recapitulatif » (les points, cochés un à un) ; appel → « appel-commentaire » (avec « motCommentaire ») ou « appel-diagnostic ».
Mots forts : les 1 à 3 mots qui portent l'idée de l'écran (un chiffre et son unité, un verbe clé). Mots importants d'une ligne (« importants ») : soulignés au crayon.
Avec cet habillage, la dernière scène peut dire et écrire l'appel du script (« Écrivez … en commentaire ») si elle porte un écran de moment « appel » ; aucune autre scène.

PAGE ÉCRITE (habillage "${STYLE_REFERENCE_1}" seulement) : pas de champ « ecrans ». Une page (« page ») = une page blanche qui se remplit de haut en bas, sans rien effacer : 4 à 6 pages par vidéo. Le crayon écrit des PHRASES PRESQUE COMPLÈTES, reprises du texte dit (ses mots, dans son ordre, à peine raccourcies), jamais des fragments de deux ou trois mots :
- chaque ligne = un bloc centré, de 1 à 3 lignes à l'écran : une phrase de 6 à 12 mots environ (12 mots au plus) ; l'accroche de s01 reste à ${ACCROCHE_MOTS_MAX} mots au plus ;
- 3 à 5 blocs par page (dessins et gestes en plus), qui remplissent la page du haut jusqu'en bas ; ${PAGE_MOTS_MAX} mots écrits au plus par page (par exemple 4 blocs de 10 mots, ou 5 blocs de 8) ;
- un même texte n'est écrit qu'une seule fois sur une page ; les règles du rythme ne changent pas : la douleur dite ET écrite dans les 3 premières secondes avec un geste fort, un événement visuel au moins toutes les ${ECART_EVENEMENT_MAX_MS / 1000} secondes (chaque bloc ancré au mot où sa phrase est dite, un dessin ou un geste entre deux blocs éloignés) ;
- « role » donne sa couleur (« alerte » : la douleur, en terracotta ; « resultat » ou « avantage » : la solution, en vert ; sinon encre). Un dessin par idée, ancré juste après la ligne qu'il illustre ;
- la dernière scène, de rôle « fin », peut dire et écrire l'appel du script (« Écrivez … en commentaire ») ; aucune autre scène.
EXEMPLE (deux pages d'une vidéo, forme exacte attendue) — script : « Vos clients oublient leurs rendez-vous. Vous attendez seul devant une chaise vide. Une heure perdue, et personne ne vous prévient. Personne ne leur rappelle le rendez-vous la veille. Un message automatique peut le faire à votre place, sans que vous y pensiez. » →
{"id":"s01","role":"accroche","page":1,"texteDit":"Vos clients oublient leurs rendez-vous. Vous attendez seul devant une chaise vide. Une heure perdue, et personne ne vous prévient.","elements":[{"id":"e01","type":"ligne","texte":"Vos clients oublient leurs rendez-vous","niveau":"titre","role":"titre","marque":"entoure","ancre":0},{"id":"e02","type":"dessin","dessinId":"calendrier","cote":"droite","ancre":3},{"id":"e03","type":"ligne","texte":"Vous attendez seul devant une chaise vide","niveau":"texte","role":"alerte","ancre":5},{"id":"e04","type":"dessin","dessinId":"sablier","cote":"gauche","ancre":10},{"id":"e05","type":"ligne","texte":"Une heure perdue, et personne ne vous prévient","niveau":"texte","role":"alerte","marque":"souligne","ancre":13}]}
{"id":"s02","role":"etape","page":2,"texteDit":"Personne ne leur rappelle le rendez-vous la veille. Un message automatique peut le faire à votre place, sans que vous y pensiez.","elements":[{"id":"e06","type":"ligne","texte":"Personne ne leur rappelle le rendez-vous la veille","niveau":"titre","role":"alerte","ancre":0},{"id":"e08","type":"dessin","dessinId":"telephone","cote":"droite","ancre":3},{"id":"e09","type":"ligne","texte":"Un message automatique le fait à votre place","niveau":"texte","role":"avantage","marque":"souligne","ancre":8},{"id":"e10","type":"dessin","dessinId":"fleche-boucle","cote":"gauche","ancre":14}]}
(Les dessins de l'exemple ne valent que s'ils sont dans <dessins> ; sinon, prends-en un de la liste.) À ne pas faire : « Chaise vide », « Leur mémoire ? », « Rappel auto » (fragments trop courts : la page reste à moitié vide).

GABARIT DE PAGE CLAIR (habillage "${STYLE_REFERENCE_2}", le style des nouvelles fiches) : pas de champ « ecrans ». Même page écrite au crayon, mais CHAQUE PAGE SUIT LE MÊME GABARIT, une idée par page, dans cet ordre :
- chaque scène porte « gabarit » : { "role": ${liste(ROLES_PAGE)} } — le rôle de SA PAGE (toutes les scènes d'une page ont le même) ; « numero » : { "n", "ancre" } en plus pour la scène qui DIT le numéro d'une étape ;
- pages, dans l'ordre : 1 ou 2 pages « probleme » (le rôle technique de la page de la douleur : la scène vécue, puis ce qu'elle coûte ; jamais le mot « problème » écrit), une page « etape » PAR CONSTAT « ce qui change » (2 à 3), une page « exemple », une dernière page « retenir » ;
- TITRE (« bloc » « titre », niveau « titre ») : 1 à ${BORNES_GABARIT.titreMots} mots, l'idée de la page, écrit EN PREMIER sur la page (son ancre précède celle des autres lignes de la scène). Étape : 1 à 3 mots-clés du constat (« Réponse type ») ; exemple : qui (« Une fleuriste ») ; dernière page : « À retenir » ;
- PHRASE CLÉ (« bloc » « phrase-cle ») : une phrase complète, ${BORNES_GABARIT.phraseMots} mots au plus, reprise du texte dit (obligatoire, sauf « retenir ») ;
- DÉTAILS (« bloc » « detail ») : 1 à ${BORNES_GABARIT.detailsMax} phrases complètes, COURTES : ${CONSEIL_GABARIT.detailMots} mots au plus chacune (une idée par détail ; plus long, coupez-le en deux détails). Exemple : « Mettez sa réponse dans le message d'accueil automatique : il part au premier message. » (13 mots, trop long) → deux détails « Mettez sa réponse dans le message d'accueil automatique. » et « Il part au premier message. » ;
- UN dessin par page (le dessin de l'idée), ancré au mot qui le dit ;
- ÉTAPES NUMÉROTÉES : quand le texte dit « Un. », « Deux. », « Trois. »… (le numéro seul, suivi d'une ponctuation, en tête de phrase), la scène porte « gabarit » { "role": "etape", "numero": { "n": 2, "ancre": <index de ce mot> } } : la pastille s'écrit au moment où la voix dit le numéro. TOUJOURS, pour chaque numéro dit ; les étapes se suivent (1, 2, 3…) ;
- EXEMPLE : une ligne « bloc » « avant » (en terracotta, la situation sans la méthode) et une ligne « bloc » « apres » (en vert, avec la méthode), ${CONSEIL_GABARIT.comparaisonMots} mots au plus chacune, chacune ancrée au mot où elle est dite (« Elle retape ses délais six fois par jour, en boutique. » : 10 mots, trop long → « Elle retape ses délais six fois par jour. ») ; ou bien la preuve de l'exemple en lignes « Avant : … » / « Après : … » (une ligne de preuve sans étiquette devient un détail) ; la mention « ${MENTION_EXEMPLE} » sur la page « exemple » devient son bandeau ;
- « À RETENIR » (dernière page) : le titre « À retenir », puis L'IDÉE de la vidéo en UNE phrase clé (« bloc » « phrase-cle », la phrase « à retenir » du script ; plus de liste des verbes des étapes), puis, dans la dernière scène (rôle « fin »), l'appel du script en « bloc » « appel » (« Écrivez … en commentaire »), écrit en grand ; une phrase de plus de cette scène va en « detail » ;
- le texte ÉCRIT peut raccourcir le texte dit, JAMAIS le contredire : la phrase clé et les détails reprennent ses mots (la moitié au moins), aucun nombre écrit qui ne soit dit ; les règles ne changent pas : la douleur dite ET écrite dans les 3 premières secondes avec un geste fort (la phrase clé de la page 1, « marque » « entoure »), un événement visuel au moins toutes les ${ECART_EVENEMENT_MAX_MS / 1000} secondes (chaque ligne ancrée au mot où elle est dite), un même texte écrit une seule fois par page ;
- 6 éléments au plus par scène : une page qui a plus à écrire est faite de deux scènes coupées à une fin de phrase ; 40 mots écrits au plus par page. (Une scène trop chargée est coupée, une page trop chargée passe à une page de plus, automatiquement, avant tout refus.)
EXEMPLE (forme exacte attendue : page 1, une page d'étape, la page « exemple » et la page « À retenir » d'une vidéo de 7 pages) — script : « Vous retapez la même réponse dix fois par jour. … À chaque message, une réponse type se prépare. Elle reprend vos délais et vos horaires. … Prenons une fleuriste. … Une réponse écrite une fois répond à votre place. Les dix réponses types tiennent sur une page. Écrivez REPONSES en commentaire. Je vous l'envoie. » →
{"id":"s01","role":"accroche","page":1,"texteDit":"Vous retapez la même réponse dix fois par jour. Vos délais, vos horaires, votre zone d'intervention. Cette réponse n'existe que dans votre tête.","gabarit":{"role":"probleme"},"elements":[{"id":"e01","type":"ligne","texte":"Dix fois par jour","niveau":"titre","role":"alerte","bloc":"titre","ancre":0},{"id":"e02","type":"ligne","texte":"Vous retapez la même réponse dix fois par jour.","niveau":"texte","role":"alerte","bloc":"phrase-cle","marque":"entoure","ancre":1},{"id":"e03","type":"dessin","dessinId":"bulle","cote":"droite","ancre":5},{"id":"e04","type":"ligne","texte":"Vos délais, vos horaires, votre zone d'intervention.","niveau":"texte","role":"regle","bloc":"detail","ancre":9},{"id":"e05","type":"ligne","texte":"La cause : cette réponse n'existe que dans votre tête.","niveau":"texte","role":"regle","bloc":"detail","ancre":16}]}
{"id":"s02","role":"etape","page":2,"texteDit":"À chaque message, une réponse type se prépare. Elle reprend vos délais et vos horaires.","gabarit":{"role":"etape"},"elements":[{"id":"e06","type":"ligne","texte":"Réponse type","niveau":"titre","role":"regle","bloc":"titre","ancre":3},{"id":"e07","type":"ligne","texte":"Une réponse type se prépare.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":3},{"id":"e08","type":"dessin","dessinId":"loupe","cote":"droite","ancre":6},{"id":"e09","type":"ligne","texte":"Elle reprend vos délais et vos horaires.","niveau":"texte","role":"regle","bloc":"detail","ancre":8}]}
{"id":"s06","role":"exemple","page":6,"texteDit":"Prenons une fleuriste. Son message d'accueil répond à sa place.","gabarit":{"role":"exemple"},"elements":[{"id":"e25","type":"mention","texte":"Exemple illustratif"},{"id":"e26","type":"ligne","texte":"Une fleuriste","niveau":"titre","role":"regle","bloc":"titre","ancre":0},{"id":"e27","type":"ligne","texte":"Son message d'accueil répond à sa place.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":3},{"id":"e28","type":"dessin","dessinId":"horloge","cote":"droite","ancre":6}]}
{"id":"s07","role":"preuve","page":6,"texteDit":"Avant, elle retapait ses délais six fois par jour, en boutique. Maintenant, son accueil annonce ses délais et ses horaires. Elle tape seulement le créneau.","gabarit":{"role":"exemple"},"elements":[{"id":"e29","type":"ligne","texte":"Elle retape ses délais six fois par jour.","niveau":"texte","role":"alerte","bloc":"avant","ancre":0},{"id":"e30","type":"ligne","texte":"Son accueil annonce ses délais et ses horaires.","niveau":"texte","role":"resultat","bloc":"apres","ancre":11},{"id":"e31","type":"preuve","preuveId":"mat-reponses-demo","lignes":["Elle tape seulement le créneau."],"ancre":20}]}
{"id":"s08","role":"resultat","page":7,"texteDit":"Une réponse écrite une fois répond à votre place.","gabarit":{"role":"retenir"},"elements":[{"id":"e32","type":"ligne","texte":"À retenir","niveau":"titre","role":"regle","bloc":"titre","ancre":0},{"id":"e33","type":"ligne","texte":"Une réponse écrite une fois répond à votre place.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":0},{"id":"e37","type":"dessin","dessinId":"liste-cochee","cote":"droite","ancre":5}]}
{"id":"s09","role":"fin","page":7,"texteDit":"Les dix réponses types tiennent sur une page. Écrivez REPONSES en commentaire. Je vous l'envoie.","gabarit":{"role":"retenir"},"elements":[{"id":"e38","type":"ligne","texte":"Les dix réponses types tiennent sur une page.","niveau":"texte","role":"avantage","bloc":"detail","ancre":0},{"id":"e39","type":"ligne","texte":"Écrivez REPONSES en commentaire","niveau":"titre","role":"regle","bloc":"appel","ancre":8}]}
À ne pas faire : un constat « ce qui change » récrit en ordre adressé au spectateur (« Relisez… ») ou précédé d'un numéro que le script ne dit pas ; un titre de 5 mots ; une phrase clé qui dit autre chose que la voix ; deux idées sur la même page ; « Le problème » écrit en titre ; « À retenir » en liste de verbes.

GABARIT PAR PARTIES (habillage "${STYLE_REFERENCE_3}", le style des NOUVELLES fiches ; il remplace les sections « PAGE ÉCRITE » et « GABARIT DE PAGE CLAIR » ci-dessus) : pas de champ « ecrans ». La vidéo suit SES PARTIES, dans cet ordre, une partie par page (ou plusieurs pages de la même partie) ; l'étiquette de la partie est écrite en haut de chaque page. JAMAIS de page « problème » : on parle de DOULEUR, puis de SOLUTION.
- chaque scène porte « gabarit » : { "role": ${liste(ROLES_PAGE_3)} } — la PARTIE de sa page ; « numero » : { "n", "ancre" } en plus pour la scène d'une étape de la solution qui DIT son numéro (« Un. », « Deux. »…, étapes 1, 2, 3…) ;
- LE SCRIPT SUIT SIX PASSAGES (gabarit cadré du 15/10 : une idée, un gain, une preuve). TU CLASSES CHAQUE PHRASE dans sa partie (si <parties> est donné, suis-le ; sinon classe toi-même) : « accroche » (page 1 SEULE : la situation, dite dès le premier mot), « douleur » (la scène vécue et son coût), « solution » (la promesse et sa boucle ouverte, puis UNE page par constat « ce qui change » : 2 à 3 constats, autant que le script en dit), « exemple » (la promesse tenue : avant / maintenant), « retenir » (l'IDÉE, en UNE phrase : 2 à 4 secondes), « appel » (la DERNIÈRE page : la phrase sur l'entreprise et la demande) ;
- ACCROCHE : la phrase de la douleur en « bloc » « phrase-cle », au mot 0, ${BORNES_GABARIT_3.accrocheMots} mots au plus, « marque » « entoure » et « importants » : les 2 à 4 mots de la douleur (<mots_douleur>) tels qu'écrits dans la ligne — elle est écrite EN TRÈS GRAND DÈS LA PREMIÈRE IMAGE (elle sert de miniature) et ces mots sont entourés quand la voix les dit ; la phrase suivante en « detail » ;
- 3 BLOCS AU PLUS PAR PAGE, dans l'ordre de lecture : TITRE (« bloc » « titre », 1 à ${BORNES_GABARIT_3.titreMots} mots ; obligatoire sur une étape : 1 à 3 mots-clés du constat (« Trois lignes »)), PHRASE CLÉ (« phrase-cle », ${BORNES_GABARIT_3.phraseMots} mots au plus, reprise du texte dit), puis UN détail (« detail », ${CONSEIL_GABARIT_3.detailMots} mots conseillés, ${BORNES_GABARIT_3.detailMots} au plus) OU UN VISUEL. Le DÉTAIL écrit des MOTS-CLÉS repris du texte dit (2 à 5 mots par ligne), jamais la phrase dite recopiée : le sous-titre la montre déjà ; il garde les chiffres dits (« Trois lignes », jamais « Lignes ») ; seules la PHRASE CLÉ, l'accroche et « À retenir » restent des phrases. Une liste compte pour UN bloc. Plus de 3 blocs : la scène suivante va sur une page de plus ;
- PLACE : la page est dessinée dans le style donné par <style_tableau> et s'arrête au-dessus de la bande des sous-titres. Aux styles « tableau-blanc » (titres en capitales au feutre) et « paperboard » (écriture plus grande) : une scène dit 3 phrases au plus (une page qui en dit plus est faite de deux scènes ou plus ; la dernière peut alors passer seule à une page de plus), et une page porte UN détail OU UN VISUEL, jamais les deux (le dessin à côté de l'étiquette n'est pas un visuel), avec un détail de 5 mots au plus (sauf l'accroche et la page d'appel). Au style « ardoise », rien de tout cela ne change ;
- MONTRE LA SOLUTION, ne l'écris pas seulement. Visuels (un par page) : liste à pastilles de couleur = des lignes « bloc » « code » avec « code » « vert » / « orange » / « rouge » (2 à ${BORNES_GABARIT_3.listeMax} éléments, ${CONSEIL_GABARIT_3.itemMots} mots conseillés : « Vert : on colle. ») ; liste cochée = des lignes « bloc » « coche » (chaque élément ancré au mot où il est dit, il se coche au fil de la voix : « Devis », « Contrats ») ; transformation = une ligne « bloc » « transformation » écrite « avant → après » (1 ou 2 par page, ${BORNES_GABARIT_3.coteMots} mots au plus de chaque côté : « M. Dupont → Client A », « Le montant → X »), ancrée au mot où la voix commence à la dire ; exemple = « avant » et « apres » (${CONSEIL_GABARIT_3.comparaisonMots} mots conseillés) ;
- BARRER : seulement une IDÉE REÇUE, en « bloc » « idee-recue » (page « douleur », ${BORNES_GABARIT_3.ideeMots} mots au plus) : elle est étiquetée « Idée reçue » et barrée quand la voix a fini de la dire. Aucune autre ligne barrée (ni « marque » « barre », ni geste « barrer ») ;
- « À RETENIR » : L'IDÉE en UNE phrase clé (« bloc » « phrase-cle », ${BORNES_GABARIT_3.phraseMots} mots au plus, reprise du texte dit), écrite en grand ; pas de liste des étapes, pas de titre ;
- LA QUESTION SUR L'IA (l'une de ${QUESTIONS_IA.map((q) => `« ${q} »`).join(", ")}) est DITE, jamais écrite, sur aucune page (pas même sur la page d'appel ni raccourcie) ;
- LE NOM AXION-IA n'est écrit que sur la page d'appel (la dernière) : jamais dans un titre, une ligne, une étiquette ou un visuel d'une autre page (il peut être dit) ;
- APPEL (dernière page, plein cadre) : la phrase d'appel en « bloc » « appel » (courte : « Réservez un appel de diagnostic »), au plus une autre phrase en « detail » ; axion-ia.com est ajouté d'office ;
- chaque ligne est ancrée au PREMIER mot où la voix la dit (jamais plus tard) : elle s'écrit pendant qu'elle est dite ; un dessin au plus par page (il va à droite de l'étiquette) ;
- une page courte (une seule phrase) reste courte : la mise en page agrandit son texte. N'ajoute JAMAIS de texte écrit qui n'est pas dit pour la remplir ;
- le texte écrit raccourcit le texte dit, JAMAIS ne le contredit (aucun nombre écrit qui ne soit dit) ; 12 pages au plus ;
- VISUELS DESSINÉS (facultatif, un par page AU PLUS, aucune page obligée) : « gabarit » { …, "visuel": { "id", "chiffre"?, "libelle"?, "gauche"?, "droite"?, "ancre"? } } sur la scène dont l'idée se dessine, pris dans la banque fermée : ${liste(IDS_VISUELS_3)}. Choisis-le selon l'IDÉE de la page : un chiffre qui frappe → « chiffre-entoure » (avec « chiffre ») ; un gain mesuré → « barres-avant-apres » ; du temps gagné, un délai → « chrono » ; une date, « chaque lundi » → « calendrier » ; un e-mail, une relance, un message automatique → « email-envoye » ; des données retirées, ce qu'on ne colle pas → « document-barre » ; des étapes, une check-list → « liste-cochee » ; une transformation (nom → lettre, avant → après) → « schema-a-b » (« gauche » : « personne » ou un mot court, « droite » : le mot d'après) ; trier → « entonnoir » ; comparer deux options → « balance » ; un objectif, le bon client → « cible » ; un client qui écrit, une alerte → « telephone-notification » ; la sécurité, des données protégées → « bouclier-coche » ; une croissance → « graphique-monte » ; ChatGPT, une consigne, une question → « fenetre-discussion » ; l'équipe à former → « equipe ». « chiffre » et « libelle » : des mots DITS, courts ; pas de visuel sur la page d'appel ; le visuel remplace le dessin de la page (pas de « dessin » en plus) ; « ancre » : le mot où il se dessine (absent : après les lignes de la scène) ;
- BLOC ORANGE (facultatif, UN par page au plus, jamais sur la page d'appel) : « gabarit » { …, "bloc": { "texte", "compteur"?: { "de", "a" }, "ancre"? } } — le mot-clé de la page en ${BORNES_BLOC_3.motsMax} mots au plus, repris du texte dit, mis dans un bloc orange plein ; « compteur » : un chiffre qui défile (de 0 à 3 quand la voix dit « trois données de trop ») ; il compte pour un des 3 blocs de la page ; « ancre » : le mot où il apparaît. Un chiffre écrit (compteur, « chiffre » d'un visuel) suit la règle des chiffres : la voix le dit, et un élément « chiffre » de la scène le source (il est montré par le visuel ou le bloc, pas écrit deux fois) ;
EXEMPLE (forme exacte attendue, d'après le témoin v5 (18/10), 10 pages : l'accroche, une page « douleur », la promesse, deux constats « ce qui change », « À retenir », l'appel) →
{"id":"s01","role":"accroche","page":1,"texteDit":"Le seul qui connaît ce dossier client est en congé.","gabarit":{"role":"accroche"},"elements":[{"id":"e01","type":"ligne","texte":"Le seul qui connaît ce dossier client est en congé.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":0,"marque":"entoure","importants":["dossier client","en congé"]}]}
{"id":"s02","role":"douleur","page":2,"texteDit":"Un client appelle. On fouille la boîte mail du collègue.","gabarit":{"role":"douleur"},"elements":[{"id":"e03","type":"ligne","texte":"Un client appelle","niveau":"titre","role":"regle","bloc":"titre","ancre":0},{"id":"e04","type":"ligne","texte":"On fouille la boîte mail du collègue.","niveau":"texte","role":"alerte","bloc":"phrase-cle","ancre":3},{"id":"e06","type":"dessin","dessinId":"dossier","cote":"droite","ancre":7}]}
{"id":"s03","role":"douleur","page":2,"texteDit":"Puis on l'appelle en congé. Le client s'en aperçoit. Chez vous, qui reprendrait ce dossier ?","gabarit":{"role":"douleur"},"elements":[{"id":"e05","type":"ligne","texte":"On appelle le collègue","niveau":"texte","role":"alerte","bloc":"detail","ancre":0}]}
{"id":"s04","role":"etape","page":4,"texteDit":"Un dossier peut se reprendre en lisant trois lignes. Reste à savoir qui les écrit.","gabarit":{"role":"solution","visuel":{"id":"liste-cochee"}},"elements":[{"id":"e12","type":"ligne","texte":"Un dossier se reprend en lisant trois lignes.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":0}]}
{"id":"s05","role":"etape","page":5,"texteDit":"Une automatisation écrit trois lignes dans la fiche. Elles disent où en est le dossier, et la suite.","gabarit":{"role":"solution"},"elements":[{"id":"e15","type":"ligne","texte":"Trois lignes","niveau":"titre","role":"regle","bloc":"titre","ancre":0},{"id":"e16","type":"ligne","texte":"Une automatisation écrit trois lignes dans la fiche.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":0},{"id":"e17","type":"ligne","texte":"Où en est le dossier","niveau":"texte","role":"regle","bloc":"coche","ancre":10},{"id":"e18","type":"ligne","texte":"La suite","niveau":"texte","role":"regle","bloc":"coche","ancre":16}]}
{"id":"s06","role":"etape","page":6,"texteDit":"Le collègue n'est plus dérangé en congé. On ne fouille plus l'historique de ses mails.","gabarit":{"role":"solution"},"elements":[{"id":"e21","type":"ligne","texte":"Plus dérangé","niveau":"titre","role":"regle","bloc":"titre","ancre":0},{"id":"e22","type":"ligne","texte":"Le collègue n'est plus dérangé en congé.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":0},{"id":"e23","type":"ligne","texte":"Fouille dans ses mails","niveau":"texte","role":"regle","bloc":"detail","ancre":9}]}
{"id":"s10","role":"resultat","page":9,"texteDit":"Une fiche tenue à jour remplace l'appel au collègue absent.","gabarit":{"role":"retenir"},"elements":[{"id":"e42","type":"ligne","texte":"Une fiche tenue à jour remplace l'appel au collègue absent.","niveau":"texte","role":"regle","bloc":"phrase-cle","ancre":0}]}
{"id":"s11","role":"fin","page":10,"texteDit":"Axion-IA met cette fiche en place pour vous. Réservez un appel de diagnostic.","gabarit":{"role":"appel"},"elements":[{"id":"e43","type":"ligne","texte":"Axion-IA met cette fiche en place pour vous.","niveau":"texte","role":"regle","bloc":"detail","ancre":0},{"id":"e44","type":"ligne","texte":"Réservez un appel de diagnostic","niveau":"titre","role":"regle","bloc":"appel","ancre":8}]}
À ne pas faire : une étiquette ou un titre « Le problème » ; une page de 4 blocs ; une solution écrite en phrases noires sans visuel quand elle se montre (liste cochée, avant → après) ; une ligne barrée qui n'est pas une idée reçue ; « À retenir » en liste de verbes ; un texte écrit ajouté pour remplir une page ; un appel écrit petit au bas d'une page ; deux visuels ou deux blocs orange sur une page ; un visuel hors de la banque ; un chiffre écrit dans un visuel ou un bloc sans être dit ni sourcé.`;

/**
 * Budget de sortie (constat du 12/10 : 8 000 jetons, pensée comprise, pour une fiche « blocs/2 » avec ses écrans).
 * Mesure : la fiche témoin « Formation » (10 scènes, écrans compris, `tests/tableau/style-v2/temoin-formation.ts`)
 * fait 14 854 caractères en JSON indenté (7 899 compact), soit ≈ 4 952 jetons au pire (1 jeton pour 3 caractères).
 * Texte : 2,5 fois cette mesure ; pensée : comptée À PART (la pensée adaptative est prise sur `max_tokens`).
 */
export const JETONS_FICHE_TEMOIN = 4952;
export const BUDGET_TEXTE_DECOUPAGE = Math.ceil(JETONS_FICHE_TEMOIN * 2.5);
export const BUDGET_PENSEE_DECOUPAGE = 6000;
export const MAX_TOKENS_DECOUPAGE = BUDGET_TEXTE_DECOUPAGE + BUDGET_PENSEE_DECOUPAGE;

/**
 * Rôle « découpage du tableau » : modèle d'écriture du studio (configuration `tarifs.ts`), sortie en texte JSON, SANS
 * schéma envoyé (les limites de la sortie structurée ne s'appliquent pas ; voir la PR TB-12).
 */
export const roleDecoupageTableau = {
  id: "decoupage-tableau",
  // 2 (11/10) : écrans du style « blocs/2 » (moment, gabarit, étiquette, mots forts, liste).
  // 3 (12/10) : JSON compact demandé, budget de sortie mesuré sur la fiche témoin (texte et pensée comptés à part).
  // 4 (12/10) : « motsForts » = des mots seuls (un mot par entrée), recopiés d'une ligne de la scène.
  // 5 (12/10) : débit en caractères (estimateur commun avec le générateur) ; mots de la douleur donnés (<mots_douleur>).
  // 6 (12/10) : rappel du rythme (scène de plus de 8 s coupée, ou un événement toutes les 3 s) ; borne de longueur dite.
  // 7 (14/10) : style « reference/1 » (page écrite, par défaut) : pas d'écrans, couleur par rôle, appel en scène « fin ».
  // 8 (14/10) : « reference/1 » : phrases presque complètes reprises du texte dit (12 mots au plus), 3 à 5 blocs par
  //   page, un exemple complet (une vraie vidéo regardée par Will : fragments trop courts, page remplie aux 2/3).
  // 9 (14/10) : style « reference/2 » (gabarit de page clair, défaut des nouvelles fiches) : « gabarit » par scène (rôle
  //   de page, numéro dit), « bloc » par ligne (titre, phrase clé, détails, avant, après, liste, appel), étapes toujours
  //   numérotées quand le texte dit « Un. », « Deux. »… ; un exemple complet.
  // 10 (14/10) : « reference/2 » : détails de 10 mots au plus, avant / après de 8 mots au plus, avec un exemple (vidéo
  //   v-b19aefb21d57 : deux pages trop chargées refusées de suite).
  // 11 (14/10) : style « reference/3 » (gabarit par PARTIES, défaut des nouvelles fiches, vidéo v-f1739d6a4f51 jugée « pas
  //   assez claire ») : chaque phrase classée dans sa partie (accroche, douleur, solution, exemple, à retenir, appel ;
  //   « parties » du générateur suivies si données), jamais de page « problème », 3 blocs au plus par page, accroche
  //   entière dès la première image, visuels de la solution (pastilles de couleur, liste cochée, « avant → après »), seule
  //   une idée reçue barrée, appel plein cadre ; un exemple.
  // 12 (15/10) : gabarit cadré des scripts (une idée, un gain, une preuve) : six passages, 2 à 5 étapes, « À retenir » =
  //   l'idée en une phrase (plus de liste des étapes) ; plus de « Le vrai problème » ni d'exemple tiré d'un script
  //   refusé (l'exemple validé par Will) ; jamais de texte ajouté pour remplir une page.
  // 13 (15/10) : visuels dessinés et peps (maquette validée par Will, PR #260) : « visuel » facultatif par page, pris dans
  //   la banque fermée des 16 visuels selon l'idée de la scène ; « bloc » orange facultatif (texte + compteur), un par page.
  // 14 (16/10) : vidéo d'essai v-667edcd8e3a8 : chiffres dits écrits sur l'exemple illustratif ; ailleurs, jamais de
  //   phrase tronquée par un chiffre retiré.
  // 15 (17/10) : vidéo v-b2d772d28b97 : un décompte annoncé (« Trois réflexes… ») reste écrit, il n'est pas à sourcer.
  // 16 (17/10) : vidéo v-6616b3800357 : consigne inchangée ; les remises en forme changent (une page de plus n'est
  //   acceptée que si elle ne casse aucune règle du gabarit ; une page qui n'écrit qu'une preuve n'est pas vide).
  // 17 (18/10) : lot B1 des scripts (tableau sans tutoriel) : au style « reference/3 », le détail écrit des mots-clés
  //   (2 à 5 mots) repris du texte dit, plus la phrase dite recopiée ; « reference/1 » (phrases presque complètes,
  //   décision du 14/10) n'est pas touché. Le plancher « la moitié des mots écrits sont dits » ne change pas.
  // 18 (19/10) : correctifs de relecture B1 : le numéro dit n'est plus imposé (plus de « toujours ») ; le titre d'une étape
  //   est 1 à 3 mots-clés du constat, plus le verbe « Remplacez ».
  // 19 (19/10) : lot B2b des scripts : le corps du script compte 2 à 3 constats « ce qui change » (plus « 2 à 5 étapes »), et
  //   l'exemple de la consigne est un constat à l'indicatif (« À chaque message, une réponse type se prépare. »), plus un
  //   tutoriel numéroté à l'impératif (« Un. Relisez… »).
  // 20 (19/10) : relecture Opus B2a, exemple du gabarit par parties réécrit d'après le témoin v5.
  // 21 (23/10) : style du tableau de la série donné ; scènes de 3 phrases au plus ; détail OU visuel aux styles tableau-blanc et
  //   paperboard (refus page lisible du 23/10, série Automatisations).
  version: 21,
  consigne: CONSIGNE_DECOUPAGE,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: MAX_TOKENS_DECOUPAGE,
  // Simulation : aucune fiche inventée ; `decouperEnScenes` rend un échec « simulation ».
  simuler: () => "",
} satisfies DefinitionRole;

/** Style de la fiche : celui donné, sinon le style par défaut des nouvelles fiches (« reference/2 »). */
export const habillageDe = (e: Pick<EntreeDecoupage, "habillage">) => e.habillage ?? STYLE_PAR_DEFAUT_TABLEAU;

/** Partie variable : les données de cette vidéo, entre balises (données, jamais instructions). */
export function variableDecoupage(e: EntreeDecoupage): string {
  const d = DESCRIPTIONS_STRUCTURES[e.structure];
  return [
    `<fiche_fixe>\n${JSON.stringify({ videoId: e.videoId, versionId: e.versionId, habillage: habillageDe(e), stylo: e.stylo, ratio: e.ratio })}\n</fiche_fixe>`,
    `<structure>\n${e.structure} · ${d.nom} · déroulé : ${d.deroule.join(" → ")} · rôles attendus : ${d.roles.join(", ")} · preuve à l'écran : ${d.preuveEcran}\n</structure>`,
    `<serie>\n${JSON.stringify(e.serie)}\n</serie>`,
    ...(habillageDe(e) === STYLE_REFERENCE_3 ? [`<style_tableau>\n${styleTableauDe({ serie: e.serie })}\n</style_tableau>`] : []),
    `<douleur>\n${e.douleur}\n</douleur>`,
    ...(e.controle.motsDouleur?.length ? [`<mots_douleur>\n${e.controle.motsDouleur.join(", ")}\n</mots_douleur>`] : []),
    ...(e.controle.motsInterdits?.length ? [`<mots_interdits>\n${e.controle.motsInterdits.join(", ")}\n</mots_interdits>`] : []),
    ...(e.controle.interdits?.length ? [`<interdits_de_will>\n${e.controle.interdits.map((i) => i.texte).join("\n")}\n</interdits_de_will>`] : []),
    `<geste_minute>\n${e.gesteMinute}\n</geste_minute>`,
    `<preuves>\n${e.preuves.map((p) => `${p.id} · ${p.resume}`).join("\n") || "(aucune)"}\n</preuves>`,
    `<sources_chiffres>\n${e.controle.sourcesChiffres.join("\n") || "(aucune)"}\n</sources_chiffres>`,
    `<dessins>\n${e.dessins.map((x) => `${x.id} · ${x.motsCles.join(", ")}`).join("\n") || "(aucun)"}\n</dessins>`,
    ...(e.parties?.length ? [`<parties>\n${e.parties.map((p) => `${PAGE_DE_PARTIE[p.partie]}${p.numero ? ` ${p.numero}` : ""} · ${p.libelle} · ${p.texte}`).join("\n")}\n</parties>`] : []),
    `<script_valide>\n${e.texteScript}\n</script_valide>`,
  ].join("\n");
}

/** Variable de la relance : la même, plus la réponse précédente et ses refus exacts. */
export function variableRelance(variable: string, reponsePrecedente: string, refus: readonly string[]): string {
  return `${variable}\n<reponse_precedente>\n${reponsePrecedente}\n</reponse_precedente>\n<refus_fiche_precedente>\n${refus.map((r) => `- ${r}`).join("\n")}\n</refus_fiche_precedente>\nTa fiche précédente a été refusée pour ces raisons. Rends la fiche COMPLÈTE corrigée, en JSON seul. Le texte dit reste le script validé mot pour mot : ne le change jamais pour corriger un autre refus. Les numéros de scènes et de pages des refus sont ceux de ta fiche APRÈS la réparation automatique (scènes coupées, pages décalées) : retrouve chaque scène par son texte dit (premiers mots ou lignes citées).`;
}

/** Coût PIRE d'un appel (entrée estimée au pire + sortie maximale), en dollars. */
export function coutEstimeUsd(role: DefinitionRole, entree: EntreeRole): number {
  const texte = [role.consigne, ...Object.values(entree.contexte), entree.variable].filter(Boolean).join("\n");
  return pireCasUsd(role.modele, jetonsEstimes(texte) + MARGE_PHRASES_FIXES, role.maxTokens);
}

/** Refus fictifs de la relance, à la taille la plus longue prévue (estimation seulement). */
const REFUS_ESTIMATION = ["x".repeat(4000)];

/**
 * Coût PIRE d'un découpage entier (premier appel, puis la relance au pire : réponse précédente de la taille maximale et
 * ses refus), en dollars. C'est le prix à confirmer à l'écran, et l'enveloppe du plafond propre de ce découpage.
 */
export function coutPireDecoupageUsd(entree: EntreeDecoupage, role: DefinitionRole = roleDecoupageTableau): number {
  const base = variableDecoupage(entree);
  const premier = coutEstimeUsd(role, { contexte: {}, variable: base });
  const relance = coutEstimeUsd(role, { contexte: {}, variable: variableRelance(base, "x".repeat(role.maxTokens * 4), REFUS_ESTIMATION) });
  return premier + (APPELS_MAX > 1 ? relance : 0);
}

/* ------------------------------------------------------------------ */
/* Lecture et contrôle d'une réponse                                     */
/* ------------------------------------------------------------------ */

type Lecture = { ok: true; brute: unknown; texte: string } | { ok: false; refus: string; texte: string };

/** Phrase de la réponse coupée (raison d'arrêt « max_tokens »). */
export const MESSAGE_TRONQUEE = "La réponse a été coupée avant la fin (trop longue) : aucune fiche n'a pu être lue. Rien n'est rejoué à l'identique.";

/**
 * Lit la réponse : objet déjà lu, ou texte JSON. Aucune réparation (pas de JSON « deviné ») ; seul un bloc de code
 * Markdown qui entoure tout le JSON est retiré (la forme, pas le contenu).
 */
export function lireReponse(donnees: unknown): Lecture {
  if (donnees === undefined || donnees === null || donnees === "") return { ok: false, refus: "La réponse est vide : aucune fiche rendue.", texte: "" };
  if (typeof donnees !== "string") return { ok: true, brute: donnees, texte: JSON.stringify(donnees) };
  const sansBloc = donnees.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, "$1");
  try {
    return { ok: true, brute: JSON.parse(sansBloc), texte: donnees };
  } catch (e) {
    return { ok: false, refus: `La réponse n'est pas un JSON lisible (${e instanceof Error ? e.message : "erreur de lecture"}) : rendez le JSON seul, sans texte autour.`, texte: donnees };
  }
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

const bordsPonctues = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * Remet en forme les « importants » d'une ligne (champ « Mots importants » de la correction à la main, ou réponse du
 * découpage) : chaque entrée est coupée sur les espaces et les virgules, la ponctuation de bord retirée, et seuls les
 * mots réellement écrits dans la ligne sont gardés (même comparaison que la règle du schéma). Dédoublonné, ordre gardé ;
 * s'il ne reste rien, le champ est retiré. Fonction pure.
 */
function normaliserImportants(el: unknown): unknown {
  if (!estObjet(el) || el.type !== "ligne" || typeof el.texte !== "string" || el.importants === undefined) return el;
  const { importants, ...reste } = el;
  if (!Array.isArray(importants)) return el;
  const dansLaLigne = new Set(el.texte.split(/\s+/).map(cleMot).filter(Boolean));
  const gardes: string[] = [];
  const vus = new Set<string>();
  for (const entree of importants) {
    if (typeof entree !== "string") continue;
    for (const m of entree.split(/[\s,;]+/).map((x) => x.replace(bordsPonctues, "")).filter(Boolean)) {
      const c = cleMot(m);
      if (!c || vus.has(c) || !dansLaLigne.has(c)) continue;
      vus.add(c);
      gardes.push(m);
    }
  }
  return gardes.length ? { ...reste, importants: gardes } : reste;
}

/**
 * Remet en forme les « motsForts » et le « motCommentaire » d'un écran : chaque entrée est coupée sur les espaces, la
 * ponctuation de bord retirée, et seuls les mots réellement écrits dans une ligne de la scène sont gardés (même
 * comparaison que la règle). Les mots vides de 1 ou 2 lettres d'un groupe coupé sont écartés. Dédoublonné, ordre gardé,
 * plafonné ; s'il ne reste rien, le champ est retiré (un champ absent n'est jamais un refus). Fonction pure.
 */
export function normaliserEcrans(brute: unknown): unknown {
  if (!estObjet(brute) || !Array.isArray(brute.scenes)) return brute;
  const scenes = brute.scenes.map((s0) => {
    if (!estObjet(s0) || !Array.isArray(s0.elements)) return s0;
    const elements = s0.elements.map(normaliserImportants);
    const s = { ...s0, elements };
    const ecransBruts: unknown = s0.ecrans;
    if (!Array.isArray(ecransBruts)) return s;
    const lignes = elements.flatMap((el) => (estObjet(el) && el.type === "ligne" && typeof el.texte === "string" ? el.texte.split(/\s+/) : []));
    const reels = new Map<string, string>();
    for (const m of lignes) {
      const c = cleSimple(m);
      if (c && !reels.has(c)) reels.set(c, m.replace(bordsPonctues, ""));
    }
    const ecrans = ecransBruts.map((e: unknown) => {
      if (!estObjet(e)) return e;
      const { motsForts, motCommentaire, ...reste } = e;
      const sortie: Record<string, unknown> = { ...reste };
      if (Array.isArray(motsForts)) {
        const gardes: string[] = [];
        const vus = new Set<string>();
        for (const entree of motsForts) {
          if (typeof entree !== "string") continue;
          const morceaux = entree.split(/\s+/).map((m) => m.replace(bordsPonctues, "")).filter(Boolean);
          const groupe = morceaux.length > 1;
          for (const m of morceaux) {
            const c = cleSimple(m);
            if (!c || vus.has(c) || !reels.has(c) || (groupe && [...m].length <= 2)) continue;
            vus.add(c);
            gardes.push(m);
          }
        }
        const plafonnes = gardes.slice(0, BORNES_ECRAN.motsFortsMax);
        if (plafonnes.length) sortie.motsForts = plafonnes;
      } else if (motsForts !== undefined) sortie.motsForts = motsForts;
      if (typeof motCommentaire === "string") {
        const reel = reels.get(cleSimple(motCommentaire));
        if (reel) sortie.motCommentaire = reel;
        else if (cleSimple(motCommentaire)) sortie.motCommentaire = motCommentaire;
      } else if (motCommentaire !== undefined) sortie.motCommentaire = motCommentaire;
      return sortie;
    });
    return { ...s, ecrans };
  });
  return { ...brute, scenes };
}

/**
 * Les remises en forme déterministes, dans l'ordre : mots forts et importants, formes (ancres bornées, identifiants,
 * gestes orphelins, pages), densité (scène trop chargée coupée, page trop chargée passée à une page de plus), puis
 * rythme (qui répartit les ancres bornées). Lue au découpage et à l'enregistrement d'une
 * correction à la main. Pure ; ne lève jamais ; une fiche qui n'a rien à réparer garde son contenu.
 */
export function remettreEnForme<T>(brute: T, reglages: ReglagesRythme = {}, densite: OptionsDensite = {}): T {
  return reparerRythme(reparerDensite(reparerFormes(normaliserEcrans(brute)), densite), reglages) as T;
}

/** Contrôles propres au découpage, en plus de la validation : champs fixes recopiés, dessins et preuves FOURNIS. */
export function controlesDecoupage(brute: unknown, e: EntreeDecoupage): string[] {
  if (!estObjet(brute)) return ["La réponse n'est pas un objet JSON : une fiche de scènes est attendue."];
  const refus: string[] = [];
  const fixes: Record<string, unknown> = {
    formatId: FORMAT_TABLEAU,
    videoId: e.videoId,
    versionId: e.versionId,
    habillage: habillageDe(e),
    stylo: e.stylo,
    ratio: e.ratio,
    structure: e.structure,
    douleur: e.douleur,
    gesteMinute: e.gesteMinute,
    appelId: null,
  };
  for (const [cle, attendu] of Object.entries(fixes)) {
    if (brute[cle] !== attendu) refus.push(`Le champ « ${cle} » vaut ${JSON.stringify(brute[cle]) ?? "rien"}, attendu ${JSON.stringify(attendu)} (recopié tel quel).`);
  }
  const serie = brute.serie;
  if (!estObjet(serie) || serie.code !== e.serie.code || serie.nom !== e.serie.nom) refus.push(`La série doit être recopiée telle quelle : ${JSON.stringify(e.serie)}.`);
  const dessins = new Set(e.dessins.map((d) => d.id));
  const preuves = new Set(e.preuves.map((p) => p.id));
  const scenes = Array.isArray(brute.scenes) ? brute.scenes : [];
  for (const s of scenes) {
    if (!estObjet(s) || !Array.isArray(s.elements)) continue;
    for (const el of s.elements) {
      if (!estObjet(el)) continue;
      if (el.type === "dessin" && !dessins.has(String(el.dessinId))) refus.push(`Scène ${String(s.id)} : le dessin « ${String(el.dessinId)} » n'est pas dans la liste fournie.`);
      if (el.type === "preuve" && !preuves.has(String(el.preuveId))) refus.push(`Scène ${String(s.id)} : la preuve « ${String(el.preuveId)} » n'est pas dans la liste fournie.`);
    }
  }
  return refus;
}

/**
 * Une fiche refusée est-elle LISIBLE (assez bien formée pour être affichée et corrigée à la main) ? Des scènes, chacune
 * avec un identifiant, un texte dit et des éléments. Sinon elle n'est pas gardée (le refus est dit quand même).
 */
export function ficheLisible(brute: unknown): brute is FicheTableau {
  if (!estObjet(brute) || !Array.isArray(brute.scenes) || !brute.scenes.length) return false;
  return brute.scenes.every(
    (s) =>
      estObjet(s) &&
      typeof s.id === "string" &&
      typeof s.texteDit === "string" &&
      typeof s.page === "number" &&
      typeof s.role === "string" &&
      Array.isArray(s.elements) &&
      s.elements.every((e) => estObjet(e) && typeof e.id === "string" && typeof e.type === "string") &&
      (s.ecrans === undefined || Array.isArray(s.ecrans)),
  );
}

/** La fiche lisible refusée, gardée « à corriger » : les champs FIXES remis à leur valeur, le reste tel que rendu. */
export function ficheACorriger(rendue: FicheTableau, e: EntreeDecoupage): FicheTableau {
  return avecStyleTableau({ ...(remettreEnForme(avecStyleDeLaSerie(appliquerParties(rendue, e.parties), e), { debit: e.controle.caracteresParSeconde, motsDouleur: e.controle.motsDouleur }) as FicheTableau), version: "fiche-scenes/1", formatId: FORMAT_TABLEAU, videoId: e.videoId, versionId: e.versionId, habillage: habillageDe(e), stylo: e.stylo, ratio: e.ratio, structure: e.structure, serie: { ...e.serie }, douleur: e.douleur, gesteMinute: e.gesteMinute, appelId: null } as FicheTableau);
}

/**
 * « reference/3 » : le style du tableau de la série est posé pour la VALIDATION (la page « tient-elle ? »), comme à la
 * fabrication (`pagesDuStyle`) : la page est jugée dans le style où elle sera dessinée, pas dans la page « ivoire » que la
 * vidéo n'utilise jamais (brouillon v-365dd2ae67ee, 18/10/2026). Il est posé AVANT les remises en forme : la page de plus
 * (densité) est faite dans ce style, comme `pagesDuStyle` (refus du 23/10/2026, série Automatisations). Un style déjà posé est gardé.
 */
export function avecStyleDeLaSerie<T>(brute: T, e: Pick<EntreeDecoupage, "habillage" | "serie">): T {
  if (!estObjet(brute) || habillageDe(e) !== STYLE_REFERENCE_3 || brute.styleTableau !== undefined) return brute;
  return { ...brute, styleTableau: styleTableauDe({ serie: e.serie }) } as T;
}

/** Juge une réponse lue : contrôles du découpage, puis validation complète de la fiche. */
export function jugerFiche(rendue: unknown, e: EntreeDecoupage): { ok: true; fiche: FicheTableau; retraits: RetraitAllegement[] } | { ok: false; refus: string[] } {
  // Remises en forme déterministes : mots forts et importants, formes (ancres bornées…), puis rythme.
  // Les parties du script (quand le générateur les rend) fixent la partie de chaque page et les numéros d'étape.
  const lue = appliquerParties(rendue, e.parties);
  const jugee = avecStyleDeLaSerie(lue, e); // le style de la série est posé AVANT les réparations (page de plus)
  // Allègement de dernier recours : AU DÉCOUPAGE seulement, et noté (`retraits`). `verifier` : les problèmes de validation hors règle de page.
  const retraits: RetraitAllegement[] = [];
  const verifier = (f: FicheTableau) => {
    const r = validerFicheTableau(f, { ...e.controle, texteScript: e.texteScript });
    return r.ok ? 0 : r.problemes.filter((p) => p.regle !== REGLE_PAGE_LISIBLE).length;
  };
  const brute = remettreEnForme(jugee, { debit: e.controle.caracteresParSeconde, motsDouleur: e.controle.motsDouleur }, { alleger: true, retraits, verifier });
  const propres = controlesDecoupage(brute, e);
  const v = validerFicheTableau(brute, { ...e.controle, texteScript: e.texteScript });
  const dejaTraitees = new Set<number>();
  const refus = [...propres, ...(v.ok ? [] : v.problemes.map((p) => p.message + conseilDe(p.regle) + raisonPageDePlus(p, brute, dejaTraitees)))];
  if (refus.length || !v.ok) return { ok: false, refus };
  // Le style n'a servi qu'à juger : la fiche rendue reste celle d'avant (la fabrication le pose à son tour).
  if (jugee === lue) return { ok: true, fiche: v.fiche, retraits };
  const fiche = { ...v.fiche };
  delete fiche.styleTableau;
  return { ok: true, fiche, retraits };
}

const REGLE_PAGE_LISIBLE = REGLES_TABLEAU.find((r) => r.numero === 4)!.nom;

/**
 * Refus de la règle 4 (page lisible) : POURQUOI la page de plus automatique n'a pas pu passer, et quoi faire. Seulement
 * sur le chemin du refus, et seulement quand la réparation a été tentée (page écrite au crayon) ; ne lève jamais.
 */
function raisonPageDePlus(p: { regle: string; message: string }, brute: unknown, dejaTraitees: Set<number>): string {
  if (p.regle !== REGLE_PAGE_LISIBLE) return "";
  try {
    const fiche = brute as FicheTableau;
    const page = Number(/page (\d+)/i.exec(p.message)?.[1]);
    if (!Number.isInteger(page) || !Array.isArray(fiche?.scenes) || !estPageEcriteCrayon(fiche)) return "";
    // Seulement si une page de plus corrigerait ce refus (un mot trop long, un mot important hors ligne : autre message).
    if (pageTropChargee(fiche) !== page || dejaTraitees.has(page)) return "";
    const diag = diagnosticPageDePlus(fiche, page);
    if (!diag) return "";
    dejaTraitees.add(page); // un seul complément par page, même si la page a deux refus
    const scenes = fiche.scenes.filter((s) => s.page === page);
    const derniere = scenes.at(-1);
    if (!derniere) return "";
    const debut = derniere.texteDit.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
    const garder = "gardez sur cette page UN détail OU le visuel";
    let quoi: string;
    if (diag.type === "une-phrase" || diag.type === "coupe-impossible") quoi = `${garder}, ou raccourcissez une ligne écrite`;
    else if (diag.type === "scenes-max") quoi = `réunissez deux scènes voisines d'une autre page, ou ${garder}`;
    else if (diag.type === "pages-max") quoi = `réunissez deux pages courtes, ou ${garder}`;
    else if (scenes.length >= 2) quoi = `mettez la scène ${derniere.id} « ${debut} » seule sur une page NEUVE juste après (même partie, pages suivantes décalées de un)${diag.type === "regle-page" ? ", en respectant la règle citée" : ""}`;
    else quoi = `coupez la scène ${derniere.id} « ${debut} » en deux scènes à une fin de phrase (la seconde sur la page suivante, même partie, avec sa propre ligne écrite)${diag.type === "regle-page" ? ", en respectant la règle citée" : ""}, ou ${garder}`;
    return ` La page de plus automatique a échoué : ${diag.texte}. ${quoi.charAt(0).toUpperCase()}${quoi.slice(1)}.`;
  } catch {
    return "";
  }
}

/**
 * Ce qu'il faut faire après un refus que la réparation automatique n'a pas pu lever (elle coupe une scène trop chargée à
 * une fin de phrase, et passe une page trop chargée à une page de plus, avant de refuser).
 */
function conseilDe(regle: string): string {
  if (regle === "nombre d'éléments") return " La coupe automatique n'a trouvé aucune fin de phrase où couper : coupez la scène en deux à une fin de phrase (6 éléments au plus chacune), ou retirez un geste ou un dessin.";
  if (regle === "nombre de scènes") return " Réunissez deux scènes voisines de la même page.";
  if (regle === "pages croissantes") return " Plus de page libre : réunissez deux pages courtes, ou raccourcissez le texte écrit d'une page.";
  return "";
}

/* ------------------------------------------------------------------ */
/* Découpage                                                             */
/* ------------------------------------------------------------------ */

/**
 * Découpe un script validé en fiche de scènes brute (voir l'en-tête). Au plus 2 appels Claude, chacun précédé de sa
 * réservation. `ok: false` : la main revient à Will avec les refus en français.
 */
export async function decouperEnScenes(entree: EntreeDecoupage, outils: OutilsDecoupage): Promise<ResultatDecoupage> {
  const role = roleDecoupageTableau;
  const base = variableDecoupage(entree);
  let variable = base;
  let refus: string[] = [];
  let appels = 0;
  /** Dernière fiche lisible refusée par les règles (gardée « à corriger »), et si la dernière réponse était illisible. */
  let aCorriger: FicheTableau | undefined;
  let illisible = false;

  for (let essai = 1; essai <= APPELS_MAX; essai++) {
    const entreeRole: EntreeRole = { contexte: {}, variable };
    const appelId = `${PREFIXE_APPEL_DECOUPAGE}-${entree.videoId}-${entree.versionId}-${essai}`;
    const reservation = await outils.budget.reserver({ appelId, videoId: entree.videoId, etape: ETAPE_DECOUPAGE, modele: role.modele, coutEstimeUsd: coutEstimeUsd(role, entreeRole) });
    if (!reservation.ok) {
      return { ok: false, motif: "budget", message: `Découpage non lancé : ${reservation.message}`, refus, appels };
    }

    appels++;
    const reponse = await outils.appeler(role, entreeRole);
    if (!reponse.ok) return { ok: false, motif: "appel", message: `Découpage interrompu : ${reponse.message}`, refus, appels };
    if (reponse.simule) return { ok: false, motif: "simulation", message: "Claude n'est pas relié : aucun découpage automatique, la fiche est à faire à la main.", refus, appels };

    // Réponse coupée : JAMAIS rejouée à l'identique (elle serait coupée de même) ; la main revient à Will.
    if (reponse.stopReason === "max_tokens") return { ok: false, motif: "tronquee", message: MESSAGE_TRONQUEE, refus: [MESSAGE_TRONQUEE], appels, ...(aCorriger ? { aCorriger } : {}) };
    if (reponse.stopReason === "refusal") return { ok: false, motif: "illisible", message: "Claude a refusé de rendre la fiche : rien n'a pu être lu.", refus, appels, ...(aCorriger ? { aCorriger } : {}) };

    const lecture = lireReponse(reponse.donnees);
    const jugement = lecture.ok ? jugerFiche(lecture.brute, entree) : { ok: false as const, refus: [lecture.refus] };
    if (jugement.ok) {
      // Un allègement de dernier recours a retiré du contenu écrit : jamais en silence (trace serveur + résultat).
      if (jugement.retraits.length) console.warn(`[tableau] découpage ${entree.videoId} : page allégée, retraits ${jugement.retraits.map((r) => `${r.sceneId}/${r.elementId} (${r.type}, page ${r.page})`).join(", ")}`);
      return { ok: true, fiche: jugement.fiche, appels, relance: essai > 1, ...(jugement.retraits.length ? { retraits: jugement.retraits } : {}) };
    }

    illisible = !lecture.ok;
    if (lecture.ok && ficheLisible(lecture.brute)) aCorriger = ficheACorriger(lecture.brute, entree);
    refus = jugement.refus;
    variable = variableRelance(base, lecture.texte, refus);
  }

  if (illisible && !aCorriger) {
    return { ok: false, motif: "illisible", message: `Aucune fiche lisible après ${APPELS_MAX} essais : réessayez.`, refus, appels };
  }
  return {
    ok: false,
    motif: "refusee",
    message: `Fiche de scènes refusée par les règles après ${APPELS_MAX} essais (${refus.length} refus)${aCorriger ? " : elle est gardée, à corriger à la main ou à refaire." : " : à reprendre à la main."}`,
    refus,
    appels,
    ...(aCorriger ? { aCorriger } : {}),
  };
}
