"use client";

/** Groupe replié « À valider (n) » : chaque cas montre sa promesse et ses faits avec leur source. */
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import type { VueCas } from "./vue";

export function CasAValider({ cas, occupe, onValider, onEssai }: { cas: readonly VueCas[]; occupe: boolean; onValider: (c: VueCas) => void; onEssai: (c: VueCas) => void }) {
  if (!cas.length) return null;
  return (
    <details className="group rounded-carte border border-trait bg-surface-1 p-4">
      <summary className="min-h-11 cursor-pointer list-none text-[15px] font-semibold text-texte">À valider ({cas.length})</summary>
      <ul className="mt-3 space-y-3">
        {cas.map((c) => (
          <Carte as="li" key={c.id} className="list-none bg-surface-2">
            <p className="text-[17px] font-semibold text-texte">{c.titre}</p>
            {c.recit && <p className="mt-1 text-[15px] text-texte">{c.recit.sujet}</p>}
            <p className="mt-1 text-[15px] text-texte-doux">{c.promesse}</p>
            {c.faits.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-texte-doux">
                {c.faits.map((f) => (
                  <li key={f.phrase}>
                    {f.phrase} <span className="text-texte-faible">({f.source})</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Bouton disabled={occupe} onClick={() => onValider(c)}>
                Je valide ce cas
              </Bouton>
              <Bouton variante="secondaire" disabled={occupe} onClick={() => onEssai(c)}>
                Fabriquer un essai
              </Bouton>
            </div>
          </Carte>
        ))}
      </ul>
    </details>
  );
}
