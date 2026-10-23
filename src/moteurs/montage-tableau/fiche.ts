/**
 * FICHE DE SCÈNES DU TABLEAU ANIMÉ (tâche TB-01, plan `02-FORMAT-TABLEAU-ANIME.md` § 5 et § 6).
 *
 * Le schéma COMMUN (version, scènes, pages, bornes) est celui de `src/briques/fiche-scenes` (ORG-08), lu sans être
 * modifié. Ce fichier déclare ce qui est propre au format, par le point d'extension `ExtensionFormat` :
 *   - les 6 types d'éléments posés dans une scène (`ligne`, `dessin`, `chiffre`, `preuve`, `geste`, `mention`) ;
 *   - les 4 structures (recettes de script qui alternent) et les rôles de scène ;
 *   - la validation complète `validerFicheTableau(brute, contexte)` (règles propres dans `regles.ts`) ;
 *   - les écrans du style `blocs/2` (champ facultatif `ecrans` de la scène : moment, gabarit, étiquette, mots forts,
 *     liste), lus par la mise en page de ce style.
 *
 * Schéma EXACT : tout champ inconnu est refusé, aucune valeur n'est corrigée. Aucun accès base ni réseau : tout ce
 * qui vient de l'extérieur arrive par le `contexte` (voir `ContexteTableau`, `regles.ts`).
 */
import { z } from "zod";
import {
  ROLES_SCENE,
  STRUCTURES_FICHE,
  identifiantSur,
  texteObligatoire,
  validerFiche,
  type ExtensionFormat,
  type FicheScenes,
  type ResultatFiche,
  type RoleScene,
  type SceneFiche,
  type StructureFiche,
} from "@/briques/fiche-scenes";
import { BORNES_VISUEL_3, IDS_VISUELS_3 } from "@/briques/tableau-scene/reference/visuels-3";
import { estStyleTableau, styleTableauDe } from "@/briques/tableau-scene/trois-styles/styles";
import { BORNES_BLOC_3 } from "./gabarit-3";
import { reglesTableau, type ContexteTableau } from "./regles";
import { BLOCS_GABARIT, BORNES_GABARIT, CODES_COULEUR, ROLES_PAGE, bornesFicheTableau } from "./gabarit";

/** Identifiant du format (la fiche doit porter le même `formatId`). */
export const FORMAT_TABLEAU = "tableau-anime";

/* ------------------------------------------------------------------ */
/* Rôles de scène et structures                                          */
/* ------------------------------------------------------------------ */

/** Rôles de scène : ceux de la fiche commune (§ 6.2), repris tels quels. */
export const ROLES_SCENE_TABLEAU = ROLES_SCENE;
export type RoleSceneTableau = RoleScene;

/** Les 4 structures (§ 5), dans l'ordre du plan. Mêmes codes que la fiche commune. */
export const STRUCTURES_TABLEAU = STRUCTURES_FICHE;
export type StructureTableau = StructureFiche;

export interface DescriptionStructure {
  /** Nom montré à Will. */
  nom: string;
  /** Déroulé en blocs, dans l'ordre (§ 5). */
  deroule: readonly string[];
  /** Rôles de scène attendus, dans l'ordre (indicatif : la validation exige seulement une scène « preuve », V9). */
  roles: readonly RoleSceneTableau[];
  /** Ce que la preuve montre à l'écran. */
  preuveEcran: string;
  /** Accroche conseillée (contrat Usine § 3.6). */
  accroche: "ERR" | "AVA" | "DEM" | "QST";
}

export const DESCRIPTIONS_STRUCTURES: Readonly<Record<StructureTableau, DescriptionStructure>> = {
  "erreur-corrigee": {
    nom: "L'erreur corrigée",
    deroule: ["douleur", "l'erreur que tout le monde fait", "la bonne façon (1 geste)", "preuve avant/après", "ce que vous gagnez", "fin"],
    roles: ["accroche", "douleur", "idee-recue", "etape", "preuve", "resultat"],
    preuveEcran: "la mauvaise phrase barrée, la bonne entourée, 2 lignes de résultat",
    accroche: "ERR",
  },
  "avant-apres": {
    nom: "Avant / après",
    deroule: ["douleur", "« avant » (le résultat raté)", "le changement (1 consigne)", "« après »", "fin"],
    roles: ["accroche", "douleur", "exemple", "etape", "preuve", "resultat"],
    preuveEcran: "deux colonnes, l'écart souligné",
    accroche: "AVA",
  },
  demonstration: {
    nom: "La démonstration en 3 gestes",
    deroule: ["promesse", "geste 1", "geste 2", "geste 3", "le résultat", "fin"],
    roles: ["accroche", "etape", "etape", "etape", "preuve", "resultat"],
    preuveEcran: "le résultat final encadré",
    accroche: "DEM",
  },
  "question-abonne": {
    nom: "Votre question",
    deroule: ["la question (reformulée, jamais de nom ni de pseudo)", "la réponse en 1 geste", "preuve", "fin"],
    roles: ["accroche", "douleur", "etape", "preuve", "resultat"],
    preuveEcran: "la question en titre, la réponse entourée",
    accroche: "QST",
  },
};

/* ------------------------------------------------------------------ */
/* Éléments d'une scène (§ 6.2)                                          */
/* ------------------------------------------------------------------ */

export const TYPES_ELEMENT = ["ligne", "dessin", "chiffre", "preuve", "geste", "mention"] as const;
export type TypeElement = (typeof TYPES_ELEMENT)[number];

export const NIVEAUX_LIGNE = ["titre", "texte"] as const;
export type NiveauLigne = (typeof NIVEAUX_LIGNE)[number];

export const ROLES_LIGNE = ["titre", "regle", "avantage", "condition", "resultat", "alerte"] as const;
export type RoleLigne = (typeof ROLES_LIGNE)[number];

export const MARQUES = ["souligne", "entoure", "barre", "surligne"] as const;
export type Marque = (typeof MARQUES)[number];

export const COTES = ["gauche", "droite", "centre"] as const;
export type Cote = (typeof COTES)[number];

export const GESTES = ["souligner", "entourer", "barrer", "cocher", "pointer"] as const;
export type Geste = (typeof GESTES)[number];

/** Style « reference/2 » : rôles de page, places d'une ligne dans le gabarit, bornes (`gabarit.ts`, sans dépendance). */
export { BORNES_BLOC_3, textesPeps } from "./gabarit-3";
export { BLOCS_GABARIT, BORNES_GABARIT, CODES_COULEUR, CONSEIL_GABARIT, ROLES_PAGE, ROLES_PAGE_3, bornesFicheTableau, type BlocGabarit, type CodeCouleur, type RolePage } from "./gabarit";

/** Seul texte permis pour une mention (posée d'office si la scène est un exemple chiffré, V8). */
export const MENTION_EXEMPLE = "Exemple illustratif";

/** Bornes propres au format. La largeur d'une ligne n'a PLUS de seuil en caractères : elle est mesurée (V4). */
export const BORNES_TABLEAU = {
  lignesPreuveMin: 1,
  lignesPreuveMax: 2,
} as const;

/** Index d'un mot dans le `texteDit` de la scène (0 = premier mot) : moment où l'élément apparaît. */
const ancre = z.number().int().nonnegative();
const idElement = identifiantSur;

/** Mot sans casse, sans accent, sans ponctuation : « D'abord » et « dabord » désignent le même mot. */
export const cleMot = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const schemaLigne = z
  .strictObject({
    id: idElement,
    type: z.literal("ligne"),
    texte: texteObligatoire(),
    niveau: z.enum(NIVEAUX_LIGNE),
    role: z.enum(ROLES_LIGNE),
    marque: z.enum(MARQUES).optional(),
    /** Mots importants de la ligne (facultatif) : écrits en noir, soulignés d'orange. Chacun doit être un mot du texte. */
    importants: z.array(texteObligatoire()).min(1).optional(),
    /**
     * Style « reference/2 » (gabarit de page clair) : la place de la ligne dans le gabarit de sa page (titre, phrase
     * clé, détail, avant, après, élément de liste, appel). Obligatoire dans ce style, refusé dans les autres.
     */
    bloc: z.enum(BLOCS_GABARIT).optional(),
    /** Style « reference/3 » : couleur d'un élément de la liste à pastilles (bloc « code ») : vert, orange ou rouge. */
    code: z.enum(CODES_COULEUR).optional(),
    ancre,
  })
  .superRefine((l, ctx) => {
    const mots = new Set(l.texte.split(/\s+/).map(cleMot).filter(Boolean));
    (l.importants ?? []).forEach((m, i) => {
      if (!cleMot(m) || !mots.has(cleMot(m))) ctx.addIssue({ code: "custom", path: ["importants", i], message: `le mot important « ${m} » n'est pas un mot de la ligne « ${l.texte} »` });
    });
  });

export const schemaDessin = z.strictObject({
  id: idElement,
  type: z.literal("dessin"),
  /** Banque fermée (`src/briques/dessins`), vérifiée par V11. */
  dessinId: texteObligatoire(),
  cote: z.enum(COTES),
  ancre,
});

export const schemaChiffre = z.strictObject({
  id: idElement,
  type: z.literal("chiffre"),
  valeur: texteObligatoire(),
  unite: texteObligatoire().optional(),
  /** Obligatoire ; doit désigner une source connue (V7). */
  sourceId: texteObligatoire(),
  ancre,
});

export const schemaPreuve = z.strictObject({
  id: idElement,
  type: z.literal("preuve"),
  /** Matière « demonstration » ou `Preuve` existante du studio (V9). */
  preuveId: texteObligatoire(),
  lignes: z.array(texteObligatoire()).min(BORNES_TABLEAU.lignesPreuveMin).max(BORNES_TABLEAU.lignesPreuveMax),
  ancre,
});

export const schemaGeste = z.strictObject({
  id: idElement,
  type: z.literal("geste"),
  geste: z.enum(GESTES),
  /** Identifiant d'un élément de la même scène. */
  cibleId: idElement,
  ancre,
});

export const schemaMention = z.strictObject({
  id: idElement,
  type: z.literal("mention"),
  texte: z.literal(MENTION_EXEMPLE),
});

/** Schéma d'UN élément du tableau : union discriminée par `type`, chaque forme exacte. */
export const schemaElementTableau = z.discriminatedUnion("type", [schemaLigne, schemaDessin, schemaChiffre, schemaPreuve, schemaGeste, schemaMention]);

export type ElementLigne = z.infer<typeof schemaLigne>;
export type ElementDessin = z.infer<typeof schemaDessin>;
export type ElementChiffre = z.infer<typeof schemaChiffre>;
export type ElementPreuve = z.infer<typeof schemaPreuve>;
export type ElementGeste = z.infer<typeof schemaGeste>;
export type ElementMention = z.infer<typeof schemaMention>;
export type ElementTableau = z.infer<typeof schemaElementTableau>;

/* ------------------------------------------------------------------ */
/* Fiche complète                                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Style « blocs/2 » : écrans de la scène (champ FACULTATIF `ecrans`)    */
/* ------------------------------------------------------------------ */

/**
 * Styles du format, lus dans `fiche.habillage` (figé à la création) :
 *  - `charte-video/1` : la page ivoire écrite au stylo (style d'avant, inchangé) ;
 *  - `blocs/2` : le style de la vidéo modèle « Formation » (11/10) — fonds qui alternent, très gros titres, mots forts
 *    en blocs, gabarits d'écran. Les fiches créées avec lui le gardent ;
 *  - `reference/1` : le style du reel de référence « tableau blanc » (maquette validée le 14/10) — une page blanche
 *    écrite au crayon, bloc après bloc, trois couleurs, un petit dessin par idée. Choisi PAR DÉFAUT pour les nouvelles
 *    fiches jusqu'au 14/10 ;
 *  - `reference/2` : le même style « reference/1 » (crayon, page blanc cassé, trois couleurs, un dessin), avec un
 *    GABARIT DE PAGE CLAIR (maquette `maquettes/tableau-gabarit-clair/`, regard de Will du 14/10 : « pas de titres, pas
 *    de hiérarchie, les étapes dites ne sont pas écrites ») : une page = une idée, repère de progression ou bandeau
 *    « Exemple », TITRE court souligné (pastille numérotée écrite quand la voix dit le numéro), PHRASE CLÉ, 1 à 3
 *    DÉTAILS, un dessin ; AVANT / APRÈS pour l'exemple ; dernière page « À retenir ». Choisi par défaut jusqu'au 14/10 ;
 *  - `reference/3` : même crayon, même page, mêmes couleurs ; chaque page porte l'ÉTIQUETTE de sa partie (ACCROCHE,
 *    LA DOULEUR, LA SOLUTION « Étape 2 sur 4 », EXEMPLE, À RETENIR, appel) et 3 blocs au plus ; l'accroche est écrite
 *    en grand dès la première image ; la solution est MONTRÉE (pastilles de couleur, liste cochée, « avant → après ») ;
 *    la fin est une page d'appel plein cadre. Choisi PAR DÉFAUT pour les nouvelles fiches (`STYLE_PAR_DEFAUT_TABLEAU`).
 * Une fiche garde le style avec lequel elle a été créée.
 */
export const STYLE_PAGE_ECRITE = "charte-video/1";
export const STYLE_BLOCS_2 = "blocs/2";
export const STYLE_REFERENCE_1 = "reference/1";
export const STYLE_REFERENCE_2 = "reference/2";
export const STYLE_REFERENCE_3 = "reference/3";
export const STYLES_TABLEAU = [STYLE_PAGE_ECRITE, STYLE_BLOCS_2, STYLE_REFERENCE_1, STYLE_REFERENCE_2, STYLE_REFERENCE_3] as const;
export const STYLE_PAR_DEFAUT_TABLEAU = STYLE_REFERENCE_3;

/** Vrai si la fiche est au style « blocs/2 ». */
export const estStyleBlocs2 = (fiche: Pick<FicheScenes, "habillage">) => fiche.habillage === STYLE_BLOCS_2;

/** Vrai si la fiche est au style « reference/1 » (page blanche écrite au crayon). */
export const estStyleReference1 = (fiche: Pick<FicheScenes, "habillage">) => fiche.habillage === STYLE_REFERENCE_1;

/** Vrai si la fiche est au style « reference/2 » (page écrite au crayon, gabarit de page clair). */
export const estStyleReference2 = (fiche: Pick<FicheScenes, "habillage">) => fiche.habillage === STYLE_REFERENCE_2;

/** Vrai si la fiche est au style « reference/3 » (gabarit par parties : accroche, douleur, solution… appel). */
export const estStyleReference3 = (fiche: Pick<FicheScenes, "habillage">) => fiche.habillage === STYLE_REFERENCE_3;

/**
 * Trois styles du tableau (16/10/2026, maquettes validées PR #280) : une fiche « reference/3 » reçoit le style de sa
 * série (`STYLE_PAR_SERIE` : Formation → ardoise, Automatisations → tableau blanc, les autres → paperboard) ; son champ
 * `styleTableau`, quand il est posé, prend le dessus. Posé au découpage et à la fabrication.
 */
export function avecStyleTableau(fiche: FicheTableau): FicheTableau {
  return estStyleReference3(fiche) && !estStyleTableau(fiche.styleTableau) ? { ...fiche, styleTableau: styleTableauDe(fiche) } : fiche;
}

/** Vrai pour les styles de la page écrite au crayon (« reference/1 », « reference/2 » et « reference/3 »). */
export const estPageEcrite = (fiche: Pick<FicheScenes, "habillage">) => estStyleReference1(fiche) || estStyleReference2(fiche) || estStyleReference3(fiche);

/**
 * Styles où la DERNIÈRE scène dit et écrit l'appel du script (« Écrivez … en commentaire ») et où la page de fin tient
 * après la voix : aucune scène de fin n'est ajoutée à la fabrication (« blocs/2 », « reference/1 »). Le style d'avant
 * (`charte-video/1`) ajoute sa scène de fin.
 */
export const appelEnFinDeFiche = (fiche: Pick<FicheScenes, "habillage">) => estStyleBlocs2(fiche) || estPageEcrite(fiche);

/** Moment de la scène dans le déroulé (le gabarit et le fond en dépendent). */
export const MOMENTS_ECRAN = ["accroche", "douleur", "retournement", "promesse", "etape", "exemple", "recapitulatif", "appel"] as const;
export type MomentEcran = (typeof MOMENTS_ECRAN)[number];

/** Gabarits d'écran réutilisables (corps de l'écran sous les titres). */
export const GABARITS_ECRAN = [
  "accroche-cases",
  "accroche-compteur",
  "constat",
  "idee-recue",
  "etape",
  "liste",
  "semaine",
  "exemple",
  "recapitulatif",
  "appel-commentaire",
  "appel-diagnostic",
] as const;
export type GabaritEcran = (typeof GABARITS_ECRAN)[number];

/** Bornes des écrans. */
export const BORNES_ECRAN = { etiquetteMax: 24, itemsMax: 6, itemMax: 40, detailMax: 40, etapesMax: 6, nomEtapeMax: 14, motsFortsMax: 4 } as const;

/** Un élément de liste (case, jour, ligne cochée…) : son texte, un détail facultatif, le mot où il apparaît. */
export const schemaItemEcran = z.strictObject({
  texte: texteObligatoire(BORNES_ECRAN.itemMax),
  detail: texteObligatoire(BORNES_ECRAN.detailMax).optional(),
  ancre,
});

/**
 * Un écran de la scène (style `blocs/2`). Tous les champs sauf `moment` sont FACULTATIFS : un champ absent prend sa
 * valeur de repli (gabarit du moment, étiquette du moment…), jamais un échec du rendu. Le second écran d'une scène
 * part au mot `ancre` (plus grand que 0) ; le premier part avec la scène.
 */
export const schemaEcranTableau = z.strictObject({
  moment: z.enum(MOMENTS_ECRAN),
  gabarit: z.enum(GABARITS_ECRAN).optional(),
  /** Étiquette de section en haut à gauche (« Le constat », « La méthode »…). Absente : celle du moment. */
  etiquette: texteObligatoire(BORNES_ECRAN.etiquetteMax).optional(),
  /** Étape `n` sur `total` (moment « etape ») et son nom court pour la barre des étapes (« Tâche »). */
  etape: z.strictObject({ n: z.number().int().min(1).max(BORNES_ECRAN.etapesMax), total: z.number().int().min(1).max(BORNES_ECRAN.etapesMax), nom: texteObligatoire(BORNES_ECRAN.nomEtapeMax).optional() }).optional(),
  /** Mots forts : mis en bloc orange (texte ivoire). Chacun est un mot d'une ligne de l'écran. */
  motsForts: z.array(texteObligatoire()).min(1).max(BORNES_ECRAN.motsFortsMax).optional(),
  /** Éléments de liste, dans l'ordre d'apparition. */
  liste: z.array(schemaItemEcran).min(1).max(BORNES_ECRAN.itemsMax).optional(),
  /** Appel : le mot à écrire en commentaire (un mot d'une ligne de l'écran). */
  motCommentaire: texteObligatoire(20).optional(),
  /** Mot de la scène où l'écran part (second écran seulement). */
  ancre: ancre.optional(),
});
export type ItemEcran = z.infer<typeof schemaItemEcran>;
export type EcranTableau = z.infer<typeof schemaEcranTableau>;

/** Identifiant (heures du calage, mise en page) d'un écran et d'un élément de sa liste. */
export const idEcran = (sceneId: string, k: number) => `${sceneId}~e${k}`;
export const idItemEcran = (sceneId: string, k: number, i: number) => `${sceneId}~e${k}~${i}`;

/* ------------------------------------------------------------------ */
/* Style « reference/2 » : gabarit de page clair (champ FACULTATIF `gabarit`) */
/* ------------------------------------------------------------------ */

/**
 * Gabarit d'une scène (style « reference/2 ») : le rôle de SA PAGE (toutes les scènes d'une page ont le même) et, pour
 * la scène où la voix dit le numéro d'une étape (« Un… », « Deux… »), ce numéro et le mot où il est dit : la pastille
 * numérotée s'écrit à ce mot.
 */
/**
 * Style « reference/3 », PEPS (maquette validée par Will le 15/10, PR #260) — deux champs FACULTATIFS de la scène, une
 * fois par page au plus (`gabarit-3.ts`) ; une fiche sans eux se rend comme avant :
 *  - `visuel` : UN dessin de la banque fermée des 16 visuels (`visuels-3.ts`), tracé au crayon, avec ce qu'il écrit
 *    (un chiffre, un libellé, les deux côtés d'un schéma) et le mot où il part (`ancre` ; absent : après les lignes de
 *    la scène) ;
 *  - `bloc` : UN bloc orange plein (texte ivoire) avec, s'il y a lieu, un compteur qui défile de `de` à `a` ; il
 *    apparaît au mot `ancre` (absent : au début de la scène) et se pousse quand la voix dit son chiffre.
 */
export const schemaVisuelScene = z.strictObject({
  id: z.enum(IDS_VISUELS_3),
  chiffre: texteObligatoire(BORNES_VISUEL_3.chiffre).optional(),
  libelle: texteObligatoire(BORNES_VISUEL_3.libelle).optional(),
  gauche: texteObligatoire(BORNES_VISUEL_3.gauche).optional(),
  droite: texteObligatoire(BORNES_VISUEL_3.droite).optional(),
  ancre: ancre.optional(),
});
export const schemaBlocScene = z.strictObject({
  texte: texteObligatoire(BORNES_BLOC_3.texteMax),
  compteur: z.strictObject({ de: z.number().int().min(0).max(BORNES_BLOC_3.compteurMax), a: z.number().int().min(0).max(BORNES_BLOC_3.compteurMax) }).optional(),
  ancre: ancre.optional(),
});
export type VisuelScene = z.infer<typeof schemaVisuelScene>;
export type BlocScene = z.infer<typeof schemaBlocScene>;

export const schemaGabaritScene = z.strictObject({
  role: z.enum(ROLES_PAGE),
  numero: z.strictObject({ n: z.number().int().min(1).max(BORNES_GABARIT.numeroMax), ancre }).optional(),
  visuel: schemaVisuelScene.optional(),
  bloc: schemaBlocScene.optional(),
});
export type GabaritScene = z.infer<typeof schemaGabaritScene>;

/** Identifiant (heures du calage, mise en page) de la pastille numérotée d'une scène. */
export const idNumero = (sceneId: string) => `${sceneId}~n`;
/** Identifiants (heures du calage, mise en page) du visuel et du bloc orange d'une scène. */
export const idVisuel = (sceneId: string) => `${sceneId}~visuel`;
export const idBloc = (sceneId: string) => `${sceneId}~bloc`;

export type SceneTableau = SceneFiche<ElementTableau, EcranTableau, GabaritScene>;

/** Fiche de scènes du tableau animé : la fiche commune, avec les éléments (et les écrans, le gabarit) du format. */
export type FicheTableau = FicheScenes<ElementTableau, EcranTableau, GabaritScene> & { formatId: typeof FORMAT_TABLEAU };

/** Extension du format pour un contexte donné (les règles propres lisent le contexte injecté). */
export function extensionTableau(contexte: ContexteTableau): ExtensionFormat<ElementTableau, EcranTableau, GabaritScene> {
  return {
    formatId: FORMAT_TABLEAU,
    schemaElement: schemaElementTableau,
    schemaEcran: schemaEcranTableau,
    schemaGabarit: schemaGabaritScene,
    bornes: bornesFicheTableau,
    regles: reglesTableau(contexte) as ExtensionFormat<ElementTableau, EcranTableau, GabaritScene>["regles"],
  };
}

/**
 * Valide une fiche brute (JSON lu) du tableau animé : schéma commun et règles communes (V1), puis les règles du
 * format (V2 à V17, `regles.ts`). Refuse si une seule règle échoue ; ne modifie jamais la fiche.
 */
export function validerFicheTableau(brute: unknown, contexte: ContexteTableau): ResultatFiche<FicheTableau> {
  return validerFiche(brute, extensionTableau(contexte)) as ResultatFiche<FicheTableau>;
}
