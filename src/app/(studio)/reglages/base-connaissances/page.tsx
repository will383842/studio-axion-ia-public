import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { lireParametre } from "@/services/_commun";
import { REGLAGE_SOURCE_USINE } from "@/services/branchement-idees-usine";
import { RechercheFaitsSite } from "@/components/reglages/RechercheFaitsSite";
import { CHIFFRES_CLES, type Verdict } from "@/domaine/gardien-chiffres";
import { gardienActif, lireDernierControle } from "@/services/gardien-chiffres";
import { lectureSiteDisponible } from "@/services/kb-site";
import { basculerGardienChiffresFormulaire, basculerLectureSiteFormulaire, basculerSourceUsineFormulaire, verifierChiffresFormulaire } from "./actions";

const TEXTE_VERDICT: Record<Verdict, string> = { accord: "accord", ecart: "écart", "non-compare": "non comparé" };
const FORMAT_PARIS = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
function quand(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? FORMAT_PARIS.format(new Date(t)) : "";
}

export const metadata: Metadata = { title: "Réglages de la base de connaissances" };
export const dynamic = "force-dynamic";

/** Réglages › Base de connaissances : l'interrupteur est éteint tant que vous ne l'allumez pas. */
export default async function PageReglagesBaseConnaissances() {
  await exigerSession();
  const allume = (await lireParametre<unknown>(REGLAGE_SOURCE_USINE, false)) === true;
  const site = await lectureSiteDisponible();
  const gardien = await gardienActif();
  const dernier = await lireDernierControle();
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Base de connaissances" sousTitre="Allumez un interrupteur seulement quand vous voulez l'utiliser." />
      <ul className="flex flex-col gap-3">
        <li className="flex flex-col gap-2 rounded-2xl border border-trait p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Le comité lit les idées de l&apos;usine</span>
            <span>{allume ? "Allumé" : "Éteint"}</span>
          </div>
          <p className="text-sm text-texte-doux">
            {allume
              ? "Le comité éditorial lit les idées proposées par l'usine (lecture seule : rien n'est envoyé à l'usine)."
              : "Éteint : le comité travaille sur des idées d'essai, et l'usine n'est pas appelée."}
          </p>
          <form action={basculerSourceUsineFormulaire}>
            <input type="hidden" name="valeur" value={allume ? "non" : "oui"} />
            <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
              {allume ? "Éteindre" : "Allumer"}
            </button>
          </form>
        </li>
        <li className="flex flex-col gap-2 rounded-2xl border border-trait p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Lire la base du site</span>
            <span>{site.allumee ? "Allumé" : "Éteint"}</span>
          </div>
          <p className="text-sm text-texte-doux">
            {site.allumee
              ? site.adresse
                ? "Vous pouvez chercher des faits sur le site (lecture seule). Chaque fait trouvé reste une proposition : rien n'est utilisé avant votre validation."
                : "Allumé, mais l'adresse du site n'est pas posée sur le serveur : rien n'est lu."
              : "Éteint : le site n'est pas consulté."}
          </p>
          <form action={basculerLectureSiteFormulaire}>
            <input type="hidden" name="valeur" value={site.allumee ? "non" : "oui"} />
            <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
              {site.allumee ? "Éteindre" : "Allumer"}
            </button>
          </form>
          <RechercheFaitsSite allumee={site.allumee && site.adresse} />
        </li>
        <li className="flex flex-col gap-2 rounded-2xl border border-trait p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Gardien des chiffres</span>
            <span>{gardien ? "Allumé" : "Éteint"}</span>
          </div>
          <p className="text-sm text-texte-doux">
            {gardien
              ? "Le gardien compare les chiffres clés du site, des preuves du Studio et de l'usine. S'il voit un écart, il sonne la cloche. Il ne bloque rien et n'affiche aucune valeur."
              : "Éteint : aucun chiffre n'est comparé et la cloche ne sonne pas."}
          </p>
          <form action={basculerGardienChiffresFormulaire}>
            <input type="hidden" name="valeur" value={gardien ? "non" : "oui"} />
            <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
              {gardien ? "Éteindre" : "Allumer"}
            </button>
          </form>
          {gardien ? (
            <form action={verifierChiffresFormulaire}>
              <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
                Vérifier maintenant
              </button>
            </form>
          ) : null}
          {gardien && dernier ? (
            <div className="flex flex-col gap-1 text-sm" aria-label="Dernier contrôle">
              <p className="text-texte-doux">Dernier contrôle : {quand(dernier.le)}</p>
              <ul className="flex flex-col gap-1">
                {dernier.donnees.map((d) => (
                  <li key={d.code} className="flex items-center justify-between gap-3">
                    <span>{CHIFFRES_CLES.find((c) => c.code === d.code)?.libelle ?? d.code}</span>
                    <span>{TEXTE_VERDICT[d.verdict]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </li>
      </ul>
    </div>
  );
}
