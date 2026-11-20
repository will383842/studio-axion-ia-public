/**
 * CHAT DE LA DÉMO FACE CAMÉRA (D4-F3-a) : les VRAIES dépendances du « lancer gratuit » (forme de `DepsRetoucheDemo`,
 * recopiée sans importer `lancer-demo.ts`). Même version, même parent, même estimation que `lancerRetouche`
 * (`fabrication.ts`, retoucheSousVerrou) : le coût contrôlé est celui que la retouche réservera. Refus FERMÉ.
 * LIT et estime seulement : aucun réglage lu, aucune écriture, aucune porte d'argent. Aucun importeur pour l'instant.
 */
import "server-only";
import type { Montant } from "@/domaine/types";
import { idMoteurDeCommande, moteurDeCommande, type OperationMontage } from "@/moteurs";
import { ID_MOTEUR_DEMO_FACECAM } from "@/moteurs/montage-demo-facecam";
import { lireRepriseDemo, type RepriseDemo } from "@/moteurs/montage-demo-facecam/chaine";
import { depots } from "../_commun";
import { preparerReglagesMoteur } from "../cas-concret-reglages";
import type { lancerRetouche } from "../fabrication";

export type DepsRetoucheDemoStudio = {
  lancer: typeof lancerRetouche;
  estimer: (operations: OperationMontage[]) => Promise<{ total: Montant }>;
  reprise: () => Promise<RepriseDemo | null>;
};

/** Version choisie relue à chaque appel ; `null` si elle a changé depuis l'aperçu ou si ce n'est pas une démo face caméra. */
async function versionDeLaDemo(videoId: string, versionAttendue: string) {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!courante || courante.id !== versionAttendue) return null;
  return idMoteurDeCommande(courante.commande) === ID_MOTEUR_DEMO_FACECAM ? courante : null;
}

export function depsLancerDemoStudio(videoId: string, versionAttendue: string): DepsRetoucheDemoStudio {
  return {
    lancer: (...a) => import("../fabrication").then((f) => f.lancerRetouche(...a)),
    async reprise() {
      const courante = await versionDeLaDemo(videoId, versionAttendue);
      if (!courante) return null;
      const { parentDeLaVersion } = await import("../fabrication");
      return lireRepriseDemo((await parentDeLaVersion(courante)).projetMontage);
    },
    async estimer(operations) {
      const courante = await versionDeLaDemo(videoId, versionAttendue);
      if (!courante) throw new Error("La version n'est plus celle de l'aperçu, ou ce n'est pas une démo face caméra.");
      const { parentDeLaVersion } = await import("../fabrication");
      await preparerReglagesMoteur(courante.commande);
      const { total } = await moteurDeCommande(courante.commande).estimerRetouche(courante.commande, [], operations.length ? { operations, parent: await parentDeLaVersion(courante) } : undefined);
      return { total };
    },
  };
}
