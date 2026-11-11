import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormulaireCas } from "@/components/formats/cas-concret/ajouter/FormulaireCas";
import { Carte } from "@/components/ui/Carte";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
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
    <ConteneurPage largeur="lecture">
      <EnTetePage titre="Ajouter un cas" sousTitre={"Décrivez votre cas en quelques phrases. Il apparaîtra dans « À faire » avec les autres ; vous pourrez le retirer ou fournir son script. Rien n'est dépensé ici."} retour={{ href: "/cas-concret", libelle: "Retour aux cas" }} />
      <Carte>
        <FormulaireCas />
      </Carte>
    </ConteneurPage>
  );
}
