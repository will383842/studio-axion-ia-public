"use client";

import Link from "next/link";
import { useState } from "react";
import { BarreActionCollee, Bouton, FeuilleBas, Icone, type NomIcone } from "@/components/ui";

/** Action principale de /bibliotheque : « Ajouter » → choisir quoi (grille d'icônes) → l'écran du type, feuille d'ajout ouverte. */
export function ChoixAjout({ types }: { types: { type: string; nom: string; icone: NomIcone }[] }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setOuverte(true)}>
          Ajouter
        </Bouton>
      </BarreActionCollee>
      <FeuilleBas ouverte={ouverte} onOuverteChange={setOuverte} titre="Ajouter quoi ?">
        <div className="grid grid-cols-3 gap-2">
          {types.map((t) => (
            <Link
              key={t.type}
              href={`/bibliotheque/${t.type}?ajouter=1`}
              onClick={() => setOuverte(false)}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-carte border border-trait bg-surface-2 p-2 text-center transition-colors hover:border-orange/60"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-orange-doux text-orange-vif">
                <Icone nom={t.icone} size={20} />
              </span>
              <span className="text-sm font-semibold leading-tight text-texte">{t.nom}</span>
            </Link>
          ))}
        </div>
      </FeuilleBas>
    </>
  );
}
