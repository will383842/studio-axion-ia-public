import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { lireParametre } from "@/services/_commun";
import { REGLAGE_SOURCE_USINE } from "@/services/branchement-idees-usine";
import { basculerSourceUsineFormulaire } from "./actions";

export const metadata: Metadata = { title: "Réglages de la base de connaissances" };
export const dynamic = "force-dynamic";

/** Réglages › Base de connaissances : l'interrupteur est éteint tant que vous ne l'allumez pas. */
export default async function PageReglagesBaseConnaissances() {
  await exigerSession();
  const allume = (await lireParametre<unknown>(REGLAGE_SOURCE_USINE, false)) === true;
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
      </ul>
    </div>
  );
}
