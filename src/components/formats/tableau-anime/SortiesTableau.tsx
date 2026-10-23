/**
 * LES VIDÉOS DU TABLEAU ANIMÉ, UNE PAR FORMAT : chacune avec les réseaux EXACTS qu'elle sert et son bouton de
 * téléchargement. Deux verticaux quand TikTok et Shorts ont leur propre fin (sans promesse d'envoi) ; l'alerte de leur
 * fin (« phrase à valider ») est montrée sous le fichier concerné.
 */
import { Bouton } from "@/components/ui/Bouton";
import type { SortieTableauVue } from "@/services/tableau-vue";

export function SortiesTableau({ sorties }: { sorties: readonly SortieTableauVue[] }) {
  if (!sorties.length) return null;
  return (
    <section aria-label="Vos vidéos" className="space-y-2">
      <h2 className="text-sm font-semibold text-texte-doux">{sorties.length > 1 ? "Vos vidéos, une par fichier" : "Votre vidéo"}</h2>
      <ul className="space-y-2">
        {sorties.map((s) => (
          <li key={`${s.libelle}-${s.dimensions}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-texte">
                {s.libelle} <span className="font-normal text-texte-doux">· {s.dimensions}</span>
              </p>
              <p className="text-sm text-texte-doux">{s.reseaux.join(", ")}</p>
              {s.alertes?.map((a) => (
                <p key={a} role="note" className="mt-1 text-sm font-medium text-texte">
                  {a}
                </p>
              ))}
            </div>
            {s.url ? (
              <Bouton variante="secondaire" icone="telecharger" asChild>
                <a href={s.url} download>
                  Télécharger
                </a>
              </Bouton>
            ) : (
              <span className="text-sm text-texte-doux">Pas encore prête</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
