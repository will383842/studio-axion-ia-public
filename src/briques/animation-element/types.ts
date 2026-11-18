/**
 * FICHE D'ANIMATION D'UN ÉLÉMENT (S-07) — brique pure, sans appelant.
 * Une petite fiche fermée (tous les champs facultatifs) que Claude peut lire et régler.
 * Ne déclare AUCUNE opération : les vocabulaires existants ajoutent ces types à leurs schémas.
 * Pur : seul import autorisé = zod.
 */
import { z } from "zod";

export const ENTREES = ["fondu", "glisse", "zoom", "pop", "ecrit"] as const;
export const VITESSES = ["lent", "normal", "rapide"] as const;
export const INTENSITES = ["douce", "normale", "forte"] as const;

export type Entree = (typeof ENTREES)[number];
export type Vitesse = (typeof VITESSES)[number];
export type Intensite = (typeof INTENSITES)[number];

export const schemaFicheAnimation = z.strictObject({
  entree: z.enum(ENTREES).optional(),
  vitesse: z.enum(VITESSES).optional(),
  intensite: z.enum(INTENSITES).optional(),
  place: z.string().min(1).optional(),
  moment: z.strictObject({ surMot: z.number().int().min(0) }).optional(),
});
export type FicheAnimation = z.infer<typeof schemaFicheAnimation>;

export type ResultatFiche = { ok: true; fiche: FicheAnimation } | { ok: false; raison: string };

export type OptionsFiche = {
  /** Zones EXISTANTES, passées par l'appelant (jamais inventées ici). */
  zones?: readonly string[];
};

const CHAMPS = ["entree", "vitesse", "intensite", "place", "moment"] as const;
const LIBELLES: Record<(typeof CHAMPS)[number], string> = {
  entree: "entrée",
  vitesse: "vitesse",
  intensite: "intensité",
  place: "place",
  moment: "moment",
};

function nettoyer(fiche: FicheAnimation | undefined): FicheAnimation {
  const sortie: Record<string, unknown> = {};
  if (!fiche) return sortie as FicheAnimation;
  for (const c of CHAMPS) {
    const v = fiche[c];
    if (v !== undefined) sortie[c] = c === "moment" ? { surMot: (v as { surMot: number }).surMot } : v;
  }
  return sortie as FicheAnimation;
}

/** Fusion champ par champ de la demande dans la fiche courante. Jamais d'exception. */
export function appliquerFiche(courante: FicheAnimation | undefined, demande: unknown, options: OptionsFiche = {}): ResultatFiche {
  try {
    if (demande === null || typeof demande !== "object" || Array.isArray(demande)) {
      return { ok: false, raison: "La demande d'animation doit être une fiche (entrée, vitesse, intensité, place, moment)." };
    }
    const brut = demande as Record<string, unknown>;
    for (const cle of Object.keys(brut)) {
      if (!(CHAMPS as readonly string[]).includes(cle)) return { ok: false, raison: `Réglage inconnu : « ${cle} ».` };
    }
    const propre: Record<string, unknown> = {};
    for (const c of CHAMPS) if (brut[c] !== undefined) propre[c] = brut[c];
    const lue = schemaFicheAnimation.safeParse(propre);
    if (!lue.success) {
      const champ = String(lue.error.issues[0]?.path[0] ?? "fiche") as (typeof CHAMPS)[number];
      const choix: Record<string, readonly string[]> = { entree: ENTREES, vitesse: VITESSES, intensite: INTENSITES };
      const aide = choix[champ] ? ` Choix possibles : ${choix[champ].join(", ")}.` : "";
      return { ok: false, raison: `Valeur refusée pour ${LIBELLES[champ] ?? champ}.${aide}` };
    }
    if (lue.data.place !== undefined && !(options.zones ?? []).includes(lue.data.place)) {
      return { ok: false, raison: `La place « ${lue.data.place} » n'existe pas dans cette vidéo.` };
    }
    return { ok: true, fiche: { ...nettoyer(courante), ...nettoyer(lue.data) } };
  } catch {
    return { ok: false, raison: "La demande d'animation n'a pas pu être lue." };
  }
}

/** Une ligne lisible par Claude et par Williams, sans montant. */
export function decrireFiche(fiche: FicheAnimation | undefined): string {
  const f = nettoyer(fiche);
  const morceaux: string[] = [];
  if (f.entree) morceaux.push(`entrée ${f.entree}`);
  if (f.vitesse) morceaux.push(`vitesse ${f.vitesse}`);
  if (f.intensite) morceaux.push(`intensité ${f.intensite}`);
  if (f.place) morceaux.push(`place ${f.place}`);
  if (f.moment) morceaux.push(`sur le mot ${f.moment.surMot}`);
  return morceaux.length ? morceaux.join(", ") : "aucun réglage";
}

/** Empreinte stable à l'ordre des clés près ; fiche vide = absence de fiche. */
export function empreinteFiche(fiche: FicheAnimation | undefined): string {
  const f = nettoyer(fiche) as Record<string, unknown>;
  return JSON.stringify(CHAMPS.filter((c) => f[c] !== undefined).map((c) => [c, f[c]]));
}
