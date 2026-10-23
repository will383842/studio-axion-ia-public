/**
 * LOOK WILL « GARDÉ POUR LES PROCHAINES VIDÉOS » (rapport V6, P0 n° 4 et 5). PUR.
 *
 * Avant : le réglage `facecam.look` ne gardait que les 3 crans, repris seulement par le monteur, et
 * `entrees.facecamLookWill` (la référence Lab de la peau et du mur que la passe image vise, et contre laquelle elle
 * mesure le ΔE00) n'était écrit par AUCUN code. Maintenant :
 *  1. « Garder pour les prochaines vidéos » range les crans ET la teinte de la vidéo, et marque la version qui part
 *     comme « à mesurer » ;
 *  2. quand cette version est fabriquée, la peau et le mur MESURÉS par la passe image (après retouche) deviennent la
 *     référence du look ;
 *  3. chaque nouvelle vidéo face caméra reçoit au lancement : les crans et la teinte (si elle n'a pas les siens) et
 *     `facecamLookWill` (la référence), que la passe image applique et contrôle (alerte ΔE00 ≥ 4).
 */
import { lireEntreesFacecam, type CranImage, type ImageFacecam } from "@/domaine/facecam";

export type TeinteLook = "neutre" | "plus-chaud" | "plus-froid";

/** Référence mesurée sur une vidéo validée par Will (CIELAB, D65). */
export interface ReferenceLook {
  peauLab: number[];
  murLab?: number[];
  videoId: string;
  versionId: string;
  le: string;
}

export interface LookWill {
  image: ImageFacecam;
  teinte: TeinteLook;
  le: string;
  /** Référence de la peau et du mur (absente tant que la vidéo gardée n'est pas fabriquée). */
  reference?: ReferenceLook;
  /** Version dont la fabrication donnera la référence. */
  aMesurer?: { videoId: string; versionId: string };
}

const CRANS: CranImage[] = ["moins", "juste", "plus"];
const REGLAGES = ["lumiere", "couleurs", "mine", "dents"] as const;
const estLab = (x: unknown): x is number[] => Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === "number" && Number.isFinite(v));

/** Lit le réglage `facecam.look` (ancienne forme `{ image, le }` comprise) ; mal formé : null. */
export function lireLook(brut: unknown): LookWill | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<LookWill> & { image?: Record<string, unknown> };
  if (!b.image || typeof b.image !== "object") return null;
  const image = Object.fromEntries(REGLAGES.map((k) => [k, CRANS.includes(b.image![k] as CranImage) ? b.image![k] : "juste"])) as unknown as ImageFacecam;
  const ref = b.reference;
  return {
    image,
    teinte: b.teinte === "plus-chaud" || b.teinte === "plus-froid" ? b.teinte : "neutre",
    le: typeof b.le === "string" ? b.le : "",
    ...(ref && estLab(ref.peauLab) ? { reference: { peauLab: ref.peauLab, ...(estLab(ref.murLab) ? { murLab: ref.murLab } : {}), videoId: String(ref.videoId ?? ""), versionId: String(ref.versionId ?? ""), le: String(ref.le ?? "") } } : {}),
    ...(b.aMesurer && typeof b.aMesurer.versionId === "string" ? { aMesurer: { videoId: String(b.aMesurer.videoId ?? ""), versionId: b.aMesurer.versionId } } : {}),
  };
}

/**
 * « Garder pour les prochaines vidéos » : crans et teinte de la vidéo ; la version qui part sera mesurée. La référence
 * d'avant reste en service jusqu'à la nouvelle mesure (jamais de trou).
 */
export function lookAGarder(precedent: LookWill | null, image: ImageFacecam, teinte: TeinteLook, cible: { videoId: string; versionId?: string }, le: string): LookWill {
  return {
    image: { ...image },
    teinte,
    le,
    ...(precedent?.reference ? { reference: precedent.reference } : {}),
    ...(cible.versionId ? { aMesurer: { videoId: cible.videoId, versionId: cible.versionId } } : {}),
  };
}

/** Mesures de la passe image d'une version (peau et mur après retouche). */
export interface MesuresLook {
  peauLab?: number[];
  murLab?: number[];
}

/** Fin de fabrication d'une version : si c'est celle à mesurer, ses mesures deviennent la référence ; sinon null. */
export function lookMesure(look: LookWill | null, versionId: string, mesures: MesuresLook | null | undefined, le: string): LookWill | null {
  if (!look?.aMesurer || look.aMesurer.versionId !== versionId || !estLab(mesures?.peauLab)) return null;
  const { aMesurer, ...reste } = look;
  return { ...reste, reference: { peauLab: mesures!.peauLab!.map((x) => +x.toFixed(2)), ...(estLab(mesures!.murLab) ? { murLab: mesures!.murLab!.map((x) => +x.toFixed(2)) } : {}), videoId: aMesurer.videoId, versionId, le } };
}

/**
 * Entrées à poser au LANCEMENT d'une vidéo face caméra : référence du look (`facecamLookWill`), et les crans et la
 * teinte gardés quand la vidéo n'a encore aucun réglage propre (ses réglages à elle gagnent toujours).
 */
export function entreesDuLook(entrees: Record<string, unknown> | undefined, look: LookWill | null): Record<string, unknown> {
  if (!look) return {};
  const e = entrees ?? {};
  const facecam = lireEntreesFacecam(e);
  const brutFacecam = ((e as { facecam?: Record<string, unknown> }).facecam ?? {}) as Record<string, unknown>;
  const brutMonteur = ((e as { facecamMonteur?: Record<string, unknown> }).facecamMonteur ?? {}) as Record<string, unknown>;
  const imageVierge = Object.values(facecam.image).every((v) => v === "juste");
  const teinteVierge = !brutMonteur.teinte || brutMonteur.teinte === "neutre";
  return {
    ...(look.reference ? { facecamLookWill: { peauLab: look.reference.peauLab, ...(look.reference.murLab ? { murLab: look.reference.murLab } : {}) } } : {}),
    ...(imageVierge ? { facecam: { ...brutFacecam, image: { ...look.image } } } : {}),
    ...(teinteVierge && look.teinte !== "neutre" ? { facecamMonteur: { ...brutMonteur, teinte: look.teinte } } : {}),
  };
}

/** V6 P0 n° 5 : au premier usage, le look n'est ni validé ni en cours de mesure → l'écran « Votre look » s'affiche. */
export function lookAValider(look: LookWill | null): boolean {
  return !look?.reference && !look?.aMesurer;
}
