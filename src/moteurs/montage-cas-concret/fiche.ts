/**
 * FICHE D'ÉCRANS DU CAS CONCRET (`fiche-ecrans/1`, tâche M0, plan cas concret § 4-a, § 6 et § 8).
 *
 * Pièce PROPRE au format : la fiche de scènes commune (`src/briques/fiche-scenes`) n'est pas élargie. On en importe ce qui
 * est neutre (`jsonCanonique`, `texteObligatoire`, `identifiantSur`, la forme `ProblemeFiche` / `ResultatFiche`).
 *
 * Une fiche = le CORPS de la vidéo (accroche → question), découpé en écrans « e01 », « e02 »… La fin n'y est jamais : elle
 * vient de la table des fins (`src/briques/fins`) et vit dans le `PlanDesFins` (un `FinPlanifiee` par suite de réseaux).
 * Un écran démarre au premier mot de son `texteDit`, moins `avanceMs` ; `debutMs` et `finMs` sont posés par le calage.
 *
 * Schéma EXACT : tout champ inconnu est refusé, aucune valeur n'est corrigée. `validerSchemaFiche` ne vérifie que la forme
 * (règle R01 et suite des identifiants) ; les règles R02 à R22 vivent dans `regles.ts`.
 */
import { z } from "zod";
import { identifiantSur, jsonCanonique, texteObligatoire, type ProblemeFiche, type ResultatFiche } from "@/briques/fiche-scenes";
import type { FinChoisie } from "@/briques/fins";
import { OBJETS, OFFRES, POSTURES } from "@/formats/cas-concret/cas";
import type { ReseauCas } from "@/formats/cas-concret";
import { schemaMise, STRUCTURES, type TirageEcran } from "./variete";

export const VERSION_FICHE_ECRANS = "fiche-ecrans/1";
export const FORMAT_CAS_CONCRET = "cas-concret";

/** Les 9 types du corps, puis les 4 types de la fin (plan § 6.1 ; « diagnostic » depuis X6). */
export const TYPES_ECRAN_CORPS = ["accroche", "chiffre", "liste-avant", "titre", "etape", "objet", "preuve", "resultat", "question"] as const;
export const TYPES_ECRAN_FIN = ["appel-mot", "promesse", "diagnostic", "lien"] as const;
export const TYPES_ECRAN = [...TYPES_ECRAN_CORPS, ...TYPES_ECRAN_FIN] as const;
export type TypeEcran = (typeof TYPES_ECRAN)[number];

export const FONDS = ["sombre", "ivoire"] as const;
export type Fond = (typeof FONDS)[number];

/** Porte A : un cas du catalogue ; porte B (phase 2) : un texte libre devenu cas. */
export const ORIGINES = ["porte-a", "porte-b"] as const;
export type Origine = (typeof ORIGINES)[number];

export const AVANCE_MAX_MS = 500;

/** Mot sans casse, sans accent, sans ponctuation : « D'abord » et « dabord » désignent le même mot. */
export const cleMot = (m: string): string =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Morceaux du texte séparés par des blancs, ponctuation isolée comprise (« : », « ? ») : pour découper ou recoller un texte. */
export const motsDe = (t: string): string[] => t.split(/\s+/).filter(Boolean);

/**
 * Mots lus d'un texte dit : les morceaux qui portent une lettre ou un chiffre. Un signe isolé (« : », « ? », « ! », « — »)
 * n'est pas un mot. SEUL comptage des mots du format : rang `surMot` d'un événement (fiche, règles, écriture), calage.
 */
export const motsLus = (t: string): string[] => motsDe(t).filter((m) => /[\p{L}\p{N}]/u.test(m));

/**
 * Noms des événements (`cible`) : LISTE FERMÉE, la seule du format, faite de ce que lisent les compositions
 * (`studio-rendu/compositions/cas-concret/plans/`, comparé par un test). `fixes` : noms entiers ; `numerotes` : préfixes
 * suivis d'un rang à partir de 1 (`titre-2`, `tache-4`, `puce-1`, `pastille-3`, `notification-2`).
 */
export const EVENEMENTS_CAS_CONCRET = Object.freeze({
  fixes: Object.freeze([
    "eclair", "titre", "ligne", "unite", "compteur", "total", "coche", "barre-avant", "barre-maintenant", "question",
    "objet", "notification", "chrono", "signature", "classe", "onde", "mot", "invite", "suite", "champ", "cadeau", "lien",
  ] as const),
  numerotes: Object.freeze(["titre", "tache", "puce", "pastille", "notification"] as const),
});

/** Le nom d'événement est-il lu par une composition ? */
export function evenementConnu(cible: string): boolean {
  if ((EVENEMENTS_CAS_CONCRET.fixes as readonly string[]).includes(cible)) return true;
  const m = /^([a-z-]+)-([1-9]\d?)$/.exec(cible);
  return !!m && (EVENEMENTS_CAS_CONCRET.numerotes as readonly string[]).includes(m[1]);
}

/**
 * Événement que lit l'objet dessiné d'un visuel (moment où il s'anime), s'il en lit un ; un vrai écran : l'onde du doigt.
 * Tout visuel lit aussi `objet` (une impulsion, et la vibration des bruitages pour une notification).
 */
export const EVENEMENT_DE_L_OBJET: Readonly<Partial<Record<(typeof OBJETS)[number], string>>> = Object.freeze({
  "telephone-capture": "onde",
  "telephone-notification": "notification",
  "pile-notifications": "notification-1",
  chrono: "chrono",
  "contrat-signature": "signature",
  "dossier-classe": "classe",
});

/** Identifiant attendu de l'écran de rang `i` du corps (0 → « e01 »). */
export function idEcranAttendu(i: number): string {
  return `e${String(i + 1).padStart(2, "0")}`;
}

/** Identifiant attendu de l'écran de rang `i` d'une fin (0 → « f01 »). */
export function idEcranFinAttendu(i: number): string {
  return `f${String(i + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Pièces communes à tous les écrans                                     */
/* ------------------------------------------------------------------ */

const avance = z.number().int().min(0).max(AVANCE_MAX_MS);
const milliseconde = z.number().int().nonnegative();
const texte = (max: number) => texteObligatoire(max);

/** Moment où une partie de l'écran apparaît : au début du mot lu de rang `surMot` (`motsLus`, 0 = premier mot du `texteDit`), moins `avanceMs`. */
export const schemaEvenement = z.strictObject({
  /** Partie visée (« titre-2 », « tache-3 », « puce-1 », « chrono », « eclair »…) : un nom de `EVENEMENTS_CAS_CONCRET`. */
  cible: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,31}$/, { message: "nom de partie mal formé" })
    .refine(evenementConnu, { error: (iss) => `nom de partie « ${String(iss.input)} » inconnu des écrans` }),
  surMot: z.number().int().nonnegative(),
  avanceMs: avance,
});
export type Evenement = z.infer<typeof schemaEvenement>;

const champsCommuns = {
  id: z.string().regex(/^[ef]\d{2}$/, { message: "identifiant d'écran mal formé" }),
  fond: z.enum(FONDS),
  /** « axion-ia.com », en haut de la zone sûre (vérifiée par R09). */
  marque: texte(40),
  texteDit: texte(400),
  avanceMs: avance,
  evenements: z.array(schemaEvenement),
  /** Éclair orange (trois moments clés par vidéo). */
  eclair: z.boolean().optional(),
  /** Posés par le calage ; absents de la fiche brute. */
  debutMs: milliseconde.optional(),
  finMs: milliseconde.optional(),
};

/** Visuel d'une étape ou d'un écran `objet` : un objet de la banque fermée, ou le vrai écran de l'étape (capture) avec son repli. */
const visuelObjet = z.strictObject({
  sorte: z.literal("objet"),
  objet: z.enum(OBJETS),
  /** Textes portés par l'objet (pastilles d'`outils-relies`, objet d'un `e-mail`, modules d'un `programme`…). */
  textes: z.array(texte(40)).min(1).max(3).optional(),
});
const visuelEcran = z.strictObject({
  sorte: z.literal("ecran"),
  /** Rang de l'étape du cas (1 = première) dont la capture est montrée : l'adresse et le mouvement viennent du cas. */
  etapeCas: z.number().int().min(1).max(7),
  /** Objet dessiné à la place si la capture manque (R19). */
  repli: z.enum(OBJETS),
  /** Page entière : part de la hauteur de la page (0 = haut) montrée d'emblée, là où est la partie utile (un calendrier). */
  departPage: z.number().min(0).max(1).optional(),
});
export const schemaVisuel = z.discriminatedUnion("sorte", [visuelObjet, visuelEcran]);
export type VisuelEcran = z.infer<typeof schemaVisuel>;

/** Un mot désigné doit être un mot du texte de l'écran. */
function motPresent(mot: string, textes: readonly string[]): boolean {
  const cle = cleMot(mot);
  return cle.length > 0 && textes.some((t) => motsDe(t).some((m) => cleMot(m) === cle));
}

/* ------------------------------------------------------------------ */
/* Les 12 types (plan § 6.1)                                             */
/* ------------------------------------------------------------------ */

export const schemaAccroche = z
  .strictObject({
    ...champsCommuns,
    type: z.literal("accroche"),
    etiquette: texte(40),
    lignes: z.array(texte(60)).min(2).max(3),
    /** Le mot écrit en orange ; un mot des lignes. */
    motOrange: texte(30),
  })
  .superRefine((e, ctx) => {
    if (!motPresent(e.motOrange, e.lignes)) ctx.addIssue({ code: "custom", path: ["motOrange"], message: `le mot orange « ${e.motOrange} » n'est pas un mot des lignes` });
  });

export const schemaChiffre = z.strictObject({
  ...champsCommuns,
  type: z.literal("chiffre"),
  /** Nombre affiché ; doit être une valeur d'un fait du cas (R12). */
  valeur: z.number().finite(),
  unite: texte(20),
  /** Fait du cas dont vient la valeur. */
  faitId: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/, { message: "identifiant de fait mal formé" }),
  pastilles: z.array(texte(30)).max(3),
  variante: z.enum(["simple", "compteur"]),
});

export const schemaListeAvant = z.strictObject({
  ...champsCommuns,
  type: z.literal("liste-avant"),
  /** V4-3 : jusqu'à 6 tâches sur un écran, comme le plan s4 de la v4. */
  taches: z.array(texte(60)).min(2).max(6),
  /** Pastille du total (« 3 h par semaine »). */
  total: texte(40).optional(),
});

export const schemaTitre = z
  .strictObject({
    ...champsCommuns,
    type: z.literal("titre"),
    lignes: z.array(texte(60)).min(1).max(2),
    // 15/10 (essai blog) : Claude a rendu « "orange": "seul" » au lieu de « ["seul"] » ; un mot seul est lu comme une liste
    // d'un mot (même contenu, aucune réparation du sens) au lieu de refuser une réponse payée.
    orange: z.preprocess((v) => (typeof v === "string" ? [v] : v), z.array(texte(30)).min(1).max(2)).optional(),
  })
  .superRefine((e, ctx) => {
    (e.orange ?? []).forEach((m, i) => {
      if (!motPresent(m, e.lignes)) ctx.addIssue({ code: "custom", path: ["orange", i], message: `le mot orange « ${m} » n'est pas un mot des lignes` });
    });
  });

export const schemaEtape = z.strictObject({
  ...champsCommuns,
  type: z.literal("etape"),
  /** « Étape 0n » ; le fil d'avancement vaut `numero / total`. */
  numero: z.number().int().min(1).max(7),
  total: z.number().int().min(3).max(7),
  titre: texte(60),
  ligne: texte(120),
  visuel: schemaVisuel,
  puces: z.array(texte(40)).max(2),
});

export const schemaObjet = z.strictObject({
  ...champsCommuns,
  type: z.literal("objet"),
  titre: texte(60),
  ligne: texte(120).optional(),
  visuel: visuelObjet,
});

export const schemaPreuve = z.strictObject({
  ...champsCommuns,
  type: z.literal("preuve"),
  titre: texte(60),
  puces: z.array(texte(40)).length(2),
});

/** Barre du résultat : `valeur` est celle d'un fait du cas (`faitId`) ; le texte affiché en est tiré, jamais calculé. */
const barre = z.strictObject({ libelle: texte(30), valeur: z.number().finite().nonnegative(), faitId: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/, { message: "identifiant de fait mal formé" }).optional() });

export const schemaResultat = z.strictObject({
  ...champsCommuns,
  type: z.literal("resultat"),
  titre: texte(60),
  avant: barre,
  maintenant: barre,
  ligne: texte(120),
});

export const schemaQuestion = z.strictObject({
  ...champsCommuns,
  type: z.literal("question"),
  lignes: z.array(texte(60)).length(2),
  question: texte(120),
});

/** Identifiants des lignes de la table des fins montrées par un écran de fin (texte écrit et dit tirés de ces lignes). */
const finsMontrees = z.array(texte(64)).min(1).max(3);

export const schemaAppelMot = z.strictObject({
  ...champsCommuns,
  type: z.literal("appel-mot"),
  fins: finsMontrees,
  /** Le mot tapé dans le champ de commentaire (forme écrite, « IA »). */
  mot: z.string().regex(/^[\p{L}\p{N}]{2,24}$/u, { message: "mot de 2 à 24 lettres ou chiffres, sans espace" }),
});

export const schemaPromesse = z.strictObject({
  ...champsCommuns,
  type: z.literal("promesse"),
  fins: finsMontrees,
  /** Le cadeau, en orange (« Toute la structure de cette automatisation »). */
  cadeau: texte(80),
  ligne: texte(80).optional(),
});

/** L'écran du diagnostic (X6) : « Faites votre diagnostic gratuit », puis « en quelques minutes ». */
export const schemaDiagnostic = z.strictObject({
  ...champsCommuns,
  type: z.literal("diagnostic"),
  fins: finsMontrees,
  titre: texte(80),
  ligne: texte(80).optional(),
});

export const schemaLien = z.strictObject({
  ...champsCommuns,
  type: z.literal("lien"),
  fins: finsMontrees,
  /** La phrase du lien, telle que dite (« Le lien est en commentaire »). */
  titre: texte(80),
  /** Texte de la bulle du lien (« Diagnostic gratuit · lien en commentaire »). */
  bulle: texte(80),
});

export const schemaEcranCorps = z.discriminatedUnion("type", [schemaAccroche, schemaChiffre, schemaListeAvant, schemaTitre, schemaEtape, schemaObjet, schemaPreuve, schemaResultat, schemaQuestion]);
export const schemaEcranFin = z.discriminatedUnion("type", [schemaAppelMot, schemaPromesse, schemaDiagnostic, schemaLien]);
export const schemaEcran = z.discriminatedUnion("type", [schemaAccroche, schemaChiffre, schemaListeAvant, schemaTitre, schemaEtape, schemaObjet, schemaPreuve, schemaResultat, schemaQuestion, schemaAppelMot, schemaPromesse, schemaDiagnostic, schemaLien]);

export type EcranCorps = z.infer<typeof schemaEcranCorps>;
export type EcranFin = z.infer<typeof schemaEcranFin>;
export type Ecran = z.infer<typeof schemaEcran>;
export type EcranDeType<T extends TypeEcran> = Extract<Ecran, { type: T }>;

/* ------------------------------------------------------------------ */
/* Fiche                                                                 */
/* ------------------------------------------------------------------ */

export const schemaFicheEcrans = z.strictObject({
  version: z.literal(VERSION_FICHE_ECRANS),
  formatId: z.literal(FORMAT_CAS_CONCRET),
  videoId: identifiantSur,
  versionId: identifiantSur,
  /** Figé à la création (« charte-duo/1 »). */
  habillage: texte(40),
  ratio: z.literal("9:16"),
  offre: z.enum(OFFRES),
  origine: z.enum(ORIGINES),
  posture: z.enum(POSTURES),
  casId: z.string().regex(/^[a-z][a-z0-9-]{1,47}$/, { message: "identifiant de cas mal formé" }),
  empreinteCas: texte(80),
  /** Le corps seul, accroche → question. Bornes (12 à 26) : règle R20. */
  ecrans: z.array(schemaEcranCorps).min(1),
  /**
   * D2 · structure dans laquelle le script a été écrit (`resultat-d-abord`, `probleme-solution`, `une-journee`). JAMAIS
   * posée pour la v4 : une fiche v4 reste octet pour octet ce qu'elle était.
   */
  structure: z.enum(STRUCTURES).optional(),
  /**
   * L2 · tirage de la variété (`variete.ts`), écrit au calage et hérité par les versions. FACULTATIF : une fiche sans
   * `mise` (toutes celles d'avant le 15/10) est la v4 exacte, avec les mêmes empreintes.
   */
  mise: schemaMise.optional(),
});

export type FicheEcrans = z.infer<typeof schemaFicheEcrans>;

/** Cadre figé d'une fiche, compté dans l'empreinte de chaque écran. */
export type CadreEcrans = Pick<FicheEcrans, "version" | "formatId" | "habillage" | "ratio">;

export function cadreDeFicheEcrans(fiche: FicheEcrans): CadreEcrans {
  return { version: fiche.version, formatId: fiche.formatId, habillage: fiche.habillage, ratio: fiche.ratio };
}

/* ------------------------------------------------------------------ */
/* Plan des fins (rempli par M2 ; lu par M5, M7, M8)                     */
/* ------------------------------------------------------------------ */

/** Une fin fabriquée : les réseaux qui la partagent, les lignes de la table dans l'ordre, ses écrans (« f01 »…). */
export interface FinPlanifiee {
  id: string;
  reseaux: ReseauCas[];
  appels: FinChoisie[];
  ecrans: EcranFin[];
}

export interface PlanDesFins {
  fins: FinPlanifiee[];
  /** Fins « diagnostic » données à la place de la fin au mot, avec leur raison (mot non branché, fin non validée…). */
  reduites: { reseaux: ReseauCas[]; raison: string }[];
  /** Réseaux sans fin possible (ne se produit pas avec la table livrée). */
  sansFin: { reseaux: ReseauCas[]; raison: string }[];
}

/* ------------------------------------------------------------------ */
/* Validation de la forme (R01)                                          */
/* ------------------------------------------------------------------ */

export const REGLES_FORME = {
  versionConnue: "version connue",
  schemaExact: "schéma exact",
  identifiants: "identifiants d'écran ordonnés",
  evenements: "événements dans le texte",
  horaires: "horaires d'écran",
} as const;

function probleme(regle: string, detail: string, ecranId?: string): ProblemeFiche {
  const ou = ecranId ? `Écran ${ecranId}` : "Fiche";
  return { regle, ...(ecranId ? { sceneId: ecranId } : {}), message: `${ou} · règle « ${regle} » : ${detail}` };
}

function detailZod(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? "champ obligatoire absent" : "valeur de mauvais type";
    case "unrecognized_keys":
      return `champ${issue.keys.length > 1 ? "s" : ""} inconnu${issue.keys.length > 1 ? "s" : ""} : ${issue.keys.map((k) => `« ${k} »`).join(", ")}`;
    case "invalid_value":
      return `valeur refusée ; valeurs permises : ${issue.values.map((v) => `« ${String(v)} »`).join(", ")}`;
    case "invalid_union":
      return "ne correspond à aucune forme permise";
    case "too_small":
      return issue.origin === "number" ? `doit valoir au moins ${String(issue.minimum)}` : `trop court (au moins ${String(issue.minimum)})`;
    case "too_big":
      return issue.origin === "number" ? `doit valoir au plus ${String(issue.maximum)}` : `trop long (au plus ${String(issue.maximum)})`;
    case "custom":
    case "invalid_format":
      return issue.message && !/^Invalid/.test(issue.message) ? issue.message : "forme refusée";
    default:
      return "valeur refusée";
  }
}

function lieu(chemin: readonly PropertyKey[]): string {
  return chemin.map((p) => (typeof p === "number" ? `n° ${p + 1}` : `champ « ${String(p)} »`)).join(", ");
}

function ecranDuChemin(brut: unknown, chemin: readonly PropertyKey[]): string | undefined {
  if (chemin[0] !== "ecrans" || typeof chemin[1] !== "number") return undefined;
  const ecrans = (brut as { ecrans?: unknown }).ecrans;
  const id = Array.isArray(ecrans) ? (ecrans[chemin[1]] as { id?: unknown } | undefined)?.id : undefined;
  return typeof id === "string" && id.trim() ? id : `n° ${chemin[1] + 1}`;
}

/**
 * Valide la FORME d'une fiche brute (JSON lu) : version connue, schéma exact, identifiants « e01 », « e02 »… dans l'ordre,
 * événements posés sur un mot du texte, horaires cohérents. Ne modifie jamais la fiche ; les règles R02 à R22 sont ailleurs.
 */
export function validerSchemaFiche(brut: unknown): ResultatFiche<FicheEcrans> {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { ok: false, problemes: [probleme(REGLES_FORME.schemaExact, "la fiche doit être un objet.")] };
  }
  const version = (brut as { version?: unknown }).version;
  if (version !== VERSION_FICHE_ECRANS) {
    const detail = typeof version === "string" ? `la version « ${version} » est inconnue ; « ${VERSION_FICHE_ECRANS} » est attendue.` : `la version est absente ; « ${VERSION_FICHE_ECRANS} » est attendue.`;
    return { ok: false, problemes: [probleme(REGLES_FORME.versionConnue, detail)] };
  }

  const lu = schemaFicheEcrans.safeParse(brut);
  if (!lu.success) {
    return {
      ok: false,
      problemes: lu.error.issues.map((issue) => {
        const ecranId = ecranDuChemin(brut, issue.path);
        const ou = lieu(ecranId ? issue.path.slice(2) : issue.path);
        return probleme(REGLES_FORME.schemaExact, `${ou ? `${ou} : ` : ""}${detailZod(issue)}.`, ecranId);
      }),
    };
  }

  const fiche = lu.data;
  const res: ProblemeFiche[] = [];
  fiche.ecrans.forEach((e, i) => {
    const attendu = idEcranAttendu(i);
    if (e.id !== attendu) res.push(probleme(REGLES_FORME.identifiants, `en position ${i + 1}, l'identifiant attendu est « ${attendu} ».`, e.id));
    res.push(...problemesEcran(e, fiche.ecrans[i - 1]));
  });
  return res.length ? { ok: false, problemes: res } : { ok: true, fiche };
}

/** Événements et horaires d'un écran (corps ou fin), par rapport au précédent. */
export function problemesEcran(e: Ecran, precedent?: Ecran): ProblemeFiche[] {
  const res: ProblemeFiche[] = [];
  const nMots = motsLus(e.texteDit).length;
  e.evenements.forEach((ev, j) => {
    if (ev.surMot >= nMots) res.push(probleme(REGLES_FORME.evenements, `l'événement n° ${j + 1} vise le mot de rang ${ev.surMot + 1}, le texte dit n'en a que ${nMots}.`, e.id));
  });
  const aDebut = e.debutMs !== undefined;
  if (aDebut !== (e.finMs !== undefined)) res.push(probleme(REGLES_FORME.horaires, "le début et la fin sont posés ensemble par le calage, ou pas du tout.", e.id));
  else if (aDebut) {
    if (e.finMs! <= e.debutMs!) res.push(probleme(REGLES_FORME.horaires, `la fin (${e.finMs} ms) doit venir après le début (${e.debutMs} ms).`, e.id));
    if (precedent?.finMs !== undefined && e.debutMs! < precedent.finMs) res.push(probleme(REGLES_FORME.horaires, `le début (${e.debutMs} ms) chevauche l'écran précédent, qui finit à ${precedent.finMs} ms.`, e.id));
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Texte et empreintes                                                   */
/* ------------------------------------------------------------------ */

/** Le texte dit du corps, écrans mis bout à bout (comparé au script par R02, lu par la voix). */
export function texteDuCorps(fiche: Pick<FicheEcrans, "ecrans">): string {
  return fiche.ecrans.map((e) => e.texteDit.trim()).join(" ");
}

/** FNV-1a 64 bits (deux passes de 32 bits) + longueur, comme `src/briques/fiche-scenes/empreinte.ts`. */
function hacher(t: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${t.length.toString(36)}`;
}

/**
 * Empreinte d'un écran dans son cadre (sa clé de rendu) : même contenu, même empreinte, quel que soit l'ordre des clés.
 * L2 : le tirage de l'écran (`fiche.mise.ecrans[id]`) y entre SEULEMENT s'il est donné ; sans lui, l'empreinte est
 * exactement celle d'avant (cache intact).
 */
export function empreinteEcran(ecran: Ecran, cadre: CadreEcrans, tirage?: TirageEcran): string {
  return `ecran-${hacher(jsonCanonique(tirage ? { cadre, ecran, tirage } : { cadre, ecran }))}`;
}

/** Empreinte de la fiche entière. */
export function empreinteFicheEcrans(fiche: FicheEcrans): string {
  return `fiche-ecrans-${hacher(jsonCanonique(fiche))}`;
}
