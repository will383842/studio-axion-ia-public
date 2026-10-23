"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cocherSurLeSiteAction, retirerDuSiteAction } from "@/app/(studio)/videos/[id]/actions-site";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Dialogue } from "@/components/ui/Dialogue";
import { Icone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import type { VueSurLeSite } from "@/services/site-videos";
import { FeuilleSurLeSite } from "./FeuilleSurLeSite";

export const TEXTES_SUR_LE_SITE_FICHE = {
  titre: "Sur le site",
  case: "Sur le site",
  aide: "La vidéo et sa page, sur votre site. Rien ne part avant votre relecture.",
  relire: "Relire et publier",
  miseAJour: "Mettre à jour",
  retirer: "Retirer du site",
  enLigne: "En ligne sur le site ↗",
  confirmation: "La page disparaîtra du site. La vidéo reste dans le studio.",
} as const;

/** Le bloc « Sur le site » : la case, puis « Relire et publier », ou le lien « En ligne sur le site ↗ » et ses gestes. */
export function CarteSurLeSite({ vue }: { vue: Extract<VueSurLeSite, { visible: true }> }) {
  const router = useRouter();
  const [choisie, setChoisie] = useState(vue.choisie);
  const [feuille, setFeuille] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();

  function cocher(v: boolean) {
    const avant = choisie;
    setChoisie(v);
    demarrer(async () => {
      const res = await cocherSurLeSiteAction(vue.videoId, v);
      if (!res.ok) {
        setChoisie(avant);
        notifier.erreur(res.message);
        return;
      }
      router.refresh();
    });
  }

  function retirer() {
    demarrer(async () => {
      const res = await retirerDuSiteAction(vue.videoId);
      setConfirmer(false);
      if (!res.ok) {
        notifier.erreur(res.message);
        return;
      }
      notifier.succes("Retirée du site");
      router.refresh();
    });
  }

  return (
    <Carte className="mt-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icone nom="lien" size={18} className="shrink-0 text-texte-doux" />
          <h2 className="font-titre text-lg text-texte">{TEXTES_SUR_LE_SITE_FICHE.titre}</h2>
          {vue.simulation && <PastilleEssai className="ml-auto" />}
        </div>

        {vue.enLigne ? (
          <div className="space-y-3">
            <a href={vue.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-orange-vif underline-offset-4 hover:underline">
              {TEXTES_SUR_LE_SITE_FICHE.enLigne}
            </a>
            <div className="flex flex-wrap gap-2">
              {vue.aMettreAJour && (
                <Bouton variante="principal" onClick={() => setFeuille(true)}>
                  {TEXTES_SUR_LE_SITE_FICHE.miseAJour}
                </Bouton>
              )}
              <Bouton variante="secondaire" disabled={enCours} onClick={() => setConfirmer(true)}>
                {TEXTES_SUR_LE_SITE_FICHE.retirer}
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <CaseACocher libelle={TEXTES_SUR_LE_SITE_FICHE.case} detail={TEXTES_SUR_LE_SITE_FICHE.aide} coche={choisie} desactive={enCours} onChange={cocher} />
            {vue.etat === "echec" && vue.derniereErreur && (
              <p role="alert" className="flex gap-2 rounded-xl bg-brique-doux px-3 py-2 text-sm text-brique">
                <Icone nom="attention" size={16} className="mt-0.5 shrink-0" />
                {vue.derniereErreur}
              </p>
            )}
            {choisie && (
              <Bouton variante="principal" onClick={() => setFeuille(true)}>
                {TEXTES_SUR_LE_SITE_FICHE.relire}
              </Bouton>
            )}
          </div>
        )}
      </div>

      <FeuilleSurLeSite videoId={vue.videoId} ouverte={feuille} onOuverteChange={setFeuille} />
      <Dialogue
        ouvert={confirmer}
        onOuvertChange={setConfirmer}
        titre={TEXTES_SUR_LE_SITE_FICHE.retirer}
        description={TEXTES_SUR_LE_SITE_FICHE.confirmation}
        pied={
          <div className="flex justify-end gap-2">
            <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton variante="danger" chargement={enCours} onClick={retirer}>
              {TEXTES_SUR_LE_SITE_FICHE.retirer}
            </Bouton>
          </div>
        }
      />
    </Carte>
  );
}
