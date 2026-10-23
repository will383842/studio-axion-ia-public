"use server";

/**
 * Actions serveur de la BIBLIOTHÈQUE (développeur B). Chacune commence par exigerSession().
 * B5 (audit A) : les fichiers ajoutés sont VRAIMENT envoyés par le navigateur (`envoyerFichier` → `/api/depots`) ;
 * l'action ne reçoit que l'identifiant du fichier arrivé, contrôlé par `fichierEnvoye`.
 */
import { revalidatePath } from "next/cache";
import type { CategorieMesImages, IdReseau, Licence, TypeElement, TypeLicence, ValeurElement } from "@/domaine/types";
import type { ValidationMesImage } from "@/domaine/mes-images";
import { archiverMesImage, corrigerMesImage, doublonsConnus, importerMesImages, preparerImportDrive, validerMesImage, type FichierImporte, type VueMesImage } from "@/services/mes-images";
import { RESEAUX } from "@/reseaux";
import { exigerSession } from "@/services/auth";
import { essayer, ErreurStudio, type Resultat } from "@/services/_commun";
import { ajouterRush, fichierAvantDeReference, modifierValeurElement, retirerParDefaut } from "@/services/B-personnages-bibliotheque";
import { ajouterPrononciation, creerElement, definirParDefaut, modifierElement, obtenirElementBrut, rangerElement, rangerPrononciation, remettreElement, remettrePrononciation, validerLutCube } from "@/services/bibliotheque";
import { deposerFichierSimule, fichierEnvoye } from "@/services/fichiers";
import { TAILLES_ACCEPTEES } from "@/lib/qc-lut";
import { calculerImageApresLut, cubeEnvoye, enregistrerCube, exigerOctetsDuCube } from "@/services/etalonnage";

export interface InfosFichier {
  nom: string;
  mime: string;
  taille: number;
}

/** Un fichier déjà envoyé par le navigateur (`envoyerFichier`) : seul son identifiant part ici. */
export interface FichierEnvoye {
  fichierId: string;
}

const TYPES: TypeElement[] = ["couleurs", "logo", "police", "lut", "style-sous-titres", "illustration-image", "illustration-video", "musique", "bruitage", "habillage", "style-montage", "profil-son", "decor", "accessoire"];

function rafraichir(type?: string) {
  revalidatePath("/bibliotheque");
  if (type) revalidatePath(`/bibliotheque/${type}`);
  if (type === "illustration-image" || type === "illustration-video") {
    revalidatePath("/bibliotheque/illustration-image");
    revalidatePath("/bibliotheque/illustration-video");
  }
}

/** Éléments créés par Will lui-même (aucun fichier tiers) : ils lui appartiennent, usage commercial compris. */
const TYPES_PROPRES: TypeElement[] = ["couleurs", "police", "habillage", "style-montage", "profil-son", "decor", "style-sous-titres"];
const LICENCE_PROPRE: Licence = { type: "propriete", usageCommercial: true, reseaux: [] };

const TYPES_LICENCE: TypeLicence[] = ["propriete", "libre", "abonnement", "achat", "generee-ia", "a-verifier"];

/** Licence reçue du navigateur, nettoyée champ par champ (AV2.3-12). */
function licencePropre(l: Partial<Licence>, actuelle: Licence): Licence {
  const reseauxConnus = new Set<string>(RESEAUX.map((r) => r.id));
  const texte = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : undefined);
  const date = typeof l.expireLe === "string" && /^\d{4}-\d{2}-\d{2}/.test(l.expireLe) && !Number.isNaN(Date.parse(l.expireLe)) ? l.expireLe.slice(0, 10) : undefined;
  return {
    type: l.type && TYPES_LICENCE.includes(l.type) ? l.type : actuelle.type,
    usageCommercial: l.usageCommercial === undefined ? actuelle.usageCommercial : !!l.usageCommercial,
    reseaux: Array.isArray(l.reseaux) ? (Array.from(new Set(l.reseaux.map(String))).filter((r) => reseauxConnus.has(r)) as IdReseau[]) : actuelle.reseaux,
    creditObligatoire: "creditObligatoire" in l ? texte(l.creditObligatoire, 120) : actuelle.creditObligatoire,
    expireLe: "expireLe" in l ? date : actuelle.expireLe,
    source: "source" in l ? texte(l.source, 80) : actuelle.source,
    preuveFichierId: actuelle.preuveFichierId,
  };
}

function motsClesPropres(m: string[] | undefined): string[] {
  return Array.from(new Set((m ?? []).map((x) => String(x).trim().toLowerCase()).filter(Boolean))).slice(0, 20);
}

/** Le fichier envoyé par le navigateur pour la Bibliothèque (destination « element »), contrôlé : jamais une fiche vide. */
function envoye(f: FichierEnvoye | null | undefined) {
  return fichierEnvoye(f?.fichierId, "element");
}

/** Ajoute un élément (avec ou sans fichier). La valeur doit correspondre au type. */
export async function creerElementAction(donnees: { type: TypeElement; nom: string; motsCles?: string[]; valeur: ValeurElement; fichier?: FichierEnvoye | null }): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!TYPES.includes(donnees.type)) throw new ErreurStudio("TYPE", "Ce type n'existe pas.");
    if (donnees.valeur?.type !== donnees.type) throw new ErreurStudio("TYPE", "Ce réglage ne correspond pas à ce type.");
    const nom = donnees.nom?.trim();
    if (!nom) throw new ErreurStudio("NOM", "Donnez-lui un nom.");
    const fichier = donnees.fichier ? await envoye(donnees.fichier) : undefined;
    const fichierId = fichier?.id;
    // Sans fichier tiers (couleurs, police, habillage…), l'élément est à Will : pas de « À vérifier » qui bloquerait le kit.
    const licence = !fichierId && TYPES_PROPRES.includes(donnees.type) ? LICENCE_PROPRE : undefined;
    // Un décor avec un fichier déposé est un décor « image » (ou « boucle » pour une vidéo), sinon une teinte (B.0 §6).
    const valeur: ValeurElement =
      donnees.valeur.type === "decor" && fichierId
        ? { ...donnees.valeur, mode: String(fichier?.mime).startsWith("video/") ? "boucle" : "image", imageFichierId: fichierId }
        : donnees.valeur;
    const id = await creerElement({ type: donnees.type, nom: nom.slice(0, 80), motsCles: motsClesPropres(donnees.motsCles), valeur, fichierId, licence });
    rafraichir(donnees.type);
    return { id };
  });
}

/** Ajoute plusieurs illustrations d'un coup (images et vidéos). */
export async function ajouterIllustrationsAction(fichiers: FichierEnvoye[], motsCles: string[]): Promise<Resultat<{ ids: string[] }>> {
  await exigerSession();
  return essayer(async () => {
    if (!fichiers.length) throw new ErreurStudio("FICHIERS", "Choisissez au moins une image ou une vidéo.");
    const ids: string[] = [];
    for (const x of fichiers.slice(0, 30)) {
      const f = await envoye(x);
      const type: TypeElement = String(f.mime).startsWith("video/") ? "illustration-video" : "illustration-image";
      const fichierId = f.id;
      const nom = String(f.nom ?? "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Illustration";
      ids.push(await creerElement({ type, nom: nom.charAt(0).toUpperCase() + nom.slice(1, 80), motsCles: motsClesPropres(motsCles), valeur: { type }, fichierId }));
    }
    rafraichir("illustration-image");
    return { ids };
  });
}

export async function modifierElementAction(id: string, type: string, patch: { nom?: string; motsCles?: string[]; favori?: boolean; licence?: Partial<Licence> }): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const actuel = patch.licence ? await obtenirElementBrut(id) : null;
    if (patch.licence && !actuel) throw new ErreurStudio("INTROUVABLE", "Cet élément n'existe plus.");
    await modifierElement(id, {
      ...(patch.licence && actuel ? { licence: licencePropre(patch.licence, actuel.licence) } : {}),
      ...(patch.nom !== undefined ? { nom: patch.nom.trim().slice(0, 80) || "Sans nom" } : {}),
      ...(patch.motsCles !== undefined ? { motsCles: motsClesPropres(patch.motsCles) } : {}),
      ...(patch.favori !== undefined ? { favori: !!patch.favori } : {}),
    });
    rafraichir(type);
    return undefined;
  });
}

export async function modifierValeurAction(id: string, valeur: ValeurElement): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await modifierValeurElement(id, valeur);
    rafraichir(valeur.type);
    return undefined;
  });
}

/** Joint une preuve de licence (facture, capture de l'abonnement…), envoyée pour de vrai par le navigateur. */
export async function deposerPreuveLicenceAction(id: string, type: string, fichier: FichierEnvoye): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const actuel = await obtenirElementBrut(id);
    if (!actuel) throw new ErreurStudio("INTROUVABLE", "Cet élément n'existe plus.");
    const preuveFichierId = (await envoye(fichier)).id;
    await modifierElement(id, { licence: { ...actuel.licence, preuveFichierId } });
    rafraichir(type);
    return undefined;
  });
}

/** « Ranger » : l'élément quitte la Bibliothèque mais n'est jamais effacé (ordre permanent : rien n'est purgé). */
export async function rangerElementAction(id: string, type: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rangerElement(id);
    rafraichir(type);
    return undefined;
  });
}

export async function remettreElementAction(id: string, type: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await remettreElement(id);
    rafraichir(type);
    return undefined;
  });
}

export async function basculerParDefautAction(elementId: string, type: string, formatId: string, actif: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (actif) await definirParDefaut(elementId, formatId);
    else await retirerParDefaut(elementId, formatId);
    rafraichir(type);
    return undefined;
  });
}

/**
 * Importe une LUT .cube. Le contenu est validé par le service (format, taille, complétude).
 * Au-delà de ~800 Ko, le navigateur l'a déjà validé et seul le résumé arrive ici.
 * Lot R5 : le .cube garde ses VRAIS octets dans le stockage (envoyé par le navigateur : `fichierId` ; sinon déposé ici
 * depuis son contenu), puis l'image « après » est calculée sur notre serveur si l'étalonnage réel est relié.
 */
export async function importerLutAction(donnees: { nom: string; fichier: InfosFichier; contenu: string | null; tailleCube: number; fichierId?: string }): Promise<Resultat<{ id: string; apres: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    let taille = Math.round(Number(donnees.tailleCube) || 0);
    if (donnees.contenu !== null) {
      const v = await validerLutCube(donnees.contenu);
      if (!v.ok) throw new ErreurStudio("LUT_INVALIDE", v.erreur);
      taille = v.taille;
    }
    // Taille hors des tailles lues par le studio : refus AVANT tout dépôt (puis de nouveau sur les octets stockés).
    const tailleValable = (n: number) => (TAILLES_ACCEPTEES as readonly number[]).includes(n);
    if (!tailleValable(taille)) throw new ErreurStudio("LUT_INVALIDE", "Ce fichier de couleur n'est pas valable.");
    const cube = await fichierDuCube(donnees);
    const fichierId = cube.id;
    // La taille lue dans les octets réellement stockés fait foi (jamais celle annoncée par le navigateur).
    if (cube.tailleCube) taille = cube.tailleCube;
    if (!tailleValable(taille)) throw new ErreurStudio("LUT_INVALIDE", "Ce fichier de couleur n'est pas valable.");
    const avant = await fichierAvantDeReference();
    const id = await creerElement({
      type: "lut",
      nom: donnees.nom.trim().slice(0, 80) || "Nouvelle couleur",
      motsCles: ["couleurs", "étalonnage"],
      valeur: { type: "lut", formatFichier: "cube", tailleCube: taille, intensiteParDefaut: 70, avantFichierId: avant },
      fichierId,
      vignetteFichierId: avant,
      licence: { type: "propriete", usageCommercial: true, reseaux: [] },
    });
    // Image « après » (gratuite, sur notre serveur) ; une panne n'empêche jamais l'import : l'aperçu approché reste.
    const apres = await calculerImageApresLut(id).catch((e: unknown) => {
      console.error("[studio] image après d'une LUT en échec", e instanceof Error ? e.message : "erreur");
      return null;
    });
    rafraichir("lut");
    return { id, apres: !!apres };
  });
}

/** Le fichier .cube de la LUT : celui envoyé par le navigateur (une LUT, jamais un autre fichier), sinon déposé ici. */
async function fichierDuCube(donnees: { fichier: InfosFichier; contenu: string | null; fichierId?: string }): Promise<{ id: string; tailleCube?: number }> {
  if (donnees.fichierId) return cubeEnvoye(String(donnees.fichierId), donnees.contenu);
  if (donnees.contenu !== null) return { id: await enregistrerCube({ nom: String(donnees.fichier.nom).slice(0, 200) || "lut.cube", taille: Number(donnees.fichier.taille) || 0 }, donnees.contenu) };
  // Relecture sécurité R45 n° 8 : ni fichier envoyé ni contenu → seulement en simulation (jamais une LUT gardée sans
  // que le serveur ait vu ses octets).
  await exigerOctetsDuCube();
  const f = await deposerFichierSimule({ nom: String(donnees.fichier.nom).slice(0, 200), mime: String(donnees.fichier.mime || "application/octet-stream"), taille: Math.max(0, Number(donnees.fichier.taille) || 0), typeEntite: "element", entiteId: "lut" });
  return { id: f.id };
}

export async function ajouterPrononciationAction(mot: string, prononciation: string): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!mot.trim() || !prononciation.trim()) throw new ErreurStudio("VIDE", "Indiquez le mot et sa prononciation.");
    const id = await ajouterPrononciation(mot.slice(0, 60), prononciation.slice(0, 120));
    rafraichir("prononciations");
    return { id };
  });
}

export async function rangerPrononciationAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rangerPrononciation(id);
    rafraichir("prononciations");
    return undefined;
  });
}

export async function remettrePrononciationAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await remettrePrononciation(id);
    rafraichir("prononciations");
    return undefined;
  });
}

export async function ajouterRushsAction(fichiers: { fichier: FichierEnvoye; dureeSec: number }[], motsCles: string[]): Promise<Resultat<{ ids: string[] }>> {
  await exigerSession();
  return essayer(async () => {
    if (!fichiers.length) throw new ErreurStudio("FICHIERS", "Choisissez au moins une vidéo.");
    const ids: string[] = [];
    for (const x of fichiers.slice(0, 30)) {
      const f = await envoye(x.fichier);
      const fichierId = f.id;
      const nom = String(f.nom ?? "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
      ids.push(await ajouterRush({ nom: nom.charAt(0).toUpperCase() + nom.slice(1, 80), fichierId, dureeSec: Number(x.dureeSec) || 10, motsCles: motsClesPropres(motsCles) }));
    }
    rafraichir("rushs");
    return { ids };
  });
}

/* ------------------------------------------------------------------ */
/* « Mes images » (lot A2) : import en vrac, validation en série, archivage — rien n'est jamais supprimé.   */
/* ------------------------------------------------------------------ */

function rafraichirMesImages() {
  revalidatePath("/bibliotheque");
  revalidatePath("/bibliotheque/mes-images");
}

/** Empreintes déjà importées (le navigateur ne renvoie pas ces fichiers). */
export async function doublonsMesImagesAction(empreintes: string[]): Promise<Resultat<string[]>> {
  await exigerSession();
  return essayer(() => doublonsConnus((Array.isArray(empreintes) ? empreintes : []).filter((x) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x)).slice(0, 500)));
}

/** Classe les fichiers déjà envoyés (catégorie, mots-clés, zones sensibles) ; tout arrive « à vérifier ». */
export async function importerMesImagesAction(fichiers: FichierImporte[]): Promise<Resultat<{ importees: string[]; doublons: string[] }>> {
  await exigerSession();
  return essayer(async () => {
    const propres = (Array.isArray(fichiers) ? fichiers : []).slice(0, 200).map((f) => ({
      fichierId: String(f.fichierId),
      nom: String(f.nom).slice(0, 200),
      mime: String(f.mime || "image/jpeg").slice(0, 80),
      empreinte: typeof f.empreinte === "string" && /^[a-f0-9]{64}$/.test(f.empreinte) ? f.empreinte : undefined,
      largeur: Number.isFinite(Number(f.largeur)) ? Math.round(Number(f.largeur)) : undefined,
      hauteur: Number.isFinite(Number(f.hauteur)) ? Math.round(Number(f.hauteur)) : undefined,
      depuis: f.depuis === "dossier" ? ("dossier" as const) : ("fichier" as const),
    }));
    if (!propres.length) throw new ErreurStudio("FICHIERS", "Choisissez au moins une image.");
    const r = await importerMesImages(propres);
    rafraichirMesImages();
    return r;
  });
}

export async function validerMesImageAction(id: string, v: ValidationMesImage): Promise<Resultat<VueMesImage>> {
  await exigerSession();
  return essayer(async () => {
    const r = await validerMesImage(String(id), {
      categorie: v?.categorie,
      motsCles: Array.isArray(v?.motsCles) ? v.motsCles.map(String) : undefined,
      zonesAFlouter: Array.isArray(v?.zonesAFlouter) ? v.zonesAFlouter.filter((n) => Number.isInteger(n)) : undefined,
      accordTiers: typeof v?.accordTiers === "boolean" ? v.accordTiers : undefined,
      accordClient: typeof v?.accordClient === "boolean" ? v.accordClient : undefined,
    });
    rafraichirMesImages();
    return r;
  });
}

export async function corrigerMesImageAction(id: string, patch: { categorie?: CategorieMesImages; motsCles?: string[]; nom?: string }): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await corrigerMesImage(String(id), { categorie: patch?.categorie, motsCles: Array.isArray(patch?.motsCles) ? patch.motsCles.map(String) : undefined, nom: typeof patch?.nom === "string" ? patch.nom : undefined });
    rafraichirMesImages();
    return undefined;
  });
}

/** Archiver (jamais supprimer) ou restaurer. */
export async function archiverMesImageAction(id: string, archiver: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await archiverMesImage(String(id), !!archiver);
    rafraichirMesImages();
    return undefined;
  });
}

/** Google Drive : adresse vérifiée, import préparé (lecture seule), pas encore relié. */
export async function preparerImportDriveAction(adresse: string): Promise<Resultat<{ dossierId: string; relie: false; message: string }>> {
  await exigerSession();
  return essayer(() => preparerImportDrive(String(adresse ?? "")));
}
