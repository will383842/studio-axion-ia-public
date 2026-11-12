/**
 * RACCORDS DU « TUTORIEL D'OUTIL » (lot I) : ce que les services branchent sur le moteur `montage-tutoriel-outil` (pur,
 * il n'importe jamais un service), sur le modèle de `tableau-branchements.ts`. Chargé pour son effet par la boucle de fond.
 *
 *  - VOIX, STOCKAGE, RENDU : les mêmes branchements réels que le tableau animé (`branchementsReels`, `tableau-outils.ts`) :
 *    voix prête du personnage (refusée avant toute dépense si ce n'est pas la voix HeyGen épinglée), stockage R2,
 *    `studio-rendu`. La voix passe par le budget du studio (`verifierEtReserverSelonOrigine`) juste avant sa lecture.
 *  - CLAUDE : PAS ENCORE RELIÉ (à faire avant usage réel : un rôle facturé par `executerRolePourVideo`, pré-vol et
 *    réservation des crédits ; `envoyerMessage` n'est appelé que par `executerRole`). En attendant, l'appel lève : le plan
 *    de scènes retombe sur le plan de repli (réserve « À vérifier »), l'idée attend un script collé. Jamais d'échec.
 *  - Rien n'est construit tant qu'un travail du tutoriel n'avance pas ; sans personnage ou sans rendu réel : `null`, le
 *    travail reste en pause claire.
 */
import "server-only";
import { brancherServicesTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";

brancherServicesTutoriel({
  outils: async (c, travailId): Promise<OutilsTutoriel | null> => {
    const personnageId = c.distribution[0]?.personnageId;
    if (!personnageId) return null;
    const { branchementsReels, TARIF_VOIX_CENTIMES_PAR_CARACTERE } = await import("./tableau-outils");
    const { verifierEtReserverSelonOrigine } = await import("./credits");
    const { centimes } = await import("@/lib/montants");
    const { ErreurClaude } = await import("@/fournisseurs/claude/client");
    let b: Awaited<ReturnType<typeof branchementsReels>>;
    try {
      b = await branchementsReels(personnageId, c.videoId);
    } catch {
      // Rendu, stockage ou voix pas reliés : pause claire (le moteur le dit), rien n'est dépensé.
      return null;
    }
    // Style de la Bibliothèque choisi pour la vidéo : transmis au moteur (champs absents si non définis).
    const style = c.styles.sousTitres?.valeur;
    return {
      sousTitres: { ...(style ? { style } : {}), ...(c.sousTitres?.base ? { base: c.sousTitres.base } : {}), ...(c.sousTitres?.intensite ? { intensite: c.sousTitres.intensite } : {}) },
      voix: {
        ...b.voix,
        avantLecture: async () => {
          const caracteres = (c.script.texteComplet ?? "").length;
          const total = centimes(Math.ceil(caracteres * TARIF_VOIX_CENTIMES_PAR_CARACTERE));
          await verifierEtReserverSelonOrigine(c.origine, { lignes: [{ etape: "voix", fournisseur: b.voix.fournisseurVoix ?? "heygen", unite: "caractere", quantite: caracteres, prixUnitaire: centimes(TARIF_VOIX_CENTIMES_PAR_CARACTERE), total, nature: "estime" }], total }, total.centimes, "Cette vidéo", { videoId: c.videoId, travailId });
        },
      },
      claude: async () => {
        throw new ErreurClaude("requete", "Claude n'est pas encore relié au tutoriel d'outil.");
      },
      rendu: {
        service: () => b.montage.rendu(),
        signer: async (lectures, depot) => {
          const s = await b.montage.signer(lectures, [depot]);
          return { lectures: s.lectures, urlDepot: s.depots[depot.cle] };
        },
        cle: (nom) => `studio/${b.env}/videos/${c.videoId}/${nom}`,
      },
    };
  },
});
