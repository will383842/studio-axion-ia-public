/**
 * AGENT MONTEUR FACE CAMÉRA — VOCABULAIRE DES OPÉRATIONS (plan facecam v4, B.14 et lot D). PUR, importable partout.
 *
 * Un seul appel Claude rend un JSON validé ici (Zod) : une liste d'opérations de montage ÉTENDUE au face caméra
 * (`ajouterCarte{modele|html}`, `zoom`, `ecranPartage`, `miseEnPage{cote|vignette}`, `couleurs`, `son`,
 * `masquerPersonne`, `texteDerriere`, `vitesse`, `arretImage`, `titre`, `generique`, `couper`, `retablir`, `retirer`, `remettre`).
 * Le vocabulaire reste OUVERT : toute consigne qui n'entre dans aucune case devient `ajouterCarte` avec du HTML écrit
 * par Claude (carte sur mesure). Les opérations sont calées sur un MOT de la transcription fournie (`debutMot`,
 * `finMot` : index), jamais sur une seconde inventée : le code calcule les temps (« calé sur le mot exact »).
 *
 * Deux schémas :
 * - `schemaReponseMonteur` (strict) part à l'API en sortie structurée ;
 * - `lireReponseMonteur` relit la réponse OPÉRATION PAR OPÉRATION : une opération mal formée n'emporte pas les autres,
 *   et une opération inconnue qui porte une description devient une carte sur mesure (vocabulaire ouvert).
 */
import { z } from "zod";
import { lireReponseOperations, schemaConsigneLue as schemaConsigneLueCommune, schemaReponsePour, type LectureOperations } from "@/briques/monteur/operations";
import { reparerEffetRealiste, schemaEffetRealisteIA } from "@/briques/monteur/effet-realiste";
import { deplierOperation, schemaEnveloppeOperation, signaturesOperations } from "@/briques/monteur/enveloppe";
import { restaurerNulls } from "@/generateur/roles/schema-api";
import type { IdModeleMotionTous } from "@/briques/motion/types-etendus";
import { reparerEffetSpecial, SCHEMAS_EFFETS_SPECIAUX } from "./effets";

/** Les 6 modèles de base de la brique motion commune (correctif du 09/10). */
export const MODELES_CARTE_BASE = ["liste", "chiffre", "avant-apres", "ligne-de-temps", "deux-colonnes", "titre"] as const;
/**
 * Mission L (planche 7-13 validée par Will le 09/10) : les 13 modèles de la brique motion, PAR DÉFAUT — les 6 de base
 * puis les 7 du lot F2 ; tout le reste = carte sur mesure. Le titre plein écran n'est posé que si Will le demande.
 */
export const MODELES_CARTE = [...MODELES_CARTE_BASE, "graphique", "icone-mot", "probleme-solution", "check-list", "capture-annotee", "titre-plein-ecran", "documentaire"] as const;
export type ModeleCarte = (typeof MODELES_CARTE)[number];
// Garde de types : la liste reste exactement celle des 13 modèles de la brique motion.
type _Egal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _treizeModeles: _Egal<ModeleCarte, IdModeleMotionTous> = true;
void _treizeModeles;

const mot = z.number().int();
const crans = z.enum(["moins", "juste", "plus"]);

/**
 * Code d'une carte sur mesure : HTML, CSS et timeline GSAP (rendu dans une iframe isolée par la composition
 * `CarteSurMesure` de la brique motion, lot C : `timeline` y est passé en `js` ; il appelle `AXION.enregistrer(tl)`).
 */
export const schemaCodeCarte = z.object({ html: z.string(), css: z.string(), timeline: z.string() });
export type CodeCarte = z.infer<typeof schemaCodeCarte>;

export const schemaAjouterCarte = z.object({
  type: z.literal("ajouterCarte"),
  debutMot: mot,
  finMot: mot,
  /** Modèle de la bibliothèque ; null : carte sur mesure (`html` obligatoire). */
  modele: z.enum(MODELES_CARTE).nullable(),
  /** Textes de la carte, dans l'ordre (points d'une liste, chiffre et légende, colonnes…). */
  textes: z.array(z.string()),
  html: schemaCodeCarte.nullable(),
  /** Plein écran, ou en haut d'un écran partagé (Will en bas). */
  disposition: z.enum(["plein-ecran", "ecran-partage"]),
  /** Ce que montre la carte, en une phrase (lisible par Will). */
  description: z.string(),
  /** Identifiant d'une animation gardée (« Mes animations ») réutilisée ; null sinon. */
  animationGardeeId: z.string().nullable(),
});

export const schemaZoom = z.object({
  type: z.literal("zoom"),
  debutMot: mot,
  finMot: mot,
  /** Punch-in instantané (par défaut), zoom lent (3 %/s au plus) ou zoom flou (2 au plus par vidéo). */
  style: z.enum(["punch-in", "lent", "flou"]),
  /** Cible : le visage (par défaut) ou la main. */
  cible: z.enum(["visage", "main"]),
});

export const schemaEcranPartage = z.object({
  type: z.literal("ecranPartage"),
  debutMot: mot,
  finMot: mot,
  /** Ce qui s'affiche en haut (Will en bas). */
  description: z.string(),
  textes: z.array(z.string()),
});

export const schemaMiseEnPage = z.object({
  type: z.literal("miseEnPage"),
  debutMot: mot,
  finMot: mot,
  /** Will rétréci sur un côté (l'explication de l'autre), ou en vignette (image dans l'image). Aucun détourage. */
  mode: z.enum(["cote", "vignette"]),
  cote: z.enum(["gauche", "droite"]).nullable(),
  description: z.string(),
});

export const schemaCouleurs = z.object({
  type: z.literal("couleurs"),
  /** Réglage d'image touché, en 3 crans (pas de curseur 0-100, v4 n° 17). */
  reglage: z.enum(["lumiere", "couleurs", "mine", "dents"]),
  cran: crans,
  /** Teinte demandée (« plus chaud ») ; null : seulement l'intensité. */
  teinte: z.enum(["plus-chaud", "plus-froid"]).nullable(),
});

export const schemaSon = z.object({
  type: z.literal("son"),
  action: z.enum(["nettoyer", "musique", "sans-musique", "bruitage", "plus-fort", "moins-fort"]),
  /** Ambiance d'une musique ou nom d'un bruitage (« calme », « whoosh ») ; null sinon. */
  precision: z.string().nullable(),
  /** Passage visé ; null : toute la vidéo. */
  debutMot: mot.nullable(),
  finMot: mot.nullable(),
});

export const schemaMasquerPersonne = z.object({
  type: z.literal("masquerPersonne"),
  /** Will disparaît au début (fondu vers la plaque vide) et revient à la fin. */
  debutMot: mot,
  finMot: mot,
});

export const schemaTexteDerriere = z.object({
  type: z.literal("texteDerriere"),
  debutMot: mot,
  finMot: mot,
  /** Texte placé entre le mur et Will. */
  texte: z.string(),
});

export const schemaVitesse = z.object({
  type: z.literal("vitesse"),
  debutMot: mot,
  finMot: mot,
  /** 0,5 à 2 (le son est gardé à la bonne hauteur). */
  facteur: z.number(),
});

export const schemaArretImage = z.object({
  type: z.literal("arretImage"),
  /** Mot sur lequel l'image se fige. */
  auMot: mot,
  dureeSec: z.number(),
  /** Texte ou chiffre affiché pendant l'arrêt ; null sinon. */
  texte: z.string().nullable(),
});

export const schemaTitre = z.object({
  type: z.literal("titre"),
  texte: z.string(),
  /** Null : titre fixe pendant toute la vidéo (D5). */
  debutMot: mot.nullable(),
  finMot: mot.nullable(),
  /** Titre plein écran : jamais automatique, seulement à la demande (v4 n° 21). */
  pleinEcran: z.boolean(),
});

export const schemaGenerique = z.object({
  type: z.literal("generique"),
  position: z.enum(["debut", "fin"]),
  texte: z.string(),
  dureeSec: z.number(),
});

export const schemaCouper = z.object({
  type: z.literal("couper"),
  debutMot: mot,
  finMot: mot,
});

export const schemaRetablir = z.object({
  type: z.literal("retablir"),
  /** Identifiant d'une coupe du studio (liste fournie). */
  coupeId: z.string(),
});

/** Retire un élément déjà posé (carte, zoom, écran partagé…) par son identifiant (liste fournie). */
export const schemaRetirer = z.object({
  type: z.literal("retirer"),
  passageId: z.string(),
});

/**
 * Remet une carte automatique retirée ou effacée (« remets la carte … ») par son identifiant `auto-…` (liste fournie) :
 * la MÊME carte (mêmes textes, même instant), comme « Remettre » dans la fiche — jamais une nouvelle carte.
 */
export const schemaRemettre = z.object({
  type: z.literal("remettre"),
  passageId: z.string(),
});

/**
 * Test en prod du 11/10 : change le titre de la COUVERTURE (miniature choisie, image montrée avant la lecture).
 * Aucun montage : le service refait l'image de la miniature (l'ancienne reste), sans nouvelle version de la vidéo.
 */
export const schemaChangerTitreCouverture = z.object({
  type: z.literal("changerTitreCouverture"),
  /** Nouveau titre de couverture (5 mots au plus, coupé proprement par le studio s'il est écrit sur l'image). */
  texte: z.string(),
});

export const SCHEMAS_OPERATION = [
  schemaAjouterCarte,
  schemaZoom,
  schemaEcranPartage,
  schemaMiseEnPage,
  schemaCouleurs,
  schemaSon,
  schemaMasquerPersonne,
  schemaTexteDerriere,
  schemaVitesse,
  schemaArretImage,
  schemaTitre,
  schemaGenerique,
  schemaCouper,
  schemaRetablir,
  schemaRetirer,
  schemaRemettre,
  // Lot F3 : effets spéciaux, à la demande seulement (`effets.ts`).
  ...SCHEMAS_EFFETS_SPECIAUX,
  // Lot K : effet réaliste par IA (payant : jamais appliqué sans « Confirmer », voir `effet-realiste.ts`).
  schemaEffetRealisteIA,
  // Test en prod du 11/10 : la couverture (fin de liste : l'ordre des opérations existantes ne change pas).
  schemaChangerTitreCouverture,
] as const;

export const schemaOperationFacecam = z.union(SCHEMAS_OPERATION);
export type OperationFacecam = z.infer<typeof schemaOperationFacecam>;
export type TypeOperationFacecam = OperationFacecam["type"];
export const TYPES_OPERATION_FACECAM = SCHEMAS_OPERATION.map((s) => s.shape.type.value) as TypeOperationFacecam[];

/**
 * Panne du 10/10 (« The compiled grammar is too large ») : ce qui PART à l'API n'est plus l'union des opérations
 * mais une enveloppe fixe `{ type, parametres }` (brique `monteur/enveloppe.ts`). Les champs de chaque type sont
 * décrits dans la consigne (`SIGNATURES_OPERATIONS_FACECAM`), et `schemaOperationFacecam` reste le juge strict.
 */
export const schemaOperationEnvoyee = schemaEnveloppeOperation(TYPES_OPERATION_FACECAM as [TypeOperationFacecam, ...TypeOperationFacecam[]]);
export const SIGNATURES_OPERATIONS_FACECAM = signaturesOperations(SCHEMAS_OPERATION);

/** Ce que Claude a compris d'une consigne (dite ou écrite) : schéma de la brique monteur commune (mission H). */
export const schemaConsigneLue = schemaConsigneLueCommune;

/** Réponse d'UN appel du monteur face caméra : forme commune de la brique, vocabulaire du face caméra. */
export const schemaReponseMonteur = schemaReponsePour(schemaOperationFacecam);
export type ReponseMonteur = z.infer<typeof schemaReponseMonteur>;
/** Forme ENVOYÉE (sortie structurée) : mêmes champs, opérations en enveloppe. */
export const schemaReponseMonteurEnvoyee = schemaReponsePour(schemaOperationEnvoyee);
export type ConsigneLue = z.infer<typeof schemaConsigneLue>;

/* ------------------------------------------------------------------ */
/* Relecture tolérante (opération par opération)                       */
/* ------------------------------------------------------------------ */

export type LectureMonteur = LectureOperations<OperationFacecam>;

/**
 * Relit une réponse BRUTE (JSON déjà parsé). Ne lève jamais. Une opération inconnue ou mal formée qui porte un texte
 * (description, texte, consigne) et des mots devient une carte sur mesure à écrire (`modele: null`, `html: null`) :
 * le vocabulaire est ouvert, rien ne se perd en silence. Le reste est écarté avec son motif.
 * Les index des consignes sont renumérotés sur la liste gardée. Relecture de la brique monteur commune (mission H),
 * avec les réparateurs du face caméra : effet spécial (lot F3), puis carte sur mesure.
 */
export function lireReponseMonteur(brut: unknown): LectureMonteur | null {
  return lireReponseOperations<OperationFacecam>(deplierReponse(brut), schemaOperationFacecam, REPARATEURS_FACECAM);
}

const REPARATEURS_FACECAM = [reparerEffetSpecial, reparerEffetRealiste, enCarteSurMesure];

/**
 * Opération reçue → forme du vocabulaire : enveloppe (`{ type, parametres }`) remise à plat, champs nullables absents
 * remis à null (comme `lireSortie`). Rien d'autre n'est touché : le schéma strict juge ensuite.
 */
const aPlat = (op: unknown) => restaurerNulls(schemaOperationFacecam, deplierOperation(op));

/** Opérations remises à plat (`aPlat`) ; le reste de la réponse est inchangé. */
function deplierReponse(brut: unknown): unknown {
  if (!brut || typeof brut !== "object" || !Array.isArray((brut as { operations?: unknown }).operations)) return brut;
  const o = brut as { operations: unknown[] };
  return { ...o, operations: o.operations.map(aPlat) };
}

/**
 * Motif lisible d'une opération écartée (« zoom n° 2 : cible: … ») : l'erreur du schéma de SON type (celle de l'union
 * entière ne dit que « Invalid input »), ou « type inconnu ».
 */
function motifEcartee(ops: unknown[], e: { index: number; motif: string }): string {
  const op = ops[e.index] as { type?: unknown } | undefined;
  const type = typeof op?.type === "string" ? op.type : null;
  const schema = SCHEMAS_OPERATION.find((s) => s.shape.type.value === type);
  let motif = type && !schema ? `type inconnu (${type.slice(0, 40)})` : e.motif;
  if (schema) {
    const r = schema.safeParse(aPlat(op));
    const illisible = (aPlat(op) as { parametresIllisibles?: unknown }).parametresIllisibles !== undefined;
    if (illisible) motif = "parametres n'est pas un objet JSON valide";
    else if (!r.success) motif = r.error.issues.map((x) => `${x.path.join(".") || "operation"}: ${x.message}`).join(" ; ").slice(0, 200);
  }
  return `${type ?? "opération"} n° ${e.index + 1} : ${motif}`;
}

/**
 * Lecture de la forme ENVOYÉE de « Monteur · discussion » (`roleMonteurFacecam.envoi.lire`) : enveloppes dépliées,
 * chaque opération validée par son schéma strict (réparateurs compris), consignes renumérotées. Rend la forme de
 * `schemaReponseMonteur` et les opérations écartées avec leur motif. Une réponse sans forme exploitable est rendue
 * telle quelle : la validation du rôle la dira invalide.
 */
export function lireEnvoiMonteur(brut: unknown): { valeur: unknown; remarques: string[] } {
  const lu = lireReponseMonteur(brut);
  if (!lu || !Array.isArray((brut as { operations?: unknown }).operations)) return { valeur: brut, remarques: [] };
  const ops = (brut as { operations: unknown[] }).operations;
  return { valeur: { reponse: lu.reponse, operations: lu.operations, consignes: lu.consignes }, remarques: lu.ecartees.map((e) => motifEcartee(ops, e)) };
}

/**
 * Corrections de la relecture des images, même lecture (enveloppes dépliées, schéma strict par opération,
 * réparateurs) : rend les opérations valides et les motifs des écartées.
 */
export function lireCorrections(brutes: unknown): { operations: OperationFacecam[]; remarques: string[] } {
  const ops = Array.isArray(brutes) ? brutes : [];
  const lu = lireReponseOperations<OperationFacecam>({ operations: ops.map(aPlat) }, schemaOperationFacecam, REPARATEURS_FACECAM);
  return { operations: lu?.operations ?? [], remarques: (lu?.ecartees ?? []).map((e) => motifEcartee(ops, e)) };
}

/** Opération hors vocabulaire → carte sur mesure à écrire (vocabulaire ouvert). Null si rien d'exploitable. */
function enCarteSurMesure(op: unknown): OperationFacecam | null {
  if (!op || typeof op !== "object") return null;
  const x = op as Record<string, unknown>;
  // Vérif V1 : une opération « sous-titres » inventée n'est jamais une carte (elle afficherait le texte à l'écran).
  if (typeof x.type === "string" && /sous.?titre|subtitle|caption/i.test(x.type)) return null;
  const texte = [x.description, x.texte, x.consigne, x.demande].find((v): v is string => typeof v === "string" && v.trim().length > 0);
  const debut = typeof x.debutMot === "number" ? x.debutMot : typeof x.auMot === "number" ? x.auMot : null;
  if (!texte || debut === null) return null;
  const fin = typeof x.finMot === "number" ? x.finMot : debut;
  const html = schemaCodeCarte.safeParse(x.html);
  return {
    type: "ajouterCarte",
    debutMot: Math.round(debut),
    finMot: Math.round(fin),
    modele: null,
    textes: Array.isArray(x.textes) ? x.textes.filter((t): t is string => typeof t === "string") : [],
    html: html.success ? html.data : null,
    disposition: x.disposition === "ecran-partage" ? "ecran-partage" : "plein-ecran",
    description: `${typeof x.type === "string" ? `${x.type} : ` : ""}${texte.trim()}`.slice(0, 300),
    animationGardeeId: null,
  };
}
