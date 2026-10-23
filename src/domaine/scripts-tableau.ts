/**
 * SCRIPTS DU TABLEAU ANIMÉ (générateur propre au format `tableau-anime`) — domaine PUR : la demande, le résultat,
 * leurs schémas de validation, les fourchettes de durée par réseau et la grille de qualité.
 *
 * Source des règles : `docs/formats/tableau-anime-scripts/REGLES.md` (v4 du 15/10, gabarit cadré validé par Will :
 * UNE idée, UN gain, UNE preuve ; six passages accroche → douleur → promesse et boucle ouverte → étapes (2 à 5, 3 par
 * défaut) → exemple = promesse tenue → à retenir et appel ; bornes de mots ; grille qui juge la valeur ; contrat avec le
 * découpage) et `exemples-v4/` (l'exemple validé).
 * Pièce À CÔTÉ du générateur de l'avocat (`src/generateur/**`) : rien n'en est importé.
 * Les contrôles en code, indépendants du modèle, vivent dans `scripts-tableau-controles.ts`.
 */
import { z } from "zod";
import { DOULEUR_MAX_TABLEAU, MOTS_DOULEUR_MAX, MOTS_DOULEUR_MIN } from "./douleur-tableau";
import { DUREE_MAX_TABLEAU_SEC } from "./duree-tableau";

/* ------------------------------------------------------------------ */
/* Valeurs fermées                                                     */
/* ------------------------------------------------------------------ */

/** Les quatre séries (REGLES § 4). */
export const SERIES_TABLEAU = ["formation", "audit", "automatisations", "coaching"] as const;
export type SerieTableau = (typeof SERIES_TABLEAU)[number];

/** Ce dont parle chaque série, formulé en question du spectateur (REGLES § 2 bis et § 4). */
export const SUJET_DE_SERIE: Record<SerieTableau, { parleDe: string; question: string; apprend: string }> = {
  formation: { parleDe: "Former une équipe à l'IA", question: "Comment apprend-on vraiment ?", apprend: "Ce qui fait qu'un apprentissage change vraiment le travail" },
  audit: { parleDe: "Regarder où l'entreprise perd du temps", question: "Comment voir où l'on perd du temps ?", apprend: "Où l'entreprise perd du temps, et ce qu'on y change" },
  automatisations: { parleDe: "Une tâche qui tourne toute seule", question: "Qu'est-ce qui peut tourner tout seul, et comment ?", apprend: "Ce qui change, de bout en bout" },
  coaching: { parleDe: "Une décision de dirigeant", question: "Comment trancher une décision ?", apprend: "Une façon de trancher" },
};

/**
 * Réseaux (REGLES § 5), avec leur fourchette de durée en secondes. Revues le 12/10 : la vidéo modèle validée par Will
 * dure 51 s en vertical ; l'ancienne fourchette des courts (30 à 45 s) la refusait. Les autres réseaux suivent le même
 * esprit (la vidéo modèle y passe aussi). Un écart de moins de 10 % est une remarque, pas un défaut éliminatoire.
 * Aucune borne haute ne dépasse le plafond du découpage (`DUREE_MAX_TABLEAU_SEC`, 90 s) : un script accepté par le
 * générateur n'est jamais refusé pour sa durée au découpage (YouTube ramené de 120 à 90 s le 12/10 ; la tolérance de
 * 10 % s'arrête aussi au plafond).
 */
export const RESEAUX_SCRIPT = ["courts", "fil", "linkedin", "youtube"] as const;
export type ReseauScript = (typeof RESEAUX_SCRIPT)[number];

export const RESEAUX_SCRIPT_INFOS: Record<ReseauScript, { libelle: string; dimensions: string; dureeMin: number; dureeMax: number; accroche: string; fin: string }> = {
  // dureeMin 40 (4e passe) : 125 mots courts (4 lettres) font ~37 s, tolérance de 10 % comprise.
  // v4 (15/10) : la vidéo de 60 s fait 160 à 190 mots (55 à 70 s selon la voix) ; B2b (19/10) : 125 à 145 mots, voix à 165 mots/min ; celle de 30 s, 75 à 95 mots
  // (`DUREES_SCRIPT`, la fourchette du réseau ne vaut alors plus). Le plafond du découpage (90 s) reste loin.
  courts: { libelle: "TikTok, Reels, Shorts, stories", dimensions: "Vertical plein écran", dureeMin: 40, dureeMax: 75, accroche: "Directe, la douleur d'abord", fin: "Commentaire ou diagnostic" },
  fil: { libelle: "Fil Instagram et Facebook", dimensions: "Vertical moins haut", dureeMin: 40, dureeMax: 75, accroche: "Proche, concrète", fin: "Commentaire" },
  linkedin: { libelle: "LinkedIn", dimensions: "Vertical plein écran", dureeMin: 40, dureeMax: DUREE_MAX_TABLEAU_SEC, accroche: "Professionnelle, posée", fin: "Diagnostic" },
  youtube: { libelle: "YouTube classique", dimensions: "Horizontal", dureeMin: 40, dureeMax: DUREE_MAX_TABLEAU_SEC, accroche: "Promesse claire", fin: "Abonnement" },
};

/** Les cinq types d'accroche demandés à la première passe (REGLES § 6). */
export const TYPES_ACCROCHE = ["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const;
export type TypeAccroche = (typeof TYPES_ACCROCHE)[number];

/** Mention obligatoire à l'écran d'un exemple qui n'est pas un vrai cas (REGLES § 3). */
export const MENTION_ILLUSTRATIF = "Exemple illustratif";

/**
 * LA QUESTION SUR L'IA (accord de Will du 18/10, plan « scripts et voix du tableau » § 3 point 3) : les quatre
 * formulations VALIDÉES, mot pour mot. Une seule est dite par vidéo, juste avant la phrase sur l'entreprise (qui y
 * répond), jamais écrite à l'écran ; elle tourne d'une vidéo à l'autre (`questionIaSuivante`).
 */
export const QUESTIONS_IA = [
  "En quoi l'IA peut-elle vous aider ?",
  "Et l'IA, que peut-elle faire pour vous ici ?",
  "Où l'IA peut-elle vous aider là-dedans ?",
  "Concrètement, comment l'IA peut-elle vous aider ?",
] as const;

/** Nombre de scripts livrés récents dont la formulation n'est pas reprise (comme les métiers des exemples). */
export const QUESTIONS_IA_RECENTES = 3;

const formeQuestion = (t: string) => t.toLowerCase().replace(/[’ʼ`]/g, "'").replace(/\s+/g, " ").trim();

/** La formulation de la liste dite dans un texte, s'il y en a une. */
export function questionIaDuTexte(texte: string): (typeof QUESTIONS_IA)[number] | undefined {
  const t = formeQuestion(texte);
  return QUESTIONS_IA.find((q) => t.includes(formeQuestion(q)));
}

/**
 * Formulation à dire (PUR), d'après celles des derniers scripts livrés (la plus récente d'abord) : la suivante de la
 * plus récente dans la liste, en sautant celles des 3 dernières. Sans historique : la première.
 */
export function questionIaSuivante(recentes: readonly string[] | undefined): (typeof QUESTIONS_IA)[number] {
  const connues = (recentes ?? []).map((q) => QUESTIONS_IA.findIndex((x) => formeQuestion(x) === formeQuestion(q))).filter((i) => i >= 0);
  if (!connues.length) return QUESTIONS_IA[0];
  const evitees = new Set(connues.slice(0, QUESTIONS_IA_RECENTES));
  for (let k = 1; k <= QUESTIONS_IA.length; k++) {
    const i = (connues[0] + k) % QUESTIONS_IA.length;
    if (!evitees.has(i)) return QUESTIONS_IA[i];
  }
  return QUESTIONS_IA[(connues[0] + 1) % QUESTIONS_IA.length];
}

/**
 * Durée visée (gabarit cadré du 15/10) : 60 s (par défaut) ou 30 s. Elle fixe les bornes de mots du script entier et de
 * chaque passage, et le nombre d'étapes permis (`scripts-tableau-controles.ts`).
 */
export const DUREES_SCRIPT = [60, 30] as const;
export type DureeScript = (typeof DUREES_SCRIPT)[number];

/* ------------------------------------------------------------------ */
/* La demande                                                          */
/* ------------------------------------------------------------------ */

const texteCourt = (max: number) => z.string().trim().min(1, "Champ vide.").max(max, `${max} caractères au plus.`);

export const schemaVraiCas = z.strictObject({
  metier: texteCourt(120),
  tache: texteCourt(200),
  avant: texteCourt(400),
  apres: texteCourt(400),
  /** Date du cas (AAAA-MM-JJ ou texte libre court). */
  date: texteCourt(40),
});
export type VraiCas = z.infer<typeof schemaVraiCas>;

export const schemaFinDemandee = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("commentaire"), mot: z.string().trim().regex(/^[\p{L}\p{N}-]{2,20}$/u, "Un seul mot, sans espace (2 à 20 lettres).") }),
  z.strictObject({ type: z.literal("diagnostic") }),
]);
export type FinDemandee = z.infer<typeof schemaFinDemandee>;

export const schemaDemandeScript = z.strictObject({
  serie: z.enum(SERIES_TABLEAU),
  /** Le sujet en une ligne. */
  sujet: texteCourt(160).refine((s) => !/\n/.test(s), "Le sujet tient en une ligne."),
  public: texteCourt(200),
  vraiCas: schemaVraiCas.nullable().default(null),
  reseau: z.enum(RESEAUX_SCRIPT),
  fin: schemaFinDemandee,
  /** Ce qui sera envoyé à ceux qui commentent (ou ce que l'appel de diagnostic apporte). */
  envoi: texteCourt(300),
  /** Durée visée : 60 s (absente : 60 s) ou 30 s. */
  duree: z.union([z.literal(60), z.literal(30)]).optional(),
});
export type DemandeScriptTableau = z.infer<typeof schemaDemandeScript>;
export type DemandeScriptTableauSaisie = z.input<typeof schemaDemandeScript>;

/* ------------------------------------------------------------------ */
/* Le résultat                                                         */
/* ------------------------------------------------------------------ */

/** Une phrase : le texte dit, et les 2 à 6 mots écrits à l'écran pendant qu'elle est dite. */
export const schemaPhrase = z.strictObject({
  dit: z.string(),
  ecran: z.string(),
});
export type PhraseScript = z.infer<typeof schemaPhrase>;

export const schemaAccroche = z.strictObject({
  type: z.enum(TYPES_ACCROCHE),
  dit: z.string(),
  ecran: z.string(),
  /** Pourquoi elle peut marcher (ou pas) sur ce sujet. */
  pourquoi: z.string(),
});
export type AccrocheProposee = z.infer<typeof schemaAccroche>;

/** Sortie de la passe 1 : l'angle et cinq accroches de types tous différents. */
export const schemaAngle = z
  .strictObject({
    /** La question que le spectateur se pose (jamais une offre). */
    angle: z.string(),
    /**
     * La douleur générale, avec un détail vrai, au vouvoiement : 140 caractères au plus (borne de la
     * fiche). La borne n'est pas imposée à la lecture (une réponse un peu longue n'est pas jetée) : le service la
     * raccourcit à la première phrase entière qui tient (`raccourcirDouleur`).
     */
    douleur: z.string().describe(`La douleur en une phrase, au vouvoiement, ${DOULEUR_MAX_TABLEAU} caractères au plus.`),
    accroches: z.array(schemaAccroche).length(5),
    /** Rang (0 à 4) de l'accroche retenue. */
    retenue: z.number().int().min(0).max(4),
    raison: z.string(),
  })
  .refine((a) => new Set(a.accroches.map((x) => x.type)).size === 5, { message: "Les cinq accroches doivent être de cinq types différents.", path: ["accroches"] });
export type AngleScript = z.infer<typeof schemaAngle>;

/**
 * Une étape (REGLES v4 § 3) : l'ACTION (« Un. », puis un verbe et son objet) et UNE ou DEUX phrases concrètes
 * (`comment` : le geste montré, un exemple de contenu, pourquoi). Plus de triplet action, comment, résultat obligatoire
 * (15/10 : il empilait trois phrases par étape) : `resultat` est facultatif, il reste lu sur une trace ancienne.
 */
export const schemaEtape = z.strictObject({
  /** « Un. Remplacez les noms par des lettres. » : numéro dit en lettres, puis le verbe et son objet. */
  action: schemaPhrase,
  /** Une ou deux phrases concrètes (une seule au-delà de 4 étapes en 60 s, et en 30 s). */
  comment: z.array(schemaPhrase),
  /** Ancien résultat de l'étape (trace d'avant le 15/10) ; facultatif. */
  resultat: schemaPhrase.optional(),
});
export type EtapeScript = z.infer<typeof schemaEtape>;

/**
 * Le script v3, par PARTIE NOMMÉE, dans l'ordre fixe (REGLES § 3) : accroche → douleur → solution (la promesse, puis
 * les étapes) → exemple → à retenir → appel. La dernière phrase de `appel` est la clôture. Plus de « retournement » ni
 * de « récapitulatif » (Will, 14/10 : « c'est écrit problème alors que ce n'est pas ça qui nous intéresse ») ; une trace
 * ancienne est relue par `normaliserScript`.
 */
export const schemaScript = z.strictObject({
  accroche: z.array(schemaPhrase),
  douleur: z.array(schemaPhrase),
  /** La promesse (le gain et le nombre RÉEL d'étapes), puis la boucle ouverte : une ou deux phrases. */
  promesse: z.array(schemaPhrase),
  /** Les étapes : 2 à 5 (3 par défaut ; 2 ou 3 en 30 s). */
  etapes: z.array(schemaEtape),
  exemple: z.strictObject({
    /** « Exemple illustratif » s'il n'y a pas de vrai cas ; vide sinon. */
    mentionEcran: z.string(),
    /** La situation, l'avant (« Avant, … »), l'après (« Maintenant, … ») : la promesse tenue, le gain visible. */
    phrases: z.array(schemaPhrase),
  }),
  /** À retenir : l'IDÉE, en une phrase (jamais une liste de verbes, jamais la clôture). */
  aRetenir: z.array(schemaPhrase),
  appel: z.array(schemaPhrase),
});
export type ScriptTableau = z.infer<typeof schemaScript>;

/** Les phrases d'une étape, dans l'ordre dit : l'action, les phrases concrètes, puis l'ancien résultat s'il est dit. */
export function phrasesEtape(e: EtapeScript): PhraseScript[] {
  return [e.action, ...e.comment, ...(e.resultat?.dit.trim() ? [e.resultat] : [])];
}

/** Moments dans l'ordre du script, avec leur libellé (écran du studio). */
export const MOMENTS_SCRIPT = [
  ["accroche", "Accroche"],
  ["douleur", "Douleur"],
  ["promesse", "Promesse"],
  ["etapes", "Étapes"],
  ["exemple", "Exemple"],
  ["aRetenir", "À retenir"],
  ["appel", "Appel"],
] as const;

/**
 * Lecture TOLÉRANTE d'un script (PUR) : un script v3 est rendu tel quel ; un script d'avant le 14/10 (traces, brouillons
 * enregistrés : `retournement`, `recapitulatif`, étapes en `phrases`) est remis dans la forme v3 pour être affiché et
 * recontrôlé avec les règles en vigueur (il y échouera : il n'a ni résultat par étape ni promesse seule). Jamais d'erreur.
 */
export function normaliserScript(brut: unknown): ScriptTableau {
  const s = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const liste = (x: unknown): PhraseScript[] =>
    Array.isArray(x) ? x.filter((p): p is PhraseScript => !!p && typeof p === "object" && typeof (p as PhraseScript).dit === "string").map((p) => ({ dit: p.dit, ecran: typeof p.ecran === "string" ? p.ecran : "" })) : [];
  const vide: PhraseScript = { dit: "", ecran: "" };
  const etapes = (Array.isArray(s.etapes) ? s.etapes : []).map((e): EtapeScript => {
    const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    if (o.action && typeof o.action === "object") {
      const resultat = liste([o.resultat])[0];
      return { action: liste([o.action])[0] ?? vide, comment: liste(o.comment), ...(resultat?.dit.trim() ? { resultat } : {}) };
    }
    // Ancienne forme : `phrases` (l'action, puis l'explication).
    const ph = liste(o.phrases);
    return { action: ph[0] ?? vide, comment: ph.slice(1) };
  });
  const exemple = (s.exemple && typeof s.exemple === "object" ? s.exemple : {}) as Record<string, unknown>;
  return {
    accroche: liste(s.accroche),
    douleur: liste(s.douleur),
    promesse: liste(s.promesse ?? s.retournement),
    etapes,
    exemple: { mentionEcran: typeof exemple.mentionEcran === "string" ? exemple.mentionEcran : "", phrases: liste(exemple.phrases) },
    aRetenir: liste(s.aRetenir ?? s.recapitulatif),
    appel: liste(s.appel),
  };
}

/* ------------------------------------------------------------------ */
/* Les parties nommées, pour le découpage (REGLES § « Contrat… »)       */
/* ------------------------------------------------------------------ */

/** Les parties nommées du script, dans l'ordre fixe. `solution` : la promesse et sa boucle ; chaque étape est sa propre partie. */
export const PARTIES_SCRIPT = ["accroche", "douleur", "solution", "etape", "exemple", "a-retenir", "appel"] as const;
export type IdPartie = (typeof PARTIES_SCRIPT)[number];

/** Libellé d'une partie, tel qu'il peut titrer une page (jamais « problème »). */
export const LIBELLES_PARTIES: Record<IdPartie, string> = {
  accroche: "Accroche",
  douleur: "Douleur",
  solution: "Solution",
  etape: "Étape",
  exemple: "Exemple",
  "a-retenir": "À retenir",
  appel: "Appel",
};

/**
 * Une partie du texte dit, pour le découpage : son nom, son libellé, et son texte, MOT POUR MOT (les phrases dites de la
 * partie jointes par une espace). Mises bout à bout, jointes par une espace, les parties redonnent EXACTEMENT le texte
 * dit (`partiesAccordees`). Étape : `numero` (1 à 5) et, à part, l'action, les phrases concrètes (`comment`) et l'ancien
 * résultat (vide depuis le 15/10), sous-chaînes exactes de `texte`. Exemple : `mention` (« Exemple illustratif » ou vide).
 */
export interface PartieScript {
  partie: IdPartie;
  libelle: string;
  texte: string;
  /** Les mots à l'écran de chaque phrase de la partie, dans l'ordre (2 à 6 mots chacun). */
  ecran: string[];
  numero?: number;
  etape?: { action: string; comment: string; resultat: string };
  mention?: string;
}

const joindre = (ph: readonly PhraseScript[]) =>
  ph
    .map((p) => p.dit.trim())
    .filter(Boolean)
    .join(" ");
const ecrans = (ph: readonly PhraseScript[]) => ph.filter((p) => p.dit.trim()).map((p) => p.ecran.trim());

/** Les parties nommées d'un script (PUR), dans l'ordre fixe ; une partie vide n'est pas rendue. */
export function partiesDuScript(brut: ScriptTableau): PartieScript[] {
  const s = normaliserScript(brut);
  const parties: PartieScript[] = [];
  const ajouter = (partie: IdPartie, ph: readonly PhraseScript[], plus: Partial<PartieScript> = {}) => {
    const texte = joindre(ph);
    if (texte) parties.push({ partie, libelle: LIBELLES_PARTIES[partie], texte, ecran: ecrans(ph), ...plus });
  };
  ajouter("accroche", s.accroche);
  ajouter("douleur", s.douleur);
  ajouter("solution", s.promesse);
  s.etapes.forEach((e, i) =>
    ajouter("etape", phrasesEtape(e), { libelle: `${LIBELLES_PARTIES.etape} ${i + 1}`, numero: i + 1, etape: { action: e.action.dit.trim(), comment: joindre(e.comment), resultat: e.resultat?.dit.trim() ?? "" } }),
  );
  ajouter("exemple", s.exemple.phrases, { mention: s.exemple.mentionEcran.trim() });
  ajouter("a-retenir", s.aRetenir);
  ajouter("appel", s.appel);
  return parties;
}

/** Vrai si les parties, jointes par une espace, redonnent exactement le texte dit (espaces resserrées). */
export function partiesAccordees(parties: readonly Pick<PartieScript, "texte">[] | undefined, texteDit: string): boolean {
  if (!parties?.length) return false;
  const resserrer = (t: string) => t.replace(/\s+/g, " ").trim();
  return resserrer(parties.map((p) => p.texte).join(" ")) === resserrer(texteDit);
}

/** Chiffre déclaré : l'extrait tel qu'il est dit, et sa source (vide : aucune source, le chiffre est refusé). */
export const schemaSource = z.strictObject({ extrait: z.string(), source: z.string() });
export type SourceChiffre = z.infer<typeof schemaSource>;

export const schemaVariante = z.strictObject({
  reseau: z.enum(RESEAUX_SCRIPT),
  /** Ce qui change par rapport au script principal (étape retirée, accroche, fin). */
  changements: z.string(),
  /** Le texte dit complet de la variante. */
  texteDit: z.string(),
});
export type VarianteScript = z.infer<typeof schemaVariante>;

/** Nature d'une affirmation relevée (REGLES § « Vérité ») : un fait, une consigne donnée au spectateur, ou un détail de l'exemple illustratif. */
export const NATURES_AFFIRMATION = ["fait", "consigne", "exemple"] as const;

/**
 * Une affirmation du texte dit, relevée et justifiée (REGLES § « Vérité », éliminatoire) : l'extrait tel qu'il est dit,
 * sa nature, et POURQUOI il est vrai (ou sûr, pour une consigne). Toute phrase qui porte un mot absolu ou juridique
 * (« jamais », « toujours », « rien », « aucun », « RGPD », « loi »…) doit être couverte (`controlerVerite`).
 */
export const schemaAffirmation = z.strictObject({
  extrait: z.string(),
  nature: z.enum(NATURES_AFFIRMATION),
  pourquoi: z.string(),
});
export type AffirmationScript = z.infer<typeof schemaAffirmation>;

/**
 * Le GAIN du script (règle d'or du 15/10 : UNE idée, UN gain, UNE preuve) : ce que le spectateur gagne, en une
 * formule courte, et son UNITÉ (un mot de la formule : « lignes », « minutes », « données »). La promesse l'annonce
 * (au moins un mot de la formule) ; l'exemple le montre (l'unité y est dite). Contrôlé par `controlerGain`.
 */
export const schemaGain = z.strictObject({
  /** « Six lignes collées au lieu de tout le fil de mails ». */
  formule: z.string(),
  /** « lignes » : un mot de la formule. */
  unite: z.string(),
});
export type GainScript = z.infer<typeof schemaGain>;

/** Longueur maximale du métier de l'exemple (`metierExemple`) : coupé après lecture (la borne n'est pas envoyée à Claude), pour que l'estimation du prix reste vraie. */
export const METIER_EXEMPLE_MAX = 60;

/** Sortie de la passe 2 (écriture). */
export const schemaEcriture = z.strictObject({
  /** L'IDÉE unique du script, en une phrase : « À retenir » la dit. */
  idee: z.string(),
  gain: schemaGain,
  /** Le métier de l'exemple (« assistante », « plombier ») : jamais celui d'un des 3 derniers scripts. 60 caractères au plus (le prix annoncé compte trois métiers de cette longueur). */
  metierExemple: z.string(),
  script: schemaScript,
  /**
   * Les « mots de la douleur » : 2 à 4 mots (ou courtes expressions) recopiés MOT POUR MOT de l'accroche dite, l'un
   * d'eux dans les 3 premières secondes. Le découpage les dit, les écrit et les entoure au début (règles « douleur en
   * tête » et « geste fort ») ; contrôlés en code (`controlerMotsDouleur`). Absents d'une trace ancienne : vide.
   */
  motsDouleur: z.array(z.string()).describe(`${MOTS_DOULEUR_MIN} à ${MOTS_DOULEUR_MAX} mots de la douleur, recopiés mot pour mot de l'accroche dite, l'un d'eux dans ses premiers mots.`),
  sources: z.array(schemaSource),
  /** Chaque affirmation de fait (et chaque consigne absolue) du texte dit, avec pourquoi elle est vraie. */
  affirmations: z.array(schemaAffirmation),
  variantes: z.array(schemaVariante),
  /** Ce qui doit exister avant publication (document envoyé, source d'un chiffre…). */
  aPreparer: z.array(z.string()),
});
export type EcritureScript = z.infer<typeof schemaEcriture>;

/* ------------------------------------------------------------------ */
/* La grille de qualité (REGLES § 7)                                   */
/* ------------------------------------------------------------------ */

export const CRITERES_GRILLE = [
  { id: "une-idee", libelle: "Une seule idée, que « À retenir » dit en une phrase ; tout le script la sert", eliminatoire: true },
  { id: "gain", libelle: "Un gain concret, avec son unité, annoncé par la promesse et visible dans l'exemple", eliminatoire: true },
  { id: "accroche-douleur", libelle: "L'accroche dit la situation (un chiffre, une contradiction, pour qui) en une phrase lisible sans le son, en moins de 3 s", eliminatoire: true },
  { id: "douleur-vecue", libelle: "La douleur est une scène vécue avec son coût et finit par une question au spectateur : il se dit « c'est moi »", eliminatoire: true },
  { id: "promesse-tenue", libelle: "La promesse annonce le gain pour le spectateur (sans annoncer un nombre d'étapes), peut ouvrir une attente, et l'exemple la tient", eliminatoire: true },
  { id: "etapes-claires", libelle: "Chaque constat « ce qui change » est une phrase à l'indicatif (un sujet, un verbe, un objet) suivie d'une ou deux phrases concrètes, sans impératif adressé au spectateur : rien à chercher ailleurs", eliminatoire: true },
  { id: "clarte", libelle: "Clair à la première écoute : mots simples, aucun jargon, aucune formule creuse, rien de répété", eliminatoire: true },
  { id: "verite", libelle: "Tout est vrai : aucune affirmation absolue invérifiable, aucun chiffre sans source, aucun fait juridique approximatif, des conseils exacts et sûrs", eliminatoire: true },
  { id: "une-seule-demande", libelle: "Une seule demande à la fin, une dernière phrase de 2 à 5 mots qui ferme ; la phrase sur l'entreprise, liée à l'idée, ne contredit pas le corps", eliminatoire: true },
  { id: "cadre", libelle: "Le cadre est tenu : six passages dans l'ordre, les bornes de mots de chaque passage, aucune phrase de plus de 18 mots", eliminatoire: false },
] as const;
export type IdCritere = (typeof CRITERES_GRILLE)[number]["id"];
const IDS_CRITERES = CRITERES_GRILLE.map((c) => c.id) as [IdCritere, ...IdCritere[]];

/** Note minimale pour qu'un script soit montré (REGLES § 7). */
export const NOTE_MINIMALE = 8;

export const schemaLigneGrille = z.strictObject({
  critere: z.enum(IDS_CRITERES),
  respecte: z.boolean(),
  remarque: z.string(),
});
export type LigneGrille = z.infer<typeof schemaLigneGrille>;

/** Corrections permises à la relecture : les 3 phrases les plus faibles, au plus. */
export const CORRECTIONS_MAX = 3;

/**
 * Une correction de la relecture : UNE phrase dite (`avant`, recopiée mot pour mot), remplacée par UNE phrase
 * (`apres`) ; `ecran` : ses nouveaux mots à l'écran (vide : on garde les anciens). Jamais d'ajout, jamais de réécriture
 * totale : le programme applique au plus 3 corrections, chacune sur une phrase existante (`appliquerCorrections`).
 */
export const schemaCorrection = z.strictObject({
  avant: z.string(),
  apres: z.string(),
  ecran: z.string(),
  pourquoi: z.string(),
});
export type CorrectionScript = z.infer<typeof schemaCorrection>;

/**
 * Sortie de la passe 3 (relecture, 15/10) : les 3 phrases les plus faibles corrigées (jamais de réécriture totale ni
 * d'ajout), la grille qui juge la VALEUR du texte corrigé (une idée, le gain, la clarté), les faiblesses relevées, les
 * affirmations vérifiées du texte corrigé, et ce qui manquerait encore pour comprendre le réflexe (non vide : refus).
 */
export const schemaRelecture = z
  .strictObject({
    corrections: z.array(schemaCorrection),
    grille: z.array(schemaLigneGrille).length(CRITERES_GRILLE.length),
    faiblesses: z.array(z.string()),
    affirmations: z.array(schemaAffirmation),
    manques: z.array(z.string()),
  })
  .refine((r) => new Set(r.grille.map((l) => l.critere)).size === CRITERES_GRILLE.length, { message: "Chaque critère de la grille est noté une fois.", path: ["grille"] });
export type RelectureScript = z.infer<typeof schemaRelecture>;

/** Note sur 10 : le nombre de critères respectés (calculée en code, jamais lue du modèle). */
export function noteDeGrille(grille: readonly LigneGrille[]): number {
  return grille.filter((l) => l.respecte).length;
}

/** Critères éliminatoires non respectés. */
export function eliminatoiresEchoues(grille: readonly LigneGrille[]): IdCritere[] {
  return grille.filter((l) => !l.respecte && CRITERES_GRILLE.find((c) => c.id === l.critere)?.eliminatoire).map((l) => l.critere);
}

/* ------------------------------------------------------------------ */
/* Résultat final rendu par le service                                 */
/* ------------------------------------------------------------------ */

export interface ResultatScriptTableau {
  accroches: AccrocheProposee[];
  retenue: number;
  raison: string;
  angle: string;
  script: ScriptTableau;
  sources: SourceChiffre[];
  grille: LigneGrille[];
  note: number;
  variantes: VarianteScript[];
  aPreparer: string[];
  /** Les mots de la douleur de la version livrée (présents dans l'accroche dite). */
  motsDouleur: string[];
  /** Les affirmations relevées et justifiées de la version livrée. */
  affirmations?: AffirmationScript[];
  /** L'idée, le gain et le métier de l'exemple de la version livrée (absents d'un résultat d'avant le 15/10). */
  idee?: string;
  gain?: GainScript;
  metierExemple?: string;
  /**
   * Les PARTIES NOMMÉES du texte dit (accroche, douleur, solution, étapes, exemple, à retenir, appel), mot pour mot,
   * dans l'ordre : ce que le découpage reçoit pour titrer et remplir ses pages (REGLES § « Contrat avec le découpage »).
   * Facultatif : absent d'un résultat d'avant le 14/10.
   */
  parties?: PartieScript[];
  dureeEstimeeSecondes: number;
}

/** Tout le texte dit d'un script, phrase par phrase, dans l'ordre des parties (un script ancien est d'abord normalisé). */
export function phrasesDites(brut: ScriptTableau): PhraseScript[] {
  const s = normaliserScript(brut);
  return [...s.accroche, ...s.douleur, ...s.promesse, ...s.etapes.flatMap(phrasesEtape), ...s.exemple.phrases, ...s.aRetenir, ...s.appel];
}

/* ------------------------------------------------------------------ */
/* Traçabilité (collection propre, ajout seul)                         */
/* ------------------------------------------------------------------ */

/** Un appel au modèle pendant une génération. */
export interface AppelTrace {
  passe: "angle" | "ecriture" | "relance" | "relecture";
  modele: string;
  jetons: { entree: number; cacheLu: number; cacheEcrit: number; sortie: number };
  coutUsd: number;
  /** Durée de l'appel, en millisecondes (mesure de la durée d'une génération). */
  dureeMs?: number;
}

/** Une version du script produite pendant la génération, avec les défauts relevés par les contrôles en code. */
export interface VersionTrace {
  passe: "ecriture" | "relance" | "relecture";
  ecriture: EcritureScript;
  defauts: { code: string; message: string; eliminatoire: boolean }[];
}

/**
 * Trace d'UNE génération : écrite DÈS LE DÉPART (`en-cours`), complétée après chaque appel, puis close (livrée, refusée,
 * en erreur ou interrompue) ; jamais purgée (effacée seulement avec sa vidéo, supprimée à la main par Will, 17/10). Demande, cinq accroches, versions, grille, appels, coût, date, erreur.
 * Rien d'autre n'est écrit en base par le générateur, sauf la dépense Claude réelle.
 */
export interface TraceScriptTableau {
  id: string;
  creeLe: string;
  modifieLe: string;
  date: string;
  issue: "livre" | "refuse" | "en-cours" | "erreur" | "interrompu";
  /** Vidéo (brouillon) et tâche de fond de la génération, quand elle vient de l'écran. */
  videoId?: string;
  tacheId?: string;
  /** Dernière étape atteinte (accroches, écriture, relance, relecture). */
  etape?: string;
  /** Erreur ou interruption, en français (jamais de clé ni de texte sensible). */
  erreur?: string;
  demande: DemandeScriptTableau;
  accroches: AccrocheProposee[];
  retenue: number | null;
  raison: string;
  versions: VersionTrace[];
  grille: LigneGrille[];
  note: number | null;
  /** Motifs du refus (vide si livré). */
  motifs: string[];
  appels: AppelTrace[];
  coutUsd: number;
  /** Appels faits par un client simulé (essais) : rien n'a été payé. */
  simule: boolean;
  /** Alertes de la mémoire d'écriture commune (ressemblance forte avec un script récent) : information, jamais un refus. */
  alertes?: string[];
  /** « will » : script collé par Will, pris tel quel ; jamais gardé dans la mémoire anti-copie. */
  origine?: "will";
}
