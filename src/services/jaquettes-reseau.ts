/**
 * JAQUETTES PAR RÉSEAU (UO-11) — hors verrou, par le fournisseur de miniature existant.
 * Règles : une jaquette par réseau coché, au ratio de sortie EXISTANT de la vidéo (aucun recadrage) ; la vignette de
 * marque est celle du gabarit déjà en place (« image-video-v3 »), aucune couleur ni police passée ; jamais une image de
 * démonstration sur une vraie vidéo ; jamais le titre interne ; les anciennes miniatures restent, rien n'est effacé.
 * Les jaquettes ne changent pas la miniature choisie de la vidéo (`choisie` reste faux).
 */
import "server-only";
import type { Fichier, Id, IdReseau, Miniature, Ratio, Sortie, Video } from "@/domaine/types";
import { dimensionsMiniature, estCleDemo, titreSansCodeInterne } from "@/domaine/miniatures";
import { jaquettesAttendues, jaquettesPretesDomaine, type VerdictJaquettes } from "@/domaine/jaquettes-reseau";
import { GABARIT_IMAGE_VIDEO, GABARIT_IMAGE_VIDEO_RATIO, INSTANT_PREMIERE_IMAGE_SEC, rangDeVideo } from "@/domaine/vignettes";
import { segmentStockage, VALIDITE_ADRESSES_RENDU_SEC } from "@/fournisseurs/rendu/commun";
import { fournisseurMiniatureSimulation } from "@/fournisseurs/simulation/autres";
import type { PropositionMiniature, SourceMiniature } from "@/fournisseurs/types";
import { nouvelId } from "@/lib/ids";
import { depots, fournisseur, horodatage } from "./_commun";

async function sortiesDe(video: Video): Promise<Sortie[]> {
  if (!video.versionChoisieId) return [];
  return depots().sorties.lister((s) => s.versionId === video.versionChoisieId && !!s.fichierId);
}

const ratiosDe = (sorties: Sortie[]): Ratio[] => [...new Set(sorties.map((s) => s.ratio))];

async function enregistrerImage(cle: string, nom: string, ratio: Ratio): Promise<Id> {
  const d = depots();
  const existant = await d.fichiers.trouver((f) => f.cleStockage === cle);
  if (existant) return existant.id;
  const { largeur, hauteur } = dimensionsMiniature(ratio);
  const f: Fichier = { id: nouvelId("f"), cleStockage: cle, nom, mime: "image/jpeg", taille: 0, largeur, hauteur, origine: "fabrication", statut: "pret", ...horodatage() };
  return (await d.fichiers.enregistrer(f)).id;
}

/** Jaquettes déjà faites pour cette vidéo (une miniature portant un `reseau`). */
async function jaquettesDe(videoId: Id): Promise<Miniature[]> {
  return depots().miniatures.lister((m) => m.videoId === videoId && !!m.reseau);
}

/** La jaquette de chaque réseau coché est-elle là ? Faux avec une phrase en français qui nomme le réseau qui manque. */
export async function jaquettesPretes(video: Video, reseaux: readonly IdReseau[]): Promise<VerdictJaquettes> {
  return jaquettesPretesDomaine(reseaux, ratiosDe(await sortiesDe(video)), await jaquettesDe(video.id));
}

/** Source d'une jaquette : la sortie existante au ratio choisi, adresses signées par le stockage. null : rien de réel à lire. */
async function sourceDe(video: Video, sortie: Sortie, reseau: IdReseau): Promise<SourceMiniature | null> {
  const stockage = await fournisseur("stockage");
  if (stockage.mode === "simulation" || !stockage.urlLectureDuree || !stockage.urlDepotDuree) return null;
  const fichier = sortie.fichierId ? await depots().fichiers.obtenir(sortie.fichierId) : null;
  if (!fichier || estCleDemo(fichier.cleStockage)) return null;
  const cle = `studio/${segmentStockage()}/videos/${video.id}/miniatures/jaquette-${reseau}-${Date.now().toString(36)}.jpg`;
  return {
    url: await stockage.urlLectureDuree(fichier.cleStockage, VALIDITE_ADRESSES_RENDU_SEC),
    dureeSec: sortie.dureeSec || fichier.dureeSec || video.dureeCibleSec,
    ratio: sortie.ratio,
    instantsSec: [INSTANT_PREMIERE_IMAGE_SEC],
    gabarit: GABARIT_IMAGE_VIDEO,
    formatId: video.formatId,
    rangVideo: rangDeVideo(video),
    depots: [{ cle, urlDepot: await stockage.urlDepotDuree(cle, VALIDITE_ADRESSES_RENDU_SEC, "image/jpeg") }],
  };
}

/**
 * Fabrique les jaquettes qui manquent (une par réseau coché, pas deux). Renvoie les miniatures ajoutées ; un réseau
 * dont la jaquette ne peut pas être faite (panne, fournisseur d'essai sur une vraie vidéo, ratio non accepté) reste
 * manquant : `jaquettesPretes` le dit. Rien n'est inventé, rien n'est effacé.
 */
export async function fabriquerJaquettes(videoId: Id, reseaux: readonly IdReseau[]): Promise<Miniature[]> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) return [];
  const sorties = await sortiesDe(video);
  const existantes = await jaquettesDe(videoId);
  const outil = await fournisseur("miniature");
  const titre = titreSansCodeInterne(video.titre);
  const faites: Miniature[] = [];
  for (const a of jaquettesAttendues(reseaux, ratiosDe(sorties))) {
    if (!a.ratio || existantes.some((m) => m.reseau === a.reseau && m.ratio === a.ratio)) continue;
    const ratio = a.ratio;
    let propositions: PropositionMiniature[] = [];
    try {
      if (video.estDemo) {
        propositions = await fournisseurMiniatureSimulation.proposer({ videoId, titre, nombre: 1 });
      } else if (outil.mode === "reel") {
        const sortie = sorties.find((s) => s.ratio === ratio);
        const source = sortie ? await sourceDe(video, sortie, a.reseau) : null;
        if (!source) continue;
        const texte = video.couvertureVignette?.texte.trim() ?? "";
        propositions = await outil.proposer({ videoId, titre, nombre: 1, source, couverture: { texte, motCle: texte ? video.couvertureVignette?.motCle.trim() ?? "" : "", titreCentre: true } });
      }
    } catch (e) {
      console.error("[studio] jaquette en échec", e instanceof Error ? e.name : "erreur");
      continue;
    }
    // Jamais une image de démonstration sur une vraie vidéo, quel que soit le fournisseur.
    if (!video.estDemo) propositions = propositions.filter((p) => !estCleDemo(p.fichierCle));
    const p = propositions[0];
    if (!p) continue;
    const fichierId = await enregistrerImage(p.fichierCle, `jaquette-${a.reseau}.jpg`, ratio);
    const m: Miniature = {
      id: nouvelId("mini"),
      videoId,
      fichierId,
      titre: p.titre,
      choisie: false,
      ratio,
      reseau: a.reseau,
      origine: video.estDemo ? "demo" : "rendu",
      ...(p.incrustee ? { incrustee: true } : {}),
      ...(p.instantSec !== undefined ? { instantSec: p.instantSec } : {}),
      ...(video.estDemo ? {} : { gabarit: GABARIT_IMAGE_VIDEO_RATIO }),
      ...horodatage(),
    };
    faites.push(await d.miniatures.enregistrer(m));
  }
  return faites;
}
