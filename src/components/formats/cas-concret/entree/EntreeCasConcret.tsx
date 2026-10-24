"use client";

/**
 * L'écran de l'onglet « À faire » : la case, les offres, les filtres, « Proposez-moi un cas restant », les cartes « Prêts à
 * fabriquer » (cas validés), la liste paginée « À valider », la feuille
 * « Votre vidéo ». Trois gestes : choisir un cas, relire la feuille, « Fabriquer la vidéo ».
 * Brique 3 : un cas qui a un script validé passe par « Relire le script » (écran commun) ; le lancement part de là, avec
 * l'empreinte du texte relu, et une modification devient d'abord une nouvelle version validée du script.
 * P2S · porte B : « Faire la vidéo de ce cas » tire un cas du texte libre de la case (appel détaché, jamais attendu :
 * « Je prépare votre cas… », l'écran relit seul), puis ouvre la même feuille. Réglage `casConcret.porteB`, éteint : le
 * service refuse sans appel.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { confirmerCasAction, confirmerFaitPorteBAction, controlerScriptValideAction, demarrerPorteBAction, estimerCasAction, modifierScriptValideAction, preparerEtLancerAction, suivrePorteBAction, type VuePorteB } from "@/app/(studio)/cas-concret/actions";
import type { Resultat } from "@/services/_commun";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import type { PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import { modificationsDesDifferences } from "@/moteurs/montage-cas-concret/relecture";
import { notifier } from "@/components/ui/Toast";
import type { EtatMotsFeuille } from "@/formats/cas-concret/mots-branches";
import { CarteCas } from "./CarteCas";
import { CasAValider } from "./CasAValider";
import { CaseDuCas } from "./CaseDuCas";
import { FeuilleVotreVideo, type ChoixVideo, type EtatVoix } from "./FeuilleVotreVideo";
import { PastillesOffres } from "./PastillesOffres";
import { FiltresStock } from "@/components/formats/cas-concret/stock/FiltresStock";
import { PAR_PAGE } from "@/components/formats/cas-concret/stock/filtres-stock";
import type { FiltresStock as Filtres } from "@/services/cas-concret-stock-synthese";
import { filtrerCas, groupesDepuisCas, piocherCas, PHRASE_AUCUN_RESTANT } from "./piocher";
import { RelireAvantLancement } from "./RelireAvantLancement";
import { casCourant, enregistrerScriptRelu, PHRASE_SCRIPT_GARDE_AUTRE } from "./relire";
import { boutonPorteBVisible, classerCas, type FiltreOffre, type VueCas } from "./vue";

/** Relecture de la préparation d'un cas de la porte B. */
const RELECTURE_PORTE_B_MS = 1500;

type EtatCase = Exclude<VuePorteB, { statut: "pret" }>;

export function EntreeCasConcret({ valides, aValider, montants, refus, voix, mots, filtresInitiaux, porteB: porteBAllumee = false }: { filtresInitiaux?: Filtres; porteB?: boolean; valides: VueCas[]; aValider: VueCas[]; montants: Record<string, number>; refus?: Record<string, string>; voix?: EtatVoix; mots?: EtatMotsFeuille }) {
  const router = useRouter();
  const [occupe, demarrer] = useTransition();
  const [phrase, setPhrase] = useState("");
  const [offre, setOffre] = useState<FiltreOffre>("tous");
  const [ouvert, setOuvert] = useState<{ cas: VueCas; essai: boolean; montant?: number; refus?: string | null } | null>(null);
  const [relecture, setRelecture] = useState<{ cas: VueCas; essai: boolean; choix: ChoixVideo; montant: number } | null>(null);
  const [filtresStock, setFiltresStock] = useState<Filtres>(filtresInitiaux ?? {});
  const [page, setPage] = useState(1);
  const [aucunRestant, setAucunRestant] = useState(false);
  const [porteB, setPorteB] = useState<EtatCase | null>(null);
  const [occupeB, demarrerB] = useTransition();

  // Lots K4-K5 : filtres du stock, seulement si le serveur a joint le rang du stock aux cas (réglage `casConcret.stockMetiers` allumé).
  const avecStock = useMemo(() => [...valides, ...aValider].some((c) => c.stock), [valides, aValider]);
  // L'onglet est « À faire » : l'état « restants » est implicite, pas de groupe « État ».
  const groupesStock = useMemo(() => (avecStock ? groupesDepuisCas([...valides, ...aValider]).filter((g) => g.cle !== "etat") : []), [avecStock, valides, aValider]);
  const validesFiltres = useMemo(() => (avecStock ? filtrerCas(valides, filtresStock) : valides), [avecStock, valides, filtresStock]);
  const aValiderFiltres = useMemo(() => (avecStock ? filtrerCas(aValider, filtresStock) : aValider), [avecStock, aValider, filtresStock]);
  const cartes = useMemo(() => classerCas(phrase, validesFiltres.filter((c) => offre === "tous" || c.offre === offre)), [phrase, offre, validesFiltres]);
  // La recherche et l'offre valent aussi pour « À valider » ; la liste est paginée (la page courante revient à 1 quand le filtre change).
  const aValiderListe = useMemo(() => classerCas(phrase, aValiderFiltres.filter((c) => offre === "tous" || c.offre === offre)), [phrase, offre, aValiderFiltres]);
  const pages = Math.max(1, Math.ceil(aValiderListe.length / PAR_PAGE));
  const pageCourante = Math.min(page, pages);
  const aValiderPage = aValiderListe.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  /** « Proposez-moi un cas restant » : OUVRE seulement la feuille « Votre vidéo » (aucune fabrication, aucun prix confirmé). */
  function proposerUnCas() {
    const choix = piocherCas(valides, aValider, { ...filtresStock, ...(offre !== "tous" ? { offre } : {}) });
    setAucunRestant(!choix);
    if (choix) setOuvert({ cas: choix.cas, essai: choix.essai });
  }
  function changerFiltresStock(f: Filtres) {
    setFiltresStock(f);
    setPage(1);
    setAucunRestant(false);
  }

  const estimer = useCallback(
    async (choix: ChoixVideo) => {
      if (!ouvert) return null;
      const r = await estimerCasAction(ouvert.cas.id, choix.reseaux, choix.avecMot, { mot: choix.mot, essai: ouvert.essai, empreinteVue: ouvert.cas.empreinte, ...(choix.nouveauScript ? { nouveauScript: true } : {}), ...(choix.sujet ? { sujet: choix.sujet } : {}), ...(ouvert.cas.porteB ? { porteB: ouvert.cas.porteB.videoId } : {}) });
      return r.ok ? { centimes: r.donnees.centimes, ...(r.donnees.refus ? { refus: r.donnees.refus } : {}), ...(r.donnees.dejaTraite ? { dejaTraite: r.donnees.dejaTraite } : {}), ...(r.donnees.avertissement ? { avertissement: r.donnees.avertissement } : {}) } : null;
    },
    [ouvert],
  );

  async function fabriquer(choix: ChoixVideo, accord: number) {
    if (!ouvert) return;
    const r = await preparerEtLancerAction({ casId: ouvert.cas.id, reseaux: choix.reseaux, mot: choix.mot, avecMot: choix.avecMot, accordCentimes: accord, essai: ouvert.essai, empreinteVue: ouvert.cas.empreinte, ...(choix.nouveauScript ? { nouveauScript: true } : {}), ...(choix.sujet ? { sujet: choix.sujet } : {}), ...(ouvert.cas.porteB ? { porteB: ouvert.cas.porteB.videoId } : {}) });
    if (!r.ok) return { phrase: r.message };
    if (r.donnees.statut === "refusee") return { phrase: r.donnees.phrase };
    // Lot L3 : le cas est devenu « déjà traité » (ou le jeton est périmé) : la feuille redonne les trois choix.
    if (r.donnees.statut === "sujet-deja-traite") {
      const { statut: _statut, ...dejaTraite } = r.donnees;
      void _statut;
      return { phrase: r.donnees.phrase, dejaTraite };
    }
    if (r.donnees.statut === "accord-requis") return { centimes: r.donnees.centimes };
    router.push(`/videos/${r.donnees.videoId}`);
  }

  /** « Choisir un autre sujet » : ouvre l'autre cas proposé (validé, ou à valider en essai). */
  function ouvrirAutreCas(casId: string) {
    const valide = valides.find((c) => c.id === casId);
    const aValiderCas = aValider.find((c) => c.id === casId);
    if (valide) setOuvert({ cas: valide, essai: false });
    else if (aValiderCas) setOuvert({ cas: aValiderCas, essai: true });
    else notifier.erreur("Ce cas n'est pas disponible ici", "Choisissez-le dans la liste des cas.");
  }

  const controlerRelu = useCallback(
    async (s: ScriptRelu): Promise<PastilleControle[]> => {
      if (!relecture) return [];
      const r = await controlerScriptValideAction(relecture.cas.id, modificationsDesDifferences(s.modifications));
      return r.ok ? r.donnees : [{ niveau: "alerte", texte: "Vérification indisponible. Elle sera refaite au lancement." }];
    },
    [relecture],
  );

  /** « Enregistrer sans lancer » : nouvelle version validée (même contrôle gratuit), puis la page rend la carte à jour. */
  async function enregistrerRelu(s: ScriptRelu) {
    if (!relecture) return { ok: false as const, message: "Rouvrez le cas." };
    const r = await enregistrerScriptRelu(relecture.cas.id, s, modifierScriptValideAction);
    if (r.ok) router.refresh();
    return r;
  }

  /** Lancement depuis la relecture : la modification d'abord (nouvelle version), puis le lancement avec le repère. */
  async function lancerRelu(s: ScriptRelu, accord: number | true): Promise<ResultatLancement> {
    if (!relecture) return { ok: false, message: "Rouvrez le cas." };
    const { essai, choix } = relecture;
    const cas = casCourant(valides, relecture.cas);
    const modifications = modificationsDesDifferences(s.modifications);
    if (modifications.length) {
      const m = await modifierScriptValideAction(cas.id, modifications);
      if (!m.ok) return { ok: false, message: m.message };
      if (m.donnees.empreinte !== s.empreinte) return { ok: false, message: PHRASE_SCRIPT_GARDE_AUTRE };
    }
    const r = await preparerEtLancerAction({
      casId: cas.id,
      reseaux: choix.reseaux,
      mot: choix.mot,
      avecMot: choix.avecMot,
      ...(typeof accord === "number" ? { accordCentimes: accord } : {}),
      essai,
      empreinteVue: cas.empreinte,
      empreinteScriptRelu: s.empreinte,
      ...(choix.sujet ? { sujet: choix.sujet } : {}),
    });
    if (!r.ok) return { ok: false, message: r.message };
    if (r.donnees.statut === "refusee") return { ok: false, message: r.donnees.phrase };
    if (r.donnees.statut === "sujet-deja-traite") return { ok: false, message: "Ce cas vient d'être traité. Fermez, puis rouvrez le cas pour choisir de nouveau." };
    if (r.donnees.statut === "accord-requis") return { ok: false, code: "CONFIRMATION_REQUISE", message: r.donnees.phrase, montant: r.donnees.centimes };
    router.push(`/videos/${r.donnees.videoId}`);
    return { ok: true };
  }

  function valider(c: VueCas) {
    demarrer(async () => {
      const r = await confirmerCasAction(c.id);
      if (!r.ok) return void notifier.erreur("Cas non validé", r.message);
      notifier.succes("Cas validé", c.titre);
      setOuvert(null);
      router.refresh();
    });
  }

  /** Une réponse de la porte B : la feuille du cas prêt, sinon la phrase sous la case. */
  const appliquerPorteB = useCallback((r: Resultat<VuePorteB>) => {
    if (!r.ok) return setPorteB({ statut: "echec", phrase: r.message });
    if (r.donnees.statut !== "pret") return setPorteB(r.donnees);
    setPorteB(null);
    setOuvert({ cas: r.donnees.cas, essai: false, montant: r.donnees.montant, refus: r.donnees.refus });
  }, []);

  // « Je prépare votre cas… » : l'écran relit seul, l'appel n'est jamais attendu.
  useEffect(() => {
    if (porteB?.statut !== "en-cours" || !porteB.videoId) return;
    const videoId = porteB.videoId;
    const t = setTimeout(() => void suivrePorteBAction(videoId).then(appliquerPorteB), RELECTURE_PORTE_B_MS);
    return () => clearTimeout(t);
  }, [porteB, appliquerPorteB]);

  function changerPhrase(v: string) {
    setPhrase(v);
    setPage(1);
    // Une phrase d'aide ou un échec s'efface dès que Will réécrit ; une préparation en cours continue.
    if (porteB?.statut !== "en-cours") setPorteB(null);
  }

  function faireLaVideo() {
    demarrerB(async () => appliquerPorteB(await demarrerPorteBAction(phrase)));
  }

  function decider(faitId: string, decision: "confirmer" | "retirer") {
    const videoId = ouvert?.cas.porteB?.videoId;
    if (!videoId) return;
    demarrer(async () => {
      const r = await confirmerFaitPorteBAction(videoId, faitId, decision);
      if (!r.ok) return void notifier.erreur("Chiffre non modifié", r.message);
      appliquerPorteB(r);
    });
  }

  const enPreparation = occupeB || porteB?.statut === "en-cours";
  const caseLibre = boutonPorteBVisible(porteBAllumee, phrase) && (
    <div className="space-y-2">
      <Bouton variante="secondaire" icone="baguette" chargement={enPreparation} disabled={enPreparation} onClick={faireLaVideo}>
        Faire la vidéo de ce cas
      </Bouton>
      {porteB && (
        <p role={porteB.statut === "en-cours" ? "status" : "alert"} className={porteB.statut === "en-cours" ? "px-1 text-[15px] text-texte-doux" : "rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte"}>
          {porteB.phrase}
        </p>
      )}
    </div>
  );

  if (!valides.length && !aValider.length)
    return (
      <div className="space-y-6">
        <CaseDuCas valeur={phrase} porteB={porteBAllumee} onChange={changerPhrase} onEntree={() => undefined} />
        {caseLibre}
        <EtatVide compact icone="baguette" titre="Aucun cas à faire pour l'instant." />
      </div>
    );

  if (relecture) return <RelireAvantLancement key={relecture.cas.id} cas={casCourant(valides, relecture.cas)} montant={relecture.montant} controler={controlerRelu} lancer={lancerRelu} enregistrerSansLancer={enregistrerRelu} onRetour={() => setRelecture(null)} />;

  return (
    <div className="space-y-6">
      <CaseDuCas valeur={phrase} porteB={porteBAllumee} onChange={changerPhrase} onEntree={() => cartes[0] && setOuvert({ cas: cartes[0], essai: false })} />
      {caseLibre}
      <PastillesOffres valeur={offre} onChange={(v) => { setOffre(v); setPage(1); }} cas={valides} />
      <div className="space-y-3">
        {avecStock && groupesStock.length > 0 && (
          <div className="rounded-carte border border-trait bg-surface-1 p-4">
            <FiltresStock groupes={groupesStock} actuels={filtresStock} onChange={changerFiltresStock} />
          </div>
        )}
        <Bouton variante="secondaire" icone="baguette" onClick={proposerUnCas}>
          Proposez-moi un cas restant
        </Bouton>
        {aucunRestant && <p role="status" className="text-[15px] text-texte-doux">{PHRASE_AUCUN_RESTANT}</p>}
      </div>
      {cartes.length > 0 && (
        <section aria-labelledby="titre-prets" className="space-y-3">
          <h2 id="titre-prets" className="text-[15px] font-semibold text-texte">Prêts à fabriquer ({cartes.length})</h2>
          <ul className="grid gap-3 p-0 sm:grid-cols-2">
            {cartes.map((c) => (
              <CarteCas key={c.id} cas={c} onOuvrir={() => setOuvert({ cas: c, essai: false })} />
            ))}
          </ul>
        </section>
      )}
      <CasAValider cas={aValiderPage} total={aValiderListe.length} occupe={occupe} onValider={valider} onEssai={(c) => setOuvert({ cas: c, essai: true })} />
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pages des cas à faire">
          {pageCourante > 1 ? <Bouton variante="fantome" onClick={() => setPage(pageCourante - 1)}>Page précédente</Bouton> : <span />}
          <span className="text-[13px] text-texte-doux">Page {pageCourante} sur {pages}</span>
          {pageCourante < pages ? <Bouton variante="fantome" onClick={() => setPage(pageCourante + 1)}>Page suivante</Bouton> : <span />}
        </nav>
      )}
      {cartes.length === 0 && aValiderListe.length === 0 && (
        <p className="py-6 text-center text-[15px] text-texte-doux">{Object.values(filtresStock).some(Boolean) ? "Aucun cas pour ces filtres." : "Aucun cas ne correspond. Essayez un autre mot."}</p>
      )}
      {ouvert && (
        <FeuilleVotreVideo
          key={`${ouvert.cas.id}-${ouvert.essai}-${ouvert.cas.empreinte}-${ouvert.cas.porteB?.aConfirmer.length ?? 0}`}
          cas={ouvert.cas}
          essai={ouvert.essai}
          montantInitial={ouvert.montant ?? montants[ouvert.cas.id]}
          refusInitial={ouvert.refus !== undefined ? ouvert.refus : ouvert.essai ? null : (refus?.[ouvert.cas.id] ?? null)}
          onFait={decider}
          onAutreCas={ouvrirAutreCas}
          occupe={occupe}
          voix={voix}
          mots={mots}
          onFermer={() => setOuvert(null)}
          onRetire={() => setOuvert(null)}
          estimer={estimer}
          onFabriquer={fabriquer}
          onValider={() => valider(ouvert.cas)}
          onRelire={(choix, montant) => {
            setRelecture({ cas: ouvert.cas, essai: ouvert.essai, choix, montant });
            setOuvert(null);
          }}
        />
      )}
    </div>
  );
}
