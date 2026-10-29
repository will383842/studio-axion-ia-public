import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListeAPublier } from "@/components/publication/ListeAPublier";
import { filtreDepuis, nombreAffichees } from "@/components/publication/liste-a-publier";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { exigerSession } from "@/services/auth";
import { pageAPublierAllumee, vueAPublier } from "@/services/a-publier";

export const metadata: Metadata = { title: "À publier" };
export const dynamic = "force-dynamic";

/**
 * À PUBLIER (vidéos) : la liste compacte des vidéos validées, séparée par réseau (une ligne par vidéo et par réseau). Un clic ouvre le détail (/a-publier/[id]).
 * Page protégée comme les autres écrans, derrière un réglage éteint par défaut. Elle ne fait que montrer.
 */
export default async function PageAPublier({ searchParams }: { searchParams: Promise<{ reseau?: string; filtre?: string; n?: string }> }) {
  await exigerSession();
  if (!(await pageAPublierAllumee())) notFound();
  const sp = await searchParams;
  const vue = await vueAPublier();
  return (
    <div>
      <EnTetePage titre="À publier" />
      {vue.lignes.length ? (
        <ListeAPublier lignes={vue.lignes} filtre={filtreDepuis(sp.filtre)} affichees={nombreAffichees(sp.n)} reseau={sp.reseau} />
      ) : (
        <EtatVide compact icone="envoyer" titre="Rien à publier" phrase="Les vidéos validées arrivent ici." />
      )}
    </div>
  );
}
