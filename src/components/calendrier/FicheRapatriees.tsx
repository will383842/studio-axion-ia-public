"use client";

/**
 * Publications reprises du diffuseur, vues jour et mois : la carte est un bouton qui ouvre la même fiche que dans la semaine,
 * en LECTURE SEULE (aucune date modifiable, aucun envoi). Les autres cartes de la vue ne changent pas.
 */
import { useState, type ReactNode } from "react";
import { ApercuPublication } from "./ApercuPublication";
import { CarteEntreeCalendrier, estVerrouillee, trierEntrees, type EntreeCarte } from "./CarteEntreeCalendrier";
import { LIBELLES_ENVOI, entreeVoisine, type EntreeApercu } from "./apercu-reseau";
import { VueJour } from "./VueJour";
import type { IdReseau } from "@/domaine/types";

function useFiche(entrees: readonly EntreeApercu[]) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const courante = ouverte ? entrees.find((e) => e.cle === ouverte) : undefined;
  const ouvrir = (carte: EntreeCarte) => {
    if (entrees.some((e) => e.cle === carte.cle)) setOuverte(carte.cle);
  };
  const aller = (sens: 1 | -1) => {
    if (!ouverte) return;
    const voisine = entreeVoisine(entrees, ouverte, sens);
    if (voisine) setOuverte(voisine.cle);
  };
  const fiche = (aujourdhui: string): ReactNode =>
    courante ? <ApercuPublication entree={courante} aujourdhui={aujourdhui} onPrecedente={() => aller(-1)} onSuivante={() => aller(1)} onFermer={() => setOuverte(null)} onChangerDate={() => undefined} /> : null;
  return { ouvrir, fiche };
}

/** Vue du jour : liens des publications du Studio inchangés ; les reprises s'ouvrent dans la fiche. */
export function VueJourAvecFiche({ jour, aujourdhui, entrees, reseaux, liens }: { jour: string; aujourdhui: string; entrees: readonly EntreeApercu[]; reseaux?: readonly IdReseau[]; liens: Readonly<Record<string, string | null | undefined>> }) {
  const { ouvrir, fiche } = useFiche(entrees);
  return (
    <>
      <VueJour jour={jour} aujourdhui={aujourdhui} entrees={entrees} reseaux={reseaux} lienEntree={(e) => liens[e.cle] ?? null} onOuvrirRapatriee={ouvrir} />
      {fiche(aujourdhui)}
    </>
  );
}

/** Vue du mois : les cases ne montrent que des repères ; les publications reprises sont listées dessous, chacune ouvre sa fiche. */
export function RapatrieesDuMois({ aujourdhui, entrees }: { aujourdhui: string; entrees: readonly EntreeApercu[] }) {
  const triees = trierEntrees(entrees);
  const { ouvrir, fiche } = useFiche(triees);
  if (triees.length === 0) return null;
  return (
    <section aria-label="Publications reprises du diffuseur ce mois-ci" data-rapatriees-mois className="mt-4">
      <h2 className="mb-2 text-sm font-bold text-texte">Reprises du diffuseur ce mois-ci</h2>
      <ul className="grid max-w-[640px] gap-1.5">
        {triees.map((e) => (
          <li key={e.cle}>
            <span className="mb-0.5 block text-xs font-bold tabular-nums text-texte-doux">{e.jour.split("-").reverse().join("/")}</span>
            <CarteEntreeCalendrier entree={e} libellesEtat={LIBELLES_ENVOI} avecTitre verrouillee={estVerrouillee(e, aujourdhui)} onOuvrir={ouvrir} className="min-h-11" />
          </li>
        ))}
      </ul>
      {fiche(aujourdhui)}
    </section>
  );
}
