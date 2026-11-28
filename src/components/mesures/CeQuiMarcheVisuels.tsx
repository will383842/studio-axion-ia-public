import { Carte } from "@/components/ui/Carte";
import { INDICATEURS, ordinal, type RangVideo } from "@/domaine/mesures-rangs";
import { libelleIndicateur, MESURES_NON_DISPONIBLES, type ClassementReseauVisuels } from "@/domaine/mesures-visuels";
import type { ReseauDeclinaison } from "@/domaine/types";
import type { ReseauMesureVisuel } from "@/domaine/mesures-visuels";
import { nomDuReseau } from "@/reseaux/hors-video";
import type { CeQuiMarcheVisuelsDonnees, EtatsVisuels } from "@/services/mesures-visuels";

/**
 * « CARROUSELS » (fiche L5-18a) : le classement des carrousels, SÉPARÉ de celui des vidéos, et une ligne des trois états.
 * Affichage seulement : rien n'est lu ni écrit ici. Écran de 390 px : une colonne, peu de texte. Aucun montant.
 */
const FAMILLES: Record<string, string> = { carrousel: "Carrousel", "carrousel-continu": "Carrousel continu", infographie: "Infographie" };

export const LIBELLES_VISUELS = {
  titre: "Carrousels",
  explication: "Vos carrousels sont classés entre eux, jamais avec vos vidéos.",
  vide: "Pas encore de carrousel mesuré. Les chiffres arrivent après la publication.",
  tropTot: "Trop tôt pour dire : il faut au moins 3 carrousels mesurés sur ce réseau.",
  nonDisponible: "non disponible",
} as const;

/** « 3 mesurés · 1 pas encore · 2 non disponibles ». */
export function ligneEtats(e: EtatsVisuels): string {
  const s = (n: number) => (n > 1 ? "s" : "");
  return `${e.mesure} mesuré${s(e.mesure)} · ${e.pasEncore} pas encore · ${e.nonDisponible} non disponible${s(e.nonDisponible)}`;
}

function LigneRang({ r, reseau }: { r: RangVideo; reseau: ReseauMesureVisuel }) {
  const manquants = MESURES_NON_DISPONIBLES[reseau as ReseauDeclinaison] ?? [];
  return (
    <li className="flex items-start gap-3 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 font-titre text-lg tabular-nums text-texte">{r.rang}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-texte">{r.video.titre || FAMILLES[r.video.formatId] || "Carrousel"}</p>
        <p className="text-xs text-texte-faible">{FAMILLES[r.video.formatId] ?? "Visuel"}</p>
        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texte-doux">
          {INDICATEURS.filter((i) => r.parIndicateur[i.id]).map((i) => (
            <div key={i.id} className="flex gap-1">
              <dt>{i.libelle} :</dt>
              <dd className="tabular-nums text-texte">
                {ordinal(r.parIndicateur[i.id]!.rang)} sur {r.parIndicateur[i.id]!.sur}
              </dd>
            </div>
          ))}
          {manquants.map((i) => (
            <div key={i} className="flex gap-1">
              <dt>{libelleIndicateur(i)} :</dt>
              <dd className="text-texte-faible">{LIBELLES_VISUELS.nonDisponible}</dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  );
}

function BlocReseau({ g }: { g: ClassementReseauVisuels }) {
  return (
    <section aria-label={nomDuReseau(g.reseau)} className="space-y-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold text-texte">
        <span className="flex-1">{nomDuReseau(g.reseau)}</span>
        <span className="text-xs font-normal tabular-nums text-texte-faible">
          {g.nombre} carrousel{g.nombre > 1 ? "s" : ""}
        </span>
      </h3>
      {g.tropTot ? (
        <Carte className="text-xs text-texte-faible">{LIBELLES_VISUELS.tropTot}</Carte>
      ) : (
        <Carte sansMarge>
          <ul className="divide-y divide-trait">
            {g.rangs.map((r) => (
              <LigneRang key={r.video.publicationId} r={r} reseau={g.reseau} />
            ))}
          </ul>
        </Carte>
      )}
    </section>
  );
}

export function CeQuiMarcheVisuels({ donnees }: { donnees: CeQuiMarcheVisuelsDonnees }) {
  const { classement, etats } = donnees;
  return (
    <section aria-labelledby="titre-carrousels" className="mt-7 space-y-3">
      <h2 id="titre-carrousels" className="font-titre text-xl text-texte">
        {LIBELLES_VISUELS.titre}
      </h2>
      <p className="text-sm text-texte-doux">{LIBELLES_VISUELS.explication}</p>
      <p className="text-sm tabular-nums text-texte">{ligneEtats(etats)}</p>
      {classement.nombre === 0 ? <Carte className="text-sm text-texte-doux">{LIBELLES_VISUELS.vide}</Carte> : classement.reseaux.map((g) => <BlocReseau key={g.reseau} g={g} />)}
    </section>
  );
}
