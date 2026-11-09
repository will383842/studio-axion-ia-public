import { TAILLES, type NiveauCible } from "@/domaine/ciblage/types";

const NIVEAUX: { id: NiveauCible; libelle: string }[] = [
  { id: "metier", libelle: "Un métier" },
  { id: "secteur", libelle: "Un secteur" },
  { id: "taille", libelle: "Une taille d'entreprise" },
];

export interface ChoixCibleProps {
  niveau?: NiveauCible;
  /** Valeur saisie ou taille choisie (TPE, PME, ETI). */
  valeur?: string;
  suggestions?: string[];
  chargement?: boolean;
  erreur?: boolean;
  nom?: string;
}

export type EtatSuggestions = "chargement" | "erreur" | "vide" | "rempli";

export function etatSuggestions(p: Pick<ChoixCibleProps, "suggestions" | "chargement" | "erreur">): EtatSuggestions {
  if (p.chargement) return "chargement";
  if (p.erreur) return "erreur";
  return p.suggestions && p.suggestions.length > 0 ? "rempli" : "vide";
}

const MESSAGES: Record<Exclude<EtatSuggestions, "rempli">, string> = {
  chargement: "Chargement des suggestions…",
  vide: "Aucune suggestion, écrivez la vôtre.",
  erreur: "Suggestions indisponibles, la saisie reste possible.",
};

/** Étape 1 : le niveau de cible ; étape 2 : la taille, ou un champ libre avec suggestions. Rendu serveur compatible. */
export function ChoixCible({ niveau, valeur, suggestions = [], chargement, erreur, nom = "cible" }: ChoixCibleProps) {
  const etat = etatSuggestions({ suggestions, chargement, erreur });
  const idListe = `${nom}-suggestions`;
  return (
    <div className="flex flex-col gap-4 text-texte">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-texte-doux">Qui visez-vous ?</legend>
        {NIVEAUX.map((n) => (
          <label key={n.id} className="flex items-center gap-2 rounded-lg border border-trait bg-surface-2 px-3 py-2">
            <input type="radio" name={`${nom}-niveau`} value={n.id} defaultChecked={niveau === n.id} />
            <span>{n.libelle}</span>
          </label>
        ))}
      </fieldset>
      {niveau === "taille" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-texte-doux">Quelle taille ?</legend>
          {TAILLES.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded-lg border border-trait bg-surface-2 px-3 py-2">
              <input type="radio" name={`${nom}-taille`} value={t.id} defaultChecked={valeur === t.id} />
              <span>{t.libelle}</span>
            </label>
          ))}
        </fieldset>
      ) : niveau ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${nom}-libelle`} className="text-sm text-texte-doux">{niveau === "metier" ? "Quel métier ?" : "Quel secteur ?"}</label>
          <input
            id={`${nom}-libelle`}
            name={`${nom}-libelle`}
            type="text"
            maxLength={80}
            defaultValue={valeur}
            list={etat === "rempli" ? idListe : undefined}
            aria-describedby={`${nom}-aide`}
            className="rounded-lg border border-trait bg-surface-2 px-3 py-2 text-texte"
          />
          {etat === "rempli" ? (
            <datalist id={idListe}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          ) : (
            <p role="status" className="text-sm text-texte-faible">{MESSAGES[etat]}</p>
          )}
          <p id={`${nom}-aide`} className="text-sm text-texte-faible">Elle sera nommée dans les 5 premières secondes.</p>
        </div>
      ) : null}
    </div>
  );
}
