/**
 * TEST DE PROPRIÉTÉ de l'étape « scènes » des trois styles du tableau (17/10/2026, vidéo v-fc3ac0c1d171 : quatrième
 * panne « Titre jamais seul », chaque fois sur une page différente parce que le découpage changeait).
 *
 * Propriété : pour une fiche acceptée AVANT la voix (relecture de la fiche et contrôles d'avant la voix), aucun minutage
 * plausible de la voix ne fait refuser la vidéo APRÈS elle (calage, mise en page, fin, contrôles de l'étape « scènes » :
 * titre seul, page vide, bloc écrit en retard, outil levé ou dans la bande…, composition, contrôles finaux).
 *
 * Chaque essai part d'une fiche du banc (les 18 témoins, v-6616b3800357, les fiches des trois styles), dans un style, et
 * tire de façon déterministe (graine fixe), PAGE PAR PAGE :
 *  - le délai entre le début de la page et le premier mot du bloc qui suit le titre (0,2 à 5 s, par pas de 0,2 s) ;
 *  - la durée de chaque phrase dite ensuite (1 à 6 s, par pas de 0,5 s ; bornée à un débit plausible) ;
 *  - le titre : gardé, court (le dernier mot du bloc suivant) ou long (ses trois derniers mots, comme « Qui fait quoi ») ;
 *  - le dessin : gardé, ajouté (un dessin dit au début de la page) ou retiré.
 * L'accroche (page 1) ouvre la voix au débit naturel. La vraie fabrication (`fabriquerTableau`, doubles sans appel
 * payant) lit la voix ainsi minutée, pour 4 formats.
 */
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MotHorodate } from "../../../src/domaine/types";
import { ErreurFabrication, fabriquerTableau, pagesDuStyle } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { ElementTableau as ElementFiche, ElementLigne as Ligne, FicheTableau, SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { doubles } from "../fabriquer/doubles";
import { contexteBanc, type FicheBanc } from "../banc/fiches-banc";

/** Les 4 formats : 9:16, 4:5, carré, 16:9. */
export const FORMATS_PROPRIETE: readonly IdSortie[] = ["vertical", "portrait", "carre", "horizontal"];
export const DELAIS_SEC = Array.from({ length: 25 }, (_, i) => +(0.2 * (i + 1)).toFixed(1));
export const PHRASES_SEC = Array.from({ length: 11 }, (_, i) => 1 + 0.5 * i);
/** Étapes d'avant la voix : un refus là ne coûte rien (aucune voix payée). */
export const ETAPES_AVANT_VOIX = new Set(["fiche", "script"]);

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function graine(n: number): () => number {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tirer = <T>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length)];

const NOMBRE = /^(\p{N}+|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|cent|mille|demie?)$/iu;
const estMot = (m: string) => /[\p{L}\p{N}]/u.test(m);
const nbMots = (t: string) => t.split(/\s+/).filter(estMot).length;

/** Ce qu'un essai a tiré pour une page. */
export interface TiragePage {
  page: number;
  delaiSec: number;
  phraseSec: number;
  titre: "garde" | "court" | "long" | "aucun";
  dessin: "garde" | "ajoute" | "retire";
}

const ancreDe = (e: ElementFiche) => ("ancre" in e && typeof e.ancre === "number" ? e.ancre : 0);

/** Les scènes d'une fiche groupées par page, dans l'ordre. */
function parPage(f: FicheTableau): SceneTableau[][] {
  const res: SceneTableau[][] = [];
  for (const s of f.scenes) {
    const der = res.at(-1);
    if (der && der[0].page === s.page) der.push(s);
    else res.push([s]);
  }
  return res;
}

/** Le titre d'une page et le bloc qui le suit (ancre de page : mots des scènes d'avant sur la page compris). */
function titreEtSuivant(ss: SceneTableau[]): { titre?: { s: SceneTableau; e: Ligne; a: number }; suivant?: { s: SceneTableau; e: ElementFiche; a: number } } {
  let decal = 0;
  const tout: { s: SceneTableau; e: ElementFiche; a: number }[] = [];
  for (const s of ss) {
    for (const e of s.elements) if (e.type === "ligne" || e.type === "preuve" || e.type === "chiffre") tout.push({ s, e, a: decal + ancreDe(e) });
    decal += nbMots(s.texteDit);
  }
  const t = tout.find((x) => x.e.type === "ligne" && (x.e as Ligne).bloc === "titre") as { s: SceneTableau; e: Ligne; a: number } | undefined;
  const autres = tout.filter((x) => x !== t && !(x.e.type === "ligne" && ["titre", "partie"].includes((x.e as Ligne).bloc ?? "")));
  const suivant = autres.filter((x) => !t || x.a >= t.a).sort((a, b) => a.a - b.a)[0];
  return { ...(t ? { titre: t } : {}), ...(suivant ? { suivant } : {}) };
}

/**
 * La fiche d'un essai : chaque page tire son titre (gardé, court, long) et son dessin (gardé, ajouté, retiré). Les
 * textes restent des mots dits (le titre est pris dans la phrase qui le suit) ; la relecture d'avant la voix juge.
 */
export function varierFiche(f0: FicheTableau, r: () => number): { fiche: FicheTableau; tirages: Omit<TiragePage, "delaiSec" | "phraseSec">[] } {
  const f = structuredClone(f0);
  const tirages: Omit<TiragePage, "delaiSec" | "phraseSec">[] = [];
  for (const ss of parPage(f)) {
    const { titre, suivant } = titreEtSuivant(ss);
    const role = ss[0].gabarit?.role;
    let choixTitre: TiragePage["titre"] = titre ? tirer(r, ["garde", "court", "long"] as const) : "aucun";
    if (titre && suivant && suivant.e.type === "ligne" && choixTitre !== "garde") {
      // Les derniers mots de la phrase, sans nombre (un titre qui retire un nombre dit est refusé à la relecture).
      const mots = (suivant.e as Ligne).texte.split(/\s+/).map((m) => m.replace(/[^\p{L}\p{N}'’-]/gu, "")).filter(Boolean);
      const sansNombre = mots.slice(mots.findLastIndex((m) => NOMBRE.test(m)) + 1);
      const pris = choixTitre === "court" ? sansNombre.slice(-1) : sansNombre.slice(-3);
      if (pris.length && pris.join(" ").length >= 3) titre.e.texte = pris.join(" ").replace(/^\p{Ll}/u, (c) => c.toUpperCase());
      else choixTitre = "garde";
    } else if (titre) choixTitre = "garde";
    let choixDessin: TiragePage["dessin"] = "garde";
    const dessins = ss.flatMap((s) => s.elements.filter((e) => e.type === "dessin").map((e) => ({ s, e })));
    if (role !== "accroche" && role !== "appel" && role !== "exemple") {
      const c = tirer(r, ["garde", "change", "change"] as const);
      if (c === "change" && dessins.length) {
        for (const d of dessins) d.s.elements = d.s.elements.filter((e) => e !== d.e);
        choixDessin = "retire";
      } else if (c === "change" && !ss.some((s) => s.gabarit?.visuel)) {
        ss[0].elements.push({ id: `${ss[0].id}-dessin`, type: "dessin", dessinId: "dossier", cote: "droite", ancre: 0 } as ElementFiche);
        choixDessin = "ajoute";
      }
    }
    tirages.push({ page: ss[0].page, titre: choixTitre, dessin: choixDessin });
  }
  return { fiche: f, tirages };
}

/**
 * Le minutage d'un essai, pour le texte lu (les `texteDit` bout à bout) : page par page, les mots d'avant le bloc qui
 * suit le titre durent `delaiSec` en tout (au débit naturel puis un silence, ou plus vite), puis chaque phrase dure
 * `phraseSec` (bornée à 0,15 à 0,55 s par mot : un débit qu'une voix peut tenir). Un texte inconnu (une phrase de fin
 * lue à part) garde un débit naturel.
 */
export function minuter(texte: string, f: FicheTableau, tirages: Map<number, { delaiSec: number; phraseSec: number }>): MotHorodate[] {
  const naturel = (m: string) => (estMot(m) ? (m.length + 1) / 18 : 0.05);
  const pause = (m: string) => (/[.?!…]$/.test(m) ? 0.3 : /[,;:]$/.test(m) ? 0.12 : 0);
  const res: MotHorodate[] = [];
  let t = 0.15;
  const poser = (m: string, d: number) => {
    res.push({ mot: m, debutSec: +t.toFixed(3), finSec: +(t + Math.max(0.03, d * 0.92)).toFixed(3) });
    t += d + pause(m);
  };
  if (texte.trim() !== f.scenes.map((s) => s.texteDit).join(" ").trim()) {
    for (const m of texte.split(/\s+/).filter(Boolean)) poser(m, naturel(m));
    return res;
  }
  for (const ss of parPage(f)) {
    // L'accroche ouvre la voix au débit naturel (ses règles de voix, « douleur en tête », se jugent au calage).
    if (ss[0].page === f.scenes[0].page) {
      for (const m of ss.flatMap((s) => s.texteDit.split(/\s+/).filter(Boolean))) poser(m, naturel(m));
      continue;
    }
    // Une page ajoutée par la fabrication (une page qui ne tient pas dans le style) garde le tirage de la page d'avant.
    const jeu = tirages.get(ss[0].page) ?? tirages.get(Math.max(...[...tirages.keys()].filter((p) => p < ss[0].page)))!;
    const { suivant } = titreEtSuivant(ss);
    const A = suivant?.a ?? 0;
    const toks = ss.flatMap((s) => s.texteDit.split(/\s+/).filter(Boolean));
    // Index (en mots dits) de chaque jeton.
    let k = 0;
    const idx = toks.map((m) => (estMot(m) ? k++ : k));
    const avant = toks.filter((_, i) => idx[i] < A);
    const apres = toks.filter((_, i) => idx[i] >= A);
    if (avant.length) {
      const nat = avant.reduce((s, m) => s + naturel(m) + pause(m), 0);
      const fct = Math.max(0.35, Math.min(1, jeu.delaiSec / nat));
      const t0 = t;
      for (const m of avant) poser(m, naturel(m) * fct);
      // Le silence qui reste avant le bloc suivant (la pause d'après le point déjà comptée).
      t = Math.max(t, t0 + jeu.delaiSec);
    }
    // Les phrases d'après, une durée chacune.
    let phrase: string[] = [];
    const dire = () => {
      if (!phrase.length) return;
      const n = phrase.filter(estMot).length || 1;
      const cible = Math.max(n * 0.15, Math.min(n * 0.55, jeu.phraseSec));
      const nat = phrase.reduce((s, m) => s + naturel(m), 0);
      for (const m of phrase) poser(m, (naturel(m) * cible) / nat);
      phrase = [];
    };
    for (const m of apres) {
      phrase.push(m);
      if (/[.?!…]$/.test(m)) dire();
    }
    dire();
  }
  return res;
}

export interface ResultatEssai {
  fiche: string;
  style: StyleTableau;
  graine: number;
  tirages: TiragePage[];
  /** « avant-voix » : refusée à la relecture (rien de payé) ; « ok » ; sinon le refus après la voix. */
  issue: "ok" | "avant-voix" | "refus";
  raisons: string[];
  /** Combinaisons page × format jugées après la voix. */
  combinaisons: number;
}

/** Un essai : une fiche du banc, un style, une graine, par la vraie fabrication (4 formats). */
export async function essai(fb: FicheBanc, style: StyleTableau, n: number): Promise<ResultatEssai> {
  const r = graine(n * 7919 + fb.nom.length * 104729 + style.length);
  const base = pagesDuStyle({ ...fb.fiche, styleTableau: style }) as FicheTableau;
  const { fiche, tirages: t0 } = varierFiche(base, r);
  const jeux = new Map(t0.map((t) => [t.page, { delaiSec: tirer(r, DELAIS_SEC), phraseSec: tirer(r, PHRASES_SEC) }]));
  const tirages = t0.map((t) => ({ ...t, ...jeux.get(t.page)! }));
  const d = doubles(fiche);
  const voix = d.outils.voix.voix();
  const outils = {
    ...d.outils,
    voix: {
      ...d.outils.voix,
      voix: () => ({
        ...voix,
        async lire(demande: Parameters<typeof voix.lire>[0]) {
          const lu = await voix.lire(demande);
          // La fiche lue par la fabrication (pages refaites dans le style) : celle dont on minute les pages.
          const mots = minuter(demande.texte, pagesDuStyle(fiche) as FicheTableau, jeux);
          return { ...lu, mots, dureeSec: Math.max(1, Math.round(mots.at(-1)!.finSec + 0.4)) };
        },
      }),
    },
  };
  const res = { fiche: fb.nom, style, graine: n, tirages };
  const pages = new Set(fiche.scenes.map((s) => s.page)).size;
  try {
    const f = await fabriquerTableau({ ...outils, contexte: contexteBanc(fiche, fb.motsDouleur, fb.sources), sorties: [...FORMATS_PROPRIETE], dejaVu: { coche: true, le: "2026-10-17" } });
    const raisons = [...(f.manquantes ?? []).flatMap((m) => m.raisons.map((x) => `${m.format} · ${m.etape} · ${x}`)), ...f.sorties.flatMap((s) => s.controles.bloquants.map((b) => `${s.format} · controles · ${b.libelle} : ${b.raison}`))];
    return { ...res, issue: raisons.length ? "refus" : "ok", raisons, combinaisons: pages * FORMATS_PROPRIETE.length };
  } catch (err) {
    if (err instanceof ErreurFabrication && ETAPES_AVANT_VOIX.has(err.etape)) return { ...res, issue: "avant-voix", raisons: [...err.raisons], combinaisons: 0 };
    const raisons = err instanceof ErreurFabrication ? err.raisons.map((x) => `${err.etape} · ${x}`) : [err instanceof Error ? (err.stack ?? err.message) : String(err)];
    return { ...res, issue: "refus", raisons, combinaisons: pages * FORMATS_PROPRIETE.length };
  }
}
