import Link from "next/link";
import { avertissementCreditClaude } from "@/domaine/credit-claude";
import { LIBELLES_NIVEAU_FORFAIT, niveauCompteClaude, niveauTotalClaude } from "@/domaine/niveau-credit";
import { cn } from "@/lib/cn";
import { dateCourte } from "@/lib/dates";
import type { VueCompteCredit, VueCreditClaude } from "@/services/credit-claude";

/**
 * Carte « Crédit Claude » de l'Accueil (règle « aucun prix » : un niveau en mots, jamais un montant) — AFFICHAGE SEULEMENT (composant serveur) : le calcul vient de
 * `vueCreditClaude`, rien n'est lu par le pré-vol ni la rotation. Aucune clé entière (…XXXX), jamais un restant pour l'API payante,
 * jamais le mot « recharger » (un abonnement se renouvelle).
 */
function LigneCompte({ c }: { c: VueCompteCredit }) {
  const chiffre = c.etat === "expire" ? `Expiré${c.prochainLe ? ` · revient vers le ${dateCourte(c.prochainLe)}` : ""}` : c.etat === "a-venir" ? "À venir" : LIBELLES_NIVEAU_FORFAIT[niveauCompteClaude(c)];
  const depuis = c.etat === "estime" && c.depuisTexte ? (c.base === "releve" ? c.depuisTexte : "depuis le début du cycle") : null;
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-texte">
          {c.libelle} · {c.finCle ?? "aucune clé"}
        </span>
        <span className="tabular-nums text-texte-doux">{c.horsTotalTexte ? "hors total" : chiffre}</span>
      </div>
      <p className="text-xs text-texte-faible">{c.horsTotalTexte ?? depuis}</p>
    </li>
  );
}

export function CarteCreditClaude({ vue, maintenant = new Date().toISOString() }: { vue: VueCreditClaude; maintenant?: string }) {
  const alerte = avertissementCreditClaude({ mode: vue.mode, comptes: vue.comptes, maintenant, formaterJour: dateCourte });
  return (
    <Link href="/reglages#credits-claude" className="-m-2 block rounded-xl p-2 hover:bg-surface-2">
      <div>
        <p className="text-sm font-semibold text-texte-doux">Crédit Claude</p>
        <p className="mt-1 font-titre text-2xl text-texte">{LIBELLES_NIVEAU_FORFAIT[niveauTotalClaude(vue.comptes)]}</p>
        {alerte && (
          <p role="status" className={cn("mt-2 rounded-xl px-3 py-2 text-sm", alerte.ton === "brique" && "bg-brique-doux text-brique", alerte.ton === "ambre" && "bg-ambre-doux text-ambre", alerte.ton === "gris" && "px-0 py-0 text-xs text-texte-faible")}>
            {alerte.texte}
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {vue.comptes.map((c) => (
            <LigneCompte key={c.source} c={c} />
          ))}
        </ul>
        <p className="mt-3 border-t border-trait pt-2 text-xs text-texte-faible opacity-70">
          API payante · {vue.api.finCle ?? "aucune clé"} · {vue.api.eteinte ? "éteinte" : "allumée"}
        </p>
      </div>
    </Link>
  );
}
