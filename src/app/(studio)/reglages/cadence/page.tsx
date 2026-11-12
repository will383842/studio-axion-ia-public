import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { nomReseauCadence, RESEAUX_CADENCE } from "@/domaine/cadence/reglages";
import { exigerSession } from "@/services/auth";
import { lireReglagesCadence } from "@/services/reglages-cadence";
import { enregistrerCadenceFormulaire } from "./actions";
import { RUBRIQUES_CADENCE } from "./rubriques";

export const metadata: Metadata = { title: "Réglages de cadence" };
export const dynamic = "force-dynamic";

/** Cadence de publication : heures, quota et écart par réseau. Ce sont des avertissements, jamais des blocages. */
export default async function PageReglagesCadence({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  await exigerSession();
  const { erreur } = await searchParams;
  const r = await lireReglagesCadence();
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Cadence de publication" sousTitre="Le calendrier vous prévient, il ne bloque jamais." />
      {erreur ? (
        <p role="alert" className="mb-3 rounded-xl border border-trait p-3 text-sm font-semibold">
          {erreur}
        </p>
      ) : null}
      <form action={enregistrerCadenceFormulaire} className="flex flex-col gap-3">
        {RESEAUX_CADENCE.map((id) => (
          <fieldset key={id} className="flex flex-col gap-2 rounded-2xl border border-trait p-4">
            <legend className="px-1 font-semibold">{nomReseauCadence(id)}</legend>
            <label className="flex flex-col gap-1 text-sm">
              {RUBRIQUES_CADENCE[0].titre}
              <input name={`heures-${id}`} defaultValue={r.reseaux[id].heures.join(", ")} className="min-h-11 rounded-xl border border-trait px-3" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {RUBRIQUES_CADENCE[1].titre}
              <input name={`quota-${id}`} type="number" min={0} max={20} defaultValue={r.reseaux[id].quotaParJour} className="min-h-11 rounded-xl border border-trait px-3" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {RUBRIQUES_CADENCE[2].titre}
              <input name={`ecart-${id}`} type="number" min={0} max={1440} defaultValue={r.reseaux[id].ecartMinMinutes} className="min-h-11 rounded-xl border border-trait px-3" />
            </label>
          </fieldset>
        ))}
        <ul className="text-sm text-texte-doux">
          {RUBRIQUES_CADENCE.map((x) => (
            <li key={x.id}>{x.aide}</li>
          ))}
        </ul>
        <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
