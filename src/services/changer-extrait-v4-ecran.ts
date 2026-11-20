/**
 * R4-03-d2a : les données du panneau « Changer un extrait » d'une vidéo face caméra animée (v4) : la liste lisible des
 * téléphones de la version choisie et la liste des vidéos de l'archive où prendre un extrait. Lecture seule, montée nulle
 * part : aucun réglage lu ici (`actif` est reçu en paramètre, sans défaut), aucune écriture, aucun réseau, 0 €.
 * Ne lève jamais : tout doute rend `null`.
 */
import "server-only";
import type { Id, VersionVideo, Video } from "@/domaine/types";
import { libelleTelephoneV4, telephonesRetouchablesV4, type ProjetPourTelephonesV4 } from "@/moteurs/montage-facecam-animee/telephones-retouche-v4";
import { depots } from "./_commun";
import { sourcesPourRetoucheExtraitV4 } from "./sources-retouche-extrait-v4";

/** Moteur de la face caméra animée (valeur de `commande.moteurId`, recopiée : le test la compare au moteur). */
const MOTEUR_FACECAM_ANIMEE = "montage-facecam-animee";

/** Format de la face caméra animée (repli quand le moteur n'est pas figé dans la commande). */
const FORMAT_FACECAM_ANIMEE = "facecam-animee";

/** Mêmes formes que `TelephonePanneauV4` et `SourcePanneauV4` (le panneau) : recopiées, ce service n'importe pas le panneau. */
export interface DonneesChangerExtraitV4 {
  telephones: { rang: number; libelle: string; debut: number; fin: number }[];
  sources: { videoId: string; titre: string }[];
}

export interface DepsChangerExtraitV4 {
  /** Obligatoire, sans défaut : faux ou qui lève, rien d'autre n'est lu. */
  actif: () => Promise<boolean>;
  lireVideo?: (id: Id) => Promise<Video | undefined | null>;
  lireVersion?: (id: Id) => Promise<VersionVideo | undefined | null>;
  sources?: typeof sourcesPourRetoucheExtraitV4;
}

export async function donneesChangerExtraitV4(videoId: Id, deps: DepsChangerExtraitV4): Promise<DonneesChangerExtraitV4 | null> {
  try {
    if ((await deps.actif()) !== true) return null;
    const lireVideo = deps.lireVideo ?? ((id: Id) => depots().videos.obtenir(id));
    const lireVersion = deps.lireVersion ?? ((id: Id) => depots().versions.obtenir(id));
    const video = await lireVideo(videoId);
    if (!video?.versionChoisieId) return null;
    const version = await lireVersion(video.versionChoisieId);
    const moteur = version?.commande?.moteurId ?? (version?.commande?.formatId === FORMAT_FACECAM_ANIMEE ? MOTEUR_FACECAM_ANIMEE : undefined);
    if (!version || moteur !== MOTEUR_FACECAM_ANIMEE) return null;
    const projet = version.projetMontage as unknown as ProjetPourTelephonesV4 | undefined;
    if (!projet || typeof projet !== "object" || !projet.plan) return null;
    const telephones = telephonesRetouchablesV4(projet).map((t) => ({ rang: t.rang, libelle: libelleTelephoneV4(t), debut: t.debut, fin: t.fin }));
    const brutes = await (deps.sources ?? sourcesPourRetoucheExtraitV4)(videoId);
    return { telephones, sources: brutes.map((s) => ({ videoId: s.videoId, titre: s.titre })) };
  } catch {
    return null;
  }
}
