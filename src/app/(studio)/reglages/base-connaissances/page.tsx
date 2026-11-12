import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { lireParametre } from "@/services/_commun";
import { REGLAGE_SOURCE_USINE } from "@/services/branchement-idees-usine";
import { RechercheFaitsSite } from "@/components/reglages/RechercheFaitsSite";
import { lectureSiteDisponible } from "@/services/kb-site";
import { basculerLectureSiteFormulaire, basculerSourceUsineFormulaire } from "./actions";

export const metadata: Metadata = { title: "Réglages de la base de connaissances" };
export const dynamic = "force-dynamic";

/** Réglages › Base de connaissances : l'interrupteur est éteint tant que vous ne l'allumez pas. */
export default async function PageReglagesBaseConnaissances() {
  await exigerSession();
  const allume = (await lireParametre<unknown>(REGLAGE_SOURCE_USINE, false)) === true;
  const site = await lectureSiteDisponible();
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
      </ul>
    </div>
  );
}
