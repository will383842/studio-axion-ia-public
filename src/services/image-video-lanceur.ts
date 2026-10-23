/**
 * VITRINE D'UNE FABRICATION « IMAGE → VIDÉO » MENÉE PAR LE LANCEUR (`scripts/image-video/fabriquer.ts`, mode réel).
 *
 * Le lanceur avance seul la fabrication (son état est dans son dossier) ; pour que Will valide la carte puis le script
 * PAR L'INTERFACE DU STUDIO (`/image-video/<vidéo>`), il publie après chaque passage une version et un travail
 * « vitrine » de la vidéo : l'écran y lit la proposition, et « Valider » garde la décision dans le réglage
 * `imageVideo.decisions.<vidéo>`, que les outils réels relisent (`outilsImageVideo`). Le travail porte la marque
 * `CLE_LANCEUR_IV` : la boucle de fond ne le fait jamais avancer (seul un lanceur l'avance).
 *
 * Deux LANCEURS sur la même vidéo (relance pendant `--attendre`, deux dossiers pour la même image, deux machines)
 * paieraient deux fois la voix et Claude : `verrouillerLanceurIV` prend un BAIL exclusif par vidéo dans la base du
 * studio, avant toute dépense, prolongé tant que le lanceur vit et qui expire seul s'il meurt.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { CommandeFabrication, Id, Travail, VersionVideo } from "@/domaine/types";
import { commandeMinimale } from "@/briques/chaine-scenes/commande";
import { DECOR_NUIT, STYLE_SOUS_TITRES_DUO } from "@/moteurs/montage-cas-concret/fabriquer";
import { attendWillIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { CLE_LANCEUR_IV, travailVitrineIV } from "@/moteurs/montage-image-video";
import { prendreBail, rendreBail } from "@/donnees/memoire";
import { depots, horodatage, videoSupprimee } from "./_commun";

const MOTEUR_IV = "montage-image-video";
const FORMAT_IV = "image-video";

/** Identifiants de la vitrine d'une vidéo menée par le lanceur. PUR. */
export function idsVitrineIV(videoId: Id): { versionId: Id; travailId: Id } {
  return { versionId: `ver-${videoId}-lanceur`, travailId: `iv-lanceur-${videoId}` };
}

/** Chemin de la page de la vidéo dans le studio (`/image-video/<vidéo>`, à ouvrir sur l'adresse du studio). PUR. */
export function adresseVideoIV(videoId: Id): string {
  return `/image-video/${encodeURIComponent(videoId)}`;
}

/** Commande figée de la version vitrine : moteur et entrées du format (prix relu par « Réessayer »). PUR. */
export function commandeVitrineIV(videoId: Id, entrees: Record<string, unknown>): CommandeFabrication {
  const c = commandeMinimale({
    moteurId: MOTEUR_IV,
    formatId: FORMAT_IV,
    versionFormat: 1,
    videoId,
    texteScript: "",
    dureeSec: 50,
    scenes: [],
    styleSousTitres: { id: "sous-titres-duo", nom: "Charte duo", valeur: STYLE_SOUS_TITRES_DUO },
    decor: { id: "teinte-nuit", nom: "Nuit de la charte", valeur: DECOR_NUIT },
  });
  return { ...c, entrees };
}

/**
 * Publie (ou met à jour) la vitrine de la fabrication : la version (une fois), puis le travail d'après l'état. Le
 * travail gardé est la base (tentatives, décisions de l'écran) ; l'état du lanceur fait foi.
 */
export async function publierVitrineIV(o: { videoId: Id; titre: string; etat: EtatFabricationIV; entrees: Record<string, unknown> }): Promise<{ travailId: Id; versionId: Id; attendWill: "carte" | "script" | null }> {
  const d = depots();
  const { versionId, travailId } = idsVitrineIV(o.videoId);
  // Vidéo supprimée définitivement : la vitrine n'est plus écrite (ni version ni travail recréés pour un id disparu).
  if (await videoSupprimee(o.videoId)) return { travailId, versionId, attendWill: null };
  const commande = commandeVitrineIV(o.videoId, o.entrees);
  if (!(await d.versions.obtenir(versionId))) {
    const version: VersionVideo = { id: versionId, videoId: o.videoId, numero: 1, commande, statut: "en_fabrication", travailId, choisie: false, ...horodatage() } as VersionVideo;
    await d.versions.enregistrer(version);
  }
  const avant = ((await d.travaux.obtenir(travailId)) ?? null) as Travail | null;
  const travail = travailVitrineIV({ travailId, versionId, titre: o.titre }, commande, o.etat, avant);
  await d.travaux.enregistrer({ ...travail, parametres: { ...travail.parametres, [CLE_LANCEUR_IV]: true } });
  return { travailId, versionId, attendWill: attendWillIV(o.etat) };
}

/** Durée du bail d'un lanceur : un lanceur mort libère la vidéo au plus tard après ce délai. */
export const DUREE_BAIL_LANCEUR_IV_MS = 120_000;
/** Le lanceur vivant prolonge son bail à ce rythme (bien avant son expiration). */
export const PROLONGATION_BAIL_LANCEUR_IV_MS = 30_000;

/** Clé du bail d'une vidéo (un seul lanceur à la fois, toutes machines confondues). PUR. */
export function cleVerrouLanceurIV(videoId: Id): string {
  return `lanceur-image-video:${videoId}`;
}

export interface VerrouLanceurIV {
  /** Bail perdu (non prolongé à temps, ou repris par un autre lanceur après expiration) : s'arrêter avant toute dépense. */
  perdu: () => boolean;
  /** Rend le bail (fin du lanceur). */
  rendre: () => Promise<void>;
}

/**
 * Prend le bail exclusif de la vidéo ; `null` : un autre lanceur le tient (rien ne doit partir). Le bail est prolongé
 * en arrière-plan ; une prolongation refusée, ou impossible plus longtemps que sa durée, le marque perdu.
 */
export async function verrouillerLanceurIV(
  videoId: Id,
  o: { titulaire?: string; dureeMs?: number; prolongerMs?: number; prendre?: typeof prendreBail; rendre?: typeof rendreBail; maintenant?: () => number } = {},
): Promise<VerrouLanceurIV | null> {
  const cle = cleVerrouLanceurIV(videoId);
  const titulaire = o.titulaire ?? `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const duree = o.dureeMs ?? DUREE_BAIL_LANCEUR_IV_MS;
  const prendre = o.prendre ?? prendreBail;
  const rendre = o.rendre ?? rendreBail;
  const maintenant = o.maintenant ?? Date.now;
  // L'heure est prise AVANT chaque demande : le bail compté ici ne dépasse jamais celui posé dans la base.
  const debut = maintenant();
  if (!(await prendre(cle, titulaire, duree))) return null;
  let tenuJusqua = debut + duree;
  let perdu = false;
  const prolonger = async () => {
    if (perdu) return;
    const avant = maintenant();
    try {
      if (await prendre(cle, titulaire, duree)) tenuJusqua = avant + duree;
      else perdu = true;
    } catch {
      // Base injoignable : le bail tient jusqu'à son expiration, pas au-delà.
    }
    if (maintenant() >= tenuJusqua) perdu = true;
  };
  const minuterie = setInterval(() => void prolonger(), o.prolongerMs ?? PROLONGATION_BAIL_LANCEUR_IV_MS);
  minuterie.unref?.();
  return {
    perdu: () => perdu || maintenant() >= tenuJusqua,
    rendre: async () => {
      clearInterval(minuterie);
      if (!perdu) await rendre(cle, titulaire).catch(() => undefined);
      perdu = true;
    },
  };
}
