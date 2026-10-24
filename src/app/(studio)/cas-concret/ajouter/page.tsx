import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireCas } from "@/components/formats/cas-concret/ajouter/FormulaireCas";
import { Carte } from "@/components/ui/Carte";
import { lireSession } from "@/services/auth";

export const metadata: Metadata = { title: "Ajouter un cas" };
export const dynamic = "force-dynamic";

/**
 * AJOUTER UN CAS : Will décrit un cas à la main (titre, offre, sujet, étapes en quelques phrases…). Le code le construit et le
 * contrôle avec les mêmes garde-fous que les cas du stock ; il apparaît ensuite dans « À faire » avec les autres. Rien n'est
 * dépensé ici. Session revérifiée : le layout ne rejoue pas à chaque navigation.
 */
export default async function PageAjouterCas() {
  if (!(await lireSession())) redirect("/connexion");
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Link href="/cas-concret" className="inline-flex min-h-11 items-center text-sm text-texte-doux underline">
        Retour aux cas
      </Link>
      <h1 className="text-2xl text-texte">Ajouter un cas</h1>
      <p className="text-[15px] text-texte-doux">Décrivez votre cas en quelques phrases. Il apparaîtra dans « À faire » avec les autres ; vous pourrez le retirer ou fournir son script. Rien n&apos;est dépensé ici.</p>
      <Carte>
        <FormulaireCas />
      </Carte>
    </div>
  );
}
