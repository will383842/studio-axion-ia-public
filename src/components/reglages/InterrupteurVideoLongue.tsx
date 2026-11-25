"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirVideoLongueActiveAction } from "@/app/(studio)/reglages/actions-video-longue";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";

export const DETAIL_VIDEO_LONGUE = "Éteint : rien n'est écrit ni fabriqué. Allumé : vous pouvez lancer une vidéo longue ; avec voix, chaque vidéo demande votre accord et reste dans la limite prévue. Sans voix, aucune voix payante n'est utilisée.";

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

  return (
    <div className="space-y-2">
      <Interrupteur libelle="Vidéo longue" detail={DETAIL_VIDEO_LONGUE} coche={valeur} desactive={enCours} onChange={changer} />
      {valeur && (
        <Link href="/videos/longue" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">
          Ouvrir la vidéo longue
        </Link>
      )}
    </div>
  );
}
