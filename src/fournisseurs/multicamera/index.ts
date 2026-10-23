/**
 * FOURNISSEUR MULTICAMÉRA (lot F4) — fabrique les angles « de côté » et « d'en bas » avec le double HeyGen.
 *
 * Il ne parle pas lui-même à HeyGen : la version réelle s'appuie sur le fournisseur de visage déjà en place
 * (`fournisseurs/heygen`, rendu sur `audio_url`, `reference_look_id`) et sur un analyseur qui mesure chaque angle
 * (durée, synchro labiale, visage). Le DOUBLE DE SIMULATION est pris par défaut : aucun appel, aucune dépense.
 * Le réel n'est choisi que si on le demande EXPLICITEMENT (`reel: true`) ET que le visage et l'analyseur sont fournis.
 */
import type { MesureAngle } from "@/briques/multicamera/coherence";
import { garderMulticamera, type GardeOptionPayante } from "@/briques/options-payantes/garde";
import { CONSIGNE_LOOK_ANGLE } from "@/briques/multicamera/consigne";
import type { AngleGenere } from "@/briques/multicamera/types";
import type { DemandeRenduVisage, EtatRenduVisage, FournisseurVisage } from "../types";

export interface MesureDemandee {
  videoCle: string;
  /** Son de la prise d'origine (la référence de synchro). */
  audioCle: string;
  dureeReferenceSec: number;
}

/** Mesure une vidéo d'angle contre la prise (opération de `studio-rendu` en réel ; simulation par défaut). */
export interface AnalyseurAngle {
  mesurer(demande: MesureDemandee): Promise<MesureAngle>;
}

export interface FournisseurMulticamera {
  id: string;
  mode: "simulation" | "reel";
  /** UNE FOIS par double : crée le look d'un angle (mêmes vêtements, même décor) d'après une image de la prise. */
  preparerLook(demande: { visageId: string; angle: AngleGenere; imagesReference?: string[] }): Promise<{ idExterne: string }>;
  rendreAngle(demande: DemandeRenduVisage): Promise<{ idTravailExterne: string }>;
  suivre(idTravailExterne: string): Promise<EtatRenduVisage>;
  recuperer(idTravailExterne: string): Promise<{ videoCle: string; dureeSec: number }>;
  mesurer(demande: MesureDemandee): Promise<MesureAngle>;
}

/** Version réelle : enveloppe du fournisseur de visage existant (HeyGen) et de l'analyseur. */
export function fournisseurMulticameraReel(visage: FournisseurVisage, analyseur: AnalyseurAngle): FournisseurMulticamera {
  return {
    id: `multicamera-${visage.id}`,
    mode: "reel",
    async preparerLook({ visageId, angle, imagesReference }) {
      const r = await visage.creerLook({ visageId, prompt: CONSIGNE_LOOK_ANGLE[angle], ...(imagesReference?.length ? { imagesReference } : {}) });
      return { idExterne: r.idExterne };
    },
    rendreAngle: (d) => visage.rendre(d),
    suivre: (id) => visage.suivreRendu(id),
    async recuperer(id) {
      const r = await visage.recuperer(id, { fond: "decor-du-look" });
      return { videoCle: r.videoCle, dureeSec: r.dureeSec };
    },
    mesurer: (d) => analyseur.mesurer(d),
  };
}

/** Ce qu'un essai simulé peut faire rater, angle par angle (tests du repli). */
export type EchecSimule = "rendu" | "duree" | "synchro" | "visage" | "panne";

export interface OptionsSimulation {
  echecs?: Partial<Record<AngleGenere, EchecSimule>>;
  /** Durée de la prise d'origine (les angles simulés la reprennent, au mot près). */
  dureeSec?: number;
}

/** Double de simulation : aucun appel, rendus immédiats, mesures parfaites sauf échec demandé. */
export function doubleSimulationMulticamera(options: OptionsSimulation = {}): FournisseurMulticamera & { appels: string[] } {
  const appels: string[] = [];
  const angleDe = (id: string): AngleGenere => (id.includes("contre-plongee") ? "contre-plongee" : "cote");
  return {
    id: "simulation-multicamera",
    mode: "simulation",
    appels,
    async preparerLook({ visageId, angle }) {
      appels.push(`look:${angle}`);
      return { idExterne: `sim-look-${visageId}-${angle}` };
    },
    async rendreAngle(d) {
      const angle = angleDe(d.visageId);
      appels.push(`rendu:${angle}`);
      if (options.echecs?.[angle] === "panne") throw new Error("Le service des angles ne répond pas.");
      return { idTravailExterne: `sim-rendu-${angle}-${d.cleIdempotence}` };
    },
    async suivre(id) {
      const angle = angleDe(id);
      if (options.echecs?.[angle] === "rendu") return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "Le rendu a été refusé." } };
      return { statut: "termine" };
    },
    async recuperer(id) {
      const angle = angleDe(id);
      const base = options.dureeSec ?? 30;
      return { videoCle: `simulation/multicamera/${angle}.mp4`, dureeSec: options.echecs?.[angle] === "duree" ? base + 0.6 : base };
    },
    async mesurer({ videoCle, dureeReferenceSec }) {
      const angle = angleDe(videoCle);
      const e = options.echecs?.[angle];
      return {
        dureeSec: e === "duree" ? dureeReferenceSec + 0.6 : dureeReferenceSec,
        decalageAudioMs: e === "synchro" ? 180 : 0,
        visagePresentPct: e === "visage" ? 40 : 100,
      };
    },
  };
}

/**
 * Le double de simulation sauf demande EXPLICITE du réel avec ses deux dépendances. Lot J : le réel est TOUJOURS
 * enveloppé par la garde des options payantes ; sans `garde`, chaque look ou rendu HeyGen est refusé (aucune dépense).
 */
export function choisirFournisseurMulticamera(o: { reel?: boolean; visage?: FournisseurVisage; analyseur?: AnalyseurAngle; simulation?: OptionsSimulation; garde?: GardeOptionPayante } = {}): FournisseurMulticamera {
  if (o.reel === true && o.visage && o.visage.mode === "reel" && o.analyseur) return garderMulticamera(fournisseurMulticameraReel(o.visage, o.analyseur), o.garde);
  return doubleSimulationMulticamera(o.simulation);
}
