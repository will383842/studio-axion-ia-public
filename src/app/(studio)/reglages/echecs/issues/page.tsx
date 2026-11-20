import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { lireIssuesDesEchecs } from "@/services/issue-des-echecs";

export const metadata: Metadata = { title: "Ce que sont devenus les échecs" };
export const dynamic = "force-dynamic";

/** Page en lecture seule : ce que sont devenus les échecs des 30 derniers jours. Aucun lien n'y mène encore. */
export default async function PageIssuesDesEchecs() {
  await exigerSession();
  const { issues, total } = await lireIssuesDesEchecs({ joursMax: 30 });
  return (
    <div className="mx-auto w-full max-w-3xl">
      <EnTetePage retour={{ href: "/reglages/echecs", libelle: "Échecs" }} titre="Ce que sont devenus les échecs" sousTitre="Sur les 30 derniers jours." />
      {total === 0 ? (
        <p className="rounded-2xl border border-trait p-4 text-sm">Aucun échec sur 30 jours.</p>
      ) : (
        <section className="rounded-2xl border border-trait p-4">
          <ul className="flex flex-col gap-1 text-base">
            <li>Repartis seuls : {issues["reparti-seul"]}</li>
            <li>Repris ensuite : {issues.repris}</li>
            <li>Encore en cours : {issues["en-cours"]}</li>
            <li>Restés à vous : {issues["reste-a-williams"]}</li>
          </ul>
        </section>
      )}
    </div>
  );
}
