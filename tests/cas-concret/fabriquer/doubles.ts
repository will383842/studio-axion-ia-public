/**
 * DOUBLES de la chaîne du cas concret (M8) : écriture simulée (gabarit de M3), captures, voix simulée du studio (comptée),
 * assemblage, rendu qui répond « terminé » tout de suite, signature, journal, budget. Aucun appel réseau.
 */
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { fournisseurAlignementSimulation } from "@/fournisseurs/simulation/alignement";
import { fournisseurVoixSimulation, stockageSimulation } from "@/fournisseurs/simulation/autres";
import type { DemandeRendu, EtatRendu, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { ReseauCas } from "@/formats/cas-concret";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import type { EntreesCasConcret } from "@/moteurs/montage-cas-concret/etapes";
import type { JournalCasConcret, OptionsFabricationCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import type { BruitageValideCasConcret, DemandeAssemblage, DemandeCapture, EtapeCasConcret, OutilsFabricationCasConcret } from "@/moteurs/montage-cas-concret/outils";
import { REGLES_BLANCS_CAS_CONCRET } from "@/moteurs/montage-cas-concret/voix";

/** Mesures d'un fichier exporté conforme. */
export const MESURES_CONFORMES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, vmaf: 96, vmafSeuil: 93, largeur: 1080, hauteur: 1920, fps: 25 };

const estEcran = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === undefined;
const estComplet = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === "complet";

/** Sons validés d'essai : un par déclencheur de la banque. */
export const SONS_VALIDES: BruitageValideCasConcret[] = (["illustration-forte", "impact", "document", "telephone", "chiffre"] as const).map((declencheur) => ({
  elementId: `son-${declencheur}`,
  declencheur,
  variante: 1,
  dureeSec: 0.3,
  cle: `studio/dev/bruitages/${declencheur}.wav`,
  mime: "audio/wav",
}));

export interface Partage {
  fichiers: Set<string>;
  /** Demandes connues du service de rendu (il survit à un lancement). */
  etats?: Map<string, EtatRendu>;
  journal: { valeur: JournalCasConcret | null };
}

export interface Doubles {
  options: OptionsFabricationCasConcret;
  partage: Partage;
  /** Lectures payantes de la voix (texte lu). */
  lus: string[];
  appelsEcriture: () => number;
  roles: string[];
  reservationsVoix: number[];
  captures: DemandeCapture[];
  assemblages: DemandeAssemblage[];
  soumises: DemandeRendu[];
  ecransSoumis: () => DemandeRendu[];
  compositionsSoumises: () => DemandeRendu[];
  pannes: { journalApres?: EtapeCasConcret; journalEcransApres?: number };
}

export interface OptionsDoubles {
  casId?: string;
  cas?: CasConcret;
  reseaux?: ReseauCas[];
  avecMot?: boolean;
  /** Comptes où le mot est branché ; absent : aucun (aujourd'hui, X6). */
  motSur?: ReseauCas[];
  partage?: Partage;
  bruitages?: BruitageValideCasConcret[];
  panneDEssai?: EtapeCasConcret;
  /** Lectures (n° à partir de 1) dont la voix avale un mot : la prise est rejetée « mots ». */
  lecturesFautives?: number[];
  /** 17/10 : coût d'une lecture (centimes par caractère, arrondi supérieur) ; absent : celui de la voix d'essai. */
  coutVoixParCaractere?: number;
  /** Transforme la fiche rendue par l'écriture simulée. */
  retoucherFiche?: (fiche: Record<string, unknown>) => Record<string, unknown>;
}

export function doubles(opt: OptionsDoubles = {}): Doubles {
  const cas = opt.cas ?? trouverCas(opt.casId ?? "recrutement-apporteurs")!;
  const reseaux = opt.reseaux ?? ["facebook", "instagram", "tiktok", "linkedin"];
  const partage: Partage = opt.partage ?? { fichiers: new Set(), journal: { valeur: null } };
  partage.etats ??= new Map();
  const fichiers = partage.fichiers;
  const lus: string[] = [];
  const roles: string[] = [];
  const reservationsVoix: number[] = [];
  const captures: DemandeCapture[] = [];
  const assemblages: DemandeAssemblage[] = [];
  const soumises: DemandeRendu[] = [];
  const pannes: Doubles["pannes"] = {};
  const etats = partage.etats;
  let ecrituresJournalEcrans = 0;

  const voix: FournisseurVoix = {
    ...fournisseurVoixSimulation,
    async lire(demande) {
      lus.push(demande.texte);
      const lue = await fournisseurVoixSimulation.lire(demande);
      const r = opt.coutVoixParCaractere ? { ...lue, cout: { ...lue.cout, centimes: Math.ceil(demande.texte.length * opt.coutVoixParCaractere - 1e-9) } } : lue;
      return opt.lecturesFautives?.includes(lus.length) && r.mots ? { ...r, mots: r.mots.filter((_, i) => i !== 3) } : r;
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
      soumises.push(d);
      fichiers.add(d.sortie.cle);
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, ...(estComplet(d) ? { mesures: { ...MESURES_CONFORMES, dureeSec: (d.parametres as { dureeSec: number }).dureeSec } } : {}) });
      return { idRendu: d.idRendu };
    },
    async etat(id) {
      return etats.get(id) ?? { statut: "inconnu" };
    },
  };

  const entrees: EntreesCasConcret = { casId: cas.id, porte: "porte-a", mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: opt.avecMot ?? true, motSur: opt.motSur ?? [], reseaux, essai: false, codeSuivi: `cc-${cas.id}-abc123` };

  const outils: OutilsFabricationCasConcret<JournalCasConcret> = {
    voix: {
      voix: () => voix,
      stockage: () => stockage,
      aligneur: () => fournisseurAlignementSimulation,
      rendu: () => rendu,
      renduEstSimule: () => true,
      idVoix: "voix-avocat",
      fournisseurVoix: "simulation",
      reglages: { vitesse: 1.1, stabilite: 45, emotion: 30 },
      caler: () => false,
      regles: REGLES_BLANCS_CAS_CONCRET,
      cle: (nom) => `studio/dev/audio-maitre/video-cc/${nom}`,
      assembler: async (d) => {
        assemblages.push(d);
        const duree = d.morceaux.reduce((s, m) => s + (m.aSec - m.deSec), 0) / (d.tempo ?? 1);
        return { cle: d.sortieCle, dureeSec: +duree.toFixed(3), mesures: { tempo: d.tempo ?? 1 } };
      },
      mesurerPauses: async (_cle, pauses) => pauses.map(() => -50),
    },
    scenes: {
      rendu: () => rendu,
      depot: async (cle) => `https://r2.exemple/depot/${cle}`,
      existe: async (cle) => fichiers.has(cle),
    },
    montage: {
      rendu: () => rendu,
      signer: async (lectures, depots) => ({
        lectures: Object.fromEntries(Object.entries(lectures).map(([nom, cle]) => [nom, `https://r2.exemple/signe/${cle}?jeton=${Math.random().toString(36).slice(2)}`])),
        depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/depot/${d.cle}`])),
      }),
      cle: (c, nom) => `studio/dev/videos/${c.videoId}/${nom}`,
    },
    captures: {
      capturer: async (d) => {
        captures.push(d);
        fichiers.add(d.cle);
        return { ok: true, cle: d.cle, mime: d.parametres.type === "video" ? "video/mp4" : "image/jpeg", mesures: { largeur: 1080, hauteur: 1920, ...(d.parametres.mouvement === "frappe" ? { mouvement: 2 } : {}) } };
      },
      existe: async (cle) => fichiers.has(cle),
    },
    ecriture: {
      appeler: async (role: DefinitionRole, entree: EntreeRole) => {
        roles.push(role.id);
        let donnees = role.simuler?.(entree) as unknown;
        if (role.id === "ecriture-cas-concret" && opt.retoucherFiche && donnees && typeof donnees === "object") donnees = opt.retoucherFiche(structuredClone(donnees) as Record<string, unknown>);
        // X3 : même forme que la production (rôle sans schéma) : le TEXTE de la réponse, jamais `donnees`.
        return { ok: true, simule: true, texte: typeof donnees === "string" ? donnees : JSON.stringify(donnees ?? ""), stopReason: "end_turn" };
      },
      budget: { reserver: async () => ({ ok: true }) },
    },
    journal: {
      lire: async () => (partage.journal.valeur ? structuredClone(partage.journal.valeur) : null),
      ecrire: async (j) => {
        if (pannes.journalApres && j.etapes[pannes.journalApres]) {
          pannes.journalApres = undefined;
          throw new Error("Panne pendant l'écriture du journal (double).");
        }
        if (j.ecrans && pannes.journalEcransApres !== undefined && ++ecrituresJournalEcrans > pannes.journalEcransApres) {
          pannes.journalEcransApres = undefined;
          throw new Error("Panne pendant le rendu des écrans (double).");
        }
        partage.journal.valeur = structuredClone(j);
      },
    },
    budget: {
      tarifCentimesParCaractere: 0.03,
      verifierEtReserver: async (e) => {
        reservationsVoix.push(e.centimes);
      },
    },
    contexte: {
      aujourdhui: "2026-10-12",
      interdits: [],
      reseaux,
      tableDesFins: TABLE_FINS_DIAGNOSTIC,
      bruitagesValides: opt.bruitages ?? [],
      ...(opt.panneDEssai ? { panneDEssai: opt.panneDEssai } : {}),
    },
  };

  return {
    options: { videoId: "video-cc", versionId: "v1", numeroVersion: 42, env: "dev", cas, entrees, outils, personnageId: "williams" },
    partage,
    lus,
    appelsEcriture: () => roles.filter((r) => r === "ecriture-cas-concret").length,
    roles,
    reservationsVoix,
    captures,
    assemblages,
    soumises,
    ecransSoumis: () => soumises.filter(estEcran),
    compositionsSoumises: () => soumises.filter(estComplet),
    pannes,
  };
}
