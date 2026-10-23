"use client";

/**
 * Sujet déjà traité (lot L5), étape Sujet : les vidéos ou sujets qui le portent déjà, puis deux choix. « Choisir un autre
 * sujet » : une suggestion remplit le sujet. « Refaire quand même » : l'écriture repart avec le jeton reçu. Très peu de
 * texte, vouvoiement, mêmes composants que l'écran voisin.
 */
import Link from "next/link";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icone";
import { formateurDate } from "@/lib/intl";
import type { RefusSujetDejaTraite } from "@/services/sujet-central-controle";
import { phraseDuRefus } from "./sujet-deja-traite";

export function PanneauSujetCentralDejaTraite({ refus, chargement, onAutreSujet, onRefaire }: { refus: RefusSujetDejaTraite; chargement: boolean; onAutreSujet: (titre: string) => void; onRefaire: () => void }) {
  return (
    <Carte className="space-y-3 border-ambre/50" role="alert">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ambre">
        <Icone nom="attention" size={14} />
        Déjà traité
      </p>
      <p className="text-[15px] font-semibold text-texte">{phraseDuRefus(refus)}</p>
      <ul className="space-y-1">
        {refus.precedents.slice(0, 3).map((p) => (
          <li key={p.videoId ?? p.sujetId ?? p.lien}>
            <Link href={p.lien} className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-texte hover:text-orange-vif">
              {p.titre} · le {formateurDate("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(p.le))}
              <Icone nom="chevron-droite" size={14} className="text-texte-faible" />
            </Link>
          </li>
        ))}
      </ul>
      {refus.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-texte-doux">Choisir un autre sujet</p>
          <div className="flex flex-wrap gap-2">
            {refus.suggestions.map((s) => (
              <Bouton key={s.code ?? s.titre} variante="contour" disabled={chargement} onClick={() => onAutreSujet(s.titre)}>
                {s.titre}
              </Bouton>
            ))}
          </div>
        </div>
      )}
      <Bouton variante="contour" pleineLargeur chargement={chargement} onClick={onRefaire}>
        Refaire quand même
      </Bouton>
    </Carte>
  );
}
