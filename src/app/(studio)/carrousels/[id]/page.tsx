import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estReseauVisuelEnvoi } from "@/domaine/reseaux-visuel-envoi";
import { Bouton } from "@/components/ui/Bouton";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { PastilleReseau } from "@/components/ui/PastilleStatut";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { BoutonProgrammerVisuel, jourParDefautParis } from "@/components/visuels/BoutonProgrammerVisuel";
import { BarreValidation, type ActionsCarrousel } from "@/components/visuels/BarreValidation";
import { LegendeReseaux, type LegendeStockee } from "@/components/visuels/LegendeReseaux";
import { MessagesFiche } from "@/components/visuels/MessagesFiche";
import { RangeePages } from "@/components/visuels/RangeePages";
import { Voyant, Voyants } from "@/components/visuels/Voyants";
import { depots } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { phraseDuCodeReport, reseauxACompleter } from "@/services/legende-vers-creneau";
import type { DepotsPasserelle } from "@/services/plan-vers-publication";
import { ErreurVisuel } from "@/visuels/services/carrousels";
import { dependancesCarrousels, phraseDuCode } from "@/visuels/services/production";
import { ficheCarrousel } from "@/visuels/services/vues";
import { libellePages } from "@/domaine/visuels/statuts";
import { corbeilleAction, enregistrerLegendeAction, preparerReseauxAction, programmerAction, refaireAction, refuserAction, relancerRenduAction, restaurerAction, retirerDuCalendrierAction, validerAction } from "./actions";

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
export default async function PageFicheCarrousel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string; completer?: string; report?: string }> }) {
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
  // Légendes enregistrées par réseau (lecture seule) ; le bloc ne se montre que pour un carrousel validé ou programmé.
  const legendes: Partial<Record<"linkedin" | "instagram" | "facebook", LegendeStockee>> = {};
  const reseauxPrepares = (fiche.reseaux ?? []).filter(estReseauVisuelEnvoi);
  if (fiche.statut === "valide" || fiche.statut === "programme") {
    const deps = dependancesCarrousels();
    for (const r of reseauxPrepares) {
      const l = await deps.lireParametre<{ texte?: unknown; simulation?: unknown } | null>(`visuels.legende.${id}.${r}`, null);
      if (l && typeof l.texte === "string") legendes[r] = { texte: l.texte, ...(l.simulation === true ? { simulation: true } : {}) };
    }
  }
  const dansLUrl = (sp.completer ?? "").split(",").filter(Boolean);
  const dCreneau = fiche.statut === "valide" || fiche.statut === "programme" ? await reseauxACompleter(depots().creneauxEditoriaux as unknown as DepotsPasserelle["creneaux"], id, reseauxPrepares, legendes) : [];
  const aCompleter = [...new Set([...dansLUrl, ...dCreneau])];
  const refus = phraseDuCodeReport(sp.report);
  // Cases cochées : les réseaux déjà préparés ; sans choix enregistré, le comportement habituel.
  const coche = (r: "linkedin" | "instagram" | "facebook"): boolean => (fiche.reseaux ? fiche.reseaux.includes(r) : r !== "facebook");
  return (
    <ConteneurPage largeur="lecture">
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
      {fiche.statut === "valide" && (
        <form action={preparerReseauxAction} aria-label="Préparer pour les réseaux" className="mb-6 flex flex-col gap-2 rounded-champ border border-trait bg-surface-1 px-3.5 py-3">
          <input type="hidden" name="id" value={fiche.id} />
          <h2 className="text-sm font-semibold text-texte-doux">Préparer pour les réseaux</h2>
          <label className="flex min-h-11 items-center gap-2 text-sm text-texte"><input type="checkbox" name="reseau" value="linkedin" defaultChecked={coche("linkedin")} className="accent-accent" /> <PastilleReseau reseau="linkedin" /> (un document PDF)</label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-texte"><input type="checkbox" name="reseau" value="instagram" defaultChecked={coche("instagram")} className="accent-accent" /> <PastilleReseau reseau="instagram" /> (images JPEG)</label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-texte"><input type="checkbox" name="reseau" value="facebook" defaultChecked={coche("facebook")} className="accent-accent" /> <PastilleReseau reseau="facebook" /> (images JPEG)</label>
          <Bouton type="submit" variante="secondaire" className="self-start">Préparer pour les réseaux</Bouton>
        </form>
      )}
      {(fiche.statut === "valide" || fiche.statut === "programme") && (
        <LegendeReseaux id={fiche.id} reseaux={reseauxPrepares} legendes={legendes} statut={fiche.statut} aCompleter={aCompleter} {...(refus ? { refus } : {})} enregistrer={enregistrerLegendeAction} />
      )}
      {fiche.statut === "valide" && <BoutonProgrammerVisuel id={fiche.id} action={programmerAction} jourParDefaut={jourParDefautParis(new Date().toISOString())} />}
      {fiche.statut === "programme" && (
        <details className="mb-6 rounded-champ border border-trait bg-surface-1 px-3.5 py-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-texte">Retirer du calendrier</summary>
          <p className="mt-2 text-sm text-texte">Retirer ce carrousel du calendrier ? Ses publications prévues sur tous les réseaux seront retirées. Rien n&apos;est encore parti. Le carrousel reste dans vos carrousels : vous pourrez le programmer de nouveau.</p>
          <form action={retirerDuCalendrierAction} className="mt-3">
            <input type="hidden" name="id" value={fiche.id} />
            <input type="hidden" name="confirmation" value="retirer" />
            <Bouton type="submit" variante="secondaire">Oui, retirer du calendrier</Bouton>
          </form>
        </details>
      )}
      <BarreValidation id={fiche.id} actionsPermises={fiche.actionsPermises} actions={ACTIONS} pdfUrl={fiche.pdfUrl} pdfTelechargement={fiche.pdfTelechargement} />
    </ConteneurPage>
  );
}
