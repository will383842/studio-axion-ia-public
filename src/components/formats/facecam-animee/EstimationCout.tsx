"use client";

/** FACE CAMÉRA ANIMÉE · estimation honnête du coût, au-dessus de « Animer ma vidéo » (pire cas et plafond Claude par vidéo). */
import { useEffect, useMemo, useState } from "react";
import { estimerFacecamAnimeeAction } from "@/app/(studio)/face-camera-animee/actions";
import { Icone } from "@/components/ui/Icone";
import type { EstimationFA, PriseAEstimerFA } from "@/services/facecam-animee";
import { lignesCout } from "./cout";

export function EstimationCout({ prises }: { prises: PriseAEstimerFA[] }) {
  const cle = JSON.stringify(prises);
  const [e, setE] = useState<{ cle: string; estimation: EstimationFA } | null>(null);
  useEffect(() => {
    if (!prises.length) return;
    let actif = true;
    const attente = setTimeout(() => {
      void estimerFacecamAnimeeAction(JSON.parse(cle) as PriseAEstimerFA[]).then((r) => {
        if (actif && r.ok) setE({ cle, estimation: r.donnees });
      });
    }, 350);
    return () => {
      actif = false;
      clearTimeout(attente);
    };
  }, [cle, prises.length]);
  const lignes = useMemo(() => (e && e.cle === cle ? lignesCout(e.estimation) : null), [e, cle]);
  if (!prises.length || !lignes) return null;
  return (
    <section aria-label="Coût estimé" className="space-y-1.5 rounded-2xl border border-trait bg-surface-2 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-texte">
        <Icone nom="euro" size={16} className="shrink-0 text-orange-vif" />
        {lignes.titre}
      </p>
      <p className="break-words text-texte">{lignes.pireCas}</p>
      <p className="break-words text-texte-doux">{lignes.plafond}</p>
      <p className="break-words text-texte-doux">{lignes.autres}</p>
    </section>
  );
}
