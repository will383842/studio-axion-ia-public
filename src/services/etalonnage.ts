/**
 * ÉTALONNAGE RÉEL (lot R5, 03/10) — l'image « après » d'une LUT importée dans la Bibliothèque, calculée sur notre
 * serveur (`studio-rendu`, opération `etalonnage`) sur l'image de référence, à 100 % (l'écran mélange ensuite selon le
 * curseur d'intensité, exactement comme le rendu). Sans étalonnage réel relié : rien, l'aperçu approché reste.
 * Toujours HORS verrou (appels réseau). Rien n'est effacé : l'image avant et le fichier .cube ne sont jamais modifiés.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import type { Fichier, Id } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import { segmentStockage as environnement, VALIDITE_ADRESSES_RENDU_SEC as VALIDITE_ADRESSES_SEC } from "@/fournisseurs/rendu/commun";
import { nouvelId } from "@/lib/ids";
import { ErreurLisible } from "@/lib/erreur-lisible";
import { LecteurCube, type Lut3D } from "@/lib/lut3d";
import { validerLut } from "@/lib/qc-lut";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser } from "./_commun";

/** Fichiers publics du studio que le serveur de rendu peut avoir à lire (images de référence, LUT Axion, sons de la banque). */
const PUBLICS_LISIBLES = /^\/(demo|luts|bruitages)\/[A-Za-z0-9_./-]+$/;


/** Dépose des octets dans le stockage (PUT signé). Lève une erreur claire si le stockage refuse. */
export async function deposerOctets(stockage: StockageFichiers, cle: string, octets: Uint8Array, mime: string): Promise<void> {
  if (!stockage.urlDepotDuree) throw new ErreurStudio("PAS_DE_STOCKAGE", "Le stockage des fichiers n'est pas relié.");
  const url = await stockage.urlDepotDuree(cle, 600, mime);
  const r = await fetch(url, { method: "PUT", headers: { "content-type": mime }, body: octets as unknown as BodyInit, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) {
    console.warn(`[studio] stockage : dépôt refusé, réponse ${r.status}`);
    throw new ErreurStudio("STOCKAGE", "Le stockage a refusé le fichier : réessayez dans un instant.");
  }
}

/**
 * Clé que le serveur de rendu peut lire. Un fichier PUBLIC du studio (`/demo/…`, `/luts/…`, `/bruitages/…`, servi par le studio
 * lui-même) n'existe pas dans le stockage : il y est COPIÉ une fois (`studio/{env}/public/…`), puis cette copie est lue.
 */
export async function cleLisibleParLeRendu(cle: string, stockage: StockageFichiers): Promise<string> {
  if (!cle.startsWith("/")) return cle;
  if (!PUBLICS_LISIBLES.test(cle) || cle.includes("..")) throw new ErreurStudio("FICHIER", "Ce fichier ne peut pas être lu par le serveur du studio.");
  const copie = `studio/${environnement()}/public${cle}`;
  if ((await stockage.confirmerDepot(copie)).ok) return copie;
  const racine = join(process.cwd(), "public");
  const chemin = normalize(join(racine, cle));
  if (!chemin.startsWith(racine + sep)) throw new ErreurStudio("FICHIER", "Ce fichier ne peut pas être lu par le serveur du studio.");
  const mime = /\.jpe?g$/i.test(cle) ? "image/jpeg" : /\.png$/i.test(cle) ? "image/png" : /\.wav$/i.test(cle) ? "audio/wav" : "application/octet-stream";
  await deposerOctets(stockage, copie, await readFile(chemin), mime);
  return copie;
}

/**
 * Fichier .cube reçu en texte par le serveur (LUT de moins de 800 Ko) : enregistré dans le stockage avec ses VRAIS
 * octets (le serveur de rendu pourra le lire). En simulation : enregistré comme avant, sans octets.
 */
export async function enregistrerCube(infos: { nom: string; taille: number }, contenu: string): Promise<Id> {
  const stockage = await fournisseur("stockage");
  const id = nouvelId("f");
  const octets = new TextEncoder().encode(contenu);
  if (octets.byteLength > OCTETS_MAX_CUBE) throw new ErreurStudio("LUT_TROP_GROSSE", TROP_GROS);
  const { cleStockage } = await stockage.preparerDepot({ fichierId: id, nom: infos.nom, mime: "application/octet-stream", taille: octets.byteLength, typeEntite: "element", entiteId: "lut" });
  let pret = true;
  if (stockage.mode !== "simulation") {
    await deposerOctets(stockage, cleStockage, octets, "application/octet-stream");
    pret = (await stockage.confirmerDepot(cleStockage)).ok;
  }
  const f: Fichier = { id, cleStockage, nom: infos.nom, mime: "application/octet-stream", taille: octets.byteLength, origine: "depot", statut: pret ? "pret" : "en_attente", ...horodatage() };
  return (await depots().fichiers.enregistrer(f)).id;
}

/** Au-delà, ce n'est pas une LUT (une LUT 65³ pèse 7,4 Mo) : refus clair. */
export const OCTETS_MAX_CUBE = 50 * 1024 * 1024;
const TROP_GROS = "Ce fichier dépasse 50 Mo : ce n'est pas un fichier de couleur.";

/**
 * Lit ET valide un .cube du stockage, au fil du flux (relecture sécurité R45, défaut n° 2) : 50 Mo au plus (longueur
 * annoncée ET octets comptés), jamais le fichier entier en mémoire (seule la ligne en cours, `LecteurCube`). S'il y a
 * un contenu reçu, chaque morceau lu lui est comparé au passage (le fichier stocké doit être exactement celui vérifié).
 */
async function lireCubeStocke(url: string, contenu: string | null): Promise<Lut3D> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok || !r.body) throw new ErreurStudio("LUT_INVALIDE", "Le fichier de couleur envoyé est introuvable. Réessayez.");
  const lecteur = r.body.getReader();
  const abandonner = async (e: ErreurStudio): Promise<never> => {
    await lecteur.cancel().catch(() => undefined);
    throw e;
  };
  if (Number(r.headers.get("content-length") ?? 0) > OCTETS_MAX_CUBE) return abandonner(new ErreurStudio("LUT_TROP_GROSSE", TROP_GROS));
  const texte = new TextDecoder();
  const cube = new LecteurCube();
  const different = () => new ErreurStudio("LUT_INVALIDE", "Ce fichier n'est pas celui qui a été vérifié. Réessayez.");
  let total = 0;
  let position = 0;
  const lire = (morceau: string) => {
    if (contenu !== null) {
      if (contenu.slice(position, position + morceau.length) !== morceau) throw different();
      position += morceau.length;
    }
    try {
      cube.pousser(morceau);
    } catch (e) {
      throw new ErreurStudio("LUT_INVALIDE", e instanceof ErreurLisible ? e.message : "Ce fichier de couleur est illisible.");
    }
  };
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.byteLength;
      if (total > OCTETS_MAX_CUBE) throw new ErreurStudio("LUT_TROP_GROSSE", TROP_GROS);
      lire(texte.decode(value, { stream: true }));
    }
    lire(texte.decode());
  } catch (e) {
    return abandonner(e instanceof ErreurStudio ? e : new ErreurStudio("LUT_INVALIDE", "Le fichier de couleur envoyé est introuvable. Réessayez."));
  }
  if (contenu !== null && position !== contenu.length) throw different();
  try {
    return cube.terminer();
  } catch (e) {
    throw new ErreurStudio("LUT_INVALIDE", e instanceof ErreurLisible ? e.message : "Ce fichier de couleur est illisible.");
  }
}

/**
 * Un .cube déjà envoyé par le navigateur (gros fichier) : seulement une LUT déposée pour la Bibliothèque, arrivée
 * (« prête »), de 50 Mo au plus, et CELLE qui a été vérifiée : ses octets réellement stockés sont relus et validés
 * (et comparés au contenu reçu s'il y en a un). Sans stockage réel, la taille annoncée doit correspondre au contenu.
 */
export async function cubeEnvoye(fichierId: string, contenu: string | null): Promise<{ id: Id; tailleCube?: number }> {
  const f = await depots().fichiers.obtenir(fichierId);
  if (!f || !/^studio\/(dev|prod)\/element\/lut\/[A-Za-z0-9_-]+\.cube$/i.test(f.cleStockage)) throw new ErreurStudio("LUT_INVALIDE", "Ce fichier n'est pas celui qui a été envoyé. Réessayez.");
  if (f.statut !== "pret") throw new ErreurStudio("LUT_INVALIDE", "Le fichier de couleur n'est pas encore arrivé. Réessayez dans un instant.");
  if (f.taille > OCTETS_MAX_CUBE) throw new ErreurStudio("LUT_TROP_GROSSE", TROP_GROS);
  const stockage = await fournisseur("stockage");
  // Relecture sécurité R45 n° 9 : le raccourci « même longueur » n'existe QU'EN SIMULATION (aucun octet réel). Un
  // stockage réel qui ne sait pas relire le fichier : refus (jamais une LUT acceptée sans que ses octets soient vus).
  if (stockage.mode === "simulation") {
    if (contenu !== null && new TextEncoder().encode(contenu).byteLength !== f.taille) throw new ErreurStudio("LUT_INVALIDE", "Ce fichier n'est pas celui qui a été vérifié. Réessayez.");
    return { id: f.id };
  }
  if (!stockage.urlLectureDuree) throw new ErreurStudio("PAS_DE_STOCKAGE", "Le fichier de couleur ne peut pas être relu pour l'instant. Réessayez plus tard.");
  const v = validerLut(await lireCubeStocke(await stockage.urlLectureDuree(f.cleStockage, 600), contenu));
  if (!v.ok) throw new ErreurStudio("LUT_INVALIDE", v.erreur);
  return { id: f.id, tailleCube: v.taille };
}

/**
 * Import d'une LUT sans fichier envoyé ni contenu (relecture sécurité R45 n° 8) : permis SEULEMENT en simulation (rien
 * n'y a d'octets). Avec un stockage réel, refus clair : la LUT doit être relue par le serveur avant d'entrer.
 */
export async function exigerOctetsDuCube(): Promise<void> {
  if ((await fournisseur("stockage")).mode !== "simulation") throw new ErreurStudio("LUT_INVALIDE", "Ce fichier de couleur n'a pas pu être lu. Choisissez-le de nouveau.");
}

/**
 * Calcule l'image « après » d'une LUT (référence passée dans la LUT à 100 %) et la range sur l'élément. Renvoie le
 * nouveau fichier, ou null si l'étalonnage réel n'est pas relié (l'aperçu approché reste, sans erreur).
 */
export async function calculerImageApresLut(elementId: Id): Promise<Id | null> {
  const d = depots();
  const e = await d.elements.obtenir(elementId);
  if (!e || e.valeur.type !== "lut" || !e.fichierId || !e.valeur.avantFichierId) return null;
  const outil = await fournisseur("etalonnage");
  const stockage = await fournisseur("stockage");
  if (outil.mode !== "reel" || stockage.mode === "simulation" || !stockage.urlLectureDuree || !stockage.urlDepotDuree) return null;
  const cube = await d.fichiers.obtenir(e.fichierId);
  const avant = await d.fichiers.obtenir(e.valeur.avantFichierId);
  if (!cube || !avant) return null;
  const lutCle = await cleLisibleParLeRendu(cube.cleStockage, stockage);
  const avantCle = await cleLisibleParLeRendu(avant.cleStockage, stockage);
  const cle = `studio/${environnement()}/elements/${elementId}/apres-${Date.now().toString(36)}.jpg`;
  const r = await outil.appliquer({
    fichierCle: avantCle,
    lutId: elementId,
    intensite: 1,
    source: {
      nature: "image",
      url: await stockage.urlLectureDuree(avantCle, VALIDITE_ADRESSES_SEC),
      lutUrl: await stockage.urlLectureDuree(lutCle, VALIDITE_ADRESSES_SEC),
      depot: { cle, urlDepot: await stockage.urlDepotDuree(cle, VALIDITE_ADRESSES_SEC, "image/jpeg") },
    },
  });
  const f = await d.fichiers.enregistrer({ id: nouvelId("f"), cleStockage: r.fichierCle, nom: `${e.nom} (après).jpg`, mime: "image/jpeg", taille: 0, largeur: avant.largeur, hauteur: avant.hauteur, origine: "fabrication", statut: "pret", ...horodatage() });
  // Relue juste avant d'écrire : l'intensité a pu changer pendant le calcul, elle est gardée.
  const actuel = await d.elements.obtenir(elementId);
  if (!actuel || actuel.valeur.type !== "lut") return f.id;
  await d.elements.modifier(elementId, { valeur: { ...actuel.valeur, apresFichierId: f.id } });
  await journaliser("bibliotheque", `Image « après » calculée pour la couleur « ${e.nom} »`, { type: "element", id: elementId });
  return f.id;
}
