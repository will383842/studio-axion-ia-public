import { LIBELLES_A_RELANCER } from "@/components/calendrier/ContenusARelancer";
import { nomDuReseau } from "@/reseaux/hors-video";
import type { SuggestionJour } from "@/services/republication-auto";

/** Libellés fixes du bloc (vouvoiement, mots simples, aucun prix). */
export const LIBELLES_JOURS_PROPOSES = {
  titre: "Jours proposés",
  aide: "Jours proposés par le Studio. Rien n'est ajouté tant que vous n'avez pas écrit et enregistré la nouvelle version.",
  bouton: "Préparer cette nouvelle version",
} as const;

const jourLong = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "UTC" });
function quand(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? jour : jourLong.format(d);
}

export interface ProprietesJoursProposes {
  suggestions: readonly SuggestionJour[];
  /** Compte de publication de chaque réseau, déjà lu par la page. */
  comptes: Partial<Record<string, string | undefined>>;
  /** Même action que le formulaire de la liste : un seul moteur. */
  action?: (formulaire: FormData) => void | Promise<void>;
}

const CHAMP = "mt-1 block w-full rounded-xl border border-trait bg-surface-1 px-3 py-2 text-sm text-texte";

/** Bloc de suggestions : jour pré-rempli, texte VIDE. Rien n'est créé tant que la personne n'a pas enregistré. */
export function JoursProposes({ suggestions, comptes, action }: ProprietesJoursProposes) {
  if (suggestions.length === 0) return null;
  return (
    <section className="mt-4" aria-labelledby="jours-proposes">
      <h2 id="jours-proposes" className="text-base font-semibold text-texte">
        {LIBELLES_JOURS_PROPOSES.titre}
      </h2>
      <p className="mt-1 text-sm text-texte-doux">{LIBELLES_JOURS_PROPOSES.aide}</p>
      <ul className="mt-3 divide-y divide-trait rounded-xl border border-trait bg-surface-1">
        {suggestions.map((s) => {
          const compte = comptes[s.reseau];
          return (
            <li key={s.publicationId} className="px-4 py-3 text-sm">
              <p className="font-medium text-texte">
                {nomDuReseau(s.reseau)} · {quand(s.jour)}, {s.heure}
              </p>
              <p className="mt-1 text-texte">{s.debutTexte}</p>
              <p className="text-texte-doux">{s.raison}</p>
              {compte ? (
                <details className="mt-3">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-trait px-4 font-medium">{LIBELLES_JOURS_PROPOSES.bouton}</summary>
                  <form action={action} className="mt-3 space-y-3">
                    <input type="hidden" name="publicationId" value={s.publicationId} />
                    <input type="hidden" name="compteCible" value={compte} />
                    <div>
                      <p className="font-medium text-texte">{LIBELLES_A_RELANCER.ancienTexte}</p>
                      <p className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-texte-doux">{s.debutTexte}</p>
                    </div>
                    <label className="block font-medium text-texte">
                      {LIBELLES_A_RELANCER.nouveauTexte}
                      <textarea name="texte" required rows={5} className={CHAMP}></textarea>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="block font-medium text-texte">
                        {LIBELLES_A_RELANCER.jour}
                        <input type="date" name="jour" required defaultValue={s.jour} className={`${CHAMP} min-h-11`} />
                      </label>
                      <label className="block font-medium text-texte">
                        {LIBELLES_A_RELANCER.heure}
                        <input type="time" name="heure" required defaultValue={s.heure} className={`${CHAMP} min-h-11`} />
                      </label>
                    </div>
                    <button type="submit" className="min-h-11 rounded-xl border border-trait px-4 font-medium">
                      {LIBELLES_A_RELANCER.ajouter}
                    </button>
                  </form>
                </details>
              ) : (
                <p className="mt-3 text-texte-doux">{LIBELLES_A_RELANCER.sansCompte}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
