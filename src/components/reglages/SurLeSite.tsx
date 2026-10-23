"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirSiteAutoAction, definirSiteGenerateurAction } from "@/app/(studio)/reglages/actions-site";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import type { ConseilSite, LigneReglageSite } from "@/domaine/site-videos/types";

export const TEXTES_SUR_LE_SITE = {
  intro: "Choisissez les types de vidéo qui peuvent aller sur votre site. Rien n'est envoyé sans votre accord, vidéo par vidéo.",
  autoLibelle: "Envoi automatique",
  autoAide: "Après la fabrication, la vidéo est préparée pour le site. Elle ne part que si tout est en règle.",
} as const;

const CONSEILS: Record<ConseilSite, { libelle: string; ton: "sauge" | "ambre" | "neutre" }> = {
  oui: { libelle: "Conseillé", ton: "sauge" },
  "au-cas-par-cas": { libelle: "Au cas par cas", ton: "ambre" },
  non: { libelle: "Déconseillé", ton: "neutre" },
};

/** Réglages → Sur le site : un interrupteur par type de vidéo (tous éteints au départ), avec le conseil du plan. */
export function SurLeSite({ lignes }: { lignes: LigneReglageSite[] }) {
  const router = useRouter();
  const [etat, setEtat] = useState(lignes);
  const [enCours, demarrer] = useTransition();

  function changer(formatId: string, cle: "generateur" | "auto", valeur: boolean) {
    const avant = etat;
    setEtat(etat.map((l) => (l.formatId === formatId ? { ...l, [cle]: valeur, ...(cle === "generateur" && !valeur ? { auto: false } : {}) } : l)));
    demarrer(async () => {
      const res = await (cle === "generateur" ? definirSiteGenerateurAction(formatId, valeur) : definirSiteAutoAction(formatId, valeur));
      if (!res.ok) {
        setEtat(avant);
        notifier.erreur(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-texte-faible">{TEXTES_SUR_LE_SITE.intro}</p>
      <ul className="divide-y divide-trait">
        {etat.map((l) => (
          <li key={l.formatId} className="space-y-1 py-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Interrupteur libelle={l.nom} coche={l.generateur} desactive={enCours} onChange={(v) => changer(l.formatId, "generateur", v)} />
              </div>
              <Pastille ton={CONSEILS[l.conseil].ton}>{CONSEILS[l.conseil].libelle}</Pastille>
            </div>
            <div className="pl-12">
              <Interrupteur libelle={TEXTES_SUR_LE_SITE.autoLibelle} detail={TEXTES_SUR_LE_SITE.autoAide} coche={l.auto} desactive={enCours || !l.generateur} onChange={(v) => changer(l.formatId, "auto", v)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
