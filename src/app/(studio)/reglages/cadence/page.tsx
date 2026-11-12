import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import {
  ETATS_PREMIER_COMMENTAIRE,
  LIBELLES_PREMIER_COMMENTAIRE,
  lireHeure,
  nomReseauCadence,
  RESEAUX_CADENCE,
  type ReglagesCadence,
  type ValeurRegle,
} from "@/domaine/cadence/reglages";
import { exigerSession } from "@/services/auth";
import { enregistrerReglagesCadence, lireReglagesCadence } from "@/services/reglages-cadence";
import { RUBRIQUES_CADENCE } from "./rubriques";

export const metadata: Metadata = { title: "Réglages de cadence" };
export const dynamic = "force-dynamic";

const nombre = (v: FormDataEntryValue | null): number | undefined => {
  const t = String(v ?? "").trim();
  return t === "" ? undefined : Number(t);
};
const SOURCE_SAISIE = "Modifiée par vous dans les Réglages";
const FR_ETATS = ETATS_PREMIER_COMMENTAIRE as readonly string[];

/** Garde la règle telle quelle si la saisie est identique ou vide ; sinon la valeur change et sa source devient « modifiée par vous », datée d'aujourd'hui. */
function regleSaisie<T extends number | string>(actuelle: ValeurRegle<T>, saisie: T | undefined): ValeurRegle<T> {
  if (saisie === undefined || (typeof saisie === "number" && !Number.isFinite(saisie)) || saisie === actuelle.valeur) return actuelle;
  return { valeur: saisie, source: SOURCE_SAISIE, verifieLe: new Date().toISOString().slice(0, 10) };
}

/** Enregistre tout l'écran d'un coup : heures, quota, écart et règles par réseau. Rien n'est enregistré si une heure est illisible. */
async function enregistrerEcran(donnees: FormData): Promise<void> {
  "use server";
  await exigerSession();
  const actuels = await lireReglagesCadence();
  const reseaux: Record<string, unknown> = {};
  const regles: Record<string, unknown> = {};
  const illisibles: string[] = [];
  for (const id of RESEAUX_CADENCE) {
    const saisies = String(donnees.get(`heures-${id}`) ?? "").split(/[,;\s]+/).filter(Boolean);
    illisibles.push(...saisies.filter((h) => lireHeure(h) === null));
    reseaux[id] = {
      heures: saisies.length > 0 ? saisies : undefined,
      quotaParJour: nombre(donnees.get(`quota-${id}`)),
      ecartMinMinutes: nombre(donnees.get(`ecart-${id}`)),
    };
    const a = actuels.regles[id];
    const etat = String(donnees.get(`commentaire-${id}`) ?? "");
    regles[id] = {
      texteMax: regleSaisie(a.texteMax, nombre(donnees.get(`texte-${id}`))),
      motsDieseMax: regleSaisie(a.motsDieseMax, nombre(donnees.get(`diese-${id}`))),
      premierCommentaire: regleSaisie(a.premierCommentaire, FR_ETATS.includes(etat) ? (etat as typeof a.premierCommentaire.valeur) : undefined),
      ...(a.pdfCarrousel ? { pdfCarrousel: regleSaisie(a.pdfCarrousel, nombre(donnees.get(`pdf-${id}`))) } : {}),
    };
  }
  if (illisibles.length > 0) {
    const message = `Heure illisible : ${illisibles.join(", ")}. Écrivez par exemple 8h, 8:30 ou 18:00.`;
    redirect(`/reglages/cadence?erreur=${encodeURIComponent(message)}`);
  }
  await enregistrerReglagesCadence({ reseaux, objectifs: actuels.objectifs, regles } satisfies Partial<Record<keyof ReglagesCadence, unknown>>);
  revalidatePath("/reglages/cadence");
}

const dateLisible = (d: string): string => d.split("-").reverse().join("/");
/** Date de vérification et source d'une règle, en toutes lettres. */
function Provenance({ regle }: { regle: ValeurRegle<unknown> }) {
  return (
    <span className="text-xs text-texte-doux">
      {regle.verifieLe ? `Vérifiée le ${dateLisible(regle.verifieLe)}` : "Pas encore vérifiée"} · Source : {regle.source}
    </span>
  );
}

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
      <form action={enregistrerEcran} className="flex flex-col gap-3">
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
            <div className="mt-1 flex flex-col gap-2 border-t border-trait pt-3">
              <p className="text-sm font-semibold">Règles du texte</p>
              <label className="flex flex-col gap-1 text-sm">
                Longueur maximale du texte (en signes)
                <input name={`texte-${id}`} type="number" min={1} max={100000} defaultValue={r.regles[id].texteMax.valeur} className="min-h-11 rounded-xl border border-trait px-3" />
                <Provenance regle={r.regles[id].texteMax} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Nombre maximal de mots-dièse
                <input name={`diese-${id}`} type="number" min={0} max={100} defaultValue={r.regles[id].motsDieseMax.valeur} className="min-h-11 rounded-xl border border-trait px-3" />
                <Provenance regle={r.regles[id].motsDieseMax} />
              </label>
              {r.regles[id].pdfCarrousel ? (
                <label className="flex flex-col gap-1 text-sm">
                  Nombre de PDF pour un carrousel
                  <input name={`pdf-${id}`} type="number" min={0} max={10} defaultValue={r.regles[id].pdfCarrousel.valeur} className="min-h-11 rounded-xl border border-trait px-3" />
                  <Provenance regle={r.regles[id].pdfCarrousel} />
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-sm">
                Premier commentaire
                <select name={`commentaire-${id}`} defaultValue={r.regles[id].premierCommentaire.valeur} className="min-h-11 rounded-xl border border-trait px-3">
                  {ETATS_PREMIER_COMMENTAIRE.map((e) => (
                    <option key={e} value={e}>
                      {LIBELLES_PREMIER_COMMENTAIRE[e]}
                    </option>
                  ))}
                </select>
                <Provenance regle={r.regles[id].premierCommentaire} />
              </label>
            </div>
          </fieldset>
        ))}
        <ul className="text-sm text-texte-doux">
          {RUBRIQUES_CADENCE.map((x) => (
            <li key={x.id}>{x.aide}</li>
          ))}
        </ul>
        <p className="text-sm text-texte-doux">
          Ces règles servent à relire vos textes : le calendrier vous prévient, il ne bloque jamais. Si vous changez une valeur, la date du jour et « modifiée par vous » s&apos;affichent.
        </p>
        <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
