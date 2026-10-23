/**
 * FIDÉLITÉ DU TEXTE ÉCRIT AU TEXTE DIT (vidéo d'essai v-667edcd8e3a8, jugée « catastrophe » le 15/10/2026). PUR.
 *
 *  - `sansTitreRepete` : la phrase d'une étape ne reprend pas son titre (« Faites rédiger » puis « les réponses aux
 *    mails répétitifs. », jamais « Faites rédiger / Faites rédiger les réponses… ») ;
 *  - `sansEtiquette` : le texte d'un « avant » ou d'un « maintenant » ne répète pas son étiquette (« Avant / Avant,
 *    chaque mail… ») ;
 *  - `chiffresRetires` : un chiffre que la voix dit mais que l'écran a retiré, en laissant une phrase tronquée ou
 *    fausse (« dix minutes » devenu « des minutes », « Trois tâches » devenu « Tâches ») ;
 *  - `retablirChiffres` : sur un exemple illustratif (mention visible), le chiffre dit est écrit en chiffres
 *    (« 10 minutes »), même quand l'écrit n'en garde rien (« …et l'envoie : trois minutes. » dit, « …et l'envoie. »
 *    écrit → « …et l'envoie : 3 minutes. », critique #291) ;
 *  - `decomptesRetires` : un DÉCOMPTE annoncé (« Trois réflexes… », « 3 étapes ») n'est pas un chiffre à sourcer : il
 *    reste écrit, jamais « Les réflexes… » (vidéo v-b2d772d28b97, 17/10/2026).
 */
import { cleMot } from "./fiche";

/** Nombres dits en lettres (« un » et « une » exclus : ce sont presque toujours des articles). */
const NOMBRES: Readonly<Record<string, number>> = {
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
  quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000,
};

/** Les mots d'un texte, tels qu'écrits, et leur clé (minuscules, sans accent ni ponctuation). */
function motsDe(texte: string): { brut: string; cle: string; debut: number; fin: number }[] {
  const res: { brut: string; cle: string; debut: number; fin: number }[] = [];
  const re = /[\p{L}\p{N}’'-]+/gu;
  for (let m = re.exec(texte); m; m = re.exec(texte)) res.push({ brut: m[0], cle: cleMot(m[0]), debut: m.index, fin: m.index + m[0].length });
  return res.filter((x) => x.cle);
}

/** Valeur d'un mot nombre (« dix » → 10, « 10 » → 10) ; `undefined` sinon. */
export function valeurNombre(mot: string): number | undefined {
  const c = cleMot(mot);
  if (/^\d+$/.test(c)) return Number(c);
  return NOMBRES[c];
}

const LETTRES_NOMBRE: Readonly<Record<string, number>> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100, mille: 1000,
};
const DIZAINES = new Set([20, 30, 40, 50, 60, 80]);

/** Valeur d'un nombre dit en lettres, simple ou composé (« vingt-deux » 22, « soixante et onze » 71, « quatre-vingt-dix » 90, « deux cents » 200) ; `undefined` sinon. */
export function valeurEnLettres(texte: string): number | undefined {
  const ms = texte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let groupe = 0;
  let dernier = -1;
  let lu = false;
  for (let i = 0; i < ms.length; i++) {
    if (ms[i] === "et" && lu && ["un", "une", "onze"].includes(ms[i + 1] ?? "")) continue;
    const v = LETTRES_NOMBRE[ms[i]];
    if (v === undefined) return undefined;
    if (v === 1000) {
      total += (groupe || 1) * 1000;
      groupe = 0;
      dernier = -1;
    } else if (v === 100) {
      if (groupe >= 10) return undefined;
      groupe = (groupe || 1) * 100;
      dernier = -1;
    } else if (v === 20 && dernier === 4 && groupe % 100 === 4) {
      groupe += 76;
      dernier = 80;
    } else if (dernier === -1 || (DIZAINES.has(dernier) && v < 20) || (dernier === 10 && v >= 7 && v <= 9)) {
      groupe += v;
      dernier = v;
    } else return undefined;
    lu = true;
  }
  return lu ? total + groupe : undefined;
}

/** Nombres dits EN LETTRES (simples ou composés, mots voisins sans ponctuation), en chiffres : « vingt-deux heures » → {"22"}. « un » et « une » seuls exclus (articles). */
export function nombresDits(dit: string): Set<string> {
  const d = motsDe(dit);
  const res = new Set<string>();
  for (let i = 0; i < d.length; i++) {
    if (/^\d+$/.test(d[i].cle) || d[i].cle === "un" || d[i].cle === "une") continue;
    for (let j = Math.min(d.length, i + 8); j > i; j--) {
      let colle = true;
      for (let k = i; k < j - 1; k++) if (/\S/u.test(dit.slice(d[k].fin, d[k + 1].debut))) colle = false;
      if (!colle) continue;
      const v = valeurEnLettres(dit.slice(d[i].debut, d[j - 1].fin));
      if (v !== undefined) {
        res.add(String(v));
        i = j - 1; // le nombre est lu en entier : sa fin n'est pas relue comme un autre nombre
        break;
      }
    }
  }
  return res;
}

/**
 * La phrase sans le titre qu'elle répète au début (mots comparés sans accent ni casse) ; le texte d'origine s'il ne le
 * répète pas ; `null` si la phrase n'est que le titre.
 */
export function sansTitreRepete(phrase: string, titre: string): string | null {
  const t = motsDe(titre);
  const p = motsDe(phrase);
  if (!t.length || p.length < t.length || !t.every((m, i) => m.cle === p[i].cle)) return phrase;
  const reste = phrase.slice(p[t.length - 1].fin).replace(/^[\s,:;–—-]+/u, "").trim();
  return /[\p{L}\p{N}]/u.test(reste) ? reste : null;
}

const ETIQUETTES = { avant: ["avant", "auparavant"], apres: ["maintenant", "apres", "desormais", "aujourd'hui", "aujourdhui"] } as const;

/** Le texte d'un « avant » ou d'un « après » sans son étiquette répétée au début (majuscule remise). */
export function sansEtiquette(texte: string, sorte: "avant" | "apres"): string {
  const m = /^\s*([\p{L}’']+)\s*[,:]?\s*/u.exec(texte);
  if (!m || !(ETIQUETTES[sorte] as readonly string[]).includes(cleMot(m[1]))) return texte;
  const reste = texte.slice(m[0].length).trim();
  if (!/[\p{L}\p{N}]/u.test(reste)) return texte;
  return reste.charAt(0).toUpperCase() + reste.slice(1);
}

/** Un chiffre dit que l'écrit a retiré. */
export interface ChiffreRetire {
  /** Le nombre tel que dit (« dix », « Trois »). */
  dit: string;
  valeur: number;
  /** Le mot qui le suit dans la voix et dans l'écrit (« minutes », « tâches »). */
  mot: string;
  /**
   * Ce que l'écrit en a fait : « des minutes » (`remplace`), « Tâches » (`absent`), ou rien du tout, ni le nombre ni le
   * mot qui le suit (`oublie` : « …et l'envoie : trois minutes. » écrit « …et l'envoie. »).
   */
  forme: "remplace" | "absent" | "oublie";
  /** Position, dans l'écrit, du mot remplaçant (`remplace`), du mot suivant (`absent`), de la fin du texte (`oublie`) : [début, fin[. */
  debut: number;
  fin: number;
}

/**
 * Mots qui remplacent à tort un nombre dit (« des minutes » pour « dix minutes », « quelques minutes ») : la phrase dit
 * alors autre chose que la voix. « Les tâches » (article défini) est la bonne reformulation sans quantité.
 */
const REMPLACANTS = new Set(["des", "quelques", "plusieurs"]);

/**
 * Chiffres que la voix dit et que l'écrit retire. Un nombre dit (« dix minutes gagnées ») est cherché dans l'écrit par
 * les deux mots qui le suivent (« minutes gagnées ») ; s'ils y sont et que le nombre n'est pas juste devant (ni en
 * chiffres ni en lettres), il a été retiré.
 */
export function chiffresRetires(ecrit: string, dit: string, options: { oublies?: boolean } = {}): ChiffreRetire[] {
  const d = motsDe(dit);
  const e = motsDe(ecrit);
  const res: ChiffreRetire[] = [];
  /** Mots de l'écrit déjà rapprochés d'un nombre dit (un seul nombre par mot). */
  const pris = new Set<number>();
  const ecrits = new Set(e.map((x) => valeurNombre(x.brut)).filter((v): v is number => v !== undefined));
  for (let i = 0; i + 1 < d.length; i++) {
    const valeur = valeurNombre(d[i].brut);
    // Un nombre suivi d'une ponctuation (« Deux. Classez… », « Étape un : ») est un numéro dit, pas une quantité.
    if (valeur === undefined || /[^\s]/u.test(dit.slice(d[i].fin, d[i + 1].debut))) continue;
    const suite = d.slice(i + 1, i + 3).map((x) => x.cle);
    const avantRecherche = res.length + pris.size;
    for (let j = 0; j < e.length; j++) {
      // Le mot d'après doit suivre aussi dans l'écrit, sauf quand l'écrit (ou sa phrase) s'arrête là.
      const finEcrite = !e[j + 1] || /[.!?;:,]/u.test(ecrit.slice(e[j].fin, e[j + 1].debut));
      if (pris.has(j) || e[j].cle !== suite[0] || (suite[1] && !finEcrite && e[j + 1].cle !== suite[1])) continue;
      pris.add(j);
      const avant = e[j - 1];
      if (avant && valeurNombre(avant.brut) === valeur) continue;
      if (avant && REMPLACANTS.has(avant.cle)) res.push({ dit: d[i].brut, valeur, mot: e[j].brut, forme: "remplace", debut: avant.debut, fin: avant.fin });
      else if (!avant || /[.!?:;]\s*$/u.test(ecrit.slice(0, e[j].debut))) res.push({ dit: d[i].brut, valeur, mot: e[j].brut, forme: "absent", debut: e[j].debut, fin: e[j].fin });
      break;
    }
    // Ni le nombre ni le mot qui le suit ne sont écrits (« trois minutes » dit en fin de phrase) : un oubli, que
    // `retablirChiffres` écrit à la fin du texte (critique #291, B2).
    // Seule une MESURE (durée, somme, part : « trois minutes », « dix euros ») s'écrit ainsi ; « testé trois fois » non.
    if (options.oublies && res.length + pris.size === avantRecherche && !ecrits.has(valeur) && UNITES.has(d[i + 1].cle)) {
      res.push({ dit: d[i].brut, valeur, mot: d[i + 1].brut, forme: "oublie", debut: ecrit.length, fin: ecrit.length });
      ecrits.add(valeur);
    }
  }
  return res;
}

/** Unités d'une mesure dite (clés : minuscules, sans accent) : un oubli de l'écrit ne se rétablit que pour elles. */
const UNITES = new Set(["seconde", "secondes", "minute", "minutes", "heure", "heures", "jour", "jours", "semaine", "semaines", "mois", "an", "ans", "annee", "annees", "euro", "euros"]);

/**
 * Les nombres que la voix dit comme des QUANTITÉS (« dix minutes », « trois relances »), dans l'ordre : un nombre suivi
 * d'une ponctuation (« Deux. Classez… », « Étape un : ») est un numéro dit, pas une quantité.
 */
export function chiffresDits(dit: string): number[] {
  const d = motsDe(dit);
  const res: number[] = [];
  for (let i = 0; i + 1 < d.length; i++) {
    const v = valeurNombre(d[i].brut);
    if (v !== undefined && !/[^\s]/u.test(dit.slice(d[i].fin, d[i + 1].debut))) res.push(v);
  }
  return res;
}

/**
 * L'écrit avec les chiffres dits rétablis, en chiffres (« des minutes » → « 10 minutes », « Tâches » → « 3 tâches ») ;
 * `oublies` : aussi ceux que l'écrit oublie tout à fait (sauf ceux `dejaEcrits` ailleurs sur la page), écrits à la fin.
 */
export function retablirChiffres(ecrit: string, dit: string, options: { oublies?: boolean; dejaEcrits?: ReadonlySet<number> } = {}): string {
  const r = chiffresRetires(ecrit, dit, { oublies: !!options.oublies })
    .filter((x) => x.forme !== "oublie" || !options.dejaEcrits?.has(x.valeur))
    .sort((a, b) => b.debut - a.debut);
  let t = ecrit;
  // Les oublis s'écrivent à la fin, dans l'ordre où la voix les dit, après deux-points (« …et l'envoie : 3 minutes. »).
  const oublis = r.filter((x) => x.forme === "oublie").reverse();
  if (oublis.length) {
    const fin = /[.!?…]*\s*$/u.exec(t)!;
    const corps = t.slice(0, fin.index).replace(/[\s,:;–—-]+$/u, "");
    t = `${corps}${corps ? " : " : ""}${oublis.map((x) => `${x.valeur}${x.mot ? ` ${x.mot.toLowerCase()}` : ""}`).join(", ")}${t.slice(fin.index).trim() || "."}`;
  }
  for (const x of r) {
    if (x.forme === "oublie") continue;
    if (x.forme === "remplace") t = `${t.slice(0, x.debut)}${x.valeur}${t.slice(x.fin)}`;
    else {
      const mot = t.slice(x.debut, x.fin);
      const debutPhrase = x.debut === 0 || /[.!?]\s*$/u.test(t.slice(0, x.debut));
      t = `${t.slice(0, x.debut)}${x.valeur} ${debutPhrase && /^\p{Lu}\p{Ll}/u.test(mot) ? mot.charAt(0).toLowerCase() + mot.slice(1) : mot}${t.slice(x.fin)}`;
    }
  }
  return t;
}

/** Verbes d'une demande faite au spectateur (fin de vidéo : réserver, enregistrer, écrire en commentaire…). */
const VERBES_DEMANDE = /(^|[\s«"“(])(r[ée]servez|enregistrez|[ée]crivez|commentez|abonnez|partagez|envoyez|cliquez|t[ée]l[ée]chargez|tapez|mettez|suivez|demandez)\b/iu;

/** Vrai pour une demande faite au spectateur (une fin n'en porte qu'UNE). Une question finale en est une aussi. */
export function estDemande(texte: string): boolean {
  return VERBES_DEMANDE.test(texte) || /\?\s*$/u.test(texte);
}

/**
 * Noms d'un DÉCOMPTE annoncé (« trois réflexes », « 3 étapes », « cinq erreurs ») : le nombre dit combien de parties la
 * vidéo montre, ce n'est pas une mesure ni une statistique ; il s'écrit sans source (clés sans accent).
 */
export const NOMS_DECOMPTE: ReadonlySet<string> = new Set(
  ["etape", "reflexe", "geste", "astuce", "conseil", "regle", "question", "erreur", "piege", "facon", "maniere", "methode", "habitude", "lecon", "cle", "secret", "signe", "raison"].flatMap((m) => [m, `${m}s`]),
);

/** Décomptes d'un texte écrit en chiffres (« 3 étapes »), retirés pour la règle des chiffres sourcés. */
export function sansDecomptes(texte: string): string {
  const mots = motsDe(texte);
  let t = texte;
  for (let i = mots.length - 2; i >= 0; i--) {
    if (/^\d+$/.test(mots[i].brut) && NOMS_DECOMPTE.has(mots[i + 1].cle) && !/[^\s]/u.test(texte.slice(mots[i].fin, mots[i + 1].debut))) t = `${t.slice(0, mots[i].debut)}${t.slice(mots[i].fin)}`;
  }
  return t;
}

/**
 * Décomptes que la voix annonce (« Trois réflexes pour l'envoyer… ») et que l'écrit a retirés (« Les réflexes pour
 * l'envoyer… ») : le nom du décompte est écrit, le nombre n'est pas juste devant lui.
 */
export function decomptesRetires(ecrit: string, dit: string): { dit: string; valeur: number; mot: string }[] {
  const d = motsDe(dit);
  const e = motsDe(ecrit);
  const res: { dit: string; valeur: number; mot: string }[] = [];
  const pris = new Set<number>();
  for (let i = 0; i + 1 < d.length; i++) {
    const valeur = valeurNombre(d[i].brut);
    if (valeur === undefined || !NOMS_DECOMPTE.has(d[i + 1].cle) || /[^\s]/u.test(dit.slice(d[i].fin, d[i + 1].debut))) continue;
    const j = e.findIndex((x, k) => !pris.has(k) && x.cle === d[i + 1].cle);
    if (j < 0) continue;
    pris.add(j);
    if (j > 0 && valeurNombre(e[j - 1].brut) === valeur) continue;
    res.push({ dit: d[i].brut, valeur, mot: e[j].brut });
  }
  return res;
}
