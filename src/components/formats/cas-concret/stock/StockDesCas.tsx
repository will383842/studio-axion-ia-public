/** « Stock des cas » : où en est chaque cas, combien de vidéos sont faites. Lecture seule, repliable, sans bouton qui dépense. */
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { OFFRES_PASTILLES } from "@/components/formats/cas-concret/entree/vue";
import type { IdeeAutomatisation } from "@/formats/cas-concret/stock-idees";
import { phraseSynthese, synthese, type EtatVideoCas, type LigneStock } from "@/services/cas-concret-stock";
import { centimes, formaterMontant } from "@/lib/montants";
import { filtrerStock, syntheseStock, type FiltresStock as Filtres } from "@/services/cas-concret-stock-synthese";
import { FiltresStock } from "./FiltresStock";
import { groupesDepuisCompteurs, lienStock, PAR_PAGE } from "./filtres-stock";

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
        {l.sujet && <span className="text-[15px] text-texte">{l.sujet}</span>}
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

/** « Idées à venir (n) » : les idées d'automatisation pas encore des cas. Lecture seule. */
export function IdeesAVenir({ idees }: { idees: readonly IdeeAutomatisation[] }) {
  return (
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
  );
}

/** Une case du bandeau : un chiffre et son nom. */
function CaseBandeau({ nombre, libelle }: { nombre: number; libelle: string }) {
  return (
    <div className="flex min-h-11 flex-col rounded-carte border border-trait bg-surface-2 px-3 py-2">
      <span className="text-[22px] font-semibold text-texte">{nombre}</span>
      <span className="text-[13px] text-texte-doux">{libelle}</span>
    </div>
  );
}

/**
 * Lot K4 : le tableau de bord (bandeau, compteurs filtrables, liste de 20 par page). Lecture seule : que des liens, aucun bouton qui dépense.
 * `tableau.filtres` vient des paramètres de lien, déjà nettoyés par `lireParamsStock`.
 */
function TableauDeBord({ lignes, filtres, page }: { lignes: readonly LigneStock[]; filtres: Filtres; page: number }) {
  const compteurs = syntheseStock(lignes);
  const trouvees = filtrerStock(lignes, filtres);
  const pages = Math.max(1, Math.ceil(trouvees.length / PAR_PAGE));
  const courante = Math.min(page, pages);
  const visibles = trouvees.slice((courante - 1) * PAR_PAGE, courante * PAR_PAGE);
  const lien = (p: number) => lienStock(filtres, p);
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Bandeau du stock">
        <CaseBandeau nombre={compteurs.total} libelle="Cas au total" />
        <CaseBandeau nombre={compteurs.parEtat.restant} libelle="Restants" />
        <CaseBandeau nombre={compteurs.parEtat.traite} libelle="Déjà faits" />
        <CaseBandeau nombre={compteurs.parEtat["a-valider"]} libelle="À valider" />
        <CaseBandeau nombre={compteurs.parEtat.valide} libelle="Validés" />
      </div>
      <div className="mt-4">
        <FiltresStock groupes={groupesDepuisCompteurs(compteurs)} actuels={filtres} hrefDe={(f) => lienStock(f)} />
      </div>
      {visibles.length === 0 ? (
        <p className="mt-4 py-6 text-center text-[15px] text-texte-doux">Aucun cas pour ces filtres.</p>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-texte-doux">{trouvees.length > 1 ? `${trouvees.length} cas` : "1 cas"}</p>
          <ul className="mt-2 flex flex-col gap-3 p-0">
            {visibles.map((l) => <CarteStock key={l.casId} l={l} />)}
          </ul>
        </>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pages du stock">
          {courante > 1 ? <a className="inline-flex min-h-11 items-center text-[15px] text-orange-vif" href={lien(courante - 1)}>Page précédente</a> : <span />}
          <span className="text-[13px] text-texte-doux">Page {courante} sur {pages}</span>
          {courante < pages ? <a className="inline-flex min-h-11 items-center text-[15px] text-orange-vif" href={lien(courante + 1)}>Page suivante</a> : <span />}
        </nav>
      )}
    </>
  );
}

/**
 * `tableau` : lot K4, seulement quand le réglage `casConcret.stockMetiers` est allumé et que le stock a des cas rangés.
 * Absent, la carte est exactement celle d'avant (toutes les lignes, repliée).
 */
export function StockDesCas({ lignes, idees, tableau, ouvert: ouvertParLien }: { lignes: readonly LigneStock[]; idees: readonly IdeeAutomatisation[]; ouvert?: boolean; tableau?: { filtres: Filtres; page: number; ouvert?: boolean } }) {
  const ouvert = ouvertParLien === true || (!!tableau && (tableau.ouvert === true || tableau.page > 1 || Object.values(tableau.filtres).some(Boolean)));
  const nbTraites = lignes.filter((l) => l.traite).length;
  return (
    <>
    {nbTraites > 0 && (
      <p className="mt-6">
        <a className="inline-flex min-h-11 items-center rounded-sm text-[15px] font-semibold text-orange-vif underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif" href="/cas-concret/deja-faits">{nbTraites > 1 ? `${nbTraites} cas déjà faits` : "1 cas déjà fait"}</a>
      </p>
    )}
    <details id={tableau ? "stock" : undefined} open={ouvert || undefined} className="group mt-6 rounded-carte border border-trait bg-surface-1 p-4">
      <summary className="flex min-h-11 cursor-pointer flex-col justify-center gap-1">
        <span className="text-[17px] font-semibold text-texte">Stock des cas</span>
        <span className="text-[13px] text-texte-doux">{phraseSynthese(synthese(lignes))}</span>
      </summary>
      {tableau ? (
        <TableauDeBord lignes={lignes} filtres={tableau.filtres} page={tableau.page} />
      ) : (
        <ul className="mt-4 flex flex-col gap-3 p-0">
          {lignes.map((l) => <CarteStock key={l.casId} l={l} />)}
        </ul>
      )}
      {nbTraites > 0 && (
        <p className="mt-6 text-[13px] text-texte-doux">
          Les cas déjà faits sont sur la <a className="inline-flex min-h-11 items-center text-orange-vif underline" href="/cas-concret/deja-faits">page Cas déjà faits</a>.
        </p>
      )}
      <IdeesAVenir idees={idees} />
    </details>
    </>
  );
}
