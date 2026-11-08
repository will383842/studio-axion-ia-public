"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirPageAPublierAction } from "@/app/(studio)/reglages/actions-a-publier";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";

export function InterrupteurAPublier({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [allume, setAllume] = useState(initial);
  const [enCours, demarrer] = useTransition();

  function changer(v: boolean) {
    const avant = allume;
    setAllume(v);
    demarrer(async () => {
      let r;
      try {
        r = await definirPageAPublierAction(v);
      } catch {
        setAllume(avant);
        notifier.erreur("Le choix n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setAllume(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(v ? "Allumé" : "Éteint");
      router.refresh();
    });
  }

  return <Interrupteur libelle="Page « Vidéos validées »" detail="Quand c'est allumé, le menu montre « Vidéos validées » : vos vidéos validées, classées par réseau, à télécharger ou à envoyer." coche={allume} desactive={enCours} onChange={changer} />;
}
