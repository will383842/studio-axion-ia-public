"use client";

import { useState } from "react";
import { Bouton, Carte, Icone, notifier } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MANQUE_DEMO } from "../_demo";

/**
 * Carte « Il manque une matière » (B.6.9) : arrêt AVANT toute dépense.
 * Le type suggéré, le micro (10 s), et le réemploi d'une matière d'un toucher. Toujours une action, jamais une impasse.
 */
export function CarteManqueMatiere() {
  const [ecoute, setEcoute] = useState(false);
  const m = MANQUE_DEMO;
  return (
    <div className="space-y-4">
      <Carte lueur className="text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-ambre-doux text-ambre">
          <Icone nom="idee" size={26} />
        </span>
        <h2 className="text-2xl text-texte">Il manque une matière</h2>
        <p className="mt-2 text-[15px] text-texte-doux">
          Il faudrait <span className="font-semibold text-texte">{m.typeSuggere}</span> sur ce sujet.
        </p>

        <button
          type="button"
          aria-pressed={ecoute}
          onClick={() => setEcoute((e) => !e)}
          className={cn(
            "relative mx-auto mt-6 grid size-24 place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition-transform active:scale-95",
            ecoute && "bg-brique",
          )}
          aria-label={ecoute ? "Arrêter" : "Dicter"}
        >
          {ecoute && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brique/40" />}
          <Icone nom="micro" size={36} />
        </button>
        <p className="mt-3 text-sm font-semibold text-texte">{ecoute ? "Je vous écoute…" : "Dicter · 10 s"}</p>

        <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-sauge-doux px-3 py-1 text-xs font-bold text-sauge">
          <Icone nom="euro" size={12} />0 € dépensé
        </p>
      </Carte>

      {/* Réemploi d'une matière déjà servie */}
      <Carte>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texte-faible">
          <Icone nom="repeter" size={14} />
          Ou reprendre
        </p>
        <p className="text-[15px] font-semibold leading-snug text-texte">« {m.reemploi.texte} »</p>
        <p className="mt-1 text-xs text-texte-faible">déjà dans {m.reemploi.servie}</p>
        <Bouton variante="secondaire" pleineLargeur className="mt-4" icone="repeter" onClick={() => notifier.info("Matière reprise : l'écriture reprend.")}>
          Reprendre
        </Bouton>
      </Carte>

      <Bouton variante="fantome" pleineLargeur icone="idee" onClick={() => notifier.info("Gardé dans vos idées.")}>
        Garder en idée
      </Bouton>
    </div>
  );
}
