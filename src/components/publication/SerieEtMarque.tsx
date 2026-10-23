"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirVotreMarqueAction, rattacherVideoAction } from "@/app/(studio)/videos/actions";
import { ChoixSerie } from "@/components/ecrire/ChoixSerie";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { RAPPEL_VOTRE_MARQUE } from "@/domaine/votre-marque";
import { useVideo } from "./ContexteVideo";

/**
 * Kit de la vidéo (équipe 7) : la série (épisode automatique, même titre à l'écran et en tête de description) et
 * « Cette vidéo met en avant Axion IA » (pré-cochée d'après le texte ; à déclarer dans TikTok).
 */
export function SerieEtMarque() {
  const router = useRouter();
  const { kit, videoId } = useVideo();
  const [marque, setMarque] = useState(kit?.votreMarque.cochee ?? false);
  const [enCours, demarrer] = useTransition();
  if (!kit) return null;

  function changerSerie(serieId: string | undefined) {
    demarrer(async () => {
      const r = await rattacherVideoAction(videoId, serieId ?? null);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      if (r.donnees.episode) notifier.succes(`Épisode ${r.donnees.episode}`);
      router.refresh();
    });
  }

  function changerMarque(v: boolean) {
    setMarque(v);
    demarrer(async () => {
      const r = await definirVotreMarqueAction(videoId, v);
      if (!r.ok) {
        setMarque(!v);
        notifier.erreur(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-carte border border-trait bg-surface-1 p-4">
      <ChoixSerie series={kit.series} valeur={kit.serie?.id} onChange={changerSerie} detail={kit.serie?.episode ? `ép. ${kit.serie.episode}` : undefined} desactive={enCours} />
      <div className="h-px bg-trait" />
      <CaseACocher
        libelle="Cette vidéo met en avant Axion IA"
        detail={marque ? (kit.votreMarque.auto ? "Cochée : la vidéo parle d'Axion IA." : undefined) : undefined}
        coche={marque}
        onChange={changerMarque}
        desactive={enCours}
      />
      {marque && (
        <p className="flex items-start gap-2 rounded-2xl border border-ambre/40 bg-ambre-doux px-3 py-2.5 text-sm font-semibold text-texte">
          <Icone nom="certifie" size={16} className="mt-0.5 shrink-0 text-ambre" />
          {RAPPEL_VOTRE_MARQUE}
        </p>
      )}
    </div>
  );
}
