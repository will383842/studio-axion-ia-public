import type { Metadata } from "next";
import Link from "next/link";
import { BarreActionCollee, Bouton, EnTetePage } from "@/components/ui";
import { exigerSession } from "@/services/auth";
import { BoutonPlusDeFiltres, ListeScripts } from "../_composants/ListeScripts";
import { OngletsEcrire } from "../_composants/OngletsEcrire";

export const metadata: Metadata = { title: "Scripts (maquette)" };

/** MAQUETTE GM (a) : la liste Scripts. `?format=1` ouvre la feuille « Format ». */
export default async function PageMaquetteScripts({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  await exigerSession();
  const { format } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Écrire" className="mb-3 flex-row items-end justify-between" actions={<BoutonPlusDeFiltres />} />
      <OngletsEcrire />
      <ListeScripts formatOuvert={format === "1"} />
      <BarreActionCollee>
        <Bouton asChild icone="plus" taille="lg">
          <Link href="/maquettes-generateur/sujet">Nouveau sujet</Link>
        </Bouton>
      </BarreActionCollee>
    </div>
  );
}
