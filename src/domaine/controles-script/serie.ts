/**
 * Contrôles de SÉRIE (plan v5 B.7.2 ; « Série » = `historiqueSerie`, B.0 n° 40). PUR.
 * C43, C44, C45, C48 (double d'affilée), C49, C50 (rotation), C51 (rotation), C52, C53, C56, C66.
 * Les mêmes fonctions servent au choix conjoint (étape 0) et au tableau « variété ».
 */
import type { ElementSerie } from "@/domaine/variete";
import type { DateIso, Emotion, Id, PlaceException, PointDeVue, TypeAngle, TypeMatiere } from "@/domaine/types";
import type { ViolationControle } from "./types";
import { motsPleins, racine } from "./texte";

/** Règles communes de variété (B.3.9, B.0 n° 40 ; `variete.*`). Une recette peut les remplacer. */
export const REGLES_VARIETE = {
  /** C43 : au plus 2 fois de suite la même structure. */
  structureMaxDeSuite: 2,
  /** C43 : part maximale sur les 10 derniers = max(40 %, 1/n + 10 points). */
  structurePartPlancher: 0.4,
  /** C49 : au plus 2 fois de suite le même type d'ancrage. */
  typeAncrageMaxDeSuite: 2,
  /** C50, C51, C66 : au plus 2 fois de suite la même valeur. */
  rotationMaxDeSuite: 2,
  /** C50 : aucun point de vue au-delà de 50 % des 10 derniers. */
  pointDeVuePartMax: 0.5,
  /** C52 : part d'anecdote de Will sur les 10 derniers, après 10 sujets validés. */
  partAnecdoteMax: 0.25,
  sujetsAvantQuotaAnecdote: 10,
  /** C53 : réemploi d'une matière comme ancrage sur un même réseau. */
  reemploiJours: 60,
  /** C44 : une expression sur au plus 30 % des 10 derniers. */
  expressionPartMax: 0.3,
  /** C45 : au moins un script sur trois finit sur le fait. */
  finSurLeFaitUnSur: 3,
  /** C56 : sujets déjà traités, fenêtre et recouvrement des mots-clés. */
  dejaTraiteJours: 180,
  dejaTraiteRecouvrement: 0.5,
  fenetre: 10,
} as const;

export type ReglesVariete = { -readonly [K in keyof typeof REGLES_VARIETE]: (typeof REGLES_VARIETE)[K] };

/** Élément de série enrichi des axes v5 (place de l'exception, type d'angle, double). */
export type ElementSerieEtendu = ElementSerie & { placeException?: PlaceException; typeAngle?: TypeAngle; double?: boolean };

const v = (controle: string, message: string, bloquant = false): ViolationControle => ({ controle, message, bloquant, niveau: bloquant ? "bloquant" : "alerte" });

function finDeSuite<T>(valeurs: (T | undefined)[], valeur: T): number {
  let n = 0;
  for (let i = valeurs.length - 1; i >= 0 && valeurs[i] === valeur; i--) n++;
  return n;
}

/** C43 : la structure peut-elle être tirée par la machine après cette série ? */
export function c43Structure(serie: Pick<ElementSerie, "structure">[], structure: string, nRealisables: number, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  const out: ViolationControle[] = [];
  const valeurs = serie.map((e) => e.structure);
  if (finDeSuite(valeurs, structure) >= r.structureMaxDeSuite) out.push(v("C43", `Structure ${structure} déjà tirée ${r.structureMaxDeSuite} fois de suite.`, true));
  const dix = [...valeurs.slice(-(r.fenetre - 1)), structure];
  const part = dix.filter((x) => x === structure).length / dix.length;
  const plafond = Math.max(r.structurePartPlancher, 1 / Math.max(1, nRealisables) + 0.1);
  if (dix.length >= 5 && part > plafond + 1e-9) out.push(v("C43", `Structure ${structure} sur ${Math.round(part * 100)} % des ${dix.length} derniers (plafond ${Math.round(plafond * 100)} %).`, true));
  return out;
}

/** C49 : pas plus de 2 fois de suite le même type d'ancrage. */
export function c49TypeAncrage(serie: Pick<ElementSerie, "typesAncrage">[], type: TypeMatiere, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  return finDeSuite(serie.map((e) => e.typesAncrage[0]), type) >= r.typeAncrageMaxDeSuite ? [v("C49", `Ancrage « ${type} » déjà ${r.typeAncrageMaxDeSuite} fois de suite.`, true)] : [];
}

/** C50 (rotation) : pas plus de 2 fois de suite, aucun au-delà de 50 % des 10 derniers. */
export function c50Rotation(serie: Pick<ElementSerie, "pointDeVue">[], pdv: PointDeVue, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  const out: ViolationControle[] = [];
  const valeurs = serie.map((e) => e.pointDeVue);
  if (finDeSuite(valeurs, pdv) >= r.rotationMaxDeSuite) out.push(v("C50", `Point de vue « ${pdv} » déjà ${r.rotationMaxDeSuite} fois de suite.`));
  const dix = [...valeurs.slice(-(r.fenetre - 1)), pdv];
  if (dix.length >= 4 && dix.filter((x) => x === pdv).length / dix.length > r.pointDeVuePartMax) out.push(v("C50", `Point de vue « ${pdv} » sur plus de la moitié des derniers sujets.`));
  return out;
}

/** C51 (rotation) : le même ressenti pas plus de 2 fois de suite. */
export function c51Rotation(serie: Pick<ElementSerie, "emotion">[], emotion: Emotion, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  if (emotion === "neutre") return [];
  return finDeSuite(serie.map((e) => e.emotion), emotion) >= r.rotationMaxDeSuite ? [v("C51", `Ressenti « ${emotion} » déjà ${r.rotationMaxDeSuite} fois de suite.`)] : [];
}

/** C52 : part d'anecdote après ce sujet, seulement après N sujets validés. */
export function c52PartAnecdote(serie: Pick<ElementSerie, "anecdote" | "reserve">[], anecdote: boolean, sujetsValides: number, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  if (!anecdote || sujetsValides < r.sujetsAvantQuotaAnecdote) return [];
  const dix = [...serie.slice(-(r.fenetre - 1)).map((e) => e.anecdote), true];
  const part = dix.filter(Boolean).length / dix.length;
  return part > r.partAnecdoteMax + 1e-9 ? [v("C52", `Anecdotes de Will sur ${Math.round(part * 100)} % des ${dix.length} derniers (${r.partAnecdoteMax * 100} % au plus).`, true)] : [];
}

/** C53 : la matière a-t-elle servi d'ancrage sur l'un de ces réseaux il y a moins de N jours ? */
export function c53Reemploi(
  usages: { reseau: string; le: DateIso; numero?: number }[],
  reseaux: string[],
  maintenant: DateIso,
  r: ReglesVariete = REGLES_VARIETE,
): { exclue: boolean; dernier?: { numero?: number; ilYaJours: number } } {
  const jours = (d: DateIso) => (Date.parse(maintenant) - Date.parse(d)) / 86_400_000;
  const recents = usages.filter((u) => reseaux.includes(u.reseau) && jours(u.le) < r.reemploiJours).sort((a, b) => b.le.localeCompare(a.le));
  return recents.length ? { exclue: true, dernier: { numero: recents[0].numero, ilYaJours: Math.floor(jours(recents[0].le)) } } : { exclue: false };
}

/** C44 : expressions tournantes (apaisement, relance, exception, texte d'appel). */
export function c44Expressions(
  serie: Pick<ElementSerie, "expressionsApaisementRelance" | "formuleException" | "texteAppel">[],
  nouvelles: { expressions?: string[]; formuleException?: string; texteAppel?: string; appelDeSerieActif?: boolean },
  r: ReglesVariete = REGLES_VARIETE,
): ViolationControle[] {
  const out: ViolationControle[] = [];
  const precedent = serie.at(-1);
  const dix = serie.slice(-r.fenetre);
  const verifier = (valeur: string | undefined, lire: (e: (typeof serie)[number]) => string[], libelle: string) => {
    if (!valeur) return;
    const norm = valeur.trim().toLowerCase();
    if (precedent && lire(precedent).some((x) => x.trim().toLowerCase() === norm)) out.push(v("C44", `${libelle} « ${valeur} » identique au sujet précédent.`));
    const n = dix.filter((e) => lire(e).some((x) => x.trim().toLowerCase() === norm)).length + 1;
    if (dix.length >= 3 && n / (dix.length + 1) > r.expressionPartMax) out.push(v("C44", `${libelle} « ${valeur} » sur plus de 30 % des derniers sujets.`));
  };
  for (const x of nouvelles.expressions ?? []) verifier(x, (e) => e.expressionsApaisementRelance, "Expression");
  verifier(nouvelles.formuleException, (e) => (e.formuleException ? [e.formuleException] : []), "Formule d'exception");
  if (!nouvelles.appelDeSerieActif) verifier(nouvelles.texteAppel, (e) => (e.texteAppel ? [e.texteAppel] : []), "Texte d'appel");
  return out;
}

/** C45 : au moins un script sur trois finit sur le fait. */
export function c45Portefeuille(serie: Pick<ElementSerie, "finSurLeFait">[], finSurLeFait: boolean, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  const derniers = [...serie.slice(-(r.finSurLeFaitUnSur - 1)).map((e) => !!e.finSurLeFait), finSurLeFait];
  return derniers.length >= r.finSurLeFaitUnSur && !derniers.some(Boolean) ? [v("C45", `Aucun des ${r.finSurLeFaitUnSur} derniers scripts ne finit sur un fait.`)] : [];
}

/** C66 : place de l'exception et type d'angle, pas plus de 2 fois de suite. */
export function c66Rotation(serie: Pick<ElementSerieEtendu, "placeException" | "typeAngle">[], nouveau: { placeException?: PlaceException; typeAngle?: TypeAngle }, r: ReglesVariete = REGLES_VARIETE): ViolationControle[] {
  const out: ViolationControle[] = [];
  if (nouveau.placeException && finDeSuite(serie.map((e) => e.placeException), nouveau.placeException) >= r.rotationMaxDeSuite) out.push(v("C66", `Exception placée « ${nouveau.placeException} » 3 fois de suite.`));
  if (nouveau.typeAngle && finDeSuite(serie.map((e) => e.typeAngle), nouveau.typeAngle) >= r.rotationMaxDeSuite) out.push(v("C66", `Angle « ${nouveau.typeAngle} » 3 fois de suite.`));
  return out;
}

/** C48 : 3e vidéo du double d'affilée. */
export function c48Double(serie: Pick<ElementSerieEtendu, "double">[], double: boolean): ViolationControle[] {
  return double && finDeSuite(serie.map((e) => !!e.double), true) >= 2 ? [{ controle: "C48", message: "3e vidéo du double d'affilée : proposer « vous en personne ».", bloquant: false, niveau: "info" }] : [];
}

/* ---------- C56 : sujets proches ---------- */
export interface SujetPasse {
  scriptMaitreId: Id;
  numero?: number;
  le: DateIso;
  pilier?: string;
  appui?: Id;
  motsCles: string[];
}

/** Sujets déjà traités : même pilier, même appui principal et ≥ 50 % de mots-clés communs, sur 180 jours (C56, gratuit). */
export function sujetsProches(
  sujet: { pilier?: string; appui?: Id; motsCles: string[]; idee?: string },
  passes: SujetPasse[],
  maintenant: DateIso,
  r: ReglesVariete = REGLES_VARIETE,
): (SujetPasse & { recouvrement: number })[] {
  const racines = (l: string[]) => new Set(l.flatMap((m) => motsPleins(m)).map(racine));
  const a = racines(sujet.motsCles.length ? sujet.motsCles : [sujet.idee ?? ""]);
  return passes
    .filter((p) => (Date.parse(maintenant) - Date.parse(p.le)) / 86_400_000 <= r.dejaTraiteJours)
    .filter((p) => !!sujet.pilier && p.pilier === sujet.pilier && !!sujet.appui && p.appui === sujet.appui)
    .map((p) => {
      const b = racines(p.motsCles);
      const communs = [...a].filter((x) => b.has(x)).length;
      return { ...p, recouvrement: communs / Math.max(1, Math.min(a.size, b.size)) };
    })
    .filter((p) => p.recouvrement >= r.dejaTraiteRecouvrement)
    .sort((x, y) => y.le.localeCompare(x.le));
}
