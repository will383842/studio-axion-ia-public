/**
 * PLAN DE MISE EN SCÈNE du face caméra animé (`plan-facecam-animee/1`) — le CONTRAT entre le réalisateur (lot C, Claude
 * Opus ou règles fixes) et le rendu Remotion (`studio-rendu/compositions/interface-claire/VideoAnimee.tsx`).
 *
 * PUR (zod seulement) : importable côté serveur et côté rendu. Tous les instants sont en secondes, sur la ligne de temps
 * de la vidéo MONTÉE (après coupes). Chaque sous-élément porte l'instant du mot qu'il illustre (`a`).
 * Un changement de forme = nouvelle version du plan, jamais une retouche (les vidéos déjà faites restent reproductibles).
 */
import { z } from "zod";

export const VERSION_PLAN_FACECAM_ANIMEE = "plan-facecam-animee/1";

const instant = z.number().min(0);
const texteCourt = z.string().min(1).max(40);

/* ---------------- Sous-titres ---------------- */
export const schemaMotSousTitre = z.object({ w: z.string().min(1), a: instant, fort: z.boolean().optional() });
export const schemaGroupeSousTitre = z.object({ mots: z.array(schemaMotSousTitre).min(1).max(4), fin: instant });

/* ---------------- Contenus de cartes (un par comportement de la référence) ---------------- */
const pastilleIcone = z.object({ texte: texteCourt, icone: z.string().optional(), a: instant });

export const schemaContenuCarte = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("frise"),
    etapes: z.array(z.object({ texte: texteCourt, icone: z.string(), a: instant })).min(2).max(5),
    puces: z.array(z.object({ etape: z.number().int().min(0), texte: texteCourt, a: instant })).optional(),
    cocheA: instant.optional(),
    badge: z.object({ texte: texteCourt, a: instant }).optional(),
  }),
  z.object({
    type: z.literal("chat"),
    indication: z.string().max(40).optional(),
    message: z.object({ texte: z.string().min(1).max(60), a: instant, vitesse: z.number().positive().optional() }),
    reponse: z.object({ a: instant, lignes: z.number().int().min(1).max(4).optional(), icone: z.string().optional() }),
    puces: z.array(pastilleIcone).min(1).max(4),
  }),
  z.object({
    type: z.literal("grille"),
    colonnes: z.union([z.literal(2), z.literal(3)]).optional(),
    vignettes: z
      .array(
        z.object({
          a: instant,
          legende: texteCourt,
          contenu: z.discriminatedUnion("type", [
            z.object({ type: z.literal("image") }),
            z.object({ type: z.literal("ecran"), barres: z.number().int().min(1).max(5).optional() }),
            z.object({ type: z.literal("fiche"), lignes: z.number().int().min(1).max(5).optional(), icone: z.string().optional(), iconeA: instant.optional() }),
            z.object({ type: z.literal("texte"), titre: z.string().min(1).max(12), pastille: z.string().max(16).optional() }),
          ]),
        }),
      )
      .min(2)
      .max(6),
  }),
  z.object({
    type: z.literal("liste"),
    entete: z.object({ texte: texteCourt, icone: z.string().optional(), a: instant }).optional(),
    lignes: z.array(z.object({ texte: z.string().min(1).max(32), icone: z.string(), a: instant })).min(2).max(5),
    cocheA: instant.optional(),
    badge: z.object({ texte: texteCourt, icone: z.string().optional(), a: instant }).optional(),
  }),
  z.object({
    type: z.literal("calendrier"),
    jours: z.array(z.string().min(1).max(4)).min(5).max(7),
    rangees: z.number().int().min(1).max(3),
    pastilles: z.array(z.object({ jour: z.number().int().min(0), rangee: z.number().int().min(0), icone: z.string(), a: instant, accent: z.boolean().optional() })).min(2).max(10),
    rangee: z.array(z.object({ icone: z.string(), a: instant })).max(6).optional(),
  }),
  z.object({
    type: z.literal("graphique"),
    baseA: instant,
    // Proportions d'AFFICHAGE (0 → 1) : jamais un chiffre présenté comme résultat ; `compteur` seulement si le script le dit.
    barres: z.array(z.object({ hauteur: z.number().min(0.05).max(1), a: instant, libelle: z.string().max(10).optional(), accent: z.boolean().optional(), compteur: z.object({ jusqua: z.number(), suffixe: z.string().max(6).optional() }).optional() })).min(2).max(7),
    pastilles: z.array(pastilleIcone).max(3).optional(),
    mention: z.string().max(16).optional(),
  }),
  z.object({
    type: z.literal("statuts"),
    avant: z.object({ texte: texteCourt, icone: z.string().optional() }),
    apres: z.object({ texte: texteCourt, icone: z.string().optional() }),
    lignes: z.array(z.object({ nom: z.string().min(1).max(24), detail: z.string().max(30).optional(), a: instant, bascule: instant.optional(), apres: z.object({ texte: texteCourt, icone: z.string().optional() }).optional() })).min(2).max(6),
  }),
  z.object({
    type: z.literal("calcul"),
    unite: z.string().max(6),
    avant: z.object({ titre: texteCourt, a: instant, lignes: z.array(z.object({ libelle: texteCourt, valeur: z.number().int().min(0), a: instant })).min(1).max(4), libelleTotal: texteCourt, totalA: instant, barreA: instant.optional() }),
    apres: z.object({ titre: texteCourt, a: instant, lignes: z.array(z.object({ libelle: texteCourt, valeur: z.number().int().min(0), a: instant })).min(1).max(4), libelleTotal: texteCourt, totalA: instant, barreA: instant.optional() }),
    barreTotalAvantA: instant.optional(),
    badge: z.object({ texte: texteCourt, a: instant }).optional(),
  }),
  z.object({
    type: z.literal("logos"),
    compteur: z.array(z.object({ valeur: z.number().int().min(0), legende: texteCourt, a: instant })).min(1).max(4),
    tuiles: z.array(z.object({ icone: z.string().optional(), initiales: z.string().max(3).optional(), verrouillee: z.boolean().optional(), a: instant })).min(2).max(10),
    cadenas: z.object({ a: instant, texte: z.string().max(24).optional() }).optional(),
  }),
  z.object({
    type: z.literal("commentaire"),
    publication: z.object({ auteur: texteCourt, texte: z.string().max(80), a: instant }).optional(),
    champ: z.object({ indication: texteCourt, a: instant }),
    saisie: z.object({ texte: z.string().min(1).max(16), debut: instant, fin: instant }),
    bouton: z.object({ texte: texteCourt, a: instant }),
    commentaire: z.object({ auteur: texteCourt, a: instant, jaimeA: instant.optional() }),
    notification: z.object({ titre: texteCourt, texte: z.string().max(40), a: instant }).optional(),
  }),
]);

export const TYPES_CARTES = ["frise", "chat", "grille", "liste", "calendrier", "graphique", "statuts", "calcul", "logos", "commentaire"] as const;

/** Mots EXACTS de la transcription que l'objet montre (littéralité, retour de Will du 14/10 : « chaque animation représente ce que la personne dit »). */
const illustre = z.string().min(1).max(60);

export const schemaCarte = z.object({
  debut: instant,
  fin: instant,
  /** Nom de l'outil, du lieu ou de la chose (« Boîte mail », « Agenda du dirigeant ») — jamais une phrase abstraite. */
  titre: z.string().min(1).max(32),
  illustre: illustre.optional(),
  icone: z.string(),
  entree: z.enum(["chute", "glisse", "surgit"]),
  contenu: schemaContenuCarte,
});

/* ---------------- Fenêtres d'illustration ---------------- */
export const schemaFenetre = z.object({
  debut: instant,
  fin: instant,
  /** Clé de l'image ou de la vidéo dans le dossier de rendu (fournie par l'étape « Les photos et logos »). */
  media: z.string().min(1),
  /** Ce que l'image doit montrer (sert à la recherche : Mes images → Pexels → Pixabay). */
  recherche: z.string().min(1).max(60),
  video: z.boolean().optional(),
  capture: z.boolean().optional(),
  entree: z.enum(["droite", "bas", "zoom"]).optional(),
  noirEtBlancA: instant.optional(),
  etiquette: z.object({ texte: texteCourt, a: instant }).optional(),
  /**
   * Décision de Will (14/10) : un objet cache SOIT le visage entier, SOIT rien — jamais la moitié.
   * « sur-le-visage » (DÉFAUT quand absent) : grande fenêtre qui couvre TOUT le visage ;
   * « au-dessus » : la fenêtre se pose en haut et la prise descend, le visage reste entier.
   */
  cadrage: z.enum(["au-dessus", "sur-le-visage"]).optional(),
  /** Mini-vidéo : seconde du média où commencer la lecture (absent : 0). */
  depuisSec: z.number().min(0).optional(),
  /** Mots EXACTS de la transcription que la fenêtre montre. */
  illustre: illustre.optional(),
});

/** Cadrage d'une fenêtre quand le plan ne le précise pas. */
export const CADRAGE_FENETRE_DEFAUT = "sur-le-visage" as const;

/**
 * Mouvements de cadrage sur la prise (dynamisme demandé par Will le 14/10 : « zooms plus nombreux et variés »), en plus
 * des zooms coupés : zoom rapide avant, recul rapide, recadrage décalé à gauche ou à droite (gros plan de côté).
 */
export const schemaMouvement = z.object({
  debut: instant,
  fin: instant,
  type: z.enum(["zoom-rapide", "recul", "decale-gauche", "decale-droite"]),
  echelle: z.number().min(1.05).max(1.5),
});

/* ---------------- Calques posés sur l'image ---------------- */
export const schemaCalque = z.discriminatedUnion("type", [
  z.object({ type: z.literal("etiquette"), debut: instant, fin: instant, texte: texteCourt, fond: z.enum(["ivoire", "orange", "encre"]).optional(), icones: z.array(z.object({ nom: z.string(), a: instant })).max(4).optional(), barreA: instant.optional(), sousTexte: z.string().max(24).optional() }),
  z.object({ type: z.literal("glisse"), debut: instant, fin: instant, texte: texteCourt, icone: z.string().optional() }),
  z.object({ type: z.literal("compteur"), debut: instant, fin: instant, de: z.number(), a: z.number(), dureeDefilement: z.number().positive().max(3).optional(), prefixe: z.string().max(4).optional(), suffixe: z.string().max(10).optional(), legende: z.string().max(20).optional(), fond: z.enum(["ivoire", "orange", "encre"]).optional() }),
  z.object({ type: z.literal("logos"), debut: instant, fin: instant, logos: z.array(z.object({ icone: z.string(), a: instant })).min(2).max(6) }),
  z.object({ type: z.literal("tuile"), debut: instant, fin: instant, icone: z.string(), legende: texteCourt }),
]);

/* ---------------- Motions : les 12 familles « motion design » hors cartes (retour de Will du 15/10) ---------------- */

/**
 * Retour de Will sur la vidéo 5 (15/10) : « c'est presque toujours les mêmes choses qui reviennent en animations, il faut
 * beaucoup plus de types d'animations ou de motions design différents ». Les 12 familles ci-dessous s'ajoutent aux
 * fenêtres, étiquettes et cartes (15 familles en tout). Leur rendu vit dans
 * `studio-rendu/compositions/interface-claire/motion/` ; leur choix, leurs plafonds et leur alternance sont contrôlés par
 * le réalisateur (`regles.ts`, règles R1 à R7 du directeur artistique).
 */
export const FAMILLES_MOTION = ["mot-geant", "ecran-partage", "telephone", "carte-france", "pile-notifications", "chiffre-eclate", "trait-dessine", "volet", "ruban", "horloge", "jauge", "bulles"] as const;
export type FamilleMotion = (typeof FAMILLES_MOTION)[number];

/** Place d'un objet à l'écran (une même place 2 fois de suite au plus, R4c). */
export const PLACES_ECRAN = ["haut", "bas", "gauche", "droite", "centre", "plein"] as const;
/** Animation d'entrée d'une motion (une même entrée 2 fois de suite au plus, R4c). */
export const ENTREES_MOTION = ["pop", "glisse-gauche", "glisse-droite", "monte", "descend", "dessin", "balayage", "eclat", "fondu"] as const;

const elementMotion = (max: number) => z.object({ texte: z.string().min(1).max(max), a: instant, icone: z.string().optional() });

/**
 * Contenu de chaque famille (validé par famille ; `loose` : le rendu peut lire des réglages en plus sans casser le plan).
 * Tous les instants s'appellent `a` (sous-éléments ancrés sur un début de mot, comme dans les cartes). Aucun nombre
 * affiché qui ne soit pas dit : seuls `chiffre-eclate.valeur` et `horloge.duree.valeur` sont des nombres affichés ; les
 * `niveau` d'une jauge sont des PROPORTIONS d'affichage (0 à 1).
 */
export const SCHEMAS_CONTENU_MOTION = {
  /** 1 à 3 mots dits, en très grand, plein écran (couvre le visage). */
  "mot-geant": z.looseObject({ mots: z.array(z.object({ texte: z.string().min(1).max(16), a: instant })).min(1).max(3), fond: z.enum(["orange", "encre", "ivoire"]).optional() }),
  /** Deux colonnes opposées (avant / après, sans / avec…) qui se remplissent ; plein écran (couvre le visage). */
  "ecran-partage": z.looseObject({
    gauche: z.object({ titre: texteCourt, icone: z.string().optional(), a: instant }),
    droite: z.object({ titre: texteCourt, icone: z.string().optional(), a: instant }),
    elements: z.array(z.object({ cote: z.enum(["gauche", "droite"]), texte: texteCourt, icone: z.string().optional(), a: instant })).max(4).optional(),
    barreGaucheA: instant.optional(),
  }),
  /** Téléphone dont l'écran s'anime (application, puis une ligne par chose dite). */
  telephone: z.looseObject({ appli: z.enum(["mail", "message", "agenda", "visio", "notification", "lien"]), lignes: z.array(elementMotion(28)).min(1).max(4) }),
  /** Carte de France dont les points s'allument (jamais de nom de ville). */
  "carte-france": z.looseObject({ points: z.array(z.object({ a: instant })).min(2).max(8), legende: z.string().max(24).optional() }),
  /** Pile de notifications qui s'empilent (une par tâche dite). */
  "pile-notifications": z.looseObject({ notifications: z.array(z.object({ titre: z.string().min(1).max(24), texte: z.string().max(32).optional(), icone: z.string(), a: instant })).min(2).max(5) }),
  /** Un nombre DIT qui éclate (`eclatA` : les éclats partent). */
  "chiffre-eclate": z.looseObject({ valeur: z.number(), a: instant, suffixe: z.string().max(10).optional(), legende: z.string().max(20).optional(), eclatA: instant.optional() }),
  /** Soulignement ou encadré dessiné autour d'un mot du sous-titre (1 à 3 mots, chacun sur son instant). */
  "trait-dessine": z.looseObject({ forme: z.enum(["souligne", "encadre", "entoure"]), traits: z.array(z.object({ mot: z.string().min(1).max(30), a: instant })).min(1).max(3) }),
  /** Volet de transition coloré qui balaie l'image, avec le nom de la partie (couvre le visage). */
  volet: z.looseObject({ titre: z.string().min(1).max(24), a: instant, couleur: z.enum(["orange", "encre", "sable"]).optional() }),
  /** Ruban de mots-clés qui défile (chaque mot entre sur son instant). */
  ruban: z.looseObject({ mots: z.array(z.object({ texte: z.string().min(1).max(20), a: instant })).min(3).max(8) }),
  /** Horloge qui s'emballe (`a`) ou minuteur ; `duree` seulement si Will la dit. */
  horloge: z.looseObject({ mode: z.enum(["horloge", "minuteur"]), a: instant, reperes: z.array(z.object({ a: instant })).max(4).optional(), duree: z.object({ valeur: z.number().positive(), unite: z.string().max(6) }).optional(), legende: z.string().max(20).optional() }),
  /** Jauge ou cadran dont l'aiguille monte de niveau en niveau (proportions d'affichage). */
  jauge: z.looseObject({ forme: z.enum(["cadran", "barre"]), legende: texteCourt, niveaux: z.array(z.object({ niveau: z.number().min(0).max(1), a: instant })).min(1).max(4) }),
  /** Bulles de questions qui flottent (les questions DITES). */
  bulles: z.looseObject({ questions: z.array(z.object({ texte: z.string().min(1).max(40), a: instant })).min(1).max(4) }),
} as const satisfies Record<FamilleMotion, z.ZodType>;

/**
 * Une motion du plan. `contenu` est un objet libre dans le contrat (les designers peuvent y lire des réglages en plus),
 * validé contre le schéma de SA famille (`SCHEMAS_CONTENU_MOTION`) ; `illustre` : les mots EXACTS dits qu'elle montre.
 */
export const schemaMotion = z
  .object({
    debut: instant,
    fin: instant,
    famille: z.enum(FAMILLES_MOTION),
    contenu: z.record(z.string(), z.unknown()),
    illustre: illustre.optional(),
    place: z.enum(PLACES_ECRAN).optional(),
    entree: z.enum(ENTREES_MOTION).optional(),
  })
  .superRefine((m, ctx) => {
    const lu = SCHEMAS_CONTENU_MOTION[m.famille].safeParse(m.contenu);
    if (!lu.success) for (const i of lu.error.issues) ctx.addIssue({ code: "custom", path: ["contenu", ...i.path.map((p) => (typeof p === "symbol" ? String(p) : p))], message: `${m.famille} : ${i.message}` });
  });

/** Même motion, contenu typé par famille : la forme demandée à Claude (sortie structurée). */
export const schemaMotionTypee = z.discriminatedUnion(
  "famille",
  FAMILLES_MOTION.map((f) =>
    z.object({ debut: instant, fin: instant, famille: z.literal(f), contenu: SCHEMAS_CONTENU_MOTION[f], illustre: illustre.optional(), place: z.enum(PLACES_ECRAN).optional(), entree: z.enum(ENTREES_MOTION).optional() }),
  ) as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]],
);

/* ---------------- Éléments « v2 énergie » (16/10) : 24 éléments du catalogue `catalogue-v2.ts` ---------------- */

/**
 * Un élément « v2 énergie » du plan : son `id` renvoie à une fiche du catalogue du réalisateur (emplacement, forme, mouvement,
 * sortie, taille… y sont lus), les instants et les mots DITS sont ceux de CETTE vidéo. FACULTATIF : un plan sans ce champ
 * reste valide et se contrôle comme avant. Le contrôle (règles D1 à D13 du standard, `regles-v2.ts`) lit ce champ.
 */
export const schemaElementV2 = z.object({
  id: z.string().min(1).max(40),
  debut: instant,
  fin: instant,
  /** Inclinaison posée (degrés, positif = sens horaire) quand elle diffère de celle de la fiche du catalogue. */
  angle: z.number().min(-90).max(90).optional(),
  /** Mots (ou chiffre) DITS que l'élément affiche, tels qu'écrits à l'écran : 0 à 3 textes. */
  mots: z.array(z.string().min(1).max(40)).max(3).optional(),
  illustre: illustre.optional(),
});

/* ---------------- Éléments « v3 » (16/10) : 23 éléments du catalogue `catalogue-v3.ts` (14 actifs) ---------------- */

/**
 * Un élément « v3 » du plan (la vidéo de référence modernisée : fenêtres vidéo, cartes en verre, typographie vivante, coups de
 * poing). Son `id` renvoie à une fiche du catalogue du réalisateur (`catalogue-v3.ts` : emplacement, forme, mouvement, famille,
 * durées, visage couvert ou entier, coup de poing…). Les instants et les mots DITS sont ceux de CETTE vidéo. FACULTATIF : un plan
 * sans ce champ reste valide. Le contrôle (règles `regles-v3.ts`) lit ce champ ; le rendu (`motion-v3/registre-v3.tsx`) aussi.
 */
export const schemaElementV3 = z.object({
  id: z.string().min(1).max(40),
  debut: instant,
  fin: instant,
  /** Textes (mots ou chiffre DITS) affichés tels qu'écrits à l'écran : étiquette, titre, mot géant, termes d'un duel, 3 mots d'une rafale… */
  mots: z.array(z.string().min(1).max(40)).max(6).optional(),
  /** Lignes ou bulles dites, datées (carte en verre, notifications, face verso d'une carte) : `a` = instant (s) où Will dit le mot. */
  lignes: z.array(z.object({ texte: z.string().min(1).max(40), a: instant, icone: z.string().max(24).optional() })).max(5).optional(),
  /** Un nombre DIT par Will (éclat-chiffre, widget-chiffre). */
  nombre: z.number().min(0).max(1_000_000_000).optional(),
  /** Instants dits utiles à l'élément (rafale : mots 2 et 3 ; duel : instant du verdict). */
  instants: z.array(instant).max(3).optional(),
  /** Ce que chaque vidéo de l'élément doit montrer (recherche : Mes images → Pexels → Pixabay), une par vidéo. */
  recherches: z.array(z.string().min(1).max(60)).max(6).optional(),
  /** Clés des vidéos dans le dossier de rendu (fournies par l'étape « Les photos et logos »), dans l'ordre de `recherches`. */
  medias: z.array(z.string().min(1)).max(6).optional(),
  depuisSec: z.number().min(0).optional(),
  /** Côté d'où l'élément arrive (les éléments latéraux et les fenêtres à miroir). */
  sens: z.enum(["gauche", "droite"]).optional(),
  /** Duel : le gagnant, si Will tranche (`a` = instant dit). */
  verdict: z.object({ gagnant: z.enum(["A", "B"]), a: instant }).optional(),
  /** Mots EXACTS de la transcription que l'élément montre (littéralité). */
  illustre: illustre.optional(),
});

/* ---------------- Éléments « v4 » (17/10) : les 26 plaquettes gardées par Will (`catalogue-v4.ts`) ---------------- */

/**
 * Un élément « v4 » du plan (style « qui claque » : aplats, contours encre, ombres dures, palette orange). Son `id` renvoie à une fiche
 * du catalogue v4 du réalisateur (`realisateur/catalogue-v4.ts`) et à un composant du registre de rendu (`motion-v4/registre-v4.tsx`).
 * Mêmes champs que l'élément v3, avec des bornes plus larges (les cartes du lot 2 prennent jusqu'à 5 déclencheurs datés).
 * FACULTATIF : un plan sans ce champ reste valide. Les instants sont ceux de CETTE vidéo (secondes, ligne de temps montée).
 */
export const schemaElementV4 = z.object({
  id: z.string().min(1).max(40),
  debut: instant,
  fin: instant,
  /** Textes (mots ou chiffre DITS) affichés tels qu'écrits à l'écran. */
  mots: z.array(z.string().min(1).max(40)).max(8).optional(),
  /** Lignes ou bulles dites, datées : `a` = instant (s) où Will dit le mot. */
  lignes: z.array(z.object({ texte: z.string().min(1).max(40), a: instant, icone: z.string().max(24).optional() })).max(6).optional(),
  /** Un nombre DIT par Will. */
  nombre: z.number().min(0).max(1_000_000_000).optional(),
  /** Instants dits utiles à l'élément (secondes, ligne de temps de la vidéo). */
  instants: z.array(instant).max(6).optional(),
  /** Ce que chaque vidéo de l'élément doit montrer (Mes images → Pexels → Pixabay), une par vidéo. */
  recherches: z.array(z.string().min(1).max(60)).max(6).optional(),
  /** Clés des vidéos dans le dossier de rendu, dans l'ordre de `recherches`. */
  medias: z.array(z.string().min(1)).max(6).optional(),
  depuisSec: z.number().min(0).optional(),
  sens: z.enum(["gauche", "droite"]).optional(),
  verdict: z.object({ gagnant: z.enum(["A", "B"]), a: instant }).optional(),
  /** Mots EXACTS de la transcription que l'élément montre (littéralité). */
  illustre: illustre.optional(),
});

/* ---------------- Plan complet ---------------- */
export const schemaPlanFacecamAnimee = z.object({
  version: z.literal(VERSION_PLAN_FACECAM_ANIMEE),
  charte: z.string(),
  duree: z.number().positive(),
  fps: z.number().int().positive(),
  largeur: z.number().int().positive(),
  hauteur: z.number().int().positive(),
  /**
   * `yeux` : hauteur des yeux de Will dans la prise (fraction de la hauteur, détection des visages du studio) ; absente : 0,34.
   * `centreX` : centre horizontal du visage (fraction de la largeur) ; absent : 0,5.
   * `largeurVisage` : largeur du visage (fraction de la largeur) ; absente : 0,38.
   */
  prise: z.object({
    src: z.string(),
    finSec: z.number().positive(),
    yeux: z.number().min(0.1).max(0.7).optional(),
    centreX: z.number().min(0.1).max(0.9).optional(),
    largeurVisage: z.number().min(0.15).max(0.7).optional(),
  }),
  groupes: z.array(schemaGroupeSousTitre),
  zooms: z.array(z.tuple([instant, instant, z.number().min(1).max(1.5)])),
  mouvements: z.array(schemaMouvement).optional(),
  cartes: z.array(schemaCarte),
  fenetres: z.array(schemaFenetre),
  calques: z.array(schemaCalque),
  /** Motions (15/10, FACULTATIF : un plan sans ce champ reste valide et se rend comme avant). */
  motions: z.array(schemaMotion).optional(),
  /** Éléments « v2 énergie » (16/10, FACULTATIF) : voir `schemaElementV2`. */
  elementsV2: z.array(schemaElementV2).optional(),
  /** Éléments « v3 » (16/10, FACULTATIF) : voir `schemaElementV3`. Ils remplacent les éléments v2 (écartés). */
  elementsV3: z.array(schemaElementV3).optional(),
  /** Éléments « v4 » (17/10, FACULTATIF) : les 26 plaquettes de `catalogue-v4.ts`. Ils remplacent les éléments v3 (écartés). */
  elementsV4: z.array(schemaElementV4).optional(),
  fin: z.object({ debut: instant, marque: z.string(), adresse: z.string(), motCle: z.string(), tuiles: z.array(z.string()).max(5), appel: z.string().max(32).optional() }),
  /** Bruitages : [instant, son, volume]. Dérivés des événements (lot E) ; le réalisateur n'en écrit pas. */
  sons: z.array(z.tuple([instant, z.string(), z.number().min(0).max(1)])),
  /** Pastille de nom des composants (galerie de validation seulement). */
  pastilles: z.boolean().optional(),
});

/** Valeurs par défaut de la prise quand le plan ne les donne pas. */
export const PRISE_DEFAUTS = Object.freeze({ yeux: 0.34, centreX: 0.5, largeurVisage: 0.38 });

export type MotSousTitrePlan = z.infer<typeof schemaMotSousTitre>;
export type GroupeSousTitrePlan = z.infer<typeof schemaGroupeSousTitre>;
export type ContenuCarte = z.infer<typeof schemaContenuCarte>;
export type TypeCarte = ContenuCarte["type"];
export type CartePlan = z.infer<typeof schemaCarte>;
export type FenetrePlan = z.infer<typeof schemaFenetre>;
export type CalquePlan = z.infer<typeof schemaCalque>;
export type PlanFacecamAnimee = z.infer<typeof schemaPlanFacecamAnimee>;
export type MouvementPlan = z.infer<typeof schemaMouvement>;
export type MotionPlan = z.infer<typeof schemaMotion>;
export type ElementV2Plan = z.infer<typeof schemaElementV2>;
export type ElementV3Plan = z.infer<typeof schemaElementV3>;
export type ElementV4Plan = z.infer<typeof schemaElementV4>;
export type PlaceEcran = (typeof PLACES_ECRAN)[number];
export type EntreeMotion = (typeof ENTREES_MOTION)[number];
export type ContenuMotion<F extends FamilleMotion> = z.infer<(typeof SCHEMAS_CONTENU_MOTION)[F]>;
