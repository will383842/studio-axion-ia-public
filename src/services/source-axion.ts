/**
 * SOURCE AXION-IA.COM (03/10) — le studio lit le site de Will une fois par jour.
 *
 * 1. TEXTES : `robots.txt`, puis le plan du site ; les pages NOUVELLES ou MODIFIÉES (et les pages suivies) sont lues
 *    une à une, à un rythme poli ; leurs morceaux NOUVEAUX deviennent des matières PROPOSÉES (« à confirmer »,
 *    texte mot pour mot, source = adresse + date), que Will garde ou écarte d'un toucher dans Écrire › Matières.
 *    Aucun appel à Claude : rien n'est dépensé, rien n'est réécrit.
 * 2. CAPTURES et 3. COURTES VIDÉOS : les pages suivies sont photographiées (9:16, 16:9, 1:1) et filmées (défilement,
 *    survol d'une offre) par `studio-rendu` (opération `capture-site`), rangées dans « Mes images », prêtes, avec les
 *    mots-clés de la page : la cascade des illustrations les prend en premier. Page changée : nouvelles captures,
 *    anciennes archivées (jamais effacées). Sans rendu ni stockage reliés : rien n'est capturé (aucune fausse image).
 *
 * Même mécanisme que la veille des outils : tâche quotidienne dans le processus du studio (minuterie de la veille,
 * coupée par `STUDIO_VEILLE=0`), une seule lecture à la fois. Le site ne répond pas : message clair, nouvel essai demain.
 */
import "server-only";
import type { ElementBibliotheque, FormatCaptureSite, Id, PageSite, RubriqueSite } from "@/domaine/types";
import { LICENCE_MES_IMAGES } from "@/domaine/mes-images";
import { motsAnglais } from "@/domaine/illustrations";
import type { DemandeRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { ErreurRendu, obtenirServiceRendu, renduSimule } from "@/fournisseurs/rendu/client";
import { segmentStockage } from "@/fournisseurs/rendu/commun";
import { nouvelId } from "@/lib/ids";
import { idPage, INDEX_PLAN, nomCourt, normaliserAdresse, PAGES_DEPART, rubriqueDe, SOUS_PLANS_SUIVIS } from "@/source-axion/adresses";
import { cleMorceau, empreinteMorceau, empreintePage, lirePageSite, morceauxNouveaux, morceauxPossibles, motsClesPage, type Morceau, type PageLue } from "@/source-axion/extraction";
import { lireIndexPlan, lirePlan, type EntreePlan } from "@/source-axion/plan-du-site";
import { captureDue, estSuivie, lectureSiteDue, MATIERES_PAR_JOUR, pagesALire, pagesANoter, RUBRIQUES_LUES, texteNotification, type PageALire } from "@/source-axion/regles";
import { autorise, lireRobots, pauseEntreLectures, type ReglesRobots } from "@/source-axion/robots";
import { DELAI_SOURCE_MS, lireTexte, SourceMuette } from "@/veille/http";
import { depots, ecrireParametre, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { proposerMatiere } from "./matieres";
import { etape21SourceAxion } from "./migrations/etape-21-source-axion";
import { creerNotification } from "./notifications";

const PARAM_REGLAGES = "site.reglages";
const PARAM_DERNIERE = "site.derniereLecture";
const PARAM_BILAN = "site.dernierBilan";
const PARAM_DEPART = "site.depart";
const LIEN_MATIERES = "/ecrire/matieres";

export interface ReglagesSite {
  /** Lecture quotidienne du site (allumée par défaut : lecture publique, gratuite). */
  actif: boolean;
}

export interface BilanSite {
  le: string;
  ok: boolean;
  /** Message simple quand le site n'a pas répondu (nouvel essai demain). */
  erreur?: string;
  pagesLues: number;
  nouvelles: number;
  changees: number;
  matieres: number;
  captures: number;
  /** Pages laissées pour le lendemain (limite du jour) ou en échec. */
  enAttente: number;
  /** Pourquoi aucune image n'a été faite (rendu ou stockage pas encore reliés). */
  capturesImpossibles?: string;
}

export interface DependancesSite {
  appeler?: typeof fetch;
  maintenant?: () => Date;
  /** Pause entre deux lectures (remplacée dans les tests). */
  pause?: (ms: number) => Promise<void>;
  delaiMs?: number;
  env?: Record<string, string | undefined>;
  /** Service de rendu (défaut : celui de l'environnement ; `null` : aucun). */
  rendu?: ServiceRendu | null;
  stockage?: StockageFichiers | null;
  /** Attente maximale d'une capture (défaut 10 min) et intervalle de suivi (défaut 3 s). */
  attenteRenduMs?: number;
  suiviMs?: number;
}

/* ------------------------------------------------------------------ */
/* État du processus (une seule lecture à la fois)                      */
/* ------------------------------------------------------------------ */

const cle = Symbol.for("studio-axion-ia.source-axion");
function etatProcessus(): { enCours: boolean } {
  const g = globalThis as typeof globalThis & { [cle]?: { enCours: boolean } };
  g[cle] ??= { enCours: false };
  return g[cle];
}

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Lecture du site                                                     */
/* ------------------------------------------------------------------ */

interface Lecture {
  a: PageALire;
  lue?: PageLue;
  erreur?: string;
}

/** Plan du site : les sous-plans suivis (pages, formations, foire aux questions, actualités, articles). */
async function lirePlanDuSite(appeler: typeof fetch, robots: ReglesRobots, delaiMs: number, pause: (ms: number) => Promise<void>): Promise<(EntreePlan & { rubrique: RubriqueSite })[]> {
  const index = robots.plans.find((p) => /sitemap-index\.xml$/.test(p)) ?? INDEX_PLAN;
  const sousPlans = lireIndexPlan(await lireTexte(appeler, index, delaiMs, { accept: "application/xml,text/xml,*/*" })).filter((u) => SOUS_PLANS_SUIVIS.test(u));
  if (!sousPlans.length) throw new SourceMuette("Plan du site vide.");
  const vues = new Map<string, EntreePlan & { rubrique: RubriqueSite }>();
  for (const u of sousPlans) {
    await pause(pauseEntreLectures(robots));
    let entrees: EntreePlan[];
    try {
      entrees = lirePlan(await lireTexte(appeler, u, delaiMs, { accept: "application/xml,text/xml,*/*" }));
    } catch {
      continue; // un sous-plan muet : les autres suffisent aujourd'hui
    }
    for (const e of entrees) {
      const url = normaliserAdresse(e.url);
      if (!url || vues.has(url) || !autorise(url, robots)) continue;
      vues.set(url, { ...e, url, rubrique: rubriqueDe(url) });
    }
  }
  return [...vues.values()];
}

/** Rubrique utilisée pour les limites : une page « autre » choisie par Will compte comme une offre. */
function rubriqueEffective(p: Pick<PageSite, "rubrique" | "suivie">): RubriqueSite {
  return p.rubrique === "autre" && p.suivie ? "offre" : p.rubrique;
}

/**
 * Lit le site et propose les matières nouvelles, puis fait les captures dues. Une seule lecture à la fois (sinon :
 * sautée). Renvoie le bilan (aussi rangé pour l'écran).
 */
export async function lireLeSite(dep: DependancesSite = {}): Promise<BilanSite & { saute?: boolean }> {
  const etat = etatProcessus();
  const quand = dep.maintenant?.() ?? new Date();
  if (etat.enCours) return { le: quand.toISOString(), ok: true, saute: true, pagesLues: 0, nouvelles: 0, changees: 0, matieres: 0, captures: 0, enAttente: 0 };
  etat.enCours = true;
  try {
    const bilan = await lectureComplete(dep, quand);
    const captures = await capturesDues(dep, quand);
    const final: BilanSite = { ...bilan, captures: captures.faites, ...(captures.impossible ? { capturesImpossibles: captures.impossible } : {}), enAttente: bilan.enAttente + captures.enEchec };
    await sousVerrou(async () => {
      await ecrireParametre(PARAM_BILAN, final);
      const t = texteNotification(final.matieres, final.captures);
      if (t) await creerNotification({ type: "info", titre: t.titre, ...(t.message ? { message: t.message } : {}), lien: final.matieres ? LIEN_MATIERES : "/bibliotheque/mes-images" });
    });
    return final;
  } finally {
    etat.enCours = false;
  }
}

async function lectureComplete(dep: DependancesSite, quand: Date): Promise<BilanSite> {
  const iso = quand.toISOString();
  const appeler = dep.appeler ?? fetch;
  const delaiMs = dep.delaiMs ?? DELAI_SOURCE_MS;
  const pause = dep.pause ?? attendre;
  const vide: BilanSite = { le: iso, ok: true, pagesLues: 0, nouvelles: 0, changees: 0, matieres: 0, captures: 0, enAttente: 0 };

  // 1. robots.txt et plan du site (hors verrou). Un échec : message clair, nouvel essai demain.
  let robots: ReglesRobots;
  let entrees: (EntreePlan & { rubrique: RubriqueSite })[];
  try {
    let texteRobots = "";
    try {
      texteRobots = await lireTexte(appeler, "https://axion-ia.com/robots.txt", delaiMs, { accept: "text/plain,*/*" });
    } catch (e) {
      // Pas de robots.txt (404) : tout est permis. Toute autre panne : on ne lit pas le site aujourd'hui.
      if (!(e instanceof SourceMuette && e.raison === "Adresse introuvable.")) throw e;
    }
    robots = lireRobots(texteRobots);
    entrees = await lirePlanDuSite(appeler, robots, delaiMs, pause);
  } catch (e) {
    const raison = e instanceof SourceMuette ? e.raison : "La source ne répond pas.";
    const bilan: BilanSite = { ...vide, ok: false, erreur: `Votre site ne répond pas (${raison.replace(/\.$/, "").toLowerCase()}). Nouvel essai demain.` };
    await sousVerrou(async () => {
      await ecrireParametre(PARAM_DERNIERE, iso);
      await journaliser("site", "Lecture de votre site impossible : nouvel essai demain");
    });
    return bilan;
  }

  // 2. Ce qu'il faut lire aujourd'hui.
  const premiere = !(await lireParametre<string | null>(PARAM_DEPART, null));
  const connues = new Map((await depots().pagesSite.lister()).map((p) => [p.url, p]));
  const aLire = pagesALire(entrees, connues, quand, premiere);
  const aNoter = pagesANoter(entrees, connues, new Set(aLire.map((a) => a.url)), premiere);
  const nouvellesTotal = entrees.filter((e) => !connues.has(e.url) && RUBRIQUES_LUES.has(e.rubrique)).length;

  // 3. Lectures HORS verrou, une à une, au rythme demandé par le site.
  const lectures: Lecture[] = [];
  for (const a of aLire) {
    if (!autorise(a.url, robots)) continue;
    await pause(pauseEntreLectures(robots));
    try {
      lectures.push({ a, lue: lirePageSite(await lireTexte(appeler, a.url, delaiMs, { accept: "text/html,*/*" })) });
    } catch (e) {
      lectures.push({ a, erreur: e instanceof SourceMuette ? e.raison : "La page ne répond pas." });
    }
  }

  // 4. Écriture sous le verrou (aucun réseau).
  const resultat = await sousVerrou(async () => {
    const d = depots();
    let matieres = 0;
    let nouvelles = 0;
    let changees = 0;
    let reportees = 0;
    const dejaProposees = new Set((await d.matieres.lister((m) => m.source.origine === "site")).map((m) => cleMorceau(m.texte)));
    for (const e of aNoter) {
      const id = idPage(e.url);
      if (await d.pagesSite.obtenir(id)) continue;
      await d.pagesSite.enregistrer({ id, url: e.url, rubrique: e.rubrique, ...(e.titre ? { titre: e.titre } : {}), ...(e.date ? { dateSite: e.date } : {}), connueAuDepart: true, ...horodatage() });
    }
    for (const { a, lue, erreur } of lectures) {
      const id = idPage(a.url);
      const avant = await d.pagesSite.obtenir(id);
      if (!lue) {
        if (avant) await d.pagesSite.modifier(id, { erreur });
        continue;
      }
      const page: PageSite = avant ?? { id, url: a.url, rubrique: a.rubrique, ...horodatage() };
      const rubrique = rubriqueEffective(page);
      const possibles = morceauxPossibles(lue, rubrique);
      const empreinte = empreintePage(lue, possibles);
      const vus = new Set(page.morceauxVus ?? []);
      // Page connue au départ, lue pour la première fois : point de départ, rien n'est proposé.
      const depart = !!page.connueAuDepart && !page.luLe;
      // Même texte déjà proposé (ailleurs sur le site, ou écarté) : jamais deux fois.
      const choisis: Morceau[] = depart ? [] : morceauxNouveaux(possibles, rubrique, vus).filter((m) => !dejaProposees.has(cleMorceau(m.texte)));
      // Limite du jour atteinte : la page n'est pas notée, elle est reprise demain avec ses morceaux (rien n'est perdu).
      if (choisis.length && matieres + choisis.length > MATIERES_PAR_JOUR && matieres > 0) {
        reportees++;
        continue;
      }
      const titre = lue.h1 || lue.titre || a.titrePlan;
      let proposees = 0;
      for (const m of choisis) {
        dejaProposees.add(cleMorceau(m.texte));
        await proposerMatiere({ texte: m.texte, type: m.type, origine: "site", detail: titre?.slice(0, 120), url: a.url, date: (a.date && !Number.isNaN(Date.parse(a.date)) ? new Date(a.date) : quand).toISOString() });
        proposees++;
      }
      matieres += proposees;
      if (!avant && !depart) nouvelles++;
      const changee = !!page.empreinte && page.empreinte !== empreinte;
      if (changee) changees++;
      for (const m of possibles) vus.add(empreinteMorceau(m.texte));
      const maj: PageSite = {
        ...page,
        titre: lue.titre || page.titre,
        motsCles: motsClesPage(lue, page.rubrique),
        ...(a.date ? { dateSite: a.date } : {}),
        luLe: iso,
        empreinte,
        morceauxVus: [...vus].slice(-400),
        ...(changee ? { changeeLe: iso } : {}),
        matieresProposees: (page.matieresProposees ?? 0) + proposees,
        erreur: undefined,
        modifieLe: maintenant(),
      };
      await d.pagesSite.enregistrer(maj);
    }
    await ecrireParametre(PARAM_DERNIERE, iso);
    if (premiere) await ecrireParametre(PARAM_DEPART, iso);
    const lues = lectures.filter((l) => l.lue).length;
    await journaliser("site", `Votre site lu : ${lues} page${lues > 1 ? "s" : ""}, ${matieres} matière${matieres > 1 ? "s" : ""} proposée${matieres > 1 ? "s" : ""}`);
    return { matieres, nouvelles, changees, lues, reportees };
  });

  const enEchec = lectures.filter((l) => !l.lue).length;
  const restantes = Math.max(0, (premiere ? 0 : nouvellesTotal) - aLire.filter((a) => a.raison === "nouvelle").length);
  return { ...vide, pagesLues: resultat.lues, nouvelles: resultat.nouvelles, changees: resultat.changees, matieres: resultat.matieres, enAttente: enEchec + restantes + resultat.reportees };
}

/* ------------------------------------------------------------------ */
/* Captures (studio-rendu)                                             */
/* ------------------------------------------------------------------ */

interface CaptureVoulue {
  type: "image" | "video";
  format: FormatCaptureSite;
  mouvement?: "defilement" | "survol";
}

/** Captures d'une page : trois images, deux défilements ; un survol d'offre en plus sur l'accueil, les offres, les formations. */
export function capturesVoulues(rubrique: RubriqueSite): CaptureVoulue[] {
  const base: CaptureVoulue[] = [
    { type: "image", format: "9:16" },
    { type: "image", format: "16:9" },
    { type: "image", format: "1:1" },
    { type: "video", format: "9:16", mouvement: "defilement" },
    { type: "video", format: "16:9", mouvement: "defilement" },
  ];
  return rubrique === "accueil" || rubrique === "offre" || rubrique === "formation" ? [...base, { type: "video", format: "9:16", mouvement: "survol" }] : base;
}

const DIMENSIONS: Record<FormatCaptureSite, { largeur: number; hauteur: number }> = { "9:16": { largeur: 1080, hauteur: 1920 }, "16:9": { largeur: 1920, hauteur: 1080 }, "1:1": { largeur: 1080, hauteur: 1080 } };
const NOM_FORMAT: Record<FormatCaptureSite, string> = { "9:16": "vertical", "16:9": "horizontal", "1:1": "carré" };

/** Le rendu et le stockage réels sont-ils reliés ? Sinon : aucune capture (jamais de fausse image). */
async function moyensDeCapture(dep: DependancesSite): Promise<{ rendu: ServiceRendu; stockage: StockageFichiers } | { impossible: string }> {
  const env = dep.env ?? process.env;
  const rendu = dep.rendu === undefined ? (renduSimule(env) ? null : obtenirServiceRendu(env)) : dep.rendu;
  const stockage = dep.stockage === undefined ? await fournisseur("stockage") : dep.stockage;
  if (!rendu) return { impossible: "Les images de votre site se feront une fois le rendu relié." };
  if (!stockage?.urlDepotDuree || stockage.mode === "simulation") return { impossible: "Les images de votre site se feront une fois le stockage relié." };
  return { rendu, stockage };
}

/** Soumet puis attend une capture (attente partagée `executerRendu`, sans nouvel essai : le lendemain s'en charge). */
async function attendreRendu(rendu: ServiceRendu, demande: DemandeRendu, dep: DependancesSite): Promise<Record<string, number>> {
  try {
    const e = await executerRendu(rendu, demande, { delaiMs: dep.attenteRenduMs ?? 10 * 60_000, essais: 0, attendre: () => attendre(dep.suiviMs ?? 3000) });
    return e.mesures ?? {};
  } catch (e) {
    throw new ErreurStudio("CAPTURE", e instanceof ErreurRendu ? e.message : "La capture n'a pas abouti.");
  }
}

/** Photographie et filme une page suivie ; tout ou rien (sinon : nouvel essai le lendemain). */
async function capturerUnePage(page: PageSite, m: { rendu: ServiceRendu; stockage: StockageFichiers }, dep: DependancesSite, quand: string): Promise<number> {
  const env = segmentStockage(dep.env ?? process.env);
  const faites: { voulue: CaptureVoulue; fichierId: Id; cle: string; mesures: Record<string, number> }[] = [];
  for (const voulue of capturesVoulues(page.rubrique)) {
    const fichierId = nouvelId("f");
    const ext = voulue.type === "image" ? "jpg" : "mp4";
    const cleStockage = `studio/${env}/site/${page.id}/${fichierId}.${ext}`;
    const demande: DemandeRendu = {
      idRendu: `site-${page.id}-${fichierId}`,
      operation: "capture-site",
      file: "longue",
      entrees: { page: page.url },
      sortie: { urlDepot: await m.stockage.urlDepotDuree!(cleStockage, 3600, voulue.type === "image" ? "image/jpeg" : "video/mp4"), cle: cleStockage },
      parametres: { type: voulue.type, format: voulue.format, ...(voulue.mouvement ? { mouvement: voulue.mouvement, dureeSec: 6 } : {}) },
    };
    faites.push({ voulue, fichierId, cle: cleStockage, mesures: await attendreRendu(m.rendu, demande, dep) });
  }

  return sousVerrou(async () => {
    const d = depots();
    const courante = (await d.pagesSite.obtenir(page.id)) ?? page;
    const motsCles = courante.motsCles?.length ? courante.motsCles : ["site"];
    const images = new Map<FormatCaptureSite, Id>();
    for (const f of faites) {
      const dims = DIMENSIONS[f.voulue.format];
      await d.fichiers.enregistrer({
        id: f.fichierId,
        cleStockage: f.cle,
        nom: `${nomCourt(courante)} ${NOM_FORMAT[f.voulue.format]}.${f.voulue.type === "image" ? "jpg" : "mp4"}`,
        mime: f.voulue.type === "image" ? "image/jpeg" : "video/mp4",
        taille: 0,
        largeur: f.mesures.largeur ?? dims.largeur,
        hauteur: f.mesures.hauteur ?? dims.hauteur,
        ...(f.voulue.type === "video" ? { dureeSec: f.mesures.dureeSec ?? 6, fps: 30 } : {}),
        origine: "fabrication",
        statut: "pret",
        ...horodatage(),
      });
      if (f.voulue.type === "image") images.set(f.voulue.format, f.fichierId);
    }
    const elementIds: Id[] = [];
    for (const f of faites) {
      const id = nouvelId("el");
      const type = f.voulue.type === "image" ? "illustration-image" : "illustration-video";
      const element: ElementBibliotheque = {
        id,
        type,
        nom: `${nomCourt(courante)} · ${NOM_FORMAT[f.voulue.format]}${f.voulue.type === "video" ? (f.voulue.mouvement === "survol" ? " · survol" : " · défilement") : ""}`.slice(0, 80),
        motsCles,
        motsClesEn: motsAnglais(motsCles.join(" ")).slice(0, 20),
        description: courante.titre ?? nomCourt(courante),
        valeur: { type },
        fichierId: f.fichierId,
        vignetteFichierId: f.voulue.type === "image" ? f.fichierId : (images.get(f.voulue.format) ?? images.get("9:16") ?? f.fichierId),
        licence: { ...LICENCE_MES_IMAGES },
        formatsParDefaut: [],
        marqueId: "marque-axion",
        origine: "personnelle",
        categorieImage: "marque",
        cadrageVertical: { x: 0.5, y: 0.4, tientEnVertical: f.voulue.format === "9:16" },
        // Page publique du site de Will : aucune donnée privée à flouter, prête d'office (archivable d'un geste).
        confidentialite: { statut: "prete", zones: [] },
        valideLe: quand,
        importeDepuis: "site",
        empreinte: `site:${courante.id}:${f.voulue.type}:${f.voulue.format}:${f.voulue.mouvement ?? "fixe"}:${quand}`,
        sourceSite: { url: courante.url, pageId: courante.id, format: f.voulue.format, ...(f.voulue.mouvement ? { mouvement: f.voulue.mouvement } : {}), captureLe: quand },
        utilisations: 0,
        ...horodatage(),
      };
      await d.elements.enregistrer(element);
      elementIds.push(id);
    }
    // Les anciennes captures sont ARCHIVÉES (jamais effacées) : elles restent dans « Mes images › Rangées ».
    for (const ancien of courante.captures?.elementIds ?? []) {
      const e = await d.elements.obtenir(ancien);
      if (e && !e.archiveLe) await d.elements.modifier(ancien, { archiveLe: quand });
    }
    await d.pagesSite.modifier(courante.id, { captures: { faitesLe: quand, empreinte: courante.empreinte, elementIds }, erreur: undefined });
    await journaliser("bibliotheque", `Images de votre site : ${nomCourt(courante)} (${elementIds.length})`, { type: "page-site", id: courante.id });
    return elementIds.length;
  });
}

async function capturesDues(dep: DependancesSite, quand: Date): Promise<{ faites: number; enEchec: number; impossible?: string }> {
  const iso = quand.toISOString();
  const dues = await depots().pagesSite.lister((p) => !!p.luLe && captureDue(p, quand));
  if (!dues.length) return { faites: 0, enEchec: 0 };
  const moyens = await moyensDeCapture(dep);
  if ("impossible" in moyens) return { faites: 0, enEchec: 0, impossible: moyens.impossible };
  let faites = 0;
  let enEchec = 0;
  for (const p of dues) {
    try {
      faites += await capturerUnePage(p, moyens, dep, iso);
    } catch (e) {
      enEchec++;
      const message = e instanceof Error ? e.message : String(e);
      console.error("[studio] capture de votre site en échec", p.url, message);
      await sousVerrou(() => depots().pagesSite.modifier(p.id, { erreur: "Images non faites : nouvel essai demain." }));
    }
  }
  return { faites, enEchec };
}

/* ------------------------------------------------------------------ */
/* Tâche quotidienne                                                   */
/* ------------------------------------------------------------------ */

/** Pose les pages clés suivies au départ si elles manquent (même règle que la migration, utile sans base). */
async function assurerPagesDepart(): Promise<void> {
  await etape21SourceAxion(depots(), maintenant());
}

export async function lireReglagesSite(): Promise<ReglagesSite> {
  return lireParametre<ReglagesSite>(PARAM_REGLAGES, { actif: true });
}

/** Un tour de la tâche quotidienne : lecture si l'interrupteur est allumé et que 24 h sont passées. */
export async function tourSite(dep: DependancesSite = {}): Promise<void> {
  try {
    if (!(await lireReglagesSite()).actif) return;
    const quand = dep.maintenant?.() ?? new Date();
    if (!lectureSiteDue(await lireParametre<string | null>(PARAM_DERNIERE, null), quand)) return;
    await sousVerrou(async () => {
      if ((await depots().pagesSite.compter((p) => !!p.suivie)) === 0) await assurerPagesDepart();
    });
    await lireLeSite(dep);
  } catch (e) {
    console.error("[studio] lecture de votre site en échec", e);
  }
}

/* ------------------------------------------------------------------ */
/* Écran « Votre site »                                                 */
/* ------------------------------------------------------------------ */

export interface VuePageSuivie {
  id: Id;
  url: string;
  nom: string;
  chemin: string;
  par: "depart" | "will";
  luLe?: string;
  imagesLe?: string;
  images: number;
  erreur?: string;
}

export interface VueSite {
  actif: boolean;
  enCours: boolean;
  derniereLecture: string | null;
  bilan: BilanSite | null;
  pages: VuePageSuivie[];
  totaux: { pagesConnues: number; matieres: number; aRelire: number; images: number };
}

export async function lireVueSite(): Promise<VueSite> {
  await exigerSession();
  await sousVerrou(async () => {
    if ((await depots().pagesSite.compter((p) => !!p.suivie)) === 0) await assurerPagesDepart();
  });
  const d = depots();
  const [pages, matieres, images] = await Promise.all([d.pagesSite.lister(), d.matieres.lister((m) => m.source.origine === "site"), d.elements.compter((e) => !!e.sourceSite && !e.archiveLe)]);
  const ordre = new Map(PAGES_DEPART.map((p, i) => [p.url, i]));
  const suivies = pages.filter(estSuivie).sort((a, b) => (ordre.get(a.url) ?? 99) - (ordre.get(b.url) ?? 99) || a.url.localeCompare(b.url));
  return {
    actif: (await lireReglagesSite()).actif,
    enCours: etatProcessus().enCours,
    derniereLecture: await lireParametre<string | null>(PARAM_DERNIERE, null),
    bilan: await lireParametre<BilanSite | null>(PARAM_BILAN, null),
    pages: suivies.map((p) => ({
      id: p.id,
      url: p.url,
      nom: nomCourt(p),
      chemin: p.url.replace("https://axion-ia.com", "") || "/",
      par: p.suivie!.par,
      ...(p.luLe ? { luLe: p.luLe } : {}),
      ...(p.captures ? { imagesLe: p.captures.faitesLe } : {}),
      images: p.captures?.elementIds.length ?? 0,
      ...(p.erreur ? { erreur: p.erreur } : {}),
    })),
    totaux: {
      pagesConnues: pages.length,
      matieres: matieres.length,
      aRelire: matieres.filter((m) => m.statut === "a-confirmer" && !m.archiveLe && !m.retrait).length,
      images,
    },
  };
}

/** Interrupteur « Lire votre site chaque jour ». */
export async function reglerSite(actif: boolean): Promise<void> {
  await exigerSession();
  await ecrireParametre(PARAM_REGLAGES, { actif } satisfies ReglagesSite);
  await journaliser("site", actif ? "Lecture de votre site allumée" : "Lecture de votre site coupée");
}

/** Ajoute une page à suivre (axion-ia.com uniquement). Lue et photographiée à la prochaine lecture. */
export async function ajouterPageSuivie(adresse: string): Promise<VuePageSuivie> {
  await exigerSession();
  const url = normaliserAdresse(adresse);
  if (!url) throw new ErreurStudio("ADRESSE", "Seules les pages de axion-ia.com peuvent être suivies.");
  return sousVerrou(async () => {
    const d = depots();
    const id = idPage(url);
    const quand = maintenant();
    const existante = await d.pagesSite.obtenir(id);
    if (existante && estSuivie(existante)) throw new ErreurStudio("DEJA", "Cette page est déjà suivie.");
    // Une page choisie par Will : ses morceaux sont proposés dès sa première lecture.
    const suivie = { par: existante?.suivie?.par ?? ("will" as const), depuis: quand };
    const page: PageSite = existante ? { ...existante, suivie, connueAuDepart: existante.luLe ? existante.connueAuDepart : false, modifieLe: quand } : { id, url, rubrique: rubriqueDe(url), suivie, ...horodatage() };
    await d.pagesSite.enregistrer(page);
    await journaliser("site", `Page suivie ajoutée : ${page.url.replace("https://axion-ia.com", "")}`, { type: "page-site", id });
    return { id, url, nom: nomCourt(page), chemin: url.replace("https://axion-ia.com", "") || "/", par: suivie.par, images: page.captures?.elementIds.length ?? 0 };
  });
}

/** Retire une page de la liste (gardée, ses images aussi). */
export async function retirerPageSuivie(id: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const d = depots();
    const p = await d.pagesSite.obtenir(id);
    if (!p?.suivie) throw new ErreurStudio("INTROUVABLE", "Cette page n'est pas suivie.");
    await d.pagesSite.modifier(id, { suivie: { ...p.suivie, retireeLe: maintenant() } });
    await journaliser("site", `Page retirée de la liste : ${p.url.replace("https://axion-ia.com", "")}`, { type: "page-site", id });
  });
}

/** « Relire maintenant » : la lecture part en tâche de fond (elle dure quelques minutes) ; l'écran se met à jour. */
export async function relireMaintenant(dep: DependancesSite = {}): Promise<{ lancee: boolean; message: string }> {
  await exigerSession();
  if (etatProcessus().enCours) return { lancee: false, message: "Lecture déjà en cours." };
  await sousVerrou(async () => {
    if ((await depots().pagesSite.compter((p) => !!p.suivie)) === 0) await assurerPagesDepart();
  });
  void lireLeSite(dep).catch((e) => console.error("[studio] lecture de votre site en échec", e));
  return { lancee: true, message: "Lecture lancée : quelques minutes." };
}

/** Lecture en cours ? (écran) */
export function lectureSiteEnCours(): boolean {
  return etatProcessus().enCours;
}
