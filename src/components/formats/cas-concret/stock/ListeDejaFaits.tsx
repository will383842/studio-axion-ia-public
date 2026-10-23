/** Liste de la page « Déjà faits » : un cas par carte. Composant serveur ; seul le bouton « Remettre en stock » est côté navigateur. */
import { Carte } from "@/components/ui/Carte";
import { BoutonRemettreEnStock } from "./BoutonRemettreEnStock";
import type { CasDejaFait } from "./deja-faits";

export function ListeDejaFaits({ cas }: { cas: readonly CasDejaFait[] }) {
  if (cas.length === 0) return <p className="py-6 text-center text-[15px] text-texte-doux">Aucun cas fait pour l&apos;instant.</p>;
  return (
    <section aria-labelledby="titre-deja-faits">
      <h2 id="titre-deja-faits" className="text-[15px] font-semibold text-texte">{cas.length > 1 ? `${cas.length} cas faits` : "1 cas fait"}</h2>
      <ul className="mt-3 flex flex-col gap-3 p-0">
        {cas.map((c) => (
          <Carte as="li" key={c.casId} className="list-none">
            <div className="flex flex-col gap-2">
              <h3 className="text-[17px] font-semibold text-texte">{c.titre}</h3>
              {c.details && <span className="text-[13px] text-texte-doux">{c.details}</span>}
              <span className="text-[13px] text-texte-doux">
                {c.date ? `Vidéo du ${c.date} · ` : ""}
                {c.videoId ? (
                  <a className="inline-flex min-h-11 items-center rounded-sm text-orange-vif underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif" href={`/videos/${c.videoId}`} aria-label={`Voir la vidéo : ${c.titre}`}>Voir la vidéo</a>
                ) : (
                  "Vidéo supprimée"
                )}
              </span>
              {c.auCatalogue ? (
                <div>
                  <BoutonRemettreEnStock casId={c.casId} titre={c.titre} />
                </div>
              ) : (
                <p className="text-[13px] text-texte-doux">Ce cas n&apos;existe plus dans le catalogue.</p>
              )}
            </div>
          </Carte>
        ))}
      </ul>
    </section>
  );
}
