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
import { lireStockCas } from "@/services/cas-concret-stock-lecture";
import { apercuDesEcrans } from "@/moteurs/montage-cas-concret/script-valide";

export const metadata: Metadata = { title: "Cas concret MD" };
export const dynamic = "force-dynamic";

const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

/**
 * CAS CONCRET MD : une phrase, une vidéo. Atteignable par son adresse même quand le format est masqué (aucun lien ne la
 * montre). Les cas validés en cartes, les autres dans « À valider ».
 */
export default async function PageCasConcret() {
  const [liste, voix, mots, etendu, ecranFourni, porteB, stockMetiers] = await Promise.all([listerCas(), etatVoixCasConcret(), etatMotsCasConcret(), reglageAllume(REGLAGES_CAS_CONCRET.catalogueEtendu), reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni), reglageAllume(REGLAGES_CAS_CONCRET.porteB), reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers)]);
  // Portage phase 2 : les cas ajoutés ne sont montrés que si `casConcret.catalogueEtendu` est allumé (éteint par défaut).
  const valides = casVisibles(liste.valides, { catalogueEtendu: etendu, stockMetiers });
  const aValider = casVisibles(liste.aValider, { catalogueEtendu: etendu, stockMetiers });
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
  const stock = await lireStockCas(montants, etendu, stockMetiers, scripts);
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Cas concret MD" sousTitre="Une phrase, une vidéo." />
      <EntreeCasConcret
        valides={valides.map((c) => versVueCas(c.cas, c.empreinte, true, apercus[c.cas.id], ecranFourni))}
        aValider={aValider.map((c) => versVueCas(c.cas, c.empreinte, false, apercus[c.cas.id], ecranFourni))}
        montants={montants}
        refus={refus}
        voix={voix}
        mots={mots}
        porteB={porteB}
      />
      <StockDesCas lignes={stock} idees={IDEES_A_VENIR} />
    </div>
  );
}
