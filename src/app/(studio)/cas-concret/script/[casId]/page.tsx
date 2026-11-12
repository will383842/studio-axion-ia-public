import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FormulaireScriptFourni } from "@/components/formats/cas-concret/script-fourni/FormulaireScriptFourni";
import { Carte } from "@/components/ui/Carte";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { lireSession } from "@/services/auth";
import { lireCasRetires } from "@/services/cas-concret-retires";
import { departMonScript } from "@/services/cas-concret-script-fourni";
import { trouverCasAutorise } from "@/services/cas-concret-stock-acces";

export const metadata: Metadata = { title: "Mon script" };
export const dynamic = "force-dynamic";

/**
 * MON SCRIPT : Will tape ou colle SON script pour un cas ; il est dit mot pour mot, l'IA n'écrit rien. Gratuit jusqu'à la voix.
 * Atteignable depuis la feuille « Votre vidéo » et depuis « À valider ». Cas absent ou retiré : la page n'existe pas.
 */
export default async function PageMonScript({ params }: { params: Promise<{ casId: string }> }) {
  if (!(await lireSession())) redirect("/connexion");
  const { casId } = await params;
  const cas = await trouverCasAutorise(casId);
  if (!cas || (await lireCasRetires()).has(cas.id)) notFound();
  const depart = await departMonScript(cas.id);
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage titre="Mon script" sousTitre={cas.titre} retour={{ href: "/cas-concret", libelle: "Retour aux cas" }} />
      <Carte>
        <FormulaireScriptFourni casId={cas.id} titre={cas.titre} texteDepart={depart.texte} origine={depart.origine} perime={depart.perime} courantFourni={depart.courantFourni} />
      </Carte>
    </ConteneurPage>
  );
}
