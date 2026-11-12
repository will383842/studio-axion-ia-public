/**
 * L3-14 : ROTATION DES MOTS-DIÈSE (PUR). Trois posts successifs n'ont jamais le même ensemble : le nouvel ensemble
 * diffère des deux précédents. Aucune horloge ni aléa caché : `aleat` (suite dans [0, 1[) et `date` sont passés.
 * La limite du réseau vient du relevé L8-01 ; sans source (« inconnu » ou absente), la rotation est bloquée.
 */
import type { IdReseau } from "@/domaine/types";
import { cleMotDiese, estInterdit } from "@/reseaux/hashtags";

export type LimiteMots = number | "inconnu";
export type LimitesMots = Partial<Record<IdReseau, LimiteMots>>;

export interface EntreeRotation {
  reseau: IdReseau;
  /** Famille du réseau (graphie à publier). */
  famille: readonly string[];
  /** Ensembles des posts précédents, du plus ancien au plus récent ; seuls les deux derniers comptent. */
  precedents: readonly (readonly string[])[];
  limites: LimitesMots;
  /** Taille voulue ; plafonnée par la limite et la famille. Défaut : la limite. */
  taille?: number;
  aleat: () => number;
  date: string;
}

export type ResultatRotation =
  | { ok: true; ensemble: string[]; date: string }
  | { ok: false; raison: "limite-inconnue" | "famille-trop-petite" };

const cleEnsemble = (l: readonly string[]): string => l.map(cleMotDiese).sort().join("|");

/** Mélange de Fisher-Yates sur une copie. */
function melanger<T>(liste: readonly T[], aleat: () => number): T[] {
  const t = [...liste];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(aleat() * (i + 1)));
    [t[i], t[j]] = [t[j]!, t[i]!];
  }
  return t;
}

/** Combinaisons de `k` indices parmi `n`, dans l'ordre lexicographique. */
function* combinaisons(n: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield [...idx];
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

export function tournerMotsDieses(e: EntreeRotation): ResultatRotation {
  const limite = e.limites[e.reseau];
  if (typeof limite !== "number" || !Number.isInteger(limite) || limite < 1) return { ok: false, raison: "limite-inconnue" };

  const vus = new Set<string>();
  const famille = e.famille.filter((m) => {
    const c = cleMotDiese(m);
    if (!c || vus.has(c) || estInterdit(m)) return false;
    vus.add(c);
    return true;
  });
  const k = Math.min(e.taille ?? limite, limite, famille.length);
  if (k < 1) return { ok: false, raison: "famille-trop-petite" };

  // Trois posts de suite sans répétition exigent au moins 3 ensembles possibles.
  let nb = 1;
  for (let i = 1; i <= k && nb < 3; i++) nb = (nb * (famille.length - k + i)) / i;
  if (nb < 3) return { ok: false, raison: "famille-trop-petite" };

  const interdits = new Set(e.precedents.slice(-2).map(cleEnsemble));
  const ordre = melanger(famille, e.aleat);
  const premier = ordre.slice(0, k);
  if (!interdits.has(cleEnsemble(premier))) return { ok: true, ensemble: premier, date: e.date };

  for (const idx of combinaisons(ordre.length, k)) {
    const choix = idx.map((i) => ordre[i]!);
    if (!interdits.has(cleEnsemble(choix))) return { ok: true, ensemble: choix, date: e.date };
  }
  return { ok: false, raison: "famille-trop-petite" };
}
