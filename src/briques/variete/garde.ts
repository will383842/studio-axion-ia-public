/**
 * Garde-fou de variété visuelle : fonction PURE. L'historique est injecté (aucun accès base, aucun appel).
 */
import {
  SEUILS_VARIETE_DEFAUT,
  type OptionsVariete,
  type RefusVariete,
  type ResultatVariete,
  type ResumeVisuel,
  type SeuilsVariete,
} from "./types";

/** Mots d'un texte : minuscules, sans accents ni ponctuation. */
function mots(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 0);
}

/** Ressemblance de deux accroches : mots communs / mots distincts au total (0 à 1). Deux accroches vides : 0. */
export function ressemblanceAccroches(a: string, b: string): number {
  const ea = new Set(mots(a));
  const eb = new Set(mots(b));
  if (ea.size === 0 || eb.size === 0) return 0;
  let communs = 0;
  for (const m of ea) if (eb.has(m)) communs++;
  return communs / (ea.size + eb.size - communs);
}

/** Part des dessins (distincts) de `nouveaux` qui figurent aussi dans `anciens`. Aucun dessin : 0. */
export function partDessinsCommuns(nouveaux: readonly string[], anciens: readonly string[]): number {
  const n = new Set(nouveaux);
  if (n.size === 0) return 0;
  const a = new Set(anciens);
  let communs = 0;
  for (const d of n) if (a.has(d)) communs++;
  return communs / n.size;
}

const pourcent = (x: number) => `${Math.round(x * 100)} %`;

/**
 * Structure conseillée : jamais une des dernières structures interdites ; parmi les autres, la moins utilisée dans
 * l'historique, puis la plus ancienne, puis l'ordre de `possibles`.
 */
export function proposerStructure(
  historique: readonly ResumeVisuel[],
  possibles: readonly string[],
  structuresInterdites: number,
): string | null {
  const interdites = new Set(historique.slice(0, structuresInterdites).map((v) => v.structure));
  let meilleure: { s: string; nb: number; dernier: number } | null = null;
  for (const s of possibles) {
    if (interdites.has(s)) continue;
    const nb = historique.filter((v) => v.structure === s).length;
    const rang = historique.findIndex((v) => v.structure === s);
    const dernier = rang === -1 ? Number.POSITIVE_INFINITY : rang; // jamais utilisée = la plus ancienne
    if (!meilleure || nb < meilleure.nb || (nb === meilleure.nb && dernier > meilleure.dernier)) {
      meilleure = { s, nb, dernier };
    }
  }
  return meilleure ? meilleure.s : null;
}

/**
 * Compare une vidéo à l'historique du même compte (les plus récentes d'abord ; seules les vidéos du même format sont
 * lues, au plus `seuils.historique`). Voir `OptionsVariete` pour les réglages et la levée.
 */
export function verifierVarieteVisuelle(
  video: ResumeVisuel,
  historiqueCompte: readonly ResumeVisuel[],
  options: OptionsVariete,
): ResultatVariete {
  const seuils: SeuilsVariete = { ...SEUILS_VARIETE_DEFAUT, ...options.seuils };
  const lisible = (s: string) => options.nomsLisibles?.[s] ?? s.replace(/-/g, " ");
  const recentes = historiqueCompte.filter((v) => v.format === video.format).slice(0, Math.max(0, seuils.historique));
  const refus: RefusVariete[] = [];

  const dernieres = recentes.slice(0, Math.max(0, seuils.structuresInterdites));
  if (dernieres.some((v) => v.structure === video.structure)) {
    refus.push({
      regle: "structure",
      message: `La structure « ${lisible(video.structure)} » a déjà servi dans l'une des ${dernieres.length} dernières vidéos du compte : choisissez-en une autre.`,
    });
  }

  let pireDessins = 0;
  let pireAccroche = 0;
  let accrocheProche = "";
  for (const v of recentes) {
    pireDessins = Math.max(pireDessins, partDessinsCommuns(video.dessins, v.dessins));
    const r = ressemblanceAccroches(video.accroche, v.accroche);
    if (r > pireAccroche) {
      pireAccroche = r;
      accrocheProche = v.accroche;
    }
  }
  if (pireDessins >= seuils.dessinsCommunsMax) {
    refus.push({
      regle: "dessins",
      message: `Les dessins se répètent : ${pourcent(pireDessins)} de ceux de cette vidéo figurent déjà dans une même vidéo récente du compte (limite ${pourcent(seuils.dessinsCommunsMax)}). Changez de dessins.`,
    });
  }
  if (pireAccroche >= seuils.accrocheProcheMax) {
    refus.push({
      regle: "accroche",
      message: `L'accroche ressemble trop à une accroche récente du compte (« ${accrocheProche} », ressemblance ${pourcent(pireAccroche)}, limite ${pourcent(seuils.accrocheProcheMax)}). Réécrivez-la.`,
    });
  }

  const motif = options.levee?.motif.trim() ?? "";
  const leve = refus.length > 0 && motif.length > 0;
  return {
    accepte: refus.length === 0 || leve,
    refus,
    leve,
    ...(leve ? { motifLevee: motif } : {}),
    proposition: proposerStructure(recentes, options.structuresPossibles, seuils.structuresInterdites),
  };
}
