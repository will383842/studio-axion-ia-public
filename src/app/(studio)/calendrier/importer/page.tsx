import type { Metadata } from "next";
import { FeuilleImportPlan } from "@/components/plan-editorial/FeuilleImportPlan";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Importer un fichier de publications" };
export const dynamic = "force-dynamic";

/** Importer un fichier de publications (tableau ou collage) : chaque ligne devient une publication « Proposée », à valider. */
export default async function PageImporter({ searchParams }: { searchParams: Promise<{ compte?: string }> }) {
  await exigerSession();
  const { compte } = await searchParams;
  return (
    <div>
      <EnTetePage
        titre="Importer un fichier de publications"
        sousTitre="Collez un tableau ou choisissez un fichier. Chaque ligne arrive dans le calendrier « à valider » : rien ne part sans votre validation."
        retour={{ href: "/calendrier", libelle: "Calendrier" }}
      />
      <FeuilleImportPlan compteCible={typeof compte === "string" ? compte : ""} />
    </div>
  );
}
