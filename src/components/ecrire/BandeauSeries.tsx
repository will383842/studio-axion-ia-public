"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { creerSerieAction } from "@/app/(studio)/ecrire/actions-series";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/**
 * Écrire › Séries (équipe 7, refonte R7) : un bouton « Séries » rangé avec les filtres ; il ouvre la liste des séries.
 * Toucher une série filtre les sujets, la retoucher enlève le filtre. « Nouvelle série » : un nom court, lisible à l'écran.
 */
export function BandeauSeries({ series, active }: { series: { id: string; nom: string; episodes: number }[]; active?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [panneau, setPanneau] = useState(false);
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

  const choisieNom = series.find((s) => s.id === active)?.nom;
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={panneau}
        aria-controls="panneau-series"
        onClick={() => setPanneau((x) => !x)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
          active ? "border-texte bg-texte text-fond" : "border-trait-fort bg-surface-1 text-texte hover:bg-surface-2",
        )}
      >
        <Icone nom="calques" size={16} />
        Séries
        {choisieNom ? <span className="max-w-32 truncate font-normal">· {choisieNom}</span> : series.length > 0 && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] tabular-nums text-texte-doux">{series.length}</span>}
      </button>
      {panneau && (
        <div id="panneau-series" className="mt-3 flex w-full min-w-72 flex-col gap-2 rounded-carte border border-trait bg-surface-1 p-4 shadow-carte sm:absolute sm:left-0 sm:z-20 sm:w-80">
          <p className="text-sm text-texte-doux">Touchez une série pour ne voir que ses sujets.</p>
          {series.length === 0 && <p className="text-sm text-texte-faible">Aucune série pour l&apos;instant.</p>}
          <ul className="flex flex-col gap-1.5">
            {series.map((s) => {
              const choisie = s.id === active;
              return (
                <li key={s.id}>
                  <Link
                    href={choisie ? "/ecrire" : `/ecrire?serie=${encodeURIComponent(s.id)}`}
                    scroll={false}
                    aria-current={choisie ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 rounded-champ border px-3 py-2 transition-colors",
                      choisie ? "border-accent bg-accent-doux" : "border-trait bg-surface-1 hover:border-trait-fort",
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-semibold leading-tight text-texte">{s.nom}</span>
                    <span className="shrink-0 text-xs text-texte-faible">{choisie ? "Retirer le filtre" : s.episodes ? `${s.episodes} épisode${s.episodes > 1 ? "s" : ""}` : "Aucun épisode"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {ouvert ? (
            <form
              className="flex min-h-12 items-center gap-1 rounded-champ border border-accent bg-surface-1 p-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                creer();
              }}
            >
              <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="L'IA qui fait gagner 1 h" aria-label="Nom de la série" className="min-w-0 flex-1 bg-transparent px-1 text-sm text-texte outline-none placeholder:text-texte-faible" />
              <button type="submit" disabled={enCours || nom.trim().length < 2} aria-label="Créer la série" className="grid size-11 place-items-center rounded-full bg-accent text-sur-accent disabled:opacity-40">
                <Icone nom="coche" size={16} />
              </button>
              <button type="button" aria-label="Annuler" onClick={() => setOuvert(false)} className="grid size-11 place-items-center rounded-full text-texte-faible hover:text-texte">
                <Icone nom="fermer" size={15} />
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setOuvert(true)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-champ border border-dashed border-trait-fort text-sm font-semibold text-texte-doux hover:border-texte hover:text-texte">
              <Icone nom="plus" size={16} />
              Nouvelle série
            </button>
          )}
        </div>
      )}
    </div>
  );
}
