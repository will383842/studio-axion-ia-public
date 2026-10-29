import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LignesAPublier } from "@/components/publication/LignesAPublier";
import { filtreDepuis, lienListe, nombreAffichees } from "@/components/publication/liste-a-publier";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { pageAPublierAllumee, vueAPublier } from "@/services/a-publier";

export const metadata: Metadata = { title: "À publier" };
export const dynamic = "force-dynamic";

/** Détail d'une vidéo à publier : lecteur entier, case unique, un bouton par réseau prêt. Lien partageable, retour à la liste avec son filtre. */
export default async function PageDetailAPublier({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filtre?: string; n?: string }> }) {
  await exigerSession();
  if (!(await pageAPublierAllumee())) notFound();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const vue = await vueAPublier();
  const lignes = vue.lignes.filter((l) => l.videoId === id);
  if (!lignes.length) notFound();
  const retour = lienListe(filtreDepuis(sp.filtre), nombreAffichees(sp.n));
  return (
    <div>
      <EnTetePage titre="À publier" retour={{ href: retour, libelle: "Retour à la liste" }} />
      <LignesAPublier vue={{ ...vue, lignes }} retour={retour} />
    </div>
  );
}
