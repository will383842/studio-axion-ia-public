import type { LigneARelancer } from "@/services/contenus-a-relancer";
import { nomDuReseau } from "@/reseaux/hors-video";

/** Libellés fixes de l'écran (vouvoiement, mots simples, aucun prix). */
export const LIBELLES_A_RELANCER = {
  titre: "Contenus à relancer",
  aide: "Ces contenus ont bien marché. Écrivez-en une nouvelle version : elle arrive dans le calendrier à valider. Rien ne part tout seul.",
  videTitre: "Rien à relancer pour l'instant",
  videPhrase: "Un contenu apparaît ici une semaine après ses premiers chiffres.",
  bouton: "Nouvelle version",
  ancienTexte: "Ancien texte (début)",
  nouveauTexte: "Votre nouvelle version",
  jour: "Jour",
  heure: "Heure",
  ajouter: "Ajouter au calendrier",
  sansCompte: "Aucun compte de publication pour ce réseau",
  succes: "Nouvelle version ajoutée au calendrier, à valider. Rien n'est envoyé.",
  dejaAuCalendrier: "Une nouvelle version de ce contenu est déjà au calendrier, à valider. Rien n'est envoyé.",
  incomplet: "Le formulaire est incomplet : indiquez le texte, le jour et l'heure.",
  dejaRelance: "Déjà relancé",
  fois: "fois",
} as const;

/** PROPOSITION (hypothèse) : heure proposée dans le formulaire. */
export const HEURE_PAR_DEFAUT = "09:00";

const heureParis = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
function quand(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : heureParis.format(d);
}

export interface ProprietesContenusARelancer {
  lignes: readonly LigneARelancer[];
  /** Compte de publication de chaque réseau, déjà lu par la page. */
  comptes: Partial<Record<string, string | undefined>>;
  /** Action du formulaire (création d'un créneau « à valider »). */
  action?: (formulaire: FormData) => void | Promise<void>;
}

const CHAMP = "mt-1 block w-full rounded-xl border border-trait bg-surface-1 px-3 py-2 text-sm text-texte";

/** Liste des contenus à relancer ; chaque ligne ouvre un formulaire. Rien n'est envoyé d'ici. */
export function ContenusARelancer({ lignes, comptes, action }: ProprietesContenusARelancer) {
  return (
    <ul className="mt-4 divide-y divide-trait rounded-xl border border-trait bg-surface-1">
      {lignes.map((l) => {
        const compte = comptes[l.reseau];
        return (
          <li key={l.publicationId} className="px-4 py-3 text-sm">
            <p className="font-medium text-texte">
              {nomDuReseau(l.reseau)} · {quand(l.date)}
            </p>
            <p className="mt-1 text-texte">{l.debutTexte}</p>
            <p className="text-texte-doux">{l.raison}</p>
            {l.rangDejaAtteint > 0 && <p className="text-texte-doux">{LIBELLES_A_RELANCER.dejaRelance} {l.rangDejaAtteint} {LIBELLES_A_RELANCER.fois}</p>}
            {compte ? (
              <details className="mt-3">
                <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-trait px-4 font-medium">{LIBELLES_A_RELANCER.bouton}</summary>
                <form action={action} className="mt-3 space-y-3">
                  <input type="hidden" name="publicationId" value={l.publicationId} />
                  <input type="hidden" name="compteCible" value={compte} />
                  <div>
                    <p className="font-medium text-texte">{LIBELLES_A_RELANCER.ancienTexte}</p>
                    <p className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-texte-doux">{l.debutTexte}</p>
                  </div>
                  <label className="block font-medium text-texte">
                    {LIBELLES_A_RELANCER.nouveauTexte}
                    <textarea name="texte" required rows={5} className={CHAMP}></textarea>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <label className="block font-medium text-texte">
                      {LIBELLES_A_RELANCER.jour}
                      <input type="date" name="jour" required className={`${CHAMP} min-h-11`} />
                    </label>
                    <label className="block font-medium text-texte">
                      {LIBELLES_A_RELANCER.heure}
                      <input type="time" name="heure" required defaultValue={HEURE_PAR_DEFAUT} className={`${CHAMP} min-h-11`} />
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
  );
}
