import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { listerDejaFaits } from "@/components/formats/cas-concret/stock/deja-faits";
import { ListeDejaFaits } from "@/components/formats/cas-concret/stock/ListeDejaFaits";
import { lireSession } from "@/services/auth";
import { lireCasTraites } from "@/services/cas-concret-traites";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";

export const metadata: Metadata = { title: "Cas déjà faits" };
export const dynamic = "force-dynamic";

/**
 * Les cas dont la vidéo est allée au bout (plus proposés sur la page « Cas concret MD »). Lecture seule, sauf le bouton
 * « Remettre en stock » (confirmation, session exigée côté serveur). Session revérifiée ici : le layout ne rejoue pas à chaque navigation.
 */
export default async function PageDejaFaits() {
  if (!(await lireSession())) redirect("/connexion");
  const [traites, catalogueEtendu, stockMetiers] = await Promise.all([lireCasTraites(), reglageAllume(REGLAGES_CAS_CONCRET.catalogueEtendu), reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers)]);
  const cas = listerDejaFaits(traites, { catalogueEtendu, stockMetiers });
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Cas déjà faits" sousTitre="Ces cas ont déjà leur vidéo. Remettez-en un en stock pour le refaire." retour={{ href: "/cas-concret", libelle: "Cas concret MD" }} />
      <ListeDejaFaits cas={cas} />
    </div>
  );
}
