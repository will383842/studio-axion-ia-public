"use client";

/**
 * ENREGISTREMENT DIFFÉRÉ de l'écran « Votre vidéo » (lot M3, plan B.9) : il n'y a plus de passage d'étape, le brouillon
 * s'enregistre ≈ 800 ms après le DERNIER changement. Jamais deux enregistrements à la fois : un changement arrivé
 * pendant un enregistrement en relance un seul après lui. `vider()` enregistre tout de suite (avant « Fabriquer »).
 */
import { useCallback, useEffect, useMemo, useRef } from "react";

export const DELAI_ENREGISTREMENT_MS = 800;

export interface Planificateur {
  /** Un changement : l'enregistrement part `delai` ms après le dernier. */
  planifier(): void;
  /** Enregistre maintenant ce qui attend (et attend la fin d'un enregistrement en cours). */
  vider(): Promise<void>;
  /** Abandonne ce qui attend (sortie de l'écran). */
  arreter(): void;
  readonly enAttente: boolean;
}

/** Planificateur PUR (minuterie injectable), testé avec une horloge simulée. */
export function creerPlanificateur(
  action: () => Promise<unknown>,
  delai = DELAI_ENREGISTREMENT_MS,
  horloge: { setTimeout: (f: () => void, ms: number) => unknown; clearTimeout: (t: unknown) => void } = {
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  },
): Planificateur {
  let minuterie: unknown = null;
  let enCours: Promise<void> | null = null;
  let aRefaire = false;
  let attente = false;

  const executer = async (): Promise<void> => {
    if (enCours) {
      aRefaire = true;
      return enCours;
    }
    attente = false;
    enCours = (async () => {
      try {
        await action();
      } finally {
        enCours = null;
      }
      if (aRefaire) {
        aRefaire = false;
        await executer();
      }
    })();
    return enCours;
  };

  return {
    planifier() {
      attente = true;
      if (minuterie !== null) horloge.clearTimeout(minuterie);
      minuterie = horloge.setTimeout(() => {
        minuterie = null;
        void executer();
      }, delai);
    },
    async vider() {
      if (minuterie !== null) {
        horloge.clearTimeout(minuterie);
        minuterie = null;
      }
      if (attente) await executer();
      else if (enCours) await enCours;
    },
    arreter() {
      if (minuterie !== null) horloge.clearTimeout(minuterie);
      minuterie = null;
      attente = false;
    },
    get enAttente() {
      return attente || !!enCours;
    },
  };
}

/** Accroche React du planificateur : `planifier` à chaque changement, `vider` avant de lancer. */
export function useEnregistrementDiffere(action: () => Promise<unknown>, actif: boolean, delai = DELAI_ENREGISTREMENT_MS) {
  const derniere = useRef(action);
  useEffect(() => {
    derniere.current = action;
  }, [action]);
  const planificateur = useRef<Planificateur | null>(null);
  const obtenir = useCallback(() => {
    planificateur.current ??= creerPlanificateur(() => derniere.current(), delai);
    return planificateur.current;
  }, [delai]);
  // En quittant l'écran : ce qui attend est enregistré (jamais perdu).
  useEffect(() => () => void planificateur.current?.vider(), []);
  const planifier = useCallback(() => {
    if (actif) obtenir().planifier();
  }, [actif, obtenir]);
  const vider = useCallback(() => obtenir().vider(), [obtenir]);
  return useMemo(() => ({ planifier, vider }), [planifier, vider]);
}
