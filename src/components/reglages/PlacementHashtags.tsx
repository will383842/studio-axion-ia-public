"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirPlacementAction } from "@/app/(studio)/reglages/actions";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { notifier } from "@/components/ui/Toast";
import type { PlacementHashtags as Placement, ReseauPlacement } from "@/reseaux/placement-hashtags";

/** Ce que l'écran affiche d'une règle de transmission : une source datée ou la mention « hypothèse ». */
export interface InfoDiffuseur {
  nom: string;
  possible: boolean;
  /** Phrase de repli quand le premier commentaire n'est pas transmis ; absente si tout va bien. */
  repli?: string;
  source: { niveau: "sourcé"; texte: string; date: string } | { niveau: "hypothèse" };
}

export interface InfoReseauPlacement {
  reseau: ReseauPlacement;
  nom: string;
  placement: Placement;
  diffuseurs: InfoDiffuseur[];
}

const CHOIX: { valeur: Placement; libelle: string }[] = [
  { valeur: "texte", libelle: "À la fin du texte" },
  { valeur: "premier-commentaire", libelle: "Dans le premier commentaire" },
];

/** « Où placer vos hashtags » : un choix par réseau, à côté de « Vos hashtags ». */
/** « 2026-10-03 » devient « 03/10/2026 » (français simple, pas de format technique). */
function dateFrancaise(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date;
}

export function PlacementHashtags({ reseaux }: { reseaux: InfoReseauPlacement[] }) {
  return (
    <div className="mt-5 border-t border-trait pt-5" data-testid="placement-hashtags">
      <p className="text-sm font-semibold text-texte">Où placer vos hashtags</p>
      <p className="mt-1 text-xs text-texte-faible">À la fin du texte reste le réglage de départ. Si le premier commentaire n&apos;est pas possible, vos hashtags restent à la fin du texte.</p>
      <ul className="mt-3 divide-y divide-trait">
        {reseaux.map((r) => (
          <LignePlacement key={r.reseau} info={r} />
        ))}
      </ul>
    </div>
  );
}

function LignePlacement({ info }: { info: InfoReseauPlacement }) {
  const router = useRouter();
  const [valeur, setValeur] = useState(info.placement);
  const [enCours, demarrer] = useTransition();

  function choisir(v: Placement) {
    const avant = valeur;
    setValeur(v);
    demarrer(async () => {
      const r = await definirPlacementAction(info.reseau, v);
      if (!r.ok) {
        setValeur(avant);
        notifier.erreur(r.message);
        return;
      }
      router.refresh();
    });
  }

  const repliBrut = valeur === "premier-commentaire" ? info.diffuseurs.filter((d) => !d.possible && d.repli) : [];
  // Même phrase pour les deux outils : on ne l'affiche qu'une fois, sans nom d'outil.
  const repliIdentique = repliBrut.length > 1 && repliBrut.every((d) => d.repli === repliBrut[0].repli);
  const repli = repliIdentique ? [{ ...repliBrut[0], nom: "" }] : repliBrut;

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
      <span className="flex w-36 shrink-0 items-center gap-2 text-sm font-semibold text-texte">
        <LogoReseau reseau={info.reseau} taille="sm" />
        {info.nom}
      </span>
      <div className="min-w-0 flex-1">
        <div role="radiogroup" aria-label={`Placement des hashtags ${info.nom}`} className="flex flex-wrap gap-2">
          {CHOIX.map((c) => (
            <label key={c.valeur} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-trait px-3 text-sm text-texte has-[:checked]:border-orange">
              <input type="radio" name={`placement-${info.reseau}`} value={c.valeur} checked={valeur === c.valeur} disabled={enCours} onChange={() => choisir(c.valeur)} />
              {c.libelle}
            </label>
          ))}
        </div>
        {repli.map((d) => (
          <p key={d.nom} className="mt-2 text-xs text-texte-faible">
            {info.diffuseurs.length > 1 && d.nom ? `${d.nom} : ` : ""}
            {d.repli}
          </p>
        ))}
        <ul className="mt-2 space-y-0.5">
          {info.diffuseurs.map((d) => (
            <li key={d.nom} className="text-xs text-texte-faible">
              {info.diffuseurs.length > 1 ? `${d.nom} : ` : ""}
              {d.source.niveau === "sourcé" ? `Source : documentation de l'outil, vérifiée le ${dateFrancaise(d.source.date)}.` : "Hypothèse : cette règle n'a pas encore de source."}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
