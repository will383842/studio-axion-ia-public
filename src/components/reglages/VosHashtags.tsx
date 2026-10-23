"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirFamilleAction } from "@/app/(studio)/reglages/actions";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { notifier } from "@/components/ui/Toast";
import type { IdReseau } from "@/domaine/types";
import { listerReseaux } from "@/reseaux";
import { formeMotDiese, type FamillesHashtags } from "@/reseaux/hashtags";

/**
 * « Vos hashtags » (équipe 7) : la famille de mots-dièse de chaque réseau. Le studio et Claude n'en choisissent pas
 * d'autres ; TikTok est prérempli. Un réseau vide reste libre.
 */
export function VosHashtags({ initiales }: { initiales: FamillesHashtags }) {
  return (
    <div className="mt-5 border-t border-trait pt-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-texte">
        <Icone nom="diese" size={16} className="text-orange-vif" />
        Vos hashtags
      </p>
      <p className="mt-1 text-xs text-texte-faible">Le studio pioche seulement dedans.</p>
      <ul className="mt-3 divide-y divide-trait">
        {listerReseaux().map((r) => (
          <LigneReseau key={r.id} reseau={r.id} nom={r.nom} initiale={initiales[r.id] ?? []} />
        ))}
      </ul>
    </div>
  );
}

function LigneReseau({ reseau, nom, initiale }: { reseau: IdReseau; nom: string; initiale: string[] }) {
  const router = useRouter();
  const [liste, setListe] = useState(initiale);
  const [saisie, setSaisie] = useState("");
  const [enCours, demarrer] = useTransition();

  function enregistrer(suite: string[]) {
    const avant = liste;
    setListe(suite);
    demarrer(async () => {
      const r = await definirFamilleAction(reseau, suite);
      if (!r.ok) {
        setListe(avant);
        notifier.erreur(r.message);
        return;
      }
      router.refresh();
    });
  }

  function ajouter() {
    const m = formeMotDiese(saisie);
    if (!m) {
      if (saisie.trim()) notifier.erreur("Lettres et chiffres seulement, sans espace.");
      return;
    }
    setSaisie("");
    if (!liste.some((x) => x.toLowerCase() === m.toLowerCase())) enregistrer([...liste, m]);
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
      <span className="flex w-36 shrink-0 items-center gap-2 text-sm font-semibold text-texte">
        <LogoReseau reseau={reseau} taille="sm" />
        {nom}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {liste.length === 0 && <span className="text-xs text-texte-faible">Libre</span>}
        {liste.map((m) => (
          <span key={m} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-trait bg-surface-2 py-1 pl-3 pr-1 text-sm text-texte">
            {m}
            <button type="button" aria-label={`Retirer ${m}`} disabled={enCours} onClick={() => enregistrer(liste.filter((x) => x !== m))} className="grid size-7 place-items-center rounded-full text-texte-faible hover:bg-surface-1 hover:text-texte">
              <Icone nom="fermer" size={13} />
            </button>
          </span>
        ))}
        <form
          className="inline-flex min-h-9 items-center rounded-full border border-dashed border-trait-fort pl-3 pr-1 focus-within:border-orange"
          onSubmit={(e) => {
            e.preventDefault();
            ajouter();
          }}
        >
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="#ajouter" aria-label={`Ajouter un hashtag ${nom}`} className="w-24 bg-transparent text-sm text-texte outline-none placeholder:text-texte-faible" />
          <button type="submit" aria-label="Ajouter" disabled={enCours} className="grid size-7 place-items-center rounded-full text-orange-vif hover:bg-orange-doux">
            <Icone nom="plus" size={14} />
          </button>
        </form>
      </div>
    </li>
  );
}
