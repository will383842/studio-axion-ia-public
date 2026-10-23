"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { suiviSerieAction } from "@/app/(studio)/ecrire/serie/actions";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import type { EtatElementSerie, SuiviSerie as Suivi } from "@/services/serie-ecriture";

const ETATS: Record<EtatElementSerie, { icone: NomIcone; libelle: string; ton: string }> = {
  ecrit: { icone: "coche", libelle: "Écrit", ton: "text-sauge" },
  "en-cours": { icone: "chargement", libelle: "En écriture", ton: "text-orange-vif" },
  attente: { icone: "sablier", libelle: "En attente de budget", ton: "text-ambre" },
  "a-completer": { icone: "attention", libelle: "À compléter", ton: "text-ambre" },
  arretee: { icone: "attention", libelle: "Arrêtée : à reprendre", ton: "text-ambre" },
  reste: { icone: "idee", libelle: "Gardée en idée", ton: "text-texte-faible" },
  refuse: { icone: "attention", libelle: "Pas partie", ton: "text-texte-faible" },
};

/** Suivi de la dernière série : « 3 sur 10 écrits », mis à jour seul tant qu'une écriture est en cours. */
export function SuiviSerie({ initial }: { initial: Suivi | null }) {
  const [suivi, setSuivi] = useState(initial);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!suivi || suivi.termine) return;
    const t = setInterval(() => {
      void suiviSerieAction(suivi.id).then((r) => r.ok && r.donnees && setSuivi(r.donnees));
    }, 5_000);
    return () => clearInterval(t);
  }, [suivi]);

  if (!suivi || !suivi.total) return null;
  const pct = Math.round((suivi.ecrits / suivi.total) * 100);
  const fini = suivi.ecrits === suivi.total;
  const icone: NomIcone = fini ? "coche" : suivi.termine ? "attention" : "chargement";
  const details = [suivi.aCompleter ? `${suivi.aCompleter} à compléter` : "", suivi.arretees ? `${suivi.arretees} arrêtée${suivi.arretees > 1 ? "s" : ""} : à reprendre` : "", suivi.enAttente ? `${suivi.enAttente} en attente de budget` : ""].filter(Boolean).join(" · ");
  return (
    <section className="rounded-carte border border-trait bg-surface-1 p-4" aria-label="Série en cours">
      <button type="button" onClick={() => setOuvert((x) => !x)} aria-expanded={ouvert} className="flex w-full items-center gap-3 text-left">
        <Icone nom={icone} size={18} className={cn("shrink-0", fini ? "text-sauge" : suivi.termine ? "text-ambre" : "animate-spin text-orange-vif")} />
        <span className="flex-1" role="status">
          <span className="block text-[15px] font-semibold text-texte">
            {suivi.ecrits} sur {suivi.total} écrit{suivi.ecrits > 1 ? "s" : ""}
          </span>
          {details && <span className="block text-xs text-texte-faible">{details}</span>}
        </span>
        <Icone nom="chevron-bas" size={16} className={cn("text-texte-faible transition-transform", ouvert && "rotate-180")} />
      </button>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={suivi.total} aria-valuenow={suivi.ecrits} aria-label="Idées écrites">
        <div className="h-full rounded-full bg-orange transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {ouvert && (
        <ul className="mt-3 space-y-1">
          {suivi.elements.map((e, i) => {
            const etat = ETATS[e.etat];
            const contenu = (
              <>
                <Icone nom={etat.icone} size={15} className={cn("shrink-0", etat.ton, e.etat === "en-cours" && "animate-spin")} />
                <span className="min-w-0 flex-1 truncate text-texte">{e.texte}</span>
                <span className="shrink-0 text-xs text-texte-faible">{etat.libelle}</span>
              </>
            );
            return (
              <li key={`${e.scriptMaitreId ?? "idee"}-${i}`}>
                {e.scriptMaitreId ? (
                  <Link href={`/ecrire/sujets/${e.scriptMaitreId}`} className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm hover:bg-surface-2">
                    {contenu}
                  </Link>
                ) : (
                  <div className="flex min-h-11 items-center gap-2 px-1 text-sm">{contenu}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
