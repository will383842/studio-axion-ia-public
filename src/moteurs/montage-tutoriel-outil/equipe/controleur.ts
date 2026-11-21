// T-EXT-23 : contrôleur SANS IA du tutoriel d'outil. Trois moments : avant l'écran de validation (sur le papier),
// après le calage de la voix (durées réelles) et sur la vidéo d'essai. Verdict « ok » ou « bloque » + défauts lisibles.
// Pur : aucun appel, aucun disque, aucune horloge. Rien ne l'importe en production (le branchement est la fiche d'intégration).
// Les seuils sont des constantes exportées, jamais lues dans les réglages. La durée vient de `DUREE_CIBLE_SEC` seulement.
import { controlerVideoFinie } from "@/briques/controle-image/video-finie";
import type { MesuresExport, MiseEnPage } from "@/briques/controle-image/types";
import type { IdReseau, Ratio } from "@/domaine/types";
import { garderChiffres } from "@/briques/donnees-video/garde-chiffres";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import { ZOOM_NAVIGATION_MAX, plagesFixesSortie, planCacheLeFilm, type NavigationFilmee } from "@/briques/plan-scenes/tutoriel/navigation-filmee";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { memeValeur, nombresAffirmes } from "@/domaine/nombres-fr";
import type { ZonePct } from "../artefacts-retouche";
import type { EtapeCalee } from "../calage-scenario";
import type { CarteZones } from "./analyste";
import { DUREE_CIBLE_SEC, type CahierVideo } from "./chef-de-projet";
import { controlesDiffusion, type EntreeDiffusion } from "../diffusion-tutoriel";
import { controlerNettete, type RapportNettete } from "../nettete";
import { controlerMarque, type TexteControle } from "./controle-marque";
import type { ParcoursTutoriel } from "./realisateur";
import { MOTS_ENTREPRISE, verifierVersion, type PhraseChoisie, type PropositionScripts, type ScriptChoisi, type VersionScript } from "./scenariste";
import { MOMENTS_MAX, type FicheValeur } from "./strategie-valeur";

export interface ResultatControleTutoriel {
  id: string;
  libelle: string;
  etat: "reussi" | "echoue" | "non-fait";
  bloquant: boolean;
  details: string[];
}

export interface VerdictControleur {
  verdict: "ok" | "bloque";
  controles: ResultatControleTutoriel[];
  /** Libellés des contrôles restés « non fait » (listés ; un non-fait bloquant empêche « publiable », pas l'écran de validation). */
  nonFaits: string[];
  resume: string;
}

export const SEUILS_TUTORIEL = Object.freeze({
  /** Une phrase dure au moins ce temps à l'écran (même valeur que les gabarits). */
  phraseMinMs: 1200,
  /** Une zone filmée, agrandie au zoom maximal, doit couvrir au moins cette largeur de l'image (%). */
  largeurZoomeeMinPct: 25,
  momentsMax: MOMENTS_MAX,
});

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const sansAccents = (t: string): string => t.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
const sec = (ms: number): string => (ms / 1000).toFixed(1).replace(".", ",");

function controle(id: string, libelle: string, bloquant: boolean, defauts: string[], ok: string, nonFait?: string): ResultatControleTutoriel {
  if (defauts.length) return { id, libelle, bloquant, etat: "echoue", details: defauts };
  if (nonFait) return { id, libelle, bloquant, etat: "non-fait", details: [nonFait] };
  return { id, libelle, bloquant, etat: "reussi", details: [ok] };
}

function plurielDefauts(n: number): string {
  return `${n} défaut${n > 1 ? "s" : ""} à corriger`;
}

/** Verdict : « bloque » dès qu'un contrôle bloquant a échoué ; « ok » sinon (les non-faits sont listés à part). */
export function etablirVerdict(controles: ResultatControleTutoriel[]): VerdictControleur {
  const echecs = controles.filter((c) => c.bloquant && c.etat === "echoue").length;
  const nonFaits = controles.filter((c) => c.etat === "non-fait").map((c) => c.libelle);
  const suffixe = nonFaits.length ? ` — ${nonFaits.length} point${nonFaits.length > 1 ? "s" : ""} pas encore vérifié${nonFaits.length > 1 ? "s" : ""}` : "";
  return {
    verdict: echecs ? "bloque" : "ok",
    controles,
    nonFaits,
    resume: echecs ? `Bloqué : ${plurielDefauts(echecs)}${suffixe}` : `Rien à signaler${suffixe}`,
  };
}

/** Publiable : « ok » ET aucun contrôle bloquant resté « non fait » (« non fait » n'est jamais « réussi »). */
export function publiable(v: VerdictControleur): boolean {
  return v.verdict === "ok" && !v.controles.some((c) => c.bloquant && c.etat === "non-fait");
}

export function fusionnerVerdicts(...v: VerdictControleur[]): VerdictControleur {
  return etablirVerdict(v.flatMap((x) => x.controles));
}

/** Phrases courtes en français, sans identifiant technique. */
export function resumePourWilliams(v: VerdictControleur): string {
  const lignes: string[] = [];
  for (const c of v.controles) if (c.etat === "echoue") for (const d of c.details) lignes.push(d);
  for (const c of v.controles) if (c.etat === "non-fait") lignes.push(`Pas encore vérifié : ${c.libelle.charAt(0).toLowerCase()}${c.libelle.slice(1)}.`);
  if (!lignes.length) return "Tout est en ordre.";
  return lignes.join("\n");
}

function zoneValide(z: ZonePct | undefined): boolean {
  if (!z) return true;
  const n = [z.x, z.y, z.largeur, z.hauteur];
  if (n.some((v) => typeof v !== "number" || !Number.isFinite(v))) return false;
  return z.x >= 0 && z.y >= 0 && z.largeur > 0 && z.hauteur > 0 && z.x + z.largeur <= 100 && z.y + z.hauteur <= 100;
}

/** « 12 » + le mot qui suit dans la phrase : « 12 commandes ». */
function citation(texte: string, brut: string): string {
  const m = new RegExp(`${brut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+[\\p{L}'’-]+)?`, "u").exec(texte);
  return m ? m[0] : brut;
}

const nombresDe = (t: string): { brut: string; valeur: number }[] => nombresAffirmes(t).map((n) => ({ brut: n.brut, valeur: n.valeur }));

/* ------------------------------------------------------------------ */
/* Avant l'écran de validation                                         */
/* ------------------------------------------------------------------ */

export interface EntreeAvantValidation {
  cahier: CahierVideo;
  carte: CarteZones;
  fiche: FicheValeur;
  proposition: PropositionScripts;
  parcours: ParcoursTutoriel;
  donnees?: TableauDeBord;
  textesMaquette: { etapeId: string; textes: string[] }[];
  couleurs: string[];
  polices: string[];
  noms: string[];
  /** Script sur lequel le parcours a été bâti ; absent : version A de la proposition. */
  script?: Pick<ScriptChoisi, "phrases">;
  /** Durée de la fin commune choisie (0 si « aucune »), pour `verifierVersion`. */
  dureeFinSec?: number;
  ajusterDemande?: true;
  /** La mention « exemple » est visible dans les écrans de démonstration (défaut : oui quand des données sont données). */
  mentionExemple?: boolean;
  /** T-EXT-43 : formats, langue, contraste, taille du texte, longueur du script (absent = comme avant). */
  diffusion?: EntreeDiffusion;
}

function phrasesDu(e: EntreeAvantValidation): readonly Pick<PhraseChoisie, "texte" | "momentId">[] {
  return e.script?.phrases ?? e.proposition.versions[0].phrases;
}

/** Étapes qui servent la phrase `i` : ses gestes (plans dessinés compris, ils ont leur geste `dessin-<n>`) ; à défaut, un plan dessiné déclaré. */
function etapesDePhrase(p: ParcoursTutoriel, i: number): string[] {
  const g = p.gestes.filter((x) => x.phraseIndex === i).map((x) => x.etapeId);
  if (g.length) return g;
  return p.plansDessines.filter((x) => x.phraseIndex === i).map(() => `dessin-${i}`);
}

export function controlerAvantValidation(e: EntreeAvantValidation): VerdictControleur {
  const versions = e.proposition.versions;
  const phrases = phrasesDu(e);
  const textesDe = (id: string): string[] => e.textesMaquette.filter((t) => t.etapeId === id).flatMap((t) => t.textes);
  const tousTextesEcran = e.textesMaquette.flatMap((t) => t.textes);

  /* TUT-TRAME : les règles de trame sont des remarques pour un texte fourni (verifierVersion les range déjà ainsi). */
  const trame: string[] = [];
  for (const v of versions) {
    const r = verifierVersion(v as VersionScript, { cahier: e.cahier, carte: e.carte, fiche: e.fiche, dureeFinSec: e.dureeFinSec ?? 0, ajusterDemande: e.ajusterDemande });
    for (const b of r.bloquants) trame.push(`Version ${v.id} : ${b}`);
  }

  /* TUT-CHIFFRES */
  const chiffres: string[] = [];
  if (e.donnees) {
    for (const v of versions) {
      const g = garderChiffres(e.donnees, { textesEcran: tousTextesEcran, texteDit: v.phrases.map((p) => p.texte).join(" ") });
      for (const h of g.horsDonnee) chiffres.push(`Version ${v.id} : « ${h.brut} » ne vient pas des données.`);
      for (const er of g.erreurs) chiffres.push(`Données : ${er}.`);
    }
  }
  phrases.forEach((p, i) => {
    const etapes = etapesDePhrase(e.parcours, i);
    const ecran = etapes.flatMap(textesDe).flatMap(nombresDe);
    for (const n of nombresDe(p.texte)) {
      if (!ecran.some((s) => memeValeur(s.valeur, n.valeur))) chiffres.push(`La phrase ${i + 1} dit « ${citation(p.texte, n.brut)} » mais l'écran ne le montre pas à ce moment-là.`);
    }
  });

  /* TUT-GESTES */
  const gestes: string[] = [];
  phrases.forEach((_p, i) => {
    const n = etapesDePhrase(e.parcours, i).length;
    if (n === 0) gestes.push(`La phrase ${i + 1} n'a aucun geste à l'écran.`);
    else if (n > 1) gestes.push(`La phrase ${i + 1} a ${n} gestes : une phrase = un seul geste.`);
  });
  const calees = new Set(e.parcours.gestes.map((g) => g.etapeId));
  for (const et of e.parcours.scenario.etapes) if (!calees.has(et.id)) gestes.push(`L'étape « ${et.id} » n'a aucun geste.`);

  /* TUT-CADRE */
  const cadre: string[] = [];
  for (const z of e.carte.zones) if (z.zone && !zoneValide(z.zone)) cadre.push(`La zone « ${z.id} » sort de l'image.`);
  for (const et of e.parcours.scenario.etapes) {
    if (et.zone && !zoneValide(et.zone)) cadre.push(`L'étape « ${et.id} » montre une zone qui sort de l'image.`);
    else if (et.zone && et.zone.largeur * ZOOM_NAVIGATION_MAX < SEUILS_TUTORIEL.largeurZoomeeMinPct) cadre.push(`L'étape « ${et.id} » montre une zone trop petite pour être lisible, même zoomée.`);
  }
  for (const g of e.parcours.gestes) {
    if (!g.zoom) continue;
    if (!zoneValide(g.zoom.zone)) cadre.push(`Le zoom de la phrase ${g.phraseIndex + 1} sort de l'image.`);
    else if (g.zoom.zone.largeur * ZOOM_NAVIGATION_MAX < SEUILS_TUTORIEL.largeurZoomeeMinPct) cadre.push(`Le zoom de la phrase ${g.phraseIndex + 1} vise une zone trop petite pour être lisible.`);
  }

  /* TUT-MOMENTS */
  const moments: string[] = [];
  const ids = new Set(phrases.map((p) => p.momentId).filter((m): m is "m1" | "m2" | "m3" => !!m));
  const nbMoments = Math.max(ids.size, e.fiche.moments?.length ?? 0);
  if (nbMoments > SEUILS_TUTORIEL.momentsMax) moments.push(`${nbMoments} moments « ça change tout » : ${SEUILS_TUTORIEL.momentsMax} au plus.`);
  const derniere = phrases[phrases.length - 1];
  if (!derniere) moments.push("Le script n'a aucune phrase.");
  else {
    const n = sansAccents(derniere.texte);
    if (!MOTS_ENTREPRISE.some((m) => new RegExp(`(?<![a-z0-9])${m}`).test(n))) moments.push("La dernière phrase doit parler de l'entreprise.");
  }

  /* MARQUE-* : versions A et B, textes de maquette, conversation. */
  const textes: TexteControle[] = [
    ...versions.flatMap((v) => v.phrases.map((p) => ({ texte: p.texte, origine: "voix" as const }))),
    ...e.textesMaquette.flatMap((t) => t.textes.map((texte) => ({ texte, origine: (t.etapeId.startsWith("conversation") ? "conversation" : "maquette") as TexteControle["origine"] }))),
  ];
  const marque = controlerMarque({
    textes,
    couleurs: e.couleurs,
    polices: e.polices,
    noms: e.noms,
    chiffresAffiches: !!e.donnees,
    mentionExemple: e.mentionExemple ?? !!e.donnees,
  });

  return etablirVerdict([
    controle("TUT-TRAME", "Trame du script", true, trame, "Les deux versions tiennent la trame."),
    controle("TUT-CHIFFRES", "Chiffres dits et montrés", true, chiffres, "Chaque chiffre dit est à l'écran, au même moment, et vient des données."),
    controle("TUT-GESTES", "Un geste par phrase", true, gestes, "Chaque phrase a un seul geste."),
    controle("TUT-CADRE", "Zones dans le cadre", true, cadre, "Toutes les zones sont dans l'image et lisibles."),
    controle("TUT-MOMENTS", "Moments forts et dernière phrase", true, moments, "Trois moments au plus, dernière phrase sur l'entreprise."),
    ...marque,
    ...(e.diffusion ? controlesDiffusion(e.diffusion) : []),
  ]);
}

/* ------------------------------------------------------------------ */
/* Après le calage de la voix                                          */
/* ------------------------------------------------------------------ */

export interface EntreeApresCalage {
  script: Pick<ScriptChoisi, "phrases">;
  parcours: ParcoursTutoriel;
  etapes: EtapeCalee[];
  dureeVoixMs: number;
  dureeFinMs: number;
  navigation?: NavigationFilmee;
  plan?: PlanValide;
}

export function controlerApresCalage(e: EntreeApresCalage): VerdictControleur {
  /* TUT-DUREE : DUREE_CIBLE_SEC est la seule source ; comparaison en millisecondes entières. */
  const totalMs = e.dureeVoixMs + e.dureeFinMs;
  const duree: string[] = [];
  if (!Number.isFinite(totalMs)) duree.push("La durée de la voix n'est pas lisible.");
  else if (totalMs < DUREE_CIBLE_SEC[0] * 1000) duree.push(`La vidéo dure ${sec(totalMs)} s : c'est trop court, il en faut au moins ${DUREE_CIBLE_SEC[0]}.`);
  else if (totalMs > DUREE_CIBLE_SEC[1] * 1000) duree.push(`La vidéo dure ${sec(totalMs)} s : c'est trop long, ${DUREE_CIBLE_SEC[1]} au plus.`);

  /* TUT-RYTHME */
  const rythme: string[] = [];
  e.etapes.forEach((et, i) => {
    const d = et.finMs - et.debutMs;
    if (!Number.isFinite(d) || d < SEUILS_TUTORIEL.phraseMinMs) rythme.push(`L'étape ${i + 1} ne dure que ${Number.isFinite(d) ? sec(Math.max(0, d)) : "?"} s : trop vite pour être suivie (${sec(SEUILS_TUTORIEL.phraseMinMs)} s au moins).`);
  });

  /* TUT-IMAGE-FIXE : c'est ici que la règle des 1,5 s refuse. */
  const fixe: string[] = [];
  let fixeNonFait: string | undefined;
  if (!e.navigation) fixeNonFait = "Le film de navigation n'est pas encore là : écran immobile non vérifié.";
  else {
    const plages = plagesFixesSortie(e.navigation);
    if (plages === null) fixeNonFait = "L'immobilité de l'écran n'a pas été mesurée.";
    else for (const p of plages) fixe.push(`Écran immobile de ${sec(p.debutMs)} s à ${sec(p.finMs)} s.`);
    if (e.plan && planCacheLeFilm(e.plan, e.navigation).length > 0) fixe.push("Une scène plein écran cache le film : jamais d'image fixe en couche principale.");
  }

  return etablirVerdict([
    controle("TUT-DUREE", "Durée de la vidéo", true, duree, `La vidéo dure ${sec(totalMs)} s, dans la cible.`),
    controle("TUT-RYTHME", "Rythme des étapes", true, rythme, "Chaque étape dure assez pour être suivie.", e.etapes.length === 0 ? "Aucune étape calée." : undefined),
    controle("TUT-IMAGE-FIXE", "Écran immobile", true, fixe, "Aucun écran immobile trop long.", fixeNonFait),
  ]);
}

/* ------------------------------------------------------------------ */
/* Sur la vidéo d'essai                                                */
/* ------------------------------------------------------------------ */

export interface EntreeVideoEssai {
  mesures?: MesuresExport;
  miseEnPage?: MiseEnPage;
  ratio: Ratio;
  reseaux: IdReseau[];
  textesRendus: TexteControle[];
  couleursRendues?: string[];
  policesRendues?: string[];
  noms?: string[];
  chiffresAffiches?: boolean;
  mentionExemple?: boolean;
  /** T-EXT-54c : netteté par étape (54d) et mesures sur tout le fichier (54a : noir, figé). Absent = verdict inchangé, aucun contrôle de netteté. */
  nettete?: { rapport: RapportNettete; mesures: Partial<MesuresExport> };
}

export function controlerVideoEssai(e: EntreeVideoEssai): VerdictControleur {
  const finie = controlerVideoFinie({ mesures: e.nettete ? { ...e.mesures, ...e.nettete.mesures } : e.mesures, miseEnPage: e.miseEnPage, ratio: e.ratio, reseaux: e.reseaux, couleursRendues: e.couleursRendues, policesRendues: e.policesRendues });
  const image: ResultatControleTutoriel[] = finie.image.controles.map((c) => ({ id: `IMAGE-${c.id}`, libelle: c.libelle, etat: c.etat, bloquant: c.bloquant, details: [c.raison] }));
  const charte: ResultatControleTutoriel[] = finie.charte.map((c) => ({ id: `IMAGE-${c.id}`, libelle: c.libelle, etat: c.etat, bloquant: c.bloquant, details: c.details.length ? c.details : [c.raison] }));
  /* Couleurs et police : jugées une seule fois, sur ce qui est réellement rendu (pièce commune). */
  const marque = controlerMarque({
    textes: e.textesRendus,
    couleurs: [],
    polices: [],
    noms: e.noms ?? [],
    chiffresAffiches: e.chiffresAffiches ?? false,
    mentionExemple: e.mentionExemple ?? false,
  }).filter((c) => c.id !== "MARQUE-COULEURS" && c.id !== "MARQUE-POLICE");
  return etablirVerdict([...image, ...charte, ...marque, ...(e.nettete ? controlerNettete(e.nettete.rapport) : [])]);
}
