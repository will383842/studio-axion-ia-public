"use client";

/** Les offres : un filtre, une pastille par offre (« Coaching » seulement quand un cas validé le porte). */
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { pastillesOffres, type FiltreOffre, type VueCas } from "./vue";

export function PastillesOffres({ valeur, onChange, cas = [] }: { valeur: FiltreOffre; onChange: (v: FiltreOffre) => void; cas?: readonly Pick<VueCas, "offre" | "valide">[] }) {
  return <SelecteurPastilles libelle="Les offres" libelleMasque defilement options={pastillesOffres(cas)} valeur={valeur} onChange={onChange} />;
}
