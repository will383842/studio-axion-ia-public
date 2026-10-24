import type { Metadata } from "next";
import { EntreeCasConcret } from "@/components/formats/cas-concret/entree/EntreeCasConcret";
import { versVueCas } from "@/components/formats/cas-concret/entree/vue";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { casVisibles, estCasStock } from "@/formats/cas-concret/catalogue";
import { estimerCas, listerCas } from "@/services/cas-concret";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";
import { etatMotsCasConcret } from "@/services/cas-concret-mots";
import { avecConsigneVoix, etatVoixCasConcret } from "@/services/cas-concret-voix";
import { CAS_PAR_PAGE, preparerPageCas, scriptsValidesDe } from "@/services/cas-concret-scripts-lot";
import { StockDesCas } from "@/components/formats/cas-concret/stock/StockDesCas";
import { IDEES_A_VENIR } from "@/formats/cas-concret/stock-idees";
import { lireCasTraites } from "@/services/cas-concret-traites";
import { lireCasRetires } from "@/services/cas-concret-retires";
import { casProposables } from "@/components/formats/cas-concret/entree/proposables";
import { lireStockCas } from "@/services/cas-concret-stock-lecture";
import { lienStock, lireParamsStock } from "@/components/formats/cas-concret/stock/filtres-stock";
import { apercuDesEcrans } from "@/moteurs/montage-cas-concret/script-valide";

export const metadata: Metadata = { title: "Cas concret MD" };
export const dynamic = "force-dynamic";

const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

/**
 * CAS CONCRET MD : une phrase, une vidéo. Atteignable par son adresse même quand le format est masqué (aucun lien ne la
 * montre). Les cas validés en cartes, les autres dans « À valider ».
 */
export default async function PageCasConcret({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [liste, voix, mots, etendu, ecranFourni, porteB, stockMetiers, traites, retires] = await Promise.all([listerCas(), etatVoixCasConcret(), etatMotsCasConcret(), reglageAllume(REGLAGES_CAS_CONCRET.catalogueEtendu), reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni), reglageAllume(REGLAGES_CAS_CONCRET.porteB), reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers), lireCasTraites(), lireCasRetires()]);
  // Portage phase 2 : les cas ajoutés ne sont montrés que si `casConcret.catalogueEtendu` est allumé (éteint par défaut).
  // Un cas TRAITÉ (vidéo allée au bout) n'est plus proposé : ni dans la liste, ni estimé, ni piochable (les 22 cas d'origine aussi).
  // Il reste visible, avec son bouton « Remettre en stock », sur la page « Déjà faits » (/cas-concret/deja-faits).
  const valides = casProposables(casVisibles(liste.valides, { catalogueEtendu: etendu, stockMetiers }), traites, retires);
  const aValider = casProposables(casVisibles(liste.aValider, { catalogueEtendu: etendu, stockMetiers }), traites, retires);
  // K3 : le réglage des scripts est lu UNE fois pour tous les cas ; les cas d'avant le stock sont tous estimés (comme avant K3) ;
  // seuls 20 cas du stock au plus le sont. Les autres s'ouvrent sans prix : la feuille « Votre vidéo » l'estime à l'ouverture.
  const scripts = await scriptsValidesDe([...valides, ...aValider].map((c) => c.cas.id));
  // X7 : le refus avant le prix du choix par défaut (cas validé, sans le mot) ; un cas à valider s'ouvre en essai.
  const { montants, refus } = await preparerPageCas(valides, aValider, async (c, essai) => {
    const e = await estimerCas(c.cas.id, RESEAUX, false, essai ? { essai: true } : { empreinteVue: c.empreinte });
    const r = !essai && e.refus ? avecConsigneVoix({ statut: "refusee", phrase: e.refus }) : null;
    return { centimes: e.centimes, ...(r?.statut === "refusee" ? { refus: r.phrase } : {}) };
  }, CAS_PAR_PAGE, estCasStock);
  // V4-3 : le script validé de chaque cas, montré avant la voix (texte dit et ordre des écrans).
  const apercus: Record<string, ReturnType<typeof apercuDesEcrans>> = {};
  for (const c of [...valides, ...aValider]) {
    const s = scripts[c.cas.id];
    if (s && s.versionCas === c.cas.version) apercus[c.cas.id] = apercuDesEcrans(s.ecrans);
  }
  const stock = await lireStockCas(montants, etendu, stockMetiers, scripts, traites, retires);
  // Lots K4-K5 : le tableau de bord et les filtres n'existent que réglage allumé ET cas rangés ; sinon la page est celle d'avant.
  const avecStock = stockMetiers && stock.some((l) => l.rangement);
  const infos = new Map(stock.map((l) => [l.casId, { traite: l.videos.comptees > 0 || !!l.traite, ...(l.rangement ? { fiche: l.rangement.fiche, secteur: l.rangement.secteur, taille: l.rangement.taille } : {}) }]));
  const vue = (c: (typeof valides)[number], valide: boolean) => {
    const v = versVueCas(c.cas, c.empreinte, valide, apercus[c.cas.id], ecranFourni);
    const info = avecStock ? infos.get(c.cas.id) : undefined;
    return info ? { ...v, stock: info } : v;
  };
  const params = avecStock ? lireParamsStock(await searchParams, stock.flatMap((l) => (l.rangement ? [l.rangement.secteur] : []))) : null;
  const nbFaits = stock.filter((l) => !!l.traite).length;
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Cas concret MD" sousTitre="Une phrase, une vidéo." />
      <nav aria-label="Listes des cas" className="mt-4 flex flex-wrap gap-3">
        <a className="inline-flex min-h-11 items-center rounded-sm border border-trait px-4 text-[15px] font-semibold text-orange-vif focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif" href={avecStock ? lienStock({ etat: "restant" }) : "/cas-concret?stock=1"}>Cas restants à faire</a>
        <a className="inline-flex min-h-11 items-center rounded-sm border border-trait px-4 text-[15px] font-semibold text-orange-vif focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif" href="/cas-concret/deja-faits">{nbFaits > 0 ? `Cas déjà faits (${nbFaits})` : "Cas déjà faits"}</a>
        {retires.size > 0 && (
          <a className="inline-flex min-h-11 items-center rounded-sm border border-trait px-4 text-[15px] font-semibold text-orange-vif focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif" href="/cas-concret/retires">{`Cas retirés (${retires.size})`}</a>
        )}
      </nav>
      <EntreeCasConcret
        valides={valides.map((c) => vue(c, true))}
        aValider={aValider.map((c) => vue(c, false))}
        montants={montants}
        refus={refus}
        voix={voix}
        mots={mots}
        porteB={porteB}
      />
      <StockDesCas lignes={stock} idees={IDEES_A_VENIR} ouvert={(await searchParams).stock === "1"} {...(params ? { tableau: params } : {})} />
    </div>
  );
}
