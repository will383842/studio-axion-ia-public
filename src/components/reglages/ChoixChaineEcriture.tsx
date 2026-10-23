"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirChaineEcritureAction } from "@/app/(studio)/reglages/actions-chaine";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { ChaineChoisie } from "@/services/chaine-ecriture";

/** Coûts mesurés au banc du 18/10 (5 sujets) : à mettre à jour si un nouveau banc les change. */
export const TEXTES_CHAINE = {
  libelle: "Chaîne d'écriture",
  courte: { libelle: "Économique", cout: "≈ 0,28 $ par script" },
  avertissement: "S'applique aux prochains scripts.",
} as const;

export function ChoixChaineEcriture({ initiale }: { initiale: ChaineChoisie }) {
  const router = useRouter();
  const [chaine, setChaine] = useState<ChaineChoisie>(initiale);
  const [enCours, demarrer] = useTransition();

  function choisir(v: ChaineChoisie) {
    if (enCours || v === chaine) return;
    const avant = chaine;
    setChaine(v);
    demarrer(async () => {
      let r;
      try {
        r = await definirChaineEcritureAction(v);
      } catch {
        setChaine(avant);
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setChaine(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(`Chaîne ${TEXTES_CHAINE.courte.libelle} choisie`);
      router.refresh();
    });
  }

  return (
    <div>
      <SelecteurPastilles<ChaineChoisie>
        libelle={TEXTES_CHAINE.libelle}
        valeur={chaine}
        onChange={choisir}
        taille="lg"
        options={[
          { valeur: "courte", libelle: TEXTES_CHAINE.courte.libelle, detail: TEXTES_CHAINE.courte.cout, desactive: enCours },
        ]}
      />
      <p className="mt-2 text-xs text-texte-faible">{TEXTES_CHAINE.avertissement}</p>
    </div>
  );
}
