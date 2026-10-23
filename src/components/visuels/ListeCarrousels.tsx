import type { VueCarrouselCarte } from "@/domaine/visuels/contrats";
import { EtatVide } from "@/components/ui/EtatVide";
import { CarteCarrousel } from "./CarteCarrousel";

export function ListeCarrousels({ carrousels, phraseVide }: { carrousels: VueCarrouselCarte[]; phraseVide?: string }) {
  if (carrousels.length === 0) {
    return <EtatVide compact icone="images" titre="Aucun carrousel" phrase={phraseVide ?? "Ici, vous verrez vos carrousels dès qu'il y en aura."} />;
  }
  return (
    <ul className="flex flex-col gap-3">
      {carrousels.map((c) => (
        <li key={c.id}>
          <CarteCarrousel carrousel={c} />
        </li>
      ))}
    </ul>
  );
}
