/**
 * RÉSOLUTION DES VISAGES PAR ANGLE (moteur avocat B.0 §3). PUR, testé.
 * (tenue, posture) choisies → pour chaque angle, le visage `pret` de même tenue et même posture.
 * S'il manque le second angle : mode « 1 angle, effet 2 caméras par recadrage ». Rien n'est inventé.
 */
import type { AngleVisage, Personnage, PostureVisage, Visage } from "./types";

/** Tenue normalisée : identifiant stable tiré du libellé (« Chemise noire » → « chemise-noire »). */
export function normaliserTenue(tenue: string | undefined): string {
  return (tenue ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tenue d'un visage : `tenueId` s'il existe, sinon le libellé normalisé. */
export function tenueDe(v: Pick<Visage, "tenue" | "tenueId">): string {
  return v.tenueId || normaliserTenue(v.tenue);
}

/** Posture d'un visage : assis si non précisée (les doubles filmés de Will sont assis). */
export function postureDe(v: Pick<Visage, "posture">): PostureVisage {
  return v.posture ?? "assis";
}

/** Second angle du format avocat : trois-quarts ↔ presque de face. */
export function angleOppose(angle: AngleVisage): AngleVisage {
  return angle === "face" ? "trois-quarts" : "face";
}

export interface ResolutionAngles {
  visagesParAngle: Partial<Record<AngleVisage, string>>;
  modeAngles: "deux-angles" | "un-angle";
  /** Posture effectivement retenue. */
  posture: PostureVisage;
}

/**
 * Pour un visage principal et une posture voulue, trouve le visage du second angle (même personnage,
 * même tenue, même posture, prêt). Un choix explicite (`imposes`) n'est jamais remplacé.
 */
export function resoudreVisagesParAngle(params: {
  visages: Visage[];
  principal: Visage;
  posture?: PostureVisage;
  /** Part du second angle : 0 = un seul angle voulu. */
  partSecond: number;
  imposes?: Partial<Record<AngleVisage, string>>;
}): ResolutionAngles {
  const { visages, principal, partSecond, imposes } = params;
  // Vérif A2 (10/10) : la posture du double principal l'emporte (jamais deux postures mélangées : un principal assis
  // avec un second angle debout). La posture voulue ne sert que si le principal n'en déclare aucune.
  const posture = principal.posture ?? params.posture ?? postureDe(principal);
  const tenue = tenueDe(principal);
  const second = angleOppose(principal.angle);
  const visagesParAngle: Partial<Record<AngleVisage, string>> = { [principal.angle]: principal.id, ...(imposes ?? {}) };
  if (partSecond > 0 && !visagesParAngle[second]) {
    const candidats = visages.filter(
      (v) => v.personnageId === principal.personnageId && v.id !== principal.id && v.angle === second && v.statut === "pret" && tenueDe(v) === tenue && postureDe(v) === posture,
    );
    // Lot R7e : de préférence un visage du même fournisseur (deux avatars HeyGen ensemble, jamais un avatar HeyGen et
    // un visage d'essai).
    const trouve = candidats.find((v) => v.fournisseur === principal.fournisseur) ?? candidats[0];
    if (trouve) visagesParAngle[second] = trouve.id;
  }
  const deux = partSecond > 0 && !!visagesParAngle[second];
  if (!deux) delete visagesParAngle[second];
  return { visagesParAngle, modeAngles: deux ? "deux-angles" : "un-angle", posture };
}

/** Visage proposé par défaut pour un personnage : son double par défaut s'il est prêt, sinon le premier prêt. */
export function visageParDefaut<V extends Pick<Visage, "id" | "statut">>(visages: V[], visageParDefautId?: string): V | undefined {
  return visages.find((v) => v.id === visageParDefautId && v.statut === "pret") ?? visages.find((v) => v.statut === "pret");
}

/**
 * CORRECTEUR 4 — AVATAR PAR FORMAT (03/10), sur le modèle exact de `voixPourFormat` : le visage principal d'un
 * personnage pour un format. Ordre : choix de la vidéo (s'il est prêt) > visage du format (`visageParFormat`) > visage
 * par défaut > le premier prêt. Un ancien personnage sans `visageParFormat` garde le comportement d'avant. Le second
 * angle se trouve ensuite par `resoudreVisagesParAngle` (même tenue, même posture) : il reste celui du MÊME avatar.
 */
export function visagePourFormat<V extends Pick<Visage, "id" | "statut">>(
  visages: V[],
  personnage: Pick<Personnage, "visageParDefautId" | "visageParFormat"> | null | undefined,
  formatId: string,
  choixVideo?: string,
): V | undefined {
  const pret = (id?: string) => (id ? visages.find((v) => v.id === id && v.statut === "pret") : undefined);
  return pret(choixVideo) ?? pret(personnage?.visageParFormat?.[formatId]) ?? visageParDefaut(visages, personnage?.visageParDefautId);
}

/** Angle principal d'une recette de montage (« trois-quarts » si le format n'en déclare pas). */
export function anglePrincipalDe(recette: { angles: { principal: AngleVisage } } | null | undefined): AngleVisage {
  return recette?.angles.principal ?? "trois-quarts";
}

/** Visage résolu de l'angle principal de la recette ; à défaut, celui de l'autre angle. */
export function visagePrincipalResolu<T>(visagesResolus: Partial<Record<AngleVisage, T>> | undefined, anglePrincipal: AngleVisage): T | undefined {
  return visagesResolus?.[anglePrincipal] ?? visagesResolus?.[angleOppose(anglePrincipal)];
}
