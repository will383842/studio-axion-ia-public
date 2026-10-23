"use client";

/** Une carte par cas validé : titre, promesse, « Chez nous » ou « Notre offre », l'offre et sa nature, « Vrais écrans » s'il y en a. */
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import type { VueCas } from "./vue";

export function CarteCas({ cas, onOuvrir }: { cas: VueCas; onOuvrir: () => void }) {
  return (
    <Carte as="li" interactive className="list-none">
      <button type="button" onClick={onOuvrir} className="flex w-full min-h-11 flex-col items-start gap-2 text-left">
        <span className="flex flex-wrap gap-1.5">
          <Pastille ton={cas.posture === "Chez nous" ? "sauge" : "orange"}>{cas.posture}</Pastille>
          <Pastille>{cas.offreLibelle}</Pastille>
          {cas.nature && <Pastille>{cas.nature}</Pastille>}
          {cas.vraisEcrans && <Pastille ton="ambre">Vrais écrans</Pastille>}
        </span>
        <span className="text-[17px] font-semibold text-texte">{cas.titre}</span>
        <span className="text-[15px] text-texte-doux">{cas.promesse}</span>
      </button>
    </Carte>
  );
}
