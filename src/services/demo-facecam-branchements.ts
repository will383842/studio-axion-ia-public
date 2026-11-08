/**
 * RACCORDS DE LA « DÉMO FACECAM » (lot J) : ce que les services branchent sur le moteur `montage-demo-facecam` (pur, il
 * n'importe jamais un service), sur le modèle de `tutoriel-branchements.ts`. Chargé pour son effet par la boucle de fond.
 *
 *  - TRANSCRIPTION : le `studio-aligneur` réel de la face caméra (`fournisseurFacecam`, route `transcrire`) ;
 *  - CALAGE : le service d'alignement existant (`resoudreFournisseur("alignement", "studio-aligneur")`) ;
 *  - STOCKAGE et RENDU : R2 (adresses signées) et `studio-rendu`, comme l'habillage face caméra.
 *  - CLAUDE : PAS ENCORE RELIÉ (à faire avant usage réel : un rôle facturé par `executerRolePourVideo`). En attendant,
 *    l'appel lève : le plan de scènes retombe sur le plan simple (réserve « À vérifier »). Jamais d'échec.
 *  - Rien n'est construit tant qu'un travail de la démo n'avance pas ; transcription, stockage ou rendu pas réels : `null`,
 *    le travail reste en pause claire (rien n'est dépensé).
 */
import "server-only";
import { brancherServicesDemoFacecam, type OutilsDemoFacecam } from "@/moteurs/montage-demo-facecam";

const DUREE_LECTURE_SEC = 24 * 3600;
const DUREE_DEPOT_SEC = 6 * 3600;

brancherServicesDemoFacecam({
  outils: async (c): Promise<OutilsDemoFacecam | null> => {
    const { resoudreFournisseur } = await import("@/fournisseurs");
    const { fournisseurFacecam } = await import("@/fournisseurs/facecam");
    const { obtenirServiceRendu, renduSimule } = await import("@/fournisseurs/rendu/client");
    const { ErreurClaude } = await import("@/fournisseurs/claude/client");
    const { GLOSSAIRE_FACECAM } = await import("@/moteurs/montage-facecam/glossaire");
    const transcription = fournisseurFacecam({ reel: true });
    const stockage = resoudreFournisseur("stockage");
    // Pas de transcription réelle, de stockage R2 ou de rendu réel : pause claire, rien n'est dépensé.
    if (transcription.mode !== "reel" || stockage.mode === "simulation" || !stockage.urlDepotDuree || renduSimule()) return null;
    const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
    const lire = async (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : stockage.urlLecture(cle));
    return {
      transcription,
      alignement: resoudreFournisseur("alignement", "studio-aligneur"),
      claude: async () => {
        throw new ErreurClaude("requete", "Claude n'est pas encore relié à la démo facecam.");
      },
      lire,
      glossaire: GLOSSAIRE_FACECAM,
      rendu: {
        service: () => obtenirServiceRendu(),
        signer: async (lectures, depot) => {
          const signees: Record<string, string> = {};
          for (const [nom, cle] of Object.entries(lectures)) signees[nom] = await lire(cle);
          return { lectures: signees, urlDepot: await stockage.urlDepotDuree!(depot.cle, DUREE_DEPOT_SEC, depot.mime) };
        },
        cle: (nom) => `studio/${env}/videos/${c.videoId}/${nom}`,
      },
    };
  },
});
