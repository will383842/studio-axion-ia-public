"use client";

/**
 * ÉCRAN « VOTRE VIDÉO » (étape `express`, lot M3 ; plan PARTIE A §2-3, B.0 §2 et §16, B.9).
 * Cinq blocs empilés, chacun avec une image et une ligne : Script · Plateau · Voix · Style · Coût.
 * - Mode RAPIDE : on ne touche que le texte (tout le reste est déjà réglé sur les habitudes), puis « Fabriquer ».
 * - Mode PAS À PAS : les mêmes feuilles du bas, enchaînées avec « Suivant » (mêmes composants, mêmes défauts).
 * Chaque bloc ouvre une feuille du bas qui RÉUTILISE l'étape existante en mode compact (aucune copie d'écran).
 * Le brouillon s'enregistre tout seul ≈ 800 ms après chaque changement (coquille de l'assistant).
 * « Fabriquer » ouvre la relecture du script (brique 6, même sous le seuil) dès qu'une voix de synthèse dit le texte :
 * les phrases se relisent et se modifient, les contrôles tournent en direct, puis « Lancer la vidéo (≈ prix) » confirme
 * le prix et lance. La flèche retour garde les phrases retouchées. Vidéo déjà filmée (« rush ») : pas de relecture.
 */
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apercuAction, controlerScriptReluAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { creerVersionDejaFilmeeAction } from "@/app/(studio)/envoyer/actions";
import { abandonnerBrouillonAction } from "@/app/(studio)/videos/actions";
import { detailCreditAction, garderEnAttenteAction } from "@/app/(studio)/nouvelle/[format]/actions-credits";
import { prechargerApercuPlateau } from "@/components/creation/ApercuPlateau";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { texteScript } from "@/domaine/derivations";
import { LIBELLE_VEUT_TEXTE, boutonFabriquerGrise, scriptFacultatif, titreDejaFilme } from "@/domaine/facecam-script";
import { blocsDepuisModifications, relectureAExiger, saisieAReprendre } from "@/domaine/relecture-assistant";
import type { DifferenceLigne, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import type { BlocScript } from "@/domaine/types";
import { briquesEffectives, debitLecture, estimerDureeTexte, libelleDuree, obtenirFormat, zoneDuree } from "@/formats";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import type { DetailCredit } from "@/services/credits";
import type { ApercuFabrication } from "@/services/fabrication";
import { FeuillePlateau } from "../express/FeuillePlateau";
import { aDuTexte, blocSuivant, decisionLancement, elementsAVerifier, etatPlateau, etatVoix, libelleBoutonFabriquer, libelleManques, manquesAvantFabrication, ouvreLaRelecture, premiereFois, prixEnVrai, sujetDepuisScript, type BlocExpress, type BlocManquant, type TonBloc } from "../express/logique";
import { decorDe, imageDecor, proprietesPlateau } from "../express/plateau";
import { RelectureAssistant } from "../express/RelectureAssistant";
import { VoirLesPlans } from "../express/VoirLesPlans";
import { ZoneColler } from "../express/ZoneColler";
import { entreesAvecOrigine } from "@/domaine/voyant-rouge";
import { EtapeApercu } from "./Apercu";
import { ChoixVoix } from "./Distribution";
import { EtapeReglages } from "./Reglages";
import { EtapeScript, type OngletScript } from "./Script";
import { lancerAvecVoyant, type OuiVoyant } from "./lancer-avec-voyant";
import type { ProprietesEtape } from "./types";

type Mode = "rapide" | "pas-a-pas";
const CLE_MODE = "studio.express.mode";

const TITRES: Record<BlocExpress, { titre: string; icone: NomIcone }> = {
  script: { titre: "Script", icone: "ecrire" },
  plateau: { titre: "Plateau", icone: "camera" },
  voix: { titre: "Voix", icone: "micro" },
  style: { titre: "Style", icone: "curseurs" },
  cout: { titre: "Coût", icone: "euro" },
};

type ResultatCout = { ok: true; donnees: ApercuFabrication } | { ok: false; message: string; code?: string };

export function EtapeExpress(props: ProprietesEtape) {
  const { formatId, brouillon, modifier, allerA, contexte } = props;
  const format = obtenirFormat(formatId);
  const [mode, setMode] = useState<Mode>("rapide");
  const [feuille, setFeuille] = useState<BlocExpress | null>(null);
  // Onglet de la feuille Script : « Mes scripts » et « Une idée » ouvrent chacun le leur (E2E-1 n° 3).
  const [ongletScript, setOngletScript] = useState<OngletScript | undefined>(undefined);
  const [apercu, setApercu] = useState<ApercuFabrication | null>(null);
  const [erreurApercu, setErreurApercu] = useState<{ message: string; code?: string } | null>(null);
  // Brique 6 : relecture du script ouverte par « Fabriquer » (le texte du moment, les raisons à vérifier, la saisie reprise).
  const [relecture, setRelecture] = useState<{ blocs: BlocScript[]; raisons: string[]; modifications: DifferenceLigne[] } | null>(null);
  // Flèche retour de la relecture : les phrases retouchées sont gardées pour le prochain « Fabriquer ».
  const [saisieGardee, setSaisieGardee] = useState<{ blocs: BlocScript[]; modifications: DifferenceLigne[] } | null>(null);
  // Vidéo déjà filmée (aucune voix de synthèse) : pas de relecture, la confirmation d'avant (« Avant de fabriquer »).
  const [confirmation, setConfirmation] = useState<string[] | null>(null);
  // Le oui au voyant rouge (texte repris d'une version du générateur), gardé pour que la question ne soit posée qu'une fois.
  const ouiVoyant = useRef<OuiVoyant>({ current: false });
  const [budget, setBudget] = useState(false);
  const [lancement, setLancement] = useState(false);
  // Lot « crédits » (02/10) : feuille « Crédit HeyGen insuffisant » (Recharger · Version économique · Garder en brouillon).
  const [credit, setCredit] = useState<(DetailCredit & { videoId: string; confirme: boolean | number; scriptRelu?: string }) | null>(null);
  // Paquet 4 (D2) : prix renvoyé par le serveur au-delà du seuil : c'est lui qui s'affiche et repart avec l'accord.
  const [montantServeur, setMontantServeur] = useState<number | null>(null);
  const [desQuePossible, setDesQuePossible] = useState(true);
  const [garde, setGarde] = useState(false);
  // TEST-UI-REEL U6 : essai sans « qui parle » ou sans voix : une vidéo de démonstration les remplace (Will choisit).
  const [essaiDemo, setEssaiDemo] = useState<BlocManquant[] | null>(null);
  // Script facultatif (face caméra, 18/10) : jamais écrit tout seul ; la zone d'écriture s'ouvre sur « Je veux un texte à lire ».
  const [veutTexte, setVeutTexte] = useState(false);
  const routeur = useRouter();

  // Mode mémorisé sur cet appareil (simple confort ; jamais nécessaire au fonctionnement).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (window.localStorage.getItem(CLE_MODE) === "pas-a-pas") setMode("pas-a-pas");
      } catch {
        /* stockage indisponible : mode rapide */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const changerMode = (m: Mode) => {
    setMode(m);
    try {
      window.localStorage.setItem(CLE_MODE, m);
    } catch {
      /* rien */
    }
    if (m === "pas-a-pas") ouvrirScript();
  };

  const texte = texteScript(brouillon.blocs);
  const aTexte = aDuTexte(brouillon.blocs);
  // Arrivée depuis une idée (E2E-1 n° 4) : un sujet, pas encore de texte.
  const idee = !aTexte ? brouillon.sujet.trim() : "";
  function ouvrirScript(onglet?: OngletScript) {
    setOngletScript(onglet ?? (idee ? "idee" : undefined));
    setFeuille("script");
  }
  const ouvrirFeuille = (b: "script" | "plateau" | "voix" | "style") => (b === "script" ? ouvrirScript() : setFeuille(b));

  // L'idée arrive avec la feuille Script ouverte sur « Une idée », sujet rempli : il reste à toucher « Écrire le texte ».
  const ideeAuDepart = !brouillon.videoId && !!idee;
  useEffect(() => {
    if (!ideeAuDepart) return;
    const t = setTimeout(() => {
      setOngletScript("idee");
      setFeuille("script");
    }, 0);
    return () => clearTimeout(t);
    // Une seule fois, à l'arrivée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const d = brouillon.distribution[0];
  const personnage = contexte.personnages.find((p) => p.personnage.id === d?.personnageId);
  // TEST-UI-REEL U2 : la durée suit la voix qui lira (voix HeyGen : son débit réel), comme le prix.
  const duree = estimerDureeTexte(format, texte, debitLecture(format, personnage?.voix.find((v) => v.id === d?.voixId)));
  const zone = zoneDuree(format, duree);
  const visages = personnage?.visages ?? [];
  const decor = decorDe(brouillon, contexte.elements);
  const entree = { blocs: brouillon.blocs, distribution: brouillon.distribution, visages, voix: personnage?.voix ?? [], decor };
  const plateau = etatPlateau(entree);
  const voix = etatVoix(entree);
  const debut = personnage ? premiereFois(visages, personnage.voix) : null;
  const briques = briquesEffectives(format, brouillon.briquesCoupees, brouillon.briquesAllumees);

  // Aperçu rapide (02/10) : la LUT (≈ 105 Ko) et les images du plateau se chargent dès l'ouverture de l'écran, avant
  // que la feuille « Plateau » ne s'ouvre ; elle n'a plus qu'à composer.
  const entreesPlateau = proprietesPlateau(brouillon, contexte);
  const clePlateau = JSON.stringify([entreesPlateau.decor?.imageUrl, entreesPlateau.detoureUrl, entreesPlateau.vignetteUrl, entreesPlateau.lut?.url, entreesPlateau.lut?.intensite]);
  useEffect(() => {
    const t = setTimeout(() => prechargerApercuPlateau(entreesPlateau), 0);
    return () => clearTimeout(t);
    // `clePlateau` résume les fichiers à charger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clePlateau]);

  // Le coût suit le brouillon : recalculé après l'enregistrement différé.
  const chargerCout = useCallback(async (): Promise<ResultatCout> => {
    const id = await contexte.enregistrer();
    if (!id) return { ok: false, message: "Le brouillon n'a pas pu être enregistré." };
    const r = await apercuAction(id);
    if (r.ok) {
      setApercu(r.donnees);
      setErreurApercu(null);
      return r;
    }
    setErreurApercu({ message: r.message, code: r.code });
    return r;
  }, [contexte]);
  const cleCout = JSON.stringify([brouillon.videoId, texte, brouillon.ratios, brouillon.distribution, brouillon.styles, brouillon.briquesCoupees, brouillon.reglages]);
  // Sans `videoId` (ouvert depuis un script, une idée ou un modèle), `chargerCout` enregistre d'abord le brouillon :
  // sinon le coût restait « Calcul en cours » tant que rien n'était modifié.
  // Jamais de brouillon créé de soi-même (E2E-1 n° 6) : un script ouvert sans rien toucher n'en crée pas ; le coût
  // se calcule dès la première vraie saisie, ou quand Will ouvre « Coût ».
  const saisi = contexte.aSaisi?.() ?? true;
  useEffect(() => {
    if (!aTexte || !saisi) return;
    const t = setTimeout(() => void chargerCout(), 1200);
    return () => clearTimeout(t);
    // `cleCout` résume tout ce qui change le prix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleCout]);

  /**
   * « Fabriquer » : coût à jour, ce qui manque, le budget ; puis la relecture du script quand une voix de synthèse le
   * dit. Vidéo déjà filmée (« rush ») : elle part directement, ou après la confirmation d'avant.
   */
  async function fabriquer(options: { manquesAcceptes?: boolean } = {}) {
    if (!aTexte) {
      if (!scriptFacultatif(formatId)) return ouvrirScript();
      // Face caméra sans texte : la vidéo déjà filmée se monte directement (aucune écriture, aucun appel Claude).
      setLancement(true);
      let parti = false;
      try {
        const r = await creerVersionDejaFilmeeAction(undefined, titreDejaFilme(brouillon));
        if (!r.ok) return notifier.erreur(r.message);
        // Le brouillon vidéo déjà créé n'a plus d'usage : la version face caméra le remplace (archivé, jamais supprimé).
        parti = true;
        if (brouillon.videoId) await abandonnerBrouillonAction(brouillon.videoId).catch(() => undefined);
        return routeur.push(`/envoyer/${r.donnees.varianteId}`);
      } catch {
        return notifier.erreur("L'envoi n'a pas pu démarrer. Réessayez.");
      } finally {
        if (!parti) setLancement(false);
      }
    }
    setLancement(true);
    try {
      const r = await chargerCout();
      if (!r.ok) {
        notifier.erreur(r.message);
        if (r.code === "ACCORD_MANQUANT" || r.code === "DISTRIBUTION_INCOMPLETE") setFeuille("plateau");
        return;
      }
      const donnees = r.donnees;
      const decision = decisionLancement({
        // Vérif A2 (10/10) : même montant que le serveur (lignes facultatives, textes des réseaux, hors budget).
        coutCentimes: donnees.budget.bloquant?.centimes ?? donnees.estimation.total.centimes,
        seuilCentimes: donnees.budget.seuil.centimes,
        resteCentimes: donnees.budget.restant.centimes,
        aVerifier: elementsAVerifier({ decor, visages, visageIds: [d?.visageId, ...Object.values(d?.visagesParAngle ?? {})] }),
        montageReel: donnees.budget.montageReel,
        double: !!donnees.budget.double,
        manques: manquesAvantFabrication(plateau, voix),
        essaiGratuit: donnees.essaiGratuit,
        manquesAcceptes: options.manquesAcceptes,
        budgetIndicatif: !!donnees.budget.indicatif,
      });
      if (decision.genre === "completer") {
        notifier.info(decision.bloc === "plateau" ? "Choisissez d'abord qui parle" : "Choisissez d'abord une voix");
        return setFeuille(decision.bloc);
      }
      if (decision.genre === "essai-demonstration") return setEssaiDemo(decision.manques);
      if (decision.genre === "budget") return setBudget(true);
      if (ouvreLaRelecture(decision, relectureAExiger(format, brouillon.distribution))) {
        setEssaiDemo(null);
        setRelecture({ blocs: brouillon.blocs, raisons: decision.genre === "confirmer" ? decision.raisons : [], modifications: saisieAReprendre(brouillon.blocs, saisieGardee) });
        window.scrollTo({ top: 0 });
        return;
      }
      if (decision.genre === "confirmer") return setConfirmation(decision.raisons);
      if (decision.genre === "direct") await lancerSansRelecture(false);
    } finally {
      setLancement(false);
    }
  }

  /** Vidéo déjà filmée : le lancement d'avant la brique 6 (aucun repère « script relu »). */
  async function lancerSansRelecture(confirme: boolean | number) {
    const id = brouillon.videoId ?? (await contexte.enregistrer());
    if (!id) return;
    const r = await lancerAvecVoyant(id, confirme, undefined, ouiVoyant.current);
    if (r.ok) {
      setConfirmation(null);
      setEssaiDemo(null);
      modifier({ travailId: r.donnees.travailId });
      allerA("fabrication", { sansEnregistrer: true });
      return;
    }
    if (r.code === "CONFIRMATION_REQUISE") {
      setMontantServeur(r.montant ?? null);
      // CORRECTEUR FINAL A : la phrase du serveur dit la vraie raison (« montée pour de vrai : … »).
      return setConfirmation([r.message || "Plus cher que d'habitude"]);
    }
    if (r.code === "BUDGET_DEPASSE") return setBudget(true);
    if (r.code === "CREDIT_INSUFFISANT") {
      setConfirmation(null);
      const detail = await detailCreditAction(id);
      if (detail.ok && detail.donnees.manques.length) {
        setDesQuePossible(true);
        return setCredit({ ...detail.donnees, videoId: id, confirme });
      }
    }
    notifier.erreur(r.message);
    if (r.code === "ACCORD_MANQUANT" || r.code === "DISTRIBUTION_INCOMPLETE") setFeuille("plateau");
  }

  /** « Lancer la vidéo » de la relecture : le texte relu devient celui de la vidéo, puis le lancement (repère « relu »). */
  async function lancerRelu(script: ScriptRelu, accord: number | true): Promise<ResultatLancement> {
    if (!relecture) return { ok: false, message: "Rouvrez la relecture." };
    const relu = blocsDepuisModifications(relecture.blocs, script.modifications);
    if (!relu.ok) return { ok: false, message: relu.raisons[0] };
    if (script.modifications.length) modifier({ blocs: relu.blocs, versionChoisie: undefined, notes: undefined });
    const id = await contexte.enregistrer();
    if (!id) return { ok: false, message: "Le brouillon n'a pas pu être enregistré. Rien n'a été payé." };
    const r = await lancerAvecVoyant(id, accord, script.empreinte, ouiVoyant.current);
    if (r.ok) {
      setRelecture(null);
      setSaisieGardee(null);
      modifier({ travailId: r.donnees.travailId });
      allerA("fabrication", { sansEnregistrer: true });
      return { ok: true };
    }
    // La relecture redemande l'accord sur le prix du jour (`avecConfirmationPrix`).
    if (r.code === "CONFIRMATION_REQUISE") {
      setMontantServeur(r.montant ?? null);
      return { ok: false, code: r.code, message: r.message, montant: r.montant };
    }
    if (r.code === "BUDGET_DEPASSE") {
      setRelecture(null);
      setBudget(true);
      return { ok: false, message: r.message };
    }
    if (r.code === "CREDIT_INSUFFISANT") {
      const detail = await detailCreditAction(id);
      if (detail.ok && detail.donnees.manques.length) {
        setRelecture(null);
        setDesQuePossible(true);
        setCredit({ ...detail.donnees, videoId: id, confirme: accord, scriptRelu: script.empreinte });
        return { ok: false, message: r.message };
      }
    }
    if (r.code === "ACCORD_MANQUANT" || r.code === "DISTRIBUTION_INCOMPLETE") {
      setRelecture(null);
      setFeuille("plateau");
      notifier.erreur(r.message);
    }
    return { ok: false, message: r.message };
  }

  const controlerRelu = useCallback(
    async (script: ScriptRelu) => {
      const r = await controlerScriptReluAction(formatId, relecture?.blocs ?? [], script.modifications, brouillon.adresse);
      if (!r.ok) throw new Error(r.message);
      return r.donnees;
    },
    [formatId, relecture, brouillon.adresse],
  );

  // Plan facecam v4 (lot A) : format sans prix, aucun montant n'est montré (bloc Coût, bouton, confirmation).
  const sansPrix = format.sansPrix === true;
  const cout = sansPrix ? undefined : apercu?.estimation.total;
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 6) : la pastille « Essai » seulement quand rien de réel n'est payé (comme l'Aperçu).
  const fabricationEssai = !apercu?.budget.montageReel && !apercu?.budget.double;
  const prixAConfirmer = sansPrix ? undefined : cout ? { centimes: Math.max(cout.centimes, montantServeur ?? 0), devise: cout.devise } : montantServeur !== null ? { centimes: montantServeur, devise: "EUR" as const } : undefined;
  // TEST-UI-REEL U6 : un essai gratuit le dit (« Essai gratuit ») ; le vrai prix reste lisible, en petit.
  const essaiGratuit = !!apercu?.essaiGratuit;
  const libelleFabriquer = libelleBoutonFabriquer({ montant: cout, dureeFabricationSec: apercu?.estimation.dureeFabricationSec, essaiGratuit });
  const enVrai = essaiGratuit ? prixEnVrai(cout) : null;
  const lut = contexte.elements.find((e) => e.id === (brouillon.styles.lutId ?? format.stylesParDefaut.lut));
  const sousTitres = contexte.elements.find((e) => e.id === (brouillon.styles.sousTitresId ?? format.stylesParDefaut.sousTitres));
  const rythme = contexte.elements.find((e) => e.id === (brouillon.styles.styleMontageId ?? format.stylesParDefaut.styleMontage));
  const vignettePlateau = visages.find((v) => v.id === d?.visageId)?.vignette ?? null;
  const fondPlateau = decor ? (decor.vignette ?? imageDecor(decor, contexte)) : null;
  const teintePlateau = decor?.valeur.type === "decor" ? decor.valeur.teinte : undefined;

  const lignes: Record<BlocExpress, { ligne: string; ton: TonBloc; alerte?: string; visuel?: ReactNode }> = {
    script: aTexte
      ? { ligne: `≈ ${libelleDuree(duree)} · ${brouillon.adresse === "tu" ? "Tu" : "Vous"}`, ton: zone === "hors-zone" ? "orange" : "pret", alerte: zone === "orange" ? "Un peu long" : zone === "hors-zone" ? "Hors zone" : undefined }
      : { ligne: scriptFacultatif(formatId) ? "Facultatif" : "Collez votre texte", ton: scriptFacultatif(formatId) ? "pret" : "attente" },
    plateau: {
      ...plateau,
      visuel:
        plateau.ton === "orange" ? undefined : (
          <span className="relative block size-full" style={{ background: teintePlateau }}>
            {fondPlateau && <Image src={fondPlateau} alt="" fill sizes="56px" className="object-cover" />}
            {vignettePlateau && <Image src={vignettePlateau} alt="" fill sizes="56px" className="object-cover object-top opacity-90 [mask-image:radial-gradient(circle_at_50%_40%,black_45%,transparent_72%)]" />}
          </span>
        ),
    },
    voix,
    // Noms dédoublonnés : sous-titres et rythme s'appellent souvent tous deux « Avocat » (« Avocat · Avocat »).
    style: { ligne: [...new Set([briques.etalonnage ? lut?.nom : null, briques["sous-titres"] ? sousTitres?.nom : null, rythme?.nom].filter(Boolean))].join(" · ") || "Réglages habituels", ton: "pret" },
    cout: cout
      ? essaiGratuit
        ? { ligne: `Essai gratuit · en vrai ≈ ${formaterMontant(cout, { court: true })}`, ton: "pret" }
        : { ligne: `≈ ${formaterMontant(cout, { court: true })} · ${brouillon.ratios.length} format${brouillon.ratios.length > 1 ? "s" : ""}`, ton: apercu?.budget.depasse ? "orange" : "pret" }
      : erreurApercu
        ? { ligne: erreurApercu.message, ton: "orange" }
        : { ligne: !aTexte ? "Après le texte" : saisi ? "Calcul en cours" : "Touchez pour voir", ton: "attente" },
  };

  const suivantBrut = feuille ? blocSuivant(feuille) : null;
  const suivant = sansPrix && suivantBrut === "cout" ? null : suivantBrut;

  if (relecture) {
    return (
      <RelectureAssistant
        formatId={formatId}
        blocs={relecture.blocs}
        modifications={relecture.modifications}
        adresse={brouillon.adresse}
        prixCentimes={prixAConfirmer?.centimes}
        raisons={relecture.raisons}
        debit={debitLecture(format, personnage?.voix.find((v) => v.id === d?.voixId))}
        controler={controlerRelu}
        lancer={lancerRelu}
        fermer={(modifications) => {
          setSaisieGardee(modifications.length ? { blocs: relecture.blocs, modifications } : null);
          setRelecture(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <SelecteurPastilles<Mode>
          libelle="Mode"
          libelleMasque
          options={[
            { valeur: "rapide", libelle: "Rapide", icone: "eclair" },
            { valeur: "pas-a-pas", libelle: "Pas à pas" },
          ]}
          valeur={mode}
          onChange={changerMode}
        />
      </div>

      {debut && (
        <section aria-label="Pour commencer" className="rounded-carte border border-ambre/40 bg-ambre-doux p-4">
          <p className="mb-3 text-sm font-semibold text-texte">Pour votre première vidéo</p>
          <ul className="grid grid-cols-3 gap-2">
            {debut.map((c) => (
              <li key={c.cle} className="rounded-xl bg-surface-1 p-2.5 text-center">
                <Icone nom={c.pret ? "valide" : c.cle === "voix" ? "micro" : "visage"} size={18} className={cn("mx-auto", c.pret ? "text-sauge" : "text-ambre")} />
                <span className="mt-1 block text-xs font-semibold text-texte">{c.libelle}</span>
                <span className="block text-[11px] leading-tight text-texte-faible">{c.detail}</span>
              </li>
            ))}
          </ul>
          <Link href="/personnages" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-vif">
            Préparer mon double <Icone nom="chevron-droite" size={15} />
          </Link>
        </section>
      )}

      {!aTexte && mode === "rapide" && scriptFacultatif(formatId) && !veutTexte && !idee && (
        <section aria-label="Texte à lire" className="rounded-carte border border-trait bg-surface-1 p-4">
          <p className="mb-3 text-sm text-texte-doux">Pas besoin de texte : envoyez votre vidéo déjà filmée et le studio la monte. Si vous voulez un texte à lire, il s&apos;écrit seulement sur votre demande.</p>
          <Bouton variante="secondaire" icone="ecrire" pleineLargeur onClick={() => setVeutTexte(true)}>
            {LIBELLE_VEUT_TEXTE}
          </Bouton>
        </section>
      )}

      {!aTexte && mode === "rapide" && (!scriptFacultatif(formatId) || veutTexte || !!idee) && (
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-carte border border-orange/40 bg-surface-1 p-4">
          {idee && (
            <>
              <div className="mb-3 flex items-start gap-3 rounded-xl bg-orange-doux p-3">
                <Icone nom="idee" size={18} className="mt-0.5 shrink-0 text-orange-vif" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-texte-faible">Votre idée</span>
                  <span className="line-clamp-3 text-[15px] font-semibold text-texte">{idee}</span>
                </span>
              </div>
              <Bouton pleineLargeur icone="etincelles" className="mb-4" onClick={() => ouvrirScript("idee")}>
                Écrire le texte
              </Bouton>
            </>
          )}
          <ZoneColler formatId={formatId} onBlocs={(blocs) => modifier({ entrees: entreesAvecOrigine(brouillon.entrees), blocs, scriptId: undefined, versions: undefined, notes: undefined, sujet: brouillon.sujet || sujetDepuisScript(blocs) })} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Bouton variante="secondaire" icone="document" onClick={() => ouvrirScript("mes-scripts")}>
              Mes scripts
            </Bouton>
            {!idee && (
              <Bouton variante="secondaire" icone="idee" onClick={() => ouvrirScript("idee")}>
                Une idée
              </Bouton>
            )}
          </div>
        </motion.section>
      )}

      <ul className="space-y-2">
        {(Object.keys(TITRES) as BlocExpress[]).filter((b) => !(sansPrix && b === "cout")).map((b, i) => (
          <li key={b}>
            <CarteBloc index={i} icone={TITRES[b].icone} titre={TITRES[b].titre} {...lignes[b]} onOuvrir={() => (b === "script" ? ouvrirScript() : setFeuille(b))} />
          </li>
        ))}
      </ul>

      <VoirLesPlans enregistrer={contexte.enregistrer} desactive={!aTexte} />

      <BarreActionCollee>
        {/* E2E-2 parcours n° 3 : un bouton grisé dit TOUJOURS pourquoi, juste dessous. */}
        <div className="flex min-w-0 flex-col gap-1">
          <Bouton taille="lg" pleineLargeur icone="clap" essai={fabricationEssai} disabled={boutonFabriquerGrise({ aTexte, formatId, budgetDepasse: !!apercu?.budget.depasse, refus: !!apercu?.refus })} chargement={lancement} onClick={() => void fabriquer()}>
            {!aTexte && scriptFacultatif(formatId) ? "Envoyer ma vidéo déjà filmée" : libelleFabriquer}
          </Bouton>
          {!aTexte && scriptFacultatif(formatId) ? (
            <p className="text-center text-xs text-texte-doux">Sans texte : vous envoyez votre vidéo déjà filmée.</p>
          ) : !aTexte ? (
            <p className="text-center text-xs text-texte-doux">Ajoutez d&apos;abord le texte de la vidéo.</p>
          ) : apercu?.refus ? (
            <p role="alert" className="text-center text-xs text-ambre">
              {apercu.refus}{" "}
              <Link href="/reglages#connexions" className="font-semibold underline">
                Ouvrir Réglages › Connexions
              </Link>
            </p>
          ) : apercu?.budget.depasse ? (
            <p className="text-center text-xs text-ambre">
              Budget du mois dépassé ·{" "}
              <Link href="/reglages#budget" className="font-semibold underline">
                Augmenter le budget
              </Link>
            </p>
          ) : apercu?.budget.depasseIndicatif ? (
            <p className="text-center text-xs text-ambre">
              Au-delà du budget indicatif du mois · la vidéo part quand même ·{" "}
              <Link href="/reglages#budget" className="font-semibold underline">
                Régler le repère
              </Link>
            </p>
          ) : enVrai ? (
            <p className="text-center text-xs text-texte-faible">Rien n&apos;est payé · {enVrai}</p>
          ) : null}
        </div>
      </BarreActionCollee>

      <FeuilleBas
        ouverte={!!feuille}
        onOuverteChange={(o) => !o && setFeuille(null)}
        titre={feuille ? TITRES[feuille].titre : "Votre vidéo"}
        pleinEcran={feuille === "script" || feuille === "plateau"}
        pied={
          <Bouton taille="lg" pleineLargeur iconeDroite={mode === "pas-a-pas" && suivant ? "fleche-droite" : "coche"} onClick={() => setFeuille(mode === "pas-a-pas" ? suivant : null)}>
            {mode === "pas-a-pas" && suivant ? "Suivant" : "OK"}
          </Bouton>
        }
      >
        <div className="pb-2">
          {feuille === "script" && <EtapeScript {...props} compacte ongletDepart={ongletScript} />}
          {feuille === "plateau" && <FeuillePlateau {...props} compacte />}
          {feuille === "voix" && <ChoixVoix brouillon={brouillon} modifier={modifier} contexte={contexte} />}
          {feuille === "style" && <EtapeReglages {...props} compacte />}
          {feuille === "cout" && <EtapeApercu {...props} compacte ouvrirFeuille={ouvrirFeuille} />}
        </div>
      </FeuilleBas>

      <FeuilleBas
        ouverte={!!confirmation}
        onOuverteChange={(o) => !o && setConfirmation(null)}
        titre="Avant de fabriquer"
        description={prixAConfirmer ? `Cette vidéo : au plus ${formaterMontant(prixAConfirmer, { court: true })}` : undefined}
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            icone="clap"
            essai={fabricationEssai}
            chargement={lancement}
            onClick={async () => {
              setLancement(true);
              try {
                await lancerSansRelecture(prixAConfirmer?.centimes ?? true);
              } finally {
                setLancement(false);
              }
            }}
          >
            Confirmer et fabriquer
          </Bouton>
        }
      >
        <ul className="space-y-2 py-2">
          {confirmation?.map((r) => (
            <li key={r} className="flex items-center gap-2 rounded-xl bg-ambre-doux px-3 py-2.5 text-sm text-texte">
              <Icone nom="attention" size={16} className="shrink-0 text-ambre" />
              {r}
            </li>
          ))}
        </ul>
      </FeuilleBas>

      <FeuilleBas
        ouverte={!!essaiDemo}
        onOuverteChange={(o) => !o && setEssaiDemo(null)}
        titre="Vidéo d'essai"
        description={essaiDemo ? `Il manque ${libelleManques(essaiDemo)}.` : undefined}
        pied={
          <div className="grid gap-2">
            <Bouton
              taille="lg"
              pleineLargeur
              variante="secondaire"
              icone={essaiDemo?.[0] === "voix" ? "micro" : "camera"}
              onClick={() => {
                const bloc = essaiDemo?.[0] ?? "plateau";
                setEssaiDemo(null);
                setFeuille(bloc);
              }}
            >
              {essaiDemo?.[0] === "voix" ? "Choisir la voix" : "Choisir qui parle"}
            </Bouton>
            <Bouton taille="lg" pleineLargeur icone="clap" essai chargement={lancement} onClick={() => void fabriquer({ manquesAcceptes: true })}>
              Fabriquer l&apos;essai
            </Bouton>
          </div>
        }
      >
        <p className="py-2 text-[15px] text-texte-doux">En essai, une vidéo de démonstration les remplace. Rien n&apos;est payé et elle ne part pas sur vos réseaux.</p>
      </FeuilleBas>

      <FeuilleBas
        ouverte={!!credit}
        onOuverteChange={(o) => !o && setCredit(null)}
        titre={credit?.manques[0] ? `Crédit ${credit.manques[0].nom} insuffisant` : "Crédit insuffisant"}
        description={credit?.manques[0] ? `Il reste ${credit.manques[0].disponible}, cette vidéo demande ≈ ${credit.manques[0].demande}.` : undefined}
        pied={
          <div className="grid gap-2">
            {credit?.manques[0]?.urlRecharge && (
              <a href={credit.manques[0].urlRecharge} target="_blank" rel="noreferrer noopener" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange px-5 text-[15px] font-semibold text-sur-orange">
                <Icone nom="lien" size={18} /> Recharger {credit.manques[0].nom}
              </a>
            )}
            {credit?.economiqueSuffit && (
              <Bouton
                taille="lg"
                pleineLargeur
                variante="secondaire"
                icone="eclair"
                onClick={() => {
                  modifier({ briquesCoupees: [...new Set([...brouillon.briquesCoupees, "illustrations" as const])] });
                  setCredit(null);
                  notifier.info("Version économique", "Sans images animées : elle tient dans le crédit.");
                }}
              >
                Version économique
              </Bouton>
            )}
            <Bouton
              taille="lg"
              pleineLargeur
              variante="secondaire"
              icone="archive"
              chargement={garde}
              onClick={async () => {
                if (!credit) return;
                setGarde(true);
                const r = await garderEnAttenteAction(credit.videoId, desQuePossible, credit.manques[0]?.fournisseur ?? "", credit.confirme, credit.scriptRelu);
                setGarde(false);
                if (!r.ok) return notifier.erreur(r.message);
                setCredit(null);
                notifier.succes("Gardée en brouillon", desQuePossible ? "Elle partira dès la recharge." : undefined);
              }}
            >
              Garder en brouillon
            </Bouton>
          </div>
        }
      >
        <div className="py-2">
          <CaseACocher libelle="Lancer dès que possible" detail="Dès que le crédit le permet." coche={desQuePossible} onChange={setDesQuePossible} />
        </div>
      </FeuilleBas>

      <FeuilleBas
        ouverte={budget}
        onOuverteChange={setBudget}
        titre="Budget du mois"
        description={apercu ? `Il reste ${formaterMontant(apercu.budget.restant, { court: true })} ce mois-ci · cette vidéo ≈ ${formaterMontant(apercu.estimation.total, { court: true })}` : undefined}
        pied={
          <div className="grid gap-2">
            {briques.illustrations && (
              <Bouton
                taille="lg"
                pleineLargeur
                variante="secondaire"
                icone="eclair"
                onClick={() => {
                  modifier({ briquesCoupees: [...new Set([...brouillon.briquesCoupees, "illustrations" as const])] });
                  setBudget(false);
                  notifier.info("Version économique", "Sans images animées.");
                }}
              >
                Version économique
              </Bouton>
            )}
            <Link href="/reglages#budget" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange px-5 text-[15px] font-semibold text-sur-orange">
              <Icone nom="jauge" size={18} /> Relever le plafond
            </Link>
          </div>
        }
      >
        <p className="py-4 text-center font-titre text-[56px] tabular-nums leading-none text-brique">{apercu ? formaterMontant(apercu.estimation.total) : "—"}</p>
      </FeuilleBas>
    </div>
  );
}

/** Un bloc de l'écran : image ou icône, titre, une ligne, pastille de vérification ; tout le bloc ouvre sa feuille. */
function CarteBloc({ index, icone, titre, ligne, ton, alerte, visuel, onOuvrir }: { index: number; icone: NomIcone; titre: string; ligne: string; ton: TonBloc; alerte?: string; visuel?: ReactNode; onOuvrir: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onOuvrir}
      aria-label={`${titre} : ${ligne}`}
      className={cn(
        "flex min-h-[72px] w-full items-center gap-3 rounded-carte border p-3 text-left transition-colors",
        ton === "orange" ? "border-orange/60 bg-orange-doux" : "border-trait bg-surface-1 hover:border-trait-fort",
      )}
    >
      <span className={cn("relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl", ton === "orange" ? "bg-orange text-sur-orange" : "bg-surface-2 text-orange-vif")}>
        {visuel ?? <Icone nom={icone} size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-texte-faible">
          {titre}
          {ton === "pret" && <Icone nom="coche" size={12} strokeWidth={3} className="text-sauge" />}
        </span>
        <span className="block truncate text-[15px] font-semibold text-texte">{ligne}</span>
      </span>
      {alerte && <Pastille ton="ambre">{alerte}</Pastille>}
      <Icone nom="chevron-droite" size={18} className="shrink-0 text-texte-faible" />
    </motion.button>
  );
}
