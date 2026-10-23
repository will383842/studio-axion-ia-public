"use client";

import { FeuilleSerie } from "@/components/generateur/FeuilleSerie";
import { useReglagesSujet, type FormatEcrivable } from "@/components/generateur/ReglagesSujet";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import type { Idee } from "@/domaine/types";
import { useState } from "react";

/** Une idée peut partir en série : pas archivée, pas encore écrite, pas déjà reliée à un sujet. */
export function ideeEcrivable(i: Idee): boolean {
  return i.etat === "nouvelle" && !i.scriptMaitreId;
}

/** Case à cocher ronde d'une idée (sélection pour « Écrire ces N idées »). */
export function CaseIdee({ cochee, onChange, texte }: { cochee: boolean; onChange: () => void; texte: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={cochee}
      aria-label={`Choisir « ${texte} »`}
      onClick={onChange}
      className="grid size-11 shrink-0 place-items-center rounded-full"
    >
      <span className={`grid size-6 place-items-center rounded-full border-2 transition-colors ${cochee ? "border-orange bg-orange text-sur-orange" : "border-trait-fort"}`}>
        {cochee && (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

/** Barre « Écrire ces N idées » et sa feuille de confirmation (B7). */
export function BarreSerieIdees({ idees, formats, onFini }: { idees: Idee[]; formats: FormatEcrivable[]; onFini: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  const reglages = useReglagesSujet(formats);
  if (!idees.length) return null;
  const n = idees.length;
  return (
    <>
      {/* Pendant la sélection, elle recouvre « Nouveau sujet » (même place sur téléphone). */}
      <BarreActionCollee
        className="z-40 bg-fond"
        secondaire={
          <Bouton variante="fantome" onClick={onFini}>
            Annuler
          </Bouton>
        }
      >
        <Bouton icone="ecrire" taille="lg" onClick={() => setOuverte(true)}>
          {n > 1 ? `Écrire ces ${n} idées` : "Écrire cette idée"}
        </Bouton>
      </BarreActionCollee>
      <FeuilleSerie ouverte={ouverte} onOuverteChange={setOuverte} idees={idees.map((i) => ({ texte: i.texte, ideeId: i.id }))} reglages={reglages} onLancee={onFini} />
    </>
  );
}
