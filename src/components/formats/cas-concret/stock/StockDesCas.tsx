/** « Stock des cas » : où en est chaque cas, combien de vidéos sont faites. Lecture seule, repliable, sans bouton qui dépense. */
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { OFFRES_PASTILLES } from "@/components/formats/cas-concret/entree/vue";
import type { IdeeAutomatisation } from "@/formats/cas-concret/stock-idees";
import { phraseSynthese, synthese, type EtatVideoCas, type LigneStock } from "@/services/cas-concret-stock";
import { centimes, formaterMontant } from "@/lib/montants";

const ETATS: { etat: EtatVideoCas; libelle: string; ton: "neutre" | "orange" | "ambre" | "sauge" | "brique" }[] = [
  { etat: "brouillon", libelle: "brouillon", ton: "neutre" },
  { etat: "en-fabrication", libelle: "en fabrication", ton: "orange" },
  { etat: "a-relire", libelle: "à relire", ton: "ambre" },
  { etat: "validee", libelle: "validée", ton: "sauge" },
  { etat: "a-reprendre", libelle: "à reprendre", ton: "brique" },
];

/** « 09/10 » (jour/mois, heure de Paris) ; vide si la date est illisible. */
export function jourMois(iso: string | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }).format(t);
}

const jourComplet = (jour: string): string => jour.split("-").reverse().join("/");

function CarteStock({ l }: { l: LigneStock }) {
  const offre = OFFRES_PASTILLES.find((o) => o.valeur === l.offre)?.libelle ?? "";
  const dernier = jourMois(l.videos.derniere);
  return (
    <Carte as="li" className="list-none">
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap gap-1.5">
          {l.script.valide ? <Pastille ton="sauge" icone="coche">Script validé</Pastille> : <Pastille ton="ambre" icone="oeil">Script à valider</Pastille>}
          <Pastille ton={l.videos.faites > 0 ? "sauge" : "neutre"}>{l.videos.faites} {l.videos.faites > 1 ? "vidéos faites" : "vidéo faite"}</Pastille>
          {dernier && <Pastille>Dernière le {dernier}</Pastille>}
        </span>
        <span className="text-[17px] font-semibold text-texte">{l.titre}</span>
        <span className="text-[13px] text-texte-doux">
          {[l.posture === "chez-nous" ? "Chez nous" : "Notre offre", offre, l.theme].filter(Boolean).join(" · ")}
        </span>
        {l.script.valide && <span className="text-[13px] text-texte-doux">Version {l.script.version} · {jourComplet(l.script.date)}</span>}
        {l.videos.total > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {ETATS.filter((e) => l.videos.parEtat[e.etat]).map((e) => (
              <Pastille key={e.etat} ton={e.ton}>{l.videos.parEtat[e.etat]} {e.libelle}</Pastille>
            ))}
          </span>
        )}
        {l.prixAuPlusCentimes !== undefined && <span className="text-[13px] text-texte-doux">Prix : {formaterMontant(centimes(l.prixAuPlusCentimes))} au plus</span>}
        {l.faits.aSignaler.length > 0 && (
          <span className="text-[13px] text-ambre">
            {l.faits.aSignaler.length > 1 ? `${l.faits.aSignaler.length} faits à vérifier` : "1 fait à vérifier"} sur {l.faits.total}
          </span>
        )}
      </div>
    </Carte>
  );
}

export function StockDesCas({ lignes, idees }: { lignes: readonly LigneStock[]; idees: readonly IdeeAutomatisation[] }) {
  return (
    <details className="group mt-6 rounded-carte border border-trait bg-surface-1 p-4">
      <summary className="flex min-h-11 cursor-pointer flex-col justify-center gap-1">
        <span className="text-[17px] font-semibold text-texte">Stock des cas</span>
        <span className="text-[13px] text-texte-doux">{phraseSynthese(synthese(lignes))}</span>
      </summary>
      <ul className="mt-4 flex flex-col gap-3 p-0">
        {lignes.map((l) => <CarteStock key={l.casId} l={l} />)}
      </ul>
      <section className="mt-6">
        <h3 className="text-[15px] font-semibold text-texte">Idées à venir ({idees.length})</h3>
        {idees.length === 0 ? (
          <p className="mt-1 text-[13px] text-texte-doux">Aucune idée pour le moment.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3 p-0">
            {idees.map((i) => (
              <Carte as="li" key={i.id} className="list-none">
                <span className="block text-[15px] font-semibold text-texte">{i.nom}</span>
                <span className="block text-[13px] text-texte-doux">{i.resume}</span>
              </Carte>
            ))}
          </ul>
        )}
      </section>
    </details>
  );
}
