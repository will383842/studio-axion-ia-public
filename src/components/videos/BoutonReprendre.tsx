"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reprendreVideoAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";

/** « Reprendre » une vidéo arrêtée : elle repasse en brouillon et s'ouvre dans l'assistant. */
export function BoutonReprendre({ videoId, formatId }: { videoId: string; formatId: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Bouton
      icone="reessayer"
      chargement={enCours}
      onClick={() =>
        demarrer(async () => {
          const r = await reprendreVideoAction(videoId);
          if (!r.ok) {
            notifier.erreur(r.message);
            return;
          }
          router.push(`/nouvelle/${formatId}?brouillon=${videoId}`);
        })
      }
    >
      Reprendre
    </Bouton>
  );
}
