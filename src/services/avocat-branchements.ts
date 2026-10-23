/**
 * RACCORDS DE L'AVOCAT (mission H) : ce que les services branchent sur le moteur `montage-avocat` (pur). Chargé pour
 * son effet par la fabrication et la boucle de fond, comme `facecam-branchements.ts`. Aucun raccord ne bloque la
 * livraison : une panne laisse la vidéo à une seule caméra.
 *
 *  - multicaméra : `passeMulticameraAvocat` (réglage `avocat.multicamera`, `reel` faux par défaut : double de
 *    simulation, aucun look créé à la volée) ; en réel, l'analyseur des angles passe par `studio-rendu`
 *    (`analyse-media`) et `studio-aligneur` (`/visages`).
 *  - réglages figés au lancement (`entreesAvocatDuLancement`) : motion commune, monteur, multicaméra — tous coupés par
 *    défaut ; coupés, la commande de l'avocat est identique à avant.
 */
import "server-only";
import { lireConsignes } from "@/briques/monteur/consignes";
import { brancherServicesAvocat, ENTREE_MULTICAMERA_AVOCAT } from "@/moteurs/montage-avocat/branchements";
import { ENTREE_MONTEUR_AVOCAT, PARAM_MONTEUR_AVOCAT } from "@/moteurs/montage-avocat/monteur";
import { ENTREE_MOTION_AVOCAT, PARAM_MOTION_AVOCAT } from "@/moteurs/montage-avocat/motion";
import { resoudreFournisseur } from "@/fournisseurs";
import type { Video } from "@/domaine/types";
import { lireParametre } from "./_commun";
import { analyseurAnglesStudio } from "./analyseur-angles";
import { lireReglageMulticameraAvocat, passeMulticameraAvocat } from "./multicamera-avocat";

brancherServicesAvocat({
  multicamera: async (d) => {
    const reglage = await lireReglageMulticameraAvocat();
    const principal = d.commande.distribution[0]?.visagesResolus?.face ?? Object.values(d.commande.distribution[0]?.visagesResolus ?? {})[0];
    const visageId = principal?.idExterne ?? principal?.visageId ?? d.commande.distribution[0]?.personnageId ?? "inconnu";
    const reel = reglage.reel === true;
    return passeMulticameraAvocat({
      travailId: d.travailId,
      visageId,
      priseCle: d.priseCle,
      audioCle: d.audioCle,
      dureePriseSec: d.dureeSec,
      ratio: d.ratio,
      consignes: d.consignes,
      plans: d.plans,
      mots: d.mots,
      segments: d.segments,
      // La commande a déjà décidé (réglage ou consigne) : la passe ne relit que `reel` et les looks.
      reglage: { ...reglage, actif: true },
      ...(reel ? { visage: resoudreFournisseur("visage", principal?.fournisseur) } : {}),
      ...(reel ? { analyseur: analyseurAnglesStudio({ motsReference: async () => d.mots }) ?? undefined } : {}),
    });
  },
});

/** Réglage caché lu tel quel (vrai seulement si `true` ou `{ actif: true }`). */
async function allume(param: string): Promise<Record<string, unknown> | null> {
  const v = await lireParametre<unknown>(param, null);
  if (v === true) return {};
  if (v && typeof v === "object" && (v as { actif?: unknown }).actif === true) return v as Record<string, unknown>;
  return null;
}

/**
 * Réglages de l'avocat figés au lancement (le moteur ne lit pas les réglages). Tous coupés par défaut : rien n'est
 * ajouté à la commande. Les consignes du monteur viennent de la vidéo (`entrees.avocatConsignes` : fil, consignes
 * dites relevées dans une transcription libre).
 */
export async function entreesAvocatDuLancement(video: Pick<Video, "entrees">): Promise<Record<string, unknown>> {
  const sortie: Record<string, unknown> = {};
  const motion = await allume(PARAM_MOTION_AVOCAT);
  if (motion) sortie[ENTREE_MOTION_AVOCAT] = { actif: true, ...(Array.isArray(motion.habitude) ? { habitude: motion.habitude } : {}) };
  const monteur = await allume(PARAM_MONTEUR_AVOCAT);
  const consignes = monteur ? lireConsignes((video.entrees as { avocatConsignes?: unknown } | undefined)?.avocatConsignes) : [];
  if (consignes.length) sortie[ENTREE_MONTEUR_AVOCAT] = { consignes };
  const multicamera = await lireReglageMulticameraAvocat();
  if (multicamera.actif) sortie[ENTREE_MULTICAMERA_AVOCAT] = { actif: true };
  return sortie;
}
