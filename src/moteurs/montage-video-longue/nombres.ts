/**
 * NOMBRES ÉCRITS DANS UN TEXTE (lot QUALL-2) : seuls les nombres RÉELLEMENT présents dans la phrase deviennent des
 * chiffres à l'écran (jamais un chiffre inventé). Chiffres (« 12 », « 1 200 », « 12,5 % ») et lettres (« douze »,
 * « quatre-vingt-dix-neuf », « trois mille cinq cents »). « un » / « une » (articles), les ordinaux, « dizaine » et
 * « moitié » (approximations) sont exclus.
 * PUR, aucun import : lu aussi par la composition Remotion (chemins relatifs seulement).
 */

export interface NombreEcrit {
  /** Le nombre tel qu'écrit dans le texte (unité de symbole comprise : « 12,5 % »). */
  ecrit: string;
  valeur: number;
  /** Ce que l'écran affiche : chiffres français (« 12 », « 1 200 », « 12,5 % »). */
  affiche: string;
  /** Position dans le texte (début inclus, fin exclue). */
  debut: number;
  fin: number;
}

const UNITES: Record<string, number> = { zéro: 0, zero: 0, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9 };
const ADOS: Record<string, number> = { onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 };
const DIZAINES: Record<string, number> = { vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
const ECHELLES: Record<string, number> = { mille: 1e3, million: 1e6, milliard: 1e9 };
const UN = new Set(["un", "une"]);

interface Jeton {
  t: string;
  debut: number;
  fin: number;
}

/** Forme canonique d'un mot-nombre (pluriels ramenés au singulier). */
function canon(p: string): string {
  const m = p.toLowerCase();
  if (m === "vingts") return "vingt";
  if (m === "cents") return "cent";
  if (m === "millions") return "million";
  if (m === "milliards") return "milliard";
  return m;
}

/** Découpe le texte en segments de jetons consécutifs (séparés par un espace ou un trait d'union seulement). */
function segments(texte: string): Jeton[][] {
  const res: Jeton[][] = [];
  let courant: Jeton[] = [];
  let finPrecedent = -1;
  const mots = /\p{L}+(?:-\p{L}+)*/gu;
  for (let m = mots.exec(texte); m; m = mots.exec(texte)) {
    const lie = finPrecedent >= 0 && /^[   ]+$/.test(texte.slice(finPrecedent, m.index));
    if (!lie && courant.length) {
      res.push(courant);
      courant = [];
    }
    let pos = m.index;
    // « Deux-Sèvres » : nom propre à trait d'union (majuscule après le trait), jamais un nombre.
    if (/-\p{Lu}/u.test(m[0])) {
      courant.push({ t: "#nom", debut: pos, fin: pos + m[0].length });
      finPrecedent = m.index + m[0].length;
      continue;
    }
    for (const part of m[0].split("-")) {
      courant.push({ t: canon(part), debut: pos, fin: pos + part.length });
      pos += part.length + 1;
    }
    finPrecedent = m.index + m[0].length;
  }
  if (courant.length) res.push(courant);
  return res;
}

/** Dizaine, unité ou « ado » qui suit une dizaine ou une centaine : { v, n } ou null. */
function suiteDizaine(tok: Jeton[], j: number, base: number): { v: number; n: number } | null {
  const t = tok[j]?.t;
  if (!t) return null;
  if (base >= 20) {
    if (t === "et" && tok[j + 1] && (UN.has(tok[j + 1].t) || (base === 60 && tok[j + 1].t === "onze"))) return { v: UN.has(tok[j + 1].t) ? 1 : 11, n: 2 };
    if (UN.has(t)) return { v: 1, n: 1 };
    if (UNITES[t] >= 2) return { v: UNITES[t], n: 1 };
    if (base === 60 || base === 80) {
      const ado = ados(tok, j);
      if (ado) return ado;
    }
    return null;
  }
  // après une centaine
  if (UN.has(t)) return { v: 1, n: 1 };
  return null;
}

/** 10 à 19 (« dix », « dix-sept », « onze »…). */
function ados(tok: Jeton[], j: number): { v: number; n: number } | null {
  const t = tok[j]?.t;
  if (!t) return null;
  if (t === "dix") {
    const s = tok[j + 1]?.t;
    if (s === "sept" || s === "huit" || s === "neuf") return { v: 10 + UNITES[s], n: 2 };
    return { v: 10, n: 1 };
  }
  if (ADOS[t]) return { v: ADOS[t], n: 1 };
  return null;
}

/** Un groupe de moins de 1 000. */
function groupe(tok: Jeton[], i: number): { v: number; n: number } | null {
  const t0 = tok[i]?.t;
  if (!t0) return null;
  if (t0 === "zéro" || t0 === "zero") return { v: 0, n: 1 };
  let v = 0;
  let n = 0;
  if (UNITES[t0] >= 2 && tok[i + 1]?.t === "cent") {
    v = UNITES[t0] * 100;
    n = 2;
  } else if (t0 === "cent") {
    v = 100;
    n = 1;
  }
  const apresCent = n > 0;
  const j = i + n;
  const t = tok[j]?.t;
  if (t) {
    let base = 0;
    let nb = 0;
    if (t === "quatre" && tok[j + 1]?.t === "vingt") {
      base = 80;
      nb = 2;
    } else if (DIZAINES[t]) {
      base = DIZAINES[t];
      nb = 1;
    }
    if (base) {
      v += base;
      n += nb;
      const s = suiteDizaine(tok, i + n, base);
      if (s) {
        v += s.v;
        n += s.n;
      }
    } else if (apresCent) {
      const s = suiteDizaine(tok, j, 0);
      const ado = ados(tok, j);
      const un = s ?? ado ?? (UNITES[t] >= 2 ? { v: UNITES[t], n: 1 } : null);
      if (un) {
        v += un.v;
        n += un.n;
      }
    } else {
      const ado = ados(tok, j);
      if (ado) return { v: ado.v, n: ado.n };
      if (UNITES[t] >= 2) return { v: UNITES[t], n: 1 };
    }
  }
  return n > 0 ? { v, n } : null;
}

/** Un nombre complet (avec mille, million, milliard) à partir du jeton i. */
function nombre(tok: Jeton[], i: number): { v: number; n: number } | null {
  let total = 0;
  let k = i;
  let derniere = Infinity;
  for (;;) {
    const g = groupe(tok, k);
    const suivant = g ? tok[k + g.n]?.t : tok[k]?.t;
    const echelle = suivant ? ECHELLES[suivant] : undefined;
    if (echelle && echelle < derniere) {
      if (g) {
        total += g.v * echelle;
        k += g.n + 1;
        derniere = echelle;
        continue;
      }
      if (echelle === 1e3) {
        total += 1e3;
        k += 1;
        derniere = 1e3;
        continue;
      }
      break;
    }
    if (g) {
      total += g.v;
      k += g.n;
    }
    break;
  }
  return k > i ? { v: total, n: k - i } : null;
}

/** Groupe les milliers par une espace : 1200 → « 1 200 » ; 12,5 → « 12,5 ». */
export function formaterNombre(valeur: number): string {
  const [ent, dec] = String(valeur).split(".");
  const groupe3 = ent.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${groupe3},${dec}` : groupe3;
}

const AVANT_NEUF_OK = new Set(["les", "ces", "ses", "nos", "vos", "leurs", "mes", "tes", "ou", "et", "de", "d", "environ", "plus", "moins", "près", "tous", "toutes", "quelque", "à", "a", "en", "sur", "par", "pour", "depuis", "dans", "avec", "sans", "vers", "jusqu"]);

/** Contextes où le nombre n'est pas une quantité (« tous les deux », « neuf » = nouveau). */
function exclu(texte: string, debut: number, fin: number, valeur: number): boolean {
  const avant = texte.slice(0, debut);
  if (/(?:tous|toutes)\s+(?:les|ces)\s*$/i.test(avant)) return true;
  // « pour cent » : « cent » est l'unité %, jamais un 100 (le nombre qui précède porte le %).
  if (valeur === 100 && /^cent$/i.test(texte.slice(debut, fin)) && /\bpour\s+$/i.test(avant)) return true;
  // « mille fois merci » : une formule, pas une quantité.
  if (valeur === 1000 && /^mille$/i.test(texte.slice(debut, fin)) && /^\s+fois\b/i.test(texte.slice(fin))) return true;
  if (valeur === 9 && /^neuf$/i.test(texte.slice(debut, fin))) {
    const m = /(\p{L}+)['’]?\s*$/u.exec(avant);
    if (m && !AVANT_NEUF_OK.has(m[1].toLowerCase())) return true;
  }
  return false;
}

const RE_CHIFFRES = /(?<![\p{L}\d,.])((?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[,.]\d+)?)(?![,.]?\d)(\s?(?:%|€|h|min|s)(?![\p{L}\d'’]))?/gu;
/** « 10h30 », « 10 h 30 » : une heure, lue d'un bloc (jamais « 10 » seul). */
const RE_HEURE = /(?<![\p{L}\d,.])([01]?\d|2[0-3])\s?h\s?([0-5]\d)(?![\p{L}\d])/gu;
/** Ordinaux collés au chiffre : « 3e », « 2nd », « 1er », « 2ème », « 1re ». */
const RE_ORDINAL = /^(?:er|ers|re|res|ère|ères|e|es|ème|èmes|eme|emes|nd|nde|nds|ndes)(?![\p{L}\d])/iu;
/** « pour cent » / « pourcent » juste après un nombre. */
const RE_POUR_CENT = /^\s+pour\s?cent(?![\p{L}\d])/iu;

/** Tous les nombres écrits du texte, dans l'ordre. Rien d'autre n'est jamais compté. */
export function nombresEcrits(texte: string): NombreEcrit[] {
  const res: NombreEcrit[] = [];
  const pris: [number, number][] = [];
  const dejaPris = (d: number, f: number) => pris.some(([a, b]) => d < b && f > a);
  for (let m = RE_HEURE.exec(texte); m; m = RE_HEURE.exec(texte)) {
    const fin = m.index + m[0].length;
    pris.push([m.index, fin]);
    res.push({ ecrit: m[0], valeur: parseInt(m[1], 10) + parseInt(m[2], 10) / 60, affiche: `${parseInt(m[1], 10)} h ${m[2]}`, debut: m.index, fin });
  }
  for (let m = RE_CHIFFRES.exec(texte); m; m = RE_CHIFFRES.exec(texte)) {
    const fin0 = m.index + m[0].length;
    if (dejaPris(m.index, fin0)) continue;
    // « 1.200 » (trois décimales après un point) : séparateur de milliers ambigu, on ne devine pas.
    if (/\.\d{3}$/.test(m[1])) continue;
    const valeur = parseFloat(m[1].replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
    if (!Number.isFinite(valeur)) continue;
    if (!m[2] && RE_ORDINAL.test(texte.slice(fin0))) continue;
    let fin = fin0;
    let affiche = m[0].replace(/[\u00a0\u202f]/g, " ").replace(/^([\d ]+)\.(\d+)/, "$1,$2");
    const pc = !m[2] ? RE_POUR_CENT.exec(texte.slice(fin0)) : null;
    if (pc) {
      fin = fin0 + pc[0].length;
      affiche = `${affiche} %`;
    }
    if (exclu(texte, m.index, fin0, valeur)) continue;
    res.push({ ecrit: texte.slice(m.index, fin), valeur, affiche, debut: m.index, fin });
  }
  for (const seg of segments(texte)) {
    let i = 0;
    while (i < seg.length) {
      const r = nombre(seg, i);
      if (!r) {
        i++;
        continue;
      }
      const debut = seg[i].debut;
      let fin = seg[i + r.n - 1].fin;
      let n = r.n;
      let affiche = formaterNombre(r.v);
      // « cinq pour cent » : un seul nombre (5), unité %, le « cent » n'est jamais lu comme 100.
      const apres = seg[i + n]?.t;
      if (apres === "pourcent") {
        fin = seg[i + n].fin;
        n += 1;
        affiche += " %";
      } else if (apres === "pour" && seg[i + n + 1]?.t === "cent") {
        fin = seg[i + n + 1].fin;
        n += 2;
        affiche += " %";
      }
      else if (/^\s?%/.test(texte.slice(fin))) {
        fin += /^\s?%/.exec(texte.slice(fin))![0].length;
        affiche += " %";
      }
      // « cent pour cent » : une formule, jamais un 100 affiché.
      const formule = r.v === 100 && n > r.n;
      if (!formule && !exclu(texte, debut, seg[i + r.n - 1].fin, r.v) && !dejaPris(debut, fin)) res.push({ ecrit: texte.slice(debut, fin), valeur: r.v, affiche, debut, fin });
      i += n;
    }
  }
  const tries = res.sort((a, b) => a.debut - b.debut);
  // « deux ou trois » : une approximation, aucun des deux n'est affiché.
  const retires = new Set<number>();
  for (let k = 0; k + 1 < tries.length; k++) {
    if (/^\s+ou\s+$/i.test(texte.slice(tries[k].fin, tries[k + 1].debut))) {
      retires.add(k);
      retires.add(k + 1);
    }
  }
  return tries.filter((_, k) => !retires.has(k));
}

const MOTS_ARRET_UNITE = new Set(["qui", "que", "qu", "de", "d", "du", "des", "pour", "à", "au", "aux", "et", "ou", "mais", "dans", "sur", "avec", "par", "en", "est", "sont", "a", "ont"]);

/** 1 à 3 mots qui suivent le nombre (« mois », « articles »), jusqu'à une ponctuation ou un mot de liaison ; "" sinon. */
export function uniteApres(texte: string, fin: number): string {
  const reste = texte.slice(fin);
  const mots: string[] = [];
  const re = /^\s+([^\s]+)/;
  let tail = reste;
  for (let m = re.exec(tail); m && mots.length < 3; m = re.exec(tail)) {
    tail = tail.slice(m[0].length);
    const brut = m[1];
    const net = brut.replace(/[.,;:!?…»)"”]+$/u, "");
    if (!net || /^\d/.test(net) || MOTS_ARRET_UNITE.has(net.toLowerCase().replace(/['’].*$/, ""))) break;
    if (/^[^\p{L}]/u.test(net)) break;
    mots.push(net);
    if (net !== brut) break;
  }
  return mots.join(" ");
}
