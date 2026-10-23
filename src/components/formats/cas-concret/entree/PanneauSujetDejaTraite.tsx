"use client";

/**
 * Cas déjà traité (lot L3) : les vidéos qui le portent déjà, puis les trois choix, AVANT le prix. « Choisir un autre
 * sujet » : les suggestions ouvrent l'autre cas. « Nouvel angle » : un nouveau script est écrit (option « Nouveau
 * script »). « Refaire quand même » : le script validé est rejoué. Très peu de texte, vouvoiement.
 */
import Link from "next/link";
import { Bouton } from "@/components/ui/Bouton";
import type { DejaTraiteCas } from "@/services/cas-concret";
import type { ChoixSujet } from "./sujet-deja-traite";

export function PanneauSujetDejaTraite({ dejaTraite, onChoisir, onAutreCas }: { dejaTraite: DejaTraiteCas; onChoisir: (c: ChoixSujet) => void; onAutreCas?: (casId: string) => void }) {
  const jeton = dejaTraite.jeton;
  return (
    <section aria-label="Cas déjà traité" role="alert" className="space-y-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
      <p className="font-semibold">{dejaTraite.phrase}</p>
      <ul className="space-y-1 text-sm">
        {dejaTraite.precedents.slice(0, 5).map((p) => (
          <li key={p.videoId ?? p.sujetId ?? p.lien}>
            <Link href={p.lien} className="underline">
              {p.titre}
            </Link>{" "}
            <span className="text-texte-doux">le {new Date(p.le).toLocaleDateString("fr-FR")}</span>
          </li>
        ))}
      </ul>
      {dejaTraite.suggestions.length > 0 && onAutreCas && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-texte-doux">Choisir un autre sujet</p>
          <div className="flex flex-wrap gap-2">
            {dejaTraite.suggestions.map((s) => (
              <Bouton key={s.casId ?? s.code ?? s.titre} variante="secondaire" disabled={!s.casId} onClick={() => s.casId && onAutreCas(s.casId)}>
                {s.titre}
              </Bouton>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Bouton variante="secondaire" onClick={() => onChoisir({ choix: "nouvel-angle", jeton })}>
          Nouvel angle
        </Bouton>
        <Bouton variante="secondaire" onClick={() => onChoisir({ choix: "refaire", jeton })}>
          Refaire quand même
        </Bouton>
      </div>
    </section>
  );
}
