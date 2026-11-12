import type { Metadata } from "next";
import { CadrePublic, LogoPublic, MessagePublic } from "@/components/annexes/PagePublique";
import { Icone } from "@/components/ui/Icone";

export const metadata: Metadata = { title: "Lien expiré", robots: { index: false, follow: false } };

/**
 * Lien privé expiré, révoqué ou inconnu (B.8 #10). Page soignée aux couleurs du site public (M7, décision de
 * Williams du 12/11), une phrase, aucun bouton vers la console (le visiteur n'y a pas accès).
 */
export default function LienExpire() {
  return (
    <CadrePublic>
      <LogoPublic className="self-start sm:self-center" />
      <MessagePublic icone={<Icone nom="sablier" size={22} />} titre="Ce lien n'est plus actif" phrase="Demandez un nouveau lien à la personne qui vous l'a envoyé." />
    </CadrePublic>
  );
}
