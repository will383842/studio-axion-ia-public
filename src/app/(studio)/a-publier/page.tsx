import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListeAPublier } from "@/components/publication/ListeAPublier";
import { filtreDepuis, nombreAffichees } from "@/components/publication/liste-a-publier";
import { Bouton } from "@/components/ui/Bouton";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { exigerSession } from "@/services/auth";
import { pageAPublierAllumee, vueAPublier } from "@/services/a-publier";
import { listerVisuelsAPublier } from "@/services/publications";

export const metadata: Metadata = { title: "À publier" };
export const dynamic = "force-dynamic";

/**
 * À PUBLIER (tous les formats) : les vidéos validées, une section par réseau (une ligne par vidéo et par réseau), à télécharger une par une ou par réseau, et à côté les carrousels et infographies validés.
 * Un clic ouvre le détail (/a-publier/[id]). Page protégée comme les autres écrans, allumée par défaut (Williams, 08/11). Elle ne fait que montrer.
 */
export default async function PageAPublier({ searchParams }: { searchParams: Promise<{ reseau?: string; filtre?: string; n?: string }> }) {
  await exigerSession();
  if (!(await pageAPublierAllumee())) notFound();
  const sp = await searchParams;
  const vue = await vueAPublier();
  const visuels = await listerVisuelsAPublier();
  return (
    <div>
      <EnTetePage
        titre="À publier"
        sousTitre="Voici tout ce qui est prêt à partir. Rien n'est envoyé sans votre accord : vous relisez, puis vous validez."
        actions={
          <>
            <Bouton asChild variante="secondaire" icone="oeil">
              <Link href="/videos?etape=a_relire">À relire ({vue.nbARelire ?? 0})</Link>
            </Bouton>
            <Bouton asChild variante="secondaire" icone="calendrier">
              <Link href="/calendrier">Calendrier</Link>
            </Bouton>
          </>
        }
      />
      {vue.lignes.length || visuels.length ? (
        <ListeAPublier lignes={vue.lignes} visuels={visuels} filtre={filtreDepuis(sp.filtre)} affichees={nombreAffichees(sp.n)} reseau={sp.reseau} />
      ) : (
        <EtatVide
          compact
          icone="coche"
          titre="Rien n'est prêt à partir"
          phrase="Dès qu'un contenu est terminé, il arrive ici pour que vous le relisiez avant l'envoi."
          action={
            <Bouton asChild variante="secondaire" icone="oeil">
              <Link href="/videos?etape=a_relire">Voir les vidéos à relire</Link>
            </Bouton>
          }
        />
      )}
    </div>
  );
}
