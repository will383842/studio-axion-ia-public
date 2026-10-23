"use client";

import { useState } from "react";
import { useNotificationsTelephone } from "@/components/coquille/EnregistrementPwa";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";

/** Une seule fois : allumer les notifications de ce téléphone (prête comme échec). Rien quand c'est déjà fait. */
export function PrevenirTelephone() {
  const { etat, activer } = useNotificationsTelephone();
  const [enCours, setEnCours] = useState(false);
  if (etat !== "a-activer") return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
      <Icone nom="cloche" size={18} className="shrink-0 text-orange-vif" />
      <p className="min-w-0 flex-1 text-[15px] text-texte">Être prévenu sur ce téléphone quand c&apos;est prêt ?</p>
      <Bouton
        variante="contour"
        chargement={enCours}
        onClick={async () => {
          setEnCours(true);
          const ok = await activer();
          setEnCours(false);
          if (ok) notifier.succes("C'est noté", "Ce téléphone sera prévenu, que la vidéo soit prête ou non.");
        }}
        className="shrink-0"
      >
        Oui
      </Bouton>
    </div>
  );
}
