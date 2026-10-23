"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { lancerSerieAction, planSerieAction } from "@/app/(studio)/ecrire/serie/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { formaterMontant } from "@/lib/montants";
import type { PlanSerie } from "@/services/serie-ecriture";
import { ReglagesSujet, type EtatReglagesSujet } from "./ReglagesSujet";

export interface IdeeSerie {
  texte: string;
  ideeId?: string;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Confirmation d'une écriture en série (B7) : prix total maximum (N × prix d'un sujet, calculé par le studio), ce que
 * le budget du mois couvre, et les réglages communs. Rien ne part avant « Écrire ».
 */
export function FeuilleSerie({
  ouverte,
  onOuverteChange,
  idees,
  reglages,
  serieId,
  onLancee,
}: {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  idees: IdeeSerie[];
  reglages: EtatReglagesSujet;
  /** Intégration paquet 4 : série TikTok choisie dans l'atelier (chaque idée partie en devient un épisode). */
  serieId?: string;
  onLancee?: () => void;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanSerie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();
  // Un geste = une série : renvoyer deux fois la même demande ne relance rien.
  const cle = useRef<string | null>(null);
  const n = idees.length;

  useEffect(() => {
    if (!ouverte || !n) return;
    let actif = true;
    void planSerieAction(n).then((r) => {
      if (!actif) return;
      if (r.ok) {
        setPlan(r.donnees);
        setErreur(null);
      } else setErreur(r.message);
    });
    return () => {
      actif = false;
    };
  }, [ouverte, n]);

  const partiront = plan?.partiront ?? 0;

  function changerOuverture(v: boolean) {
    if (!v) {
      setPlan(null);
      cle.current = null;
    }
    onOuverteChange(v);
  }

  function ecrire() {
    if (!plan || !partiront || !reglages.format) return;
    cle.current ??= `serie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const c = cle.current;
    demarrer(async () => {
      // Garde argent (B6) : le total envoyé est celui affiché sur cette feuille ; le serveur le compare au prix du jour.
      const r = await lancerSerieAction(idees, { reseaux: reglages.reseaux, formatId: reglages.formatId, adresse: reglages.adresse, mode: reglages.qui, objectif: reglages.but, serieId }, c, plan.totalPartant.centimes, plan.partiront);
      if (!r.ok) {
        notifier.erreur(r.message);
        // Prix changé depuis l'ouverture : la feuille affiche le nouveau total, Will reconfirme d'un toucher.
        if (r.code === "CONFIRMATION_REQUISE") {
          cle.current = null;
          const p = await planSerieAction(n);
          if (p.ok) setPlan(p.donnees);
        }
        return;
      }
      const { partis, restes, essai } = r.donnees;
      const phrase = `${pluriel(partis, "idée")} en écriture${restes ? ` · ${restes} gardée${restes > 1 ? "s" : ""} en idée` : ""}`;
      if (essai) notifier.essai(`${phrase}, rien n'est payé`);
      else notifier.succes(phrase);
      changerOuverture(false);
      onLancee?.();
      router.push("/ecrire?onglet=idees");
      router.refresh();
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={changerOuverture}
      titre={n > 1 ? `Écrire ces ${n} idées` : "Écrire cette idée"}
      pied={
        <Bouton pleineLargeur taille="lg" icone="ecrire" disabled={!plan || !partiront || !reglages.pret} chargement={envoi || (!plan && !erreur)} onClick={ecrire}>
          {!plan ? "Calcul du prix" : partiront === 0 ? "Budget du mois atteint" : partiront < n ? `Écrire ${pluriel(partiront, "idée")} sur ${n}` : n > 1 ? `Écrire ces ${n} idées` : "Écrire"}
        </Bouton>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-carte border border-trait bg-surface-2 p-4" role="status" aria-live="polite">
          {erreur ? (
            <p className="text-sm font-semibold text-texte">{erreur}</p>
          ) : !plan ? (
            <p className="h-12 animate-pulse rounded bg-surface-1" aria-label="Calcul du prix" />
          ) : (
            <>
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-texte-doux">Au plus</span>
                <span className="text-2xl font-bold tabular-nums text-texte">{formaterMontant(plan.totalMax)}</span>
              </p>
              <p className="mt-1 text-xs text-texte-faible">
                {pluriel(n, "idée")} × {formaterMontant(plan.prixUnitaire)}
              </p>
              {plan.essai && (
                <p className="mt-3 flex items-center gap-2 text-xs text-texte-faible">
                  <PastilleEssai />
                  Rien n&apos;est payé tant que Claude n&apos;est pas branché.
                </p>
              )}
            </>
          )}
        </div>

        {plan && plan.partiront >= plan.demandees && plan.limite && (
          <div className="flex items-start gap-3 rounded-carte border border-ambre/40 bg-ambre-doux p-3">
            <Icone nom="attention" size={18} className="mt-0.5 shrink-0 text-ambre" />
            <p className="text-sm font-semibold leading-snug text-texte">
              {plan.limite === "claude" ? "Le repère d'écriture du mois est dépassé" : "Le budget indicatif du mois est dépassé"} : tout part quand même.{" "}
              <span className="font-normal text-texte-doux">Rien n&apos;est bloqué, l&apos;arrêt de sécurité reste à 5 fois le prix annoncé d&apos;un sujet.</span>
            </p>
          </div>
        )}

        {plan && plan.partiront < plan.demandees && (
          <div className="flex items-start gap-3 rounded-carte border border-ambre/40 bg-ambre-doux p-3">
            <Icone nom="attention" size={18} className="mt-0.5 shrink-0 text-ambre" />
            <p className="text-sm font-semibold leading-snug text-texte">
              {plan.partiront === 0
                ? plan.limite === "claude"
                  ? "La limite d'écriture du mois est atteinte."
                  : "Le budget du mois est atteint."
                : `${plan.limite === "claude" ? "La limite d'écriture du mois" : "Le budget du mois"} couvre ${pluriel(plan.partiront, "idée")} : ${plan.partiront > 1 ? "elles partent" : "elle part"} (au plus ${formaterMontant(plan.totalPartant)}).`}{" "}
              <span className="font-normal text-texte-doux">{plan.demandees - plan.partiront > 1 ? "Les autres restent en idée." : "L'autre reste en idée."}</span>
            </p>
          </div>
        )}

        <ul className="space-y-1.5" aria-label="Idées">
          {idees.slice(0, 3).map((x, i) => (
            <li key={`${x.ideeId ?? ""}-${i}`} className="flex items-center gap-2 text-sm text-texte">
              <Icone nom="idee" size={14} className="shrink-0 text-ambre" />
              <span className="truncate">{x.texte}</span>
            </li>
          ))}
          {n > 3 && <li className="pl-6 text-xs text-texte-faible">et {pluriel(n - 3, "autre")}</li>}
        </ul>

        <ReglagesSujet r={reglages} />
      </div>
    </FeuilleBas>
  );
}
