/**
 * SCHÉMA DU PLAN DE SCÈNES (lot C) — socle du motion sur mesure et de la retouche par chat.
 * Un plan = des scènes liées aux mots du script (indices du minutage), chacune d'un NIVEAU :
 *  1 : une pièce en stock du catalogue, paramètres typés ;
 *  2 : une composition de calques (pièces du catalogue posées et décalées dans le temps) choisie par l'IA ;
 *  3 : code libre (désactivé par défaut, toujours replié d'un niveau tant qu'il n'est pas branché).
 * Deux schémas : `schemaPlanBrut` (souple, ce que renvoie le LLM, réparé ensuite par le validateur) et
 * `schemaPlanStrict` (le plan rendable). Chaque scène porte une version et une empreinte (`./empreinte`).
 */
import { z } from "zod";
import { CATALOGUE_BRIQUES, IDS_PIECES, type IdPiece } from "./catalogue";
import { POSITIONS, TRANSITIONS, TRANSITION_MAX_MS, TRANSITION_MIN_MS } from "./zones";

export const VERSION_PLAN_SCENES = "plan-scenes-1";
export const NIVEAUX = [1, 2, 3] as const;
export type Niveau = (typeof NIVEAUX)[number];

export const schemaMot = z.strictObject({ texte: z.string(), debutMs: z.number().min(0), finMs: z.number().min(0) });
export type MotMinute = z.infer<typeof schemaMot>;

export const schemaFormat = z.strictObject({ largeur: z.number().int().min(320).max(4096), hauteur: z.number().int().min(320).max(4096), fps: z.literal(25) });
export type FormatPlan = z.infer<typeof schemaFormat>;

export const schemaHabillage = z.strictObject({ fond: z.enum(["ivoire", "noir"]), accent: z.enum(["terracotta", "orange"]) });
export type HabillagePlan = z.infer<typeof schemaHabillage>;

export const schemaTransitionScene = z.strictObject({ entree: z.enum(TRANSITIONS), sortie: z.enum(TRANSITIONS), dureeMs: z.number().min(TRANSITION_MIN_MS).max(TRANSITION_MAX_MS) });

const piecesTypees = IDS_PIECES.map((id) => z.strictObject({ piece: z.literal(id), parametres: CATALOGUE_BRIQUES[id].schema as z.ZodType }));

/** Une pièce et ses paramètres typés (union discriminée sur `piece`). */
export const schemaPieceTypee = z.discriminatedUnion("piece", piecesTypees as unknown as [(typeof piecesTypees)[number], ...(typeof piecesTypees)[number][]]);
export type PieceTypee = { [K in IdPiece]: { piece: K; parametres: z.infer<(typeof CATALOGUE_BRIQUES)[K]["schema"]> } }[IdPiece];

export const schemaCalque = z.strictObject({
  piece: z.enum(IDS_PIECES),
  parametres: z.unknown(),
  /** Décalage depuis le début de la scène (ms). */
  debutMs: z.number().min(0),
  zone: z.enum(POSITIONS),
});
export type Calque = PieceTypee & { debutMs: number; zone: (typeof POSITIONS)[number] };

const baseScene = {
  id: z.string().min(1).max(40),
  version: z.number().int().min(1),
  empreinte: z.string().regex(/^[0-9a-f]{16}$/).optional(),
  /** Mots du script couverts (indices inclus dans `mots`) : le début de la scène est celui du premier mot. */
  mots: z.strictObject({ premier: z.number().int().min(0), dernier: z.number().int().min(0) }),
  debutMs: z.number().min(0),
  finMs: z.number().min(0),
  niveau: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Texte à l'écran (étiquette au-dessus de la pièce ; base de la retouche « changer un mot »). */
  texte: z.string().max(120).optional(),
  position: z.enum(POSITIONS),
  transition: schemaTransitionScene,
  /** Niveau 3 seulement (désactivé par défaut). */
  code: z.string().max(20_000).optional(),
};

export const schemaSceneStrict = z
  .strictObject({ ...baseScene, piece: z.enum(IDS_PIECES), parametres: z.unknown(), calques: z.array(schemaCalque).max(6).optional() })
  .superRefine((s, ctx) => {
    const verifier = (piece: IdPiece, parametres: unknown, chemin: (string | number)[]) => {
      const r = CATALOGUE_BRIQUES[piece].schema.safeParse(parametres);
      if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: "custom", path: [...chemin, ...i.path.map((p) => (typeof p === "symbol" ? String(p) : p))], message: i.message });
    };
    verifier(s.piece, s.parametres, ["parametres"]);
    s.calques?.forEach((c, i) => verifier(c.piece, c.parametres, ["calques", i, "parametres"]));
    if (s.finMs <= s.debutMs) ctx.addIssue({ code: "custom", path: ["finMs"], message: "La fin vient après le début." });
    if (s.niveau === 2 && !s.calques?.length) ctx.addIssue({ code: "custom", path: ["calques"], message: "Le niveau 2 compose au moins un calque." });
  });

export const schemaPlanStrict = z.strictObject({
  version: z.literal(VERSION_PLAN_SCENES),
  format: schemaFormat,
  facecam: z.boolean(),
  dureeMs: z.number().min(1),
  habillage: schemaHabillage,
  mots: z.array(schemaMot),
  scenes: z.array(schemaSceneStrict).min(1),
});

export type ScenePlan = Omit<z.infer<typeof schemaSceneStrict>, "piece" | "parametres" | "calques"> & PieceTypee & { calques?: Calque[] };
export type PlanDeScenes = Omit<z.infer<typeof schemaPlanStrict>, "scenes"> & { scenes: ScenePlan[] };
/** Plan sorti du validateur : chaque scène a son empreinte. */
export type SceneValide = ScenePlan & { empreinte: string };
export type PlanValide = Omit<PlanDeScenes, "scenes"> & { scenes: SceneValide[] };

/** Schéma SOUPLE : la forme générale seulement (ce que le LLM renvoie) ; le validateur répare le reste. */
export const schemaPlanBrut = z.looseObject({
  version: z.string().optional(),
  format: z.unknown().optional(),
  facecam: z.unknown().optional(),
  dureeMs: z.unknown().optional(),
  habillage: z.unknown().optional(),
  mots: z.unknown().optional(),
  scenes: z.array(z.looseObject({ piece: z.unknown().optional(), parametres: z.unknown().optional() })),
});
export type PlanBrut = z.infer<typeof schemaPlanBrut>;
