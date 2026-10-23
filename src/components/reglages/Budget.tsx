"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirBudgetAction, definirTauxAction } from "@/app/(studio)/reglages/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { JaugeBudget } from "@/components/ui/JaugeBudget";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import type { Montant } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import type { TableauCouts } from "@/services/couts";
import type { BudgetUsine } from "@/services/budget-mensuel";

export interface CoutsMoisVue {
  mois: string;
  libelle: string;
  total: Montant;
  parFournisseur: { fournisseur: string; total: Montant }[];
}

/**
 * Budget et coûts (AV2.2-9 ; tableau du lot M1b, B.9 ter) : jauge du mois, budget + seuil de confirmation
 * + taux dollar → euro modifiables, coût moyen d'une vidéo et écart entre le prix annoncé et le prix réel,
 * dépenses du mois par outil, coûts des 3 derniers mois et détail par poste.
 */
export function Budget({ budget, depense, seuil, mois, tableau, engage, essai, usine }: { budget: Montant; depense: Montant; seuil: Montant; mois: CoutsMoisVue[]; tableau?: TableauCouts; engage?: Montant; essai?: Montant; usine?: BudgetUsine | null }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [montant, setMontant] = useState(String(budget.centimes / 100));
  const [limite, setLimite] = useState(String(seuil.centimes / 100));
  const [taux, setTaux] = useState(String(tableau?.tauxUsdEur ?? 0.9).replace(".", ","));
  const [moisChoisi, setMoisChoisi] = useState(mois[mois.length - 1]?.mois);
  const [enCours, demarrer] = useTransition();
  const max = Math.max(1, ...mois.map((m) => m.total.centimes));
  const detail = mois.find((m) => m.mois === moisChoisi) ?? mois[mois.length - 1];
  const maxPoste = Math.max(1, ...(detail?.parFournisseur.map((p) => p.total.centimes) ?? [1]));
  const lire = (s: string) => Number.parseFloat(s.replace(",", ".").replace(/\s/g, ""));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <JaugeBudget depense={depense} budget={budget} className="flex-1" />
        <Bouton variante="secondaire" onClick={() => setOuverte(true)}>
          Modifier
        </Bouton>
      </div>
      <p className="-mt-3 text-sm text-texte-faible">Confirmation au-delà de {formaterMontant(seuil, { court: true })} par vidéo.</p>
      {/* E2E-2 argent n° 5 et 6 : ce qui est déjà engagé (fabrications en cours) compte dans le reste du mois ; les essais
          (montants simulés) sont montrés à part et ne sont pas payés. */}
      {!!engage?.centimes && (
        <p className="-mt-4 text-sm tabular-nums text-texte-doux">
          Dont {formaterMontant(engage, { court: true })} engagés par les fabrications en cours.
        </p>
      )}
      {!!essai?.centimes && (
        <p className="-mt-4 flex flex-wrap items-center gap-2 text-sm tabular-nums text-texte-faible">
          <PastilleEssai /> Essais ce mois-ci : {formaterMontant(essai, { court: true })}, pas payés, hors budget.
        </p>
      )}

      {/* L1-09 : budget du mois envoyé par l'Usine, en lecture seule ici (il se règle dans l'Usine, sous le plafond ci-dessus). */}
      {usine !== undefined && (
        <p className="-mt-4 text-sm tabular-nums text-texte-doux">
          {usine
            ? `Budget reçu de l'Usine ce mois-ci : ${formaterMontant({ centimes: usine.budget_mensuel_cents, devise: "EUR" }, { court: true })}, réglé dans l'Usine sous votre plafond.`
            : "Aucun budget reçu de l'Usine ce mois-ci : ses commandes ne partent pas. Vos propres lancements ne sont pas touchés."}
        </p>
      )}

      {tableau && (
        <>
          {/* Coût moyen et écart annoncé / réel (vidéos terminées ce mois-ci) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-carte border border-trait bg-surface-2 p-3">
              <p className="text-xs font-semibold text-texte-faible">Coût moyen d&apos;une vidéo</p>
              <p className="mt-1 font-titre text-xl tabular-nums text-texte">{tableau.coutMoyen ? formaterMontant(tableau.coutMoyen) : "—"}</p>
              <p className="text-xs text-texte-faible">{tableau.nbVideos > 1 ? `${tableau.nbVideos} vidéos ce mois-ci` : tableau.nbVideos === 1 ? "1 vidéo ce mois-ci" : "Aucune vidéo ce mois-ci"}</p>
            </div>
            <div className="rounded-carte border border-trait bg-surface-2 p-3">
              <p className="text-xs font-semibold text-texte-faible">Annoncé / réel</p>
              <p className={cn("mt-1 font-titre text-xl tabular-nums", !tableau.ecart ? "text-texte" : tableau.ecart.pourcentage > 10 ? "text-brique" : "text-sauge")}>
                {tableau.ecart ? `${tableau.ecart.pourcentage > 0 ? "+" : ""}${tableau.ecart.pourcentage} %` : "—"}
              </p>
              <p className="text-xs tabular-nums text-texte-faible">{tableau.ecart ? `${formaterMontant(tableau.ecart.estime, { court: true })} → ${formaterMontant(tableau.ecart.reel, { court: true })}` : "Rien à comparer"}</p>
            </div>
          </div>

          {/* Dépenses du mois par outil */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Par outil · ce mois-ci</p>
            {tableau.parOutil.length ? (
              <ul className="divide-y divide-trait rounded-carte border border-trait bg-surface-1">
                {tableau.parOutil.map((o) => (
                  <li key={o.outil} className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm">
                    <span className="truncate text-texte">{o.nom}</span>
                    <span className="font-semibold tabular-nums text-texte-doux">{formaterMontant(o.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-texte-faible">Aucune dépense ce mois-ci.</p>
            )}
          </div>
        </>
      )}

      {/* Trois mois : barres cliquables */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Par mois</p>
        <div role="radiogroup" aria-label="Mois" className="grid h-36 grid-cols-3 items-end gap-3">
          {mois.map((m) => {
            const actif = m.mois === detail?.mois;
            const h = 6 + Math.round((m.total.centimes / max) * 62); // % de la hauteur, place gardée pour les libellés
            return (
              <button key={m.mois} type="button" role="radio" aria-checked={actif} onClick={() => setMoisChoisi(m.mois)} className="group flex h-full flex-col items-center justify-end gap-1.5">
                <span className={cn("text-xs font-bold tabular-nums", actif ? "text-texte" : "text-texte-faible")}>{formaterMontant(m.total, { court: true })}</span>
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("w-full max-w-16 rounded-t-xl transition-colors", actif ? "bg-orange" : "bg-surface-3 group-hover:bg-trait-fort")}
                />
                <span className={cn("min-h-6 text-xs font-semibold capitalize", actif ? "text-orange-vif" : "text-texte-doux")}>{m.libelle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Détail par fournisseur du mois choisi */}
      {detail && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">
            Par poste · <span className="capitalize">{detail.libelle}</span>
          </p>
          {detail.parFournisseur.length ? (
            <ul className="space-y-2.5">
              {detail.parFournisseur.map((p) => (
                <li key={p.fournisseur}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-texte">{p.fournisseur}</span>
                    <span className="font-semibold tabular-nums text-texte-doux">{formaterMontant(p.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(p.total.centimes / maxPoste) * 100}%` }} transition={{ duration: 0.4 }} className="h-full rounded-full bg-orange-vif" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texte-faible">Aucune dépense ce mois-là.</p>
          )}
        </div>
      )}

      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre="Budget du mois"
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            chargement={enCours}
            disabled={!(lire(montant) >= 0) || !(lire(limite) >= 0) || (!!tableau && !(lire(taux) > 0))}
            onClick={() =>
              demarrer(async () => {
                const r = await definirBudgetAction(lire(montant), lire(limite));
                if (!r.ok) {
                  notifier.erreur(r.message);
                  return;
                }
                if (tableau && lire(taux) !== tableau.tauxUsdEur) {
                  const t = await definirTauxAction(lire(taux));
                  if (!t.ok) {
                    notifier.erreur(t.message);
                    return;
                  }
                }
                notifier.succes("Budget enregistré");
                setOuverte(false);
                router.refresh();
              })
            }
          >
            Enregistrer
          </Bouton>
        }
      >
        <div className="space-y-4">
          <Champ libelle="Budget mensuel" icone="jauge" inputMode="decimal" grand value={montant} onChange={(e) => setMontant(e.target.value)} suffixe={<span className="text-texte-faible">€</span>} />
          <Champ
            libelle="Confirmer au-delà de"
            icone="attention"
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            suffixe={<span className="text-texte-faible">€</span>}
            aide="Par vidéo. Au-delà, je vous demande de confirmer."
          />
          {tableau && (
            <Champ
              libelle="1 dollar vaut"
              icone="balance"
              inputMode="decimal"
              value={taux}
              onChange={(e) => setTaux(e.target.value)}
              suffixe={<span className="text-texte-faible">€</span>}
              aide="Certains outils facturent en dollars."
            />
          )}
        </div>
      </FeuilleBas>
    </div>
  );
}
