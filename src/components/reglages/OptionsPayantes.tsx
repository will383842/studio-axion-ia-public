"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirOptionsPayantesCoupeesAction } from "@/app/(studio)/reglages/actions-options-payantes";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";

/**
 * Vérif V4 : « Couper toutes les options payantes » (Réglages › Budget). Allumé : aucune carte « Option payante »
 * n'est proposée et rien ne part, même une option déjà confirmée ; les vidéos sortent dans leur version gratuite.
 * Éteint (par défaut) : chaque option payante demande votre accord sur sa carte, à chaque fois.
 */
export const TEXTES_OPTIONS_PAYANTES = {
  libelle: "Couper toutes les options payantes",
  coupees: "Aucune option payante n'est proposée : vos vidéos sortent dans leur version gratuite.",
  permises: "Chaque option payante vous demande votre accord avant, à chaque fois.",
} as const;

export function OptionsPayantes({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [coupees, setCoupees] = useState(initial);
  const [enCours, demarrer] = useTransition();

  function changer(v: boolean) {
    const avant = coupees;
    setCoupees(v);
    demarrer(async () => {
      const r = await definirOptionsPayantesCoupeesAction(v);
      if (!r.ok) {
        setCoupees(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(v ? "Options payantes coupées" : "Options payantes permises, avec votre accord à chaque fois");
      router.refresh();
    });
  }

  return <Interrupteur icone="bouclier" libelle={TEXTES_OPTIONS_PAYANTES.libelle} detail={coupees ? TEXTES_OPTIONS_PAYANTES.coupees : TEXTES_OPTIONS_PAYANTES.permises} coche={coupees} desactive={enCours} onChange={changer} />;
}
