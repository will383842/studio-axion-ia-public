import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoutonValider } from "@/components/formats/cas-concret/document/BoutonValider";
import { DocumentPromis } from "@/components/formats/cas-concret/document/DocumentPromis";
import { FormulaireCorrection } from "@/components/formats/cas-concret/document/FormulaireCorrection";
import { jourFrancais } from "@/components/formats/cas-concret/document/jour";
import { TexteImprimable } from "@/components/formats/cas-concret/document/TexteImprimable";
import Link from "next/link";
import { Pastille } from "@/components/ui/Pastille";
import { ErreurStudio } from "@/services/_commun";
import { lireDocument, type VueDocument } from "@/services/cas-concret-document";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";

export const metadata: Metadata = { title: "Document promis" };
export const dynamic = "force-dynamic";

/**
 * DOCUMENT PROMIS : la page A4 que Will relit, imprime puis valide. Rien n'est envoyé d'ici. À l'écran la page couvre le
 * menu du studio ; à l'impression seule la feuille sort.
 */
export default async function PageDocument({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  // Réglage éteint (par défaut) : la page n'existe pas.
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.documentPromis))) notFound();
  let vue: VueDocument;
  try {
    vue = await lireDocument(videoId);
  } catch (e) {
    // 404 pour une erreur du studio (vidéo ou cas inconnus, fonction fermée) ; une panne de la base remonte telle quelle.
    if (e instanceof ErreurStudio) notFound();
    throw e;
  }
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-fond p-4 print:static print:overflow-visible print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/videos/${videoId}`} className="text-sm text-texte-doux underline">Retour à la vidéo</Link>
          {vue.valideLe ? <Pastille ton="sauge">Validé le {jourFrancais(vue.valideLe)}</Pastille> : <Pastille ton="ambre">Brouillon</Pastille>}
        </div>
        <BoutonValider videoId={videoId} />
      </div>
      <details className="mx-auto mb-4 max-w-[210mm] rounded-carte border border-trait bg-surface-1 p-4 print:hidden">
        <summary className="cursor-pointer text-[15px] font-medium text-texte">Corriger le texte</summary>
        <div className="mt-3">
          <FormulaireCorrection videoId={videoId} texte={vue.texte} />
        </div>
      </details>
      {vue.corrige ? <TexteImprimable texte={vue.texte} /> : <DocumentPromis document={vue.document} />}
    </div>
  );
}
