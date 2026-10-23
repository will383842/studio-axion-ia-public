import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { RecentsGenerateur } from "@/components/creation/RecentsGenerateur";
import { DepotPrise } from "@/components/formats/facecam-animee/DepotPrise";
import { versRecentsFacecamAnimee } from "@/components/formats/facecam-animee/vues-gabarit";
import { dernieresFacecamAnimee, etatDepotFacecamAnimee } from "@/services/facecam-animee";

export const metadata: Metadata = { title: "Face caméra animée" };
export const dynamic = "force-dynamic";

/**
 * FACE CAMÉRA ANIMÉE v4 · déposer une ou plusieurs prises (Lot I ; essai réel du 17/10). Format EN ESSAI chez Will : dans la grille
 * « Nouvelle vidéo » et le menu latéral de l'interface connectée (pastille « Essai »), absent des idées, prix et autres listes. Les
 * dernières vidéos du format en dessous, vers leur page habituelle. Dans le gabarit de création (H3) : le bouton « Animer » est collé
 * en bas par `DepotPrise` (il porte l'état des prises), la page n'ajoute donc pas d'action.
 */
export default async function PageFacecamAnimee() {
  const [etat, dernieres] = await Promise.all([etatDepotFacecamAnimee(), dernieresFacecamAnimee()]);
  return (
    <GabaritCreation
      entete={{ titre: "Face caméra animée", sousTitre: "Filmées par vous, animées sur vos mots. Une ou plusieurs vidéos à la fois." }}
      recents={<RecentsGenerateur elements={versRecentsFacecamAnimee(dernieres)} deuxColonnes vide={{ titre: "Aucune vidéo pour le moment", phrase: "Déposez vos premières prises ci-dessus." }} />}
    >
      <DepotPrise accordDejaDonne={etat.accordEssai} />
    </GabaritCreation>
  );
}
