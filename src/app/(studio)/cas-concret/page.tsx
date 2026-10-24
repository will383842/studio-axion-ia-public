import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lireSession } from "@/services/auth";
import { EntreeCasConcret } from "@/components/formats/cas-concret/entree/EntreeCasConcret";
import { stockDeLAjoute, versVueCas } from "@/components/formats/cas-concret/entree/vue";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { casVisibles, estCasStock } from "@/formats/cas-concret/catalogue";
import { estimerCas, listerCas } from "@/services/cas-concret";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";
import { etatMotsCasConcret } from "@/services/cas-concret-mots";
import { avecConsigneVoix, etatVoixCasConcret } from "@/services/cas-concret-voix";
import { CAS_PAR_PAGE, preparerPageCas, scriptsValidesDe } from "@/services/cas-concret-scripts-lot";
import { IdeesAVenir } from "@/components/formats/cas-concret/stock/StockDesCas";
import { listerDejaFaits } from "@/components/formats/cas-concret/stock/deja-faits";
import { ListeDejaFaits } from "@/components/formats/cas-concret/stock/ListeDejaFaits";
import { ListeCasRetires } from "@/components/formats/cas-concret/stock/ListeCasRetires";
import { ID_PANNEAU_CAS, idOnglet, OngletsCasConcret } from "@/components/formats/cas-concret/entree/OngletsCasConcret";
import { lireOnglet } from "@/components/formats/cas-concret/entree/onglets";
import { IDEES_A_VENIR } from "@/formats/cas-concret/stock-idees";
import { lireCasTraites } from "@/services/cas-concret-traites";
import { lireCasRetires, lireRetraits } from "@/services/cas-concret-retires";
import { estCasAjoute, lireEntreesCasAjoutes } from "@/services/cas-concret-ajoutes-lecture";
import Link from "next/link";
import { listerCasRetires } from "@/components/formats/cas-concret/stock/cas-retires";
import { casProposables } from "@/components/formats/cas-concret/entree/proposables";
import { lireStockCas } from "@/services/cas-concret-stock-lecture";
import { lireParamsStock } from "@/components/formats/cas-concret/stock/filtres-stock";
import { apercuDesEcrans } from "@/moteurs/montage-cas-concret/script-valide";

export const metadata: Metadata = { title: "Cas concret MD" };
export const dynamic = "force-dynamic";

const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

/**
 * CAS CONCRET MD : une phrase, une vidéo. Atteignable par son adresse même quand le format est masqué (aucun lien ne la
 * montre). Trois onglets en liens (`?onglet=a-faire|deja-faits|retires`, « À faire » par défaut) : la liste COMPLÈTE des cas à
 * faire (prêts à fabriquer, puis à valider, paginée), les cas déjà faits, les cas retirés. Les adresses /cas-concret/deja-faits
 * et /cas-concret/retires restent valables (même contenu).
 */
export default async function PageCasConcret({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [liste, voix, mots, etendu, ecranFourni, porteB, stockMetiers, traites, retires, ajoutes] = await Promise.all([listerCas(), etatVoixCasConcret(), etatMotsCasConcret(), reglageAllume(REGLAGES_CAS_CONCRET.catalogueEtendu), reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni), reglageAllume(REGLAGES_CAS_CONCRET.porteB), reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers), lireCasTraites(), lireCasRetires(), lireEntreesCasAjoutes()]);
  // Portage phase 2 : les cas ajoutés ne sont montrés que si `casConcret.catalogueEtendu` est allumé (éteint par défaut).
  // Un cas TRAITÉ (vidéo allée au bout) n'est plus proposé : ni dans la liste, ni estimé, ni piochable (les 22 cas d'origine aussi).
  // Il reste visible, avec son bouton « Remettre en stock », sur la page « Déjà faits » (/cas-concret/deja-faits).
  const valides = casProposables(casVisibles(liste.valides, { catalogueEtendu: etendu, stockMetiers }), traites, retires);
  const aValider = casProposables(casVisibles(liste.aValider, { catalogueEtendu: etendu, stockMetiers }), traites, retires);
  if (!(await lireSession())) redirect("/connexion");
  const regl = { catalogueEtendu: etendu, stockMetiers };
  const onglet = lireOnglet(await searchParams);
  // Les compteurs des trois onglets (et la ligne de synthèse) ne coûtent aucune estimation.
  const dejaFaits = listerDejaFaits(traites, regl, retires, Object.values(ajoutes));
  const casRetires = listerCasRetires(await lireRetraits(), regl, Object.values(ajoutes));
  const nombres = { "a-faire": valides.length + aValider.length, "deja-faits": dejaFaits.length, retires: casRetires.length };
  const synthese = { aFaire: nombres["a-faire"], faits: nombres["deja-faits"], valides: valides.length };
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Cas concret MD" sousTitre="Une phrase, une vidéo." />
      <OngletsCasConcret actif={onglet} nombres={nombres} synthese={synthese} />
      <section id={ID_PANNEAU_CAS} aria-labelledby={idOnglet(onglet)} className="mt-6">
        {onglet === "deja-faits" && (
          <>
            <p className="mb-4 text-[15px] text-texte-doux">Ces cas ont déjà leur vidéo. Remettez-en un en stock pour le refaire.</p>
            <ListeDejaFaits cas={dejaFaits} />
          </>
        )}
        {onglet === "retires" && (
          <>
            <p className="mb-4 text-[15px] text-texte-doux">Ces cas ne sont plus proposés. Remettez-en un pour le revoir dans la liste.</p>
            <ListeCasRetires cas={casRetires} />
          </>
        )}
        {onglet === "a-faire" && <OngletAFaire valides={valides} aValider={aValider} traites={traites} retires={retires} ajoutes={ajoutes} etendu={etendu} stockMetiers={stockMetiers} ecranFourni={ecranFourni} porteB={porteB} voix={voix} mots={mots} searchParams={await searchParams} />}
      </section>
    </div>
  );
}

type CasListe = Awaited<ReturnType<typeof listerCas>>["valides"];

/** L'onglet « À faire » : la liste complète et paginée, avec les prix et les scripts (calculés seulement ici). */
async function OngletAFaire({ valides, aValider, traites, retires, ajoutes, etendu, stockMetiers, ecranFourni, porteB, voix, mots, searchParams }: { valides: CasListe; aValider: CasListe; traites: Awaited<ReturnType<typeof lireCasTraites>>; retires: Awaited<ReturnType<typeof lireCasRetires>>; ajoutes: Awaited<ReturnType<typeof lireEntreesCasAjoutes>>; etendu: boolean; stockMetiers: boolean; ecranFourni: boolean; porteB: boolean; voix: Awaited<ReturnType<typeof etatVoixCasConcret>>; mots: Awaited<ReturnType<typeof etatMotsCasConcret>>; searchParams: Record<string, string | string[] | undefined> }) {
  // K3 : le réglage des scripts est lu UNE fois pour tous les cas ; les cas d'avant le stock sont tous estimés (comme avant K3) ;
  // seuls 20 cas du stock au plus le sont. Les autres s'ouvrent sans prix : la feuille « Votre vidéo » l'estime à l'ouverture.
  const scripts = await scriptsValidesDe([...valides, ...aValider].map((c) => c.cas.id));
  // X7 : le refus avant le prix du choix par défaut (cas validé, sans le mot) ; un cas à valider s'ouvre en essai.
  const { montants, refus } = await preparerPageCas(valides, aValider, async (c, essai) => {
    const e = await estimerCas(c.cas.id, RESEAUX, false, essai ? { essai: true } : { empreinteVue: c.empreinte });
    const r = !essai && e.refus ? avecConsigneVoix({ statut: "refusee", phrase: e.refus }) : null;
    return { centimes: e.centimes, ...(r?.statut === "refusee" ? { refus: r.phrase } : {}) };
  }, CAS_PAR_PAGE, (id) => estCasStock(id) || estCasAjoute(id));
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
    const avecScript = apercus[c.cas.id] && scripts[c.cas.id]?.fourni ? { ...v, scriptFourni: true } : v;
    const ajoute = ajoutes[c.cas.id];
    if (!ajoute) return info ? { ...avecScript, stock: info } : avecScript;
    // Un cas ajouté à la main : sa pastille, et son secteur / sa taille passent par `stock` pour que les filtres le voient.
    const stock = stockDeLAjoute(ajoute, info);
    return { ...avecScript, ajoute: {}, ...(stock ? { stock } : {}) };
  };
  const params = avecStock ? lireParamsStock(searchParams, stock.flatMap((l) => (l.rangement ? [l.rangement.secteur] : []))) : null;
  // Seuls le secteur et la taille d'une ancienne adresse deviennent des filtres de départ : l'état et l'offre n'ont ici aucun contrôle pour les retirer.
  const initiaux = params ? { ...(params.filtres.secteur ? { secteur: params.filtres.secteur } : {}), ...(params.filtres.taille ? { taille: params.filtres.taille } : {}) } : {};
  const filtresInitiaux = Object.keys(initiaux).length ? initiaux : undefined;
  return (
    <>
      <p className="mb-4">
        <Link href="/cas-concret/ajouter" className="inline-flex min-h-11 items-center rounded-sm text-[15px] font-semibold text-orange-vif underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif">
          Ajouter un cas
        </Link>
      </p>
      <EntreeCasConcret
        valides={valides.map((c) => vue(c, true))}
        aValider={aValider.map((c) => vue(c, false))}
        montants={montants}
        refus={refus}
        voix={voix}
        mots={mots}
        porteB={porteB}
        {...(filtresInitiaux ? { filtresInitiaux } : {})}
      />
      <IdeesAVenir idees={IDEES_A_VENIR} niveau="h2" />
    </>
  );
}
