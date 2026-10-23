/**
 * REPORT DES HORODATAGES (brique commune `calage`, née au moteur avocat, lot M1 ; plan B.4 « Prononciations », B.5
 * « Source de l'horodatage »). PUR. Mission H : déplacée sans changement (avocat, face caméra, coupes).
 *
 * La voix lit un texte où les prononciations sont SUBSTITUÉES (« PV » → « pé vé », « 135 € » → « cent trente-cinq
 * euros ») : ses horodatages portent sur ce texte PRONONCÉ. Les sous-titres et le découpage travaillent sur le texte
 * VALIDÉ, celui que Will a écrit. On reporte donc, mot pour mot, le temps du texte prononcé sur le texte validé :
 *   1. `preparerTexteVoix` substitue les prononciations ET garde la correspondance (mots validés ↔ mots prononcés) ;
 *   2. `reporterHorodatages` aligne les mots renvoyés par la voix (découpage du fournisseur, qui peut couper ou
 *      fusionner autrement) sur les mots prononcés, lettre à lettre, puis remonte aux mots validés.
 * Le texte de Will n'est jamais modifié : seule la voix entend la substitution.
 */
import { motsSousTitres } from "@/domaine/derivations";
import type { MotHorodate } from "@/domaine/types";

export interface SegmentTexte {
  id: string;
  texte: string;
}

/** Un mot du texte VALIDÉ, avec son segment (identité des plans, B.2). */
export interface MotValide {
  mot: string;
  segmentId: string;
  /** Rang du mot dans tout le texte. */
  index: number;
}

/** Un mot validé horodaté sur l'audio (après report). */
export interface MotReporte extends MotHorodate {
  segmentId: string;
  index: number;
}

/** Correspondance d'un groupe : mots validés [debut, fin) ↔ mots prononcés [debutPrononce, finPrononce). */
interface Groupe {
  debut: number;
  fin: number;
  debutPrononce: number;
  finPrononce: number;
}

export interface TexteVoix {
  /** Texte envoyé à la voix (prononciations substituées). */
  texte: string;
  motsValides: MotValide[];
  motsPrononces: string[];
  groupes: Groupe[];
}

/** Forme comparable d'un mot : minuscules, sans accent ni ponctuation ; quelques symboles lus en toutes lettres. */
export function normaliser(mot: string): string {
  return mot
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/€/g, "eur")
    .replace(/%/g, "pct")
    .replace(/&/g, "et")
    .replace(/[^a-z0-9]/g, "");
}

/** Les mots validés de tout le texte, dans l'ordre, rattachés à leur segment (mêmes mots que les sous-titres). */
export function motsValidesDe(segments: SegmentTexte[]): MotValide[] {
  const sortie: MotValide[] = [];
  for (const s of segments) for (const mot of motsSousTitres(s.texte)) sortie.push({ mot, segmentId: s.id, index: sortie.length });
  return sortie;
}

/**
 * Substitue les prononciations dans la suite des mots validés et garde la correspondance. Une prononciation peut
 * couvrir plusieurs mots (« 135 € ») ; la comparaison ignore la casse, les accents et la ponctuation, et la
 * ponctuation collée au dernier mot remplacé est gardée (« PV ? » → « pé vé ? ») pour que la voix l'entende.
 * Variantes (lot A1) : un mot couvre sa casse, ses accents, ses formes avec ou sans tiret / espace et son pluriel simple.
 */
export function preparerTexteVoix(segments: SegmentTexte[], prononciations: { mot: string; prononciation: string }[]): TexteVoix {
  const motsValides = motsValidesDe(segments);
  const regles = prononciations
    .map((p) => {
      const cible = motsSousTitres(p.mot).map(normaliser).filter(Boolean);
      const joint = cible.join("");
      // Variantes (lot A1, n° 6) : casse et accents (déjà dans `normaliser`), avec ou sans tiret / espace (« Axion IA »
      // = « Axion-IA » = « AxionIA »), pluriel simple (« PVs »).
      return { cible, joint, pluriel: joint.length >= 2 && /[a-z]$/.test(joint) && !/[sxz]$/.test(joint), dit: p.prononciation.split(/\s+/).filter(Boolean) };
    })
    .filter((r) => r.cible.length && r.dit.length)
    // La plus longue d'abord : « 135 € » avant « 135 ».
    .sort((a, b) => b.joint.length - a.joint.length || b.cible.length - a.cible.length);
  /**
   * Nombre de mots validés couverts par la règle à partir du mot `i` (0 : pas de correspondance) et l'élision gardée
   * devant (« l'IA » → « l'i-a »).
   */
  const couverture = (r: (typeof regles)[number], i: number): { n: number; elision: string } => {
    const premier = motsValides[i].mot;
    const elision = /^(?:[ldjnmstc]|qu|jusqu|lorsqu|puisqu)['’]/i.exec(premier)?.[0] ?? "";
    for (const prefixe of elision ? ["", elision] : [""]) {
      let concat = "";
      for (let k = 0; i + k < motsValides.length && k < r.cible.length + 3; k++) {
        concat += normaliser(k === 0 ? premier.slice(prefixe.length) : motsValides[i + k].mot);
        if (concat === r.joint || (r.pluriel && (concat === `${r.joint}s` || concat === `${r.joint}x`))) return { n: k + 1, elision: prefixe };
        if (concat.length > r.joint.length + 1 || !(r.joint.startsWith(concat) || concat.startsWith(r.joint))) break;
      }
    }
    return { n: 0, elision: "" };
  };
  const motsPrononces: string[] = [];
  const groupes: Groupe[] = [];
  let i = 0;
  while (i < motsValides.length) {
    let c = { n: 0, elision: "" };
    const regle = regles.find((r) => (c = couverture(r, i)).n > 0);
    const n = c.n;
    if (regle) {
      const dernier = motsValides[i + n - 1].mot;
      const ponctuation = /[\s ]*[?!:;,.…»]+$/.exec(dernier)?.[0] ?? "";
      const dit = [...regle.dit];
      dit[0] = c.elision + dit[0];
      dit[dit.length - 1] += ponctuation;
      groupes.push({ debut: i, fin: i + n, debutPrononce: motsPrononces.length, finPrononce: motsPrononces.length + dit.length });
      motsPrononces.push(...dit);
      i += n;
    } else {
      groupes.push({ debut: i, fin: i + 1, debutPrononce: motsPrononces.length, finPrononce: motsPrononces.length + 1 });
      motsPrononces.push(motsValides[i].mot);
      i++;
    }
  }
  return { texte: motsPrononces.join(" "), motsValides, motsPrononces, groupes };
}

/** Lettres comparables d'une suite de mots, chacune rattachée à son mot et à sa place dans le mot. */
function lettres(mots: string[]): { c: string; mot: number; rang: number; longueur: number }[] {
  const sortie: { c: string; mot: number; rang: number; longueur: number }[] = [];
  mots.forEach((m, mot) => {
    const n = normaliser(m);
    for (let rang = 0; rang < n.length; rang++) sortie.push({ c: n[rang], mot, rang, longueur: n.length });
  });
  return sortie;
}

/**
 * Alignement lettre à lettre (plus longue sous-suite commune) : pour chaque lettre de `a`, l'index de la lettre de `b`
 * qui lui correspond, ou -1. Taille du texte d'une vidéo (≤ 5 000 caractères) : quelques millions de cases au plus.
 */
function aligner(a: string[], b: string[]): Int32Array {
  const n = a.length;
  const m = b.length;
  const correspondance = new Int32Array(n).fill(-1);
  if (!n || !m) return correspondance;
  // Préfixe et suffixe identiques traités sans tableau (cas courant : textes presque identiques).
  let debut = 0;
  while (debut < n && debut < m && a[debut] === b[debut]) {
    correspondance[debut] = debut;
    debut++;
  }
  let finA = n;
  let finB = m;
  while (finA > debut && finB > debut && a[finA - 1] === b[finB - 1]) {
    finA--;
    finB--;
    correspondance[finA] = finB;
  }
  const lignes = finA - debut;
  const colonnes = finB - debut;
  if (!lignes || !colonnes) return correspondance;
  const L = new Uint16Array((lignes + 1) * (colonnes + 1));
  const w = colonnes + 1;
  for (let i = lignes - 1; i >= 0; i--) {
    for (let j = colonnes - 1; j >= 0; j--) {
      L[i * w + j] = a[debut + i] === b[debut + j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < lignes && j < colonnes) {
    if (a[debut + i] === b[debut + j]) {
      correspondance[debut + i] = debut + j;
      i++;
      j++;
    } else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) i++;
    else j++;
  }
  return correspondance;
}

/**
 * Horodatage de chaque mot PRONONCÉ à partir des mots renvoyés par la voix (qui peuvent être découpés autrement).
 * Un mot sans aucune lettre retrouvée prend le temps entre ses voisins.
 */
export function horodaterMotsPrononces(motsPrononces: string[], renvoyes: MotHorodate[]): MotHorodate[] {
  const a = lettres(motsPrononces);
  const b = lettres(renvoyes.map((m) => m.mot));
  const corr = aligner(
    a.map((x) => x.c),
    b.map((x) => x.c),
  );
  const debut = new Array<number | undefined>(motsPrononces.length);
  const fin = new Array<number | undefined>(motsPrononces.length);
  a.forEach((x, k) => {
    const j = corr[k];
    if (j < 0) return;
    const y = b[j];
    const r = renvoyes[y.mot];
    const pas = (r.finSec - r.debutSec) / Math.max(1, y.longueur);
    const t0 = r.debutSec + y.rang * pas;
    if (debut[x.mot] === undefined) debut[x.mot] = t0;
    fin[x.mot] = t0 + pas;
  });
  // Mots sans lettre retrouvée : entre la fin du précédent et le début du suivant.
  const sortie: MotHorodate[] = [];
  for (let k = 0; k < motsPrononces.length; k++) {
    let d = debut[k];
    let f = fin[k];
    if (d === undefined || f === undefined) {
      const avant = sortie[k - 1]?.finSec ?? 0;
      let apres: number | undefined;
      for (let q = k + 1; q < motsPrononces.length && apres === undefined; q++) apres = debut[q];
      d = avant;
      f = Math.max(avant, apres ?? avant);
    }
    sortie.push({ mot: motsPrononces[k], debutSec: +d.toFixed(3), finSec: +Math.max(d, f).toFixed(3) });
  }
  return sortie;
}

/**
 * Report mot pour mot sur le texte VALIDÉ : chaque groupe validé prend le temps de son groupe prononcé ; dans un
 * groupe de plusieurs mots validés (« 135 € »), le temps est partagé au prorata de la longueur des mots.
 */
export function reporterHorodatages(texte: TexteVoix, renvoyes: MotHorodate[]): MotReporte[] {
  const prononces = horodaterMotsPrononces(texte.motsPrononces, renvoyes);
  const sortie: MotReporte[] = [];
  for (const g of texte.groupes) {
    const p0 = prononces[g.debutPrononce];
    const p1 = prononces[g.finPrononce - 1];
    if (!p0 || !p1) continue;
    const valides = texte.motsValides.slice(g.debut, g.fin);
    const poids = valides.map((m) => Math.max(1, normaliser(m.mot).length));
    const total = poids.reduce((s, x) => s + x, 0);
    let t = p0.debutSec;
    valides.forEach((m, k) => {
      const part = ((p1.finSec - p0.debutSec) * poids[k]) / total;
      sortie.push({ mot: m.mot, segmentId: m.segmentId, index: m.index, debutSec: +t.toFixed(3), finSec: +(t + part).toFixed(3) });
      t += part;
    });
  }
  return sortie;
}

/** Écart moyen (ms) entre deux horodatages des mêmes mots (contrôle B.5 : HeyGen contre un alignement forcé). */
export function ecartMoyenMs(a: MotHorodate[], b: MotHorodate[]): number {
  const prononces = horodaterMotsPrononces(
    a.map((m) => m.mot),
    b,
  );
  if (!a.length) return 0;
  const somme = a.reduce((s, m, k) => s + Math.abs(m.debutSec - prononces[k].debutSec) + Math.abs(m.finSec - prononces[k].finSec), 0);
  return Math.round((somme / (2 * a.length)) * 1000);
}

/**
 * Générateur G6 : le texte DIT arrive tout prêt, segment par segment (`CommandeFabrication.texteDitParSegment`, les
 * prononciations déjà appliquées UNE fois par `appliquerPrononciations`) ; la voix le lit tel quel, sans nouvelle
 * substitution. La correspondance mots validés ↔ mots dits est retrouvée segment par segment : mots identiques
 * (forme comparable) appariés un à un, chaque suite différente entre deux appariements forme un groupe (« 135 € » ↔
 * « cent trente-cinq euros »). Même sortie que `preparerTexteVoix` : `reporterHorodatages` ne change pas.
 */
export function preparerTexteVoixDit(segments: SegmentTexte[], dits: Map<string, string> | string[]): TexteVoix {
  const motsValides = motsValidesDe(segments);
  const motsPrononces: string[] = [];
  const groupes: Groupe[] = [];
  segments.forEach((s, rang) => {
    const valides = motsValides.filter((m) => m.segmentId === s.id);
    const dit = (Array.isArray(dits) ? dits[rang] : dits.get(s.id)) ?? s.texte;
    const prononces = motsSousTitres(dit);
    const base = motsPrononces.length;
    motsPrononces.push(...prononces);
    if (!valides.length) return;
    if (!prononces.length) {
      // Rien de dit pour ce segment : ses mots se partagent un instant nul (cas limite, jamais attendu).
      groupes.push({ debut: valides[0].index, fin: valides[valides.length - 1].index + 1, debutPrononce: base, finPrononce: base });
      return;
    }
    // Plus longue sous-suite commune sur les formes comparables (mot par mot).
    const a = valides.map((m) => normaliser(m.mot));
    const b = prononces.map(normaliser);
    const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] && a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const paires: [number, number][] = [];
    for (let i = 0, j = 0; i < a.length && j < b.length; ) {
      if (a[i] && a[i] === b[j]) {
        paires.push([i, j]);
        i++;
        j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
    let i = 0;
    let j = 0;
    let enAttente: number | null = null; // début d'une suite de mots validés restés sans mot dit
    for (const [pi, pj] of [...paires, [a.length, b.length] as [number, number]]) {
      if (pi > i) {
        if (pj > j) {
          // Mots validés sans équivalent exact, avec des mots dits entre les deux appariements : un groupe (« 135 € »).
          groupes.push({ debut: valides[enAttente ?? i].index, fin: valides[pi - 1].index + 1, debutPrononce: base + j, finPrononce: base + pj });
          enAttente = null;
        } else if (groupes.length && groupes[groupes.length - 1].fin === valides[i].index && enAttente === null) {
          // Aucun mot dit : rattachés au groupe précédent.
          groupes[groupes.length - 1].fin = valides[pi - 1].index + 1;
        } else enAttente = enAttente ?? i;
      } else if (pj > j && groupes.length) {
        // Mots dits en plus (aucun mot validé) : rattachés au groupe précédent.
        groupes[groupes.length - 1].finPrononce = base + pj;
      }
      if (pi < a.length) {
        groupes.push({ debut: valides[enAttente ?? pi].index, fin: valides[pi].index + 1, debutPrononce: base + pj, finPrononce: base + pj + 1 });
        enAttente = null;
      }
      i = pi + 1;
      j = pj + 1;
    }
  });
  return { texte: motsPrononces.join(" "), motsValides, motsPrononces, groupes };
}
