/**
 * Réglages de cadence (plage de publication) : heures proposées par réseau, quota par jour, écart minimum entre deux
 * créneaux, et objectifs de départ par type de contenu. Fonctions PURES. Tout est un AVERTISSEMENT ou une ALERTE :
 * rien ne bloque jamais ce que le fondateur planifie à la main.
 */
import type { IdReseau } from "@/domaine/types";

export const RESEAUX_CADENCE: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];
const NOMS: Record<IdReseau, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  "youtube-shorts": "YouTube Shorts",
};
export const nomReseauCadence = (r: IdReseau): string => NOMS[r];

export interface CadenceReseau {
  /** Heures proposées, « HH:MM », triées. */
  heures: string[];
  /** Nombre de publications conseillé par jour. */
  quotaParJour: number;
  /** Écart conseillé entre deux publications du même jour, en minutes. */
  ecartMinMinutes: number;
}
export type TypeContenuCadence = "video" | "carrousel" | "infographie";
export interface ObjectifCadence {
  quantite: number;
  periode: "jour" | "semaine";
}
export interface ReglagesCadence {
  reseaux: Record<IdReseau, CadenceReseau>;
  objectifs: Record<TypeContenuCadence, ObjectifCadence>;
}
export interface AlerteObjectif {
  type: TypeContenuCadence;
  message: string;
  bloquant: false;
}

export const CLE_REGLAGES_CADENCE = "cadence.reglages";

const un = (heures: string[], quotaParJour: number, ecartMinMinutes: number): CadenceReseau => ({ heures, quotaParJour, ecartMinMinutes });
export const REGLAGES_CADENCE_DEFAUT: ReglagesCadence = {
  reseaux: {
    linkedin: un(["08:00", "18:00"], 1, 240),
    instagram: un(["08:00", "12:30", "18:00"], 2, 180),
    facebook: un(["09:00", "18:00"], 1, 240),
    tiktok: un(["12:00", "19:00"], 1, 240),
    youtube: un(["17:00"], 1, 240),
    "youtube-shorts": un(["12:00", "18:00"], 1, 240),
  },
  objectifs: {
    video: { quantite: 1, periode: "jour" },
    carrousel: { quantite: 1, periode: "semaine" },
    infographie: { quantite: 2, periode: "semaine" },
  },
};

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const entier = (v: unknown, defaut: number, max: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : defaut;

/** Réglages sûrs à partir de n'importe quelle valeur lue : l'invalide retombe sur la valeur de départ. */
export function normaliserReglagesCadence(brut: unknown): ReglagesCadence {
  const r = objet(objet(brut).reseaux);
  const o = objet(objet(brut).objectifs);
  const reseaux = {} as Record<IdReseau, CadenceReseau>;
  for (const id of RESEAUX_CADENCE) {
    const d = REGLAGES_CADENCE_DEFAUT.reseaux[id];
    const x = objet(r[id]);
    const heures = Array.isArray(x.heures)
      ? [...new Set(x.heures.filter((h): h is string => typeof h === "string" && HEURE.test(h)))].sort()
      : d.heures;
    reseaux[id] = { heures, quotaParJour: entier(x.quotaParJour, d.quotaParJour, 20), ecartMinMinutes: entier(x.ecartMinMinutes, d.ecartMinMinutes, 1440) };
  }
  const objectifs = {} as Record<TypeContenuCadence, ObjectifCadence>;
  for (const t of Object.keys(REGLAGES_CADENCE_DEFAUT.objectifs) as TypeContenuCadence[]) {
    const d = REGLAGES_CADENCE_DEFAUT.objectifs[t];
    const x = objet(o[t]);
    objectifs[t] = { quantite: entier(x.quantite, d.quantite, 50), periode: x.periode === "jour" || x.periode === "semaine" ? x.periode : d.periode };
  }
  return { reseaux, objectifs };
}

const minutes = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const jourDe = (iso: string): string => iso.slice(0, 10);
const heureDe = (iso: string): string => iso.slice(11, 16);

/**
 * Avertissements pour un créneau « AAAA-MM-JJTHH:MM » d'un réseau, face aux créneaux déjà pris par ce réseau.
 * Jamais bloquant : la liste vide veut dire « rien à signaler ».
 */
export function avertissementsCreneau(reglages: ReglagesCadence, reseau: IdReseau, creneau: string, existants: readonly string[]): string[] {
  const c = reglages.reseaux[reseau];
  const nom = NOMS[reseau];
  const memeJour = existants.filter((e) => jourDe(e) === jourDe(creneau));
  const out: string[] = [];
  if (memeJour.length >= Math.max(1, c.quotaParJour)) {
    out.push(`${nom} : ${memeJour.length + 1}e créneau le même jour (conseillé : ${c.quotaParJour} par jour).`);
  }
  if (c.ecartMinMinutes > 0 && memeJour.some((e) => Math.abs(minutes(heureDe(e)) - minutes(heureDe(creneau))) < c.ecartMinMinutes)) {
    out.push(`${nom} : moins de ${c.ecartMinMinutes} minutes d'écart avec un autre créneau.`);
  }
  if (c.heures.length > 0 && !c.heures.includes(heureDe(creneau)) && out.length === 0) {
    out.push(`${nom} : ${heureDe(creneau)} n'est pas une des heures proposées (${c.heures.join(", ")}).`);
  }
  return out;
}

const LIBELLES: Record<TypeContenuCadence, string> = { video: "Vidéos", carrousel: "Carrousels", infographie: "Infographies" };

/** Alertes (sans blocage) quand le nombre produit sur la période est sous l'objectif. */
export function alertesObjectifs(objectifs: ReglagesCadence["objectifs"], produits: Record<TypeContenuCadence, number>): AlerteObjectif[] {
  const out: AlerteObjectif[] = [];
  for (const t of Object.keys(LIBELLES) as TypeContenuCadence[]) {
    const o = objectifs[t];
    if (o.quantite > 0 && (produits[t] ?? 0) < o.quantite) {
      out.push({ type: t, bloquant: false, message: `${LIBELLES[t]} : ${produits[t] ?? 0} sur ${o.quantite} par ${o.periode}.` });
    }
  }
  return out;
}
