/**
 * Axe « écrans de texte » de la variété (lot TYP-SOU). PUR : aucune date, aucun hasard.
 *
 * Les écrans de texte de scène émotion (blocs `ecran` de type accroche ou titre, empruntés au cas concret = TYP-A)
 * deviennent des écrans PROPRES à l'IV (bloc `variete`, axe `texte`) :
 *  - TYP-B · un mot géant à la fois (un battement par mot dit) ; écran de plus de `MOTS_MAX_TYP_B` mots : TYP-C ;
 *  - TYP-C · lignes qui glissent (chaque mot sort de son cache, la ligne se trace dessous) ;
 *  - TYP-D · le mot devient l'objet (alerte → cloche, e-mail → enveloppe, heure → horloge) sur les écrans qui ont un
 *    tel mot ; les autres écrans de la vidéo sont en TYP-C. Aucun écran n'en a : TYP-C partout, repli inscrit.
 * Correctif 72 § 7 point 2 : chaque mot écrit porte l'HEURE DE SON MOT DIT (mots de la voix, `etape.mots`) ; un mot
 * écrit que la voix ne dit pas (reformulation) arrive avec sa ligne, à l'heure de la ligne dans l'écran d'origine.
 * Sans les mots de la voix (étape construite à la main), l'heure est ESTIMÉE depuis celle de la
 * ligne (`calage: "estime"`).
 * Rien d'autre ne change : mêmes textes, même fond, mêmes heures de début et de fin ; un seul mot orange par écran.
 */
import { tirablesDe, type CodeVariante, type FormatIV } from "@/briques/schema-motion/variete";
import { largeurAnton } from "@/briques/schema-motion/chasse-anton";
import type { CarteImage } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import type { BlocRenduIV, PlanIV } from "../../mise-en-scene";
import type { AxeVarieteIV, EtapeVarieteIV, RepliVarieteIV } from "../index";

/* ------------------------------------------------------------------ */
/* Données d'un écran de texte (forme recopiée de                        */
/* studio-rendu/compositions/image-video/variete/texte/donnees.ts ;     */
/* un test vérifie qu'elle s'y assigne)                                 */
/* ------------------------------------------------------------------ */

export type ObjetMotIV = "cloche" | "enveloppe" | "horloge";

/** Un mot écrit : son texte (ponctuation comprise), son heure dans le bloc (s), orange, dit par la voix. */
export interface MotEcritIV {
  mot: string;
  t: number;
  orange?: true;
  /** Vrai : `t` est l'heure du mot dit ; faux : le mot arrive avec sa ligne. */
  dit: boolean;
}

export interface LigneEcriteIV {
  /** Texte de la ligne (`*mot*` = le mot orange de l'écran). */
  texte: string;
  /** Heure de la ligne dans le bloc (s) : celle de son premier mot. */
  t: number;
  mots: MotEcritIV[];
}

export interface DonneesTexteIV {
  fond: "ivoire" | "sombre";
  lignes: LigneEcriteIV[];
  /** TYP-D : le mot qui devient l'objet (rang de la ligne et du mot), l'heure lue pour l'horloge. */
  objet?: { nom: ObjetMotIV; ligne: number; mot: number; heure?: { h: number; m: number } };
  /** Icône de la carte posée dans la zone d'appoint (sans mot). */
  icone: string;
  /** Origine des heures des mots : la voix, ou une estimation depuis l'heure de la ligne. */
  calage: "voix" | "estime";
}

/** Mots de la voix (heures sur l'horloge de la vidéo), passés par la mise en scène (`etape.mots`). */
type MotVoix = { mot: string; debutSec: number };
type EtapeAvecVoix = EtapeVarieteIV & { mots?: readonly MotVoix[] };

/** TYP-B : au-delà, l'écran est trop long pour un battement par mot (repli TYP-C). */
export const MOTS_MAX_TYP_B = 8;
/** TYP-B : plus petite taille (px) d'un mot géant qui tient en largeur (sinon : TYP-C). */
export const TAILLE_MIN_TYP_B = 150;
/** Largeur utile d'un mot géant (px). */
export const LARGEUR_MOT_GEANT = 860;
/** Débit estimé (s par mot) sans les mots de la voix. */
const DEBIT_ESTIME = 0.3;
/** Un mot écrit cherche son mot dit au plus tôt cette durée avant sa ligne (une ligne se cale sur son mot fort). */
const AVANCE_LIGNE = 1.5;

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Forme comparable d'un mot : minuscules, sans accents, lettres et chiffres seuls. */
export function formeMot(m: string): string {
  return m
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Mots d'une ligne d'écran (coupés aux espaces), avec le mot orange (`*…*`, un groupe peut avoir plusieurs mots ; un mot
 * qui en contient une partie, « L'*IA*, », est orange en entier). La ponctuation seule est collée au mot d'avant. */
export function motsDeLigne(texte: string): { mot: string; orange: boolean }[] {
  const res: { mot: string; orange: boolean }[] = [];
  let dedans = false;
  let mot = "";
  let orange = false;
  const fermer = () => {
    if (!mot) return;
    if (res.length && !/[\p{L}\p{N}]/u.test(mot)) res[res.length - 1].mot += mot;
    else res.push({ mot, orange });
    mot = "";
    orange = false;
  };
  for (const c of texte) {
    if (c === "*") dedans = !dedans;
    else if (/\s/.test(c)) fermer();
    else {
      mot += c;
      if (dedans) orange = true;
    }
  }
  fermer();
  return res;
}

/* ------------------------------------------------------------------ */
/* Le mot qui devient l'objet (TYP-D)                                   */
/* ------------------------------------------------------------------ */

const HEURE = /^(\d{1,2})\s*(?:h|:)\s*(\d{2})?$/i;

/** L'objet d'un mot (alerte → cloche, e-mail → enveloppe, heure → horloge), sinon null. */
export function objetDuMot(mot: string): { nom: ObjetMotIV; heure?: { h: number; m: number } } | null {
  const brut = mot.replace(/[.,!?;:…»«"“”()]+$/u, "").replace(/^[«"“(]+/u, "");
  const f = formeMot(brut);
  if (/^alertes?$/.test(f)) return { nom: "cloche" };
  if (/^(e?mails?|courriels?|enveloppes?)$/.test(f)) return { nom: "enveloppe" };
  const h = HEURE.exec(brut);
  if (h) {
    const heures = Number(h[1]);
    if (heures === 24 && !h[2]) return { nom: "horloge" };
    if (heures <= 23) return { nom: "horloge", heure: { h: heures, m: h[2] ? Number(h[2]) : 0 } };
  }
  if (/^(heures?|minuit|247|2424)$/.test(f)) return { nom: "horloge" };
  return null;
}

/** Textes de la carte où un mot peut devenir l'objet (titre, phrase-choc, nœuds). */
function textesCarte(carte: CarteImage): string[] {
  return [carte.titre, carte.phraseChoc, ...carte.noeuds.flatMap((n) => [n.libelle, n.detail ?? ""])].filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Écrans concernés et heures des mots                                  */
/* ------------------------------------------------------------------ */

type BlocEcran = Extract<BlocRenduIV, { sorte: "ecran" }>;

/** Bloc d'écran de texte d'une scène émotion (accroche ou titre ; ni chiffre, ni segment de fin). */
function estEcranEmotion(b: BlocRenduIV, plans: readonly PlanIV[]): b is BlocEcran {
  if (b.sorte !== "ecran") return false;
  const e = b.ecran as { type: string; lignes?: unknown };
  if ((e.type !== "accroche" && e.type !== "titre") || !Array.isArray(e.lignes)) return false;
  const milieu = (b.debut + b.fin) / 2;
  return plans.some((p) => p.sorte === "emotion" && p.debut <= milieu + 1e-6 && milieu < p.fin);
}

/**
 * Lignes écrites d'un écran, chaque mot à l'heure de son mot dit (dans le bloc, s). Un seul groupe orange par écran
 * (le premier). Pur.
 */
export function lignesEcrites(b: BlocEcran, mots: readonly MotVoix[] | undefined, chiffresDits: EtapeVarieteIV["chiffresDits"]): { lignes: LigneEcriteIV[]; calage: "voix" | "estime" } {
  const e = b.ecran as { lignes: string[]; evenements: { cible: string; ms: number }[] };
  const heureLigne = (k: number) => {
    const ev = e.evenements.find((x) => x.cible === `ligne-${k}`);
    return ev ? ev.ms / 1000 : b.debut;
  };
  const rel = (t: number) => arrondi(Math.min(b.fin - b.debut, Math.max(0, t - b.debut)));
  let orangeVu = false;
  let curseur = 0;
  const lignes = e.lignes.map((texte, k) => {
    const T = heureLigne(k);
    const prochaine = k + 1 < e.lignes.length ? Math.max(T, heureLigne(k + 1)) : b.fin;
    const bruts = motsDeLigne(texte);
    const aOrange = bruts.some((m) => m.orange) && !orangeVu;
    if (aOrange) orangeVu = true;
    let precedent = T;
    const ecrits: MotEcritIV[] = bruts.map((m, i) => {
      let t: number | null = null;
      if (mots) {
        const f = formeMot(m.mot);
        for (let j = curseur; f && j < mots.length && mots[j].debutSec < b.fin; j++) {
          if (mots[j].debutSec < T - AVANCE_LIGNE) continue;
          if (formeMot(mots[j].mot) === f) {
            t = mots[j].debutSec;
            curseur = j + 1;
            break;
          }
        }
        // Un chiffre écrit (« 23:14 ») que la voix dit en lettres : l'heure de son chiffre dit.
        if (t === null && /\d/.test(m.mot)) {
          const chiffres = m.mot.replace(/\D/g, "");
          const c = chiffresDits.find((x) => x.brut.replace(/\D/g, "") === chiffres && x.t >= T - AVANCE_LIGNE && x.t < b.fin);
          if (c) t = c.t;
        }
      } else t = Math.min(T + i * DEBIT_ESTIME, Math.max(T, prochaine - 0.2));
      const dit = mots ? t !== null : false;
      const heure = t ?? precedent;
      precedent = Math.max(precedent, heure);
      return { mot: m.mot, t: rel(heure), dit, ...(m.orange && aOrange ? { orange: true as const } : {}) };
    });
    const sans = aOrange ? texte : texte.replace(/\*/g, "");
    return { texte: sans, t: ecrits.length ? Math.min(...ecrits.map((x) => x.t)) : rel(T), mots: ecrits };
  });
  return { lignes, calage: mots ? "voix" : "estime" };
}

/** Icône d'appoint : celle du nœud que l'écran nomme, sinon celle du déclencheur, sinon un message. */
function iconeAppoint(carte: CarteImage, lignes: readonly LigneEcriteIV[]): string {
  const formes = new Set(lignes.flatMap((l) => l.mots.map((m) => formeMot(m.mot))).filter((f) => f.length >= 4));
  const nomme = carte.noeuds.find((n) => n.icone && `${n.libelle} ${n.detail ?? ""}`.split(/\s+/).some((x) => formes.has(formeMot(x)) && formeMot(x).length >= 4));
  const n = nomme ?? carte.noeuds.find((x) => x.role === "declencheur" && x.icone) ?? carte.noeuds.find((x) => x.icone);
  return (n?.icone && iconeDe(n.icone)) || "message";
}

/** TYP-B tient : peu de mots, et chaque mot assez grand en largeur. */
export function tientEnMotGeant(lignes: readonly LigneEcriteIV[]): boolean {
  const mots = lignes.flatMap((l) => l.mots);
  return mots.length > 0 && mots.length <= MOTS_MAX_TYP_B && mots.every((m) => LARGEUR_MOT_GEANT / largeurAnton(m.mot.toUpperCase(), 1) >= TAILLE_MIN_TYP_B);
}

/** Premier mot de l'écran qui a un objet (le mot orange d'abord). */
function objetDeLEcran(lignes: readonly LigneEcriteIV[]): DonneesTexteIV["objet"] | undefined {
  const tous = lignes.flatMap((l, ligne) => l.mots.map((m, mot) => ({ m, ligne, mot })));
  for (const x of [...tous.filter((y) => y.m.orange), ...tous.filter((y) => !y.m.orange)]) {
    const o = objetDuMot(x.m.mot);
    if (o) return { nom: o.nom, ligne: x.ligne, mot: x.mot, ...(o.heure ? { heure: o.heure } : {}) };
  }
  return undefined;
}

export const AXE_TYPO: AxeVarieteIV = {
  axe: "texte",
  possibles(carte: CarteImage, format: FormatIV) {
    const objet = textesCarte(carte).some((t) => t.split(/\s+/).some((m) => objetDuMot(m)));
    return tirablesDe("texte").filter((c) => (c !== "TYP-B" || format === "9:16") && (c !== "TYP-D" || objet));
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    const voulu = etape.recette.texte;
    if (voulu === "TYP-A") return etape;
    const mots = (etape as EtapeAvecVoix).mots;
    const replis: RepliVarieteIV[] = [];
    let objets = 0;
    const blocs = etape.blocs.map((b): BlocRenduIV => {
      if (!estEcranEmotion(b, etape.plans)) return b;
      const { lignes, calage } = lignesEcrites(b, mots, etape.chiffresDits);
      if (!lignes.some((l) => l.mots.length)) return b;
      const donnees: DonneesTexteIV = { fond: b.ecran.fond === "ivoire" ? "ivoire" : "sombre", lignes, icone: iconeAppoint(etape.carte, lignes), calage };
      let code: CodeVariante<"texte"> = voulu;
      if (voulu === "TYP-B" && (etape.format !== "9:16" || !tientEnMotGeant(lignes))) {
        code = "TYP-C";
        replis.push({ axe: "texte", code: "TYP-B", raison: `bloc ${b.id} (écran ${b.ecran.id}) trop long pour un mot géant à la fois (ou format ${etape.format}) : TYP-C` });
      }
      if (voulu === "TYP-D") {
        const objet = objetDeLEcran(lignes);
        if (objet) {
          donnees.objet = objet;
          objets++;
        } else code = "TYP-C";
      }
      return { id: b.id, debut: b.debut, fin: b.fin, ...(b.variete ? { variete: b.variete } : {}), sorte: "variete", axe: "texte", code, donnees };
    });
    if (voulu === "TYP-D" && !objets) replis.push({ axe: "texte", code: "TYP-D", raison: "aucun écran de texte n'a de mot qui devient un objet (alerte, e-mail, heure) : TYP-C" });
    return { ...etape, blocs, replis: [...etape.replis, ...replis] };
  },
};
