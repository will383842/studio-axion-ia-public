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
 * « Refaire la phrase » (n° 3, 9) : UNE seule phrase est refaite (nouvelle prise de cette phrase, les autres gardent la
 * leur) et l'ancienne version reste. Ni prix ni budget : rien n'est montré, rien n'est estimé. S'il y a plusieurs phrases
 * avec le mot, on refait la première puis on recommence pour la suivante.
 */
export function RefairePhrase({ videoId, plans, mot, prononciation, className, compacte }: { videoId: string; plans: PlanPhrase[]; mot: string; prononciation: string; className?: string; compacte?: boolean }) {
  const router = useRouter();
  const [fait, setFait] = useState(false);
  const [enCours, demarrer] = useTransition();
  const plan = plans[0];

  if (!plan) return null;
  const idDuPlan = plan.id;
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
      const r = await demanderRetoucheAction(videoId, [idDuPlan], `Prononciation : « ${mot} » se dit « ${prononciation} »`, true);
      if (!r.ok) return void notifier.erreur(r.message);
      setFait(true);
      notifier.succes("Phrase en cours de fabrication", "Seule cette phrase est refaite.");
      router.refresh();
    });
  }

  return (
    <Bouton variante={compacte ? "contour" : "principal"} icone="reessayer" chargement={enCours} onClick={refaire} className={className} pleineLargeur={!compacte}>
      {plans.length > 1 ? `Refaire la phrase (1 sur ${plans.length})` : "Refaire la phrase"}
    </Bouton>
  );
}
