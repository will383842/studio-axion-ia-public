"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirGardeSujetsAction } from "@/app/(studio)/reglages/actions-garde-sujets";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { GardeSujets } from "@/domaine/sujets-traites";

export const TEXTES_GARDE_SUJETS = {
  libelle: "Sujets déjà traités",
  bloquant: "Bloquer (conseillé)",
  avertissement: "Prévenir seulement",
  eteint: "Éteint",
  detailBloquant: "Un sujet déjà traité est refusé.",
  detailEteint: "Aucun contrôle.",
} as const;

/** Réglages › Écriture : que faire quand un sujet a déjà été traité (défaut « bloquer »). */
export function GardeSujetsReglage({ garde }: { garde: GardeSujets }) {
  const router = useRouter();
  const [choix, setChoix] = useState<GardeSujets>(garde);
  const [enCours, demarrer] = useTransition();

  function choisir(v: GardeSujets) {
    if (enCours || v === choix) return;
    const avant = choix;
    setChoix(v);
    demarrer(async () => {
      let r;
      try {
        r = await definirGardeSujetsAction(v);
      } catch {
        setChoix(avant);
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setChoix(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes("Choix enregistré");
      router.refresh();
    });
  }

  return (
    <SelecteurPastilles<GardeSujets>
      libelle={TEXTES_GARDE_SUJETS.libelle}
      valeur={choix}
      onChange={choisir}
      options={(["bloquant", "avertissement", "eteint"] as const).map((v) => ({
        valeur: v,
        libelle: TEXTES_GARDE_SUJETS[v],
        ...(v === "bloquant" ? { detail: TEXTES_GARDE_SUJETS.detailBloquant } : v === "eteint" ? { detail: TEXTES_GARDE_SUJETS.detailEteint } : {}),
        desactive: enCours,
      }))}
    />
  );
}
