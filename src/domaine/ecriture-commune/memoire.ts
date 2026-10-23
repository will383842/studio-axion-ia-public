/**
 * MÉMOIRE COMMUNE DES SCRIPTS (lot C1.2). PUR, non branché : les services lisent les scripts déjà écrits et les passent en
 * paramètre. Ce qui a déjà été dit (séquences), les charpentes de phrase trop fréquentes, le tirage « sans récents » (au lieu
 * de `g % n`) et l'anonymisation avant mémoire. RÈGLE DE FER : la mémoire anti-copie ne va JAMAIS dans la partie en cache
 * d'un prompt (elle change à chaque script et ferait perdre le cache) : `assemblerConsigne` la met dans la partie variable (et signale un bloc trouvé dans le cache).
 */
import { anonymiser } from "@/domaine/controles-script/anonymisation";
import { TAILLE_MEMOIRE, clesTolerees, moulesDe, sequencesDe, suites, type Moule, type OptionsVariete, type Sequence } from "@/domaine/ecriture-commune/ressemblance";

export { copiesDe, type OptionsVariete, type Sequence } from "@/domaine/ecriture-commune/ressemblance";

/** Versions relues au plus pour la mémoire : UNE fenêtre de 60, partagée entre tous les générateurs (jamais 60 par générateur). */
export const FENETRE_VERSIONS_MEMOIRE = 60;

/** Plafonds de la mémoire envoyée (ne pas gonfler le prix) : nombre de séquences, caractères, mots affichés par séquence. */
export const MEMOIRE_MAX_SEQUENCES = 40;
export const MEMOIRE_MAX_CARACTERES = 2400;
export const MEMOIRE_MOTS_MAX = 12;

/**
 * Ce qui a déjà été dit dans `scripts` (du plus ancien au plus récent), à ne pas redire : les plus fréquentes d'abord, puis
 * les plus longues, puis les plus récentes ; plafonné.
 */
export function memoireAntiCopie(scripts: readonly string[], options: OptionsVariete = {}): Sequence[] {
  const tolerees = clesTolerees(options.tolere ?? [], TAILLE_MEMOIRE);
  /** Dans combien de scripts chaque fenêtre qualifiée se trouve (sa fréquence). */
  const frequence = new Map<string, number>();
  for (const s of scripts) for (const c of sequencesDe(s, TAILLE_MEMOIRE)) if (!tolerees.has(c)) frequence.set(c, (frequence.get(c) ?? 0) + 1);
  const parCle = new Map<string, Sequence & { derniere: number }>();
  scripts.forEach((s, rang) => {
    for (const x of suites(s, TAILLE_MEMOIRE, tolerees)) {
      const mots = x.cle.split(" ");
      const scriptsN = Math.max(...Array.from({ length: mots.length - TAILLE_MEMOIRE + 1 }, (_, i) => frequence.get(mots.slice(i, i + TAILLE_MEMOIRE).join(" ")) ?? 1));
      const garde = parCle.get(x.cle);
      if (garde) garde.derniere = rang;
      else parCle.set(x.cle, { cle: x.cle, texte: x.texte, mots: x.mots, scripts: scriptsN, derniere: rang });
    }
  });
  const triees = [...parCle.values()].sort((a, b) => b.scripts - a.scripts || b.mots - a.mots || b.derniere - a.derniere);
  const res: Sequence[] = [];
  let caracteres = 0;
  for (const t of triees) {
    if (res.length >= MEMOIRE_MAX_SEQUENCES) break;
    const texte = affichee(t);
    if (caracteres + texte.length > MEMOIRE_MAX_CARACTERES) continue;
    caracteres += texte.length;
    res.push({ cle: t.cle, texte: t.texte, mots: t.mots, scripts: t.scripts });
  }
  return res;
}

/** Séquence montrée : au plus `MEMOIRE_MOTS_MAX` mots (la suite d'une très longue reprise n'ajoute rien). */
function affichee(s: Pick<Sequence, "texte">): string {
  const m = s.texte.split(/\s+/);
  return m.length > MEMOIRE_MOTS_MAX ? `${m.slice(0, MEMOIRE_MOTS_MAX).join(" ")} …` : s.texte;
}

/** Le bloc de la consigne : une séquence par ligne ; vide sans mémoire. */
export function blocMemoire(memoire: readonly Sequence[]): string {
  return memoire.map((s) => `- « ${affichee(s)} »`).join("\n");
}


/* ------------------------------------------------------------------ */
/* Charpentes fréquentes                                                */
/* ------------------------------------------------------------------ */

export interface MouleFrequent extends Moule {
  /** Nombre de scripts qui la portent (deux au moins). */
  scripts: number;
}

/** Charpentes de phrase présentes dans deux scripts ou plus : les plus fréquentes d'abord, plafonnées à `max`. */
export function moulesFrequents(scripts: readonly string[], max = 10): MouleFrequent[] {
  const compte = new Map<string, MouleFrequent>();
  for (const s of scripts) {
    for (const m of moulesDe(s).values()) {
      const c = compte.get(m.cle);
      if (c) c.scripts += 1;
      else compte.set(m.cle, { ...m, scripts: 1 });
    }
  }
  return [...compte.values()]
    .filter((m) => m.scripts >= 2)
    .sort((a, b) => b.scripts - a.scripts || a.cle.localeCompare(b.cle))
    .slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Tirage sans récents                                                  */
/* ------------------------------------------------------------------ */

/** Hachage FNV-1a 32 bits, maison (aucun import d'un moteur). */
function fnv(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Tire une option qui n'est PAS dans les récents (déterministe pour une graine donnée). Tout est récent : rend la moins
 * récemment utilisée (la plus ancienne des récents, qui vont du plus ancien au plus récent). Remplace `g % n`.
 */
export function tirerSansRecent<T extends string>(options: readonly T[], recents: readonly string[], graine: string): T {
  if (!options.length) throw new Error("tirerSansRecent : aucune option");
  const libres = options.filter((o) => !recents.includes(o));
  if (libres.length) return libres[fnv(graine) % libres.length];
  const dernierRang = (o: T) => recents.lastIndexOf(o);
  return [...options].sort((a, b) => dernierRang(a) - dernierRang(b))[0];
}

/* ------------------------------------------------------------------ */
/* Anonymisation et consigne                                            */
/* ------------------------------------------------------------------ */

/** Texte anonymisé avant d'entrer en mémoire : les noms sensibles deviennent une forme neutre. */
export function anonymiserPourMemoire(texte: string, nomsSensibles: readonly string[]): string {
  return anonymiser(texte, { nomsSensibles: [...nomsSensibles] }).texte;
}

/** En-tête du bloc de mémoire dans la partie variable de la consigne. */
export const ENTETE_BLOC_MEMOIRE = "À NE PAS REDIRE (déjà dit dans d'autres scripts) :";

const sansCasse = (t: string): string => t.toLowerCase().replace(/\s+/g, " ");

/**
 * Le BLOC de mémoire lui-même est-il écrit dans ce texte (partie en cache d'un prompt) ? Son en-tête, ou l'une de ses lignes
 * telle qu'elle est montrée (tronquée à `MEMOIRE_MOTS_MAX` mots). Une simple tournure partagée avec les règles fixes n'est
 * PAS un bloc : les scripts reprennent des tournures des règles.
 */
export function memoireDansLeCache(cache: string, memoire: readonly Sequence[]): boolean {
  const c = sansCasse(cache);
  if (c.includes(sansCasse("À NE PAS REDIRE (déjà dit"))) return true;
  return memoire.some((s) => c.includes(sansCasse(`- « ${affichee(s)} »`)));
}

/**
 * La consigne en deux parties : le cache (fixe) reste intact ; la mémoire s'ajoute à la partie variable. Si le cache contient
 * déjà le bloc de mémoire, rend un `avertissement` (le cache perdrait son efficacité) mais ne lève pas et continue.
 */
export function assemblerConsigne(entree: { cache: string; variable: string; memoire: readonly Sequence[] }): { cache: string; variable: string; avertissement?: string } {
  const bloc = blocMemoire(entree.memoire);
  const avertissement = memoireDansLeCache(entree.cache, entree.memoire)
    ? "Le bloc de mémoire anti-copie est écrit dans la partie en cache du prompt : il change à chaque script et fait perdre le cache. Il est quand même ajouté à la partie variable."
    : undefined;
  const res = { cache: entree.cache, variable: bloc ? `${entree.variable}\n\n${ENTETE_BLOC_MEMOIRE}\n${bloc}` : entree.variable };
  return avertissement ? { ...res, avertissement } : res;
}
