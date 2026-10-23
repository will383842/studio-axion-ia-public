/**
 * Entrées de l'aperçu du plateau calculées depuis le brouillon (lot M3). PUR : aucune lecture réseau.
 */
import type { DecorPlateau, ProprietesApercuPlateau } from "@/components/creation/ApercuPlateau";
import { decorParDefaut } from "@/domaine/decors";
import type { ValeurAccessoire, ValeurDecor } from "@/domaine/types";
import { obtenirFormat } from "@/formats";
import type { VueElement } from "@/services/vues";
import type { BrouillonAssistant, ContexteAssistant } from "../etapes/types";

/** Micro de podcast par défaut du studio. */
export const ID_MICRO = "acc-micro-podcast";

export function idDecorDe(b: BrouillonAssistant, elements: VueElement[]): string | undefined {
  const format = obtenirFormat(b.formatId);
  return b.styles.decorId ?? decorParDefaut(b.formatId, elements, format.stylesParDefaut.decor);
}

export function decorDe(b: BrouillonAssistant, elements: VueElement[]): VueElement | undefined {
  const id = idDecorDe(b, elements);
  return elements.find((e) => e.id === id);
}

/** Le micro est allumé par le réglage du format (`micro`) ou par l'accessoire choisi pour la vidéo. */
export function microAllume(b: BrouillonAssistant): boolean {
  return b.reglages.micro === true || !!b.styles.accessoireIds?.includes(ID_MICRO);
}

export function imageDecor(e: VueElement | undefined, contexte: Pick<ContexteAssistant, "express">): string | null {
  if (!e) return null;
  return contexte.express?.plateau.decors[e.id] ?? (e.valeur.type === "decor" && e.valeur.mode === "image" ? e.url : null) ?? null;
}

export function proprietesPlateau(b: BrouillonAssistant, contexte: ContexteAssistant): ProprietesApercuPlateau {
  const format = obtenirFormat(b.formatId);
  const decor = decorDe(b, contexte.elements);
  const v = decor?.valeur.type === "decor" ? (decor.valeur as ValeurDecor) : null;
  const d = b.distribution[0];
  const personnage = contexte.personnages.find((p) => p.personnage.id === d?.personnageId);
  const visage = personnage?.visages.find((x) => x.id === d?.visageId);
  const microEl = contexte.elements.find((e) => e.id === ID_MICRO);
  const microV = microEl?.valeur.type === "accessoire" ? (microEl.valeur as ValeurAccessoire) : null;
  const pos = microV?.positionParAngle[visage?.angle ?? "trois-quarts"] ?? microV?.positionParAngle["trois-quarts"];
  const lutId = b.styles.lutId ?? format.stylesParDefaut.lut;
  const lut = contexte.elements.find((e) => e.id === lutId);
  const decorPlateau: DecorPlateau | null = v
    ? { imageUrl: imageDecor(decor, contexte), teinte: v.teinte, teinteLumiere: v.teinteLumiere, profondeurFlou: v.profondeurFlou, directionLumiere: v.directionLumiere, positionSujet: v.positionSujet }
    : null;
  return {
    decor: decorPlateau,
    detoureUrl: visage ? (contexte.express?.plateau.detoures[visage.id] ?? null) : null,
    vignetteUrl: visage?.vignette ?? null,
    micro: microAllume(b) && pos ? { ...pos, flouPx: microV?.flouPx ?? 8 } : null,
    lut: lut ? { url: lut.url, intensite: b.styles.intensiteLut ?? format.stylesParDefaut.intensiteLut ?? 70, nom: lut.nom } : null,
  };
}
