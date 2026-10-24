import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { listerCasRetires } from "@/components/formats/cas-concret/stock/cas-retires";
import { ListeCasRetires } from "@/components/formats/cas-concret/stock/ListeCasRetires";
import { lireSession } from "@/services/auth";
import { lireRetraits } from "@/services/cas-concret-retires";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";

export const metadata: Metadata = { title: "Cas retirés" };
export const dynamic = "force-dynamic";

/**
 * Les cas que Will a retirés (plus proposés sur la page « Cas concret MD »). Lecture seule, sauf le bouton « Remettre ce cas »
 * (confirmation, session exigée côté serveur). Session revérifiée ici : le layout ne rejoue pas à chaque navigation.
 */
export default async function PageCasRetires() {
  if (!(await lireSession())) redirect("/connexion");
  const [retraits, catalogueEtendu, stockMetiers] = await Promise.all([lireRetraits(), reglageAllume(REGLAGES_CAS_CONCRET.catalogueEtendu), reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers)]);
  const cas = listerCasRetires(retraits, { catalogueEtendu, stockMetiers });
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Cas retirés" sousTitre="Ces cas ne sont plus proposés. Remettez-en un pour le revoir dans la liste." retour={{ href: "/cas-concret", libelle: "Cas concret MD" }} />
      <ListeCasRetires cas={cas} />
    </div>
  );
}
