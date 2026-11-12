import type { IdReseau } from "@/domaine/types";
import { compterLegende, phraseCompteur, phraseDuCodeLegende } from "./compteur";

type ActionFormulaire = (donnees: FormData) => Promise<void>;

/**
 * Relecture du texte d'un visuel pour un réseau (L4-13, D4-20) : le texte, le compteur de caractères, « Enregistrer »
 * et « Réécrire ». Les deux actions sont fournies par la page (celles de `carrousels/[id]/actions.ts`). Aucun appel ici.
 */
export function FicheLegende({ id, reseau, texte, erreur, enregistrer, reecrire }: { id: string; reseau: IdReseau; texte: string; erreur?: string; enregistrer: ActionFormulaire; reecrire: ActionFormulaire }) {
  const etat = compterLegende(texte, reseau);
  const phraseErreur = phraseDuCodeLegende(erreur) ?? (etat.depasse ? phraseDuCodeLegende("TROP_LONG") : undefined);
  const champ = `legende-${reseau}`;
  return (
    <form action={enregistrer} className="mb-6 rounded border border-trait p-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="reseau" value={reseau} />
      <label htmlFor={champ} className="mb-2 block text-sm font-semibold">
        Texte à publier
      </label>
      <textarea id={champ} name="texte" defaultValue={texte} rows={8} className="w-full rounded border border-trait p-2 text-sm" />
      <p className={`mt-1 text-sm ${etat.depasse ? "text-brique" : "text-texte-doux"}`}>{phraseCompteur(etat)}</p>
      {phraseErreur && (
        <p role="alert" className="mt-2 text-sm text-brique">
          {phraseErreur}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button type="submit" className="rounded bg-orange px-3 py-1.5 text-sm font-semibold text-sur-orange">
          Enregistrer le texte
        </button>
        <button type="submit" formAction={reecrire} formNoValidate className="rounded border border-trait px-3 py-1.5 text-sm">
          Réécrire (essai sans service externe)
        </button>
      </div>
    </form>
  );
}
