import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { BrouillonsRecentsTableau } from "@/components/formats/tableau-anime/BrouillonsRecents";
import { NouvelleVideoTableau } from "@/components/formats/tableau-anime/NouvelleVideoTableau";
import { EtatVide } from "@/components/ui/EtatVide";
import { ecranCreationTableau } from "@/services/tableau-creation";

export const metadata: Metadata = { title: "Nouvelle vidéo · Tableau animé" };
export const dynamic = "force-dynamic";

/**
 * NOUVELLE VIDÉO · TABLEAU ANIMÉ : script, découpage en scènes, relecture, fabrication. `?brouillon=<videoId>` reprend
 * un brouillon (son travail de fond en cours ou terminé compris) ; « Vos brouillons » liste les récents. Format
 * masqué : un message simple, rien d'autre n'est lu.
 */
export default async function PageNouvelleTableau({ searchParams }: { searchParams?: Promise<{ brouillon?: string }> }) {
  const sp = (await searchParams) ?? {};
  const ecran = await ecranCreationTableau(sp.brouillon);
  if (!ecran.visible) return <EtatVide icone="pinceau" titre="Pas encore ouvert" phrase="Le tableau animé arrive bientôt." />;
  return (
    <GabaritCreation
      entete={{ titre: "Tableau animé", sousTitre: "Votre texte, écrit et dessiné au trait." }}
      recents={<BrouillonsRecentsTableau recents={ecran.recents} courant={ecran.brouillon?.videoId} />}
    >
      <NouvelleVideoTableau key={ecran.brouillon ? `${ecran.brouillon.videoId}-${ecran.brouillon.versions}-${ecran.brouillon.tache?.id ?? ""}-${ecran.brouillon.tache?.statut ?? ""}` : "neuf"} ecran={ecran} />
    </GabaritCreation>
  );
}
