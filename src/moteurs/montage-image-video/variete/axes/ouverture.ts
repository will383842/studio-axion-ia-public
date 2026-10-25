/**
 * Axe « ouverture » de la variété (lot OUV-FIN, doc 72 axe 1, maquettes `prototypes/d1-ouvertures-fins/ouvertures.tsx`).
 *
 * Les 3 premières secondes deviennent l'une des 5 ouvertures validées : un bloc `sorte: "variete"`, axe « ouverture »,
 * remplace les blocs de la PREMIÈRE PHRASE (plans du premier écran de la fiche, au plus `DUREE_MAX_OUVERTURE_SEC`). Ses
 * données viennent de la carte (chiffre final, avant / après, heure, déclencheur, nœud d'alerte, schéma) et des mots de
 * l'accroche : rien n'est inventé, la voix et les événements ne changent pas (les contrôles lisent les événements).
 * Une variante impossible sur l'image garde l'écran d'aujourd'hui et s'inscrit dans `replis`.
 *
 * Règle Q13 : un chiffre n'est jamais montré avant d'être dit, SAUF dans l'ouverture (OUV-A montre le résultat d'abord).
 */
import type { CodesParAxe, FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage, ChiffreCarte, NoeudCarte } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import { clesDeLaCarte, cleChiffre } from "../../controles-scene";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { BlocRenduIV } from "../../mise-en-scene";
import { chiffresDuTexte } from "../../regles";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";

/** L'ouverture couvre la première phrase, au plus 3,5 s (doc 80, lot 1). */
export const DUREE_MAX_OUVERTURE_SEC = 3.5;
/** En deçà, la première phrase est trop courte pour deux images : l'écran d'aujourd'hui reste. */
const DUREE_MIN_OUVERTURE_SEC = 1;

type CodeOuverture = CodesParAxe["ouverture"];
type CouleurNoeud = NoeudCarte["couleur"];

/** Un chiffre de la carte, tel qu'écrit sur l'image (« 80 % ») et coupé pour l'affiche (« 80 » + « % »). */
export interface ChiffreOuvertureIV {
  texte: string;
  nombre: string;
  unite: string;
  cle: string;
}
/** Un côté de l'avant / après (OUV-B). */
export interface CoteOuvertureIV {
  chiffre: ChiffreOuvertureIV;
  libelle: string | null;
  icone: string | null;
}
/** Un nœud du schéma réduit à son icône (OUV-E). */
export interface NoeudSchemaOuvertureIV {
  icone: string | null;
  couleur: CouleurNoeud;
  detail?: true;
}

/** Données de l'écran d'ouverture (lues par `studio-rendu/compositions/image-video/variete/ouverture/donnees.ts`). */
export type DonneesOuvertureIV = {
  /** Annonce « Situation type » (carte d'automatisation, I7). */
  situation: boolean;
  /** Durée de l'écran, et passage de la 1re à la 2e image (s, depuis le début du bloc). */
  duree: number;
  bascule: number;
} & (
  | {
      code: "OUV-A";
      resultat: { chiffre: ChiffreOuvertureIV; libelle: string | null; part: number | null };
      depart: { chiffre: ChiffreOuvertureIV | null; libelle: string; icone: string | null };
      suite: (string | null)[];
    }
  | { code: "OUV-B"; avant: CoteOuvertureIV; apres: CoteOuvertureIV }
  | { code: "OUV-C"; heure: { h: number; m: number; texte: string } | null; objet: { libelle: string; icone: string; chiffre: ChiffreOuvertureIV | null }; moteur: string | null }
  | { code: "OUV-D"; mots: { texte: string; t: number; orange: boolean }[]; nuit: boolean; icone: string | null }
  | {
      code: "OUV-E";
      detail: { libelle: string; detail: string | null; icone: string | null };
      suivant: string | null;
      schema: { haut: NoeudSchemaOuvertureIV[]; colonnes: NoeudSchemaOuvertureIV[][] };
    }
);

/* ------------------------------------------------------------------ */
/* Lecture de la carte (PURE)                                            */
/* ------------------------------------------------------------------ */

const ICONES_QUOTIDIEN = new Set(["message", "mail", "document", "calendrier", "horloge"]);
const UNITES_DUREE = new Set(["sec", "min", "h"]);

const parOrdre = (a: NoeudCarte, b: NoeudCarte) => a.ordre - b.ordre || a.id.localeCompare(b.id);
const iconeDuNoeud = (n: NoeudCarte | undefined): string | null => (n?.icone ? iconeDe(n.icone) : null);
/** Texte d'un nœud sans pictogramme (« 🔔 Intervention requise » → « Intervention requise »). */
const propre = (t: string) => t.replace(/[^\p{L}\p{N}\s'’.,:;!?%/+·–—-]/gu, "").replace(/\s+/g, " ").trim();

/** Le chiffre tel qu'écrit, coupé en nombre (avec son « h » d'heure) et unité. */
export function chiffreOuverture(c: Pick<ChiffreCarte, "brut">, cle: string): ChiffreOuvertureIV {
  const m = /^([\d.,]+(?:h\d*(?:\/\d+)?)?(?:er|re|e)?)\s*(.*)$/u.exec(c.brut.trim());
  return { texte: c.brut, nombre: m ? m[1] : c.brut, unite: m ? m[2] : "", cle };
}

/** Libellé d'un nœud sans le chiffre qu'il porte (« Envoyée en 4 sec » → « Envoyée en ») ; vide → null. */
function libelleSans(n: NoeudCarte | undefined, c?: ChiffreCarte): string | null {
  if (!n) return null;
  const l = propre(c ? n.libelle.replace(c.brut, "") : n.libelle).replace(/[\s:—–-]+$/u, "").replace(/^[\s:—–-]+/u, "");
  return /\p{L}/u.test(l) ? l : null;
}

/** Lecture commune de la carte (chiffres, nœuds, groupes). */
export class LectureCarte {
  readonly cles: Map<string, string>;
  readonly noeuds: Map<string, NoeudCarte>;
  constructor(readonly carte: CarteImage) {
    this.cles = clesDeLaCarte(carte);
    this.noeuds = new Map(carte.noeuds.map((n) => [n.id, n]));
  }
  chiffre(c: ChiffreCarte): ChiffreOuvertureIV {
    return chiffreOuverture(c, this.cles.get(c.id)!);
  }
  chiffresDu(n: NoeudCarte | undefined): ChiffreCarte[] {
    return n ? this.carte.chiffres.filter((c) => c.dansNoeud === n.id) : [];
  }
  groupeDe(n: NoeudCarte) {
    return this.carte.groupes.find((g) => g.noeuds.includes(n.id));
  }
  get tries() {
    return [...this.carte.noeuds].sort(parOrdre);
  }
  /** Le nœud qui décide ou qui travaille (« Chatbot IA », « IA »). */
  get moteur(): NoeudCarte | undefined {
    return this.tries.find((n) => n.role === "decision" || n.role === "moteur");
  }
  get declencheur(): NoeudCarte | undefined {
    return this.tries.find((n) => n.role === "declencheur");
  }
  /** Groupe « majoritaire » (branche orange) ou « après ». */
  get groupeFort() {
    return this.carte.groupes.find((g) => g.sorte === "apres") ?? this.carte.groupes.find((g) => g.majoritaire);
  }
  /** Le chiffre final : celui du résultat (groupe « après », sortie majoritaire), sinon le premier du bandeau. */
  chiffreFinal(sauf?: string): { c: ChiffreCarte; noeud?: NoeudCarte } | null {
    const fort = this.groupeFort;
    const candidats = this.tries.filter((n) => (n.role === "resultat" || n.role === "sortie") && (n.couleur === "vert" || (fort?.noeuds.includes(n.id) ?? false)));
    for (const n of candidats) for (const c of this.chiffresDu(n)) if (c.valeur !== null && this.cles.get(c.id) !== sauf) return { c, noeud: n };
    for (const id of this.carte.bandeauChiffres) {
      const c = this.carte.chiffres.find((x) => x.id === id);
      if (c && c.valeur !== null && this.cles.get(c.id) !== sauf) return { c };
    }
    return null;
  }
  /** Le chiffre qui est dit d'abord (premier écran de la fiche), à défaut celui du déclencheur. */
  chiffreDuDebut(refs: readonly string[]): { c: ChiffreCarte; noeud?: NoeudCarte } | null {
    for (const r of refs) {
      const c = this.carte.chiffres.find((x) => x.id === r);
      if (c) return { c, noeud: c.dansNoeud ? this.noeuds.get(c.dansNoeud) : undefined };
      const n = this.noeuds.get(r);
      const dedans = this.chiffresDu(n)[0];
      if (dedans) return { c: dedans, noeud: n };
    }
    const d = this.declencheur;
    const c = this.chiffresDu(d)[0];
    return c ? { c, noeud: d } : null;
  }
  /** L'heure de la carte (« 23h14 », unité « heure », valeur en minutes). */
  get heure(): ChiffreCarte | undefined {
    return this.carte.chiffres.find((c) => c.unite === "heure" && c.valeur !== null && (c.dansNoeud === this.declencheur?.id || !c.dansNoeud));
  }
  get objetQuotidien(): NoeudCarte | undefined {
    const d = this.declencheur;
    return d && ICONES_QUOTIDIEN.has(iconeDuNoeud(d) ?? "") ? d : undefined;
  }
  get aUnSchema(): boolean {
    return this.carte.liens.length >= 2 && !this.carte.types.includes("benefices");
  }
  /** Avant / après : deux chiffres opposés (avant-après, entonnoir, ou départ ↔ durée de la branche majoritaire). */
  avantApres(): { avant: { c: ChiffreCarte; noeud?: NoeudCarte }; apres: { c: ChiffreCarte; noeud?: NoeudCarte } } | null {
    const dansGroupe = (sorte: "avant" | "apres") => {
      const g = this.carte.groupes.find((x) => x.sorte === sorte);
      if (!g) return null;
      const ns = g.noeuds.map((id) => this.noeuds.get(id)!).filter(Boolean).sort((a, b) => Number(b.role === "resultat") - Number(a.role === "resultat") || parOrdre(a, b));
      for (const n of ns) for (const c of this.chiffresDu(n)) if (c.valeur !== null) return { c, noeud: n };
      return null;
    };
    if (this.carte.types.includes("avant-apres")) {
      const avant = dansGroupe("avant");
      const apres = dansGroupe("apres");
      if (avant && apres) return { avant, apres };
    }
    const d = this.declencheur;
    const depart = this.chiffresDu(d).find((c) => c.valeur !== null);
    if (!depart || !d) return null;
    if (this.carte.types.includes("entonnoir")) {
      const fin = this.chiffreFinal(this.cles.get(depart.id));
      if (fin) return { avant: { c: depart, noeud: d }, apres: fin };
    }
    const fort = this.groupeFort;
    for (const id of fort?.noeuds ?? []) {
      const n = this.noeuds.get(id);
      const c = this.chiffresDu(n).find((x) => x.valeur !== null && UNITES_DUREE.has(x.unite));
      if (c) return { avant: { c: depart, noeud: d }, apres: { c, noeud: n } };
    }
    return null;
  }
  /** Le nœud montré en gros plan (OUV-E) : l'alerte, sinon le moteur, sinon le résultat. */
  get noeudDetail(): NoeudCarte | undefined {
    return this.tries.find((n) => iconeDuNoeud(n) === "cloche") ?? this.moteur ?? this.tries.find((n) => n.role === "resultat");
  }
}

/* ------------------------------------------------------------------ */
/* Données de chaque variante                                            */
/* ------------------------------------------------------------------ */

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Lignes d'écran (et leur heure) des blocs de la première phrase. */
function lignesDe(blocs: readonly BlocRenduIV[], fin: number): { texte: string; t: number }[] {
  const vues = new Set<string>();
  const res: { texte: string; t: number }[] = [];
  for (const b of blocs) {
    if (b.sorte !== "ecran" || b.debut >= fin) continue;
    const e = b.ecran as { type: string; lignes?: string[]; nombre?: number; unite?: string; pastilles?: string[]; evenements: { cible: string; ms: number }[] };
    const textes = e.type === "chiffre" ? [`*${e.nombre} ${e.unite}*`, ...(e.pastilles ?? [])] : (e.lignes ?? []);
    textes.forEach((texte, k) => {
      const cle = texte.replace(/\*/g, "");
      if (vues.has(cle)) return;
      vues.add(cle);
      const ev = e.evenements.find((x) => x.cible === `ligne-${k}`) ?? e.evenements[k];
      res.push({ texte, t: arrondi(Math.max(b.debut, Math.min(fin - 0.3, (ev?.ms ?? b.debut * 1000) / 1000))) });
    });
  }
  return res;
}

/** Les mots de l'accroche, un chiffre de la carte = un mot écrit comme sur l'image (« 23:14 » → « 23h14 »). */
/** OUV-D : mots posés d'un coup sur la première image (première ligne, puis lignes entières jusqu'à ce nombre). */
export const MOTS_PREMIERE_IMAGE_OUV_D = 3;

function motsDe(lignes: { texte: string; t: number }[], lecture: LectureCarte, fin: number): { texte: string; t: number; orange: boolean }[] {
  const brutDe = new Map<string, string>();
  for (const c of lecture.carte.chiffres) brutDe.set(lecture.cles.get(c.id)!, c.brut);
  const mots: { texte: string; t: number; orange: boolean }[] = [];
  for (const l of lignes) {
    const bruts = l.texte.split(/\s+/).filter(Boolean);
    const sans = bruts.map((m) => m.replace(/\*/g, ""));
    const orange = bruts.map((m) => /\*/.test(m));
    const ligne: { texte: string; orange: boolean }[] = [];
    for (let i = 0; i < sans.length; i++) {
      let pris = false;
      if (/^\d/.test(sans[i])) {
        for (let n = Math.min(3, sans.length - i); n >= 1 && !pris; n--) {
          const fenetre = sans.slice(i, i + n).join(" ").replace(/[.,!?…;:]+$/u, "");
          const lus = chiffresDuTexte(fenetre);
          const brut = lus.length === 1 ? brutDe.get(cleChiffre(lus[0])) : undefined;
          if (brut) {
            ligne.push({ texte: brut, orange: orange.slice(i, i + n).some(Boolean) });
            i += n - 1;
            pris = true;
          }
        }
      }
      if (!pris) ligne.push({ texte: sans[i].replace(/[.,;:]+$/u, ""), orange: orange[i] });
    }
    // Au rythme de la voix : la ligne arrive avec son mot, ses mots se suivent (0,22 s), sans dépasser la fin. La
    // PREMIÈRE ligne arrive d'un coup, complétée par les suivantes jusqu'à `MOTS_PREMIERE_IMAGE_OUV_D` mots (lot F,
    // décision du chef de projet : un seul mot dit, « 23h14 », laissait l'écran à moitié vide).
    const pleins = ligne.filter((m) => /[\p{L}\p{N}]/u.test(m.texte));
    const premiere = mots.length < MOTS_PREMIERE_IMAGE_OUV_D;
    const t0 = mots[0]?.t ?? l.t;
    pleins.forEach((m, k) => mots.push({ ...m, t: arrondi(premiere ? t0 : Math.min(fin - 0.2, l.t + 0.22 * k)) }));
  }
  // Un seul mot orange par écran : le premier marqué ; à défaut, le premier chiffre.
  const premierOrange = mots.findIndex((m) => m.orange);
  const k = premierOrange >= 0 ? premierOrange : mots.findIndex((m) => /^\d/.test(m.texte));
  return mots.map((m, i) => ({ ...m, orange: i === k }));
}

function schemaDe(lecture: LectureCarte, detail: NoeudCarte): { haut: NoeudSchemaOuvertureIV[]; colonnes: NoeudSchemaOuvertureIV[][] } {
  const vers = (n: NoeudCarte): NoeudSchemaOuvertureIV => ({ icone: iconeDuNoeud(n), couleur: n.couleur, ...(n.id === detail.id ? { detail: true as const } : {}) });
  const groupes = lecture.carte.groupes.filter((g) => g.sorte !== "sources" || lecture.carte.groupes.length <= 2).slice(0, 2);
  const dansGroupes = new Set(groupes.flatMap((g) => g.noeuds));
  const haut = lecture.tries.filter((n) => !dansGroupes.has(n.id)).slice(0, 2);
  if (!haut.some((n) => n.id === detail.id) && !dansGroupes.has(detail.id)) haut.splice(Math.max(0, haut.length - 1), 1, detail);
  const colonnes = groupes.map((g) => {
    const ns = g.noeuds.map((id) => lecture.noeuds.get(id)!).filter(Boolean).sort(parOrdre);
    let garde = ns.slice(-4);
    if (ns.some((n) => n.id === detail.id) && !garde.some((n) => n.id === detail.id)) garde = [detail, ...garde.slice(1)].sort(parOrdre);
    return garde.map(vers);
  });
  return { haut: haut.map(vers), colonnes: colonnes.length ? colonnes : [lecture.tries.filter((n) => !haut.includes(n)).slice(0, 4).map(vers)] };
}

/** Données d'une variante ; `null` : impossible sur cette image (avec la raison). */
function donneesDe(code: CodeOuverture, etape: EtapeVarieteIV, debut: { blocs: BlocRenduIV[]; fin: number }): { donnees: DonneesOuvertureIV } | { raison: string } {
  const lecture = new LectureCarte(etape.carte);
  const duree = arrondi(debut.fin);
  const commun = { situation: etape.carte.automatisation, duree, bascule: arrondi(Math.min(1.3, Math.max(0.6, duree * 0.4))) };
  const refs = etape.fiche.ecrans[0]?.refs ?? [];
  switch (code) {
    case "OUV-A": {
      const depart = lecture.chiffreDuDebut(refs);
      const fin = lecture.chiffreFinal(depart ? lecture.cles.get(depart.c.id) : undefined);
      if (!fin) return { raison: "pas de chiffre final sur l'image" };
      const noeudDepart = depart?.noeud ?? lecture.declencheur ?? lecture.tries[0];
      const libelleFin = libelleSans(fin.noeud, fin.c) ?? (fin.noeud ? null : propre(etape.carte.bandeau[etape.carte.bandeauChiffres.indexOf(fin.c.id)]?.replace(fin.c.brut, "") ?? "")) ?? null;
      const apres = lecture.tries.filter((n) => n.id !== noeudDepart.id && n.ordre >= noeudDepart.ordre).slice(0, 3);
      return {
        donnees: {
          ...commun,
          code,
          resultat: { chiffre: lecture.chiffre(fin.c), libelle: libelleFin || (fin.noeud ? (lecture.groupeDe(fin.noeud)?.titre ?? null) : null), part: fin.c.unite === "%" ? fin.c.valeur : null },
          depart: { chiffre: depart ? lecture.chiffre(depart.c) : null, libelle: libelleSans(noeudDepart, depart?.c) ?? lecture.groupeDe(noeudDepart)?.titre ?? "", icone: iconeDuNoeud(noeudDepart) },
          suite: apres.map(iconeDuNoeud),
        },
      };
    }
    case "OUV-B": {
      const aa = lecture.avantApres();
      if (!aa) return { raison: "pas d'avant / après ni de deux chiffres opposés sur l'image" };
      const cote = (x: { c: ChiffreCarte; noeud?: NoeudCarte }, groupe: "avant" | "apres"): CoteOuvertureIV => {
        const titre = etape.carte.groupes.find((g) => g.sorte === groupe)?.titre ?? null;
        const libre = groupe === "apres" && !titre ? (lecture.moteur ? propre(lecture.moteur.libelle) : null) : libelleSans(x.noeud, x.c);
        return { chiffre: lecture.chiffre(x.c), libelle: titre ?? libre, icone: groupe === "apres" && !titre ? iconeDuNoeud(lecture.moteur) : iconeDuNoeud(x.noeud) };
      };
      return { donnees: { ...commun, code, avant: cote(aa.avant, "avant"), apres: cote(aa.apres, "apres") } };
    }
    case "OUV-C": {
      const h = lecture.heure;
      const objet = lecture.objetQuotidien ?? (h ? lecture.declencheur : undefined);
      if (!h && !objet) return { raison: "ni heure ni objet du quotidien sur l'image" };
      const n = objet ?? lecture.tries[0];
      const chiffreObjet = lecture.chiffresDu(n).find((c) => c.id !== h?.id);
      return {
        donnees: {
          ...commun,
          code,
          heure: h && h.valeur !== null ? { h: Math.floor(h.valeur / 60) % 24, m: h.valeur % 60, texte: h.brut } : null,
          objet: { libelle: libelleSans(n, chiffreObjet) ?? propre(n.libelle), icone: iconeDuNoeud(n) ?? "message", chiffre: chiffreObjet ? lecture.chiffre(chiffreObjet) : null },
          moteur: iconeDuNoeud(lecture.moteur),
        },
      };
    }
    case "OUV-D": {
      const mots = motsDe(lignesDe(debut.blocs, debut.fin), lecture, debut.fin).slice(0, 8);
      if (!mots.length) return { raison: "le premier écran n'a aucun texte" };
      const h = lecture.heure;
      const nuit = !!h && h.valeur !== null && (h.valeur >= 20 * 60 || h.valeur < 6 * 60);
      return { donnees: { ...commun, code, mots, nuit, icone: iconeDuNoeud(lecture.declencheur ?? lecture.tries[0]) } };
    }
    case "OUV-E": {
      const d = lecture.noeudDetail;
      if (!lecture.aUnSchema || !d) return { raison: "pas de schéma sur l'image" };
      const lien = etape.carte.liens.find((l) => l.de === d.id);
      const suivant = lien ? lecture.noeuds.get(lien.vers) : undefined;
      return {
        donnees: {
          ...commun,
          code,
          detail: { libelle: propre(d.libelle), detail: d.detail ? propre(d.detail) || null : null, icone: iconeDuNoeud(d) },
          suivant: iconeDuNoeud(suivant),
          schema: schemaDe(lecture, d),
        },
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* La première phrase et son remplacement                                */
/* ------------------------------------------------------------------ */

/** Fin de la première phrase : fin des plans du premier écran de la fiche, au plus 3,5 s, coupée sur un bloc. */
function premierePhrase(etape: EtapeVarieteIV): { blocs: BlocRenduIV[]; fin: number; coupe: BlocRenduIV | null } | { raison: string } {
  const premier = etape.fiche.ecrans[0]?.id;
  const plans = etape.plans.filter((p) => p.ecran === premier);
  if (!plans.length || !etape.blocs.length) return { raison: "pas de premier écran" };
  let fin = Math.min(DUREE_MAX_OUVERTURE_SEC, Math.max(...plans.map((p) => p.fin)));
  // Un bloc coupé par la fin : un écran se raccourcit ; une toile ou des objets ne se coupent pas (fin avancée à leur début).
  const coupe = etape.blocs.find((b) => b.debut < fin - 1e-6 && b.fin > fin + 1e-6) ?? null;
  if (coupe && coupe.sorte !== "ecran") fin = coupe.debut;
  if (etape.blocs[0].debut > 1e-6 || etape.blocs.some((b) => b.debut < fin && b.sorte === "variete")) return { raison: "le début est déjà un écran de variété" };
  if (fin < DUREE_MIN_OUVERTURE_SEC) return { raison: `première phrase trop courte (${fin.toFixed(2)} s)` };
  return { blocs: etape.blocs.filter((b) => b.debut < fin - 1e-6), fin: arrondi(fin), coupe: coupe?.sorte === "ecran" ? coupe : null };
}

/** Ce que dessine une ouverture : les clés de ses chiffres (l'heure d'OUV-C en minutes) et les nombres de ses textes. */
function chiffresDessines(d: DonneesOuvertureIV): { cles: Set<string>; nombres: Set<string> } {
  const cles = new Set<string>();
  const nombres = new Set<string>();
  const parcourir = (v: unknown, cle: string) => {
    if (typeof v === "string") {
      if (cle === "cle") cles.add(v);
      else for (const n of v.match(/\d+/g) ?? []) nombres.add(n);
    } else if (Array.isArray(v)) for (const x of v) parcourir(x, cle);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) parcourir(x, k);
  };
  parcourir(d, "");
  if (d.code === "OUV-C" && d.heure) cles.add(`${d.heure.h * 60 + d.heure.m}|heure`);
  return { cles, nombres };
}

/**
 * Règle d'or « rien de compté qui ne soit dessiné » (intégration de la variété) : un chiffre du premier écran dit
 * pendant la première phrase est compté « montré » (Q13) ; l'ouverture qui remplace cet écran doit le dessiner aussi (sa
 * clé, ou chacun de ses nombres écrit). OUV-D écrit les mots du premier écran : elle le montre toujours. Le premier
 * chiffre absent, sinon `null`.
 */
function chiffreDitNonMontre(d: DonneesOuvertureIV, etape: EtapeVarieteIV, fin: number): string | null {
  if (d.code === "OUV-D") return null;
  const premier = etape.fiche.ecrans[0]?.id;
  const { cles, nombres } = chiffresDessines(d);
  const montre = (c: { cle: string; brut: string }) => cles.has(c.cle) || (/\d/.test(c.brut) && (c.brut.match(/\d+/g) ?? []).every((n) => nombres.has(n)));
  return etape.chiffresDits.find((c) => c.ecran === premier && c.t < fin - 1e-6 && !montre(c))?.brut ?? null;
}

export const AXE_OUVERTURE: AxeVarieteIV = {
  axe: "ouverture",
  possibles(carte: CarteImage, format: FormatIV) {
    void format;
    const l = new LectureCarte(carte);
    const ok: Record<CodeOuverture, boolean> = {
      "OUV-A": !!l.chiffreFinal(),
      "OUV-B": !!l.avantApres(),
      "OUV-C": !!l.heure || !!l.objetQuotidien,
      "OUV-D": true,
      "OUV-E": l.aUnSchema && !!l.noeudDetail,
    };
    return (Object.keys(ok) as CodeOuverture[]).filter((c) => ok[c]);
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    const code = etape.recette.ouverture;
    const repli = (raison: string): EtapeVarieteIV => ({ ...etape, replis: [...etape.replis, { axe: "ouverture", code, raison }] });
    const debut = premierePhrase(etape);
    if ("raison" in debut) return repli(debut.raison);
    const d = donneesDe(code, etape, debut);
    if ("raison" in d) return repli(d.raison);
    const absent = chiffreDitNonMontre(d.donnees, etape, debut.fin);
    if (absent) return repli(`le chiffre « ${absent} » dit dans la première phrase n'est pas sur cette ouverture`);
    const premier = etape.blocs[0];
    const ouverture: BlocRenduIV = { id: premier.id, debut: 0, fin: debut.fin, ...(premier.variete ? { variete: premier.variete } : {}), sorte: "variete", axe: "ouverture", code, donnees: d.donnees };
    const reste = etape.blocs.filter((b) => b.debut >= debut.fin - 1e-6);
    const coupe =
      debut.coupe && debut.coupe.sorte === "ecran"
        ? [{ ...debut.coupe, id: debut.coupe.id === premier.id ? `${premier.id}-suite` : debut.coupe.id, debut: debut.fin, ecran: { ...debut.coupe.ecran, debutMs: Math.round(debut.fin * 1000) } }]
        : [];
    return { ...etape, blocs: [ouverture, ...coupe, ...reste] };
  },
};

/* ------------------------------------------------------------------ */
/* Affiche : la première image montre le HOOK (aperçu des réseaux)       */
/* ------------------------------------------------------------------ */

/** Nombre d'images (au rythme de la vidéo) pendant lesquelles l'affiche couvre le premier bloc : une seule (40 ms). */
export const IMAGES_AFFICHE_IV = 1;

/**
 * Affiche de la première image (aperçu des réseaux) : l'OUV-D dans son état FINAL (tous les mots de l'accroche posés,
 * un seul mot orange, la marque, « Situation type » si automatisation), sur le fond du premier écran. Elle est posée par
 * dessus le premier bloc pendant `images` image(s) seulement : durée, voix, sous-titres, blocs et événements ne changent pas.
 */
export interface AfficheIV {
  donnees: Extract<DonneesOuvertureIV, { code: "OUV-D" }>;
  fond: "ivoire" | "sombre";
  images: number;
}

/** PUR. `null` : l'accroche n'a aucun texte à écrire. */
export function afficheIV(carte: CarteImage, fiche: FicheImage): AfficheIV | null {
  const lecture = new LectureCarte(carte);
  const lignes = fiche.ecrans.filter((e) => e.partie === "accroche").flatMap((e) => e.textesEcran.map((texte) => ({ texte, t: 0 })));
  const mots = motsDe(lignes, lecture, 99)
    .slice(0, 8)
    .map((m) => ({ ...m, t: 0 }));
  if (!mots.length) return null;
  const h = lecture.heure;
  const nuit = !!h && h.valeur !== null && (h.valeur >= 20 * 60 || h.valeur < 6 * 60);
  const fond = fiche.ecrans[0]?.fond === "ivoire" ? "ivoire" : "sombre";
  return { donnees: { situation: carte.automatisation, duree: 0, bascule: 0, code: "OUV-D", mots, nuit, icone: iconeDuNoeud(lecture.declencheur ?? lecture.tries[0]) }, fond, images: IMAGES_AFFICHE_IV };
}
