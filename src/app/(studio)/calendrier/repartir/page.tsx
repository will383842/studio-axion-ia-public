import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { RESEAUX_CADENCE, nomReseauCadence } from "@/domaine/cadence/reglages";
import type { SujetAPlanifier } from "@/domaine/cadence/planifier";
import type { ReseauDeclinaison } from "@/domaine/types";
import { depots } from "@/donnees/memoire";
import { cleJour } from "@/lib/dates";
import { ajouterJoursParis } from "@/lib/horloge-paris";
import { exigerSession } from "@/services/auth";
import { creneauxOccupes } from "@/services/cadence";
import { repartirLot, SEMAINES_MAX, SEMAINES_MIN } from "@/services/cadence-lot";

export const metadata: Metadata = { title: "Répartir un lot" };
export const dynamic = "force-dynamic";

const MAX_LIGNES = 60;

/** « titre » ou « titre | pilier | cible », une ligne par élément. Identifiant s01, s02… dans l'ordre de saisie. */
function lireSujets(brut: string | undefined): SujetAPlanifier[] {
  const lignes = (brut ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_LIGNES);
  return lignes.map((l, i) => {
    const [titre, pilier, cible] = l.split("|").map((x) => x.trim());
    const id = `s${String(i + 1).padStart(2, "0")}`;
    return { id, pilier: pilier || titre || id, cible: cible || "tous" };
  });
}

/**
 * RÉPARTIR UN LOT (L4-09) : on propose un plan sur 2 à 4 semaines, avec le moteur de cadence. Rien n'est enregistré, rien n'est envoyé :
 * la page ne fait que lire les créneaux déjà pris et afficher la proposition.
 */
export default async function PageRepartirLot({ searchParams }: { searchParams: Promise<{ debut?: string; semaines?: string; reseaux?: string | string[]; sujets?: string }> }) {
  await exigerSession();
  const p = await searchParams;
  const debut = /^\d{4}-\d{2}-\d{2}$/.test(p.debut ?? "") ? (p.debut as string) : cleJour(new Date());
  const semaines = Number.parseInt(p.semaines ?? "3", 10);
  const choisis = (Array.isArray(p.reseaux) ? p.reseaux : p.reseaux ? [p.reseaux] : []).filter((r): r is ReseauDeclinaison => (RESEAUX_CADENCE as readonly string[]).includes(r));
  const sujets = lireSujets(p.sujets);
  const demande = sujets.length > 0;
  let resultat: ReturnType<typeof repartirLot> | null = null;
  if (demande) {
    const fin = ajouterJoursParis(debut, 7 * (Number.isInteger(semaines) ? semaines : 4) + 60);
    const occupes = Number.isNaN(Date.parse(debut)) ? [] : await creneauxOccupes(depots().creneauxEditoriaux, debut, fin);
    const existants = occupes.map((o) => ({ id: `${o.creneauId}:${o.reseau}`, reseau: o.reseau, jour: o.jour, heure: o.heure, pilier: o.creneauId, cible: o.creneauId }));
    resultat = repartirLot(debut, semaines, sujets, choisis, existants);
  }
  return (
    <div className="mx-auto w-full max-w-2xl">
      <EnTetePage retour={{ href: "/calendrier", libelle: "Calendrier" }} titre="Répartir un lot" sousTitre="Une proposition d'étalement sur 2 à 4 semaines. Rien n'est enregistré ni envoyé." />
      <form method="get" className="mb-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Premier jour
          <input name="debut" type="date" defaultValue={debut} className="min-h-11 rounded-xl border border-trait px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nombre de semaines ({SEMAINES_MIN} à {SEMAINES_MAX})
          <input name="semaines" type="number" min={SEMAINES_MIN} max={SEMAINES_MAX} defaultValue={Number.isInteger(semaines) ? semaines : 3} className="min-h-11 rounded-xl border border-trait px-3" />
        </label>
        <fieldset className="flex flex-wrap gap-3 rounded-2xl border border-trait p-3">
          <legend className="px-1 text-sm font-semibold">Réseaux</legend>
          {RESEAUX_CADENCE.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="reseaux" value={r} defaultChecked={choisis.includes(r as ReseauDeclinaison)} />
              {nomReseauCadence(r)}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          Éléments du lot (un par ligne, « titre | pilier | cible » si vous voulez)
          <textarea name="sujets" rows={8} defaultValue={p.sujets ?? ""} className="rounded-xl border border-trait p-3" />
        </label>
        <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
          Proposer une répartition
        </button>
      </form>
      {resultat?.erreur ? (
        <p role="alert" className="rounded-xl border border-trait p-3 text-sm font-semibold">
          {resultat.erreur}
        </p>
      ) : null}
      {resultat && !resultat.erreur ? (
        <section aria-label="Proposition">
          <p className="mb-2 text-sm">
            {resultat.creneaux.length} créneaux proposés, {resultat.violations.length === 0 ? "aucune violation" : `${resultat.violations.length} violation(s) à revoir`}. {resultat.horsFenetre.length > 0 ? `${resultat.horsFenetre.length} tombent après la fin de la période.` : "Tous tiennent dans la période."}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {resultat.creneaux
              .toSorted((a, b) => a.jour.localeCompare(b.jour) || a.heure.localeCompare(b.heure) || a.id.localeCompare(b.id))
              .map((c) => (
                <li key={c.id}>
                  {c.jour} {c.heure} · {c.reseau} · {sujets.find((s) => s.id === c.sujet)?.pilier ?? c.sujet}
                </li>
              ))}
          </ul>
          {resultat.avertissements.length > 0 ? (
            <ul className="mt-3 text-sm text-texte-doux">
              {resultat.avertissements.map((a) => (
                <li key={a.posts.join("+") + a.code}>{a.message}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
