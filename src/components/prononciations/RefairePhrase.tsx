"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { demanderRetoucheAction } from "@/app/(studio)/videos/actions";
import { Bouton, Icone, notifier } from "@/components/ui";
import { contientMot } from "@/domaine/prononciations";
import { cn } from "@/lib/cn";

/** Un plan de la version, tel que la fiche vidéo le connaît. */
export interface PlanPhrase {
  id: string;
  debutSec: number;
  finSec: number;
  texte: string;
}

/** Plans qui contiennent le mot (variantes comprises) ; à défaut, le plan qui couvre l'instant donné. */
export function plansDuMot(plans: PlanPhrase[], mot: string, instantSec?: number): PlanPhrase[] {
  const avecMot = plans.filter((p) => contientMot(p.texte, mot));
  if (avecMot.length) return avecMot;
  if (instantSec === undefined) return [];
  const plan = plans.find((p) => instantSec >= p.debutSec && instantSec < p.finSec);
  return plan ? [plan] : [];
}

/**
 * « Refaire la phrase seulement » (n° 3, 9) : retouche des seuls plans qui contiennent le mot. Rien ne part sans le
 * geste de Will.
 */
export function RefairePhrase({ videoId, plans, mot, prononciation, className, compacte }: { videoId: string; plans: PlanPhrase[]; mot: string; prononciation: string; className?: string; compacte?: boolean }) {
  const router = useRouter();
  const [fait, setFait] = useState(false);
  const [enCours, demarrer] = useTransition();
  const ids = plans.map((p) => p.id);
  if (!ids.length) return null;
  if (fait) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-sauge", className)}>
        <Icone nom="coche" size={15} />
        La phrase est en cours de fabrication. L&apos;ancienne version reste.
      </p>
    );
  }

  function refaire() {
    demarrer(async () => {
      const demande = `Prononciation : « ${mot} » se dit « ${prononciation} »`;
      let r = await demanderRetoucheAction(videoId, ids, demande, false);
      // Geste direct : si le serveur demande un accord, il repart aussitôt avec lui (une seule relance).
      if (!r.ok && r.code === "CONFIRMATION_REQUISE") r = await demanderRetoucheAction(videoId, ids, demande, r.montant ?? true);
      if (!r.ok) return void notifier.erreur(r.message);
      setFait(true);
      notifier.succes("Phrase en cours de fabrication", "Seuls les plans de ce mot sont refaits.");
      router.refresh();
    });
  }

  return (
    <Bouton variante={compacte ? "contour" : "principal"} icone="reessayer" chargement={enCours} onClick={refaire} className={className} pleineLargeur={!compacte}>
      Refaire {ids.length > 1 ? `les ${ids.length} phrases` : "la phrase"}
    </Bouton>
  );
}
