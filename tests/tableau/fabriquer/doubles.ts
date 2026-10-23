/**
 * DOUBLES de la chaîne de fabrication du tableau animé (TB-06a) : voix, stockage, rendu, signature, journal, budget.
 * Aucun appel réseau : la voix est la voix SIMULÉE du studio (comptée), le rendu répond « terminé » tout de suite et
 * garde la trace de chaque demande.
 */
import { fournisseurAlignementSimulation } from "../../../src/fournisseurs/simulation/alignement";
import { fournisseurVoixSimulation, stockageSimulation } from "../../../src/fournisseurs/simulation/autres";
import type { DemandeRendu, EtatRendu, FournisseurVoix, ServiceRendu, StockageFichiers } from "../../../src/fournisseurs/types";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "../../../src/briques/voix-maitre/nettoyage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { EtapeFabrication, JournalFabrication, OutilsFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { contexteExemple } from "../regles/exemples";
import { controlerProprietes, proprietesScenes } from "../../../studio-rendu/compositions/tableau/proprietes";

/** Mesures d'un fichier exporté conforme (volume, crête, durée, image). */
export const MESURES_CONFORMES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, vmaf: 96, vmafSeuil: 93 };

export interface Doubles {
  outils: OutilsFabrication;
  /** Lectures payantes de la voix. */
  lectures: () => number;
  /** Demandes soumises au rendu, par opération. */
  soumises: DemandeRendu[];
  scenesSoumises: () => DemandeRendu[];
  compositionsSoumises: () => DemandeRendu[];
  /** Fichiers « déposés » (clés). */
  fichiers: Set<string>;
  journal: { valeur: JournalFabrication | null };
  /** Pannes à provoquer (une fois chacune). */
  pannes: { journalApres?: EtapeFabrication; renduOperation?: "composition-scene" | "composition-complet" | "nettoyage-audio"; budget?: boolean };
}

const estScene = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === undefined;
const estComplet = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === "complet";

/** Doubles pour une fiche ; `partage` reprend le stockage et le journal d'un lancement précédent. */
export function doubles(fiche: FicheTableau, options: { fin?: string; partage?: Pick<Doubles, "fichiers" | "journal">; budgetRefuse?: boolean } = {}): Doubles {
  const soumises: DemandeRendu[] = [];
  const fichiers = options.partage?.fichiers ?? new Set<string>();
  const journal = options.partage?.journal ?? { valeur: null };
  const pannes: Doubles["pannes"] = {};
  let lectures = 0;
  const etats = new Map<string, EtatRendu>();

  const voix: FournisseurVoix = {
    ...fournisseurVoixSimulation,
    async lire(demande) {
      lectures++;
      return fournisseurVoixSimulation.lire(demande);
    },
  };
  const stockage: StockageFichiers = {
    ...stockageSimulation,
    async urlLecture(cle: string) {
      return `https://r2.exemple/${cle}`;
    },
  };
  const rendu: ServiceRendu = {
    async soumettre(d) {
      const op = estScene(d) ? "composition-scene" : estComplet(d) ? "composition-complet" : d.operation;
      if (pannes.renduOperation === op) {
        pannes.renduOperation = undefined;
        throw new Error("Panne du service de rendu (double).");
      }
      soumises.push(d);
      fichiers.add(d.sortie.cle);
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, ...(estComplet(d) ? { mesures: { ...MESURES_CONFORMES, dureeSec: (d.parametres as { dureeSec: number }).dureeSec } } : {}) });
      return { idRendu: d.idRendu };
    },
    async etat(id) {
      return etats.get(id) ?? { statut: "inconnu" };
    },
  };

  const contenusPreuves = Object.fromEntries(fiche.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [[e.preuveId, { phrase: "Posez-moi trois questions", testeLe: "2026-10-09" }]] : [])));

  const outils: OutilsFabrication = {
    videoId: fiche.videoId,
    env: "dev",
    lireFiche: async () => structuredClone(fiche),
    contexte: contexteExemple(fiche),
    dejaVu: { coche: true, le: "2026-10-10" },
    contenusPreuves,
    ...(options.fin ? { fin: options.fin } : {}),
    journal: {
      lire: async () => (journal.valeur ? structuredClone(journal.valeur) : null),
      ecrire: async (j) => {
        if (pannes.journalApres && j.etapes[pannes.journalApres]) {
          pannes.journalApres = undefined;
          throw new Error("Panne pendant l'écriture du journal (double).");
        }
        journal.valeur = structuredClone(j);
      },
    },
    budget: {
      tarifCentimesParCaractere: 0.03,
      verifierEtReserver: async () => {
        if (options.budgetRefuse || pannes.budget) throw new Error("Le budget du mois serait dépassé.");
      },
    },
    preparation: { proprietesScenes, controlerProprietes },
    voix: {
      voix: () => voix,
      stockage: () => stockage,
      aligneur: () => fournisseurAlignementSimulation,
      rendu: () => rendu,
      renduEstSimule: () => true,
      idVoix: "voix-williams",
      fournisseurVoix: "simulation",
      caler: () => false,
      regles: REGLES_NETTOYAGE_PAR_DEFAUT,
      cle: (nom) => `studio/dev/audio-maitre/${fiche.videoId}/${nom}`,
    },
    scenes: {
      rendu: () => rendu,
      depot: async (cle) => `https://r2.exemple/depot/${cle}`,
      existe: async (cle) => fichiers.has(cle),
    },
    montage: {
      rendu: () => rendu,
      signer: async (lectures, depots) => ({
        lectures: Object.fromEntries(Object.entries(lectures).map(([nom, cle]) => [nom, `https://r2.exemple/${cle}`])),
        depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/depot/${d.cle}`])),
      }),
      cle: (c, nom) => `studio/dev/videos/${c.videoId}/${nom}`,
    },
    personnageId: "williams",
  };
  return {
    outils,
    lectures: () => lectures,
    soumises,
    scenesSoumises: () => soumises.filter(estScene),
    compositionsSoumises: () => soumises.filter(estComplet),
    fichiers,
    journal,
    pannes,
  };
}
