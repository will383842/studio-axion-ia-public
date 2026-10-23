"use client";

import Image from "next/image";
import { useTransition } from "react";
import { remettreElementAction } from "@/app/(studio)/bibliotheque/actions";
import { Bouton, Icone, notifier } from "@/components/ui";
import { LIBELLES_RETRAIT } from "@/domaine/libelles";

type ElementArchive = { id: string; type: string; nom: string; vignette: string | null };

/**
 * Éléments archivés : jamais effacés, restaurés en un geste (ordre permanent « rien n'est purgé »).
 * Sert à la Bibliothèque (par défaut) et aux modèles (`restaurer` fourni).
 */
export function ElementsRanges({
  elements,
  restaurer,
}: {
  elements: ElementArchive[];
  restaurer?: (e: ElementArchive) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [enCours, demarrer] = useTransition();
  if (!elements.length) return null;

  function remettre(e: ElementArchive) {
    demarrer(async () => {
      const r = restaurer ? await restaurer(e) : await remettreElementAction(e.id, e.type);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`« ${e.nom} » restauré`);
    });
  }

  return (
    <details className="group mt-6 rounded-carte border border-trait bg-surface-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-texte-doux">
        <Icone nom="archive" size={16} />
        {LIBELLES_RETRAIT.liste} ({elements.length})
        <Icone nom="chevron-bas" size={16} className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <ul className="grid gap-1 px-2 pb-2">
        {elements.map((e) => (
          <li key={e.id} className="flex min-h-12 items-center gap-3 rounded-xl px-2">
            <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-2">{e.vignette && /\.(jpe?g|png|webp|avif|gif)$/i.test(e.vignette) && <Image src={e.vignette} alt="" fill sizes="36px" className="object-cover" />}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-texte">{e.nom}</span>
            <Bouton variante="fantome" icone="actualiser" onClick={() => remettre(e)} disabled={enCours}>
              {LIBELLES_RETRAIT.retour}
            </Bouton>
          </li>
        ))}
      </ul>
    </details>
  );
}
