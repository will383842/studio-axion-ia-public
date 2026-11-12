import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { plageSemaine } from "@/lib/calendrier-plages";
import { jourLisible } from "./CarteEntreeCalendrier";

/** « jour » s'ouvre par un clic sur un jour : il n'a pas de bouton, « Semaine » reste enfoncé. */
export type VueCalendrier = "semaine" | "mois" | "jour";

// Les jours sont des clés de Paris « AAAA-MM-JJ » : on les formate à midi en temps universel, sans glissement de date.
const midi = (jour: string) => new Date(`${jour}T12:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options });
const JOUR_LONG = format({ weekday: "long", day: "numeric", month: "long" });
const JOUR_MOIS = format({ day: "numeric", month: "long" });
const NUMERO = format({ day: "numeric" });
const MOIS_ANNEE = format({ month: "long", year: "numeric" });

/** « mercredi 11 novembre » pour un jour de Paris ; chaîne vide si le jour est illisible. */
export function libelleJour(jour: string): string {
  return jourLisible(jour) ? JOUR_LONG.format(midi(jour)) : "";
}

/**
 * Nom de la période affichée, d'après un repère (jour de Paris AAAA-MM-JJ ; AAAA-MM accepté pour le mois).
 * « Semaine du 9 au 15 novembre », « novembre 2026 », « mercredi 11 novembre ». Repère illisible : chaîne vide.
 */
export function libellePeriode(vue: VueCalendrier, repere: string): string {
  const jour = vue === "mois" && /^\d{4}-\d{2}$/.test(repere) ? `${repere}-01` : repere;
  if (!jourLisible(jour)) return "";
  if (vue === "mois") return MOIS_ANNEE.format(midi(jour));
  if (vue === "jour") return libelleJour(jour);
  const { jours } = plageSemaine(jour);
  const memeMois = jours[0].slice(0, 7) === jours[6].slice(0, 7);
  return `Semaine du ${(memeMois ? NUMERO : JOUR_MOIS).format(midi(jours[0]))} au ${JOUR_MOIS.format(midi(jours[6]))}`;
}

export interface LiensBarreVue {
  precedent: string;
  suivant: string;
  aujourdhui: string;
  semaine: string;
  mois: string;
}

export interface ProprietesBarreVue {
  vue: VueCalendrier;
  /** Nom de la période (voir `libellePeriode`). */
  periode: string;
  /** Rendu serveur : les cinq adresses. S'il est fourni, les gestes ci-dessous sont ignorés. */
  liens?: LiensBarreVue;
  onPrecedent?: () => void;
  onSuivant?: () => void;
  onAujourdhui?: () => void;
  onChangerVue?: (vue: "semaine" | "mois") => void;
  /** Emplacement à droite du bouton segmenté (Filtrer, + Ajouter…). */
  children?: ReactNode;
  className?: string;
}

const BOUTON = "inline-flex min-h-[38px] items-center justify-center rounded-[10px] border border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte hover:bg-surface-2";
const SEGMENT = "inline-flex min-h-9 items-center px-3 text-sm font-bold";

/** Haut du calendrier : flèches autour de la période, « Aujourd'hui », bouton segmenté « Semaine | Mois ». */
export function BarreVue({ vue, periode, liens, onPrecedent, onSuivant, onAujourdhui, onChangerVue, children, className }: ProprietesBarreVue) {
  const enfonce = { semaine: vue !== "mois", mois: vue === "mois" };
  const segment = (cle: "semaine" | "mois", texte: string, libelle: string) => {
    const classes = cn(SEGMENT, enfonce[cle] ? "bg-texte text-fond" : "text-texte-doux hover:bg-surface-2");
    return liens ? (
      <Link href={liens[cle]} aria-label={libelle} aria-current={enfonce[cle] ? "true" : undefined} className={classes}>
        {texte}
      </Link>
    ) : (
      <button type="button" aria-label={libelle} aria-pressed={enfonce[cle]} onClick={onChangerVue ? () => onChangerVue(cle) : undefined} className={classes}>
        {texte}
      </button>
    );
  };
  const bouton = (cle: "precedent" | "suivant" | "aujourdhui", texte: string, libelle: string, geste?: () => void) =>
    liens ? (
      <Link href={liens[cle]} aria-label={libelle} className={BOUTON}>
        {texte}
      </Link>
    ) : (
      <button type="button" aria-label={libelle} onClick={geste} className={BOUTON}>
        {texte}
      </button>
    );
  return (
    <div className={cn("mb-1.5 flex flex-wrap items-center gap-2", className)}>
      {bouton("precedent", "←", "Période précédente", onPrecedent)}
      <span aria-live="polite" className="min-w-0 text-center font-extrabold text-texte sm:min-w-[210px]">
        {periode}
      </span>
      {bouton("suivant", "→", "Période suivante", onSuivant)}
      {bouton("aujourdhui", "Aujourd'hui", "Revenir à aujourd'hui", onAujourdhui)}
      <div role="group" aria-label="Affichage" className="inline-flex overflow-hidden rounded-[10px] border border-trait-fort bg-surface-1">
        {segment("semaine", "Semaine", "Afficher la semaine")}
        {segment("mois", "Mois", "Afficher le mois")}
      </div>
      {children}
    </div>
  );
}
