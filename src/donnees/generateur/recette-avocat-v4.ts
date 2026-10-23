/**
 * RECETTE D'ÉCRITURE DU FORMAT AVOCAT, v4 (générateur, plan v5 B.4.1-B.4.8), CORRIGÉE PAR L'ADDENDUM DU 02/10
 * (l’addendum de décisions du 2026-10-02, mesures du lot GR sur 18 vidéos de l'avocat de référence) — l'addendum prime :
 *  1. accroche ≤ 5 s et ≤ 20 mots ;           2. S1 ouvre sur une AFFIRMATION ;
 *  3. apaisement facultatif, formules réellement dites ; « Rassurez-vous », « Pas de panique » : jamais ;
 *  4. « geste OU verdict avant 5 s » ;          5. raison avant 10 s pour S1 ; en S2/S3 le chiffre ou le cas dit à 0 s suffit ;
 *  6. exception FACULTATIVE (« à moins que », « En revanche », « Par contre ») ;
 *  7. appel FACULTATIF, 5 à 47 mots quand il existe ; 9. C3 bis assoupli (« Il ne faut jamais… » permis) ;
 * 10. nouvelle structure S10 « la règle cachée » ; 11. liste anti-texte IA du calibrage ; 12. vidéos modèles du lot GR.
 *
 * DONNÉES SEULEMENT : le générateur central (`src/generateur/`, `src/domaine/controles-script/`) ne nomme jamais ce
 * format ; il lit ces tables par `parametresGenerateur(formatId)`. Ajouter une structure = une ligne ici.
 * Sur la branche `generateur/prepare-moteur`, ces champs rejoignent `formats/avocat` (fichier de la session du moteur).
 */
import type { Emotion, ObjectifSujet, PointDeVue, ReseauDeclinaison, TypeAccroche, TypeAppel, TypeMatiere } from "@/domaine/types";
import type { StructureGenerateur } from "@/domaine/controles-script/types";

export const VERSION_RECETTE_AVOCAT = 4;

/**
 * Identifiants d'accroche du générateur : `TypeAccroche` (5 valeurs existantes) ÉTENDU (B.4.3).
 * Écart G3 : l'union `TypeAccroche` de `domaine/types.ts` (fichier partagé) n'est pas modifiée en place ; l'extension
 * vit ici et rejoindra l'union au moment de G4 (ajout pur).
 */
export type IdAccroche =
  | TypeAccroche
  | "dementi"
  | "verdict-expert"
  | "cible-nommee"
  | "liste-boucle"
  | "mise-en-garde-destinataire"
  | "situation-spectateur"
  | "scene-vecue"
  | "question-client"
  | "aveu-de-cout"
  | "milieu-action"
  | "transparence-ia"
  | "extrait-ouverture"
  | "resultat-dabord"
  | "avant-apres"
  | "reponse-commentaire";

/* ------------------------------------------------------------------ */
/* Structures (B.4.1 ; S1 réécrite d'après la mesure GR ; S10 nouvelle) */
/* ------------------------------------------------------------------ */

const APPUI_FAIT = [{ preuve: "observe" as const }, { preuve: "regle-loi" as const }, { matiere: "observation" as const }];
const APPUI_AVEC_AVIS = [...APPUI_FAIT, { matiere: "avis-will" as const, quiParleWill: true }];
const POURQUOI = [{ preuve: "toute" as const }, { matiere: "observation" as const, contient: "cause" as const }, { matiere: "etude" as const }, { matiere: "avis-will" as const, contient: "cause" as const }];
const GESTE = [{ matiere: "avis-will" as const }, { matiere: "limite" as const }, { preuve: "regle-loi" as const }];
const EXEMPLE = [{ matiere: "cas-client" as const }, { matiere: "anecdote-will" as const }, { preuve: "cas-client" as const }];

export const STRUCTURES_AVOCAT: StructureGenerateur[] = [
  {
    id: "AV.S1",
    nom: "Verdict ou geste (l'avocat de référence)",
    enchainement: ["SITUATION, une affirmation (0-3 s)", "GESTE ou VERDICT (avant 5 s)", "RAISON (avant 8 s)", "règle ou exemple", "[exception]", "fin sur le fait", "[appel]"],
    typesAncrage: [],
    appui: APPUI_AVEC_AVIS,
    temps: [
      { id: "geste-ou-verdict", libelle: "un geste ou un verdict (votre avis, une limite, une règle du métier)", obligatoire: true, avantSec: 5, sources: GESTE },
      { id: "raison", libelle: "le pourquoi", obligatoire: true, sources: POURQUOI },
    ],
    ouvertureAffirmative: true,
    tirable: true,
    origine: "l'avocat de référence, 4 vidéos sur 18 mesurées (D01, D12, D15, D16 ; GR, OBSERVÉ) ; apaisement facultatif fondu dans la 1re phrase",
  },
  {
    id: "AV.S2",
    nom: "Chiffre d'abord",
    // G4 (addendum §2 ter, mesure D06, D17, D18) : le chiffre ouvre, puis le RÉCIT de ce que nous avons fait.
    enchainement: ["CHIFFRE ou RÉSULTAT dit à 0 s (« J'ai fait annuler… », « … je lui ai obtenu… »)", "[qui] EST VENU NOUS VOIR avec [problème concret]", "CE QUE NOUS AVONS FAIT (verbes d'action)", "[pourquoi]", "[limite]", "[appel]"],
    typesAncrage: [],
    appui: [{ preuve: "prouve" }, { preuve: "avant-apres" }],
    temps: [
      { id: "chiffre", libelle: "un chiffre prouvé", obligatoire: true, sources: [{ preuve: "chiffree" }] },
      { id: "ce-qu-on-fait", libelle: "ce qu'on fait chez nos clients", obligatoire: true, sources: [{ preuve: "cas-client" }, { matiere: "cas-client" }, { matiere: "observation" }, { matiere: "avis-will" }] },
      { id: "pourquoi", libelle: "le pourquoi", obligatoire: false, sources: POURQUOI },
    ],
    tirable: true,
    origine: "OpusClip (résultat en tête) ; l'avocat de référence D17 (GR)",
  },
  {
    id: "AV.S3",
    nom: "Cas client",
    // G4 (addendum §2 ter, mesure D04, D06, D09, D18) : « Un client est venu me voir… » → ce que nous avons fait → résultat.
    enchainement: ["RÉSULTAT ou SCÈNE à 0 s (« Un client passait… Aujourd'hui : zéro. »)", "[qui] EST VENU NOUS VOIR avec [problème concret]", "[ce qu'il croyait]", "CE QUE NOUS AVONS FAIT (« nous lui avons… », « on a supprimé… »)", "LE RÉSULTAT chiffré", "LA RÈGLE À RETENIR", "[limite]", "[appel]"],
    typesAncrage: ["cas-client"],
    accordRequis: true,
    appui: [{ preuve: "cas-client" }],
    temps: [
      { id: "trouve", libelle: "ce que nous avons fait et le résultat (une preuve « cas client »)", obligatoire: true, sources: [{ preuve: "cas-client" }] },
      { id: "regle-a-retenir", libelle: "la règle à retenir, en une phrase", obligatoire: false, obligatoireSiObjectif: ["notoriete"], sources: [{ matiere: "avis-will" }, { matiere: "limite" }, { matiere: "observation" }, { preuve: "formulation-autorisee" }] },
      { id: "croyait", libelle: "ce qu'il croyait", obligatoire: false, sources: [{ matiere: "idee-recue" }] },
    ],
    pointsDeVue: ["nous-clients", "vous"],
    tirable: true,
    origine: "l'avocat de référence D04, D09 (GR) ; OpusClip",
  },
  {
    id: "AV.S4",
    nom: "Idée reçue → réalité",
    enchainement: ["CONTEXTE", "pivot (« Mais », « Ça, jamais ! »)", "RETOURNEMENT", "RAISON", "1 à 3 GESTES", "[exception]", "fin sur le fait", "[appel sec]"],
    typesAncrage: ["idee-recue", "avis-will", "observation"],
    appui: APPUI_FAIT,
    temps: [
      { id: "raison", libelle: "le pourquoi", obligatoire: true, sources: POURQUOI },
      { id: "gestes", libelle: "1 à 3 gestes concrets (votre avis, une limite, une règle)", obligatoire: true, sources: GESTE },
    ],
    tirable: true,
    origine: "l'avocat de référence D03, D08, D13 (GR) ; Kallaway",
  },
  {
    id: "AV.S5",
    nom: "Question reçue",
    enchainement: ["« On m'a demandé : … ? »", "RÈGLE", "POURQUOI", "[exemple]", "[exception]", "[appel]"],
    typesAncrage: ["question-recue"],
    appui: APPUI_AVEC_AVIS,
    temps: [
      { id: "regle", libelle: "la règle (une preuve, une observation, ou votre avis si vous parlez)", obligatoire: true, sources: APPUI_AVEC_AVIS },
      { id: "pourquoi", libelle: "le pourquoi", obligatoire: true, sources: POURQUOI },
      { id: "exemple", libelle: "un exemple vrai", obligatoire: false, sources: EXEMPLE },
    ],
    tirable: true,
    origine: "Rebollo, Chukwuma ; B07 (GR) — permise, pas une structure de l'avocat de référence",
  },
  {
    id: "AV.S6",
    nom: "Parole de dirigeant",
    enchainement: ["CITATION annoncée", "CE QU'ELLE RÉVÈLE", "RAISON", "CE QU'ON FAIT", "[limite]", "[appel]"],
    typesAncrage: ["parole-dirigeant"],
    accordRequis: true,
    appui: APPUI_FAIT,
    temps: [{ id: "raison", libelle: "le pourquoi", obligatoire: true, sources: POURQUOI }],
    pointsDeVue: ["un-dirigeant"],
    tirable: false,
    origine: "addendum 09 (OPINION) ; non observée au lot GR — après banc partiel",
  },
  {
    id: "AV.S7",
    nom: "Actualité",
    enchainement: ["LA NOUVELLE (datée, sourcée)", "CE QUE ÇA CHANGE POUR UNE PME", "CE QU'IL FAUT FAIRE", "[limite]", "[appel]"],
    typesAncrage: ["actualite"],
    appui: [],
    temps: [{ id: "a-faire", libelle: "ce qu'il faut faire", obligatoire: true, sources: GESTE }],
    tirable: false,
    origine: "créateurs B2B (B01, B05, B09, B10, GR) — après banc partiel",
  },
  {
    id: "AV.S8",
    nom: "Gradation numérotée",
    enchainement: ["ANNONCE DU NOMBRE", "1", "2", "3 (le plus fort)", "[exception]", "[appel]"],
    typesAncrage: [],
    appui: APPUI_FAIT,
    temps: [{ id: "points", libelle: "2 à 3 points tirés d'une matière ou d'une preuve", obligatoire: true, sources: [{ preuve: "toute" }, { matiere: "observation" }, { matiere: "avis-will" }, { matiere: "limite" }] }],
    tirable: false,
    origine: "l'avocat de référence D02, D05 (non numérotées), E01, E02 (GR) — après banc partiel",
  },
  {
    id: "AV.S9",
    nom: "Verdict comparatif",
    enchainement: ["QUESTION « A ou B ? »", "VERDICT", "RAISON", "[sauf si]", "[appel]"],
    typesAncrage: [],
    appui: [{ matiere: "avis-will", quiParleWill: true }, { preuve: "observe" }],
    temps: [{ id: "raison", libelle: "le pourquoi", obligatoire: true, sources: POURQUOI }],
    tirable: false,
    origine: "audit 2 ; E03 (GR, une interview) — après banc partiel",
  },
  {
    id: "AV.S10",
    nom: "La règle cachée",
    enchainement: ["ANOMALIE (« quelque chose que … ne fait que très rarement »)", "ENJEU", "RÈGLE", "EXEMPLE", "CONSÉQUENCE (fin sur le fait)"],
    typesAncrage: [],
    appui: [{ preuve: "regle-loi" }, { preuve: "observe" }, { matiere: "observation" }],
    temps: [
      { id: "regle", libelle: "la règle (une règle du métier, une observation, votre avis)", obligatoire: true, sources: [{ preuve: "regle-loi" }, { matiere: "observation" }, { matiere: "avis-will" }] },
      { id: "exemple", libelle: "un exemple vrai (cas client, anecdote)", obligatoire: true, sources: EXEMPLE },
      { id: "consequence", libelle: "la conséquence", obligatoire: true, sources: POURQUOI },
    ],
    tirable: true,
    origine: "l'avocat de référence D10, D15 (GR, OBSERVÉ) ; addendum point 10",
  },
];

/* ------------------------------------------------------------------ */
/* Points de vue, ressentis, familles d'accroche                       */
/* ------------------------------------------------------------------ */

/** Point de vue permis par le type de la matière d'ancrage (C50, K6). */
export const POINTS_DE_VUE_PAR_TYPE: Readonly<Record<TypeMatiere, PointDeVue[]>> = {
  "anecdote-will": ["je"],
  "avis-will": ["je", "vous"],
  limite: ["je", "vous"],
  "cas-client": ["nous-clients", "vous"],
  "parole-dirigeant": ["un-dirigeant"],
  "question-recue": ["je", "vous"],
  observation: ["nous-clients", "vous", "je"],
  "idee-recue": ["vous", "je"],
  etude: ["vous"],
  actualite: ["vous"],
  demonstration: ["je", "vous"],
};

export const EMOTIONS_AVOCAT: Emotion[] = ["surprise", "agacement", "soulagement", "fierte", "inquietude-maitrisee"];

/** Conditions d'un ressenti (C51) : au moins une de ces matières dans le stock. */
export const CONDITIONS_EMOTIONS: Partial<Record<Emotion, TypeMatiere[]>> = {
  agacement: ["avis-will"],
  "inquietude-maitrisee": ["avis-will", "limite"],
  fierte: ["cas-client", "anecdote-will"],
  soulagement: ["cas-client", "limite", "avis-will"],
};

export interface LigneAccroche {
  id: IdAccroche;
  nom: string;
  modele: string;
  encadre: string;
  objectif: "envoi" | "sauvegarde" | "commentaire" | "fin-de-visionnage";
  piege: string;
  exige?: { matiere?: TypeMatiere[]; preuveChiffree?: boolean; accordAvantApres?: boolean; scene?: boolean; origine?: "commentaire" };
  /** Expression de reconnaissance INDICATIVE (B.4.3). */
  reconnaissance?: string;
  /** Au plus N fois sur les M dernières publications du compte et du réseau. */
  plafond?: { max: number; sur: number };
}

/** Bibliothèque d'accroches de départ (B.4.3, 05 §5.2 corrigé ; modèles au vouvoiement, ouvertures AFFIRMATIVES). */
export const BIBLIOTHEQUE_ACCROCHES_AVOCAT: LigneAccroche[] = [
  { id: "situation-spectateur", nom: "Situation du spectateur (l'avocat de référence)", modele: "Vous recevez un PV pour un radar automatique : ne le payez pas tout de suite.", encadre: "Ce que ça vous coûte", objectif: "fin-de-visionnage", piege: "Situation trop large", reconnaissance: "^(Vous|Votre|Vos)\\b" },
  { id: "dementi", nom: "Idée reçue → réalité", modele: "On vous a dit que l'IA invente tout. En réalité…", encadre: "Mythe IA n° [N]", objectif: "envoi", piege: "« Réalité » non appuyée par une preuve", exige: { matiere: ["idee-recue", "observation"] }, reconnaissance: "(on vous a dit|vous pensez).*(en réalité|pourtant|mais)" },
  { id: "chiffre-choc", nom: "Affirmation choc vérifiable", modele: "[Fait P], rien que pour [tâche].", encadre: "L'enjeu en 3 mots", objectif: "envoi", piege: "Chiffre rond, sans source ; sans marqueur d'anomalie (jamais finaliste, C69)", exige: { preuveChiffree: true } },
  { id: "aveu-de-cout", nom: "Aveu de coût", modele: "Ce que m'a coûté [erreur réelle de Will].", encadre: "L'erreur à éviter", objectif: "commentaire", piege: "Erreur inventée", exige: { matiere: ["anecdote-will"], scene: true }, reconnaissance: "ce que (m'a|nous a) coûté" },
  { id: "milieu-action", nom: "Milieu de l'action", modele: "Chez un client, mardi : 47 onglets ouverts.", encadre: "Cas réel, [secteur autorisé]", objectif: "fin-de-visionnage", piege: "Scène au présent ; scène sans cas en base", exige: { matiere: ["cas-client", "anecdote-will"] }, reconnaissance: "^(Chez un client|Mardi|Hier|La semaine dernière)" },
  { id: "contre-intuitif", nom: "Contre-pied ciblé", modele: "Ne confiez surtout pas [tâche précise] à ChatGPT.", encadre: "Le risque juridique", objectif: "envoi", piege: "Contredire une bonne pratique", exige: { matiere: ["avis-will", "observation", "limite"] }, reconnaissance: "^(Ne .* surtout pas|Arrêtez de|Il ne faut jamais)" },
  { id: "cible-nommee", nom: "Cible nommée", modele: "Dirigeants de PME : avant de signer [outil], écoutez ça.", encadre: "La cible et l'enjeu", objectif: "sauvegarde", piege: "Cible trop large" },
  { id: "question-client", nom: "Question reçue", modele: "On m'a demandé : [question réelle] ?", encadre: "Question reçue", objectif: "commentaire", piege: "Question inventée ; fréquence ajoutée", exige: { matiere: ["question-recue"] }, reconnaissance: "(question reçue|on m'a demandé|on me (demande|pose))" },
  { id: "mise-en-garde-destinataire", nom: "Mise en garde au destinataire", modele: "Si votre DAF fait encore ça, cette vidéo est pour lui.", encadre: "Le rôle visé", objectif: "envoi", piege: "Plus d'une fois sur 5 publications", plafond: { max: 1, sur: 5 }, reconnaissance: "si votre (DAF|DRH|associé|comptable)" },
  { id: "question", nom: "Question à enjeu", modele: "Combien d'heures votre équipe perd-elle sur [tâche] ?", encadre: "L'enjeu", objectif: "commentaire", piege: "Question oui/non" },
  { id: "erreur-commune", nom: "Erreur courante", modele: "L'erreur que font la plupart des dirigeants avec [sujet].", encadre: "L'erreur", objectif: "envoi", piege: "Erreur sans appui" },
  { id: "promesse", nom: "Promesse", modele: "Comment [résultat] sans [effort].", encadre: "Le résultat", objectif: "sauvegarde", piege: "Promesse plus large que la preuve" },
  { id: "verdict-expert", nom: "Verdict d'expert", modele: "[A] ou [B] pour [tâche] ? Mon verdict : …", encadre: "Mon verdict", objectif: "commentaire", piege: "Verdict sans avis de Will ; dit par le double", exige: { matiere: ["avis-will"] }, reconnaissance: "(mon verdict|ou .* \\?)" },
  { id: "avant-apres", nom: "Avant / après", modele: "Un temps plein, rien que pour des Excel. (« 0 h » affiché après 3 s)", encadre: "Le sujet et « avant / après »", objectif: "envoi", piege: "Deux nombres dits ; valeur non validée", exige: { accordAvantApres: true } },
  { id: "resultat-dabord", nom: "Résultat d'abord", modele: "Zéro heure par semaine sur ses Excel.", encadre: "Cas client", objectif: "fin-de-visionnage", piege: "La livraison ne dit rien de neuf (C6 bis)", exige: { accordAvantApres: true } },
  { id: "reponse-commentaire", nom: "Réponse à un commentaire", modele: "On m'a écrit en commentaire : [texte exact]", encadre: "Votre question", objectif: "commentaire", piege: "Commentaire reformulé ou inventé", exige: { matiere: ["question-recue"], origine: "commentaire" }, reconnaissance: "(en commentaire|vous m'avez demandé)" },
  { id: "scene-vecue", nom: "Scène vécue", modele: "[Scène de l'anecdote de Will, au passé].", encadre: "Ce que j'ai vu", objectif: "fin-de-visionnage", piege: "Scène inventée", exige: { matiere: ["anecdote-will"], scene: true } },
];

/** Familles NON permises à ce format (C41) : `transparence-ia`, `extrait-ouverture`. `liste-boucle` attend S8. */
export const FAMILLES_INTERDITES_AVOCAT: IdAccroche[] = ["transparence-ia", "extrait-ouverture", "liste-boucle"];

/* ------------------------------------------------------------------ */
/* Appels : objectif × réseau (B.4.4, v5)                              */
/* ------------------------------------------------------------------ */

export const APPELS_PERMIS_AVOCAT: Readonly<Record<ReseauDeclinaison, TypeAppel[]>> = {
  tiktok: ["envoi", "question-expert", "episode-suivant"],
  instagram: ["envoi", "sauvegarde"],
  "youtube-shorts": ["episode-suivant", "question-expert"],
  linkedin: ["question-expert", "sauvegarde", "diagnostic", "envoi"],
  facebook: ["question-expert", "sauvegarde", "envoi"],
};

export const APPEL_PAR_DEFAUT_AVOCAT: Readonly<Record<ReseauDeclinaison, TypeAppel>> = {
  tiktok: "envoi",
  instagram: "envoi",
  "youtube-shorts": "question-expert",
  linkedin: "question-expert",
  facebook: "question-expert",
};

/** Colonne de l'objectif ; absent : le défaut du réseau (`selonObjectif: false`). */
export const APPELS_PAR_OBJECTIF_AVOCAT: Readonly<Record<ObjectifSujet, Partial<Record<ReseauDeclinaison, TypeAppel>>>> = {
  notoriete: { tiktok: "envoi", instagram: "envoi", linkedin: "envoi", facebook: "envoi" },
  sauvegarde: { instagram: "sauvegarde", linkedin: "sauvegarde", facebook: "sauvegarde" },
  conversation: { tiktok: "question-expert", "youtube-shorts": "question-expert", linkedin: "question-expert", facebook: "question-expert" },
  "rendez-vous": { linkedin: "diagnostic" },
};

/**
 * Débit d'écriture du double (mots par seconde) : mesure GR, médiane l'avocat de référence 4,51 (3,58-5,76) sur 18 vidéos (G4, ordre de
 * Will du 03/10). Il remplace, pour le générateur seulement, les 4,4 de la recette du moteur tant que M0b n'a pas mesuré
 * le débit réel du double. Les autres modes gardent la recette résolue.
 */
export const DEBIT_AVATAR_MESURE_AVOCATREF = 4.5;

/** Réseaux où le double est déconseillé en format avocat (C48 : proposition « vous en personne »). */
export const DOUBLE_DECONSEILLE_AVOCAT: ReseauDeclinaison[] = ["tiktok", "youtube-shorts", "linkedin"];

/* ------------------------------------------------------------------ */
/* Plafonds, expressions tournantes, annotations                       */
/* ------------------------------------------------------------------ */

export const PLAFONDS_AVOCAT = {
  /** Addendum, point 1 (l'avocat de référence : médiane 3,9 s et 17 mots ; 14/18 ≤ 5 s). */
  accrocheMaxSec: 5,
  accrocheMaxMots: 20,
  /** Addendum, point 7 : facultatif ; 5 à 47 mots (médiane 20) quand il existe. */
  appelFacultatif: true,
  appelMinMots: 5,
  appelMaxMots: 47,
  /**
   * G4 (ordre de Will du 03/10 : chaque valeur vient d'une mesure l'avocat de référence) : corps mesuré 16,2-39,5 s, médiane 27,7 s ;
   * 26 s (plan v5) coupait 10 vidéos sur 18. 30 s = médiane + 10 %, l'assemblage reste borné par la zone du réseau (C12).
   */
  corpsMaxSec: 30,
  corpsIndicatifMinSec: 16,
  /** Addendum, point 6. */
  exceptionObligatoire: false,
  nombresMaxAccroche: 1,
} as const;

/** Formules d'exception réellement dites (GR) puis celles du plan ; elles tournent (C44). */
export const FORMULES_EXCEPTION_AVOCAT = ["à moins que", "En revanche", "Par contre", "Alors oui, certains", "La petite subtilité, c'est que", "Sauf si", "Ça ne marche pas quand"];

/** Apaisement : seulement au temps APAISEMENT de S1, face à une menace ; formules réellement dites (addendum, point 3). */
export const FORMULES_APAISEMENT_AVOCAT = ["il y a encore quelque chose qui peut vous sauver", "vous ne risquez rien du tout", "Ne restez pas seul", "on est là pour vous aider"];

export const ANNOTATIONS_AVOCAT = { acceptees: ["emphase", "incrustation", "intentionIllustration", "illustration"], reservees: ["angle", "zoom", "pause", "titreEcran"] };

/** Vidéos modèles retenues par le lot GR (`GR-recherche-reference/videosModeles.json`), par structure. */
export const VIDEOS_MODELES_AVOCAT: { code: string; structure: string; role: string }[] = [
  { code: "D01", structure: "AV.S1", role: "geste avant 5 s, sans apaisement" },
  { code: "D15", structure: "AV.S1", role: "apaisement fondu dans l'accroche, règle, exemple, exception, appel" },
  { code: "D12", structure: "AV.S1", role: "verdict à 0 s, raison, « Par contre », sans appel" },
  { code: "E05", structure: "AV.S1", role: "geste comme accroche, fin sur le fait, sans appel" },
  { code: "D17", structure: "AV.S2", role: "chiffre à 0 s, cas de chefs d'entreprise" },
  { code: "D09", structure: "AV.S3", role: "cas annoncé par un verdict" },
  { code: "D08", structure: "AV.S4", role: "idée reçue, sans appel" },
  { code: "D10", structure: "AV.S10", role: "la règle cachée, sans appel" },
];
