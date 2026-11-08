/**
 * VOIX RANGÉE PHRASE PAR PHRASE (lot E, PUR). Chaque phrase du texte dit a SA prise ; son empreinte est celle de la
 * brique `empreintePriseVoix` (texte + voix + vitesse + règles de blancs, et `essai` pour une nouvelle lecture), pas une
 * copie. Conséquences :
 *  - une phrase déjà rangée sous la même empreinte n'est jamais relue ;
 *  - changer un mot ne fait relire que la phrase qui le contient ;
 *  - « Refaire la phrase » = un essai de plus POUR CETTE PHRASE seule ; les autres gardent leur prise et l'ancienne prise
 *    reste dans le stockage (`parente` la désigne : version parente, rien n'est jamais écrasé).
 * Aucun accès son, base ni réseau : le stockage, la lecture et l'assemblage sont posés par l'appelant.
 */
import type { ReglesNettoyage } from "@/briques/voix-maitre/nettoyage";
import { ponctuerPhrase } from "@/domaine/voix-phrases";
import type { MotHorodate, ReglagesVoix } from "@/domaine/types";
import type { MorceauAssemblage } from "./outils";
import { empreintePriseVoix, phrasesDe } from "./voix";

/** La voix qui lit : celle de Williams (épinglée), ses réglages (dont la vitesse), les règles de blancs. */
export interface ContextePhrases {
  fournisseurVoix?: string;
  idVoix: string;
  reglages?: ReglagesVoix;
  regles: ReglesNettoyage;
}

/** Une prise rangée : le son d'UNE phrase. */
export interface PriseRangee {
  texte: string;
  fichierCle: string;
  dureeSec: number;
  mots: readonly MotHorodate[];
}

/** Le stockage : empreinte → prise. Jamais écrasé : une nouvelle prise s'ajoute. */
export type StockPrises = Readonly<Record<string, PriseRangee>>;

/** Une phrase du plan : sa prise est gardée (déjà rangée) ou à lire. */
export interface PhrasePlanifiee {
  index: number;
  texte: string;
  empreinte: string;
  essai: number;
  etat: "gardee" | "a-lire";
  /** Empreinte de la prise de l'essai d'avant (version parente), sinon absente. */
  parente?: string;
}

/** Les phrases d'un texte dit, chacune avec sa ponctuation finale. */
export function decouperEnPhrases(texte: string): string[] {
  return phrasesDe(texte).map(ponctuerPhrase).filter(Boolean);
}

function empreinteDe(texte: string, ctx: ContextePhrases, essai: number): string {
  return empreintePriseVoix({ texte, ...(ctx.fournisseurVoix ? { fournisseurVoix: ctx.fournisseurVoix } : {}), idVoix: ctx.idVoix, ...(ctx.reglages ? { reglages: ctx.reglages } : {}), regles: ctx.regles, ...(essai > 1 ? { essai } : {}) });
}

/** Le plan des prises du texte : une entrée par phrase, `essais` donnant l'essai courant des phrases refaites (index → n). */
export function planDesPrises(texte: string, ctx: ContextePhrases, stock: StockPrises, essais: Readonly<Record<number, number>> = {}): PhrasePlanifiee[] {
  return decouperEnPhrases(texte).map((t, index) => {
    const essai = Math.max(1, essais[index] ?? 1);
    const empreinte = empreinteDe(t, ctx, essai);
    return { index, texte: t, empreinte, essai, etat: stock[empreinte] ? "gardee" : "a-lire", ...(essai > 1 ? { parente: empreinteDe(t, ctx, essai - 1) } : {}) };
  });
}

/** Ajoute une prise au stockage (copie ; l'existant n'est jamais modifié). */
export function rangerPrise(stock: StockPrises, empreinte: string, prise: PriseRangee): StockPrises {
  return { ...stock, [empreinte]: prise };
}

/**
 * « Refaire la phrase » : un essai de plus pour la phrase `index` SEULE. Rend le nouveau plan et les essais à garder ; les
 * autres phrases gardent leur empreinte, donc leur prise.
 */
export function refaireUnePhrase(texte: string, ctx: ContextePhrases, stock: StockPrises, essais: Readonly<Record<number, number>>, index: number): { plan: PhrasePlanifiee[]; essais: Record<number, number> } {
  const nb = decouperEnPhrases(texte).length;
  if (!Number.isInteger(index) || index < 0 || index >= nb) throw new Error(`Cette phrase n'existe pas : le texte en compte ${nb}.`);
  const neufs = { ...essais, [index]: Math.max(1, essais[index] ?? 1) + 1 };
  return { plan: planDesPrises(texte, ctx, stock, neufs), essais: neufs };
}

/** Les morceaux du corps à assembler : le son entier de chaque phrase, dans l'ordre (toutes doivent être rangées). */
export function morceauxDuCorps(plan: readonly PhrasePlanifiee[], stock: StockPrises): MorceauAssemblage[] {
  return plan.map((p) => {
    const prise = stock[p.empreinte];
    if (!prise) throw new Error(`La phrase ${p.index + 1} n'est pas encore lue : l'assemblage attend sa prise.`);
    return { entree: prise.fichierCle, deSec: 0, aSec: prise.dureeSec };
  });
}
