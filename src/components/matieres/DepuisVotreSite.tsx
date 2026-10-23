"use client";

import { useState, useTransition } from "react";
import { confirmerMatiereAction, ecarterMatiereAction } from "@/app/(studio)/ecrire/matieres/actions";
import { Bouton, Icone, notifier } from "@/components/ui";
import { dateCourte } from "@/lib/dates";
import type { VueMatiere } from "@/services/matieres";
import { cite, PastilleType } from "./visuels";

/**
 * « DEPUIS VOTRE SITE · N À RELIRE » (Source axion-ia.com, 03/10) : les matières tirées de axion-ia.com, mot pour mot,
 * gardées ou écartées d'un toucher. Écarter range la matière (jamais effacée) ; elle ne revient plus.
 */
export function DepuisVotreSite({ vues }: { vues: VueMatiere[] }) {
  const [traitees, setTraitees] = useState<Set<string>>(new Set());
  const [toutes, setToutes] = useState(false);
  const [enCours, demarrer] = useTransition();
  const restantes = vues.filter((v) => !traitees.has(v.matiere.id));
  if (!restantes.length) return null;
  const montrees = toutes ? restantes : restantes.slice(0, 3);

  function geste(id: string, garder: boolean) {
    setTraitees((t) => new Set(t).add(id));
    demarrer(async () => {
      const r = garder ? await confirmerMatiereAction(id) : await ecarterMatiereAction(id);
      if (!r.ok) {
        setTraitees((t) => {
          const n = new Set(t);
          n.delete(id);
          return n;
        });
        notifier.erreur(r.message);
      }
    });
  }

  return (
    <section aria-labelledby="depuis-site" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
      <h2 id="depuis-site" className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-texte">
        <span className="grid size-8 place-items-center rounded-xl bg-orange-doux text-orange-vif">
          <Icone nom="lien" size={16} />
        </span>
        Depuis votre site
        <span className="ml-auto rounded-full bg-ambre-doux px-2.5 py-1 text-xs font-bold text-ambre tabular-nums">{restantes.length} à relire</span>
      </h2>
      <ul className="space-y-2.5">
        {montrees.map(({ matiere: m }) => (
          <li key={m.id} className="rounded-2xl bg-surface-2 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <PastilleType type={m.type} />
              <span className="min-w-0 truncate text-xs text-texte-faible">
                {m.source.detail ?? m.source.url?.replace("https://axion-ia.com", "")} · {dateCourte(m.source.date)}
              </span>
            </div>
            <p className="text-[15px] font-semibold leading-snug text-texte">{cite(m.texte)}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Bouton variante="secondaire" icone="coche" disabled={enCours} onClick={() => geste(m.id, true)}>
                Garder
              </Bouton>
              <Bouton variante="fantome" icone="fermer" disabled={enCours} onClick={() => geste(m.id, false)}>
                Écarter
              </Bouton>
            </div>
          </li>
        ))}
      </ul>
      {restantes.length > 3 && (
        <button type="button" onClick={() => setToutes(!toutes)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold text-orange-vif hover:underline">
          {toutes ? "Moins" : `Voir les ${restantes.length}`}
          <Icone nom={toutes ? "chevron-bas" : "chevron-droite"} size={16} className={toutes ? "rotate-180" : undefined} />
        </button>
      )}
    </section>
  );
}
