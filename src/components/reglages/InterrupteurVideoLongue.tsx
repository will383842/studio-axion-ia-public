"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirVideoLongueActiveAction } from "@/app/(studio)/reglages/actions-video-longue";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";

export const DETAIL_VIDEO_LONGUE = "Éteint : rien n'est écrit ni fabriqué. Allumé : vous pouvez lancer une vidéo longue ; avec voix, chaque vidéo demande votre accord et reste sous 10 $.";

export function InterrupteurVideoLongue({ actif }: { actif: boolean }) {
  const router = useRouter();
  const [valeur, setValeur] = useState(actif);
  const [enCours, demarrer] = useTransition();

  function changer(v: boolean) {
    const avant = valeur;
    setValeur(v);
    demarrer(async () => {
      let r;
      try {
        r = await definirVideoLongueActiveAction(v);
      } catch {
        setValeur(avant);
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setValeur(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(v ? "Allumé" : "Éteint");
      router.refresh();
    });
  }

  return <Interrupteur libelle="Vidéo longue" detail={DETAIL_VIDEO_LONGUE} coche={valeur} desactive={enCours} onChange={changer} />;
}
