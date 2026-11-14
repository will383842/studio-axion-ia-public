"use client";

/**
 * Mode Agenda du calendrier sur téléphone (CAL-12b) : la semaine en liste, un jour après l'autre, une carte par
 * publication, sans défilement horizontal. Un appui sur une carte ouvre le tiroir de CAL-12 (ApercuPublication), qui
 * monte du bas sur téléphone. Un jour sans publication le dit en une phrase. Aujourd'hui est marqué et amené à l'écran.
 * Disposition, mots et couleurs : la maquette validée (docs/maquettes/calendrier/calendrier-du-studio.html).
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { plageSemaine } from "@/lib/calendrier-plages";
import { filtrerEntrees, type CriteresFiltre } from "@/domaine/calendrier/regroupement";
import { ApercuPublication } from "./ApercuPublication";
import { libelleJour } from "./BarreVue";
import { CarteEntreeCalendrier, jourLisible, trierEntrees, type EntreeCarte } from "./CarteEntreeCalendrier";
import type { TableLibelles } from "./PastilleStatutPlan";
import { LIBELLES_ENVOI, entreeVoisine, type EntreeApercu } from "./apercu-reseau";

export interface ProprietesVueAgenda {
  entrees: readonly EntreeApercu[];
  /** N'importe quel jour de Paris (AAAA-MM-JJ) de la semaine à montrer ; illisible : la semaine d'aujourd'hui. */
  semaineDu: string;
  /** Jour de Paris d'aujourd'hui (AAAA-MM-JJ), fourni par l'appelant. */
  aujourdhui: string;
  /** Filtres du calendrier : la liste et les flèches du tiroir ne parcourent que les entrées gardées. Absent : toutes. */
  criteres?: CriteresFiltre;
  /** Changement de date demandé dans le tiroir. Absent : le tiroir dit d'ouvrir la vue Semaine. */
  onChangerDate?: (jour: string, entree: EntreeApercu) => void;
  /** Adresse de la vue Jour d'un jour (AAAA-MM-JJ). Fournie : le titre du jour devient un lien. Absente : simple titre. */
  lienJour?: (jour: string) => string;
  className?: string;
}

/** Dit où changer la date quand cette vue n'a pas d'action de décalage. */
export const PHRASE_DATE_EN_SEMAINE = "Pour changer la date, ouvrez la vue Semaine.";
const PHRASE_JOUR_A_VENIR = "Vous n'avez rien de prévu ce jour.";
const PHRASE_JOUR_PASSE = "Vous n'aviez rien prévu ce jour-là.";
/** Mots de la maquette : un jour qui a des publications que les filtres masquent n'est pas un jour vide. */
const PHRASE_FILTRE = "Aucune publication avec ces filtres.";
const PHRASE_ILLISIBLE = "Semaine illisible. Revenez à aujourd'hui.";

/** Les mots de l'envoi par Buffer sont partagés avec la grille (apercu-reseau.ts). */
export const LIBELLES_AGENDA: TableLibelles = LIBELLES_ENVOI;

/** Bouton d'au moins 38 px de haut (maquette) : un doigt l'atteint sans viser. */
const CARTE = "min-h-[38px] break-words";

/** La semaine en liste, jour par jour. */
export function VueAgenda({ entrees, semaineDu, aujourdhui, criteres, onChangerDate, lienJour, className }: ProprietesVueAgenda): ReactNode {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const aujourdhuiRef = useRef<HTMLElement | null>(null);
  const visibles = useMemo(() => (criteres ? filtrerEntrees(entrees, criteres) : entrees), [entrees, criteres]);
  const courante = ouverte ? entrees.find((e) => e.cle === ouverte) : undefined;

  // La liste s'ouvre sur aujourd'hui (maquette) : on l'amène à l'écran, sans animation si le système la déconseille.
  useEffect(() => {
    const calme = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    aujourdhuiRef.current?.scrollIntoView?.({ block: "start", behavior: calme ? "auto" : "smooth" });
  }, [semaineDu, aujourdhui]);

  const repere = jourLisible(semaineDu) ? semaineDu : aujourdhui;
  if (!jourLisible(repere)) return <div className={cn("w-full min-w-0 rounded-xl border border-dashed border-trait-fort bg-surface-1 p-5 text-center text-sm text-texte-doux", className)}>{PHRASE_ILLISIBLE}</div>;
  const { jours } = plageSemaine(repere);
  const triees = trierEntrees(visibles);

  const ouvrir = (carte: EntreeCarte) => {
    if (!entrees.some((e) => e.cle === carte.cle)) return;
    setOuverte(carte.cle);
    setMessage(null);
  };
  const aller = (sens: 1 | -1) => {
    if (!ouverte) return;
    // Une entrée ouverte que le filtre masque : on repart du début (ou de la fin) de la liste filtrée.
    const voisine = entreeVoisine(visibles, ouverte, sens) ?? (sens === 1 ? triees[0] : triees.at(-1));
    if (voisine) {
      setOuverte(voisine.cle);
      setMessage(null);
    }
  };
  const changerDate = (jour: string) => {
    if (!courante) return;
    if (onChangerDate) onChangerDate(jour, courante);
    else setMessage(PHRASE_DATE_EN_SEMAINE);
  };

  return (
    <>
      <div data-agenda="" className={cn("flex w-full min-w-0 flex-col gap-3 overflow-x-hidden", className)}>
        {jours.map((jour) => {
          const duJour = triees.filter((e) => e.jour === jour);
          const masque = duJour.length === 0 && entrees.some((e) => e.jour === jour);
          const estAujourdhui = jour === aujourdhui;
          const passe = jourLisible(aujourdhui) && jour < aujourdhui;
          return (
            <section
              key={jour}
              data-jour={jour}
              aria-current={estAujourdhui ? "date" : undefined}
              aria-labelledby={`agenda-${jour}`}
              ref={estAujourdhui ? aujourdhuiRef : undefined}
              className={cn("min-w-0 scroll-mt-2 rounded-xl border bg-surface-1 p-2", estAujourdhui ? "border-orange bg-surface-2" : "border-trait")}
            >
              <h3 id={`agenda-${jour}`} className={cn("mb-2 break-words text-sm font-bold capitalize", estAujourdhui ? "text-orange-vif" : "text-texte-doux")}>
                {lienJour ? (
                  <Link href={lienJour(jour)} aria-label={`Ouvrir la journée du ${libelleJour(jour)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                    {libelleJour(jour)}
                    {estAujourdhui && <span className="font-semibold normal-case">&nbsp;· aujourd&apos;hui</span>}
                  </Link>
                ) : (
                  <>
                    {libelleJour(jour)}
                    {estAujourdhui && <span className="font-semibold normal-case"> · aujourd&apos;hui</span>}
                  </>
                )}
              </h3>
              {duJour.length === 0 ? (
                <p className="rounded-lg border border-dashed border-trait-fort p-3 text-center text-sm text-texte-doux">{masque ? PHRASE_FILTRE : passe ? PHRASE_JOUR_PASSE : PHRASE_JOUR_A_VENIR}</p>
              ) : (
                <ul className="m-0 flex min-w-0 list-none flex-col gap-2 p-0">
                  {duJour.map((e) => (
                    <li key={e.cle} className="min-w-0">
                      <CarteEntreeCalendrier entree={e} avecTitre libellesEtat={LIBELLES_AGENDA} onOuvrir={ouvrir} className={CARTE} />
                      {/* Le compte visé (deux LinkedIn, deux Facebook), comme sur l'ancienne liste (lot R1b). */}
                      {e.canalNom && <p data-compte="" className="mt-0.5 min-w-0 truncate px-1.5 text-xs text-texte-faible">· {e.canalNom}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {courante && (
        <ApercuPublication
          entree={courante}
          aujourdhui={aujourdhui}
          onPrecedente={() => aller(-1)}
          onSuivante={() => aller(1)}
          onFermer={() => setOuverte(null)}
          onChangerDate={changerDate}
          message={message}
          tonMessage="info"
        />
      )}
    </>
  );
}
