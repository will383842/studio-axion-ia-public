/**
 * PROPRIÉTÉS DES SCÈNES (TB-05) : de la mise en page (`mettreEnPage`), de la fiche calée et des heures du calage, aux
 * propriétés de chaque `TableauScene`. PUR. N'importe rien de `src/moteurs/` : les entrées ont les types recopiés
 * (`types.ts`). Sert à la commande de fabrication (TB-06) et aux tests.
 */
import { TRACES_DESSINS } from "../dessins/traces";
import { STYLOS } from "../stylo/registre";
import { bulleReservee } from "./plan";
import { VERSION_TABLEAU_SCENE, type ContenuPreuve, type ElementCale, type MiseEnPageTableau, type ProprietesTableauScene, type ProprietesV2, type SceneCalee } from "./types";
import { TENUE_FIN_TOTALE_MS } from "./v2/charte";
import type { ProprietesReference } from "./reference/types";
import { COULEURS_REFERENCE_3, chapitresDesParties3, nomChapitre3 } from "./reference/charte";

export interface EntreeScenes {
  miseEnPage: MiseEnPageTableau;
  /** Scènes de la fiche CALÉE, dans l'ordre (`debutMs` et `finMs` posés). */
  scenes: readonly SceneCalee[];
  /** Heures des éléments (sortie `elements` du calage). */
  heures: readonly ElementCale[];
  /** Stylo de la fiche (« crayon/1 »). */
  stylo: string;
  importants?: Record<string, string[]>;
  preuves?: Record<string, ContenuPreuve>;
  fps?: number;
  /**
   * Style « blocs/2 » (facultatif) : mots horodatés de la voix maître (`AudioMaitre.mots`). Donnés, la scène dessine
   * les sous-titres mot à mot dans leur pastille et fait claquer chaque mot fort sur le mot dit ; absents, les mots
   * forts suivent leur ligne et la scène ne dessine pas de sous-titres.
   */
  mots?: readonly { mot: string; debutSec: number; finSec: number }[];
  /**
   * Style « reference/3 » (facultatif) : heures fines lues dans la voix (`tempsReference3` du moteur) — fin dite de
   * chaque bloc, mots importants, mot d'après d'une transformation. Absentes : le rendu garde son rythme naturel.
   */
  temps3?: Readonly<Record<string, number>>;
}

/** Début de chaque écran du style « blocs/2 » (le premier d'une scène part avec elle, le suivant à son heure). */
function tempsEcrans(entree: EntreeScenes): Record<string, { debutMs: number; finMs: number }> {
  const v = entree.miseEnPage.styleV2!;
  const heures = new Map(entree.heures.map((h) => [h.elementId, h.debutMs]));
  const debuts = v.ecrans.map((e) => {
    const s = entree.scenes.find((x) => x.id === e.sceneId);
    const premier = v.ecrans.find((x) => x.sceneId === e.sceneId) === e;
    return premier ? (s?.debutMs ?? 0) : (heures.get(e.id) ?? s?.debutMs ?? 0);
  });
  const fin = entree.scenes[entree.scenes.length - 1]?.finMs ?? 0;
  return Object.fromEntries(v.ecrans.map((e, i) => [e.id, { debutMs: debuts[i], finMs: Math.max(debuts[i] + 1, i + 1 < debuts.length ? debuts[i + 1] : fin) }]));
}

/** Propriétés « blocs/2 » d'une scène : les écrans qu'elle montre (et celui d'avant, sous le balayage). */
function proprietesV2(entree: EntreeScenes, s: SceneCalee, temps: Record<string, { debutMs: number; finMs: number }>): ProprietesV2 {
  const v = entree.miseEnPage.styleV2!;
  const debut = s.debutMs ?? 0;
  const fin = s.finMs ?? debut;
  const montres = v.ecrans.filter((e) => temps[e.id].debutMs < fin && temps[e.id].finMs > debut);
  const premier = montres[0] ? v.ecrans.indexOf(montres[0]) : -1;
  const ecrans = premier > 0 && temps[montres[0].id].debutMs >= debut ? [v.ecrans[premier - 1], ...montres] : montres;
  const sources = new Set<string>();
  for (const e of ecrans) for (const x of [...e.textes, ...e.formes, ...e.traits]) sources.add(x.source);
  for (const e of ecrans) sources.add(e.id);
  const heures = Object.fromEntries(entree.heures.filter((h) => sources.has(h.elementId)).map((h) => [h.elementId, h.debutMs]));
  const finVideoMs = entree.scenes[entree.scenes.length - 1]?.finMs ?? fin;
  const derniers = entree.mots?.length ? Math.round(entree.mots[entree.mots.length - 1].finSec * 1000) : null;
  const finVoixMs = derniers ?? Math.max(0, finVideoMs - TENUE_FIN_TOTALE_MS);
  const mots = entree.mots
    ?.filter((m) => m.finSec * 1000 >= debut - 4000 && m.debutSec * 1000 <= fin + 500)
    .map((m) => ({ mot: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(m.finSec * 1000) }));
  return {
    style: "blocs/2",
    geometrie: v.geometrie,
    ecrans,
    temps: Object.fromEntries(ecrans.map((e) => [e.id, temps[e.id]])),
    heures,
    etapes: v.etapes,
    finVoixMs,
    finVideoMs,
    ...(mots ? { mots } : {}),
  };
}

/**
 * Styles « reference/1 » et « reference/2 » : heures de tout ce qui est ÉCRIT (un texte écrit une fois sur la page n'a plus d'heure à lui ;
 * un bloc ajouté par la fin s'écrit à la suite de sa scène), et ce que chaque scène reçoit en plus (le plan du crayon
 * se calcule page par page : heures et scènes de la page).
 */
function heuresReference(entree: EntreeScenes): ElementCale[] {
  const mp = entree.miseEnPage;
  const places = new Set(mp.pages.flatMap((p) => [...p.elements.map((e) => e.elementId), ...p.gestes.map((g) => g.elementId)]));
  const gardees = entree.heures.filter((h) => places.has(h.elementId)).map((h) => ({ ...h }));
  // La phrase de la fin (TikTok et Shorts) s'écrit quand la voix la dit (son premier mot, dans la scène), le site
  // juste après elle ; sans les mots de la voix : à la suite de la scène.
  const dites = new Map<string, number>();
  const ajouts = (mp.styleReference?.ajouts ?? []).flatMap((id) => {
    const el = mp.pages.flatMap((p) => p.elements).find((e) => e.elementId === id);
    if (!el) return [];
    const s = entree.scenes.find((x) => x.id === el.sceneId);
    const ici = gardees.filter((h) => h.sceneId === el.sceneId).map((h) => h.debutMs);
    const dite = id.endsWith("~phrase") ? heureDite(entree, el.lignes[0]?.texte ?? "", s) : dites.get(el.sceneId);
    if (dite !== undefined) dites.set(el.sceneId, dite);
    return [{ elementId: id, sceneId: el.sceneId, debutMs: dite ?? Math.max(s?.debutMs ?? 0, ...ici) }];
  });
  // Style « reference/2 » : ce que le gabarit pose (repère, bandeau, étiquettes, puces, titre rappelé) part avec
  // l'élément qu'il suit, sinon au début de sa scène.
  const suivent = mp.styleReference?.suivent ?? {};
  const connues = new Map([...gardees, ...ajouts].map((h) => [h.elementId, h.debutMs]));
  const poses = Object.entries(suivent).flatMap(([id, parent]) => {
    const el = mp.pages.flatMap((p) => p.elements).find((e) => e.elementId === id);
    if (!el || connues.has(id)) return [];
    const s = entree.scenes.find((x) => x.id === el.sceneId);
    return [{ elementId: id, sceneId: el.sceneId, debutMs: (parent ? connues.get(parent) : undefined) ?? s?.debutMs ?? 0 }];
  });
  // Scène de la phrase dite : ce qu'elle écrit avant la phrase part dès son début (le crayon a fini quand la voix dit
  // la phrase de la fin ; le rythme réparti de la fiche ne savait pas qu'elle s'écrit).
  for (const h of gardees) {
    const dite = dites.get(h.sceneId);
    const s = dite !== undefined ? entree.scenes.find((x) => x.id === h.sceneId) : undefined;
    if (s?.debutMs !== undefined && h.debutMs < dite!) h.debutMs = s.debutMs;
  }
  const toutes = [...gardees, ...ajouts, ...poses];
  if (mp.styleReference?.style === "reference/3") return posesALaCoupe(entree, toutes);
  return mp.styleReference?.style === "reference/2" ? titreALaCoupe(entree, toutes) : toutes;
}

/** Clé d'un mot pour le comparer à un mot dit (minuscules, sans accents ni ponctuation). */
const cleDite = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Heure (ms) où la voix dit le premier mot de `texte` dans la scène (sa dernière occurrence) ; absente sans les mots. */
function heureDite(entree: EntreeScenes, texte: string, s: SceneCalee | undefined): number | undefined {
  const premier = cleDite(texte.split(/\s+/).find((m) => cleDite(m)) ?? "");
  if (!premier || !s || s.debutMs === undefined || s.finMs === undefined) return undefined;
  const dit = entree.mots?.findLast((m) => m.debutSec * 1000 >= s.debutMs! - 50 && m.debutSec * 1000 < s.finMs! && cleDite(m.mot) === premier);
  return dit ? Math.max(s.debutMs, Math.round(dit.debutSec * 1000)) : undefined;
}

/** Une pastille écrite dans les 0,3 s de la coupe garde le mot où la voix dit le numéro ; au-delà, elle part avec le titre. */
export const PAGE_VIDE_MAX_MS = 300;

/**
 * Style « reference/2 » (14/10, regard de Will sur la première vraie vidéo : « des moments de page vide ») : à chaque
 * nouvelle page, le TITRE (et la pastille d'une étape) s'écrit dès la coupe, sans attendre son mot ; la pastille garde
 * le mot où la voix dit le numéro s'il tombe dans les 0,3 s de la coupe, sinon elle part à la coupe, juste avant le
 * titre. Le dessin et le reste de la première scène de la page viennent après le titre.
 */
function titreALaCoupe(entree: EntreeScenes, heures: ElementCale[]): ElementCale[] {
  const res = heures.map((h) => ({ ...h }));
  const de = new Map(res.map((h) => [h.elementId, h]));
  for (const page of entree.miseEnPage.pages) {
    const s0 = entree.scenes.find((x) => x.page === page.page);
    if (!s0 || s0.debutMs === undefined) continue;
    const coupe = s0.debutMs;
    const titre = page.elements.find((e) => e.gabarit?.sorte === "titre" && e.sceneId === s0.id);
    const hTitre = titre && de.get(titre.elementId);
    if (!titre || !hTitre) continue;
    const pastille = page.elements.find((e) => e.gabarit?.sorte === "pastille" && e.sceneId === s0.id);
    const hPastille = pastille && de.get(pastille.elementId);
    if (hPastille && hPastille.debutMs > coupe + PAGE_VIDE_MAX_MS) hPastille.debutMs = coupe;
    const depart = hPastille ? Math.max(coupe, hPastille.debutMs) : coupe;
    hTitre.debutMs = Math.min(hTitre.debutMs, depart);
    // Ce qui partait avant le titre (ou avec lui, posé plus haut : le dessin du haut de la page) part après lui.
    for (const e of page.elements) {
      const h = de.get(e.elementId);
      if (!h || e === titre || e === pastille || e.sceneId !== s0.id) continue;
      if (h.debutMs < hTitre.debutMs || (h.debutMs === hTitre.debutMs && e.ordre < titre.ordre)) h.debutMs = hTitre.debutMs + 1;
    }
  }
  return res;
}

/**
 * Style « reference/3 » : ce qui arrive avec la page (étiquette, titre, premier bloc, accroche, page d'appel) part à
 * la coupe de la page (ou au début de sa scène, si elle vient plus tard sur la page).
 */
function posesALaCoupe(entree: EntreeScenes, heures: ElementCale[]): ElementCale[] {
  const poses = new Set(entree.miseEnPage.styleReference?.poses ?? []);
  return heures.map((h) => {
    if (!poses.has(h.elementId)) return h;
    const s = entree.scenes.find((x) => x.id === h.sceneId);
    return { ...h, debutMs: s?.debutMs ?? h.debutMs };
  });
}

/**
 * Style « reference/3 » : les CHAPITRES de la vidéo, dans l'ordre (id, nom, début, fin), pour la barre des chapitres
 * nommés (règle de rattachement de l'accroche et de « À retenir » : `chapitresDesParties3`). Deux pages de suite du
 * même chapitre ne font qu'une barre.
 */
function partiesVideo(entree: EntreeScenes): { role: string; nom: string; couleur: string; debutMs: number; finMs: number }[] {
  const r = entree.miseEnPage.styleReference!;
  const res: { role: string; nom: string; couleur: string; debutMs: number; finMs: number }[] = [];
  const fin = entree.scenes[entree.scenes.length - 1]?.finMs ?? 0;
  const chapitres = chapitresDesParties3(entree.scenes.map((s) => r.parties?.[s.page] ?? ""));
  entree.scenes.forEach((s, i) => {
    const role = chapitres[i];
    const der = res.at(-1);
    if (der && der.role === role) return;
    if (der) der.finMs = s.debutMs ?? der.finMs;
    res.push({ role, nom: nomChapitre3(role), couleur: COULEURS_REFERENCE_3.encre, debutMs: s.debutMs ?? 0, finMs: fin });
  });
  return res;
}

function proprietesReference(entree: EntreeScenes, s: SceneCalee, k: number, heures: readonly ElementCale[]): ProprietesReference {
  const mp = entree.miseEnPage;
  const r = mp.styleReference!;
  const scenes = entree.scenes;
  const surPage = scenes.filter((x) => x.page === s.page);
  const ids = new Set(surPage.map((x) => x.id));
  const finVideoMs = scenes[scenes.length - 1]?.finMs ?? 0;
  const derniers = entree.mots?.length ? Math.round(entree.mots[entree.mots.length - 1].finSec * 1000) : null;
  const premiere = scenes[0];
  const page = mp.pages.find((p) => p.page === s.page);
  // Phrase de la fin de TikTok et Shorts, dite par la voix : écrite à son heure (style « reference/2 », mots connus).
  const aLHeure = r.style === "reference/2" && entree.mots?.length ? (r.ajouts ?? []).filter((id) => id.endsWith("~phrase") && page?.elements.some((e) => e.elementId === id)) : [];
  // Accroche de la première image : le premier bloc écrit de la première scène, s'il part avec elle.
  const accroche =
    premiere && premiere.page === s.page
      ? page?.elements
          .filter((e) => e.sceneId === premiere.id && e.type !== "dessin")
          .sort((a, b) => a.ordre - b.ordre)
          .find((e) => (heures.find((h) => h.elementId === e.elementId)?.debutMs ?? -1) <= (premiere.debutMs ?? 0))?.elementId
      : undefined;
  return {
    style: r.style,
    k,
    signature: r.pagesSansSignature.includes(s.page) ? null : r.signature,
    finVoixMs: derniers ?? Math.max(0, finVideoMs - TENUE_FIN_TOTALE_MS),
    finVideoMs,
    derniere: s === scenes[scenes.length - 1],
    heuresPage: Object.fromEntries(heures.filter((h) => ids.has(h.sceneId)).map((h) => [h.elementId, h.debutMs])),
    scenesPage: surPage.map((x) => ({ id: x.id, debutMs: x.debutMs ?? 0, finMs: x.finMs ?? 0 })),
    ...(accroche ? { accroche } : {}),
    pageFinale: surPage.includes(scenes[scenes.length - 1]),
    ...(aLHeure.length ? { aLHeure } : {}),
    ...(r.style === "reference/3" ? proprietes3(entree, s, page) : {}),
  };
}

/** Style « reference/3 » : heures fines de la page, ce qui arrive avec elle, la barre et les parties, la coupe. */
function proprietes3(entree: EntreeScenes, s: SceneCalee, page: { elements: { elementId: string; gabarit?: { sorte: string } }[] } | undefined): Partial<ProprietesReference> {
  const r = entree.miseEnPage.styleReference!;
  const ids = new Set((page?.elements ?? []).map((e) => e.elementId));
  const temps3 = Object.fromEntries(Object.entries(entree.temps3 ?? {}).filter(([id]) => ids.has(id.split("~")[0]) || ids.has(id.replace(/~(fin|vers|debut|cle|mot:\d+|motfin:\d+)$/, ""))));
  const poses = (r.poses ?? []).filter((id) => ids.has(id.replace(/#attente$/, "")));
  // Trois styles : la page reste finie jusqu'à l'arrivée de la suivante (un peu après sa coupe).
  const suivante = r.tableau ? entree.scenes.find((x) => x.page > s.page) : undefined;
  const precedente = r.tableau ? [...entree.scenes].reverse().find((x) => x.page < s.page) : undefined;
  const pageSuivante = suivante ? entree.miseEnPage.pages.find((p) => p.page === suivante.page) : undefined;
  const finPageMs = pageSuivante ? debutPage3(entree, pageSuivante.page, pageSuivante, (r.poses ?? []).filter((id) => pageSuivante.elements.some((e) => e.elementId === id.replace(/#attente$/, "")))) : undefined;
  return { temps3, poses, ...(r.barre ? { barre: r.barre } : {}), ...(r.nomsChapitres ? { nomsChapitres: r.nomsChapitres } : {}), parties: partiesVideo(entree), debutPageMs: debutPage3(entree, s.page, page, poses), ...(finPageMs !== undefined ? { finPageMs } : {}), ...(r.tableau ? { tableau: { ...r.tableau, partie: r.parties?.[s.page] ?? "", ...(precedente ? { partieAvant: r.parties?.[precedente.page] ?? "" } : {}) } } : {}) };
}

/**
 * Trois styles du tableau (critique #291, I1) : la page suivante arrive… (ms) après sa coupe — la voix y dit le numéro
 * (« Deux. ») pendant que la page finie reste à l'écran, l'outil sorti ; puis la brosse efface.
 */
export const RETARD_PAGE_TABLEAU_MS = 350;

/** Avance (ms) de l'arrivée d'une page sur le premier mot de sa première phrase dite. */
export const AVANCE_PAGE_3_MS = 150;
/** En deçà de cet écart (ms) entre la coupe et la première phrase, la page arrive à sa coupe. */
export const ATTENTE_PAGE_3_MIN_MS = 700;
/**
 * La page d'avant reste au plus… (ms) de plus (la voix a déjà commencé la partie suivante) ; au-delà, la page arrive,
 * son titre ET sa première phrase ensemble. Sans limite pour la page d'appel.
 */
export const ATTENTE_PAGE_3_MAX_MS = 2000;

/**
 * Style « reference/3 » : l'heure où la page arrive (15/10, « des pages presque vides ») : la coupe de sa première
 * scène, ou plus tard, quand la voix commence à dire le premier bloc qui arrive avec la page (la phrase qui suit le
 * titre, le premier détail de la page d'appel…) ; jusque-là, la page d'avant reste affichée. Un écart de moins de
 * 0,7 s est négligé et l'attente est de 2 s au plus, sauf pour la page d'appel. Jamais après la fin de la première scène de la page (moins 0,6 s) ; la
 * première page arrive à 0.
 */
export function debutPage3(entree: EntreeScenes, numero: number, page: { elements: { elementId: string; gabarit?: { sorte: string } }[] } | undefined, poses: readonly string[]): number {
  const k = entree.scenes.findIndex((x) => x.page === numero);
  const s0 = entree.scenes[k];
  const coupe = s0?.debutMs ?? 0;
  if (k <= 0 || !page) return coupe;
  const t3 = entree.temps3 ?? {};
  if (entree.miseEnPage.styleReference?.tableau) {
    const base = Math.max(coupe, Math.min(coupe + RETARD_PAGE_TABLEAU_MS, (s0.finMs ?? coupe) - 600));
    // La page d'appel n'arrive jamais avant que la voix commence la phrase qu'elle écrit (une phrase dite d'abord et non
    // écrite la laissait 1,2 s d'avance), et reste entière 2,5 s au moins avant la fin.
    if (!page.elements.some((e) => e.gabarit?.sorte === "appel-plein")) return Math.round(base);
    const debuts = page.elements.map((e) => t3[`${e.elementId}~debut`]).filter((v): v is number => v !== undefined);
    const fin = Math.max(...entree.scenes.filter((x) => x.page === numero).map((x) => x.finMs ?? coupe));
    return Math.round(debuts.length ? Math.max(base, Math.min(Math.min(...debuts) - 100, fin - 2900)) : base);
  }
  const avec = new Set(poses);
  const debuts = page.elements
    .filter((e) => avec.has(e.elementId) && !["partie", "titre", "pastille", "accroche"].includes(e.gabarit?.sorte ?? ""))
    .map((e) => t3[`${e.elementId}~debut`])
    .filter((v): v is number => v !== undefined);
  if (!debuts.length) return coupe;
  const voulu = Math.min(...debuts) - AVANCE_PAGE_3_MS;
  // Un écart court (« Deux. » dit juste avant la phrase) : la page arrive à sa coupe, la phrase avec elle. La page
  // d'appel, elle, n'arrive jamais avant que la voix commence sa phrase (Axion, puis l'appel).
  const appel = page.elements.some((e) => e.gabarit?.sorte === "appel-plein");
  if (!appel && voulu - coupe < ATTENTE_PAGE_3_MIN_MS) return coupe;
  return Math.round(Math.max(coupe, Math.min(voulu, appel ? Infinity : coupe + ATTENTE_PAGE_3_MAX_MS, (s0.finMs ?? coupe) - 600)));
}

/**
 * Dimensions d'image acceptées pour une scène : celles des formats de sortie du tableau (table
 * `src/moteurs/montage-tableau/formats-sortie.ts`, recopiées ici : la brique n'importe rien de `src/moteurs/` ; un test
 * vérifie qu'elles sont égales).
 */
export const DIMENSIONS_SCENES: readonly { largeur: number; hauteur: number }[] = Object.freeze([
  { largeur: 1080, hauteur: 1920 },
  { largeur: 1080, hauteur: 1350 },
  { largeur: 1080, hauteur: 1080 },
  { largeur: 1920, hauteur: 1080 },
]);

/** Cadences acceptées (i/s) : 25 (style « charte-video/1 », défaut) et 30 (style « blocs/2 », celle de la vidéo modèle). */
export const CADENCES_SCENES: readonly number[] = Object.freeze([25, 30]);

/** Propriétés de toutes les scènes d'une vidéo, dans l'ordre. Lève une erreur claire si une donnée manque. */
export function proprietesScenes(entree: EntreeScenes): ProprietesTableauScene[] {
  const mp = entree.miseEnPage;
  const temps = mp.styleV2 ? tempsEcrans(entree) : null;
  const ref = mp.styleReference;
  const heuresTout = ref ? heuresReference(entree) : entree.heures;
  return entree.scenes.map((s, k) => {
    if (s.debutMs === undefined || s.finMs === undefined) throw new Error(`Scène ${s.id} · la fiche n'est pas calée (début ou fin manquant).`);
    const page = mp.pages.find((p) => p.page === s.page);
    if (!page) throw new Error(`Scène ${s.id} · la page ${s.page} est absente de la mise en page.`);
    const avant = new Set(entree.scenes.slice(0, k).filter((x) => x.page === s.page).map((x) => x.id));
    const dejaEcrits = [...page.elements.filter((e) => avant.has(e.sceneId)).map((e) => e.elementId), ...page.gestes.filter((g) => avant.has(g.sceneId)).map((g) => g.elementId)];
    // « reference/1 » et « reference/2 » : coupe nette vers une page blanche (la page d'avant ne glisse pas) ;
    // « reference/3 » : la page d'avant glisse (300 ms, la même transition partout).
    const precedente = (!ref || ref.style === "reference/3") && k > 0 && entree.scenes[k - 1].page !== s.page ? mp.pages.find((p) => p.page === entree.scenes[k - 1].page) ?? null : null;
    const surPage = (id: string) => page.elements.some((e) => e.elementId === id) || !!precedente?.elements.some((e) => e.elementId === id);
    const garder = <T,>(r: Record<string, T> | undefined): Record<string, T> => Object.fromEntries(Object.entries(r ?? {}).filter(([id]) => surPage(id)));
    return {
      version: VERSION_TABLEAU_SCENE,
      largeur: mp.largeurPx,
      hauteur: mp.hauteurPx,
      ...(mp.reference ? { reference: { ...mp.reference } } : {}),
      fps: entree.fps ?? 25,
      stylo: entree.stylo,
      scene: { id: s.id, page: s.page, debutMs: s.debutMs, finMs: s.finMs, premiere: k === 0 },
      cadre: mp.cadre,
      zoneSure: mp.zoneSure,
      bandeSousTitres: mp.bandeSousTitres,
      page,
      heures: heuresTout.filter((h) => h.sceneId === s.id),
      dejaEcrits,
      pagePrecedente: precedente,
      importants: garder(entree.importants),
      preuves: garder(entree.preuves),
      ...(temps ? { v2: proprietesV2(entree, s, temps) } : {}),
      ...(ref ? { styleReference: proprietesReference(entree, s, ref.k, heuresTout) } : {}),
    };
  });
}

/** Nombre d'images d'une scène (25 i/s par défaut), au moins une. */
export function imagesScene(p: Pick<ProprietesTableauScene, "scene" | "fps">): number {
  return Math.max(1, Math.round(((p.scene.finMs - p.scene.debutMs) / 1000) * (p.fps || 25)));
}

/**
 * Contrôle des propriétés d'une scène avant le rendu : liste des problèmes (vide = valide). Format d'image, durée,
 * éléments et heures cohérents avec la page, stylo et dessins connus.
 */
export function controlerProprietes(p: ProprietesTableauScene): string[] {
  const pb: string[] = [];
  const nom = `Scène ${p.scene?.id ?? "?"}`;
  if (p.version !== VERSION_TABLEAU_SCENE) pb.push(`${nom} · version « ${p.version} » inconnue (attendue : ${VERSION_TABLEAU_SCENE}).`);
  if (!DIMENSIONS_SCENES.some((d) => d.largeur === p.largeur && d.hauteur === p.hauteur)) pb.push(`${nom} · image ${p.largeur} × ${p.hauteur} : aucun format de sortie n'a ces dimensions (${DIMENSIONS_SCENES.map((d) => `${d.largeur} × ${d.hauteur}`).join(", ")}).`);
  if (!CADENCES_SCENES.includes(p.fps)) pb.push(`${nom} · ${p.fps} images par seconde au lieu de ${CADENCES_SCENES.join(" ou ")}.`);
  if (!(p.scene.finMs > p.scene.debutMs)) pb.push(`${nom} · la scène ne dure pas (${p.scene.debutMs} → ${p.scene.finMs} ms).`);
  if (p.page.page !== p.scene.page) pb.push(`${nom} · la page donnée (${p.page.page}) n'est pas celle de la scène (${p.scene.page}).`);
  if (!Object.prototype.hasOwnProperty.call(STYLOS, p.stylo)) pb.push(`${nom} · stylo « ${p.stylo} » inconnu.`);
  const ids = new Map<string, string>([...p.page.elements.map((e) => [e.elementId, e.sceneId] as const), ...p.page.gestes.map((g) => [g.elementId, g.sceneId] as const)]);
  for (const h of p.heures) {
    if (ids.get(h.elementId) !== p.scene.id || h.sceneId !== p.scene.id) pb.push(`${nom} · l'heure de « ${h.elementId} » ne vise pas un élément de la scène sur sa page.`);
    else if (h.debutMs < p.scene.debutMs || h.debutMs > p.scene.finMs) pb.push(`${nom} · « ${h.elementId} » part hors de la scène (${h.debutMs} ms).`);
  }
  for (const [id, scene] of ids) if (scene === p.scene.id && !p.heures.some((h) => h.elementId === id)) pb.push(`${nom} · « ${id} » n'a pas d'heure de départ.`);
  for (const id of p.dejaEcrits) if (!ids.has(id) || ids.get(id) === p.scene.id) pb.push(`${nom} · « ${id} » est dit déjà écrit sans être d'une scène précédente de la page.`);
  for (const e of [...p.page.elements, ...(p.pagePrecedente?.elements ?? [])]) {
    if (e.type === "dessin" && !Object.prototype.hasOwnProperty.call(TRACES_DESSINS, e.dessinId ?? "")) pb.push(`${nom} · dessin « ${e.dessinId} » absent de la banque.`);
    // Trois styles du tableau : un croquis (dessin illustré, séparateur, flèche, carte) n'écrit aucune ligne, il ne
    // porte que des traits ; il n'a pas de taille de texte. Tout élément qui écrit (ou un élément vide) en a une.
    const croquis = !e.lignes.length && !e.tableau?.lignes.length && !!(e.tableau?.avant?.length || e.tableau?.apres?.length || e.tableau?.objets?.length);
    if (e.type !== "dessin" && e.type !== "ecran" && e.type !== "item" && !croquis && !(e.taillePx && e.niveau)) pb.push(`${nom} · « ${e.elementId} » n'a pas de taille de texte.`);
  }
  if (p.v2) {
    if (!p.v2.ecrans.length) pb.push(`${nom} · aucun écran du style « blocs/2 » à montrer.`);
    for (const e of p.v2.ecrans) if (!p.v2.temps[e.id]) pb.push(`${nom} · l'écran « ${e.id} » n'a pas de début.`);
  }
  const bande = p.bandeSousTitres.px;
  for (const e of p.page.elements) if (e.px.y + e.px.hauteur > bande.y) pb.push(`${nom} · « ${e.elementId} » descend dans la bande des sous-titres.`);
  // Bulle de preuve complète : phrase testée et date, à la place réservée (rien d'omis en silence).
  for (const e of p.page.elements.filter((x) => x.type === "preuve" && x.bulle)) {
    const omis = bulleReservee(e, p.preuves[e.elementId]).omis;
    if (omis.length) pb.push(`${nom} · la bulle « ${e.elementId} » ne peut pas montrer ${omis.map((o) => (o === "phrase" ? "la phrase testée" : "la date du test")).join(" ni ")} (contenu absent ou plus long que la place réservée).`);
  }
  return pb;
}
