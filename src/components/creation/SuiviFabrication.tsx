"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ProgressionEtapes, type SuiviProgression } from "@/components/ui/ProgressionEtapes";
import type { EtapeTravail } from "@/domaine/types";

export type EtatSuivi = "en-cours" | "prete" | "a-relire" | "arretee" | "coincee";
export type EtatEtapeSuivi = "faite" | "en-cours" | "a-venir" | "arretee" | "ignoree";

/** Vue normalisée du suivi : aucun champ d'argent (les sommes restent dans les composants spécifiques). */
export interface VueSuiviFabrication {
  etat: EtatSuivi;
  etapes: { cle: string; libelle: string; etat: EtatEtapeSuivi; icone?: string; progression?: number; erreur?: { message: string; reessayable?: boolean } }[];
  /** Avancement en % quand le moteur le donne ; sinon calculé d'après les étapes faites. */
  progression?: number;
  resteSec?: number;
  /** Temps restant, heure de fin, rang dans la file, outil ralenti, crédit en attente : jamais d'argent. */
  suivi?: Omit<SuiviProgression, "depense">;
  /** Phrase lisible (ErreurLisible / ErreurStudio seulement). */
  message?: string;
  lien?: { href: string; libelle: string };
}

const STATUT = { faite: "terminee", "en-cours": "en_cours", "a-venir": "en_attente", arretee: "echec", ignoree: "ignoree" } as const;

/** Part d'avancement, de 0 à 100, selon les étapes faites. */
export function progressionDeVue(vue: VueSuiviFabrication): number {
  if (vue.etat === "prete") return 100;
  const n = vue.etapes.length;
  if (!n) return 0;
  const faites = vue.etapes.filter((e) => e.etat === "faite").length;
  return Math.round((faites / n) * 100);
}

/** Étapes au format de `ProgressionEtapes`. */
export function etapesDeVue(vue: VueSuiviFabrication): EtapeTravail[] {
  return vue.etapes.map((e) => ({
    cle: e.cle,
    nom: e.libelle,
    icone: e.icone ?? "film",
    dependDe: [],
    statut: vue.etat === "prete" ? "terminee" : STATUT[e.etat],
    progression: e.progression ?? (e.etat === "faite" || vue.etat === "prete" ? 100 : 0),
    sortieFichierIds: [],
    erreur: e.erreur
      ? ({ messagePourWill: e.erreur.message, reessayable: e.erreur.reessayable } as EtapeTravail["erreur"])
      : e.etat === "arretee" && vue.message
        ? ({ messagePourWill: vue.message, reessayable: false } as EtapeTravail["erreur"])
        : undefined,
  }));
}

/** Suivi d'une fabrication : enveloppe de `ProgressionEtapes` fondée sur une vue normalisée. */
export function SuiviFabrication({
  vue,
  actions,
  compacte,
  pied,
  specifiqueSuivi,
  message,
  onReessayer,
  reessaiEnCours,
}: {
  vue: VueSuiviFabrication;
  actions?: ReactNode;
  compacte?: boolean;
  /** Ligne en plus sous le suivi : le composant spécifique y met sa propre ligne de dépense ; rien pour la face caméra. */
  pied?: ReactNode;
  /** Ce que seul le format a à dire après la liste des étapes (fichiers déjà faits d'une fabrication arrêtée, voix déjà payée…). */
  specifiqueSuivi?: ReactNode;
  /** Phrase d'une action du suivi qui a échoué (jamais un clic muet). */
  message?: string | null;
  onReessayer?: () => void;
  reessaiEnCours?: boolean;
}) {
  const aRelire = vue.etat === "a-relire" ? vue.etapes.find((e) => e.etat === "arretee")?.cle : undefined;
  return (
    <section aria-label="Suivi de la fabrication" data-etat={vue.etat}>
      <ProgressionEtapes
        etapes={etapesDeVue(vue)}
        progression={vue.progression ?? progressionDeVue(vue)}
        resteSec={vue.resteSec}
        suivi={vue.suivi}
        onReessayer={onReessayer}
        reessaiEnCours={reessaiEnCours}
        compacte={compacte}
        aRelire={aRelire}
        action={actions}
        message={message ?? (vue.etat === "coincee" ? vue.message : undefined)}
      />
      {specifiqueSuivi && <div className="mt-4">{specifiqueSuivi}</div>}
      {pied && <div className="mt-3 flex justify-end text-xs tabular-nums text-texte-faible">{pied}</div>}
      {vue.lien && (
        <Link href={vue.lien.href} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-orange-vif underline-offset-2 hover:underline">
          {vue.lien.libelle}
        </Link>
      )}
    </section>
  );
}
