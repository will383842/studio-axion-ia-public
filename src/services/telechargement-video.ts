/**
 * Téléchargement direct d'UNE vidéo (lot S). La route `/api/telechargements/video` ne reçoit que des identifiants : la clé
 * de stockage vient TOUJOURS de la base, jamais de la requête.
 *  - Image → vidéo : la livraison de la version courante (LinkedIn, Facebook + son fil…) ;
 *  - sinon la sortie du ratio demandé, puis la meilleure sortie du réseau, puis la principale.
 * Une vidéo à la corbeille ne se télécharge pas (null).
 */
import "server-only";
import type { Id, IdReseau, Ratio, Sortie, VersionVideo } from "@/domaine/types";
import { meilleureSortie } from "@/reseaux/sorties";
import { depots } from "./_commun";

export interface DemandeFichier {
  reseau?: IdReseau;
  ratio?: Ratio;
  /** Facebook (image → vidéo) : la vidéo du fil (4:5) au lieu du Reel. */
  fil?: boolean;
}

export interface FichierATelecharger {
  cle: string;
  nom: string;
}

/** Nom proposé au navigateur : [A-Za-z0-9-] seulement, 80 caractères au plus, extension .mp4. */
export function nomTelechargement(titre: string, reseau?: string, ratio?: string): string {
  const net = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const suffixe = [reseau, ratio].map((s) => net(s ?? "")).filter(Boolean).join("-");
  const fin = suffixe ? `-${suffixe}` : "";
  const place = Math.max(1, 80 - ".mp4".length - fin.length);
  const debut = net(titre).slice(0, place).replace(/-+$/, "") || "video";
  return `${debut}${fin}.mp4`;
}

interface LigneLivraison {
  reseau?: unknown;
  version?: unknown;
  fichierCle?: unknown;
  fichierCleFil?: unknown;
  format?: unknown;
}

/** Livraison image → vidéo de la version, lue avec prudence (jamais d'exception sur une donnée abîmée). */
function livraisonDe(version: VersionVideo | null): LigneLivraison[] | null {
  const iv = version?.projetMontage?.imageVideo;
  const l = iv && typeof iv === "object" ? (iv as { livraison?: unknown }).livraison : undefined;
  if (!Array.isArray(l) || !l.length) return null;
  return l.filter((x): x is LigneLivraison => !!x && typeof x === "object");
}

const cleValide = (c: unknown): c is string => typeof c === "string" && c.length > 0;

export async function fichierATelecharger(videoId: Id, demande: DemandeFichier = {}): Promise<FichierATelecharger | null> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || video.corbeilleLe) return null;
  const versions = (await d.versions.lister((v) => v.videoId === videoId && v.statut !== "maquette")).sort((a, b) => a.numero - b.numero);
  const version = versions.find((v) => v.id === video.versionChoisieId) ?? versions[versions.length - 1] ?? null;
  const nom = (ratio?: string) => nomTelechargement(video.titre, demande.reseau, ratio);
  const cle = (c: string, ratio?: string): FichierATelecharger => ({ cle: c, nom: nom(ratio) });

  // Image → vidéo : la livraison fait foi, un réseau non livré n'a pas de fichier (jamais le fichier d'un autre).
  const livraison = livraisonDe(version);
  if (livraison) {
    const livrees = livraison.filter((l) => l.version !== "aucune" && cleValide(l.fichierCle));
    const ligne = demande.reseau ? livrees.find((l) => l.reseau === demande.reseau) : (livrees.find((l) => l.format !== "4:5") ?? livrees[0]);
    if (!ligne) return null;
    if (demande.fil && demande.reseau === "facebook") return cleValide(ligne.fichierCleFil) ? cle(ligne.fichierCleFil, "fil") : null;
    return cle(ligne.fichierCle as string, ligne.format === "4:5" ? "4:5" : "9:16");
  }

  const sorties: Sortie[] = version ? await d.sorties.lister((s) => s.versionId === version.id) : [];
  const choisie =
    (demande.ratio ? sorties.find((s) => s.ratio === demande.ratio) : undefined) ?? (demande.reseau ? meilleureSortie(demande.reseau, sorties) : null) ?? sorties[0] ?? null;
  if (!choisie) return null;
  const fichier = await d.fichiers.obtenir(choisie.fichierId);
  if (!fichier || !fichier.cleStockage) return null;
  return cle(fichier.cleStockage, choisie.ratio);
}
