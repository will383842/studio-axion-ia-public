/**
 * IMPORT D'UNE VIDÉO DÉJÀ FAITE : le fichier est déjà dans le stockage (envoyé par le navigateur, `/api/depots`) ; ici on le
 * contrôle puis on crée une vidéo « prête » à l'étape « validée », marquée `origineVideo: "importee"`.
 * Rien de payant (aucun fournisseur n'est appelé), rien d'envoyé vers un réseau, ni sous-titres ni mention IA ajoutés.
 * `creerVideoImportee` est le cœur testable (pas de session) ; `importerVideoExterne` y ajoute la session et le contrôle du fichier.
 */
import "server-only";
import { controlerImportVideo, type DemandeImportVideo } from "@/domaine/import-video-externe";
import type { Fichier, Id, Ratio, Sortie, Video, VersionVideo, CommandeFabrication } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, horodatage, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { fichierEnvoye } from "./fichiers";

/** Format « neutre » : la vidéo n'a pas été fabriquée ici. */
export const FORMAT_VIDEO_IMPORTEE = "video-importee";

export interface DonneesImportVideo {
  fichierId: string;
  /** Identifiant sous lequel le navigateur a envoyé le fichier (destination « video »). */
  entiteId: string;
  titre: string;
  reseaux: string[];
  valide: boolean;
  dureeSec: number;
  largeur?: number;
  hauteur?: number;
}

/** Ratio le plus proche de la taille lue ; à défaut, le vertical. */
export function ratioDeLaTaille(largeur?: number, hauteur?: number): Ratio {
  if (!largeur || !hauteur || largeur <= 0 || hauteur <= 0) return "9:16";
  const r = largeur / hauteur;
  const choix: [Ratio, number][] = [["9:16", 9 / 16], ["4:5", 4 / 5], ["1:1", 1], ["16:9", 16 / 9]];
  return choix.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

export async function creerVideoImportee(donnees: DonneesImportVideo, fichier: Fichier): Promise<{ videoId: Id }> {
  const demande: DemandeImportVideo = { nom: fichier.nom, mime: fichier.mime, taille: fichier.taille, dureeSec: donnees.dureeSec, titre: donnees.titre, reseaux: donnees.reseaux, valide: donnees.valide };
  const controle = controlerImportVideo(demande);
  if (!controle.ok) throw new ErreurStudio(controle.code, controle.message);
  const d = depots();
  const videoId = nouvelId("v");
  const versionId = nouvelId("ver");
  const sortieId = nouvelId("s");
  const ratio = ratioDeLaTaille(donnees.largeur, donnees.hauteur);
  const dureeSec = Math.round(donnees.dureeSec);
  const h = horodatage();
  const video: Video = {
    id: videoId,
    titre: controle.titre,
    sujet: controle.titre,
    formatId: FORMAT_VIDEO_IMPORTEE,
    versionFormat: 1,
    profilRenduVersion: 1,
    marqueId: "marque-axion",
    statut: "prete",
    etapeEditoriale: "validee",
    dureeCibleSec: dureeSec,
    ratios: [ratio],
    distribution: [],
    entrees: {},
    reglages: {},
    styles: {},
    // Aucune mention IA ajoutée : la vidéo est telle que livrée.
    mentionIA: { incrustee: false, position: "bas-droite", dureeSec: 0, texte: "", dansLegende: false },
    versionChoisieId: versionId,
    reseau: controle.reseaux[0],
    langue: "fr-FR",
    origineVideo: "importee",
    terminee: h.creeLe,
    ...h,
  };
  const commande = { versionContrat: 2, moteurId: "import-externe", videoId, formatId: FORMAT_VIDEO_IMPORTEE, versionFormat: 1, profilRenduVersion: 1, dureeCibleSec: dureeSec, ratios: [ratio], origine: "studio", entrees: {}, reglages: {}, plans: [], prononciations: [], distribution: [], styles: {}, briques: {}, script: { blocs: [], texteComplet: "" } } as unknown as CommandeFabrication;
  const version: VersionVideo = { id: versionId, videoId, numero: 1, commande, statut: "prete", choisie: true, ...h };
  const sortie: Sortie = {
    id: sortieId,
    videoId,
    versionId,
    ratio,
    reseaux: controle.reseaux,
    resolution: donnees.largeur && donnees.hauteur ? `${donnees.largeur}x${donnees.hauteur}` : "",
    fichierId: fichier.id,
    vignetteFichierId: "",
    dureeSec,
    taille: fichier.taille,
    rapportQualite: { note: 0, verifie: { image: false, son: false, sousTitres: false, mentionIA: false, droits: false }, alertes: [], niveauSonoreLufs: 0 },
    ...h,
  };
  await d.videos.enregistrer(video);
  await d.versions.enregistrer(version);
  await d.sorties.enregistrer(sortie);
  return { videoId };
}

/** Action métier : session, case cochée AVANT tout, fichier réellement arrivé, puis création. */
export async function importerVideoExterne(donnees: DonneesImportVideo): Promise<{ videoId: Id }> {
  await exigerSession();
  if (donnees.valide !== true) throw new ErreurStudio("NON_VALIDEE", "Cochez « Je valide cette vidéo » pour l'ajouter. Rien n'a été ajouté.");
  const fichier = await fichierEnvoye(donnees.fichierId, "video", donnees.entiteId);
  const r = await creerVideoImportee(donnees, fichier);
  await journaliser("videos", `Vidéo importée : ${donnees.titre.trim().slice(0, 80)}`, { type: "video", id: r.videoId });
  return r;
}
