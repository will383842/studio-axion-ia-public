"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Pastille } from "@/components/ui/Pastille";
import type { EtatSante, SanteComptes } from "@/services/sante-comptes";

const ETIQUETTE: Record<EtatSante, { texte: string; ton: "sauge" | "ambre" | "brique" }> = {
  ok: { texte: "En règle", ton: "sauge" },
  bientot: { texte: "À reconnecter bientôt", ton: "ambre" },
  expire: { texte: "Expiré", ton: "brique" },
  deconnecte: { texte: "Non relié", ton: "brique" },
};

/**
 * L8-05 · Carte « Santé des comptes » (lecture seule). Le bouton « Reconnecter » EXPLIQUE le geste : il ne reconnecte rien lui-même.
 * Les données viennent du parent (déjà lues) ; aucun appel ici. Pages claires, lisible à 375 px, pas de montant, aucun bouton orange.
 * `ouverts` : comptes dont l'aide est déjà affichée (rendu statique, captures).
 */
export function CarteSanteComptes({ sante, ouverts = [] }: { sante: SanteComptes; ouverts?: readonly string[] }) {
  const [explique, setExplique] = useState<ReadonlySet<string>>(new Set(ouverts));
  const basculer = (id: string) =>
    setExplique((avant) => {
      const apres = new Set(avant);
      if (!apres.delete(id)) apres.add(id);
      return apres;
    });
  return (
    <section aria-labelledby="sante-comptes-titre" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte sm:p-5">
      <h2 id="sante-comptes-titre" className="text-base font-semibold">
        Santé des comptes
      </h2>
      {sante.lecture === "inconnue" ? (
        <p className="mt-2 text-sm text-texte-faible">L&apos;état de vos comptes est inconnu pour le moment. Réessayez plus tard.</p>
      ) : sante.comptes.length === 0 ? (
        <p className="mt-2 text-sm text-texte-faible">Aucun compte relié pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {sante.comptes.map((c) => {
            const ouvert = explique.has(c.id);
            const idAide = `aide-reconnexion-${c.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
            return (
              <li key={c.id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {c.libelle}
                      <Pastille ton={ETIQUETTE[c.etat].ton}>{ETIQUETTE[c.etat].texte}</Pastille>
                    </p>
                    <p className="text-sm text-texte-faible">{c.message}</p>
                  </div>
                  {c.etat !== "ok" && (
                    <Bouton variante="contour" onClick={() => basculer(c.id)} aria-expanded={ouvert} aria-controls={idAide}>
                      Reconnecter
                    </Bouton>
                  )}
                </div>
                <p id={idAide} role="note" hidden={!ouvert} className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
                  La reconnexion se fait chez le diffuseur, par vous : reconnectez ce compte là-bas et acceptez l&apos;accès demandé par le réseau. Rechargez ensuite cette page pour revoir l&apos;état.
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
