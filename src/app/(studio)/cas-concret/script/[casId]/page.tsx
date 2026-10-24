import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormulaireScriptFourni } from "@/components/formats/cas-concret/script-fourni/FormulaireScriptFourni";
import { Carte } from "@/components/ui/Carte";
import { lireSession } from "@/services/auth";
import { lireCasRetires } from "@/services/cas-concret-retires";
import { departMonScript, PHRASE_CAS_A_SCRIPT_CATALOGUE } from "@/services/cas-concret-script-fourni";
import { scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
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
  // Un cas qui a un script validé du code : le prix annoncé ne suivrait pas le texte de Will (la mise à jour du prix suit).
  const duCatalogue = !!scriptValideDuCatalogue(cas.id);
  const depart = duCatalogue ? null : await departMonScript(cas.id);
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Link href="/cas-concret" className="inline-flex min-h-11 items-center text-sm text-texte-doux underline">
        Retour aux cas
      </Link>
      <h1 className="text-2xl text-texte">Mon script</h1>
      <p className="text-[15px] text-texte-doux">{cas.titre}</p>
      <Carte>
        {depart ? (
          <FormulaireScriptFourni casId={cas.id} titre={cas.titre} texteDepart={depart.texte} origine={depart.origine} perime={depart.perime} courantFourni={depart.courantFourni} />
        ) : (
          <p className="text-[15px] text-texte">{PHRASE_CAS_A_SCRIPT_CATALOGUE}</p>
        )}
      </Carte>
    </div>
  );
}
