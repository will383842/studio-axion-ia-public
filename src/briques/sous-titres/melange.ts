/**
 * MÉLANGE DES STYLES DANS UNE MÊME VIDÉO (décision de Will du 01/10, `CATALOGUE-STYLES-SOUS-TITRES.md`). PUR.
 * - une BASE (Karaoké par défaut, Minimal pour une base calme) sur ~80 % des groupes ;
 * - des ACCENTS : Impact (accroche 0-2 s, chiffres, mots les plus forts ; au plus 1 toutes les 6-8 s, jamais deux
 *   de suite, incliné de ±3-5°) et Bandeau (1 à 3 phrases clés, déplacé en haut ou en bas) ;
 * - taille selon l'importance (0-3), soulignement (au plus 1 groupe sur 5, jamais sur un mot coloré), mouvement ;
 * - un changement de style tombe de préférence sur une coupe de plan (± 0,2 s) ;
 * - INTENSITÉ par vidéo : Sobre (base seule + mots en couleur), Équilibré (défaut), Très dynamique.
 * Un groupe VERROUILLÉ (choix de Will) n'est jamais réécrit.
 */
import type { IntensiteSousTitres, MotHorodate, PositionGroupeSousTitres, SegmentSousTitres, StyleGroupeSousTitres } from "@/domaine/types";
import { estFinPhrase, estMotOutil, estNombre, MOTS_FORTS, normaliser } from "./typographie";

export interface ReglagesIntensite {
  /** Écart minimal entre deux Impact (s) ; null = aucun Impact. */
  impactEcartSec: number | null;
  /** Un bandeau toutes les N secondes de vidéo (au moins 1, au plus 3) ; null = aucun bandeau. */
  bandeauToutesLesSec: number | null;
  /** Un groupe souligné au plus tous les N groupes ; null = aucun. */
  souligneUnSur: number | null;
  /** Inclinaison et glissement des accents. */
  mouvement: boolean;
}

export const INTENSITES: Record<IntensiteSousTitres, ReglagesIntensite> = {
  sobre: { impactEcartSec: null, bandeauToutesLesSec: null, souligneUnSur: null, mouvement: false },
  equilibre: { impactEcartSec: 6, bandeauToutesLesSec: 15, souligneUnSur: 5, mouvement: true },
  "tres-dynamique": { impactEcartSec: 4, bandeauToutesLesSec: 10, souligneUnSur: 3, mouvement: true },
};

/**
 * Variation FACULTATIVE du mélange (ajout pur, lot L3b du cas concret). Absente : mélange inchangé au caractère près.
 * Ne change aucune règle : jamais deux Impact de suite, écarts minimaux bornés (`reglagesVaries`).
 */
export interface VariationSousTitres {
  /** Sens d'inclinaison du PREMIER Impact (1 : comme avant ; −1 : l'autre sens) ; les suivants alternent toujours. */
  sensPremierImpact?: 1 | -1;
  /** Réglages qui remplacent ceux de l'intensité, clé par clé (bornés par `PLANCHERS_VARIATION`). */
  reglages?: Partial<Omit<ReglagesIntensite, "mouvement">>;
}

/** Écarts minimaux qu'une variation ne franchit jamais (ceux de « Très dynamique »). */
export const PLANCHERS_VARIATION = { impactEcartSec: 4, bandeauToutesLesSec: 10, souligneUnSur: 3 } as const;

/** Réglages de l'intensité, remplacés par ceux de la variation (bornés) ; sans variation : ceux de l'intensité. */
export function reglagesVaries(r: ReglagesIntensite, variation?: VariationSousTitres): ReglagesIntensite {
  const v = variation?.reglages;
  if (!v) return r;
  const borne = (x: number | null | undefined, actuel: number | null, plancher: number) => (x === undefined ? actuel : x === null ? null : Math.max(plancher, x));
  return {
    ...r,
    impactEcartSec: borne(v.impactEcartSec, r.impactEcartSec, PLANCHERS_VARIATION.impactEcartSec),
    bandeauToutesLesSec: borne(v.bandeauToutesLesSec, r.bandeauToutesLesSec, PLANCHERS_VARIATION.bandeauToutesLesSec),
    souligneUnSur: borne(v.souligneUnSur, r.souligneUnSur, PLANCHERS_VARIATION.souligneUnSur),
  };
}

export interface ContexteMelange {
  intensite: IntensiteSousTitres;
  /** Variation facultative (sens du premier Impact, réglages) ; absente : inchangé. */
  variation?: VariationSousTitres;
  /** Coupes de plan (s) : un changement de style y tombe de préférence. */
  coupesSec?: number[];
  /** Mots du titre de la vidéo (importance + 1). */
  motsTitre?: string[];
  /** Index (dans toute la vidéo) des mots ancres d'illustration. */
  ancres?: number[];
  /** Moments où le haut ou le bas de l'image est déjà occupé (encadré de titre, incrustation). */
  occupe?: { debutSec: number; finSec: number; zone: "haut" | "bas" }[];
  /** Durée de la vidéo (nombre de bandeaux) ; absente : fin du dernier groupe. */
  dureeSec?: number;
}

/** Note d'importance d'un mot (0-3) : chiffres et montants 3 ; mots en valeur et mots forts 2 ; titre, ancre, mot plein long 1. */
export function importanceMot(m: MotHorodate, ctx: { titre: Set<string>; ancre: boolean }): number {
  if (estNombre(m.mot)) return 3;
  const n = normaliser(m.mot);
  if (!n || estMotOutil(m.mot)) return 0;
  let note = 0;
  if (m.enValeur || MOTS_FORTS.has(n)) note = 2;
  // Mot du titre, mot ancre d'une illustration, ou mot plein assez long pour porter le sens.
  if ((n.length >= 4 && ctx.titre.has(n)) || ctx.ancre || n.length >= 7) note = Math.max(note, 1);
  return note;
}

/** Importance des mots de chaque groupe, et du groupe (la plus forte de ses mots). */
export function noterImportance(segments: SegmentSousTitres[], ctx: Pick<ContexteMelange, "motsTitre" | "ancres"> = {}): number[][] {
  const titre = new Set((ctx.motsTitre ?? []).map(normaliser).filter(Boolean));
  const ancres = new Set(ctx.ancres ?? []);
  let rang = 0;
  return segments.map((s) => s.mots.map((m) => importanceMot(m, { titre, ancre: ancres.has(rang++) })));
}

const pres = (t: number, coupes: number[]) => coupes.some((c) => Math.abs(c - t) <= 0.2);

/** Applique le mélange aux groupes non verrouillés. */
export function melanger(segments: SegmentSousTitres[], ctx: ContexteMelange): SegmentSousTitres[] {
  const r = reglagesVaries(INTENSITES[ctx.intensite] ?? INTENSITES.equilibre, ctx.variation);
  const coupes = ctx.coupesSec ?? [];
  const notes = noterImportance(segments, ctx);
  const sortie: SegmentSousTitres[] = segments.map((s, i) =>
    s.verrouille ? { ...s } : { ...s, style: "base" as StyleGroupeSousTitres, importance: Math.max(0, ...notes[i]), souligne: null, position: "auto" as PositionGroupeSousTitres, inclinaison: 0, verrouille: false },
  );
  const libre = (i: number) => !sortie[i].verrouille && sortie[i].style === "base";
  const accent = (i: number) => sortie[i] && sortie[i].style !== "base" && sortie[i].style !== undefined;

  /* --- Impact --- */
  if (r.impactEcartSec !== null) {
    const impacts: number[] = sortie.flatMap((s, i) => (s.style === "impact" ? [i] : []));
    const loinDesAutres = (i: number) =>
      impacts.every((k) => Math.abs(sortie[k].debutSec - sortie[i].debutSec) >= r.impactEcartSec! && Math.abs(k - i) > 1);
    const court = (s: SegmentSousTitres) => s.mots.length <= 3;
    // 1. L'accroche : le groupe le plus fort qui commence dans les 2 premières secondes.
    const accroche = sortie
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => s.debutSec < 2 && libre(i) && court(s))
      .sort((a, b) => (b.s.importance ?? 0) - (a.s.importance ?? 0) || a.i - b.i)[0];
    if (accroche) impacts.push(accroche.i);
    // 2. Les chiffres et les mots les plus forts, sur une coupe de préférence.
    const candidats = sortie
      .map((s, i) => ({ s, i, score: (s.importance ?? 0) * 10 + (s.mots.some((m) => estNombre(m.mot)) ? 5 : 0) + (pres(s.debutSec, coupes) ? 3 : 0) - s.mots.length }))
      .filter(({ s, i }) => libre(i) && court(s) && (s.importance ?? 0) >= 2 && i !== accroche?.i)
      .sort((a, b) => b.score - a.score || a.i - b.i);
    for (const c of candidats) if (loinDesAutres(c.i)) impacts.push(c.i);
    impacts.sort((a, b) => a - b);
    let signe: number = ctx.variation?.sensPremierImpact ?? 1;
    for (const i of impacts) {
      if (sortie[i].verrouille) continue;
      sortie[i].style = "impact";
      sortie[i].importance = 3;
      sortie[i].position = "milieu";
      sortie[i].inclinaison = r.mouvement ? signe * 4 : 0;
      signe = -signe;
    }
  }

  /* --- Bandeau : phrases clés (fin de phrase, importance), loin des Impact, déplacé en haut ou en bas --- */
  if (r.bandeauToutesLesSec !== null && sortie.length) {
    const duree = ctx.dureeSec ?? sortie[sortie.length - 1].finSec;
    const voulus = Math.min(3, Math.max(1, Math.round(duree / r.bandeauToutesLesSec)));
    const deja = sortie.filter((s) => s.style === "bandeau").length;
    const candidats = sortie
      .map((s, i) => ({
        s,
        i,
        score: notes[i].reduce((a, b) => a + b, 0) + (estFinPhrase(s.mots[s.mots.length - 1]?.mot ?? "") ? 4 : 0) + (pres(s.debutSec, coupes) ? 2 : 0),
      }))
      .filter(({ s, i }) => libre(i) && s.debutSec >= 2 && s.mots.length >= 2 && s.mots.length <= 4 && !accent(i - 1) && !accent(i + 1) && notes[i].some((n) => n >= 2))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const choisis: number[] = sortie.flatMap((s, i) => (s.style === "bandeau" ? [i] : []));
    for (const c of candidats) {
      if (choisis.length >= Math.max(voulus, deja) || choisis.length >= 3) break;
      if (choisis.some((k) => Math.abs(sortie[k].debutSec - c.s.debutSec) < 5 || Math.abs(k - c.i) <= 1)) continue;
      choisis.push(c.i);
      const s = sortie[c.i];
      const hautOccupe = (ctx.occupe ?? []).some((o) => o.zone === "haut" && o.debutSec < s.finSec && o.finSec > s.debutSec);
      s.style = "bandeau";
      s.importance = Math.max(2, s.importance ?? 0);
      s.position = hautOccupe ? "bas" : "haut";
    }
  }

  /* --- Soulignement : un mot important, jamais coloré, au plus un groupe sur N --- */
  if (r.souligneUnSur !== null) {
    let depuis = r.souligneUnSur;
    sortie.forEach((s, i) => {
      if (s.verrouille) {
        if (s.souligne !== null && s.souligne !== undefined) depuis = 0;
        else depuis++;
        return;
      }
      if (s.style !== "base" || depuis < r.souligneUnSur!) {
        depuis++;
        return;
      }
      let meilleur = -1;
      s.mots.forEach((m, k) => {
        if (m.enValeur || estNombre(m.mot) || estMotOutil(m.mot) || notes[i][k] < 1) return;
        if (meilleur < 0 || notes[i][k] > notes[i][meilleur]) meilleur = k;
      });
      if (meilleur >= 0) {
        s.souligne = meilleur;
        depuis = 0;
      } else depuis++;
    });
  }
  return sortie;
}

/** Texte comparable d'un groupe (report des verrous après un redécoupage). */
function cle(s: SegmentSousTitres): string {
  return s.mots.map((m) => normaliser(m.mot)).join(" ");
}

/**
 * Les choix VERROUILLÉS de Will passent sur les nouveaux groupes (même texte, minutage proche) : jamais réécrits.
 */
export function reporterVerrouilles(anciens: SegmentSousTitres[], nouveaux: SegmentSousTitres[]): SegmentSousTitres[] {
  const verrous = anciens.filter((s) => s.verrouille);
  if (!verrous.length) return nouveaux;
  return nouveaux.map((n) => {
    const v = verrous.find((a) => cle(a) === cle(n) && Math.abs(a.debutSec - n.debutSec) < 1.5);
    if (!v) return n;
    return { ...n, style: v.style, importance: v.importance, souligne: v.souligne, position: v.position, inclinaison: v.inclinaison, verrouille: true };
  });
}

/** Ce que Will peut choisir en touchant un groupe (à l'aperçu ou après fabrication). */
export type ChoixGroupe = "base" | "impact" | "bandeau" | "souligner" | "plus-gros" | "plus-petit" | "monter" | "descendre";

export const LIBELLES_CHOIX: Record<ChoixGroupe, string> = {
  base: "Base",
  impact: "Impact",
  bandeau: "Bandeau",
  souligner: "Souligner",
  "plus-gros": "Plus gros",
  "plus-petit": "Plus petit",
  monter: "Monter",
  descendre: "Descendre",
};

const ORDRE_POSITIONS: PositionGroupeSousTitres[] = ["bas", "milieu", "haut"];

/**
 * Applique le choix de Will à UN groupe : le groupe devient verrouillé (le moteur ne le réécrit plus).
 * Seul le calque texte change : aucune voix, aucun visage n'est refait.
 */
export function appliquerChoixGroupe(segments: SegmentSousTitres[], segmentId: string, choix: ChoixGroupe, motIndex?: number): SegmentSousTitres[] {
  return segments.map((s) => {
    if (s.id !== segmentId) return s;
    const n: SegmentSousTitres = { ...s, verrouille: true };
    const position = s.position && s.position !== "auto" ? s.position : "milieu";
    switch (choix) {
      case "base":
        n.style = "base";
        n.inclinaison = 0;
        n.position = "auto";
        n.importance = Math.min(2, s.importance ?? 0);
        break;
      case "impact":
        n.style = "impact";
        n.importance = 3;
        n.position = "milieu";
        n.inclinaison = s.inclinaison || 4;
        n.souligne = null;
        break;
      case "bandeau":
        n.style = "bandeau";
        n.importance = Math.max(2, s.importance ?? 0);
        n.position = s.position === "bas" ? "bas" : "haut";
        n.inclinaison = 0;
        n.souligne = null;
        break;
      case "souligner": {
        if (s.souligne !== null && s.souligne !== undefined && motIndex === undefined) {
          n.souligne = null;
          break;
        }
        const k = motIndex ?? s.mots.findIndex((m) => !estMotOutil(m.mot));
        n.souligne = k >= 0 && k < s.mots.length ? k : null;
        // Jamais une couleur ET un soulignement sur le même mot.
        if (n.souligne !== null) n.mots = s.mots.map((m, i) => (i === n.souligne ? { ...m, enValeur: false } : m));
        break;
      }
      case "plus-gros":
        n.importance = Math.min(3, Math.max(2, s.importance ?? 0) + 1);
        break;
      case "plus-petit":
        n.importance = Math.max(0, Math.min(3, s.importance ?? 0) - 1);
        break;
      case "monter":
        n.position = ORDRE_POSITIONS[Math.min(2, ORDRE_POSITIONS.indexOf(position) + 1)];
        break;
      case "descendre":
        n.position = ORDRE_POSITIONS[Math.max(0, ORDRE_POSITIONS.indexOf(position) - 1)];
        break;
    }
    return n;
  });
}
