/**
 * TOUTES LES CARTES D'UNE VIDÉO FACE CAMÉRA (10/10, fiche « Cartes et effets ») — PUR, aucun réseau.
 *
 * Deux sortes de cartes vivent dans une vidéo :
 *   - celles du MONTEUR (passages `ajouterCarte` / `ecranPartage` / `miseEnPage`, ancrés dans la prise) ;
 *   - les cartes AUTOMATIQUES (`planifierCartesAuto`, d'après les mots dits de la vidéo montée, moitié haute).
 * Avant, la moindre carte du monteur faisait disparaître toutes les cartes automatiques et la fiche ne listait que
 * celles du monteur (« Aucune carte pour l'instant » sur une vidéo qui en portait 6). Désormais elles cohabitent : une
 * carte automatique qui tombe sur une carte du monteur s'efface devant elle (« masquée »).
 *
 * Will agit sur une carte automatique sans appel Claude : la retirer, la déplacer (« à 0:32 »), changer son texte. Ces
 * gestes sont gardés dans `entrees.facecamMonteur.cartesAuto` (ancrés dans la PRISE, comme les passages du monteur) et
 * repérés par une CLÉ stable (modèle + textes d'origine) : une carte retirée ne revient pas à la retouche suivante, même
 * si les cartes automatiques sont replanifiées. Seule la piste habillée est refaite (retouche partielle « carte »).
 *
 * Le monteur du CHAT (vérif V1) retire aussi une carte automatique, par son identifiant stable `auto-…` (`idCarteAuto`,
 * tiré du contenu d'origine) rangé dans `entrees.facecamMonteur.cartesAutoRetirees` : les deux gestes s'additionnent.
 */
import { carteDepuisTextesTous, CONVENTION_TEXTES_TOUS, lireValeur, type CarteMotionTous, type IdModeleMotionTous } from "@/briques/motion";
import { planifierCartesAuto, type MotCarte } from "@/briques/habillage-facecam";
import type { CartePosee } from "./habillage";

/** Geste de Will sur une carte automatique, gardé dans les entrées (temps de la PRISE : stable après une coupe). */
export interface AjustementCarteAuto {
  /** Clé stable de la carte d'origine (`cleCarteAuto`). */
  cle: string;
  retiree?: boolean;
  /** Nouveau début, dans la prise d'origine. */
  debutPriseSec?: number;
  /** Nouveaux textes (convention des 13 modèles, `CONVENTION_TEXTES_TOUS`). */
  textes?: string[];
}

/** Même geste, ramené au temps du MONTAGE (la chaîne le résout d'après les coupes en vigueur). */
export interface AjustementCarteAutoMonte {
  cle: string;
  retiree?: boolean;
  debutSec?: number;
  textes?: string[];
}

export type EtatCarteAuto = "posee" | "retiree" | "masquee";

/** Une carte automatique telle que la fiche la montre (et telle que la chaîne l'a posée). */
export interface CarteAutoVue {
  id: string;
  cle: string;
  /** Vérif V1 : identifiant stable (`idCarteAuto` de la carte d'origine) que le monteur du chat voit et retire. */
  idStable: string;
  modele: IdModeleMotionTous;
  textes: string[];
  debutSec: number;
  finSec: number;
  etat: EtatCarteAuto;
  deplacee?: boolean;
  texteChange?: boolean;
  /** La carte telle qu'elle est posée (petite : textes et instants dits) ; sert à contrôler un nouveau texte. */
  carte: CarteMotionTous;
}

/** Test réel du 11/10 : le texte montré à Will, sans le marqueur `*mot*` (le mot reste en couleur dans la carte rendue). */
export const sansMarqueurs = (texte: string) => texte.replace(/\*([^*\n]+)\*/g, "$1");

/** Nouveaux textes tapés par Will d'après la fiche (sans marqueur) : une ligne inchangée garde son mot en couleur. */
export const garderMarqueurs = (anciens: string[], nouveaux: string[]) => nouveaux.map((t) => anciens.find((a) => a !== t && sansMarqueurs(a) === t) ?? t);

/** Écart minimal entre deux cartes (fin de l'une → début de l'autre), comme les cartes automatiques entre elles. */
export const ECART_CARTES_SEC = 0.3;
/** V6 P0 n° 9 : écart minimal entre une carte du monteur (ou un effet spécial) et une carte automatique (s). */
export const ECART_CARTES_OCCUPEES_SEC = 1;

const nombre = (v: number, decimales?: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: decimales ?? 2 });
const valeurTexte = (v: { valeur: number; unite?: string; decimales?: number; prefixe?: string }) => `${v.prefixe ?? ""}${nombre(v.valeur, v.decimales)}${v.unite ? ` ${v.unite}` : ""}`;
const avecDetail = (titre: string, detail?: string) => (detail ? `${titre} — ${detail}` : titre);
const propre = (t: string | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
/** « Titre — détail » (ou « : ») → titre et détail. */
const titreDetail = (t: string) => {
  const m = /^(.*?)\s+[—–-]\s+(.*)$/.exec(propre(t));
  return m ? { titre: propre(m[1]), detail: propre(m[2]) } : { titre: propre(t) };
};

type Donnees = Record<string, unknown>;
/** Champs de texte simples d'un modèle, dans l'ordre où la fiche les montre (seuls ceux présents sont montrés). */
const CHAMPS_SIMPLES: Partial<Record<IdModeleMotionTous, string[]>> = {
  titre: ["titre", "sousTitre", "surTitre"],
  "titre-plein-ecran": ["titre", "sousTitre", "surTitre"],
  "icone-mot": ["mot", "sousTitre", "surTitre"],
};
/** Modèles « titre + éléments » : le titre (s'il existe) puis un élément par ligne. */
const LISTES: Partial<Record<IdModeleMotionTous, { cle: string; champ: string }>> = {
  liste: { cle: "elements", champ: "texte" },
  "check-list": { cle: "elements", champ: "texte" },
  "ligne-de-temps": { cle: "etapes", champ: "titre" },
};

/**
 * Textes d'une carte, un par ligne, tels que la fiche les montre et que Will les corrige. Pour les modèles courants
 * des cartes automatiques (liste, check-list, ligne de temps, chiffre, titre, icône + mot, problème → solution), ce
 * sont les champs PRÉSENTS de la carte, dans l'ordre ; pour les autres, la convention des 13 modèles.
 */
export function textesDeCarte(carte: CarteMotionTous): string[] {
  const d = carte.donnees as unknown as Donnees;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? [x.trim()] : []);
  const simples = CHAMPS_SIMPLES[carte.modele];
  if (simples) return simples.flatMap((c) => s(d[c]));
  const liste = LISTES[carte.modele];
  if (liste) return [...s(d.titre), ...((d[liste.cle] as Donnees[]) ?? []).map((e) => (carte.modele === "ligne-de-temps" ? avecDetail(String(e.titre ?? ""), e.detail as string | undefined) : String(e[liste.champ] ?? "")))];
  switch (carte.modele) {
    case "chiffre":
      return [valeurTexte(d as unknown as { valeur: number }), ...s(d.libelle), ...s(d.surTitre)];
    case "probleme-solution": {
      const f = (x: { titre: string; detail?: string }) => avecDetail(x.titre, x.detail);
      return [f(d.probleme as { titre: string }), f(d.solution as { titre: string })];
    }
    case "avant-apres": {
      const a = d.avant as { valeur: number; unite?: string; libelle?: string };
      const b = d.apres as { valeur: number; unite?: string; libelle?: string };
      const fin = [d.titre ?? "", a.libelle ?? "", b.libelle ?? ""] as string[];
      while (fin.length && !fin[fin.length - 1]) fin.pop();
      return [valeurTexte(a), valeurTexte(b), ...fin];
    }
    case "deux-colonnes": {
      const col = (c: { titre?: string; points: string[] }) => `${c.titre ?? ""} : ${c.points.join(" ; ")}`;
      return [col(d.gauche as { titre: string; points: string[] }), col(d.droite as { titre: string; points: string[] }), col(d.commun as { titre?: string; points: string[] }), ...s(d.titre)];
    }
    case "graphique":
      return [...s(d.titre), ...((d.series as { libelle: string; valeur: number }[]) ?? []).map((x) => `${x.libelle} : ${nombre(x.valeur)}${d.unite ? ` ${d.unite}` : ""}`)];
    case "capture-annotee":
      return [...s(d.titre), ...((d.annotations as { type: string; etiquette?: string }[]) ?? []).map((a) => `${a.type} : ${a.etiquette ?? ""}`)];
    case "documentaire": {
      const c = d.chiffre as { valeur: number; unite?: string; libelle: string; decimales?: number } | undefined;
      return [...s(d.lieu), ...s(d.date), ...(c ? [avecDetail(valeurTexte(c), c.libelle)] : []), ...s(d.contexte)];
    }
    default:
      return [];
  }
}

/**
 * Nouveaux textes posés DANS la carte d'origine (icônes, numérotation, instants dits et sur-titres gardés) ; pour un
 * modèle sans correspondance simple, la carte est refaite depuis ses textes (`carteDepuisTextesTous`). Null : les
 * textes ne tiennent pas dans ce modèle.
 */
function remplacerTextes(carte: CarteMotionTous, textes: string[]): CarteMotionTous | null {
  const d = structuredClone(carte.donnees) as unknown as Donnees;
  const lignes = textes.map(propre).filter(Boolean);
  const simples = CHAMPS_SIMPLES[carte.modele];
  if (simples) {
    const presents = simples.filter((c) => typeof d[c] === "string" && propre(d[c] as string));
    // Une ligne de plus qu'avant remplit le premier champ facultatif absent (sous-titre, puis sur-titre).
    const champs = [...presents, ...simples.filter((c) => !presents.includes(c))].slice(0, Math.max(presents.length, Math.min(lignes.length, simples.length)));
    champs.forEach((c, i) => {
      if (lignes[i]) d[c] = lignes[i];
      else if (c !== simples[0]) delete d[c];
    });
    if (!lignes[0]) return null;
    if (typeof d.motCle === "string" && !String(d[simples[0]]).toLowerCase().includes(d.motCle.toLowerCase())) delete d.motCle;
    return { ...carte, donnees: d } as unknown as CarteMotionTous;
  }
  const liste = LISTES[carte.modele];
  if (liste) {
    const avecTitre = typeof d.titre === "string" && !!propre(d.titre as string);
    const elements = avecTitre ? lignes.slice(1) : lignes;
    if (elements.length < 2) return null;
    if (avecTitre) d.titre = lignes[0];
    const anciens = (d[liste.cle] as Donnees[]) ?? [];
    d[liste.cle] = elements.slice(0, 6).map((t, i) => (carte.modele === "ligne-de-temps" ? { ...(anciens[i] ?? {}), ...titreDetail(t), ...(titreDetail(t).detail ? {} : { detail: undefined }) } : { ...(anciens[i] ?? {}), [liste.champ]: t }));
    return { ...carte, donnees: JSON.parse(JSON.stringify(d)) } as unknown as CarteMotionTous;
  }
  if (carte.modele === "chiffre") {
    const v = lignes[0] ? lireValeur(lignes[0]) : null;
    if (!v || !lignes[1]) return null;
    Object.assign(d, { valeur: v.valeur, decimales: v.decimales, libelle: lignes[1] });
    if (v.unite) d.unite = v.unite;
    else delete d.unite;
    if (v.prefixe) d.prefixe = v.prefixe;
    else delete d.prefixe;
    if (lignes[2]) d.surTitre = lignes[2];
    else delete d.surTitre;
    return { ...carte, donnees: d } as unknown as CarteMotionTous;
  }
  if (carte.modele === "probleme-solution") {
    if (lignes.length < 2) return null;
    const [p, s] = [titreDetail(lignes[0]), titreDetail(lignes[1])];
    d.probleme = { ...(d.probleme as Donnees), titre: p.titre, detail: p.detail };
    d.solution = { ...(d.solution as Donnees), titre: s.titre, detail: s.detail };
    return { ...carte, donnees: JSON.parse(JSON.stringify(d)) } as unknown as CarteMotionTous;
  }
  return carteDepuisTextesTous(carte.modele, lignes);
}

/** Empreinte courte (FNV-1a 32 bits) : seulement l'égalité, aucune sécurité. */
function hacher(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/** Clé stable d'une carte automatique : son modèle et ses textes (sans les instants, qui bougent avec les coupes). */
export function cleCarteAuto(carte: CarteMotionTous): string {
  const textes = textesDeCarte(carte).map((t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim());
  return `ca-${hacher(`${carte.modele}|${textes.join("|")}`)}`;
}

/** Textes d'une carte du catalogue, à la suite (« Les soirées sur les devis · Les relances à la main »). */
export function texteCarteMotion(carte: CarteMotionTous): string {
  const textes: string[] = [];
  const parcourir = (v: unknown, cle?: string) => {
    if (typeof v === "string") {
      if (cle !== "modele" && cle !== "icone" && cle !== "variante" && v.trim()) textes.push(v.trim());
    } else if (typeof v === "number" && cle === "valeur") textes.push(String(v));
    else if (Array.isArray(v)) v.forEach((x) => parcourir(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) parcourir(x, k);
  };
  parcourir(carte);
  return textes.join(" · ").slice(0, 200);
}

/** Vérif V1 : identifiant STABLE d'une carte automatique, tiré de son contenu (le même après une coupe ou un rétablissement). */
export function idCarteAuto(carte: CarteMotionTous): string {
  const t = `${carte.modele}|${texteCarteMotion(carte)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
  return `auto-${h.toString(16).padStart(8, "0")}`;
}

/** Nouveaux textes d'une carte : la carte modifiée, ou un message simple si le modèle ne peut pas les porter. */
export function carteAvecTextes(carte: CarteMotionTous, textes: string[]): { carte: CarteMotionTous } | { message: string } {
  const lignes = textes.slice(0, 8);
  if (!lignes.some((t) => propre(t))) return { message: "Écrivez le texte de la carte." };
  const nouvelle = remplacerTextes(carte, lignes);
  return nouvelle ? { carte: nouvelle } : { message: `Ce texte ne tient pas dans cette carte. Elle attend : ${CONVENTION_TEXTES_TOUS[carte.modele]}.` };
}

const chevauche = (a: { debutSec: number; finSec: number }, b: { debutSec: number; finSec: number }, ecart = ECART_CARTES_SEC) => a.debutSec < b.finSec + ecart - 1e-6 && a.finSec > b.debutSec - ecart + 1e-6;

/**
 * Cartes automatiques de la vidéo montée, gestes de Will appliqués, sans chevaucher les cartes du monteur
 * (`occupees`, temps du montage). Rend les cartes à poser (habillage) et la vue de chacune (fiche « Cartes »).
 * Une carte déplacée par Will passe avant les autres cartes automatiques (celle qu'elle recouvre est masquée).
 */
export function cartesAutoDeLaVideo(mots: MotCarte[], dureeSec: number, ajustements: AjustementCarteAutoMonte[] = [], occupees: { debutSec: number; finSec: number }[] = [], retireesChat: string[] = []): { posees: CartePosee[]; vues: CarteAutoVue[] } {
  const parCle = new Map(ajustements.map((a) => [a.cle, a]));
  const retirees = new Set(retireesChat);
  const vus = new Set<string>();
  const candidates = planifierCartesAuto(mots, dureeSec).map((p, i) => {
    const cle = cleCarteAuto(p.carte);
    const idStable = idCarteAuto(p.carte);
    // Vérif V1 : deux cartes identiques ne sont posées qu'une fois (la seconde est masquée).
    const doublon = vus.has(idStable);
    vus.add(idStable);
    const a = parCle.get(cle);
    let carte = p.carte;
    let texteChange = false;
    if (a?.textes?.length) {
      const r = carteAvecTextes(p.carte, a.textes);
      if ("carte" in r) {
        carte = r.carte;
        texteChange = true;
      }
    }
    const duree = p.finSec - p.debutSec;
    let debutSec = p.debutSec;
    let deplacee = false;
    if (a?.debutSec !== undefined && Number.isFinite(a.debutSec)) {
      debutSec = +Math.min(Math.max(0, a.debutSec), Math.max(0, dureeSec - duree)).toFixed(3);
      deplacee = Math.abs(debutSec - p.debutSec) > 1e-3;
    }
    const etat: EtatCarteAuto = a?.retiree || retirees.has(idStable) ? "retiree" : doublon ? "masquee" : "posee";
    const vue: CarteAutoVue = { id: `auto-${i + 1}`, cle, idStable, modele: carte.modele, textes: textesDeCarte(carte), debutSec, finSec: +(debutSec + duree).toFixed(3), etat, carte, ...(deplacee ? { deplacee } : {}), ...(texteChange ? { texteChange } : {}) };
    return { vue, carte };
  });
  const prises: { debutSec: number; finSec: number }[] = [];
  const ordre = [...candidates].sort((x, y) => Number(!!y.vue.deplacee) - Number(!!x.vue.deplacee) || x.vue.debutSec - y.vue.debutSec);
  for (const c of ordre) {
    if (c.vue.etat !== "posee") continue;
    // Cartes du monteur et effets : ECART_CARTES_OCCUPEES_SEC (V6) ; entre cartes automatiques : ECART_CARTES_SEC.
    if (occupees.some((o) => chevauche(c.vue, o, ECART_CARTES_OCCUPEES_SEC)) || prises.some((o) => chevauche(c.vue, o))) {
      c.vue.etat = "masquee";
      continue;
    }
    prises.push(c.vue);
  }
  const vues = candidates.map((c) => c.vue);
  const posees: CartePosee[] = candidates.filter((c) => c.vue.etat === "posee").map((c) => ({ id: c.vue.id, debutSec: c.vue.debutSec, finSec: c.vue.finSec, disposition: "moitie-haute" as const, carte: c.carte }));
  return { posees, vues };
}

/** Instant de la prise → instant du montage, d'après les passages GARDÉS (dans une coupe : le raccord). */
export function priseVersMonteeGardes(sec: number, gardes: { debutSec: number; finSec: number }[]): number {
  let t = 0;
  for (const g of gardes) {
    if (sec < g.debutSec) return +t.toFixed(3);
    if (sec <= g.finSec) return +(t + sec - g.debutSec).toFixed(3);
    t += g.finSec - g.debutSec;
  }
  return +t.toFixed(3);
}

/** Gestes de Will (temps de la prise) ramenés au temps du montage. */
export function ajustementsAuMontage(ajustements: AjustementCarteAuto[], versMontee: (priseSec: number) => number): AjustementCarteAutoMonte[] {
  return ajustements.map((a) => ({ cle: a.cle, ...(a.retiree ? { retiree: true } : {}), ...(a.debutPriseSec !== undefined && Number.isFinite(a.debutPriseSec) ? { debutSec: versMontee(a.debutPriseSec) } : {}), ...(a.textes?.length ? { textes: a.textes } : {}) }));
}

/** Instant de la vidéo montée lu dans « 0:32 », « 32 », « 1:05,5 » ; null sinon. */
export function lireInstant(texte: string): number | null {
  const m = /^\s*(?:(\d{1,2})\s*[:h'’]\s*)?(\d{1,3}(?:[.,]\d+)?)\s*s?\s*$/i.exec(texte);
  if (!m) return null;
  const sec = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2].replace(",", "."));
  return Number.isFinite(sec) ? sec : null;
}
