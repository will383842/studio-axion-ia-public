/**
 * SCHÉMAS DE LECTURE DES PROPRIÉTÉS DES COMPOSITIONS (G10-07) — NON BRANCHÉS : aucune composition ni aucun service ne
 * les appelle. Lecture seulement : les champs inconnus sont TOLÉRÉS (un ajout futur n'est jamais rejeté) ; seuls les
 * champs requis des types actuels sont exigés, et à leur niveau de tête (le détail imbriqué reste souple, pour ne pas
 * casser au premier champ facultatif ajouté). Aucun import « @/ » ; imports relatifs en TYPE seulement.
 * Hors liste volontairement : v4, avocat, carrousels, vignettes et miniatures.
 */
import { z, type ZodType } from "zod";

const nombre = z.number();
const objet = z.looseObject({});
const tableau = z.array(z.unknown());

/** Plan de scènes validé : la forme générale (le validateur du Studio garde le détail). */
const plan = z.looseObject({
  version: z.string(),
  format: z.looseObject({ largeur: nombre, hauteur: nombre, fps: nombre }),
  facecam: z.boolean(),
  dureeMs: nombre,
  habillage: objet,
  mots: tableau,
  scenes: z.array(z.looseObject({ id: z.string(), piece: z.string(), debutMs: nombre, finMs: nombre })),
});

const rect = z.looseObject({ x: nombre, y: nombre, largeur: nombre, hauteur: nombre });
const taille = z.looseObject({ largeur: nombre, hauteur: nombre });
const carteFin = z.looseObject({ titre: z.string(), sousTitre: z.string() });

const donneesCalque = z.looseObject({
  largeur: nombre,
  hauteur: nombre,
  segments: tableau,
  base: z.string(),
  couleurs: objet,
  largeurMaxPx: nombre,
  positions: z.looseObject({ milieuPct: nombre, hautPct: nombre, basPct: nombre }),
});

const ratio = z.enum(["9:16", "4:5", "1:1", "16:9"]);
const cadre = { ratio, largeur: nombre, hauteur: nombre, fps: nombre, images: nombre };

const planDeScenes = z.looseObject({ plan });
const tutorielOutil = z.looseObject({ plan, audio: z.string().optional(), sousTitres: donneesCalque.optional(), fin: carteFin, finMs: nombre });
const demoFacecam = z.looseObject({
  largeur: nombre,
  hauteur: nombre,
  fps: nombre,
  images: nombre,
  dureeParoleMs: nombre,
  miseEnPage: objet,
  recadrageFacecam: rect,
  recadrageEcran: rect,
  sourceFacecam: taille,
  sourceEcran: taille,
  decalageEcranSec: nombre,
  zooms: tableau,
  clics: tableau,
  surlignages: tableau,
  legendes: tableau,
  plan,
  sousTitres: tableau,
  calqueSousTitres: donneesCalque.optional(),
  carteFin,
});
const sousTitres = z.looseObject({ donnees: donneesCalque, decalageSec: nombre.optional(), instantSec: nombre.optional() });
const compositionImage = z.looseObject({
  ...cadre,
  decor: z.looseObject({ teinte: z.string(), directionLumiere: z.enum(["gauche", "droite", "face"]), flouPx: nombre, clair: z.boolean() }),
  doubles: z.looseObject({ principal: z.looseObject({ type: z.string() }) }),
  plans: tableau,
});
const compositionTexte = z.looseObject({ ...cadre, incrustations: tableau });

/** Le schéma de chaque composition, sous l'identifiant de `Racine.tsx` (CompositionImage et CompositionTexte : propriétés des calques image et texte). */
export const SCHEMAS_PROPS: Record<string, ZodType> = {
  PlanDeScenes: planDeScenes,
  TutorielOutil: tutorielOutil,
  DemoFacecam: demoFacecam,
  SousTitres: sousTitres,
  CompositionImage: compositionImage,
  CompositionTexte: compositionTexte,
};

export type LectureProps = { ok: true; props: unknown } | { ok: false; erreurs: string[] };

/** Lit les propriétés brutes d'une composition. Ne lève jamais ; id inconnu → `ok: false`. */
export function lireProps(id: string, brut: unknown): LectureProps {
  try {
    const schema = Object.prototype.hasOwnProperty.call(SCHEMAS_PROPS, id) ? SCHEMAS_PROPS[id] : undefined;
    if (!schema) return { ok: false, erreurs: [`composition inconnue : ${id}`] };
    const r = schema.safeParse(brut);
    if (r.success) return { ok: true, props: r.data };
    return { ok: false, erreurs: r.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`) };
  } catch (e) {
    return { ok: false, erreurs: [`lecture impossible : ${e instanceof Error ? e.message : String(e)}`] };
  }
}
