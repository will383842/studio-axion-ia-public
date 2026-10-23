"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirInterrupteurEcritureAction } from "@/app/(studio)/reglages/actions-interrupteurs-ecriture";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";
import type { CleInterrupteurEcriture, EtatInterrupteursEcriture } from "@/services/interrupteurs-ecriture";

export const TEXTES_INTERRUPTEURS_ECRITURE = {
  bandeau: "Ne pas allumer pendant qu'une écriture est en cours.",
  pasBranche: "Pas encore actif : en cours de branchement.",
} as const;

const LIGNES: { cle: CleInterrupteurEcriture; libelle: string; detail: string }[] = [
  { cle: "ecriture.memoireCentrale", libelle: "Variété des scripts centraux", detail: "Quand c'est allumé, l'outil se souvient des 60 derniers scripts et évite de les recopier." },
  { cle: "ecriture.memoireTableau", libelle: "Variété des tableaux", detail: "Quand c'est allumé, l'outil se souvient des derniers tableaux et change d'accroche." },
  { cle: "ecriture.memoireCasConcret", libelle: "Variété des cas concrets", detail: "Quand c'est allumé, l'outil se souvient des derniers cas concrets et évite de les répéter." },
  { cle: "adaptations_reseaux.actif", libelle: "Adaptation par réseau", detail: "Quand c'est allumé, chaque réseau reçoit une version adaptée de la vidéo. Pour l'instant, seule la coupe des parties facultatives de LinkedIn est branchée : ne l'allumez pas avant la répétition générale." },
];

export function InterrupteursEcriture({ etat, adaptationsBranchees }: { etat: EtatInterrupteursEcriture; adaptationsBranchees: boolean }) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState(etat);
  const [enCours, demarrer] = useTransition();

  function changer(cle: CleInterrupteurEcriture, v: boolean) {
    const avant = valeurs[cle];
    setValeurs((s) => ({ ...s, [cle]: v }));
    demarrer(async () => {
      let r;
      try {
        r = await definirInterrupteurEcritureAction(cle, v);
      } catch {
        setValeurs((s) => ({ ...s, [cle]: avant }));
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setValeurs((s) => ({ ...s, [cle]: avant }));
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(v ? "Allumé" : "Éteint");
      router.refresh();
    });
  }

  return (
    <div>
      <p role="note" className="mb-2 text-xs text-texte-doux">
        {TEXTES_INTERRUPTEURS_ECRITURE.bandeau}
      </p>
      {LIGNES.map((l) => {
        const bloque = l.cle === "adaptations_reseaux.actif" && !adaptationsBranchees && !valeurs[l.cle];
        return (
          <Interrupteur
            key={l.cle}
            libelle={l.libelle}
            detail={
              bloque ? (
                <>
                  {l.detail} <span className="block text-texte-doux">{TEXTES_INTERRUPTEURS_ECRITURE.pasBranche.toLowerCase().replace(/\.$/, "")}</span>
                </>
              ) : (
                l.detail
              )
            }
            coche={valeurs[l.cle]}
            desactive={enCours || bloque}
            onChange={(v) => changer(l.cle, v)}
          />
        );
      })}
    </div>
  );
}
