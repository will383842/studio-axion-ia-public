"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirCycleCreditClaudeAction, releverCreditClaudeAction } from "@/app/(studio)/reglages/actions-credit-claude";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { notifier } from "@/components/ui/Toast";
import type { SourceAbonnement } from "@/domaine/source-claude";
import type { VueCompteCredit, VueCreditClaude } from "@/services/credit-claude";

export const TEXTES_CREDIT_CLAUDE = {
  titre: "Crédit Claude restant (estimé)",
  aide: "Estimé : à recaler avec la Console. Anthropic n'indique aucun solde ; ce chiffre est un calcul et ne bloque jamais rien.",
  montant: "Crédit du cycle ($)",
  debut: "Début du cycle",
  expiration: "Expiration",
  prochain: "Prochain crédit",
  releve: "Solde relevé dans la Console ($)",
  enregistrerCycle: "Enregistrer le cycle",
  enregistrerReleve: "Enregistrer le relevé",
  apresExpiration: "Après l'expiration, saisissez le nouveau cycle (ex. compte 1 : revient vers le 11/11). Les 200 $ proposés ne comptent qu'après un clic sur « Enregistrer le cycle ».",
} as const;

/** Exemples gris (placeholder) : jamais une valeur enregistrable par défaut. */
const EXEMPLES: Partial<Record<SourceAbonnement, { debut: string; expireLe: string; prochainLe: string }>> = {
  "abonnement-1": { debut: "2026-09-21", expireLe: "2026-10-21", prochainLe: "2026-11-11" },
  "abonnement-3": { debut: "2026-10-19", expireLe: "2026-11-14", prochainLe: "2026-11-14" },
};

const jour = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

function CarteCompte({ compte }: { compte: VueCompteCredit }) {
  const router = useRouter();
  const exemple = compte.cycle ? undefined : EXEMPLES[compte.source];
  const [dollars, setDollars] = useState(String(compte.cycle?.dollars ?? 200));
  const [debut, setDebut] = useState(jour(compte.cycle?.debut));
  const [expireLe, setExpireLe] = useState(jour(compte.cycle?.expireLe));
  const [prochainLe, setProchainLe] = useState(jour(compte.cycle?.prochainLe));
  const [releve, setReleve] = useState("");
  const [enCours, demarrer] = useTransition();

  function lancer(f: () => ReturnType<typeof definirCycleCreditClaudeAction>, succes: string, apres?: () => void) {
    demarrer(async () => {
      let r;
      try {
        r = await f();
      } catch {
        notifier.erreur("Rien n'a été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(succes);
      apres?.();
      router.refresh();
    });
  }

  const nombre = (v: string) => (v.trim() === "" ? Number.NaN : Number(v.replace(",", ".")));

  return (
    <div className="rounded-carte border border-trait p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-texte">
          {compte.libelle} {compte.finCle && <span className="text-sm font-normal text-texte-faible">{compte.finCle}</span>}
        </p>
        <p className="text-sm text-texte-doux" role="status">
          {compte.restantTexte}
          {compte.depuisTexte && <span className="text-texte-faible"> · {compte.depuisTexte}</span>}
        </p>
      </div>
      {compte.horsTotalTexte && <p className="mt-1 text-xs text-texte-faible">{compte.horsTotalTexte}</p>}
      {compte.cycleSaisiSurTexte && <p className="mt-1 text-xs text-texte-faible">{compte.cycleSaisiSurTexte}</p>}
      <p className="mt-1 text-xs text-texte-faible">{TEXTES_CREDIT_CLAUDE.apresExpiration}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Champ libelle={TEXTES_CREDIT_CLAUDE.montant} inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} />
        <Champ libelle={TEXTES_CREDIT_CLAUDE.debut} type="text" inputMode="numeric" maxLength={10} placeholder={exemple?.debut ? `ex. ${exemple.debut}` : "AAAA-MM-JJ"} value={debut} onChange={(e) => setDebut(e.target.value)} />
        <Champ libelle={TEXTES_CREDIT_CLAUDE.expiration} type="text" inputMode="numeric" maxLength={10} placeholder={exemple?.expireLe ? `ex. ${exemple.expireLe}` : "AAAA-MM-JJ"} value={expireLe} onChange={(e) => setExpireLe(e.target.value)} />
        <Champ libelle={TEXTES_CREDIT_CLAUDE.prochain} type="text" inputMode="numeric" maxLength={10} placeholder={exemple?.prochainLe ? `ex. ${exemple.prochainLe}` : "AAAA-MM-JJ"} value={prochainLe} onChange={(e) => setProchainLe(e.target.value)} />
      </div>
      <Bouton className="mt-3" variante="secondaire" disabled={enCours} onClick={() => lancer(() => definirCycleCreditClaudeAction(compte.source, { dollars: nombre(dollars), debut, expireLe: expireLe || null, prochainLe: prochainLe || null }), "Cycle enregistré")}>
        {TEXTES_CREDIT_CLAUDE.enregistrerCycle}
      </Bouton>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Champ className="min-w-48 flex-1" libelle={TEXTES_CREDIT_CLAUDE.releve} inputMode="decimal" value={releve} onChange={(e) => setReleve(e.target.value)} />
        <Bouton variante="secondaire" disabled={enCours || releve.trim() === ""} onClick={() => lancer(() => releverCreditClaudeAction(compte.source, nombre(releve)), "Relevé enregistré", () => setReleve(""))}>
          {TEXTES_CREDIT_CLAUDE.enregistrerReleve}
        </Bouton>
      </div>
    </div>
  );
}

export function CreditClaude({ vue }: { vue: VueCreditClaude }) {
  return (
    <div id="credits-claude" className="mt-6 scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-texte">{TEXTES_CREDIT_CLAUDE.titre}</h3>
        <p className="text-sm text-texte-doux">Total : {vue.totalTexte}</p>
      </div>
      <p className="mt-1 text-sm text-texte-faible">{TEXTES_CREDIT_CLAUDE.aide}</p>
      <div className="mt-3 grid gap-3">
        {vue.comptes.map((c) => (
          <CarteCompte key={c.source} compte={c} />
        ))}
      </div>
      <p className="mt-3 text-xs text-texte-faible">
        API payante {vue.api.finCle ?? ""} : {vue.api.eteinte ? "éteinte" : "active"} · dépensé ce mois-ci {vue.api.consommeMoisTexte}
      </p>
    </div>
  );
}
