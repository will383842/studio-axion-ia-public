"use client";

/**
 * SON DES PLANS, APRÈS FABRICATION (lot du 02/10, D1) : la courbe d'intensité de la version, puis, plan par plan,
 * « Auto », « Aucun son » ou un son choisi. « Appliquer » ne refait que le mixage : gratuit, nouvelle version.
 */
import { useState, useTransition } from "react";
import { CourbeIntensite } from "@/components/intensite/CourbeIntensite";
import { SonDuPlan } from "@/components/intensite/SonDuPlan";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import type { ChoixBruitagePlan } from "@/domaine/types";
import { chrono } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { SonsDeLaVersion } from "@/services/bruitages";
import { appliquerSonsAction, sonDuPlanVideoAction } from "./actions-sons";

/**
 * Libellé d'un plan : ce que la vidéo contient VRAIMENT (E2E-1 n° 9). Un choix pas encore appliqué le dit ; quand la
 * vidéo ne peut pas changer de son (`refaisable` faux), seul le son posé compte.
 */
export function libelleSonPlan(p: SonsDeLaVersion["plans"][number], refaisable: boolean, enAttente: boolean): string | null {
  const actuel = p.pose ? "Son" : null;
  if (!refaisable || !p.choix) return actuel;
  const voulu = p.choix.mode === "retire" ? "Aucun son" : p.choix.mode === "ajoute" ? "Son choisi" : actuel;
  return enAttente && voulu !== actuel ? `${voulu ?? "Son auto"} · à appliquer` : voulu;
}

export function SonsDesPlans({ videoId, donnees, modifiable, refaisable = true }: { videoId: string; donnees: SonsDeLaVersion; modifiable: boolean; refaisable?: boolean }) {
  // Pas de choix proposé quand c'est impossible, comme pour les sous-titres (`recalquePossible`).
  const choixPossible = modifiable && refaisable;
  const [etat, setEtat] = useState(donnees);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  function choisir(planId: string, choix: ChoixBruitagePlan | null) {
    demarrer(async () => {
      const r = await sonDuPlanVideoAction(videoId, planId, choix);
      if (r.ok && r.donnees) setEtat(r.donnees);
      else if (!r.ok) notifier.erreur(r.message);
    });
  }

  function appliquer() {
    demarrer(async () => {
      const r = await appliquerSonsAction(videoId);
      if (r.ok) {
        notifier.succes("Le son est refait. Gratuit.");
        setEtat((e) => ({ ...e, enAttente: false }));
      } else notifier.erreur(r.message);
    });
  }

  return (
    <section aria-label="Son des plans" className="space-y-3">
      {etat.rapport && <CourbeIntensite rapport={etat.rapport} marques={etat.plans.filter((p) => p.pose).map((p) => ({ tSec: p.debutSec, libelle: `Son, plan ${p.ordre}` }))} />}
      <ul className="divide-y divide-trait rounded-2xl border border-trait bg-surface-1">
        {etat.plans.map((p) => {
          const actif = ouvert === p.id;
          const libelle = libelleSonPlan(p, refaisable, etat.enAttente);
          return (
            <li key={p.id} className="px-3 py-2">
              <button type="button" onClick={() => setOuvert(actif ? null : p.id)} aria-expanded={choixPossible ? actif : undefined} disabled={!choixPossible} className="flex min-h-11 w-full items-center gap-3 text-left">
                <span className="w-8 shrink-0 text-xs font-bold tabular-nums text-texte-faible">{p.ordre}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-texte">{p.texte || "—"}</span>
                  <span className="block text-xs tabular-nums text-texte-faible">{chrono(p.debutSec)}</span>
                </span>
                {libelle && (
                  <span className={cn("flex shrink-0 items-center gap-1 text-xs font-semibold", libelle.startsWith("Aucun") ? "text-texte-faible" : "text-orange-vif")}>
                    <Icone nom="volume" size={13} />
                    {libelle}
                  </span>
                )}
              </button>
              {actif && choixPossible && (
                <div className="pb-2 pt-1">
                  <SonDuPlan choix={p.choix} prevu={p.choix ? undefined : p.pose} desactive={envoi} onChange={(c) => choisir(p.id, c)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!refaisable && (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-texte-doux">
          <Icone nom="info" size={15} className="mt-0.5 shrink-0 text-texte-faible" />
          Le son de cette vidéo ne se change pas plan par plan. Pour le changer, il faut refaire la vidéo.
        </p>
      )}
      {etat.enAttente && choixPossible && (
        <Bouton icone="son" pleineLargeur chargement={envoi} onClick={appliquer}>
          Appliquer · gratuit
        </Bouton>
      )}
    </section>
  );
}
