/**
 * RACCORDS DU « TUTORIEL D'OUTIL » (lot I) : ce que les services branchent sur le moteur `montage-tutoriel-outil` (pur,
 * il n'importe jamais un service), sur le modèle de `tableau-branchements.ts`. Chargé pour son effet par la boucle de fond.
 *
 *  - VOIX, STOCKAGE, RENDU : les mêmes branchements réels que le tableau animé (`branchementsReels`, `tableau-outils.ts`) :
 *    voix prête du personnage (refusée avant toute dépense si ce n'est pas la voix HeyGen épinglée), stockage R2,
 *    `studio-rendu`. La voix passe par le budget du studio (`verifierEtReserverSelonOrigine`) juste avant sa lecture.
 *  - CLAUDE : relié par `tutoriel-claude.ts`, éteint par défaut (réglage propre au tutoriel). Éteint, l'appel lève (« pas encore
 *    relié ») : le plan de scènes retombe sur le plan de repli (réserve « À vérifier »), l'idée attend un script collé.
 *    Jamais d'échec. Allumé, l'appel passe par le chemin gardé de l'argent (`executerRolePourVideo`).
 *  - Rien n'est construit tant qu'un travail du tutoriel n'avance pas ; sans personnage ou sans rendu réel : `null`, le
 *    travail reste en pause claire.
 */
import { cleDepenseUsine } from "./cle-depense-usine";
import { appelClaudeTutoriel, claudeTutorielActif, regardTutorielActif } from "./tutoriel-claude";
import { creerRegardTutoriel } from "./tutoriel-regard";
import "server-only";
import { brancherServicesTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { scriptRetenu } from "@/moteurs/montage-tutoriel-outil/script";

/** T-EXT-52b : retouche sans tout refaire. ÉTEINT par défaut. */
export const PARAM_RETOUCHE_PARTIELLE_TUTORIEL = "tutoriel.retouchePartielle";

/** Vrai SEULEMENT si la valeur lue est exactement `true` (absente, `"true"`, `1`, lecture en échec : éteint). */
export async function retouchePartielleActive(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await l<unknown>(PARAM_RETOUCHE_PARTIELLE_TUTORIEL, false)) === true;
  } catch {
    return false;
  }
}

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
    // T-EXT-31 : mixage, mesure du son et vignette. Réglage absent ou autre que `true` = éteint.
    const { lireParametre } = await import("./_commun");
    const finitions = (await lireParametre<boolean>("tutoriel.finitions", false)) === true;
    // T-EXT-42 : devis et plafond par vidéo, en quantités, montrés avant toute dépense. Seul `true` exact allume ; éteint, `devis` est absent.
    const devis = (await lireParametre<boolean>("tutoriel.devisAvantDepense", false)) === true;
    const idee = "aEcrire" in scriptRetenu(c.script.texteComplet, lireEntreesTutoriel(c.entrees));
    const rendu: NonNullable<OutilsTutoriel["rendu"]> = {
      service: () => b.montage.rendu(),
      signer: async (lectures, depot) => {
        const s = await b.montage.signer(lectures, [depot]);
        return { lectures: s.lectures, urlDepot: s.depots[depot.cle] };
      },
      cle: (nom) => `studio/${b.env}/videos/${c.videoId}/${nom}`,
    };
    // T-EXT-27b : le regard de Claude sur les images-clés. Éteint (champ absent) sans `tutoriel.regardeur` ET `tutoriel.claude` à `true`.
    const regarder = (await regardTutorielActif()) ? creerRegardTutoriel({ videoId: c.videoId, origine: c.origine, rendu }) : undefined;
    return {
      ...(devis
        ? {
            devis: {
              // Rôles appelés par la chaîne (pas encore intégrés en équipe) : plan (2 essais) et, depuis une idée, script (1 essai).
              roles: [...(idee ? [{ id: "script", essaisMax: 1 }] : []), { id: "plan", essaisMax: 2 }],
              accord: lireAccordDevis(c.entrees),
              consomme: async (etat) => ({
                appelsClaude: (etat.appelsClaude?.script ?? 0) + (etat.appelsClaude?.plan ?? 0),
                caracteresVoix: etat.audio && !etat.audio.reutilise ? etat.audio.caracteres : 0,
                rendus: etat.rendus.length,
              }),
            },
          }
        : {}),
      ...(finitions ? { finitions: { actif: true as const } } : {}),
      ...((await retouchePartielleActive()) ? { retouchePartielle: true } : {}),
      sousTitres: { ...(style ? { style } : {}), ...(c.sousTitres?.base ? { base: c.sousTitres.base } : {}), ...(c.sousTitres?.intensite ? { intensite: c.sousTitres.intensite } : {}) },
      voix: {
        ...b.voix,
        avantLecture: async () => {
          const caracteres = (c.script.texteComplet ?? "").length;
          const total = centimes(Math.ceil(caracteres * TARIF_VOIX_CENTIMES_PAR_CARACTERE));
          await verifierEtReserverSelonOrigine(c.origine, { lignes: [{ etape: "voix", fournisseur: b.voix.fournisseurVoix ?? "heygen", unite: "caractere", quantite: caracteres, prixUnitaire: centimes(TARIF_VOIX_CENTIMES_PAR_CARACTERE), total, nature: "estime" }], total }, total.centimes, "Cette vidéo", { videoId: c.videoId, travailId, ...cleDepenseUsine(c.origine, travailId) });
        },
      },
      claude: (await claudeTutorielActif())
        ? appelClaudeTutoriel(c.videoId, c.origine)
        : async () => {
            throw new ErreurClaude("requete", "Claude n'est pas encore relié au tutoriel d'outil.");
          },
      ...(regarder ? { regarder } : {}),
      rendu,
    };
  },
});
