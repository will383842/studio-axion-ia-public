/**
 * Réglages de cadence (plage de publication) : heures proposées par réseau, quota par jour, écart minimum entre deux
 * créneaux, et objectifs de départ par type de contenu. Fonctions PURES. Tout est un AVERTISSEMENT ou une ALERTE :
 * rien ne bloque jamais ce que le fondateur planifie à la main.
 */
import type { IdReseau } from "@/domaine/types";
import { modePremierCommentaire, type ModePremierCommentaire } from "@/domaine/ecriture-post/commentaire";
import { obtenirReseau } from "@/reseaux";
import { jourDeParis } from "@/domaine/usine-calendrier";

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
/** Une règle de réseau : sa valeur, la date où elle a été vérifiée (null : jamais) et d'où elle vient. */
export interface ValeurRegle<T> {
  valeur: T;
  /** « AAAA-MM-JJ », ou null tant que la règle n'a pas été vérifiée. */
  verifieLe: string | null;
  source: string;
}
export const SOURCE_SAISIE = "Modifiée par vous dans les Réglages";
/** Garde la règle telle quelle si la saisie est identique ou vide ; sinon la valeur change et sa source devient « modifiée par vous », datée d'aujourd'hui (jour de Paris, pas UTC). */
export function regleSaisie<T extends number | string>(actuelle: ValeurRegle<T>, saisie: T | undefined, maintenantMs: number = Date.now()): ValeurRegle<T> {
  if (saisie === undefined || (typeof saisie === "number" && !Number.isFinite(saisie)) || saisie === actuelle.valeur) return actuelle;
  return { valeur: saisie, source: SOURCE_SAISIE, verifieLe: jourDeParis(maintenantMs) };
}
/** Premier commentaire : part tout seul, part après votre accord, ou à copier à la main. */
export type EtatPremierCommentaire = ModePremierCommentaire;
export const ETATS_PREMIER_COMMENTAIRE: readonly EtatPremierCommentaire[] = ["auto", "a-confirmer", "a-la-main"];
export const LIBELLES_PREMIER_COMMENTAIRE: Record<EtatPremierCommentaire, string> = {
  auto: "Part tout seul avec la publication",
  "a-confirmer": "Part avec la publication, après votre accord",
  "a-la-main": "À copier et coller à la main",
};
export interface ReglesReseau {
  /** Longueur maximale du texte, en signes. */
  texteMax: ValeurRegle<number>;
  /** Nombre maximal de mots-dièse. */
  motsDieseMax: ValeurRegle<number>;
  premierCommentaire: ValeurRegle<EtatPremierCommentaire>;
  /** Nombre de PDF d'un carrousel : LinkedIn seulement. */
  pdfCarrousel?: ValeurRegle<number>;
}
export interface ReglagesCadence {
  reseaux: Record<IdReseau, CadenceReseau>;
  objectifs: Record<TypeContenuCadence, ObjectifCadence>;
  /** Règles par réseau, modifiables dans Réglages. */
  regles: Record<IdReseau, ReglesReseau>;
}
export interface AlerteObjectif {
  type: TypeContenuCadence;
  message: string;
  bloquant: false;
}

export const CLE_REGLAGES_CADENCE = "cadence.reglages";

const un = (heures: string[], quotaParJour: number, ecartMinMinutes: number): CadenceReseau => ({ heures, quotaParJour, ecartMinMinutes });

/** Date du relevé des règles des réseaux (fiche L8-01). */
const RELEVE_L8_01 = "2026-11-12";
const SOURCE_RELEVE = "Relevé des règles des réseaux (L8-01)";
const SOURCE_REGISTRE = "Valeur de départ du studio, pas encore vérifiée auprès du réseau";

function reglesDeDepart(id: IdReseau): ReglesReseau {
  const legende = obtenirReseau(id).legende;
  const texteSource = id === "tiktok";
  const commentaireSource = id === "linkedin" || id === "instagram" || id === "facebook" || id === "tiktok";
  const regles: ReglesReseau = {
    texteMax: texteSource
      ? { valeur: legende.longueurMax, verifieLe: RELEVE_L8_01, source: `${SOURCE_RELEVE} : titre de vidéo de 2200 signes au plus (source secondaire)` }
      : { valeur: legende.longueurMax, verifieLe: null, source: SOURCE_REGISTRE },
    motsDieseMax: { valeur: legende.motsDieseMax, verifieLe: null, source: SOURCE_REGISTRE },
    premierCommentaire: {
      valeur: modePremierCommentaire(id).mode,
      verifieLe: commentaireSource ? RELEVE_L8_01 : null,
      source: commentaireSource ? `${SOURCE_RELEVE} : ${id === "tiktok" ? "pas de premier commentaire envoyé avec la publication" : "le premier commentaire peut partir avec la publication"}` : SOURCE_REGISTRE,
    },
  };
  if (id === "linkedin") regles.pdfCarrousel = { valeur: 1, verifieLe: RELEVE_L8_01, source: `${SOURCE_RELEVE} : un seul PDF par carrousel (source officielle)` };
  return regles;
}
const reglesParReseau = (): Record<IdReseau, ReglesReseau> => {
  const out = {} as Record<IdReseau, ReglesReseau>;
  for (const id of RESEAUX_CADENCE) out[id] = reglesDeDepart(id);
  return out;
};

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
  regles: reglesParReseau(),
};

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const entier = (v: unknown, defaut: number, max: number, min = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : defaut;

/** Heure saisie à la main (« 8h », « 8h30 », « 8:00 », « 08:00 ») → « HH:MM », ou null si illisible. */
export function lireHeure(saisie: unknown): string | null {
  if (typeof saisie !== "string") return null;
  const m = /^(\d{1,2})\s*(?:h|:)\s*(\d{2})?$/i.exec(saisie.trim());
  if (!m) return null;
  const h = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
  return HEURE.test(h) ? h : null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Une règle lue : valeur lisible gardée (avec sa source et sa date), sinon la valeur de départ. */
function lireRegle<T>(brut: unknown, defaut: ValeurRegle<T>, lire: (v: unknown) => T | undefined): ValeurRegle<T> {
  const x = objet(brut);
  const valeur = lire(x.valeur);
  if (valeur === undefined) return defaut;
  const source = typeof x.source === "string" && x.source.trim() ? x.source.trim().slice(0, 200) : defaut.source;
  const verifieLe = x.verifieLe === null ? null : typeof x.verifieLe === "string" && DATE.test(x.verifieLe) ? x.verifieLe : defaut.verifieLe;
  return { valeur, source, verifieLe };
}
const nombreEntre = (min: number, max: number) => (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;
const etatLu = (v: unknown): EtatPremierCommentaire | undefined => ETATS_PREMIER_COMMENTAIRE.find((e) => e === v);

/** Réglages sûrs à partir de n'importe quelle valeur lue : l'invalide retombe sur la valeur de départ. */
export function normaliserReglagesCadence(brut: unknown): ReglagesCadence {
  const r = objet(objet(brut).reseaux);
  const o = objet(objet(brut).objectifs);
  const reseaux = {} as Record<IdReseau, CadenceReseau>;
  for (const id of RESEAUX_CADENCE) {
    const d = REGLAGES_CADENCE_DEFAUT.reseaux[id];
    const x = objet(r[id]);
    const heures = Array.isArray(x.heures)
      ? [...new Set(x.heures.map(lireHeure).filter((h): h is string => h !== null))].sort()
      : d.heures;
    reseaux[id] = { heures, quotaParJour: entier(x.quotaParJour, d.quotaParJour, 20, 1), ecartMinMinutes: entier(x.ecartMinMinutes, d.ecartMinMinutes, 1440) };
  }
  const objectifs = {} as Record<TypeContenuCadence, ObjectifCadence>;
  for (const t of Object.keys(REGLAGES_CADENCE_DEFAUT.objectifs) as TypeContenuCadence[]) {
    const d = REGLAGES_CADENCE_DEFAUT.objectifs[t];
    const x = objet(o[t]);
    objectifs[t] = { quantite: entier(x.quantite, d.quantite, 50), periode: x.periode === "jour" || x.periode === "semaine" ? x.periode : d.periode };
  }
  const regles = {} as Record<IdReseau, ReglesReseau>;
  const rg = objet(objet(brut).regles);
  for (const id of RESEAUX_CADENCE) {
    const d = REGLAGES_CADENCE_DEFAUT.regles[id];
    const x = objet(rg[id]);
    regles[id] = {
      texteMax: lireRegle(x.texteMax, d.texteMax, nombreEntre(1, 100000)),
      motsDieseMax: lireRegle(x.motsDieseMax, d.motsDieseMax, nombreEntre(0, 100)),
      premierCommentaire: lireRegle(x.premierCommentaire, d.premierCommentaire, etatLu),
      ...(d.pdfCarrousel ? { pdfCarrousel: lireRegle(x.pdfCarrousel, d.pdfCarrousel, nombreEntre(0, 10)) } : {}),
    };
  }
  return { reseaux, objectifs, regles };
}

const minutes = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const AVEC_DECALAGE = /(Z|[+-]\d{2}:?\d{2})$/i;
const FORMAT_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** « AAAA-MM-JJTHH:MM » en heure de Paris : un instant avec décalage (Z, +01:00) est converti, un local reste tel quel. */
function enHeureDeParis(iso: string): string {
  if (!AVEC_DECALAGE.test(iso)) return iso;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const p = Object.fromEntries(FORMAT_PARIS.formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
const jourDe = (iso: string): string => enHeureDeParis(iso).slice(0, 10);
const heureDe = (iso: string): string => enHeureDeParis(iso).slice(11, 16);

/**
 * Avertissements pour un créneau « AAAA-MM-JJTHH:MM » d'un réseau, face aux créneaux déjà pris par ce réseau.
 * Les avertissements se cumulent (quota, écart, heure). Jamais bloquant : la liste vide veut dire « rien à signaler ».
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
  if (c.heures.length > 0 && !c.heures.includes(heureDe(creneau))) {
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

const MOT_DIESE = /#[\p{L}\p{N}_]+/gu;
export interface EntreeControleRegles {
  texte: string;
  /** Texte du premier commentaire, s'il y en a un. */
  premierCommentaire?: string;
  /** Nombre de PDF joints au carrousel. */
  nbPdf?: number;
}

/**
 * Contrôle du texte d'un réseau selon les règles réglées dans Réglages (donc sans redéploiement). Phrases simples, la
 * liste vide veut dire « rien à signaler ». N'empêche jamais d'enregistrer ni de programmer.
 */
export function controlerTexteSelonRegles(reglages: ReglagesCadence, reseau: IdReseau, e: EntreeControleRegles): string[] {
  const r = reglages.regles[reseau];
  const nom = NOMS[reseau];
  const out: string[] = [];
  if (e.texte.length > r.texteMax.valeur) out.push(`${nom} : texte trop long (${e.texte.length} signes, ${r.texteMax.valeur} au plus).`);
  const n = e.texte.match(MOT_DIESE)?.length ?? 0;
  if (n > r.motsDieseMax.valeur) out.push(`${nom} : ${n} mots-dièse, ${r.motsDieseMax.valeur} au plus.`);
  if (r.pdfCarrousel && e.nbPdf !== undefined && e.nbPdf > r.pdfCarrousel.valeur) {
    out.push(`${nom} : ${e.nbPdf} PDF joints, ${r.pdfCarrousel.valeur} au plus pour un carrousel.`);
  }
  if (r.premierCommentaire.valeur === "a-la-main" && e.premierCommentaire?.trim()) {
    out.push(`${nom} : le premier commentaire ne part pas tout seul, pensez à le copier et le coller à la main.`);
  }
  return out;
}
