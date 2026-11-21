"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ReglagesReserve as Reglages } from "@/domaine/tutoriel-reserve";
import type { ResultatReglageReserve } from "./actions-reserve";

interface Props {
  reglages: Reglages;
  /** `tutoriel.formulaire` est allumé. */
  formulaireOuvert: boolean;
  enregistrer: (donnees: FormData) => Promise<ResultatReglageReserve>;
}

export const TEXTES_RESERVE = {
  titre: "Réserve de tutoriels",
  prendreSeul: "Prendre seul dans la réserve",
  parSemaine: "Combien par semaine",
  parSemaineAide: "0 : seulement quand l'usine le demande",
  voix: "Avec voix",
  voixAide: "Éteint : vidéos sans voix, aucune dépense de voix. Allumé : le devis avant dépense doit être allumé.",
  limite: "Limite par vidéo pour l'écriture (Claude)",
  limiteAide: "Deux décimales, de 0,01 à 10,00. Cette limite ne peut que restreindre : elle ne change aucun plafond.",
  avertissementFerme: "Le tutoriel est fermé : rien ne sera pris tant qu'il l'est.",
  ouvrir: "Ouvrir la réserve",
} as const;

/** Centimes → « 1,25 » (sans symbole : rien n'est formaté comme un prix). */
export function saisieDeCentimes(c: number): string {
  return `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;
}

/** Réglages de la réserve : tout éteint par défaut. Un seul champ est envoyé à la fois. */
export function ReglagesReserve({ reglages, formulaireOuvert, enregistrer }: Props) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [parSemaine, setParSemaine] = useState(String(reglages.parSemaine));
  const [limite, setLimite] = useState(saisieDeCentimes(reglages.plafondVideoCentimes));

  function envoyer(champ: string, valeur: string) {
    const d = new FormData();
    d.set("champ", champ);
    d.set("valeur", valeur);
    demarrer(async () => {
      const r = await enregistrer(d);
      setMessage(r.ok ? null : r.raison);
    });
  }

  const ligne = "flex flex-col gap-2 rounded-2xl border border-trait p-4";
  const bouton = "min-h-11 rounded-full px-4 font-semibold";
  return (
    <section aria-labelledby="reserve-tutoriel" className="flex flex-col gap-3">
      <h2 id="reserve-tutoriel" className="text-lg font-semibold">
        {TEXTES_RESERVE.titre}
      </h2>

      <div className={ligne}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">{TEXTES_RESERVE.prendreSeul}</span>
          <span>{reglages.actif ? "Allumé" : "Éteint"}</span>
        </div>
        {reglages.actif && !formulaireOuvert && (
          <p role="status" className="text-sm text-texte-doux">
            {TEXTES_RESERVE.avertissementFerme}
          </p>
        )}
        <button type="button" disabled={enCours} onClick={() => envoyer("actif", reglages.actif ? "non" : "oui")} className={bouton}>
          {reglages.actif ? "Éteindre" : "Allumer"}
        </button>
      </div>

      <form
        className={ligne}
        onSubmit={(e) => {
          e.preventDefault();
          envoyer("parSemaine", parSemaine);
        }}
      >
        <label htmlFor="reserve-par-semaine" className="font-semibold">
          {TEXTES_RESERVE.parSemaine}
        </label>
        <input id="reserve-par-semaine" type="number" inputMode="numeric" min={0} max={7} step={1} value={parSemaine} onChange={(e) => setParSemaine(e.target.value)} className="min-h-11 rounded-xl border border-trait px-3" />
        <p className="text-sm text-texte-doux">{TEXTES_RESERVE.parSemaineAide}</p>
        <button type="submit" disabled={enCours} className={`${bouton} self-start`}>
          Enregistrer
        </button>
      </form>

      <div className={ligne}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">{TEXTES_RESERVE.voix}</span>
          <span>{reglages.voix ? "Allumé" : "Éteint"}</span>
        </div>
        <p className="text-sm text-texte-doux">{TEXTES_RESERVE.voixAide}</p>
        <button type="button" disabled={enCours} onClick={() => envoyer("voix", reglages.voix ? "non" : "oui")} className={bouton}>
          {reglages.voix ? "Éteindre" : "Allumer"}
        </button>
      </div>

      <form
        className={ligne}
        onSubmit={(e) => {
          e.preventDefault();
          envoyer("plafondVideo", limite);
        }}
      >
        <label htmlFor="reserve-limite" className="font-semibold">
          {TEXTES_RESERVE.limite}
        </label>
        <input id="reserve-limite" type="text" inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} className="min-h-11 rounded-xl border border-trait px-3" />
        <p className="text-sm text-texte-doux">{TEXTES_RESERVE.limiteAide}</p>
        <button type="submit" disabled={enCours} className={`${bouton} self-start`}>
          Enregistrer
        </button>
      </form>

      {message && (
        <p role="alert" className="text-sm font-semibold">
          {message}
        </p>
      )}

      <Link href="/tutoriel-outil/reserve" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
        {TEXTES_RESERVE.ouvrir}
      </Link>
    </section>
  );
}
