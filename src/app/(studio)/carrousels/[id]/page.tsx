import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { BarreValidation, type ActionsCarrousel } from "@/components/visuels/BarreValidation";
import { MessagesFiche } from "@/components/visuels/MessagesFiche";
import { RangeePages } from "@/components/visuels/RangeePages";
import { Voyant, Voyants } from "@/components/visuels/Voyants";
import { exigerSession } from "@/services/auth";
import { ErreurVisuel } from "@/visuels/services/carrousels";
import { dependancesCarrousels, phraseDuCode } from "@/visuels/services/production";
import { ficheCarrousel } from "@/visuels/services/vues";
import { libellePages } from "@/domaine/visuels/statuts";
import { corbeilleAction, refaireAction, refuserAction, relancerRenduAction, restaurerAction, validerAction } from "./actions";

export const metadata: Metadata = { title: "Carrousel" };
export const dynamic = "force-dynamic";

const ACTIONS: ActionsCarrousel = {
  valider: validerAction,
  refuser: refuserAction,
  refaire: refaireAction,
  relancer_rendu: relancerRenduAction,
  corbeille: corbeilleAction,
  restaurer: restaurerAction,
};

/** Fiche d'un carrousel = écran de validation : pages, contrôles, pourquoi page par page, PDF, actions. */
export default async function PageFicheCarrousel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  await exigerSession();
  const { id } = await params;
  const sp = await searchParams;
  let fiche;
  try {
    fiche = await ficheCarrousel(id, dependancesCarrousels());
  } catch (e) {
    if (e instanceof ErreurVisuel && e.code === "INTROUVABLE") notFound();
    throw e;
  }
  const erreur = phraseDuCode(sp.erreur);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <EnTetePage retour={{ href: "/carrousels", libelle: "Carrousels" }} titre={fiche.titre} sousTitre={`${fiche.libelleStatut} · ${libellePages(fiche)}`} actions={fiche.verdict && fiche.statut !== "echec_rendu" ? <Voyant niveau={fiche.verdict} avecPorte /> : undefined} />
      {!fiche.generateurAllume && <BandeauGenerateurEteint />}
      {erreur && (
        <p role="alert" className="mb-4 text-sm text-brique">
          {erreur}
        </p>
      )}
      <MessagesFiche fiche={fiche} />
      {fiche.pages.length > 0 && <RangeePages pages={fiche.pages} titre={fiche.titre} className="mb-6" />}
      {fiche.rapport && <Voyants rapport={fiche.rapport} className="mb-6" />}
      {fiche.pourquoi.length > 0 && (
        <section aria-label="Pourquoi ces pages" className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-texte-doux">Pourquoi ces pages</h2>
          <ol className="flex flex-col gap-2">
            {fiche.pourquoi.map((p, i) => (
              <li key={i} className="rounded-champ border border-trait bg-surface-1 px-3.5 py-2.5 text-sm text-texte">
                {/* Page 1 à l'écran ; les données sont en base 0. */}
                <span className="mr-2 font-semibold text-texte-doux">Page {i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </section>
      )}
      <BarreValidation id={fiche.id} actionsPermises={fiche.actionsPermises} actions={ACTIONS} pdfUrl={fiche.pdfUrl} pdfTelechargement={fiche.pdfTelechargement} />
    </div>
  );
}
