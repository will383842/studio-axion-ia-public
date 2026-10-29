import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LignesAPublier } from "@/components/publication/LignesAPublier";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { exigerSession } from "@/services/auth";
import { pageAPublierAllumee, vueAPublier } from "@/services/a-publier";

export const metadata: Metadata = { title: "À publier" };
export const dynamic = "force-dynamic";

/**
 * À PUBLIER (vidéos) : les vidéos validées, une carte par vidéo, ses réseaux prêts dessous, jusqu'à Buffer. Page protégée comme les autres écrans,
 * derrière un réglage éteint par défaut. Elle ne fait que montrer et appeler les envois existants.
 */
export default async function PageAPublier() {
  await exigerSession();
  if (!(await pageAPublierAllumee())) notFound();
  const vue = await vueAPublier();
  return (
    <div>
      <EnTetePage titre="À publier" />
      {vue.lignes.length ? (
        <LignesAPublier vue={vue} />
      ) : (
        <EtatVide compact icone="envoyer" titre="Rien à publier" phrase="Les vidéos validées arrivent ici." />
      )}
    </div>
  );
}
