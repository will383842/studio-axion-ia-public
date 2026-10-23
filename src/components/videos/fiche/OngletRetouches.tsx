"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { demanderRetoucheAction, estimerRetoucheAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { Retouche } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { chrono } from "@/lib/dates";
import { centimes, formaterMontant } from "@/lib/montants";
import { IlYA } from "@/components/ui/IlYA";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

export interface PlanRetouche {
  id: string;
  ordre: number;
  debutSec: number;
  finSec: number;
  texte: string;
  vignette: string | null;
  verrouille: boolean;
}

const STATUTS: Record<Retouche["statut"], { libelle: string; ton: "neutre" | "orange" | "sauge" | "brique" }> = {
  demandee: { libelle: "Demandée", ton: "neutre" },
  en_cours: { libelle: "En cours", ton: "orange" },
  faite: { libelle: "Faite", ton: "sauge" },
  echec: { libelle: "À corriger", ton: "brique" },
};

/** Retouches tout faites d'un plan (plan A §2 étape 9 b) : un toucher remplit la consigne. */
const TOUT_FAITS = ["Autre illustration", "Autre angle", "Plus serré", "Plus large", "Refaire le visage"] as const;

/**
 * Retouches (niveau 3) : choisir des plans, une consigne (ou un des 5 boutons tout faits), voir le coût, « Refaire ».
 * Corriger un mot se fait dans l'onglet Sous-titres (gratuit).
 */
export function OngletRetouches({
  videoId,
  plans,
  retouches,
  possible,
  essai,
}: {
  videoId: string;
  plans: PlanRetouche[];
  retouches: Retouche[];
  /** Faux pendant une fabrication en cours. */
  possible: boolean;
  essai: boolean;
}) {
  const router = useRouter();
  const [choisis, setChoisis] = useState<string[]>([]);
  const [consigne, setConsigne] = useState("");
  const [cout, setCout] = useState<{ centimes: number; dureeSec: number } | null>(null);
  const [envoi, demarrer] = useTransition();

  useEffect(() => {
    if (!choisis.length) return;
    let annule = false;
    const t = setTimeout(async () => {
      const r = await estimerRetoucheAction(videoId, choisis);
      if (!annule && r.ok) setCout(r.donnees);
    }, 250);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [choisis, videoId]);

  if (!plans.length) return <EtatVide compact icone="ciseaux" titre="Aucun plan" phrase="Les plans apparaissent avec la vidéo." />;

  const basculer = (id: string) => setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {plans.map((p) => {
          const choisi = choisis.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={choisi}
                disabled={!possible}
                onClick={() => basculer(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-2 pr-3 text-left transition-colors disabled:opacity-50",
                  choisi ? "border-orange bg-orange-doux" : "border-trait bg-surface-1 hover:border-trait-fort",
                )}
              >
                <span className="relative aspect-[9/16] w-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {p.vignette && <Image src={p.vignette} alt="" fill sizes="44px" className="object-cover" />}
                  <span className="absolute inset-x-0 bottom-0 bg-fond/70 text-center text-[10px] font-bold text-texte">{p.ordre}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] tabular-nums text-texte-faible">
                    {chrono(p.debutSec)} – {chrono(p.finSec)}
                  </span>
                  <span className="line-clamp-2 text-sm text-texte">{p.texte}</span>
                </span>
                {p.verrouille && <Icone nom="cadenas" size={14} className="shrink-0 text-orange-vif" aria-label="Choix verrouillé" />}
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2", choisi ? "border-orange bg-orange text-sur-orange" : "border-trait-fort")}>
                  {choisi && <Icone nom="coche" size={13} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {choisis.length > 0 && (
        <div className="rounded-carte border border-trait bg-surface-1 p-4">
          <div className="sans-barre -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {TOUT_FAITS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={consigne === t}
                onClick={() => setConsigne(t)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                  consigne === t ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-2 text-texte-doux hover:text-texte",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <ZoneTexte libelle="Ce qu'il faut changer" value={consigne} onChange={(e) => setConsigne(e.target.value)} placeholder="Ex. : un sourire plus naturel" longueurMax={280} />
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-texte-faible">Coût estimé</p>
              <p className="font-titre text-2xl tabular-nums text-texte">{cout ? formaterMontant(centimes(cout.centimes)) : "…"}</p>
            </div>
            <Bouton
              icone="reessayer"
              essai={essai}
              chargement={envoi}
              disabled={!consigne.trim() || !possible}
              onClick={() =>
                demarrer(async () => {
                  let r = await demanderRetoucheAction(videoId, choisis, consigne);
                  // Au-delà du seuil du mois : confirmation explicite (AV2.2-9).
                  r = await avecConfirmationPrix(r, (accord) => demanderRetoucheAction(videoId, choisis, consigne, accord));
                  if (!r.ok) {
                    notifier.erreur(r.message);
                    return;
                  }
                  if (essai) notifier.essai("la retouche est simulée, une nouvelle version arrive");
                  else notifier.succes("Retouche lancée", "Une nouvelle version arrive.");
                  setChoisis([]);
                  setConsigne("");
                  router.refresh();
                })
              }
            >
              Refaire {choisis.length > 1 ? `${choisis.length} plans` : "ce plan"}
            </Bouton>
          </div>
        </div>
      )}

      {retouches.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Déjà demandées</p>
          <ul className="space-y-2">
            {[...retouches].reverse().map((r) => (
              <li key={r.id} className="flex min-h-14 items-center gap-3 rounded-2xl border border-trait bg-surface-1 px-3 py-2">
                <Icone nom="ciseaux" size={16} className="shrink-0 text-texte-faible" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-texte">{r.consigne}</span>
                  <span className="text-xs text-texte-faible">
                    {r.planIds.length} plan{r.planIds.length > 1 ? "s" : ""} · <IlYA iso={r.creeLe} />
                  </span>
                </span>
                <Pastille ton={STATUTS[r.statut].ton}>{STATUTS[r.statut].libelle}</Pastille>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
