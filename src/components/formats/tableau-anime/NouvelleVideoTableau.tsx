"use client";

/**
 * « NOUVELLE VIDÉO · TABLEAU ANIMÉ » : une seule page. D'abord, deux chemins : « J'ai déjà mon texte », ou « Écrire le
 * script pour moi » (le générateur, `EcrireScriptTableau` : son coût est confirmé avant ; « Utiliser ce script »
 * remplit le texte et ses choix). Puis quatre temps. 1. le script et ses choix : le texte dit se RELIT et se modifie
 * dans l'écran commun « Relire le script » (`RelireScript`, une carte par phrase, texte libre, contrôles du tableau en
 * direct, gratuits) ; 2. son bouton « Découper en scènes » (coût annoncé, puis confirmé : le serveur refuse sans lui) ;
 * 3. la fiche de scènes (une fiche refusée par les règles est gardée « à corriger » ; « Autres corrections » : la
 * douleur, les mots importants, une ligne ajoutée, une scène coupée) ; 4. la case « Ce conseil n'est pas en première
 * page d'une recherche », le prix de la voix, puis le MÊME écran « Relire le script » sur la fiche : une carte par scène
 * (la voix dit, ses lignes écrites), les règles de la fiche relancées en direct ; modifiée, « Enregistrer mes
 * modifications » ; sinon « Fabriquer la vidéo » après confirmation du prix, avec le repère « script relu » (le serveur
 * refuse sans l'un ou l'autre). Le bouton suit LA relecture de la fabrication (règles, mise en page, case) : tant
 * qu'elle ne passe pas, il est inactif et dit pourquoi, et les défauts sont montrés sur leur scène.
 * L'écriture et le découpage sont des TÂCHES DE FOND : l'action rend la main, `SuiviTacheTableau` dit l'avancement et
 * recharge la page à la fin. Toute action qui ne répond pas donne une phrase ici, jamais l'écran d'erreur générique.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  cocherDejaVuTableauAction,
  controlerFicheTableauAction,
  controlerTexteTableauAction,
  corrigerFicheTableauAction,
  decouperScriptTableauAction,
  fabriquerVideoTableauAction,
} from "@/app/(studio)/tableau/nouvelle/actions";
import { BoutonImporterTexte } from "@/assistant/express/BoutonImporterTexte";
import { RelireScript } from "@/components/script/RelireScript";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Champ } from "@/components/ui/Champ";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { CARACTERES_DITS_MAX_TABLEAU, DUREE_MAX_TABLEAU_SEC, caracteresDits, caracteresEnTrop, dureeDiteSec } from "@/domaine/duree-tableau";
import { BORNES_FICHE } from "@/briques/fiche-scenes/types";
import { debutsDePhrase, mots as motsDuTexte } from "@/domaine/controles-script/texte";
import type { LigneScript, PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import { contexteDuGenerateur, correctionsDeLaRelecture, origineApresSaisie, texteClaudeDuBrouillon, decouperANouveau, lignesDeDepart, lignesDeLaFiche, RAISON_CASE_DEJA_VU, repereFiche, repereTexte, scriptAvecLignes, texteDesLignes } from "@/domaine/relecture-tableau";
import { partiesAccordees, partiesDuScript } from "@/domaine/scripts-tableau";
import { evaluerQualite } from "@/domaine/qualite-script";
import { depuisLignesTableau } from "@/domaine/qualite-script/adaptateurs/tableau";
import { RECETTE_TABLEAU } from "@/domaine/qualite-script/recettes/tableau";
import { formaterMontant } from "@/lib/montants";
import type { ChoixConfirmation } from "@/domaine/sujets-traites";
import type { CorrectionScene, DonneesScriptTableau, EcranCreationTableau, RefusSujetTraite } from "@/services/tableau-creation";
import { importantsDeLaScene } from "./importants";
import { CoutVoixTableau } from "./CoutVoix";
import { DUREE_DECOUPAGE_TEXTE } from "./durees";
import { EcrireScriptTableau } from "./EcrireScriptTableau";
import { FicheScenesTableau } from "./FicheScenes";
import { SuiviTacheTableau } from "./SuiviTacheTableau";
import { refusDecoupagePerime } from "./vue";

const euros = (centimes: number) => formaterMontant({ centimes: Math.max(0, Math.ceil(centimes)), devise: "EUR" });

/** La saisie de l'écran : les mots de la douleur sont tapés séparés par des virgules (le serveur les remet en liste). */
type Saisie = Omit<DonneesScriptTableau, "structure" | "finId" | "motsDouleur"> & { structure?: DonneesScriptTableau["structure"]; finId: string; motsDouleur: string };

/** Ce que l'écran remplit depuis des choix enregistrés ou proposés par le générateur. */
const saisieDe = (d: DonneesScriptTableau): Saisie => ({ ...d, finId: d.finId ?? "", mot: d.mot ?? "", motsDouleur: (d.motsDouleur ?? []).join(", ") });

/** Socle qualité commun, en OBSERVATION : pastilles « info » sous le texte relu, sans appel, sans effet sur les contrôles. */
const observerTexte = (lignes: LigneScript[]) => evaluerQualite(depuisLignesTableau(lignes), RECETTE_TABLEAU).pastilles;

const AIDE_DOULEUR = "Une phrase, 140 caractères au plus (plus longue, elle est raccourcie à sa première phrase).";
const AIDE_MOTS_DOULEUR = "2 à 4 mots dits au début du texte, séparés par des virgules : ils sont écrits et entourés dans les 3 premières secondes.";

/** Débit (mots par seconde) qui redonne la durée du tableau pour ce texte : « Relire le script » montre la même durée. */
function debitDe(texte: string): number | undefined {
  const sec = dureeDiteSec(texte);
  return sec > 0 ? motsDuTexte(texte).length / sec : undefined;
}

/** Les pastilles d'une action de contrôle (une réponse en échec devient « Vérification indisponible »). */
async function pastillesDe(r: Promise<{ ok: true; donnees: PastilleControle[] } | { ok: false; message: string }>): Promise<PastilleControle[]> {
  const x = await r;
  if (!x.ok) throw new Error(x.message);
  return x.donnees;
}

/** Durée estimée du texte dit, à la même estimation que le générateur et les règles du découpage (voix réelle). */
function DureeDite({ texte }: { texte: string }) {
  const sec = dureeDiteSec(texte);
  const enTrop = caracteresEnTrop(texte, DUREE_MAX_TABLEAU_SEC);
  return (
    <p className={`text-sm ${enTrop ? "text-brique" : "text-texte-doux"}`}>
      Environ {Math.round(sec)} s dites
      {enTrop ? ` : ${DUREE_MAX_TABLEAU_SEC} s au plus, raccourcissez le texte d'environ ${enTrop} caractères.` : ` (${DUREE_MAX_TABLEAU_SEC} s au plus).`}
    </p>
  );
}

/** Le chemin choisi en premier : son texte, ou le générateur. */
export type CheminTableau = "texte" | "ecrire";

/** Chemin de départ d'un brouillon : le générateur s'il a écrit et qu'aucune fiche n'existe ; le texte s'il y en a un. */
export function cheminDeDepart(b: EcranCreationTableau["brouillon"]): CheminTableau | null {
  if (!b) return null;
  if ((b.generation || b.ecritureInterrompue || b.tache?.type === "ecriture") && !b.fiche) return "ecrire";
  return b.fiche || b.donnees.texte ? "texte" : null;
}

/** Ce que le contrôle du sujet lit : si cela change après un refus, le panneau « Sujet déjà traité » n'a plus lieu d'être. */
const cleSaisie = (s: Saisie): string => JSON.stringify([s.texte, s.gesteMinute, s.douleur, s.finId, s.mot ?? "", s.reseaux]);

export function NouvelleVideoTableau({ ecran }: { ecran: EcranCreationTableau }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const b = ecran.brouillon;
  const [saisie, setSaisie] = useState<Saisie>(() => ({
    texte: b?.donnees.texte ?? "",
    serieCode: b?.donnees.serieCode ?? "",
    structure: b?.donnees.structure,
    douleur: b?.donnees.douleur ?? "",
    motsDouleur: (b?.donnees.motsDouleur ?? []).join(", "),
    gesteMinute: b?.donnees.gesteMinute ?? "",
    finId: b?.donnees.finId ?? "",
    mot: b?.donnees.mot ?? "",
    reseaux: b?.donnees.reseaux ?? [],
  }));
  const [refus, setRefus] = useState<string[] | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  /** Texte d'un sujet déjà traité : le refus du serveur et ce qui repart tel quel avec « Refaire quand même » (texte, prix, repère relu). */
  const [refusSujet, setRefusSujet] = useState<{ refus: RefusSujetTraite; avec: Saisie; accord: number | true; relu: string; cle: string } | null>(null);
  const [corrections, setCorrections] = useState<Record<string, CorrectionScene>>({});
  /** Correction de la douleur et de ses mots (en-tête de la fiche) ; `null` : inchangés. */
  const [entete, setEntete] = useState<{ douleur: string; motsDouleur: string } | null>(null);
  const [corriger, setCorriger] = useState(false);
  const [chemin, setChemin] = useState<CheminTableau | null>(() => cheminDeDepart(b));
  // D'où vient le texte dit : « will » (J'ai déjà mon texte : pris à l'identique) ou « generateur » (script de Claude, contrôles gardés).
  // Rangée dans le brouillon (`donnees.origine`) au découpage : elle survit au rechargement. Un brouillon sans origine « will » qui a déjà
  // une écriture de Claude repart en « generateur » : dans le doute, les contrôles restent.
  const [origine, setOrigine] = useState<"will" | "generateur">(() => (b?.donnees.origine === "will" ? "will" : b?.generation ? "generateur" : "will"));
  // Le texte écrit par Claude et repris dans le champ (« Utiliser ce script », « Corriger à la main ») : tant qu'il y est tel quel, il reste à Claude.
  const [texteClaude, setTexteClaude] = useState<string | null>(null);
  const [voirNonValidees, setVoirNonValidees] = useState(false);
  const [dejaVu, setDejaVu] = useState(!!b?.dejaVu);
  /** Le texte dit se relit (cartes par phrase) ; sinon il se tape ou se colle en entier. */
  const [relecture, setRelecture] = useState(() => !!b?.donnees.texte.trim());
  /** Le texte au moment où la relecture s'ouvre (ses lignes de départ) et une clé pour la rouvrir à neuf. */
  const [depart, setDepart] = useState(() => ({ texte: b?.donnees.texte ?? "", cle: 0 }));
  /** Une fiche existe et le texte modifié se relit avant « Découper à nouveau ». */
  const [relireApresFiche, setRelireApresFiche] = useState(false);

  const fin = ecran.fins.find((f) => f.id === saisie.finId);
  /** Le texte dit se relit tant qu'aucune fiche n'existe (ensuite, c'est la fiche, sauf texte modifié à redécouper). */
  const relireTexte = relecture && (!b?.fiche || relireApresFiche);
  /** Une tâche de fond tourne : les boutons qui lancent ou modifient attendent (le serveur refuse aussi). */
  const occupe = b?.tache?.statut === "en-attente" || b?.tache?.statut === "en-cours";
  const injoignable = "Le studio ne répond pas pour l'instant. Rien n'est perdu : réessayez dans un instant.";
  // Un découpage refusé dont la fiche a été corrigée depuis (sa dernière version passe) : plus de bandeau périmé.
  const suivi = b?.tache && !refusDecoupagePerime(b) ? <SuiviTacheTableau videoId={b.videoId} initiale={b.tache} coutEcritureCentimes={ecran.ecriture.coutCentimes} coutDecoupageCentimes={ecran.coutDecoupageCentimes} /> : null;
  // Fins « À valider » masquées par défaut (sauf celle déjà choisie) ; libellé affiché, jamais une réservation directe.
  const finsAffichees = ecran.fins.filter((f) => f.validee || voirNonValidees || f.id === saisie.finId);
  const nonValideesMasquees = ecran.fins.some((f) => !f.validee && f.id !== saisie.finId) && !voirNonValidees;
  const changer = (p: Partial<Saisie>) => setSaisie((s) => ({ ...s, ...p }));

  // « Relire le script » du texte dit : par passage s'il vient tel quel du générateur, sinon phrase par phrase.
  const scriptGenere = useMemo(() => contexteDuGenerateur(b?.generation)?.ecriture.script ?? null, [b?.generation]);
  // Le texte de Claude connu de ce brouillon (survit au rechargement) : repris dans l'écran, sinon celui que le brouillon porte.
  const referenceClaude = texteClaude ?? texteClaudeDuBrouillon(b);
  const lignesTexte = useMemo(() => lignesDeDepart(depart.texte, scriptGenere), [depart.texte, scriptGenere]);
  const videoId = b?.videoId;
  const controlerTexte = useCallback((s: ScriptRelu) => pastillesDe(controlerTexteTableauAction({ ...s, origine }, videoId)), [videoId, origine]);
  const suivreTexte = useCallback((s: ScriptRelu) => {
    const texte = texteDesLignes(s.lignes);
    setRefusSujet(null);
    setSaisie((x) => ({ ...x, texte }));
    // Champ entièrement vidé : Will repart de zéro, ce qu'il écrit ensuite est son texte.
    if (!texte.trim()) setOrigine("will");
  }, []);
  /** Ouvre la relecture sur ce texte (cartes à neuf). */
  function relire(texte: string) {
    setDepart((d) => ({ texte, cle: d.cle + 1 }));
    setRelecture(true);
  }
  // « Relire le script » de la fiche : une carte par scène ; le repère « script relu » est l'empreinte de ces lignes.
  const ficheActuelle = b?.fiche ?? null;
  const lignesFiche = useMemo(() => (ficheActuelle ? lignesDeLaFiche(ficheActuelle) : []), [ficheActuelle]);
  const controlerFiche = useCallback((s: ScriptRelu) => pastillesDe(controlerFicheTableauAction(videoId ?? "", s)), [videoId]);

  /** Envoie le découpage avec le prix confirmé et le repère du texte relu ; l'issue en clair (prix, refus, ou parti). */
  async function envoyerDecoupage(avec: Saisie, accord: number | true, relu: string, sujet?: { choix: ChoixConfirmation; jeton: string }): Promise<ResultatLancement> {
    setPhrase(null);
    setRefus(null);
    setRefusSujet(null);
    const r = await decouperScriptTableauAction({ ...avec, finId: avec.finId || null, origine: origine === "will" ? "will" : undefined }, b?.videoId, accord, relu, sujet).catch(() => null);
    if (!r) return { ok: false, message: injoignable };
    if (!r.ok) return { ok: false, message: r.message };
    if (r.donnees.statut === "accord-requis") return { ok: false, code: "CONFIRMATION_REQUISE", montant: r.donnees.centimes, message: r.donnees.phrase };
    if (r.donnees.statut === "sujet-deja-traite") {
      // Rien n'est enregistré ni payé : le panneau propose un autre texte, ou de le refaire quand même (jeton + même texte).
      setRefusSujet({ refus: r.donnees, avec, accord, relu, cle: cleSaisie(avec) });
      return { ok: false, message: "Ce sujet est déjà traité." };
    }
    if (r.donnees.statut === "refusee") {
      setRefus(r.donnees.refus.length ? r.donnees.refus : null);
      if (r.donnees.videoId && r.donnees.videoId !== b?.videoId) router.replace(`/tableau/nouvelle?brouillon=${r.donnees.videoId}`);
      return { ok: false, message: r.donnees.phrase };
    }
    if (r.donnees.avertissement) {
      const titres = r.donnees.avertissement.precedents.slice(0, 3).map((p) => p.titre).join(" · ");
      notifier.info("Ce sujet existe déjà ailleurs", `Déjà fait : ${titres}. Le découpage continue.`);
    }
    notifier.succes("Découpage lancé", `${DUREE_DECOUPAGE_TEXTE} : vous pouvez fermer la page, le travail continue.`);
    setCorrections({});
    setRelireApresFiche(false);
    router.replace(`/tableau/nouvelle?brouillon=${r.donnees.videoId}`);
    router.refresh();
    return { ok: true };
  }

  /**
   * « Découper à nouveau » (une fiche existe) : le texte déjà relu repart avec son repère, après le prix ; modifié dans
   * le grand champ, il se relit d'abord (« Relire le script », ses contrôles), rien ne part.
   */
  function decouperANouveauOuRelire() {
    if (!b) return;
    const issue = decouperANouveau(saisie.texte, b.donnees.texte);
    if ("relire" in issue) {
      setPhrase(null);
      setRelireApresFiche(true);
      relire(saisie.texte);
      return;
    }
    void decouper(saisie, issue.relu);
  }

  async function decouper(avec: Saisie, relu: string, montant = ecran.coutDecoupageCentimes, sujet?: { choix: ChoixConfirmation; jeton: string }) {
    // Le prix d'abord, comme l'écriture : le serveur refuse sans un montant confirmé.
    const accord = await confirmerPrix({ message: "Le découpage en scènes par Claude (deux appels au plus).", montant });
    if (typeof accord !== "number") return;
    demarrer(async () => {
      const r = await envoyerDecoupage(avec, accord, relu, sujet);
      if (r.ok) return;
      if (r.code === "CONFIRMATION_REQUISE" && typeof r.montant === "number") return void decouper(avec, relu, r.montant, sujet);
      setPhrase(r.message);
    });
  }

  /**
   * « Découper en scènes » depuis la relecture (prix confirmé par l'écran commun) : le texte relu, et ses parties
   * nommées refaites quand il suit encore le script du générateur (sinon le découpage n'en reçoit pas).
   */
  function decouperRelu(s: ScriptRelu, accord: number | true): Promise<ResultatLancement> {
    const texte = texteDesLignes(s.lignes);
    const { parties: _avant, ...reste } = saisie;
    void _avant;
    const parties = scriptGenere && s.lignes.every((l) => l.id.startsWith("p")) ? partiesDuScript(scriptAvecLignes(scriptGenere, s.lignes)) : undefined;
    return envoyerDecoupage({ ...reste, texte, ...(parties && partiesAccordees(parties, texte) ? { parties } : {}) }, accord, repereTexte(texte));
  }

  function corrigerScene(sceneId: string, p: Omit<CorrectionScene, "sceneId">) {
    setCorrections((c) => {
      const avant = c[sceneId] ?? { sceneId };
      return { ...c, [sceneId]: { ...avant, ...p, lignes: { ...avant.lignes, ...p.lignes } } };
    });
  }

  function enregistrer() {
    if (!b) return;
    setPhrase(null);
    demarrer(async () => {
      const scenes = Object.values(corrections);
      const r = await corrigerFicheTableauAction(b.videoId, entete ? { scenes, ...entete } : scenes).catch(() => null);
      if (!r) return setPhrase(injoignable);
      if (!r.ok) return setPhrase(r.message);
      if (r.donnees.statut === "refusee") {
        setPhrase(r.donnees.phrase);
        setRefus(r.donnees.problemes.map((p) => p.message));
        return;
      }
      notifier.succes("Corrections enregistrées", "La version précédente est gardée.");
      // La fiche passe les règles : le refus du découpage et ses motifs ne sont plus d'actualité.
      setRefus(null);
      setCorrections({});
      setEntete(null);
      setCorriger(false);
      router.refresh();
    });
  }

  /** La case « déjà vu » : cochée, elle est datée du jour et gardée dans le brouillon (la fabrication la reçoit). */
  function cocherDejaVu(coche: boolean) {
    if (!b) return;
    setDejaVu(coche);
    setPhrase(null);
    demarrer(async () => {
      const r = await cocherDejaVuTableauAction(b.videoId, coche).catch(() => null);
      if (!r || !r.ok) {
        setDejaVu(!coche);
        return setPhrase(r ? r.message : injoignable);
      }
      router.refresh();
    });
  }

  /** « Fabriquer la vidéo » depuis la relecture de la fiche : le prix confirmé, et le repère « script relu ». */
  async function fabriquerRelu(s: ScriptRelu, accord: number | true): Promise<ResultatLancement> {
    if (!b) return { ok: false, message: injoignable };
    const r = await fabriquerVideoTableauAction(b.videoId, accord, s.empreinte).catch(() => null);
    if (!r) return { ok: false, message: injoignable };
    if (!r.ok) return { ok: false, message: r.message };
    if (r.donnees.statut === "refusee") return { ok: false, message: r.donnees.phrase };
    if (r.donnees.statut === "accord-requis") return { ok: false, code: "CONFIRMATION_REQUISE", montant: r.donnees.centimes, message: r.donnees.phrase };
    router.push(`/videos/${r.donnees.videoId}`);
    return { ok: true };
  }

  /** « Enregistrer mes modifications » de la relecture de la fiche : une nouvelle version (règles de la fiche). */
  async function enregistrerRelu(s: ScriptRelu): Promise<ResultatLancement> {
    if (!b?.fiche) return { ok: false, message: injoignable };
    setRefus(null);
    const r = await corrigerFicheTableauAction(b.videoId, correctionsDeLaRelecture(b.fiche, s.lignes)).catch(() => null);
    if (!r) return { ok: false, message: injoignable };
    if (!r.ok) return { ok: false, message: r.message };
    if (r.donnees.statut === "refusee") return { ok: false, message: [r.donnees.phrase, ...r.donnees.problemes.slice(0, 3).map((p) => p.message)].join(" ") };
    notifier.succes("Corrections enregistrées", "La version précédente est gardée. Relisez, puis « Fabriquer ».");
    router.refresh();
    return { ok: true };
  }

  /** « Utiliser ce script » : le texte et les choix sont remplis ; le texte se relit avant « Découper en scènes ». */
  function utiliser(d: DonneesScriptTableau) {
    const avec = saisieDe(d);
    setSaisie(avec);
    setOrigine("generateur");
    setTexteClaude(avec.texte);
    setChemin("texte");
    relire(avec.texte);
  }

  /** « Corriger à la main » : le texte et les choix sont remplis, rien ne part ; le texte se relit, puis le découpage. */
  function corrigerALaMain(d: DonneesScriptTableau) {
    const avec = saisieDe(d);
    setSaisie(avec);
    setOrigine("generateur");
    setTexteClaude(avec.texte);
    setChemin("texte");
    relire(avec.texte);
  }

  if (!chemin) {
    return (
      <section aria-label="Pour commencer" className="grid gap-3 sm:grid-cols-2">
        <Bouton variante="secondaire" icone="ecrire" taille="lg" pleineLargeur onClick={() => { setOrigine((o) => origineApresSaisie(o, "bouton", saisie.texte, referenceClaude)); setChemin("texte"); }}>
          J&apos;ai déjà mon texte
        </Bouton>
        <Bouton icone="baguette" taille="lg" pleineLargeur onClick={() => setChemin("ecrire")}>
          Écrire le script pour moi
        </Bouton>
      </section>
    );
  }

  if (chemin === "ecrire") {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Bouton variante="fantome" onClick={() => { setOrigine((o) => origineApresSaisie(o, "bouton", saisie.texte, referenceClaude)); setChemin("texte"); }}>
            J&apos;ai déjà mon texte
          </Bouton>
        </div>
        {suivi}
        <EcrireScriptTableau ecran={ecran} onUtiliser={utiliser} onCorriger={corrigerALaMain} occupe={occupe} />
        {phrase && (
          <p role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
            {phrase}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {suivi}
      {!b?.fiche && (
        <div className="flex justify-end">
          <Bouton variante="fantome" icone="baguette" onClick={() => setChemin("ecrire")}>
            Écrire le script pour moi
          </Bouton>
        </div>
      )}
      {/* 1. Le script */}
      <section aria-label="Le script" className="space-y-4">
        {!relireTexte && (
          <>
            <ZoneTexte id="tableau-texte" libelle="Le texte dit" value={saisie.texte} onChange={(e) => { changer({ texte: e.target.value }); setOrigine((o) => origineApresSaisie(o, "champ", e.target.value, referenceClaude)); }} rows={6} longueurMax={CARACTERES_DITS_MAX_TABLEAU} compter={caracteresDits} />
            <BoutonImporterTexte onTexte={(t) => { changer({ texte: t }); setOrigine((o) => origineApresSaisie(o, "import", t, referenceClaude)); }} />
            {saisie.texte.trim() && <DureeDite texte={saisie.texte} />}
          </>
        )}
        <SelecteurPastilles libelle="La série" options={ecran.series} valeur={saisie.serieCode || undefined} onChange={(v) => changer({ serieCode: v })} />
        <SelecteurPastilles libelle="La forme" options={ecran.structures} valeur={saisie.structure} onChange={(v) => changer({ structure: v })} />
        <Champ libelle="Le problème de votre public" aide={AIDE_DOULEUR} value={saisie.douleur} onChange={(e) => changer({ douleur: e.target.value })} maxLength={300} />
        <Champ libelle="Les mots de la douleur" aide={AIDE_MOTS_DOULEUR} value={saisie.motsDouleur} onChange={(e) => changer({ motsDouleur: e.target.value })} maxLength={160} />
        <Champ libelle="Le geste à refaire" value={saisie.gesteMinute} onChange={(e) => changer({ gesteMinute: e.target.value })} maxLength={160} />
        <SelecteurPastilles
          libelle="La phrase de fin"
          options={[{ valeur: "", libelle: "Aucune" }, ...finsAffichees.map((f) => ({ valeur: f.id, libelle: f.libelle, detail: f.validee ? undefined : "À valider" }))]}
          valeur={saisie.finId}
          onChange={(v) => changer({ finId: v })}
        />
        {nonValideesMasquees && (
          <button type="button" className="text-sm text-texte-doux underline underline-offset-2" onClick={() => setVoirNonValidees(true)}>
            Voir les fins non validées
          </button>
        )}
        {fin?.avecMot && <Champ libelle="Le mot à commenter" value={saisie.mot ?? ""} onChange={(e) => changer({ mot: e.target.value })} maxLength={24} />}
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-texte-doux">Les réseaux</legend>
          {ecran.reseaux.map((r) => (
            <CaseACocher key={r.valeur} libelle={r.libelle} coche={saisie.reseaux.includes(r.valeur)} onChange={(v) => changer({ reseaux: v ? [...saisie.reseaux, r.valeur] : saisie.reseaux.filter((x) => x !== r.valeur) })} />
          ))}
        </fieldset>
        {relireTexte && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-texte-doux">Le texte dit</p>
              <Bouton variante="fantome" icone="ecrire" onClick={() => (setRelecture(false), setRelireApresFiche(false))}>
                Tout réécrire
              </Bouton>
            </div>
            <RelireScript
              key={depart.cle}
              lignes={lignesTexte}
              controler={controlerTexte}
              lancer={decouperRelu}
              prixCentimes={ecran.coutDecoupageCentimes}
              debit={debitDe(depart.texte)}
              texteLibre
              libelleLancer={`Découper en scènes (≈ ${euros(ecran.coutDecoupageCentimes)} au plus)`}
              iconeLancer="ciseaux"
              bloque={occupe ? "Un travail est en cours : attendez qu'il se termine." : null}
              surChangement={suivreTexte}
              observation={observerTexte}
            />
          </div>
        )}
      </section>

      {/* 2. Découper (avec une fiche, ou avant la relecture du texte) */}
      <section aria-label="Découper" className="space-y-2">
        {b?.fiche ? (
          !relireTexte && (
            <Bouton icone="ciseaux" chargement={enCours && !corriger} disabled={occupe} onClick={decouperANouveauOuRelire} pleineLargeur>
              Découper à nouveau (≈ {euros(ecran.coutDecoupageCentimes)} au plus)
            </Bouton>
          )
        ) : (
          !relireTexte && (
            <Bouton icone="lecture" variante="secondaire" disabled={occupe || !saisie.texte.trim()} onClick={() => relire(saisie.texte)} pleineLargeur>
              Relire le texte
            </Bouton>
          )
        )}
        <p className="text-sm text-texte-doux">Durée du découpage : {DUREE_DECOUPAGE_TEXTE}.</p>
        {refusSujet && refusSujet.cle === cleSaisie(saisie) && (
          <section aria-label="Sujet déjà traité" role="alert" className="space-y-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
            <p className="font-semibold">{refusSujet.refus.jetonPerime ? "Les vidéos ont changé. Choisissez de nouveau." : refusSujet.refus.phrase}</p>
            <ul className="space-y-1 text-sm">
              {refusSujet.refus.precedents.slice(0, 5).map((p) => (
                <li key={p.videoId ?? p.sujetId ?? p.lien}>
                  <Link href={p.lien} className="underline">
                    {p.titre}
                  </Link>{" "}
                  <span className="text-texte-doux">le {new Date(p.le).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-texte-doux">Changez le texte pour un autre sujet, ou gardez-le tel quel.</p>
            <div className="flex flex-wrap gap-2">
              <Bouton
                variante="secondaire"
                chargement={enCours}
                disabled={occupe}
                onClick={() => {
                  const { avec, accord, relu } = refusSujet;
                  demarrer(async () => {
                    const sujet = { choix: "refaire" as const, jeton: refusSujet.refus.jeton };
                    const r = await envoyerDecoupage(avec, accord, relu, sujet);
                    if (r.ok) return;
                    if (r.code === "CONFIRMATION_REQUISE" && typeof r.montant === "number") return void decouper(avec, relu, r.montant, sujet);
                    setPhrase(r.message);
                  });
                }}
              >
                Refaire quand même
              </Bouton>
            </div>
          </section>
        )}
        {(phrase || refus) && (
          <div role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
            {phrase && <p>{phrase}</p>}
            {refus && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-texte-doux">
                {refus.slice(0, 6).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 3. La fiche de scènes */}
      {b?.fiche && (
        <section aria-label="La fiche" className="space-y-3">
          {b.ficheACorriger && (
            <p role="status" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
              Fiche refusée au découpage, gardée pour ne rien perdre : corrigez ce qui est signalé, puis « Enregistrer » (elle part en fabrication dès qu&apos;elle passe les règles).
            </p>
          )}
          <FicheScenesTableau fiche={b.fiche} problemes={b.problemes} />
          {corriger ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
                <p className="text-sm font-semibold text-texte-doux">La douleur</p>
                <Champ
                  libelle="Le problème de votre public"
                  aide={AIDE_DOULEUR}
                  value={entete?.douleur ?? b.donnees.douleur}
                  onChange={(e) => setEntete({ douleur: e.target.value, motsDouleur: entete?.motsDouleur ?? (b.donnees.motsDouleur ?? []).join(", ") })}
                  maxLength={300}
                />
                <Champ
                  libelle="Les mots de la douleur"
                  aide={AIDE_MOTS_DOULEUR}
                  value={entete?.motsDouleur ?? (b.donnees.motsDouleur ?? []).join(", ")}
                  onChange={(e) => setEntete({ douleur: entete?.douleur ?? b.donnees.douleur, motsDouleur: e.target.value })}
                  maxLength={160}
                />
              </div>
              {b.fiche.scenes.map((s, i) => (
                <div key={s.id} className="space-y-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
                  <p className="text-sm font-semibold text-texte-doux">Scène {i + 1}</p>
                  {/* La voix dit et les lignes écrites se relisent dans « Relire le script » (sous la fiche). */}
                  <p className="text-[15px] text-texte">« {s.texteDit} »</p>
                  <Champ
                    libelle="Mots importants"
                    aide="Séparés par des virgules ; seuls les mots écrits dans une ligne sont gardés."
                    value={corrections[s.id]?.importants ?? importantsDeLaScene(s)}
                    onChange={(ev) => corrigerScene(s.id, { importants: ev.target.value })}
                    maxLength={160}
                  />
                  {s.elements.length < BORNES_FICHE.elementsMax && (
                    <Champ
                      libelle="Ajouter une ligne écrite"
                      aide="Facultatif : une ligne courte, écrite au moment où ses mots sont dits."
                      value={corrections[s.id]?.ajouts?.[0] ?? ""}
                      onChange={(ev) => corrigerScene(s.id, { ajouts: ev.target.value.trim() ? [ev.target.value] : undefined })}
                      maxLength={160}
                    />
                  )}
                  {(b.fiche?.scenes.length ?? 0) < BORNES_FICHE.scenesMax && debutsDePhrase(s.texteDit).length > 0 && (
                    <div>
                      <label htmlFor={`tableau-couper-${b.videoId}-${s.id}`} className="mb-1.5 block text-sm font-semibold text-texte-doux">
                        Couper la scène en deux
                      </label>
                      <select
                        id={`tableau-couper-${b.videoId}-${s.id}`}
                        value={corrections[s.id]?.couperAvant ?? ""}
                        onChange={(ev) => corrigerScene(s.id, { couperAvant: ev.target.value ? Number(ev.target.value) : undefined })}
                        className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-texte"
                      >
                        <option value="">Ne pas couper</option>
                        {debutsDePhrase(s.texteDit).map((c) => (
                          <option key={c} value={c}>
                            Avant « {motsDuTexte(s.texteDit).slice(c, c + 6).join(" ")}… »
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap justify-end gap-2">
                <Bouton variante="fantome" onClick={() => (setCorrections({}), setEntete(null), setCorriger(false))}>
                  Annuler
                </Bouton>
                <Bouton icone="coche" chargement={enCours} disabled={!Object.keys(corrections).length && !entete && !b.ficheACorriger} onClick={enregistrer}>
                  Enregistrer
                </Bouton>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Bouton variante="secondaire" icone="ecrire" disabled={occupe} onClick={() => setCorriger(true)}>
                Autres corrections
              </Bouton>
            </div>
          )}
        </section>
      )}

      {/* 4. Fabriquer (pas pendant la relecture d'un texte modifié : il sera redécoupé d'abord) */}
      {b?.fiche && !corriger && !relireTexte && (
        <section aria-label="Fabriquer" className="space-y-3">
          <CoutVoixTableau centimes={b.coutVoixCentimes} voix={b.voix} />
          <CaseACocher
            libelle="Ce conseil n'est pas en première page d'une recherche"
            detail="Cherchez le sujet sur Google : si le même conseil apparaît en première page, la vidéo n'apporte rien."
            coche={dejaVu}
            desactive={occupe || enCours}
            onChange={cocherDejaVu}
          />
          <RelireScript
            key={repereFiche(b.fiche)}
            lignes={lignesFiche}
            controler={controlerFiche}
            lancer={fabriquerRelu}
            enregistrer={enregistrerRelu}
            prixCentimes={b.voix === "reutilisee" ? 0 : b.coutVoixCentimes}
            prixDejaPaye={b.voix === "reutilisee"}
            debit={debitDe(b.donnees.texte)}
            libelleLancer={b.voix === "reutilisee" ? "Fabriquer la vidéo (voix déjà payée)" : `Fabriquer la vidéo (≈ ${euros(b.coutVoixCentimes)})`}
            bloque={occupe ? "Un travail est en cours : attendez qu'il se termine." : !dejaVu ? RAISON_CASE_DEJA_VU : b.raisonFabriquerCase ? null : b.raisonFabriquer}
          />
        </section>
      )}
    </div>
  );
}
