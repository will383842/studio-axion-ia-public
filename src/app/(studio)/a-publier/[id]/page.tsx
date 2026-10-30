import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LignesAPublier } from "@/components/publication/LignesAPublier";
import { filtreDepuis, nombreAffichees } from "@/components/publication/liste-a-publier";
import { videoSuivante } from "@/components/publication/finitions-envoi";
import { lignesParReseau, retourDetail, reseauDepuis, reseauxPresents } from "@/components/publication/liste-par-reseau";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { pageAPublierAllumee, vueAPublier } from "@/services/a-publier";

export const metadata: Metadata = { title: "À publier" };
export const dynamic = "force-dynamic";

/** Détail d'une vidéo à publier : lecteur entier, case unique, un bouton par réseau prêt. Lien partageable, ouvert sur le réseau choisi, retour à la liste de ce réseau avec son filtre. */
export default async function PageDetailAPublier({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reseau?: string; liste?: string; filtre?: string; n?: string }> }) {
  await exigerSession();
  if (!(await pageAPublierAllumee())) notFound();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const vue = await vueAPublier();
  const lignes = vue.lignes.filter((l) => l.videoId === id);
  if (!lignes.length) notFound();
  const presents = reseauxPresents(vue.lignes);
  const retour = retourDetail(sp, presents, filtreDepuis(sp.filtre), nombreAffichees(sp.n));
  const reseau = reseauDepuis(sp.reseau, reseauxPresents(lignes));
  const filtre = filtreDepuis(sp.filtre);
  const toutes = lignesParReseau(vue.lignes).map((x) => x.ligne);
  // Un « Suivante » par panneau : il suit le réseau du panneau qui vient d'envoyer, pas celui de l'adresse.
  const suivantes = Object.fromEntries(lignes.map((l) => [l.reseau, videoSuivante(toutes, id, sp.liste === "tous" ? "tous" : l.reseau, filtre, nombreAffichees(sp.n))]));
  return (
    <div>
      <EnTetePage titre="À publier" retour={{ href: retour, libelle: "Retour à la liste" }} />
      <LignesAPublier vue={{ ...vue, lignes }} retour={retour} reseauOuvert={reseau === "tous" ? undefined : reseau} suivantes={suivantes} />
    </div>
  );
}
