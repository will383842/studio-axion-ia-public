"use client";

import { useState } from "react";
import type { SanteComptes } from "@/services/sante-comptes";

const ETIQUETTE = { ok: "En règle", bientot: "À reconnecter bientôt", expire: "Expiré", deconnecte: "Non relié" } as const;

/**
 * L8-05 · Carte « Santé des comptes » (lecture seule). Le bouton « Reconnecter » EXPLIQUE le geste : il ne reconnecte rien lui-même.
 * Les données viennent du parent (déjà lues) ; aucun appel ici. Pages claires, lisible à 375 px, pas de montant, un seul bouton orange par écran (ici : aucun).
 */
export function CarteSanteComptes({ sante }: { sante: SanteComptes }) {
  const [explique, setExplique] = useState(false);
  return (
    <section aria-labelledby="sante-comptes-titre" className="rounded-carte border border-trait border-l-4 border-l-[#a9d6f5] bg-surface-1 p-4 shadow-carte sm:p-5">
      <h2 id="sante-comptes-titre" className="text-base font-semibold">
        Santé des comptes
      </h2>
      {sante.lecture === "inconnue" ? (
        <p className="mt-2 text-sm text-texte-faible">L&apos;état de vos comptes est inconnu pour le moment. Réessayez plus tard.</p>
      ) : sante.comptes.length === 0 ? (
        <p className="mt-2 text-sm text-texte-faible">Aucun compte relié pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {sante.comptes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-medium">
                  {c.libelle} · <span>{ETIQUETTE[c.etat]}</span>
                </p>
                <p className="text-sm text-texte-faible">{c.message}</p>
              </div>
              {c.etat !== "ok" && (
                <button type="button" onClick={() => setExplique((v) => !v)} aria-expanded={explique} className="rounded-xl border border-trait px-3 py-2 text-sm font-medium">
                  Reconnecter
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {explique && (
        <p role="note" className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
          La reconnexion se fait chez le diffuseur : ouvrez votre espace chez lui, choisissez le compte puis « Reconnecter » et acceptez l&apos;accès demandé par le réseau. Revenez ensuite ici : l&apos;état se met à jour tout seul.
        </p>
      )}
    </section>
  );
}
