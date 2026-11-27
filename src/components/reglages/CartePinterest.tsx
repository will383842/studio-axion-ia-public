"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirPinterestActifAction } from "@/app/(studio)/reglages/actions-pinterest";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";
import type { VuePinterest } from "@/domaine/chaine-pinterest";
import { etatInterrupteurPinterest, phraseComptePinterest, TEXTES_PINTEREST } from "./pinterest-logique";

/** Réglages › Publication : Pinterest. Fermé par défaut ; le domaine du site est en lecture seule. */
export function CartePinterest({ vue }: { vue: VuePinterest }) {
  const router = useRouter();
  const [actif, setActif] = useState(vue.actif);
  const [enCours, demarrer] = useTransition();
  // Recalage sur la base après router.refresh().
  const [baseVue, setBaseVue] = useState(vue);
  if (baseVue !== vue) {
    setBaseVue(vue);
    if (vue.actif !== baseVue.actif) setActif(vue.actif);
  }
  const interrupteur = etatInterrupteurPinterest({ enCours, actif, compte: vue.compte, domaine: vue.domaine });

  function changer(v: boolean) {
    const avant = actif;
    setActif(v);
    demarrer(async () => {
      let r;
      try {
        r = await definirPinterestActifAction(v);
      } catch {
        setActif(avant);
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setActif(avant);
        notifier.erreur(r.message ?? "Le choix n'a pas été enregistré.");
        return;
      }
      notifier.succes(v ? "Envoi ouvert" : "Envoi fermé");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-texte-doux">{TEXTES_PINTEREST.rappel}</p>
      <p role="status" className="text-sm text-texte">{phraseComptePinterest(vue.compte)}</p>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-texte-doux">Domaine du site</p>
        <p className="text-sm text-texte">{vue.domaine || TEXTES_PINTEREST.domaineVide}</p>
        <p className="text-xs text-texte-faible">{TEXTES_PINTEREST.domaineAide}</p>
      </div>
      <div className="border-t border-trait pt-3">
        <Interrupteur
          libelle={TEXTES_PINTEREST.interrupteur}
          detail={actif ? TEXTES_PINTEREST.ouvert : TEXTES_PINTEREST.ferme}
          coche={actif}
          desactive={interrupteur.desactive}
          onChange={changer}
        />
        <p className="mt-2 text-xs text-texte-faible">{vue.tourGeneral ? TEXTES_PINTEREST.tourOuvert : TEXTES_PINTEREST.tourFerme}</p>
        {interrupteur.raison && !enCours && (
          <p role="status" className="mt-2 text-sm text-ambre">{interrupteur.raison}</p>
        )}
      </div>
    </div>
  );
}
