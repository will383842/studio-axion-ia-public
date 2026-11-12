import { CarteEntreeCalendrier, estVerrouillee, heureLisible, trierEntrees, type EntreeCarte } from "./CarteEntreeCalendrier";
import { RESEAUX_CALENDRIER } from "./BarreFiltres";
import { LIBELLES_ESSAI } from "./apercu-reseau";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";

/** Heures proposées d'office comme créneaux (heure de Paris) : de 8 h à 19 h. */
export const PREMIERE_HEURE = 8;
export const DERNIERE_HEURE = 19;
const LONGUEUR_DEBUT = 110;

/** Début d'un texte : une ligne, coupée au dernier mot entier avant la limite, « … » si elle est coupée. */
export function debutDeTexte(texte: string | null | undefined, limite = LONGUEUR_DEBUT): string {
  const propre = (texte ?? "").replace(/\s+/g, " ").trim();
  if (propre.length <= limite) return propre;
  const coupe = propre.slice(0, limite);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > limite / 2 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/** Les heures à montrer : la plage habituelle, élargie aux publications hors plage ; seulement les heures occupées si `libres` est faux. */
export function heuresDuJour(entrees: readonly EntreeCarte[], libres: boolean): number[] {
  const occupees = entrees.map((e) => heureLisible(e.heure)).filter((h): h is string => h !== null).map((h) => Number(h.slice(0, 2)));
  if (!libres) return [...new Set(occupees)].sort((a, b) => a - b);
  const debut = Math.min(PREMIERE_HEURE, ...occupees);
  const fin = Math.max(DERNIERE_HEURE, ...occupees);
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

export interface ProprietesVueJour {
  /** Jour de Paris affiché, AAAA-MM-JJ. */
  jour: string;
  /** Jour de Paris d'aujourd'hui, AAAA-MM-JJ. */
  aujourdhui: string;
  /** Les publications ; seules celles du jour et des réseaux allumés sont montrées. */
  entrees: readonly EntreeCarte[];
  /** Réseaux allumés (défaut : les quatre). */
  reseaux?: readonly IdReseau[];
  /** Rendu serveur : l'adresse de la fiche d'une carte. */
  lienEntree?: (entree: EntreeCarte) => string | null | undefined;
  className?: string;
}

const deuxChiffres = (h: number) => String(h).padStart(2, "0");

/**
 * Vue du jour : une ligne par heure de Paris, les cartes de tous les réseaux, le début de chaque texte et les
 * créneaux libres. Un jour passé ne propose pas de créneau libre. Aucune action d'envoi ici.
 */
export function VueJour({ jour, aujourdhui, entrees, reseaux = RESEAUX_CALENDRIER, lienEntree, className }: ProprietesVueJour) {
  if (reseaux.length === 0) return <div className="rounded-xl border border-dashed border-trait-fort bg-surface-1 p-5 text-center text-texte-doux">Aucun réseau affiché. Rallumez un réseau ci-dessus.</div>;
  const passe = jour < aujourdhui;
  const duJour = trierEntrees(entrees.filter((e) => e.jour === jour && reseaux.includes(e.reseau)));
  const sansHeure = duJour.filter((e) => heureLisible(e.heure) === null);
  const carte = (e: EntreeCarte) => (
    <li key={e.cle}>
      <CarteEntreeCalendrier entree={e} libellesEtat={LIBELLES_ESSAI} avecTitre verrouillee={estVerrouillee(e, aujourdhui)} href={lienEntree?.(e)} />
    </li>
  );
  const vide = duJour.length === 0;
  return (
    <div className={className}>
      {vide && <p className="mb-3 rounded-xl border border-dashed border-trait-fort bg-surface-1 p-4 text-center text-texte-doux">{passe ? "Journée passée, rien n'avait été publié." : "Rien de prévu ce jour."}</p>}
      {(!vide || !passe) && (
        <ol aria-label="Heure par heure, heure de Paris" className="grid max-w-[640px] grid-cols-[60px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5">
          {heuresDuJour(duJour, !passe).map((h) => {
            const cartes = duJour.filter((e) => Number((heureLisible(e.heure) ?? "99").slice(0, 2)) === h);
            return (
              <li key={h} data-heure={deuxChiffres(h)} className="col-span-2 grid grid-cols-subgrid items-start">
                <span className="pt-2 font-extrabold text-texte-doux">{deuxChiffres(h)}:00</span>
                {cartes.length ? (
                  <ul className="space-y-1.5">{cartes.map(carte)}</ul>
                ) : (
                  <span data-libre="true" className={cn("rounded-lg border border-dashed border-trait px-2 py-1.5 text-sm text-texte-faible")}>
                    Libre
                  </span>
                )}
              </li>
            );
          })}
          {sansHeure.length > 0 && (
            <li data-heure="sans" className="col-span-2 grid grid-cols-subgrid items-start">
              <span className="pt-2 font-extrabold text-texte-doux">Sans heure</span>
              <ul className="space-y-1.5">{sansHeure.map(carte)}</ul>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
