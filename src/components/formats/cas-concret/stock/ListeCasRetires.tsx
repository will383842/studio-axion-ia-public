/** Liste de la page « Cas retirés » : un cas par carte. Composant serveur ; seul le bouton « Remettre ce cas » est côté navigateur. */
import { Carte } from "@/components/ui/Carte";
import { BoutonRemettreCas } from "./BoutonRemettreCas";
import type { CasRetire } from "./cas-retires";

export function ListeCasRetires({ cas }: { cas: readonly CasRetire[] }) {
  if (cas.length === 0) return <p className="py-6 text-center text-[15px] text-texte-doux">Aucun cas retiré pour l&apos;instant.</p>;
  return (
    <section aria-labelledby="titre-cas-retires">
      <h2 id="titre-cas-retires" className="text-[15px] font-semibold text-texte">{cas.length > 1 ? `${cas.length} cas retirés` : "1 cas retiré"}</h2>
      <ul className="mt-3 flex flex-col gap-3 p-0">
        {cas.map((c) => (
          <Carte as="li" key={c.casId} className="list-none">
            <div className="flex flex-col gap-2">
              <h3 className="text-[17px] font-semibold text-texte">{c.titre}</h3>
              {c.details && <span className="text-[13px] text-texte-doux">{c.details}</span>}
              {c.date && <span className="text-[13px] text-texte-doux">Retiré le {c.date}</span>}
              {c.auCatalogue ? (
                <div>
                  <BoutonRemettreCas casId={c.casId} titre={c.titre} />
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
