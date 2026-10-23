import { Bouton } from "@/components/ui/Bouton";
import type { NomIcone } from "@/components/ui/Icone";
import { urlSure } from "../../domaine/visuels/depot";
import type { ActionCarrousel } from "@/domaine/visuels/contrats";
import type { MotifRefus } from "@/domaine/visuels/visuel";

export type ActionsCarrousel = Record<ActionCarrousel, (fd: FormData) => Promise<void>>;

const MOTIFS: { valeur: MotifRefus; libelle: string }[] = [
  { valeur: "texte", libelle: "Le texte" },
  { valeur: "mise_en_page", libelle: "La mise en page" },
  { valeur: "sujet", libelle: "Le sujet" },
  { valeur: "ton", libelle: "Le ton" },
  { valeur: "autre", libelle: "Autre chose" },
];

const BOUTONS: Record<Exclude<ActionCarrousel, "refuser">, { libelle: string; icone: NomIcone; variante: "principal" | "secondaire" | "danger" }> = {
  valider: { libelle: "Valider", icone: "coche", variante: "principal" },
  refaire: { libelle: "Refaire", icone: "reessayer", variante: "secondaire" },
  relancer_rendu: { libelle: "Relancer le rendu", icone: "actualiser", variante: "secondaire" },
  corbeille: { libelle: "Corbeille", icone: "corbeille", variante: "danger" },
  restaurer: { libelle: "Restaurer", icone: "archive", variante: "secondaire" },
};
const ORDRE: ActionCarrousel[] = ["valider", "refuser", "refaire", "relancer_rendu", "corbeille", "restaurer"];

/** Actions de la fiche. N'affiche QUE les actions permises ; les actions sont passées en props. */
export function BarreValidation({ id, actionsPermises, actions, pdfUrl: pdfBrut }: { id: string; actionsPermises: ActionCarrousel[]; actions: ActionsCarrousel; pdfUrl?: string }) {
  const pdfUrl = urlSure(pdfBrut);
  const permises = ORDRE.filter((a) => actionsPermises.includes(a));
  if (permises.length === 0 && !pdfUrl) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {permises
          .filter((a): a is Exclude<ActionCarrousel, "refuser"> => a !== "refuser")
          .map((a) => (
            <form key={a} action={actions[a]}>
              <input type="hidden" name="id" value={id} />
              <Bouton type="submit" variante={BOUTONS[a].variante} icone={BOUTONS[a].icone}>
                {BOUTONS[a].libelle}
              </Bouton>
            </form>
          ))}
        {pdfUrl && (
          <Bouton asChild variante="fantome" icone="telecharger">
            <a href={pdfUrl} download>
              Télécharger le PDF
            </a>
          </Bouton>
        )}
      </div>
      {permises.includes("refuser") && (
        <details className="group rounded-carte border border-trait bg-surface-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold text-texte hover:text-orange-vif">Refuser</summary>
          <form action={actions.refuser} className="flex flex-col gap-3 border-t border-trait p-4">
            <input type="hidden" name="id" value={id} />
            <label className="text-sm font-semibold text-texte-doux" htmlFor={`motif-${id}`}>
              Qu&apos;est-ce qui ne va pas ?
            </label>
            <select id={`motif-${id}`} name="motif" required defaultValue="" className="min-h-12 rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte">
              <option value="" disabled>
                Choisir…
              </option>
              {MOTIFS.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.libelle}
                </option>
              ))}
            </select>
            <label className="text-sm font-semibold text-texte-doux" htmlFor={`commentaire-${id}`}>
              Un mot pour expliquer (facultatif)
            </label>
            <textarea id={`commentaire-${id}`} name="commentaire" rows={3} maxLength={500} className="rounded-champ border border-trait bg-surface-1 px-3.5 py-3 text-[15px] text-texte" />
            <Bouton type="submit" variante="danger" className="self-start">
              Confirmer le refus
            </Bouton>
          </form>
        </details>
      )}
    </div>
  );
}
