import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EcranFourni } from "@/components/formats/cas-concret/ecran-fourni/EcranFourni";
import { ecransFournisDuCas, etapesAEcranReel } from "@/components/formats/cas-concret/ecran-fourni/service";
import { Carte } from "@/components/ui/Carte";
import { trouverCasAutorise } from "@/services/cas-concret-stock-acces";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";

export const metadata: Metadata = { title: "Écran fourni" };
export const dynamic = "force-dynamic";

/**
 * ÉCRAN FOURNI : quand l'écran à filmer est derrière une connexion (la console, par exemple), Will dépose une image,
 * masque ce qui ne doit pas se voir et confirme qu'aucune donnée personnelle n'est visible. Sans cette confirmation,
 * l'image n'est pas utilisée.
 */
export default async function PageEcranFourni({ params }: { params: Promise<{ casId: string }> }) {
  const { casId } = await params;
  // Réglage éteint (par défaut) : la page n'existe pas.
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni))) notFound();
  const cas = await trouverCasAutorise(casId);
  if (!cas) notFound();
  const gardees = new Set((await ecransFournisDuCas(casId)).filter((e) => !!e.attesteLe).map((e) => e.etapeCas));
  const etapes = etapesAEcranReel(casId).map((e) => ({ ...e, fournie: gardees.has(e.numero) }));
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Link href="/cas-concret" className="text-sm text-texte-doux underline">Retour aux cas</Link>
      <h1 className="text-2xl text-texte">Fournir un écran</h1>
      <p className="text-[15px] text-texte-doux">{cas.titre}</p>
      <Carte>
        <EcranFourni casId={casId} etapes={etapes} />
      </Carte>
    </div>
  );
}
