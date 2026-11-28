import type { Metadata } from "next";
import { FeuilleImportEpingles } from "@/components/calendrier/FeuilleImportEpingles";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { canauxZernioEnregistres } from "@/services/comptes-envoi-zernio";
import { jourParDefautParis } from "@/components/visuels/BoutonProgrammerVisuel";
import { maintenant } from "@/services/_commun";

export const metadata: Metadata = { title: "Importer un lot d'épingles" };
export const dynamic = "force-dynamic";

/** Importer un lot d'épingles Pinterest : chaque épingle arrive « à valider » ; rien ne part sans votre validation. */
export default async function PageImporterEpingles() {
  await exigerSession();
  const canaux = (await canauxZernioEnregistres())?.canaux ?? [];
  // Un compte = le préfixe des canaux « tableau » (jamais d'identifiant du fournisseur affiché).
  const comptes = [...new Map(canaux.filter((c) => c.service === "pinterest" && !c.deconnecte && c.id.includes(":pin:")).map((c) => [c.id.split(":pin:")[0], { id: c.id.split(":pin:")[0], nom: c.nom.split(" · ")[0] }])).values()];
  return (
    <div>
      <EnTetePage
        titre="Importer un lot d'épingles"
        sousTitre="Collez le lot. Chaque épingle arrive dans le calendrier « à valider » ; « Valider ce lot » les programme dans le Studio, rien ne part avant le tour du calendrier."
        retour={{ href: "/calendrier", libelle: "Calendrier" }}
      />
      <FeuilleImportEpingles comptes={comptes} jourParDefaut={jourParDefautParis(maintenant())} />
    </div>
  );
}
