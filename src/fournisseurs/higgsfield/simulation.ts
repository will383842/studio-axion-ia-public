/**
 * DOUBLE DE SIMULATION HIGGSFIELD (lot L10) — utilisé PAR DÉFAUT. Aucun réseau, aucune dépense.
 *
 * Il reproduit ce que l'essai du 08/10 a montré : sortie 704×1248 à 24 i/s, même durée que l'entrée, débit de
 * 1 crédit/s (FLUX) ou 2 crédits/s (Kling), solde débité au lancement. Chaque travail est « terminé » au premier suivi.
 * Options d'essai : solde de départ, passages en échec (refus, panne), durée de sortie décalée (contrôle de raccord).
 */
import { creditsPourPassage, erreurHiggsfield, verifierDemande, type DemandeEditionVideo, type EtatTravailHiggsfield, type FournisseurHiggsfield, type MediaAEnvoyer } from "./types";

export const SOLDE_SIMULE_PAR_DEFAUT = 110;
export const PREFIXE_URL_SIMULEE = "https://simulation.higgsfield.invalid/resultats/";

export interface OptionsHiggsfieldSimule {
  soldeCredits?: number;
  /** Rang (0, 1, 2…) des lancements qui échouent au suivi. */
  lancementsEnEchec?: number[];
  /** Type d'échec simulé (défaut : panne réessayable). */
  echec?: "panne" | "refus";
  /** Solde illisible (panne de lecture). */
  soldeEnPanne?: boolean;
  /** Décalage de la durée de sortie (s) : simule un passage qui ne raccorde pas. */
  decalageDureeSec?: number;
}

export type HiggsfieldSimule = FournisseurHiggsfield & {
  medias: MediaAEnvoyer[];
  lancements: DemandeEditionVideo[];
  telechargements: string[];
  soldeCredits(): number;
};

export function creerHiggsfieldSimule(options: OptionsHiggsfieldSimule = {}): HiggsfieldSimule {
  let solde = options.soldeCredits ?? SOLDE_SIMULE_PAR_DEFAUT;
  const medias: MediaAEnvoyer[] = [];
  const lancements: DemandeEditionVideo[] = [];
  const telechargements: string[] = [];
  const travaux = new Map<string, { demande: DemandeEditionVideo; rang: number; credits: number }>();

  return {
    id: "simulation",
    mode: "simulation",
    medias,
    lancements,
    telechargements,
    soldeCredits: () => solde,

    async lireSolde() {
      if (options.soldeEnPanne) return erreurHiggsfield("indisponible", "Panne simulée du solde Higgsfield.");
      return { ok: true, credits: solde };
    },

    async envoyerMedia(media) {
      medias.push(media);
      return { ok: true, mediaId: `sim-media-${medias.length}` };
    },

    async lancer(demande) {
      const invalide = verifierDemande(demande);
      if (invalide) return { ok: false, erreur: invalide };
      const credits = creditsPourPassage(demande.modele, demande.dureeSec);
      if (credits > solde) return erreurHiggsfield("solde-insuffisant", "Crédits Higgsfield insuffisants (simulation).");
      solde -= credits;
      const rang = lancements.length;
      lancements.push(demande);
      const idTravail = `sim-travail-${rang + 1}`;
      travaux.set(idTravail, { demande, rang, credits });
      return { ok: true, idTravail };
    },

    async suivre(idTravail): Promise<EtatTravailHiggsfield> {
      const t = travaux.get(idTravail);
      if (!t) return { statut: "echec", erreur: { code: "inconnu", reessayable: false, message: "Travail Higgsfield inconnu (simulation)." } };
      if (options.lancementsEnEchec?.includes(t.rang)) {
        return options.echec === "refus"
          ? { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "Refus simulé." }, creditsDebites: 0 }
          : { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne simulée." }, creditsDebites: 0 };
      }
      return {
        statut: "termine",
        resultat: { url: `${PREFIXE_URL_SIMULEE}${idTravail}.mp4`, dureeSec: t.demande.dureeSec + (options.decalageDureeSec ?? 0), largeur: 704, hauteur: 1248, ips: 24, creditsDebites: t.credits },
      };
    },

    async telecharger(url) {
      telechargements.push(url);
      if (!url.startsWith(PREFIXE_URL_SIMULEE)) return erreurHiggsfield("indisponible", "Adresse inconnue (simulation).");
      return { ok: true, octets: new TextEncoder().encode(`simulation:${url}`) };
    },
  };
}
