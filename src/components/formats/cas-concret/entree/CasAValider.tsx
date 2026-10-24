"use client";

import { useRef } from "react";

/**
 * Le groupe « À valider (n) » de l'onglet À faire (visible, plus replié) : chaque cas montre son titre (qui ouvre la feuille
 * « Votre vidéo » en essai), son sujet, ses pastilles (offre, secteur, taille), sa promesse et ses faits avec leur source.
 * `total` : le nombre de cas du groupe avant la pagination (absent : ceux montrés).
 */
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { libelleSecteur } from "../stock/filtres-stock";
import { BoutonRetirerCas } from "./BoutonRetirerCas";
import { LienMonScript } from "./LienMonScript";
import { MENTION_AJOUTE, type VueCas } from "./vue";

export function CasAValider({ cas, occupe, onValider, onEssai, total }: { cas: readonly VueCas[]; occupe: boolean; onValider: (c: VueCas) => void; onEssai: (c: VueCas) => void; total?: number }) {
  const titre = useRef<HTMLHeadingElement>(null);
  // Après un retrait réussi, le focus va sur le titre du groupe (ou, si le groupe se vide, sur le titre de la page).
  const apresRetrait = () => {
    const cible = titre.current ?? document.querySelector<HTMLElement>("h1");
    if (!cible) return;
    if (!cible.hasAttribute("tabindex")) cible.setAttribute("tabindex", "-1");
    cible.focus();
  };
  if (!cas.length) return null;
  return (
    <section aria-labelledby="titre-a-valider" className="space-y-3">
      <h2 id="titre-a-valider" ref={titre} className="text-[15px] font-semibold text-texte">À valider ({total ?? cas.length})</h2>
      <ul className="space-y-3 p-0">
        {cas.map((c) => (
          <Carte as="li" key={c.id} className="list-none bg-surface-2">
            <span className="flex flex-wrap gap-1.5">
              <Pastille>{c.offreLibelle}</Pastille>
              {c.ajoute && <Pastille ton="sauge">{MENTION_AJOUTE}</Pastille>}
              {c.stock?.secteur && <Pastille>{libelleSecteur(c.stock.secteur)}</Pastille>}
              {c.stock?.taille && <Pastille>{c.stock.taille}</Pastille>}
            </span>
            <button type="button" aria-label={`Ouvrir l'essai : ${c.titre}`} onClick={() => onEssai(c)} className="mt-2 flex min-h-11 w-full items-center text-left text-[17px] font-semibold text-texte focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif">
              {c.titre}
            </button>
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
              <LienMonScript cas={c} />
              <BoutonRetirerCas casId={c.id} titre={c.titre} desactive={occupe} onRetire={apresRetrait} />
            </div>
          </Carte>
        ))}
      </ul>
    </section>
  );
}
