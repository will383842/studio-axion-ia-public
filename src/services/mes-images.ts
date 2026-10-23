/**
 * « MES IMAGES » (lot A2, `MES-IMAGES-ORGANISATION.md`) : Will dépose en vrac, le studio range, Will valide.
 *  - import : les octets partent du navigateur vers le stockage (envoi par morceaux existant) ; ici, on classe :
 *    catégorie, mots-clés FR / EN, description, cadrage vertical, zones sensibles, qualité (`analyserImage`,
 *    simulé par règles tant qu'aucune clé Claude) ; un DOUBLON (même empreinte) n'est pas réimporté ;
 *  - toute image arrive « à vérifier » : le moteur ne l'utilise pas tant que Will ne l'a pas validée ;
 *  - validation en série (un geste) : zones floutées sur une COPIE (`traitement-image` de `studio-rendu`),
 *    accords, catégorie et mots-clés corrigés ; l'original n'est jamais modifié ;
 *  - rien n'est jamais supprimé : « Archiver » range l'image, « Restaurer » la remet.
 */
import "server-only";
import type { CategorieMesImages, ElementBibliotheque, Fichier, Id, ZoneSensible } from "@/domaine/types";
import { appliquerValidation, confidentialiteInitiale, correspondRecherche, estDoublon, LICENCE_MES_IMAGES, motsClesPropres, nomDepuisFichier, pastillesMesImage, statutCalcule, type ValidationMesImage } from "@/domaine/mes-images";
import { CATEGORIES_MES_IMAGES } from "@/domaine/mes-images";
import type { AnalyseImage, DemandeRendu } from "@/fournisseurs";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { ErreurRendu, obtenirServiceRendu, renduSimule } from "@/fournisseurs/rendu/client";
import { analyserImageSimulee, GRILLE_ZONES_SIMULEES } from "@/fournisseurs/simulation/analyse-image";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { urlsFichiers } from "./fichiers";

const TYPES = ["illustration-image", "illustration-video"] as const;
const estMesImage = (e: ElementBibliotheque) => e.origine === "personnelle" && (e.type === "illustration-image" || e.type === "illustration-video");

/* ------------------------------------------------------------------ */
/* Vues                                                                */
/* ------------------------------------------------------------------ */

export interface VueMesImage {
  id: Id;
  type: "illustration-image" | "illustration-video";
  nom: string;
  description?: string;
  categorie?: CategorieMesImages;
  motsCles: string[];
  motsClesEn: string[];
  /** Image montrée : la copie floutée quand elle existe. */
  vignette: string | null;
  largeur?: number;
  hauteur?: number;
  statut: "a_verifier" | "prete";
  zones: ZoneSensible[];
  accordTiers?: boolean;
  accordClient?: boolean;
  floutee: boolean;
  /** La copie floutée est un VRAI fichier (sinon, essai : l'écran pose le flou sur les zones). */
  copieReelle: boolean;
  qualite?: ElementBibliotheque["qualiteImage"];
  cadrage?: ElementBibliotheque["cadrageVertical"];
  utilisations: number;
  pastilles: ReturnType<typeof pastillesMesImage>;
  archiveLe?: string;
  importeDepuis?: ElementBibliotheque["importeDepuis"];
}

export interface FiltresMesImages {
  categorie?: CategorieMesImages;
  q?: string;
  motCle?: string;
  statut?: "a_verifier" | "prete";
  ranges?: boolean;
}

async function versVues(liste: ElementBibliotheque[]): Promise<VueMesImage[]> {
  const d = depots();
  const fichiers = new Map<string, Fichier>();
  for (const e of liste) {
    for (const id of [e.fichierId, e.confidentialite?.fichierFlouteId, e.vignetteFichierId]) {
      if (id && !fichiers.has(id)) {
        const f = await d.fichiers.obtenir(id);
        if (f) fichiers.set(id, f);
      }
    }
  }
  const urls = await urlsFichiers(liste.map((e) => e.confidentialite?.fichierFlouteId ?? e.vignetteFichierId ?? e.fichierId));
  return liste.map((e) => {
    const original = e.fichierId ? fichiers.get(e.fichierId) : undefined;
    const montre = e.confidentialite?.fichierFlouteId ?? e.vignetteFichierId ?? e.fichierId;
    return {
      id: e.id,
      type: e.type as VueMesImage["type"],
      nom: e.nom,
      description: e.description,
      categorie: e.categorieImage,
      motsCles: e.motsCles,
      motsClesEn: e.motsClesEn ?? [],
      vignette: montre ? (urls[montre] ?? null) : null,
      largeur: original?.largeur,
      hauteur: original?.hauteur,
      statut: e.confidentialite?.statut ?? "a_verifier",
      zones: e.confidentialite?.zones ?? [],
      accordTiers: e.confidentialite?.accordTiers,
      accordClient: e.confidentialite?.accordClient,
      floutee: !!e.confidentialite?.fichierFlouteId,
      copieReelle: !!e.confidentialite?.fichierFlouteId && fichiers.get(e.confidentialite.fichierFlouteId)?.cleStockage !== original?.cleStockage,
      qualite: e.qualiteImage,
      cadrage: e.cadrageVertical,
      utilisations: e.utilisations ?? 0,
      pastilles: pastillesMesImage(e),
      archiveLe: e.archiveLe,
      importeDepuis: e.importeDepuis,
    };
  });
}

export async function listerMesImages(filtres: FiltresMesImages = {}): Promise<VueMesImage[]> {
  await exigerSession();
  const liste = await depots().elements.lister(
    (e) =>
      estMesImage(e) &&
      !!e.archiveLe === !!filtres.ranges &&
      (!filtres.categorie || e.categorieImage === filtres.categorie) &&
      (!filtres.statut || (e.confidentialite?.statut ?? "a_verifier") === filtres.statut) &&
      (!filtres.motCle || e.motsCles.includes(filtres.motCle)) &&
      (!filtres.q || correspondRecherche(e, filtres.q)),
  );
  // À vérifier d'abord, puis les plus récentes.
  liste.sort((a, b) => Number(a.confidentialite?.statut === "prete") - Number(b.confidentialite?.statut === "prete") || b.creeLe.localeCompare(a.creeLe));
  return versVues(liste);
}

/** Compteurs par catégorie et « à vérifier » (en-tête de l'écran). */
export async function resumeMesImages(): Promise<{ total: number; aVerifier: number; parCategorie: Record<string, number>; motsCles: string[] }> {
  await exigerSession();
  const liste = await depots().elements.lister((e) => estMesImage(e) && !e.archiveLe);
  const parCategorie: Record<string, number> = Object.fromEntries(CATEGORIES_MES_IMAGES.map((c) => [c.id, 0]));
  const mots = new Map<string, number>();
  for (const e of liste) {
    if (e.categorieImage) parCategorie[e.categorieImage] = (parCategorie[e.categorieImage] ?? 0) + 1;
    for (const m of e.motsCles) mots.set(m, (mots.get(m) ?? 0) + 1);
  }
  return {
    total: liste.length,
    aVerifier: liste.filter((e) => e.confidentialite?.statut !== "prete").length,
    parCategorie,
    motsCles: [...mots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([m]) => m),
  };
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/** Empreintes déjà connues parmi celles proposées (le navigateur n'envoie pas ces fichiers). */
export async function doublonsConnus(empreintes: string[]): Promise<string[]> {
  await exigerSession();
  const existants = await depots().elements.lister((e) => !!e.empreinte);
  return empreintes.filter((x) => estDoublon(x, existants));
}

export interface FichierImporte {
  fichierId: Id;
  nom: string;
  mime: string;
  /** SHA-256 du contenu, calculée dans le navigateur. */
  empreinte?: string;
  largeur?: number;
  hauteur?: number;
  depuis?: "fichier" | "dossier" | "drive";
}

/** Zones simulées (grille 1000 × 1000) remises à l'échelle de l'image. */
export function zonesALEchelle(zones: ZoneSensible[], largeur?: number, hauteur?: number): ZoneSensible[] {
  if (!largeur || !hauteur) return zones;
  const kx = largeur / GRILLE_ZONES_SIMULEES;
  const ky = hauteur / GRILLE_ZONES_SIMULEES;
  return zones.map((z) => ({ ...z, x: Math.round(z.x * kx), y: Math.round(z.y * ky), largeur: Math.round(z.largeur * kx), hauteur: Math.round(z.hauteur * ky) }));
}

/** Importe des fichiers déjà déposés : classement, contrôle de confidentialité, doublons écartés (jamais supprimés). */
export async function importerMesImages(fichiers: FichierImporte[]): Promise<{ importees: Id[]; doublons: string[] }> {
  await exigerSession();
  const d = depots();
  const illustrations = await fournisseur("illustration");
  const existants = await d.elements.lister((e) => !!e.empreinte);
  const importees: Id[] = [];
  const doublons: string[] = [];
  for (const f of fichiers.slice(0, 200)) {
    const fichier = await d.fichiers.obtenir(f.fichierId);
    if (!fichier) continue;
    if (estDoublon(f.empreinte, existants)) {
      doublons.push(f.nom);
      continue;
    }
    if (f.largeur || f.hauteur || f.empreinte) await d.fichiers.modifier(f.fichierId, { largeur: f.largeur, hauteur: f.hauteur, sha256: f.empreinte ?? fichier.sha256 });
    const analyse: AnalyseImage = await (illustrations.analyserImage ?? analyserImageSimulee)({ fichierCle: fichier.cleStockage, mime: f.mime, nom: f.nom });
    // Simulation : zones sur une grille de 1000 → remises à l'échelle de l'image.
    const simulee = !illustrations.analyserImage || illustrations.analyserImage === analyserImageSimulee;
    const zones = simulee ? zonesALEchelle(analyse.zones, f.largeur, f.hauteur) : analyse.zones;
    const grande = Math.max(f.largeur ?? 0, f.hauteur ?? 0);
    const qualite = { ...analyse.qualite, assezGrande: analyse.qualite.assezGrande && (!grande || grande >= 1080) };
    if (!qualite.assezGrande && !qualite.remarques.length) qualite.remarques = ["Image trop petite pour le 1080 × 1920"];
    const type = f.mime.startsWith("video/") ? "illustration-video" : "illustration-image";
    const id = nouvelId("el");
    const element: ElementBibliotheque = {
      id,
      type,
      nom: nomDepuisFichier(f.nom),
      motsCles: motsClesPropres(analyse.motsCles),
      motsClesEn: motsClesPropres(analyse.motsClesEn),
      description: analyse.description,
      valeur: { type },
      fichierId: f.fichierId,
      vignetteFichierId: f.fichierId,
      licence: { ...LICENCE_MES_IMAGES },
      formatsParDefaut: [],
      marqueId: "marque-axion",
      origine: "personnelle",
      categorieImage: analyse.categorie,
      cadrageVertical: analyse.cadrageVertical,
      confidentialite: confidentialiteInitiale({ ...analyse, zones }),
      qualiteImage: qualite,
      empreinte: f.empreinte,
      importeDepuis: f.depuis ?? "fichier",
      utilisations: 0,
      ...horodatage(),
    };
    await d.elements.enregistrer(element);
    existants.push(element);
    importees.push(id);
  }
  if (importees.length) await journaliser("bibliotheque", `${importees.length} image${importees.length > 1 ? "s" : ""} ajoutée${importees.length > 1 ? "s" : ""} à Mes images (à vérifier)`);
  return { importees, doublons };
}

/* ------------------------------------------------------------------ */
/* Copie floutée (studio-rendu)                                         */
/* ------------------------------------------------------------------ */

/**
 * Demande à `studio-rendu` une COPIE floutée (attente bornée : file courte, quelques secondes). Sans conteneur ni
 * stockage réel (essai) : la copie est enregistrée sur la même clé, et l'écran montre les zones floutées.
 */
export async function copieFloutee(original: Fichier, zones: ZoneSensible[], env: Record<string, string | undefined> = process.env): Promise<Id> {
  const d = depots();
  const stockage = await fournisseur("stockage");
  const base = original.cleStockage.replace(/\.[a-z0-9]+$/i, "");
  const cle = `${base}-floutee-${Date.now().toString(36)}.jpg`;
  const reel = !renduSimule(env) && !!stockage.urlLectureDuree && !!stockage.urlDepotDuree;
  if (reel) {
    const demande: DemandeRendu = {
      idRendu: `floutage-${original.id}-${Date.now().toString(36)}`,
      operation: "traitement-image",
      file: "courte",
      entrees: { image: await stockage.urlLectureDuree!(original.cleStockage, 3600) },
      sortie: { urlDepot: await stockage.urlDepotDuree!(cle, 3600, "image/jpeg"), cle },
      parametres: { mode: "flouter", zones: zones.map(({ x, y, largeur, hauteur }) => ({ x, y, largeur, hauteur })) },
    };
    // Attente partagée (une seule boucle pour tout le studio), sans nouvel essai.
    await executerRendu(obtenirServiceRendu(env), demande, { delaiMs: 60_000, essais: 0 }).catch((e: unknown) => {
      throw new ErreurStudio("FLOUTAGE", e instanceof ErreurRendu && e.erreur.code === "indisponible" ? "Le floutage prend trop de temps. Réessayez dans un instant." : "Le floutage n'a pas abouti. Réessayez.");
    });
  }
  const f = await d.fichiers.enregistrer({
    id: nouvelId("f"),
    cleStockage: reel ? cle : original.cleStockage,
    nom: `${original.nom.replace(/\.[^.]+$/, "")}-floutee.jpg`,
    mime: reel ? "image/jpeg" : original.mime,
    taille: original.taille,
    largeur: original.largeur,
    hauteur: original.hauteur,
    origine: "fabrication",
    statut: "pret",
    ...horodatage(),
  });
  return f.id;
}

/* ------------------------------------------------------------------ */
/* Validation en série                                                  */
/* ------------------------------------------------------------------ */

/** « OK » (un geste) : zones floutées sur une copie, accords, corrections ; « prête » si plus rien ne manque. */
export async function validerMesImage(id: Id, v: ValidationMesImage): Promise<VueMesImage> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e || !estMesImage(e)) throw new ErreurStudio("INTROUVABLE", "Cette image n'existe plus.");
  const zones = (e.confidentialite?.zones ?? []).filter((_, i) => !v.zonesAFlouter || v.zonesAFlouter.includes(i));
  let fichierFlouteId = e.confidentialite?.fichierFlouteId;
  const dejaFloutees = zones.length > 0 && zones.every((z) => z.floutee) && !!fichierFlouteId;
  if (zones.length && !dejaFloutees && e.type === "illustration-image") {
    const original = e.fichierId ? await d.fichiers.obtenir(e.fichierId) : null;
    if (!original) throw new ErreurStudio("INTROUVABLE", "Le fichier d'origine est introuvable.");
    fichierFlouteId = await copieFloutee(original, zones);
  }
  const patch = appliquerValidation(e, { ...v, categorie: v.categorie && CATEGORIES_MES_IMAGES.some((c) => c.id === v.categorie) ? v.categorie : undefined }, maintenant(), fichierFlouteId);
  // Une vidéo avec des zones ne peut pas être floutée ici : elle reste « à vérifier » (jamais utilisée sans floutage).
  if (e.type === "illustration-video" && zones.length) patch.confidentialite = { ...patch.confidentialite!, statut: "a_verifier" };
  await d.elements.modifier(id, patch);
  await journaliser("bibliotheque", `${patch.confidentialite?.statut === "prete" ? "Image prête" : "Image vérifiée, il manque encore un accord"} : ${e.nom}`, { type: "element", id });
  const [vue] = await versVues([{ ...e, ...patch }]);
  return vue;
}

/** Corrige catégorie et mots-clés sans valider (le statut ne change pas). */
export async function corrigerMesImage(id: Id, patch: { categorie?: CategorieMesImages; motsCles?: string[]; nom?: string }): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e || !estMesImage(e)) throw new ErreurStudio("INTROUVABLE", "Cette image n'existe plus.");
  const categorieImage = patch.categorie && CATEGORIES_MES_IMAGES.some((c) => c.id === patch.categorie) ? patch.categorie : e.categorieImage;
  const confidentialite = e.confidentialite ? { ...e.confidentialite, statut: statutCalcule({ confidentialite: e.confidentialite, categorieImage, valideLe: e.valideLe }) } : e.confidentialite;
  await d.elements.modifier(id, { categorieImage, confidentialite, ...(patch.motsCles ? { motsCles: motsClesPropres(patch.motsCles) } : {}), ...(patch.nom?.trim() ? { nom: patch.nom.trim().slice(0, 80) } : {}) });
}

/** Archive (jamais supprimée) ou restaure une image. */
export async function archiverMesImage(id: Id, archiver: boolean): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(id);
  if (!e || !estMesImage(e)) throw new ErreurStudio("INTROUVABLE", "Cette image n'existe plus.");
  await d.elements.modifier(id, { archiveLe: archiver ? maintenant() : undefined });
  await journaliser("bibliotheque", `${archiver ? "Archivée" : "Restaurée"} : ${e.nom}`, { type: "element", id });
}

/* ------------------------------------------------------------------ */
/* Google Drive (option préparée, simulée)                              */
/* ------------------------------------------------------------------ */

/**
 * Import d'un dossier Google Drive : PRÉPARÉ, pas encore relié. Lecture seule (le Drive n'est jamais modifié).
 * Vérifie l'adresse et répond « à relier » ; aucune donnée n'est inventée.
 * Lot E2 : la connexion au Drive (OAuth lecture seule, jetons chiffrés) et la copie côté serveur des VIDÉOS existent
 * désormais dans `services/google-drive.ts` (Réglages › Mon Google Drive, sélecteur de la séance facecam). L'import
 * d'un DOSSIER d'images s'y branchera (`listerVideosDrive` → même accès, filtre images) ; le message renvoie déjà à
 * la connexion.
 */
export async function preparerImportDrive(adresse: string): Promise<{ dossierId: string; relie: false; message: string }> {
  await exigerSession();
  const m = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/.exec(adresse.trim());
  if (!m) throw new ErreurStudio("ADRESSE", "Collez l'adresse d'un dossier Google Drive.");
  return { dossierId: m[1], relie: false, message: "Import d'un dossier Google Drive bientôt disponible : le dossier sera lu sans jamais être modifié. Reliez déjà votre Drive dans Réglages › Mon Google Drive." };
}

export { TYPES as TYPES_MES_IMAGES };

/**
 * Essai local seulement (route `/api/mes-images/essai-local`) : garde l'image sous `public/essais/mes-images/` et
 * relie le fichier enregistré à cette copie, quand le stockage est SIMULÉ. Refusé en production ou avec R2.
 */
export async function garderCopieLocale(fichierId: Id, contenu: Uint8Array): Promise<{ cle: string }> {
  if (process.env.NODE_ENV === "production") throw new ErreurStudio("INDISPONIBLE", "Indisponible.");
  const stockage = await fournisseur("stockage");
  if (stockage.mode !== "simulation") throw new ErreurStudio("INDISPONIBLE", "Le stockage réel reçoit déjà les fichiers.");
  const d = depots();
  const f = await d.fichiers.obtenir(fichierId);
  if (!f || !f.mime.startsWith("image/")) throw new ErreurStudio("INTROUVABLE", "Fichier inconnu.");
  const ext = ({ "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[f.mime] ?? "jpg";
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dossier = join(process.cwd(), "public", "essais", "mes-images");
  await mkdir(dossier, { recursive: true });
  await writeFile(join(dossier, `${fichierId}.${ext}`), contenu);
  const cle = `/essais/mes-images/${fichierId}.${ext}`;
  await d.fichiers.modifier(fichierId, { cleStockage: cle, taille: contenu.length });
  return { cle };
}
