/**
 * NOTE D'UN SCRIPT ET DE SES ACCROCHES (moteur avocat, lot M1 ; plan B.9 bis, v3.2). PUR, importable côté client.
 *
 * Critères notés /100 : accroche, promesse, clarté (une idée par phrase), preuve, appel unique, durée, oralité, boucle.
 * Note de l'accroche (v3.2) : bonus si elle s'adresse DIRECTEMENT au spectateur dans les 5 premières secondes
 * (« vous » ou « tu », selon l'adresse de la vidéo) et si elle contient un MOT CONCRET du sujet (pas une formule
 * générale). Densité : une phrase au-delà de 5,5 mots/s est signalée et pèse sur la clarté.
 * Sous 70/100, le critère le plus faible est donné « à renforcer » (bandeau non bloquant). Le texte n'est jamais réécrit.
 * Ce calcul sert à la simulation ; le générateur réel (Claude) devra satisfaire les mêmes exigences.
 */
import { analyserAdresse } from "./adresse";
import { compterMots } from "./derivations";
import { phrasesDe, phrasesTropDenses, type PhraseDense } from "./lecture";
import type { Adresse, BlocScript, TypeAccroche } from "./types";

export interface ContexteNotation {
  adresse: Adresse;
  sujet?: string;
  motsParSeconde: number;
  /** Zones de durée d'un format « depuis-script » (avocat : vert 25-40 s, orange 40-50 s). */
  zones?: { vert: [number, number]; orange: [number, number] };
  /** Durée visée (formats à durée choisie) : la note est l'écart à cette cible. */
  dureeCibleSec?: number;
}

export interface NoteAccroche {
  note: number;
  parleAuSpectateur: boolean;
  motConcret: boolean;
  mots: number;
  type: TypeAccroche;
}

export interface NoteDetaillee {
  globale: number;
  criteres: Record<string, number>;
  /** Critères sous 70, du plus faible au plus fort (bandeau « à renforcer »). */
  aRenforcer: string[];
  phrasesDenses: PhraseDense[];
}

/** Seuil du bandeau « à renforcer » (B.9 bis). */
export const SEUIL_A_RENFORCER = 70;

const MOTS_OUTILS = new Set(
  "le la les un une des de du d l et ou à a au aux en ce cet cette ces il elle on je tu vous nous ils elles est sont pas ne que qui quoi se sa son ses votre vos ton ta tes mon ma mes mais pour par sur sous dans avec sans si y peut peuvent faut fait faire être avoir comment pourquoi quand quel quelle quels quelles tout tous toute toutes plus moins très bien ça cela c qu j n s t m".split(" "),
);

const sansAccent = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const motsPleins = (texte: string) =>
  sansAccent(texte)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2 && !MOTS_OUTILS.has(m));
const racine = (m: string) => m.replace(/(s|x)$/, "").slice(0, 6);

/** Formules générales qui ne disent rien du sujet. */
const FORMULES_GENERALES = /\b(ce point|cette chose|ce sujet|ceci|cela|un truc|quelque chose|ce qu'on vous conseille|ce qu'on te conseille|tout le monde)\b/;
/** Introductions qui retardent le moment fort. */
const INTRODUCTIONS = /^(bonjour|salut|hello|aujourd'hui|dans cette vid[ée]o|je vais vous|je vais te|on va parler)/i;

/** Le texte s'adresse-t-il au spectateur selon l'adresse choisie (impératif compris : « évitez », « évite ») ? */
export function parleAuSpectateur(texte: string, adresse: Adresse): boolean {
  const a = analyserAdresse(texte);
  if (adresse === "vous") return a.vous > 0 || /\b\p{L}+ez\b/u.test(texte);
  return a.tu > 0 || /^(ne\s+)?(fais|évite|regarde|écoute|attends|vérifie|garde|demande|lis|retiens)\b/i.test(texte.trim());
}

/** Mot concret : un mot plein du sujet, un chiffre, ou un nom propre ; jamais une formule générale seule. */
export function contientMotConcret(texte: string, sujet?: string): boolean {
  const sujetRacines = new Set(motsPleins(sujet ?? "").map(racine));
  const plein = motsPleins(texte).some((m) => sujetRacines.has(racine(m)));
  const nomPropre = /(?<!^)(?<![.?!]\s)\b[A-ZÉÈ][\p{L}]{2,}/u.test(texte.trim()) || /\b[A-Z]{2,}\b/.test(texte);
  return plein || /\d/.test(texte) || (nomPropre && !FORMULES_GENERALES.test(sansAccent(texte)));
}

/** Type probable d'une accroche (sert à l'apprentissage, B.9 bis). */
export function typeAccroche(texte: string): TypeAccroche {
  const t = sansAccent(texte);
  if (/\d|\b(neuf|huit|sept|dix|cent|mille|million)\b/.test(t)) return "chiffre-choc";
  if (/\berreur|piege|se trompe|faute\b/.test(t)) return "erreur-commune";
  if (/\b(surtout pas|surtout,? ne|ne (faites|fais) (surtout )?pas|contrairement|c'est faux|en fait|jamais)\b/.test(t)) return "contre-intuitif";
  if (/\?\s*$/.test(texte.trim())) return "question";
  return "promesse";
}

/** Note d'une accroche /100 (B.9 bis, v3.2). `suite` : ce qui est dit juste après (la promesse), pour la règle des 5 s. */
export function noterAccroche(texte: string, ctx: Pick<ContexteNotation, "adresse" | "sujet" | "motsParSeconde">, suite = ""): NoteAccroche {
  // Les signes isolés (« ? ») ne sont pas des mots.
  const mots = texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
  // S'adresse au spectateur avant 5 s : dans l'accroche ou dans le début de la promesse.
  const motsAvant5s = Math.round(5 * ctx.motsParSeconde);
  const debut = [texte, suite].join(" ").split(/\s+/).filter(Boolean).slice(0, motsAvant5s).join(" ");
  const parle = parleAuSpectateur(debut, ctx.adresse);
  const concret = contientMotConcret(texte, ctx.sujet);
  let note = 62;
  note += mots <= 12 ? 12 : -2 * (mots - 12);
  if (mots < 3) note -= 15;
  if (parle) note += 10;
  if (concret) note += 10;
  if (INTRODUCTIONS.test(texte.trim())) note -= 25;
  if (FORMULES_GENERALES.test(sansAccent(texte)) && !concret) note -= 8;
  return { note: Math.max(0, Math.min(100, Math.round(note))), parleAuSpectateur: parle, motConcret: concret, mots, type: typeAccroche(texte) };
}

const texteBloc = (blocs: BlocScript[], id: string) =>
  blocs
    .filter((b) => b.blocRecette === id)
    .flatMap((b) => b.segments.map((s) => s.texte))
    .join(" ")
    .trim();

/** Appels à l'action reconnus (« un seul appel » : plusieurs de ces verbes dispersent le spectateur). */
const VERBES_APPEL = /\b(abonne[zr]?|commente[zr]?|partage[zr]?|clique[zr]?|écri(?:ve)?[zs]|ecri(?:ve)?[zs]|télécharge[zr]?|telecharge[zr]?|suive[zr]|suis|appele[zr]|appelle|enregistre[zr]?|like[zr]?|réserve[zr]?|reserve[zr]?|contacte[zr]?|rejoigne[zr]|rejoins)\b/gi;
/** Marques de l'écrit, rares à l'oral. */
const MARQUES_ECRIT = /\b(en effet|toutefois|néanmoins|cependant|par conséquent|ainsi que|afin de|dont|lequel|laquelle|auxquels|notamment)\b|[;()]/gi;

function noteDuree(mots: number, ctx: ContexteNotation): number {
  const duree = mots / Math.max(0.1, ctx.motsParSeconde);
  if (ctx.zones) {
    const { vert, orange } = ctx.zones;
    if (duree >= vert[0] && duree <= vert[1]) return 100;
    if (duree > vert[1] && duree <= orange[1]) return 70;
    if (duree > orange[1]) return 40;
    // Plus court que la zone verte : bien sur TikTok (21-34 s), faible sous 15 s.
    return duree >= 15 ? 85 : 55;
  }
  const cible = ctx.dureeCibleSec ?? duree;
  const ecart = Math.abs(duree - cible) / Math.max(cible, 1);
  return Math.max(40, Math.round(100 - ecart * 80));
}

/**
 * Note détaillée d'un script. `critereIds` : les critères de la recette (un critère inconnu reçoit `parDefaut`).
 */
export function noterScriptDetaille(blocs: BlocScript[], critereIds: string[], ctx: ContexteNotation, parDefaut: (id: string) => number = () => 75): NoteDetaillee {
  const tout = blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
  const mots = compterMots(tout);
  const phrases = phrasesDe(tout);
  const denses = phrasesTropDenses(tout, ctx.motsParSeconde);
  const accroche = texteBloc(blocs, "accroche") || phrases[0] || "";
  const promesse = texteBloc(blocs, "promesse");
  const preuve = texteBloc(blocs, "preuve");
  const appel = texteBloc(blocs, "appel") || texteBloc(blocs, "fin");
  const boucle = texteBloc(blocs, "boucle");
  const calculs: Record<string, () => number> = {
    accroche: () => noterAccroche(accroche, ctx, promesse).note,
    promesse: () => {
      if (!promesse) return 30;
      // La promesse arrive avant 5 s : les mots de l'accroche et de la promesse tiennent dans 5 s.
      const avant5s = compterMots(`${accroche} ${promesse}`) <= 5 * ctx.motsParSeconde + 4;
      const annonce = /\b(je vous explique|je t'explique|voici|comment|pourquoi|la solution|en \d|en trois|en deux)\b/i.test(promesse);
      return Math.min(100, 65 + (avant5s ? 20 : 0) + (annonce ? 12 : 0));
    },
    clarte: () => {
      const moyenne = mots / Math.max(1, phrases.length);
      const base = moyenne <= 12 ? 95 : Math.max(45, Math.round(95 - (moyenne - 12) * 4));
      return Math.max(30, base - 6 * denses.length);
    },
    preuve: () => {
      if (!preuve) return 20;
      return /\d|\b(cas|client|cliente|dossier|jugement|arrêt|tribunal|étude|selon)\b/i.test(preuve) ? 95 : 65;
    },
    appel: () => {
      if (!appel) return 30;
      const verbes = (appel.match(VERBES_APPEL) ?? []).length;
      return verbes <= 1 ? 92 : Math.max(40, 92 - 18 * (verbes - 1));
    },
    duree: () => noteDuree(mots, ctx),
    oralite: () => {
      const longs = tout.split(/\s+/).filter((m) => m.replace(/[^\p{L}]/gu, "").length > 13).length;
      const ecrit = (tout.match(MARQUES_ECRIT) ?? []).length;
      return Math.max(40, Math.min(98, 98 - 6 * ecrit - Math.round((100 * longs) / Math.max(1, mots))));
    },
    boucle: () => {
      if (!boucle) return 25;
      const a = new Set(motsPleins(accroche).map(racine));
      return motsPleins(boucle).some((m) => a.has(racine(m))) ? 95 : 70;
    },
  };
  const criteres: Record<string, number> = {};
  for (const id of critereIds) criteres[id] = calculs[id] ? calculs[id]() : parDefaut(id);
  const valeurs = Object.values(criteres);
  const globale = valeurs.length ? Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length) : 0;
  const aRenforcer = Object.entries(criteres)
    .filter(([, v]) => v < SEUIL_A_RENFORCER)
    .sort((x, y) => x[1] - y[1])
    .map(([id]) => id);
  return { globale, criteres, aRenforcer, phrasesDenses: denses };
}
