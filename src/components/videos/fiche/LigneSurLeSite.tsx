"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publierSurLeSiteAction, retirerDuSiteAction } from "@/app/(studio)/videos/[id]/actions-site";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { ilYA } from "@/lib/dates";
import type { LigneEnLigne } from "@/services/site-videos";

/** Une vidéo de la page « Sur le site » : son titre, son état, son lien, « Retirer » (ou « Réessayer » après un échec). */
export function LigneSurLeSite({ ligne }: { ligne: LigneEnLigne }) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();
  const echec = ligne.etat === "echec";

  function retirer() {
    demarrer(async () => {
      const res = await retirerDuSiteAction(ligne.videoId);
      setConfirmer(false);
      if (!res.ok) return void notifier.erreur(res.message);
      notifier.succes("Retirée du site");
      router.refresh();
    });
  }

  function reessayer() {
    demarrer(async () => {
      const res = await publierSurLeSiteAction(ligne.videoId);
      if (!res.ok) return void notifier.erreur(res.message);
      if (res.donnees.etat === "echec") notifier.erreur(res.donnees.message ?? "L'envoi n'a pas abouti.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-texte">{ligne.titre}</p>
        <p className="text-sm text-texte-faible">
          {ligne.versionEnLigne !== undefined ? `Version ${ligne.versionEnLigne} · ` : ""}
          {ilYA(ligne.modifieLe)} · Vues —
        </p>
        {echec && ligne.derniereErreur && <p className="mt-1 text-sm text-brique">{ligne.derniereErreur}</p>}
      </div>
      {echec ? <Pastille ton="brique">À reprendre</Pastille> : ligne.etat === "en-ligne" ? <Pastille ton="sauge">En ligne</Pastille> : <Pastille ton="ambre">En cours</Pastille>}
      {ligne.url && (
        <a href={ligne.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-orange-vif hover:underline" aria-label={`Ouvrir la page de ${ligne.titre}`}>
          Voir ↗
        </a>
      )}
      {echec && ligne.versionEnLigne === undefined && (
        <Bouton variante="secondaire" chargement={enCours} onClick={reessayer}>
          Réessayer
        </Bouton>
      )}
      {(ligne.etat === "en-ligne" || (echec && ligne.versionEnLigne !== undefined)) && (
        <Bouton variante="secondaire" disabled={enCours} onClick={() => setConfirmer(true)}>
          Retirer
        </Bouton>
      )}
      <Dialogue
        ouvert={confirmer}
        onOuvertChange={setConfirmer}
        titre="Retirer du site"
        description="La page disparaîtra du site. La vidéo reste dans le studio."
        pied={
          <div className="flex justify-end gap-2">
            <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton variante="danger" chargement={enCours} onClick={retirer}>
              Retirer du site
            </Bouton>
          </div>
        }
      />
    </li>
  );
}
