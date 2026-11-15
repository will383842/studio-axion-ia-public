import type { Metadata } from "next";
import Link from "next/link";
import { Bouton } from "@/components/ui/Bouton";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauInfographieEteint, ListeInfographies, type FicheInfographieStockee } from "@/components/visuels/FicheInfographie";
import { lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { generateurAllume } from "@/visuels/interrupteur";

export const metadata: Metadata = { title: "Infographies" };
export const dynamic = "force-dynamic";

/** Infographies : la liste (brouillons et validées). Aucun montant. */
export default async function PageInfographies() {
  await exigerSession();
  const [ids, allume] = await Promise.all([lireParametre<string[]>("infographies.index", []), generateurAllume("infographies")]);
  const lues = await Promise.all(ids.map((id) => lireParametre<FicheInfographieStockee | null>(`infographies.fiche.${id}`, null)));
  const fiches = lues.filter((f): f is FicheInfographieStockee => f !== null).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage
        titre="Infographies"
        sousTitre="Des infographies à relire et à valider avant toute suite."
        actions={
          <Bouton asChild icone="plus">
            <Link href="/infographies/nouvelle">Nouvelle infographie</Link>
          </Bouton>
        }
      />
      {!allume && <BandeauInfographieEteint />}
      <ListeInfographies fiches={fiches} />
    </ConteneurPage>
  );
}
