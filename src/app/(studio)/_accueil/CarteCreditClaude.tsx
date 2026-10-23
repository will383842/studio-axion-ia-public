import Link from "next/link";
import { Carte } from "@/components/ui/Carte";
import { avertissementCreditClaude } from "@/domaine/credit-claude";
import { cn } from "@/lib/cn";
import { dateCourte } from "@/lib/dates";
import type { VueCompteCredit, VueCreditClaude } from "@/services/credit-claude";

/**
 * Carte « Crédit Claude restant (estimé) » de l'Accueil — AFFICHAGE SEULEMENT (composant serveur) : le calcul vient de
 * `vueCreditClaude`, rien n'est lu par le pré-vol ni la rotation. Aucune clé entière (…XXXX), jamais un restant pour l'API payante,
 * jamais le mot « recharger » (un abonnement se renouvelle).
 */
function LigneCompte({ c }: { c: VueCompteCredit }) {
  const chiffre = c.etat === "expire" ? `Expiré${c.prochainLe ? ` · revient vers le ${dateCourte(c.prochainLe)}` : ""}` : c.restantTexte;
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
    <Link href="/reglages#credits-claude" className="block">
      <Carte interactive>
        <p className="text-sm font-semibold text-texte-doux">Crédit Claude restant (estimé)</p>
        <p className="mt-1 font-titre text-3xl tabular-nums text-texte">{vue.totalTexte}</p>
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
          API payante · {vue.api.finCle ?? "aucune clé"} · {vue.api.eteinte ? "éteinte" : "allumée"} · {vue.api.consommeMoisTexte} ce mois-ci
        </p>
      </Carte>
    </Link>
  );
}
