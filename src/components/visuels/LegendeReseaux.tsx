/**
 * Lot C : bloc « Légende » de la fiche d'un carrousel. Une zone de texte par réseau préparé, préremplie avec la légende
 * enregistrée par la personne. Un texte automatique n'est jamais présenté comme relu : il faut l'enregistrer.
 * Aucun appel ici ; l'action d'enregistrement est celle de la page.
 */
import { Bouton } from "@/components/ui/Bouton";
import type { IdReseau } from "@/domaine/types";
import { compterLegende, phraseCompteur } from "@/components/visuels-texte/compteur";

type ActionFormulaire = (donnees: FormData) => Promise<void>;
export interface LegendeStockee { texte: string; simulation?: boolean }

const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" };

export function LegendeReseaux({ id, reseaux, legendes, statut, aCompleter = [], refus, enregistrer }: {
  id: string;
  reseaux: readonly IdReseau[];
  legendes: Partial<Record<IdReseau, LegendeStockee>>;
  statut: "valide" | "programme";
  aCompleter?: readonly string[];
  refus?: string;
  enregistrer: ActionFormulaire;
}) {
  if (reseaux.length === 0) return null;
  const libelle = statut === "programme" ? "Enregistrer la légende et la valider pour l'envoi" : "Enregistrer la légende";
  return (
    <section aria-label="Légende" className="mb-6 flex flex-col gap-3 rounded-champ border border-trait bg-surface-1 px-3.5 py-3">
      <h2 className="text-sm font-semibold text-texte-doux">Légende</h2>
      {refus && <p role="alert" className="text-sm text-brique">{refus}</p>}
      {reseaux.map((r) => {
        const l = legendes[r];
        const auto = l?.simulation === true;
        // « À compléter » vient de la page (texte du créneau vivant), pas de la légende du visuel.
        const manque = aCompleter.includes(r) || auto;
        const champ = `legende-${r}`;
        const nom = NOMS[r] ?? r;
        return (
          <form key={r} action={enregistrer} className="flex flex-col gap-1.5">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="reseau" value={r} />
            <label htmlFor={champ} className="text-sm font-semibold text-texte">{nom}</label>
            {auto && <p role="status" className="text-sm text-texte-doux">Texte automatique : relisez-le, puis enregistrez.</p>}
            {manque && !auto && <p role="status" className="text-sm text-texte-doux">{nom} : légende à écrire avant tout envoi.</p>}
            <textarea id={champ} name="texte" defaultValue={l?.texte ?? ""} rows={5} className="w-full rounded-champ border border-trait bg-surface-1 p-2 text-sm text-texte" />
            <p className="text-sm text-texte-doux">{phraseCompteur(compterLegende(l?.texte ?? "", r))}</p>
            <Bouton type="submit" variante="secondaire" className="self-start">{libelle}</Bouton>
          </form>
        );
      })}
    </section>
  );
}
