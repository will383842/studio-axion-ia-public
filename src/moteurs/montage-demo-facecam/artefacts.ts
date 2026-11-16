/**
 * G3-01 — ARTEFACTS DE LA DÉMO FACECAM gardés dans la reprise : mots de l'enregistrement d'écran, pistes (zooms, clics,
 * surlignages, légendes) et style des sous-titres. Fonctions pures, tolérantes : une donnée mal formée est ignorée,
 * jamais d'exception. Ajout pur : sans artefact, la reprise est celle d'avant.
 */
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { EntreesDemo } from "./entrees";
import { pistesEcran, type PistesEcran } from "./pistes";
import { styleSousTitresDemo, type EtatDemo, type StyleSousTitresDemo } from "./chaine";

export interface ArtefactsDemo {
  motsEcran?: MotHorodate[];
  pistes?: PistesEcran;
  styleSousTitres?: StyleSousTitresDemo;
}

const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const objet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const lireMots = (v: unknown): MotHorodate[] | undefined =>
  Array.isArray(v)
    ? v.filter((m): m is MotHorodate => objet(m) && typeof m.mot === "string" && nombre(m.debutSec) && nombre(m.finSec)).map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec }))
    : undefined;

const liste = <T>(v: unknown, ok: (o: Record<string, unknown>) => boolean): T[] => (Array.isArray(v) ? (v.filter((o) => objet(o) && ok(o)) as T[]) : []);

const lirePistes = (v: unknown): PistesEcran | undefined => {
  if (!objet(v)) return undefined;
  return {
    zooms: liste(v.zooms, (o) => nombre(o.debutMs) && nombre(o.finMs) && nombre(o.x) && nombre(o.y) && nombre(o.facteur)),
    clics: liste(v.clics, (o) => nombre(o.ms) && nombre(o.x) && nombre(o.y)),
    surlignages: liste(v.surlignages, (o) => nombre(o.debutMs) && nombre(o.finMs) && nombre(o.x) && nombre(o.y) && nombre(o.largeur) && nombre(o.hauteur)),
    legendes: liste(v.legendes, (o) => nombre(o.debutMs) && nombre(o.finMs) && typeof o.texte === "string"),
  };
};

const lireStyle = (v: unknown): StyleSousTitresDemo | undefined => (objet(v) && Array.isArray(v.prononciations) ? (v as unknown as StyleSousTitresDemo) : undefined);

/** Artefacts du montage qui vient de finir (seuls les présents sont renvoyés). */
export function artefactsDemo(etat: EtatDemo, entrees: EntreesDemo, commande: CommandeFabrication): ArtefactsDemo {
  const motsEcran = lireMots((etat.travaux?.["transcrire-ecran"]?.resultat as { mots?: unknown } | undefined)?.mots);
  const style = styleSousTitresDemo(commande);
  return {
    ...(motsEcran?.length ? { motsEcran } : {}),
    ...(etat.plan ? { pistes: pistesEcran(etat.plan, entrees.consignes) } : {}),
    ...(style ? { styleSousTitres: style } : {}),
  };
}

/** Artefacts relus d'une reprise ; champs absents ou mal formés ignorés. */
export function lireArtefactsDemo(reprise: unknown): ArtefactsDemo {
  try {
    if (!objet(reprise)) return {};
    const motsEcran = lireMots(reprise.motsEcran);
    const pistes = lirePistes(reprise.pistes);
    const styleSousTitres = lireStyle(reprise.styleSousTitres);
    return { ...(motsEcran?.length ? { motsEcran } : {}), ...(pistes ? { pistes } : {}), ...(styleSousTitres ? { styleSousTitres } : {}) };
  } catch {
    return {};
  }
}
