/**
 * « VOTRE VIDÉO » DU TABLEAU ANIMÉ (raccords 1 et 2) : ce que la fiche vidéo montre et ce que ses boutons font.
 *
 * - `vueTableau(videoId)` : la fiche de scènes (celle du projet de montage si elle a été retouchée, sinon celle du
 *   stockage, `entrees.tableau.ficheScenesCle`), validée par les règles, le coût de la voix (tarif existant), les
 *   retouches du catalogue fermé (`{cle, libelle, payant}`) et les listes fermées de leurs paramètres, tirées de la
 *   fiche. Erreurs en phrases simples : jamais d'exception jusqu'à l'écran.
 * - `retoucherTableau(videoId, operation, { accord })` : `apercuRetouche` d'abord (refus = la phrase, rien n'est
 *   lancé) ; une retouche PAYANTE (voix refaite) ne part qu'avec un accord égal ou supérieur au montant annoncé ;
 *   sinon, le chemin de retouche du studio (`lancerRetouche`, opérations transmises au moteur). La voix relue est
 *   contrôlée et réservée par la chaîne juste avant sa lecture, par le chemin unique `verifierEtReserver`
 *   (`tableau-branchements.ts`).
 *
 * Tant que le format est `masque`, rien n'est montré et rien n'est lancé.
 */
import "server-only";
import { DESSINS, trouverDessin } from "@/briques/dessins";
import type { ProblemeFiche } from "@/briques/fiche-scenes";
import { ecranTableauVisible } from "@/components/formats/tableau-anime/aiguillage";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import type { Id, VersionVideo } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { formaterMontant } from "@/lib/montants";
import type { OperationMontage } from "@/moteurs";
import { CATALOGUE_RETOUCHES, apercuRetouche, lireEntreesTableau, type ContexteRetouche } from "@/moteurs/montage-tableau";
import { estimerFabrication } from "@/moteurs/montage-tableau/fabriquer";
import { lecturesVoixMaxDuReglage } from "./voix-ressemblance";
import { FORMATS_SORTIE, IDS_SORTIES, formatImage } from "@/moteurs/montage-tableau/formats-sortie";
import { MARQUES, validerFicheTableau, type ElementTableau, type FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { GESTES_RETOUCHE, lireOperationRetouche, type OperationRetouche, type TypeOperationRetouche } from "@/moteurs/montage-tableau/retouches";
import { depots } from "./_commun";
import { exigerSession } from "./auth";
import { lancerRetouche } from "./fabrication";
import { avecAccordAutomatique } from "./mode-budget";
import { appelsValides, reseauDuTableau } from "./tableau-fin";
import { interditsDeLaMarque } from "./tableau-marque";
import { TARIF_VOIX_CENTIMES_PAR_CARACTERE } from "./tableau-outils";

/* ------------------------------------------------------------------ */
/* Types montrés à l'écran                                               */
/* ------------------------------------------------------------------ */

/** Un bouton de retouche (forme attendue par `BoutonsRetoucheTableau`). */
export interface BoutonRetoucheTableau {
  cle: TypeOperationRetouche;
  libelle: string;
  payant: boolean;
}

export interface ChoixFerme {
  valeur: string;
  libelle: string;
}

/** Une scène, avec ses éléments retouchables, en listes fermées (aucune coordonnée, aucun identifiant montré). */
export interface SceneAChoisir {
  id: string;
  libelle: string;
  texteDit: string;
  premiereDePage: boolean;
  derniereDePage: boolean;
  premiere: boolean;
  lignes: { id: string; libelle: string; texte: string; mots: string[]; importants: string[]; marquee: boolean }[];
  dessins: ChoixFerme[];
  gestes: ChoixFerme[];
  elements: ChoixFerme[];
}

/** Listes fermées des paramètres des retouches, tirées de la fiche (et de la banque de dessins, des fins validées). */
export interface ChoixRetoucheTableau {
  scenes: SceneAChoisir[];
  dessins: ChoixFerme[];
  marques: ChoixFerme[];
  gestes: ChoixFerme[];
  appels: ChoixFerme[];
}

export interface VueTableau {
  /** La fiche à montrer ; `null` : introuvable ou illisible (`erreur` dit pourquoi). */
  fiche: Pick<FicheTableau, "scenes"> | null;
  problemes: ProblemeFiche[];
  /** Prix de la voix de la fiche, en centimes d'euro (jamais sous-estimé). */
  coutCentimes: number;
  /** Retouches proposées ; vide tant que la fiche est refusée. */
  retouches: BoutonRetoucheTableau[];
  choix: ChoixRetoucheTableau | null;
  erreur: string | null;
  /** Une vidéo par format fabriqué, avec les réseaux qu'elle sert et son adresse de téléchargement. */
  sorties?: SortieTableauVue[];
}

/** Une vidéo fabriquée, pour un format d'image. */
export interface SortieTableauVue {
  libelle: string;
  /** « 1080 × 1920 ». */
  dimensions: string;
  /** Réseaux EXACTS servis par ce fichier (deux verticaux : Reels et stories d'un côté, TikTok et Shorts de l'autre). */
  reseaux: string[];
  /** Alertes de ce fichier à montrer (fin sans appel pour TikTok et Shorts, phrase à valider…) ; absent : aucune. */
  alertes?: string[];
  /** Adresse de téléchargement ; absente : fichier pas encore disponible. */
  url?: string;
}

/** Sortie fabriquée telle que le projet de montage la garde (`projetMontage.tableau.sorties`). */
export interface SortieDuProjet {
  format: string;
  libelle: string;
  ratio: string;
  largeur: number;
  hauteur: number;
  reseaux: string[];
  dureeSec?: number;
}

/**
 * Sorties de la version, dans l'ordre des formats (PUR) : format reconnu à son ratio, réseaux servis. Deux fichiers
 * du même ratio (le vertical des Reels et stories, celui de TikTok et Shorts) : chacun reçoit sa sortie du projet
 * (`projet`, appariée par durée puis dans l'ordre), avec son libellé et ses réseaux exacts, et ses alertes de fin.
 */
export function sortiesDeLaVersion(sorties: readonly { ratio: string; fichierId: string; resolution: string; dureeSec?: number; rapportQualite?: { alertes?: readonly { code?: string; message: string }[] } }[], urls: Readonly<Record<string, string>>, projet: readonly SortieDuProjet[] = []): SortieTableauVue[] {
  const alertesDe = (s: (typeof sorties)[number]) => (s.rapportQualite?.alertes ?? []).filter((a) => a.code === "fin" && /TikTok et Shorts/.test(a.message)).map((a) => a.message);
  const res: SortieTableauVue[] = [];
  for (const id of IDS_SORTIES) {
    const f = FORMATS_SORTIE[formatImage(id)];
    const duProjet = projet.filter((p) => p.ratio === f.ratio);
    const memes = sorties.filter((x) => x.ratio === f.ratio);
    // Sans le projet (versions d'avant), une seule sortie par ratio : celle du format d'image.
    if (!duProjet.length) {
      if (id !== formatImage(id) || !memes[0]) continue;
      const s = memes[0];
      res.push({ libelle: f.libelle, dimensions: `${f.largeur} × ${f.hauteur}`, reseaux: f.reseaux.map((r) => r.libelle), ...(urls[s.fichierId] ? { url: urls[s.fichierId] } : {}) });
      continue;
    }
    const p = duProjet.find((x) => x.format === id);
    if (!p) continue;
    // Appariement : même durée (au dixième de seconde) d'abord, sinon le même rang parmi les fichiers de ce ratio.
    const rang = duProjet.indexOf(p);
    const s = memes.find((x) => p.dureeSec !== undefined && x.dureeSec !== undefined && Math.abs(x.dureeSec - p.dureeSec) < 0.05 && memes.filter((y) => y.dureeSec !== undefined && Math.abs(y.dureeSec - p.dureeSec!) < 0.05).length === 1) ?? memes[rang];
    if (!s) continue;
    const alertes = alertesDe(s);
    res.push({ libelle: p.libelle, dimensions: `${p.largeur} × ${p.hauteur}`, reseaux: [...p.reseaux], ...(alertes.length ? { alertes } : {}), ...(urls[s.fichierId] ? { url: urls[s.fichierId] } : {}) });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Construction (pure)                                                   */
/* ------------------------------------------------------------------ */

const LIBELLES_MARQUES: Readonly<Record<(typeof MARQUES)[number], string>> = { souligne: "Souligner", entoure: "Entourer", barre: "Barrer", surligne: "Surligner" };
const LIBELLES_GESTES: Readonly<Record<(typeof GESTES_RETOUCHE)[number], string>> = { souligner: "Souligner", entourer: "Entourer", barrer: "Barrer", cocher: "Cocher" };

const nomDessin = (id: string) => {
  const nom = trouverDessin(id)?.nom ?? id.replace(/[-_]+/g, " ");
  return nom.charAt(0).toUpperCase() + nom.slice(1);
};
const motPropre = (m: string) => m.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

function libelleElement(e: ElementTableau, parId: Map<string, ElementTableau>): string {
  switch (e.type) {
    case "ligne":
    case "mention":
      return `« ${e.texte} »`;
    case "chiffre":
      return [e.valeur, e.unite].filter(Boolean).join(" ");
    case "preuve":
      return "La bulle de preuve";
    case "dessin":
      return `Dessin : ${nomDessin(e.dessinId).toLowerCase()}`;
    case "geste": {
      const cible = parId.get(e.cibleId);
      const quoi = cible && cible.type !== "geste" ? ` sur ${libelleElement(cible, parId).replace(/^Dessin : /, "le dessin ")}` : "";
      return `Le geste du stylo${quoi}`;
    }
  }
}

/** Listes fermées tirées de la fiche. */
export function choixDeLaFiche(fiche: FicheTableau, appels: readonly ChoixFerme[] = []): ChoixRetoucheTableau {
  const scenes = fiche.scenes.map((s, i, t): SceneAChoisir => {
    const parId = new Map(s.elements.map((e) => [e.id, e] as const));
    return {
      id: s.id,
      libelle: `Scène ${i + 1}`,
      texteDit: s.texteDit,
      premiere: i === 0,
      premiereDePage: i === 0 || t[i - 1].page !== s.page,
      derniereDePage: i === t.length - 1 || t[i + 1].page !== s.page,
      lignes: s.elements.flatMap((e) =>
        e.type === "ligne" ? [{ id: e.id, libelle: `« ${e.texte} »`, texte: e.texte, mots: [...new Set(e.texte.split(/\s+/).map(motPropre).filter(Boolean))], importants: [...(e.importants ?? [])], marquee: !!e.marque }] : [],
      ),
      dessins: s.elements.flatMap((e) => (e.type === "dessin" ? [{ valeur: e.id, libelle: nomDessin(e.dessinId) }] : [])),
      gestes: s.elements.flatMap((e) => (e.type === "geste" ? [{ valeur: e.id, libelle: libelleElement(e, parId) }] : [])),
      elements: s.elements.map((e) => ({ valeur: e.id, libelle: libelleElement(e, parId) })),
    };
  });
  return {
    scenes,
    dessins: DESSINS.map((d) => ({ valeur: d.id, libelle: nomDessin(d.id) })),
    marques: MARQUES.map((m) => ({ valeur: m, libelle: LIBELLES_MARQUES[m] })),
    gestes: GESTES_RETOUCHE.map((g) => ({ valeur: g, libelle: LIBELLES_GESTES[g] })),
    appels: [...appels],
  };
}

/** Boutons du catalogue fermé, dans son ordre. */
export function boutonsRetouche(): BoutonRetoucheTableau[] {
  return (Object.entries(CATALOGUE_RETOUCHES) as [TypeOperationRetouche, (typeof CATALOGUE_RETOUCHES)[TypeOperationRetouche]][]).map(([cle, d]) => ({ cle, libelle: d.libelle, payant: d.payant }));
}

/** Forme minimale d'une fiche refusée qu'on peut encore montrer (scènes et éléments lisibles). */
function montrable(brute: unknown): brute is Pick<FicheTableau, "scenes"> {
  const scenes = (brute as { scenes?: unknown } | null)?.scenes;
  return (
    Array.isArray(scenes) &&
    scenes.length > 0 &&
    scenes.every((s) => {
      const x = s as Record<string, unknown> | null;
      return !!x && typeof x.id === "string" && typeof x.texteDit === "string" && typeof x.page === "number" && Array.isArray(x.elements) && x.elements.every((e) => !!e && typeof (e as { type?: unknown }).type === "string");
    })
  );
}

const texteDit = (f: Pick<FicheTableau, "scenes">) => f.scenes.map((s) => s.texteDit).join(" ");

/** Vue d'une fiche brute (pure) : validée par les règles, son prix, ses retouches. */
export function construireVueTableau(brute: unknown, contexte: ContexteRetouche, tarifCentimesParCaractere: number, appels: readonly ChoixFerme[] = []): VueTableau {
  if (brute === undefined || brute === null) return { fiche: null, problemes: [], coutCentimes: 0, retouches: [], choix: null, erreur: "La fiche de scènes de cette vidéo est introuvable." };
  const { appels: _appels, ...regles } = contexte;
  void _appels;
  let r: ReturnType<typeof validerFicheTableau>;
  try {
    r = validerFicheTableau(brute, { ...regles, texteScript: montrable(brute) ? texteDit(brute) : "" });
  } catch {
    return { fiche: null, problemes: [], coutCentimes: 0, retouches: [], choix: null, erreur: "La fiche de scènes de cette vidéo est illisible." };
  }
  if (r.ok) return { fiche: r.fiche, problemes: [], coutCentimes: estimerFabrication(r.fiche, tarifCentimesParCaractere).centimes, retouches: boutonsRetouche(), choix: choixDeLaFiche(r.fiche, appels), erreur: null };
  if (!montrable(brute)) return { fiche: null, problemes: r.problemes, coutCentimes: 0, retouches: [], choix: null, erreur: "La fiche de scènes de cette vidéo est illisible : corrigez-la, puis relancez." };
  return { fiche: brute, problemes: r.problemes, coutCentimes: estimerFabrication(brute, tarifCentimesParCaractere).centimes, retouches: [], choix: null, erreur: null };
}

/* ------------------------------------------------------------------ */
/* Lecture de la fiche                                                   */
/* ------------------------------------------------------------------ */

export interface DependancesVueTableau {
  /** Lit un JSON rangé dans le stockage (par défaut : le stockage du studio). */
  lireStockage?: (cle: string) => Promise<unknown>;
  /** Date du jour (AAAA-MM-JJ) des règles. */
  aujourdhui?: string;
  /** Adresses de téléchargement des fichiers (par défaut : celles du studio). */
  urls?: (ids: string[]) => Promise<Record<string, string>>;
}

async function lireStockageReel(cle: string): Promise<unknown> {
  const { resoudreFournisseur } = await import("@/fournisseurs");
  const stockage = resoudreFournisseur("stockage");
  const url = stockage.urlLectureDuree ? await stockage.urlLectureDuree(cle, 600) : await stockage.urlLecture(cle);
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`Fiche de scènes illisible (${r.status}).`);
  return r.json();
}

/** Fiche de la version : celle du projet de montage (retouchée, ou découpée sans fiche fournie), sinon le stockage. */
async function ficheDeLaVersion(version: VersionVideo, lire: (cle: string) => Promise<unknown>): Promise<unknown> {
  const projet = (version.projetMontage as { tableau?: { fiche?: unknown; retouchee?: boolean } } | undefined)?.tableau;
  const cle = lireEntreesTableau(version.commande.entrees).ficheScenesCle;
  if (projet?.fiche !== undefined && (projet.retouchee || !cle)) return projet.fiche;
  return cle ? lire(cle) : undefined;
}

/** Mots de la douleur validés avec la fiche à la création (règles « douleur en tête » et « geste fort »). */
const motsDouleurDe = (version: VersionVideo) => {
  const m = lireEntreesTableau(version.commande.entrees).motsDouleur;
  return m?.length ? { motsDouleur: m } : {};
};

/** Texte dit fourni par Will (origine « will » rangée à la création) : les retouches le prennent à l'identique, comme la création. */
const texteDeWillDe = (version: VersionVideo) => (lireEntreesTableau(version.commande.entrees).origine === "will" ? { texteDeWill: true } : {});

async function contexteRegles(aujourdhui: string): Promise<Omit<ContexteRetouche, "appels">> {
  const d = depots();
  const [preuves, matieres] = await Promise.all([d.preuves.lister(), d.matieres.lister()]);
  // Les interdits de la marque, lus comme à la création : un titre retouché à la main ne peut pas écrire ce que le découpage refuse.
  const { interdits, motsInterdits } = await interditsDeLaMarque();
  return { aujourdhui, sourcesChiffres: [], preuves, matieres, interdits, motsInterdits };
}

/** Version choisie d'une vidéo du tableau, si son écran est visible ; sinon `null`. */
async function versionDuTableau(videoId: Id): Promise<VersionVideo | null> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || !ecranTableauVisible(trouverFormat(video.formatId))) return null;
  const courante = video.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  return courante && courante.commande.moteurId === "montage-tableau" ? courante : null;
}

const aujourdhuiIso = () => new Date().toISOString().slice(0, 10);

/** Fiche, refus, coût de la voix et retouches de « Votre vidéo » ; `null` hors du tableau animé (ou masqué). */
export async function vueTableau(videoId: Id, dependances: DependancesVueTableau = {}): Promise<VueTableau | null> {
  await exigerSession();
  const version = await versionDuTableau(videoId);
  if (!version) return null;
  const reseau = reseauDuTableau(version.commande);
  const appels = appelsValides(reseau).map((f) => ({ valeur: f.id, libelle: f.ecran }));
  // Une vidéo par format (réseaux cochés à la création), chacune téléchargeable.
  const lues = await depots().sorties.lister((s) => s.versionId === version.id);
  const urls = await (dependances.urls ?? (async (ids: string[]) => (await import("./fichiers")).urlsFichiers(ids)))(lues.map((s) => s.fichierId));
  const projetSorties = (version.projetMontage as { tableau?: { sorties?: SortieDuProjet[] } } | undefined)?.tableau?.sorties;
  const sorties = sortiesDeLaVersion(lues, urls, Array.isArray(projetSorties) ? projetSorties : []);
  let brute: unknown;
  try {
    brute = await ficheDeLaVersion(version, dependances.lireStockage ?? lireStockageReel);
  } catch {
    return { fiche: null, problemes: [], coutCentimes: 0, retouches: [], choix: null, erreur: "La fiche de scènes n'a pas pu être lue. Rechargez la page dans un instant.", sorties };
  }
  const contexte = { ...(await contexteRegles(dependances.aujourdhui ?? aujourdhuiIso())), ...motsDouleurDe(version), ...texteDeWillDe(version) };
  // 14/10 : contrôle de ressemblance de la voix : le prix montré couvre toutes les lectures possibles.
  return { ...construireVueTableau(brute, { ...contexte, appels: appels.map((a) => a.valeur) }, TARIF_VOIX_CENTIMES_PAR_CARACTERE * (await lecturesVoixMaxDuReglage()), appels), sorties };
}

/**
 * « Demander une modification » (17/10) : la fiche de la version choisie et le contexte des règles, comme pour les
 * boutons. `null` hors du tableau animé (ou masqué) ; la fiche peut manquer (`fiche: undefined`).
 */
export async function ficheTableauDeLaVideo(videoId: Id, dependances: DependancesVueTableau = {}): Promise<{ version: VersionVideo; fiche: FicheTableau | undefined; contexte: ContexteRetouche } | null> {
  const version = await versionDuTableau(videoId);
  if (!version) return null;
  const brute = await ficheDeLaVersion(version, dependances.lireStockage ?? lireStockageReel);
  const contexte: ContexteRetouche = { ...(await contexteRegles(dependances.aujourdhui ?? aujourdhuiIso())), ...motsDouleurDe(version), ...texteDeWillDe(version), appels: appelsValides(reseauDuTableau(version.commande)).map((f) => f.id) };
  return { version, fiche: montrable(brute) ? (brute as FicheTableau) : undefined, contexte };
}

/** Prix pour refaire la vidéo du tableau : celui de « Votre vidéo » (voix au tarif existant, toutes les lectures possibles). */
export async function prixRefaireTableau(fiche: FicheTableau): Promise<number> {
  return estimerFabrication(fiche, TARIF_VOIX_CENTIMES_PAR_CARACTERE, [], { lecturesVoixMax: await lecturesVoixMaxDuReglage() }).centimes;
}

/* ------------------------------------------------------------------ */
/* Retouche                                                              */
/* ------------------------------------------------------------------ */

export type IssueRetoucheTableau =
  | { statut: "lancee"; travailId: Id }
  | { statut: "refusee"; phrase: string }
  /** Retouche payante sans accord sur ce montant : rien n'est lancé. */
  | { statut: "accord-requis"; centimes: number; phrase: string };

/** Ce qui est retouché, en clair (historique de la version ; distingue deux retouches du même bouton). */
function consigneDe(op: OperationRetouche, fiche: FicheTableau): string {
  const libelle = CATALOGUE_RETOUCHES[op.type].libelle;
  if (op.type === "changerFin") return `${libelle} : ${op.appelId}`;
  const n = fiche.scenes.findIndex((s) => s.id === op.sceneId) + 1;
  const detail = "texte" in op ? ` : « ${op.texte} »` : "mot" in op ? ` : ${op.mot}` : "marque" in op ? ` : ${op.marque}` : "dessinId" in op ? ` : ${op.dessinId}` : "geste" in op ? ` : ${op.geste}` : "vers" in op ? ` : ${op.vers}` : "elementId" in op ? ` (${op.elementId})` : "";
  return `${libelle} — scène ${n}${detail}`;
}

/**
 * Une retouche par bouton. Refus des règles : la phrase, rien n'est lancé. Payante : un accord (montant en centimes)
 * au moins égal au montant annoncé, sinon rien n'est lancé. Sinon : le chemin de retouche du studio.
 */
export async function retoucherTableau(videoId: Id, operation: unknown, options: { accord?: AccordPrix } = {}, dependances: DependancesVueTableau = {}): Promise<IssueRetoucheTableau> {
  // Règle « le prix ne bloque jamais » : en mode indicatif, un accord-requis est relancé UNE fois avec le prix du jour ;
  // en mode bloquant (et pour l'Usine), l'issue d'avant est rendue telle quelle.
  return avecAccordAutomatique((accord) => retoucherTableauSansAuto(videoId, operation, { accord: accord ?? options.accord }, dependances), undefined, { videoId });
}

async function retoucherTableauSansAuto(videoId: Id, operation: unknown, options: { accord?: AccordPrix }, dependances: DependancesVueTableau): Promise<IssueRetoucheTableau> {
  await exigerSession();
  const version = await versionDuTableau(videoId);
  if (!version) return { statut: "refusee", phrase: "La retouche par boutons n'est pas disponible pour cette vidéo." };
  const op = lireOperationRetouche(operation);
  if (!op) return { statut: "refusee", phrase: "Cette retouche ne fait pas partie des boutons proposés." };
  const reseau = reseauDuTableau(version.commande);
  let brute: unknown;
  try {
    brute = await ficheDeLaVersion(version, dependances.lireStockage ?? lireStockageReel);
  } catch {
    return { statut: "refusee", phrase: "La fiche de scènes n'a pas pu être lue. Réessayez dans un instant." };
  }
  if (brute === undefined) return { statut: "refusee", phrase: "La fiche de scènes de cette vidéo est introuvable : la retouche n'est pas possible." };
  const contexte: ContexteRetouche = { ...(await contexteRegles(dependances.aujourdhui ?? aujourdhuiIso())), ...motsDouleurDe(version), ...texteDeWillDe(version), appels: appelsValides(reseau).map((f) => f.id) };
  const apercu = apercuRetouche(brute as FicheTableau, op, contexte);
  if (!apercu.ok) return { statut: "refusee", phrase: apercu.refus.join(" ") };

  let confirme: AccordPrix = true;
  if (apercu.payant) {
    const montant = estimerFabrication(apercu.fiche, TARIF_VOIX_CENTIMES_PAR_CARACTERE, [], { lecturesVoixMax: await lecturesVoixMaxDuReglage() }).centimes;
    const accord = accordPropre(options.accord);
    // Seul un MONTANT confirmé couvre la voix relue : `true` sans montant ne suffit pas.
    if (typeof accord !== "number" || accord < montant) {
      const prix = formaterMontant({ centimes: montant, devise: "EUR" });
      return { statut: "accord-requis", centimes: montant, phrase: `Cette retouche refait la voix : environ ${prix}. Confirmez ce prix pour continuer.` };
    }
    confirme = accord;
  }
  const r = await lancerRetouche(videoId, [], consigneDe(op, brute as FicheTableau), { confirme, operations: [op as unknown as OperationMontage] });
  return { statut: "lancee", travailId: r.travailId };
}
