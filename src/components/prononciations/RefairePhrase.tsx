"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { demanderRetoucheAction, estimerRetoucheAction } from "@/app/(studio)/videos/actions";
import { Bouton, Icone, notifier } from "@/components/ui";
import { contientMot } from "@/domaine/prononciations";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";

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
 * « Refaire la phrase seulement » (n° 3, 9) : retouche des seuls plans qui contiennent le mot, avec le coût estimé
 * AVANT. Rien ne part sans le geste de Will ; au-delà du seuil habituel, une confirmation est demandée.
 */
export function RefairePhrase({ videoId, plans, mot, prononciation, className, compacte }: { videoId: string; plans: PlanPhrase[]; mot: string; prononciation: string; className?: string; compacte?: boolean }) {
  const router = useRouter();
  const [cout, setCout] = useState<number | null>(null);
  // Paquet 4 (D2) : montant renvoyé par le serveur au-delà du seuil ; il repart avec l'accord (`true` sans montant).
  const [confirmer, setConfirmer] = useState<number | boolean>(false);
  const [fait, setFait] = useState(false);
  const [enCours, demarrer] = useTransition();
  const ids = plans.map((p) => p.id);
  const cle = ids.join(",");

  useEffect(() => {
    if (!cle) return;
    let annule = false;
    void estimerRetoucheAction(videoId, cle.split(",")).then((r) => {
      if (!annule && r.ok) setCout(r.donnees.centimes);
    });
    return () => {
      annule = true;
    };
  }, [videoId, cle]);

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
      const r = await demanderRetoucheAction(videoId, ids, `Prononciation : « ${mot} » se dit « ${prononciation} »`, confirmer);
      if (!r.ok) {
        if (r.code === "CONFIRMATION_REQUISE") {
          setConfirmer(r.montant ?? true);
          return void notifier.info(r.message);
        }
        return void notifier.erreur(r.message);
      }
      setFait(true);
      notifier.succes("Phrase en cours de fabrication", "Seuls les plans de ce mot sont refaits.");
      router.refresh();
    });
  }

  const affiche = typeof confirmer === "number" ? confirmer : cout;
  const prix = affiche === null ? "" : affiche === 0 ? " · gratuit" : ` · ${formaterMontant({ centimes: affiche, devise: "EUR" })}`;
  return (
    <Bouton variante={compacte ? "contour" : "principal"} icone="reessayer" chargement={enCours} onClick={refaire} className={className} pleineLargeur={!compacte}>
      {confirmer ? `Confirmer${prix}` : `Refaire ${ids.length > 1 ? `les ${ids.length} phrases` : "la phrase"}${prix}`}
    </Bouton>
  );
}
