/**
 * FAITS DU SCRIPT (GV2-42) : à partir des mots dits horodatés, ce que le script contient de montrable.
 * Fonction pure et déterministe : imports relatifs seulement, aucun réseau, aucune date courante.
 * Les textes des faits sont des mots dits recollés (seule la ponctuation de bord est retirée), jamais reformulés.
 */
import { familleUnite, type ElementFait, type Fait, type MotFait, type UniteFait } from "./types";

/** Les mots `premier..dernier` recollés par un espace, sans ponctuation de bord (la fin garde « ? » et « … »). */
export function recoller(mots: readonly MotFait[], premier: number, dernier: number): string {
  const suite = mots.slice(premier, dernier + 1).map((m) => m.texte).join(" ");
  return suite.replace(/^[\s«»"“”‘(]+/, "").replace(/[\s,;:.!»"”)]+$/, "");
}

const sansAccent = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Mot nettoyé pour la comparaison : minuscules, sans accent, sans ponctuation de bord (garde « % » et « € »). */
function normaliser(t: string): string {
  return sansAccent(t.toLowerCase().replace(/[’‘]/g, "'")).replace(/^[^a-z0-9%€']+/, "").replace(/[^a-z0-9%€']+$/, "");
}

const UNITES: Record<string, UniteFait> = {
  "%": "%", pourcent: "%", pourcents: "%",
  "€": "€", euro: "€", euros: "€",
  h: "h", heure: "h", heures: "h",
  min: "min", minute: "min", minutes: "min",
  s: "s", seconde: "s", secondes: "s",
  jour: "jours", jours: "jours",
  semaine: "semaines", semaines: "semaines",
  mois: "mois",
  an: "ans", ans: "ans",
  client: "clients", clients: "clients",
  fois: "fois",
};

const BASE: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  quatrevingt: 80, cent: 100, mille: 1000,
};

/** Nombre en lettres (un à mille, avec traits d'union) ; `null` si le mot n'en est pas un. */
function lettresVersNombre(t: string): number | null {
  const s = t
    .replace(/quatre-vingts?-dix/, "quatrevingtdix")
    .replace(/quatre-vingts?/, "quatrevingt")
    .replace(/soixante-dix/, "soixantedix")
    .replace(/dix-(sept|huit|neuf)/, "dix$1");
  let total = 0;
  for (const p of s.split("-")) {
    if (p === "et") continue;
    let v: number | undefined = BASE[p];
    if (p === "quatrevingtdix") v = 90;
    else if (p === "soixantedix") v = 70;
    else if (p === "dixsept") v = 17;
    else if (p === "dixhuit") v = 18;
    else if (p === "dixneuf") v = 19;
    if (v === undefined) return null;
    if ((v === 100 || v === 1000) && total > 0 && total < v) total *= v;
    else total += v;
  }
  return total;
}

const FORTS = new Set(["d'abord", "dabord", "ensuite", "enfin", "premierement", "deuxiemement", "troisiemement", "quatriemement"]);
const PREPOSITIONS_DUREE = new Set(["en", "pendant", "durant", "depuis", "sous"]);
const JOURS_SEMAINE = new Set(["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]);
const REPERES_CHAQUE = new Set([...JOURS_SEMAINE, "jour", "semaine", "mois", "an", "annee", "matin", "soir"]);
const REPERES_TOUS = new Set([...[...JOURS_SEMAINE].map((j) => `${j}s`), "jours", "mois", "matins", "soirs"]);
const NON_LIEUX = new Set(["google", "facebook", "instagram", "linkedin", "whatsapp", "sms", "ia", "internet", "tiktok", "youtube", "excel", "word", "chatgpt", "pro"]);

type Lu = { valeur: number; premier: number; finNombre: number; fin: number; unite?: UniteFait; lettres: boolean };

export function faitsDuScript(mots: readonly MotFait[]): Fait[] {
  const n = mots.length;
  if (n === 0) return [];
  const brut = mots.map((m) => m.texte);
  const nm = brut.map(normaliser);

  // Phrases : coupées à la ponctuation forte.
  const debut: number[] = new Array(n).fill(0);
  const fin: number[] = new Array(n).fill(0);
  const phrase: number[] = new Array(n).fill(0);
  {
    let d = 0;
    let id = 0;
    for (let i = 0; i < n; i++) {
      if (/[.!?…]["»”)]*$/.test((brut[i] ?? "").trim()) || i === n - 1) {
        for (let k = d; k <= i; k++) { debut[k] = d; fin[k] = i; phrase[k] = id; }
        d = i + 1;
        id++;
      }
    }
  }
  const finitParVirgule = (i: number) => /[,;]["»”)]*$/.test((brut[i] ?? "").trim());
  const finitParDeuxPoints = (i: number) => /:$/.test((brut[i] ?? "").trim());
  const majuscule = (i: number) => /^[^A-Za-zÀ-ÿ]*[A-ZÀ-ÖØ-Þ]/.test(brut[i] ?? "");
  const t = (i: number) => nm[i] ?? "";
  const suivantNonVide = (i: number) => { let k = i; while (k < n && t(k) === "") k++; return k; };
  const elementDe = (a: number, b: number): ElementFait => ({ texte: recoller(mots, a, b), surMot: a });
  /** Fin du segment qui commence en `a` : jusqu'à la virgule suivante ou la fin de phrase. */
  const finSegment = (a: number) => { let k = a; while (k < fin[a]! && !finitParVirgule(k)) k++; return k; };

  /** Lit un nombre (chiffres ou lettres) en `i`, avec son unité si elle suit dans la phrase. */
  function lireNombre(i: number, exigerUnite: boolean): Lu | null {
    if (i >= n || t(i) === "") return null;
    const f = fin[i]!;
    let valeur: number;
    let finNombre = i;
    let unite: UniteFait | undefined;
    let lettres = false;
    const m = /^(\d+(?:[.,]\d+)?)(%|€|h|min|s)?$/.exec(t(i));
    if (m) {
      let chiffres = m[1]!;
      unite = m[2] ? UNITES[m[2]] : undefined;
      while (!unite && /^\d{1,3}$/.test(chiffres) && finNombre + 1 <= f) {
        const m2 = /^(\d{3})(%|€)?$/.exec(t(finNombre + 1));
        if (!m2) break;
        chiffres += m2[1]!;
        finNombre++;
        if (m2[2]) unite = UNITES[m2[2]];
      }
      valeur = Number(chiffres.replace(",", "."));
    } else {
      const v = lettresVersNombre(t(i));
      if (v === null) return null;
      valeur = v;
      lettres = true;
    }
    let finUnite = finNombre;
    if (!unite && finNombre + 1 <= f) {
      const j = finNombre + 1;
      if (t(j) === "pour" && t(j + 1) === "cent" && j + 1 <= f) { unite = "%"; finUnite = j + 1; }
      else if (UNITES[t(j)] !== undefined) { unite = UNITES[t(j)]; finUnite = j; }
    }
    if (lettres && exigerUnite && !unite) return null;
    return { valeur, premier: i, finNombre, fin: finUnite, unite, lettres };
  }

  const resultat: Fait[] = [];
  const exclus = new Set<number>(); // premiers mots de nombres déjà portés par un autre fait

  // --- Passages « de A à B » (unités de la même famille) ---
  const horsNombre: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    if (t(i) !== "de") continue;
    const a = lireNombre(i + 1, false);
    if (!a || fin[a.premier] !== fin[i] || t(a.fin + 1) !== "a") continue;
    const b = lireNombre(a.fin + 2, true);
    if (!b || b.fin > fin[i]! || !b.unite) continue;
    const u1 = a.unite ?? b.unite;
    const f1 = familleUnite(u1);
    if (!f1 || f1 !== familleUnite(b.unite)) continue;
    resultat.push({
      type: "passage",
      mots: { premier: a.premier, dernier: b.fin },
      texte: recoller(mots, a.premier, b.fin),
      avant: { valeur: a.valeur, unite: u1, surMot: a.premier },
      apres: { valeur: b.valeur, unite: b.unite, surMot: b.premier },
    });
    horsNombre.push([a.premier, b.fin]);
    i = b.fin;
  }

  // --- Listes annoncées (« Les 4 erreurs … : a, b, c, d ») et étapes ---
  const marqueurEn = (i: number): { fin: number; fort: boolean } | null => {
    if (FORTS.has(t(i))) return { fin: i, fort: true };
    if (t(i) === "puis") return { fin: i, fort: false };
    if (t(i) === "etape" && i + 1 < n && lireNombre(i + 1, false)) return { fin: i + 1, fort: true };
    return null;
  };
  for (let d = 0; d < n; d = fin[d]! + 1) {
    const f = fin[d]!;
    let c = -1;
    for (let k = d; k < f; k++) if (finitParDeuxPoints(k)) { c = k; break; }
    if (c < 0) continue;
    let annonce: Lu | null = null;
    for (let k = d; k <= c && !annonce; k++) {
      const lu = lireNombre(k, false);
      if (lu && !(lu.lettres && lu.valeur < 2) && lu.valeur >= 2 && lu.valeur <= 6 && !lu.unite) annonce = lu;
    }
    if (!annonce) continue;
    const debutElements = suivantNonVide(c + 1);
    if (debutElements > f || marqueurEn(debutElements)) continue; // des étapes, pas une liste
    const elements: ElementFait[] = [];
    let a = debutElements;
    let dernier = debutElements;
    while (a <= f) {
      let e = finSegment(a);
      while (e > a && t(e) === "") e--;
      let debutEl = a;
      if ((t(debutEl) === "et" || t(debutEl) === "ou") && debutEl < e) debutEl++;
      elements.push(elementDe(debutEl, e));
      dernier = e;
      a = suivantNonVide(finSegment(a) + 1);
    }
    if (elements.length < 2 || elements.length > 6 || elements.length !== annonce.valeur) continue;
    resultat.push({ type: "liste", mots: { premier: d, dernier }, texte: recoller(mots, d, dernier), annonce: annonce.valeur, elements });
    exclus.add(annonce.premier);
  }

  {
    const marqueurs: Array<{ idx: number; fin: number; fort: boolean }> = [];
    for (let i = 0; i < n; i++) {
      const m = marqueurEn(i);
      if (m) { marqueurs.push({ idx: i, ...m }); i = m.fin; }
    }
    const groupes: (typeof marqueurs)[] = [];
    for (const m of marqueurs) {
      const g = groupes[groupes.length - 1];
      const dernierG = g?.[g.length - 1];
      if (g && dernierG && phrase[m.idx]! - phrase[dernierG.idx]! <= 1) g.push(m);
      else groupes.push([m]);
    }
    for (const g of groupes) {
      if (g.length < 2 || g.length > 6 || !g.some((m) => m.fort)) continue;
      const elements: ElementFait[] = [];
      let finGroupe = -1;
      let valide = true;
      g.forEach((m, k) => {
        const a = suivantNonVide(m.fin + 1);
        let e = fin[m.fin]!;
        const suivant = g[k + 1];
        if (suivant && suivant.idx - 1 < e) e = suivant.idx - 1;
        while (e >= a && (t(e) === "" || t(e) === "et" || t(e) === "ou")) e--;
        if (a > e || a >= n) valide = false;
        else { elements.push(elementDe(a, e)); finGroupe = e; }
      });
      if (!valide) continue;
      const dernierMot = Math.max(g[g.length - 1]!.fin, finGroupe);
      resultat.push({ type: "etapes", mots: { premier: g[0]!.idx, dernier: dernierMot }, texte: recoller(mots, g[0]!.idx, dernierMot), elements });
    }
  }

  // --- Nombres et durées ---
  for (let i = 0; i < n; ) {
    const lu = lireNombre(i, true);
    if (!lu) { i++; continue; }
    i = lu.fin + 1;
    if (exclus.has(lu.premier)) continue;
    if (horsNombre.some(([a, b]) => lu.premier >= a && lu.premier <= b)) continue;
    if (t(lu.premier - 1) === "etape") continue;
    if (lu.lettres && (t(lu.premier) === "un" || t(lu.premier) === "une") && lu.unite === "fois") continue;
    if (!lu.unite && Number.isInteger(lu.valeur) && lu.valeur >= 1900 && lu.valeur <= 2100) continue;
    const base = { mots: { premier: lu.premier, dernier: lu.fin }, texte: recoller(mots, lu.premier, lu.fin) };
    if (lu.unite && familleUnite(lu.unite) === "duree" && PREPOSITIONS_DUREE.has(t(lu.premier - 1))) {
      resultat.push({ type: "duree", ...base, valeur: lu.valeur, unite: lu.unite, surMot: lu.premier });
    } else {
      resultat.push({ type: "nombre", ...base, valeur: lu.valeur, ...(lu.unite ? { unite: lu.unite } : {}), surMot: lu.premier });
    }
  }
  for (let i = 0; i < n - 1; i++) {
    let dernier = -1;
    if (t(i) === "chaque" && REPERES_CHAQUE.has(t(i + 1))) dernier = i + 1;
    else if (t(i) === "tous" && t(i + 1) === "les" && REPERES_TOUS.has(t(i + 2))) dernier = i + 2;
    if (dernier < 0 || dernier > fin[i]!) continue;
    const texte = recoller(mots, i, dernier);
    resultat.push({ type: "duree", mots: { premier: i, dernier }, texte, repere: texte, surMot: dernier });
  }

  // --- Comparaisons ---
  for (let i = 0; i < n - 1; i++) {
    if (t(i) === "d'un" && t(i + 1) === "cote") {
      const a = i + 2;
      if (a > fin[i]!) continue;
      const ea = finSegment(a);
      const limite = fin[Math.min(n - 1, fin[ea]! + 1)]!;
      let j = ea + 1;
      while (j < limite && !(t(j) === "de" && t(j + 1) === "l'autre")) j++;
      if (!(t(j) === "de" && t(j + 1) === "l'autre") || j + 2 > fin[j]!) continue;
      const b = j + 2;
      const eb = finSegment(b);
      resultat.push({ type: "comparaison", mots: { premier: i, dernier: eb }, texte: recoller(mots, i, eb), gauche: elementDe(a, ea), droite: elementDe(b, eb) });
    } else if (t(i) === "contrairement" && t(i + 1) === "a") {
      const a = i + 2;
      const ea = finSegment(a);
      if (a > fin[i]! || ea >= fin[i]!) continue;
      const b = ea + 1;
      resultat.push({ type: "comparaison", mots: { premier: i, dernier: fin[i]! }, texte: recoller(mots, i, fin[i]!), gauche: elementDe(a, ea), droite: elementDe(b, fin[i]!) });
    } else if (t(i) === "difference" && t(i + 1) === "entre") {
      const a = i + 2;
      let e = a + 1;
      while (e <= fin[i]! && t(e) !== "et") e++;
      if (e > fin[i]! || e + 1 > fin[i]!) continue;
      const b = e + 1;
      const eb = finSegment(b);
      const premier = i > 0 && t(i - 1) === "la" && fin[i - 1] === fin[i] ? i - 1 : i;
      resultat.push({ type: "comparaison", mots: { premier, dernier: eb }, texte: recoller(mots, premier, eb), gauche: elementDe(a, e - 1), droite: elementDe(b, eb) });
    }
  }

  // --- Citations ---
  const citations: Array<[number, number]> = [];
  for (let i = 0; i < n - 2; i++) {
    if (t(i) !== "m'a" || !["dit", "repondu", "ecrit", "declare"].includes(t(i + 1))) continue;
    const s = suivantNonVide(i + 2);
    if (s > fin[i]! || t(s) === "que" || t(s) === "qu'") continue;
    resultat.push({ type: "citation", mots: { premier: s, dernier: fin[s]! }, texte: recoller(mots, s, fin[s]!), surMot: s });
    citations.push([s, fin[s]!]);
  }
  for (let i = 0; i < n - 1; i++) {
    if (!/^[«"“]/.test(brut[i] ?? "")) continue;
    let j = i;
    while (j < n && j < i + 60 && !/[»"”]["»”)]*[.,;:!?…]*$/.test((brut[j] ?? "").trim())) j++;
    if (j >= n || j >= i + 60 || j === i) continue;
    if (citations.some(([a, b]) => i >= a && i <= b)) continue;
    resultat.push({ type: "citation", mots: { premier: i, dernier: j }, texte: recoller(mots, i, j), surMot: i });
    i = j;
  }

  // --- Lieux (« à / au / aux / en / dans » + nom propre) ---
  for (let i = 0; i < n - 1; i++) {
    const brutNorm = (brut[i] ?? "").normalize("NFC").toLowerCase().replace(/[^a-zà-ÿ]/g, "");
    if (!(brutNorm === "à" || ["au", "aux", "en", "dans"].includes(t(i)))) continue;
    const a = i + 1;
    if (a > fin[i]! || !majuscule(a) || NON_LIEUX.has(t(a))) continue;
    let k = a;
    while (!/[,;:.!?…]["»”)]*$/.test((brut[k] ?? "").trim()) && k + 1 <= fin[i]! && majuscule(k + 1) && !NON_LIEUX.has(t(k + 1))) k++;
    resultat.push({ type: "lieu", mots: { premier: i, dernier: k }, texte: recoller(mots, i, k), nom: recoller(mots, a, k), surMot: a });
    i = k;
  }

  // --- Questions ---
  for (let d = 0; d < n; d = fin[d]! + 1) {
    const f = fin[d]!;
    if (f > d && /\?["»”)]*$/.test((brut[f] ?? "").trim())) {
      resultat.push({ type: "question", mots: { premier: d, dernier: f }, texte: recoller(mots, d, f), surMot: d });
    }
  }

  return resultat
    .map((fait, ordre) => ({ fait, ordre }))
    .sort((x, y) => x.fait.mots.premier - y.fait.mots.premier || x.ordre - y.ordre)
    .map((x) => x.fait);
}
