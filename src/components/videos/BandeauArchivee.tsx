"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { desarchiverVideosAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { noteRestauration } from "@/domaine/corbeille";
import { LIBELLES_RETRAIT } from "@/domaine/libelles";

/** Fiche d'une vidéo archivée : la seule action utile, « Restaurer », est dans le bandeau. */
export function BandeauArchivee({ videoId, corbeilleLe }: { videoId: string; corbeilleLe?: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
      <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-texte-doux">
        <Icone nom="archive" size={16} className="shrink-0" />
        Vidéo archivée. Rien n&apos;est effacé.
      </p>
      <Bouton
        icone="actualiser"
        chargement={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await desarchiverVideosAction([videoId]);
            if (!r.ok) return void notifier.erreur(r.message);
            notifier.succes(`Vidéo restaurée${noteRestauration(corbeilleLe)}`);
            router.refresh();
          })
        }
      >
        {LIBELLES_RETRAIT.retour}
      </Bouton>
    </div>
  );
}
