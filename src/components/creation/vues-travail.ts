/** Harmonisation H8b : adaptateurs purs d'un travail du moteur (`VueTravail`) vers `VueSuiviFabrication`. Aucun champ d'argent, jamais. */
import { etapesParlantes, type EtapeMoteurVue } from "@/domaine/facecam-parcours";
import type { StatutTravail } from "@/domaine/types";
import type { VueTravail } from "@/services/vues";
import type { EtatEtapeSuivi, EtatSuivi, VueSuiviFabrication } from "./SuiviFabrication";

const ETAT_TRAVAIL: Record<StatutTravail, EtatSuivi> = { en_file: "en-cours", en_cours: "en-cours", termine: "prete", echec: "coincee", annule: "arretee" };
const ETAT_ETAPE = { terminee: "faite", en_cours: "en-cours", en_attente: "a-venir", echec: "arretee", ignoree: "ignoree" } as const;

/** Suivi d'une fabrication de l'assistant (et de la fiche vidéo) : étapes, avancement, temps, file d'attente. Sans montant. */
export function versSuiviFabrication(t: VueTravail): VueSuiviFabrication {
  return {
    etat: ETAT_TRAVAIL[t.statut],
    progression: t.progression,
    resteSec: t.resteSec,
    etapes: t.etapes.map((e) => ({
      cle: e.cle,
      libelle: e.nom,
      etat: ETAT_ETAPE[e.statut],
      icone: e.icone,
      progression: e.progression,
      ...(e.erreur ? { erreur: { message: e.erreur.messagePourWill, reessayable: e.erreur.reessayable } } : {}),
    })),
    suivi: { resteMin: t.resteMin, heureFin: t.heureFin, rang: t.rang, debutVers: t.debutVers, enAttenteFournisseur: t.enAttenteFournisseur, attenteCredit: t.attenteCredit, abonnementsClaude: t.abonnementsClaude, aucunCompteClaude: t.aucunCompteClaude },
  };
}

/** Montage face caméra : les 4 étapes parlantes (Le son, Les coupes, L'image, Les sous-titres et cartes), sans montant ni temps chiffré. */
export function versSuiviParlant(etapes: EtapeMoteurVue[], statut: StatutTravail): VueSuiviFabrication {
  const etat = etapesParlantes(etapes).map((e): { cle: string; libelle: string; etat: EtatEtapeSuivi } => ({ cle: e.nom, libelle: e.nom, etat: e.statut === "echec" ? "arretee" : e.statut }));
  return { etat: ETAT_TRAVAIL[statut], etapes: etat };
}
