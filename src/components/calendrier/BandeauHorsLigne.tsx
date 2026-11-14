"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";

function abonner(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

/**
 * Bandeau « hors ligne » du calendrier (CAL-13), posé en haut de la zone. Il dit clairement qu'aucun geste n'est
 * enregistré tant que le réseau est absent : rien n'est perdu EN SILENCE. `enLigne` ne sert qu'aux tests.
 */
export function BandeauHorsLigne({ enLigne }: { enLigne?: boolean }) {
  const reel = useSyncExternalStore(abonner, () => navigator.onLine, () => true);
  if (enLigne ?? reel) return null;
  return (
    <div role="status" data-etat="hors-ligne" className="mb-3 flex items-start gap-2 rounded-xl border border-ambre bg-surface-1 px-4 py-2.5 text-sm text-texte">
      <Icone nom="hors-ligne" size={16} className="mt-0.5 shrink-0" />
      <p>Vous êtes hors ligne : vos changements ne sont pas enregistrés. Reprenez au retour du réseau.</p>
    </div>
  );
}

/** Bandeau « envoi automatique éteint » (CAL-13) : le lien mène à la page des interrupteurs. */
export function BandeauEnvoiEteint({ eteint }: { eteint: boolean }) {
  if (!eteint) return null;
  return (
    <div role="status" data-etat="envoi-eteint" className="mb-3 flex items-start gap-2 rounded-xl border border-ambre bg-surface-1 px-4 py-2.5 text-sm text-texte">
      <Icone nom="attention" size={16} className="mt-0.5 shrink-0" />
      <p>
        L&apos;envoi automatique est éteint : rien ne partira.{" "}
        <Link href="/calendrier/securite" className="font-semibold underline underline-offset-[3px]">Allumer</Link>
      </p>
    </div>
  );
}
