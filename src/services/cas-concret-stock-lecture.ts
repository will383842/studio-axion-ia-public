/**
 * Lecture du STOCK DES CAS pour la page (lecture seule) : les scripts validés (studio, sinon code) et les vidéos du format,
 * rangés par `construireStockCas`. N'écrit rien, ne dépense rien. Session exigée.
 */
import "server-only";
import type { CasTraite } from "@/domaine/cas-traites";
import { marquerAttentes, statutEffectif } from "@/domaine/sujets-traites";
import { CATALOGUE, casVisibles } from "@/formats/cas-concret/catalogue";
import { depots } from "./_commun";
import { exigerSession } from "./auth";
import { scriptsValidesDe } from "./cas-concret-scripts-lot";
import { lireCasRetires } from "./cas-concret-retires";
import { lireCasAjoutes } from "./cas-concret-ajoutes-lecture";
import { lireCasTraites } from "./cas-concret-traites";
import { construireStockCas, type LigneStock } from "./cas-concret-stock";
import type { ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";

const FORMAT_CAS_CONCRET_ID = "cas-concret";

/**
 * `montants` : les prix « au plus » déjà calculés par la page (centimes, par cas) ; absent : aucun prix affiché.
 * `catalogueEtendu` : réglage `casConcret.catalogueEtendu` ; éteint, les cas de la phase 2 restent hors du stock (comme sur la page).
 * `stockMetiers` : réglage `casConcret.stockMetiers` ; éteint, les cas du stock par métier restent hors du stock.
 * `traites` : les cas traités déjà lus par la page (une seule lecture par affichage) ; absent, ils sont lus ici.
 * `scripts` : les scripts déjà lus par la page (une seule lecture du réglage) ; absent, ils sont lus ici, une seule fois pour tous les cas.
 */
export async function lireStockCas(montants?: Record<string, number>, catalogueEtendu = false, stockMetiers = false, scripts?: Record<string, ScriptValide | null>, traites?: ReadonlyMap<string, CasTraite>, retires?: ReadonlySet<string>): Promise<LigneStock[]> {
  await exigerSession();
  // Un cas retiré par Will n'est ni compté ni listé (absent : lu ici).
  const lesRetires = retires ?? (await lireCasRetires());
  const catalogue = casVisibles(CATALOGUE.map((cas) => ({ cas })), { catalogueEtendu, stockMetiers }).map((x) => x.cas).concat(await lireCasAjoutes()).filter((c) => !lesRetires.has(c.id));
  const [lues, valides] = await Promise.all([depots().videos.lister((v) => v.formatId === FORMAT_CAS_CONCRET_ID), scripts ?? scriptsValidesDe(catalogue.map((c) => c.id))]);
  // Une pause « script à valider » (échec marqué par son dernier travail) compte comme traitée, comme dans l'anti-doublon.
  const enEchec = lues.filter((v) => statutEffectif(v) === "echec");
  const videos = enEchec.length
    ? await depots().travaux.lister((t) => enEchec.some((v) => v.id === t.cibleId) && t.type !== "reexport", (t) => ({ ...t, parametres: undefined, etapes: (t.etapes ?? []).map((e) => ({ ...e, sortieFichierIds: [] })) }) as typeof t).then((travaux) => {
        const marquees = new Map(marquerAttentes(enEchec, travaux).map((v) => [v.id, v]));
        return lues.map((v) => marquees.get(v.id) ?? v);
      })
    : lues;
  return construireStockCas({ scripts: valides, videos, montants, catalogue, traites: traites ?? (await lireCasTraites()) });
}
