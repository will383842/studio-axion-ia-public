import { redirect } from "next/navigation";
import { Coquille } from "@/components/coquille/Coquille";
import { lireSession } from "@/services/auth";
import { listerFormatsAvecCompteurs } from "@/services/formats";
import { compterNonLues } from "@/services/notifications";
import { surLeSiteVisible } from "@/services/site-videos";
import { pageAPublierAllumee } from "@/services/a-publier";

/** Toutes les pages connectées passent par ici : session revérifiée + coquille AV2.1. */
export default async function LayoutStudio({ children }: { children: React.ReactNode }) {
  const session = await lireSession();
  if (!session) redirect("/connexion");
  const [formats, nonLues, surLeSite, aPublier] = await Promise.all([listerFormatsAvecCompteurs(), compterNonLues(), surLeSiteVisible(), pageAPublierAllumee()]);
  return (
    <Coquille formats={formats.map((f) => ({ id: f.id, nom: f.nom, icone: f.icone, statut: f.statut, nbVideos: f.nbVideos, adresseCreation: f.adresseCreation, ...(f.essai ? { essai: true } : {}) }))} nonLues={nonLues} surLeSite={surLeSite} aPublier={aPublier}>
      {children}
    </Coquille>
  );
}
