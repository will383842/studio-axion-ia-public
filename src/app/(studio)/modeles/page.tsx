import type { Metadata } from "next";
import { ListeModeles } from "@/components/creation/ListeModeles";
import { listerElements } from "@/services/bibliotheque";
import { exigerSession } from "@/services/auth";
import { listerModeles, listerModelesArchives } from "@/services/modeles";
import { listerPersonnages } from "@/services/personnages";
import { listerVideos } from "@/services/videos";

export const metadata: Metadata = { title: "Mes modèles" };
export const dynamic = "force-dynamic";

/** MES MODÈLES (B.8 #12b). « Utiliser » ouvre l'assistant prérempli ; un modèle naît d'une vidéo réussie. */
export default async function PageModeles() {
  await exigerSession();
  const [modeles, archives, personnages, elements, videos] = await Promise.all([
    listerModeles(),
    listerModelesArchives(),
    listerPersonnages(),
    listerElements({ type: ["lut", "musique"] }),
    listerVideos({ statut: "prete", limite: 24 }),
  ]);
  return (
    <div>
      <ListeModeles
        modeles={modeles}
        archives={archives}
        videos={videos}
        reperes={{
          personnages: Object.fromEntries(personnages.map((p) => [p.personnage.id, { nom: p.personnage.nom, photo: p.photo }])),
          elements: Object.fromEntries(elements.map((e) => [e.id, e.nom])),
        }}
      />
    </div>
  );
}
