"use client";

/**
 * RÉGLAGES › CONNEXIONS › DOUBLE (lot R7e). Will allume lui-même « Votre avatar parle dans le studio » : le studio fait
 * alors parler son avatar HeyGen, sur un texte validé, avec sa voix clonée (payant, prix annoncé et confirmé avant
 * chaque vidéo). Éteint par défaut. Phrases simples, aucun nom technique.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirLooksStudioAction, definirRenduDoubleAction } from "@/app/(studio)/reglages/actions";
import { Icone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { Montant } from "@/domaine/types";
import { formaterMontant } from "@/lib/montants";

export type FondAvatar = "sans-fond" | "uni";

export const TEXTES_DOUBLE = {
  titre: "Votre avatar parle dans le studio",
  allume: "Le studio fait parler votre avatar avec votre voix, sur le texte validé. Le prix est annoncé et confirmé avant chaque vidéo.",
  eteint: "Éteint : vous faites vos vidéos dans l'application HeyGen et vous les rattachez à leur version.",
  prix: (minute: Montant) => `Environ ${formaterMontant(minute)} par minute de vidéo.`,
  fond: "Fond de votre avatar",
  sansFond: "Sans fond, posé sur vos décors",
  uni: "Fond uni",
  looks: "Créer vos décors avec HeyGen",
  looksAllume: "Depuis « Décrivez » ou un décor, le studio crée votre avatar dans la pièce et la tenue décrites. Le prix est montré et confirmé avant chaque création.",
  looksEteint: "Éteint : vos décors se font dans l'application HeyGen, puis vous les reliez ici.",
  consigne:
    "Pour « sans fond », votre avatar doit avoir été créé dans HeyGen avec le fond détouré (c'est le cas des avatars récents). Si HeyGen le refuse, le studio passe tout seul au fond uni quand rien n'est encore payé, sinon il vous le dit.",
} as const;

export function ReglageDouble({ initial }: { initial: { allume: boolean; fond: FondAvatar; prixMinute: Montant; looks?: boolean } }) {
  const router = useRouter();
  const [r, setR] = useState(initial);
  const [enCours, demarrer] = useTransition();

  function enregistrer(suivant: { allume?: boolean; fond?: FondAvatar }, succes: string) {
    const avant = r;
    setR({ ...r, ...suivant });
    demarrer(async () => {
      const res = await definirRenduDoubleAction(suivant);
      if (!res.ok) {
        setR(avant);
        notifier.erreur(res.message);
        return;
      }
      notifier.succes(succes);
      router.refresh();
    });
  }

  return (
    <div id="double" className="scroll-mt-24 space-y-3 border-t border-trait pt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-texte-faible">Double</p>
      <Interrupteur
        icone="visage"
        libelle={TEXTES_DOUBLE.titre}
        detail={r.allume ? TEXTES_DOUBLE.allume : TEXTES_DOUBLE.eteint}
        coche={r.allume}
        desactive={enCours}
        onChange={(v) => enregistrer({ allume: v }, v ? "Votre avatar parlera dans le studio" : "Votre avatar ne parle plus dans le studio")}
      />
      <p className="flex items-start gap-2 text-sm text-texte-doux">
        <Icone nom="euro" size={15} className="mt-0.5 shrink-0" />
        {TEXTES_DOUBLE.prix(r.prixMinute)}
      </p>
      <SelecteurPastilles<FondAvatar>
        libelle={TEXTES_DOUBLE.fond}
        valeur={r.fond}
        onChange={(fond) => enregistrer({ fond }, "Fond enregistré")}
        options={[
          { valeur: "sans-fond", libelle: TEXTES_DOUBLE.sansFond },
          { valeur: "uni", libelle: TEXTES_DOUBLE.uni },
        ]}
      />
      <p className="flex items-start gap-2 text-xs text-texte-faible">
        <Icone nom="info" size={13} className="mt-0.5 shrink-0" />
        {TEXTES_DOUBLE.consigne}
      </p>
      <Interrupteur
        icone="image"
        libelle={TEXTES_DOUBLE.looks}
        detail={r.looks ? TEXTES_DOUBLE.looksAllume : TEXTES_DOUBLE.looksEteint}
        coche={!!r.looks}
        desactive={enCours}
        onChange={(v) => {
          const avant = r;
          setR({ ...r, looks: v });
          demarrer(async () => {
            const res = await definirLooksStudioAction(v);
            if (!res.ok) {
              setR(avant);
              notifier.erreur(res.message);
              return;
            }
            notifier.succes(v ? "Le studio pourra créer vos décors avec HeyGen" : "Vos décors se font dans l'application HeyGen");
            router.refresh();
          });
        }}
      />
    </div>
  );
}
