"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { creerSerieAction } from "@/app/(studio)/ecrire/actions-series";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/**
 * Écrire › Séries (équipe 7) : les séries en cartes défilantes ; toucher une série filtre les sujets, la retoucher
 * enlève le filtre. « Nouvelle série » : un nom court, lisible à l'écran.
 */
export function BandeauSeries({ series, active }: { series: { id: string; nom: string; episodes: number }[]; active?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, demarrer] = useTransition();

  function creer() {
    demarrer(async () => {
      const r = await creerSerieAction(nom);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(`Série « ${r.donnees.nom} » créée`);
      setNom("");
      setOuvert(false);
      router.refresh();
    });
  }

  return (
    <section aria-label="Séries" className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-texte-doux">
          <Icone nom="calques" size={15} />
          Séries
        </p>
      </div>
      <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {series.map((s) => {
          const choisie = s.id === active;
          return (
            <Link
              key={s.id}
              href={choisie ? "/ecrire" : `/ecrire?serie=${encodeURIComponent(s.id)}`}
              scroll={false}
              aria-current={choisie ? "true" : undefined}
              className={cn(
                "flex min-h-16 w-44 shrink-0 flex-col justify-between rounded-carte border p-3 transition-colors",
                choisie ? "border-orange bg-orange-doux" : "border-trait bg-surface-1 hover:border-trait-fort",
              )}
            >
              <span className="line-clamp-2 text-sm font-semibold leading-tight text-texte">{s.nom}</span>
              <span className="text-xs text-texte-faible">{s.episodes ? `${s.episodes} épisode${s.episodes > 1 ? "s" : ""}` : "Aucun épisode"}</span>
            </Link>
          );
        })}
        {ouvert ? (
          <form
            className="flex min-h-16 w-64 shrink-0 items-center gap-1 rounded-carte border border-orange bg-surface-1 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              creer();
            }}
          >
            <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="L'IA qui fait gagner 1 h" aria-label="Nom de la série" className="min-w-0 flex-1 bg-transparent px-1 text-sm text-texte outline-none placeholder:text-texte-faible" />
            <button type="submit" disabled={enCours || nom.trim().length < 2} aria-label="Créer la série" className="grid size-10 place-items-center rounded-full bg-orange text-sur-orange disabled:opacity-40">
              <Icone nom="coche" size={16} />
            </button>
            <button type="button" aria-label="Annuler" onClick={() => setOuvert(false)} className="grid size-10 place-items-center rounded-full text-texte-faible hover:text-texte">
              <Icone nom="fermer" size={15} />
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setOuvert(true)} className="flex min-h-16 w-36 shrink-0 items-center justify-center gap-1.5 rounded-carte border border-dashed border-trait-fort text-sm font-semibold text-texte-doux hover:border-orange hover:text-texte">
            <Icone nom="plus" size={16} />
            Nouvelle série
          </button>
        )}
      </div>
    </section>
  );
}
