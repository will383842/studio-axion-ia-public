/**
 * BOUCLE DE GÉNÉRATION ET CONTRAT DU SERVICE, LOT G4 (plan v5 B.3.4, B.3.5, B.3.6).
 *
 * - `lancerGeneration` : étape 0 GRATUITE (domaine d'Axion-IA, choix conjoint, diversité) ; un manque s'arrête à 0 €,
 *   sans numéro ; sinon le choix est RÉSERVÉ sous `sousVerrou`, une `GenerationScript` « en-cours » est créée, le numéro
 *   est pris (point du premier appel payant) et la boucle reprend la main. Rien n'est appelé dans la requête de Will.
 * - La boucle (`tourBoucleGeneration`) a SON drapeau, hors de la file `Travail` (B.0 n° 52) : elle déroule la chaîne
 *   (`generateur/chaine.ts`) avec `executerRoleFacture` (pré-vol, plafonds, réservation, coût réel), sauve l'état après
 *   chaque étape (`generateur.chaine.<id>`), repart de la dernière étape terminée après un redémarrage (les étapes
 *   terminées ne sont jamais repayées ; un appel INTERROMPU par le redémarrage peut l'être, dans la limite du plafond du
 *   sujet : voir `solderAppelsInterrompus`), marque « prêtes » les écritures en attente de crédit débloquées (jamais
 *   relancées sans le geste de Will, garde-fous budget du 15/10), puis range (étape 13).
 * - Démarrage : `assurerBoucleGeneration()` au démarrage du serveur (`instrumentation.ts`, correctif
 *   `docs/correctifs/G4-instrumentation-boucle-generation.patch` appliqué au lot G4c), au premier lancement et à
 *   l'ouverture d'une fiche sujet — mais seulement dans l'instance qui tient le verrou de la boucle (paquet 4).
 * - Tout est asynchrone (fetch) : la boucle HeyGen et la file de fabrication continuent pendant une écriture.
 */
import "server-only";
import { codeVariante, empreinte, empreinteCorps, assemblerBlocs, repartirBlocs, texteDesBlocs, versionsCourantes } from "@/domaine/derivations-generateur";
import { elementDiversite, raconteUnClient, type ElementDiversite, type TournureControle } from "@/domaine/controles-script";
import type { Adresse, BlocScript, GenerationScript, Id, IdReseau, Matiere, ModeDiction, Montant, ReseauDeclinaison, Script, ScriptMaitre, VarianteReseau } from "@/domaine/types";
import type { OrigineLancement } from "./budget-mensuel";
import { historiqueSerie } from "@/domaine/variete";
import { MESSAGE_AUCUN_COMPTE_CLAUDE } from "@/domaine/credits";
import { estTexteColle, matierePourSujet, PREFIXE_LIMITE_DU_SUJET } from "@/domaine/matieres";
import { DRAPEAUX_TOURNURES } from "@/donnees/generateur/tournures-calibrees";
import { formatGenerateur } from "@/formats";
import { lireFamilles } from "./hashtags";
import { enregistrerScriptCentral, memoireCentraleAllumee, preparerMemoireCentrale } from "./memoire-centrale";
import { etapeDeDepart, executerChaine, miseEnFormePrompteur, redeclinerVersion, texteVersion, type EtatChaine, type ExecuteurRoles, type OptionsChaine, type VersionEcrite } from "@/generateur/chaine";
import { executerChaineCourte } from "@/generateur/chaine-courte";
import { executerChaineEquipe, type EtatChaineEquipe } from "@/generateur/chaine-equipe";
import { nomsDuSocle, type DonneesGeneration } from "@/generateur/contexte";
import { pireCasChaine, type ChaineEcriture } from "@/generateur/pire-cas";
import { etapeZero } from "@/generateur/etape-zero";
import { vousVersTu } from "@/generateur/adresse-tu";
import { versionsRoles } from "@/generateur/roles";
import { nouvelId } from "@/lib/ids";
import { formaterMontant, TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";
import { exigerSession } from "./auth";
import { effacerRepriseDeWill, marquerRepriseDeWill, chaineDeLEcriture, claudeBranche, CODE_REFUS_NET, depenseGenerationUsd, ecritureDebloquee, ecritureEnEssai, ecriturePreteAReprendre, ecritureSansReserve, executerRoleFacture, marquerEcrituresAnciennesEnEssai, formaterUsd, phraseAttenteCredit, phraseAttenteSeuil, phrasePireCasTropHaut, phraseReserveRefusee, PARAM_CHAINE, plafondChaineUsd, reglagePlafond, releveApresPannesUsd, releverPlafondApresPannes, relancerEcrituresEnAttente, reprendreGenerationsEnAttenteCredit, reserverPireCasChaine } from "./generation-claude";
import { accordAutomatique, budgetIndicatifPour } from "./mode-budget";
import { gagnantsDuJour, poidsApprentissage } from "./apprentissage";
import { controlerSujetCentral, ErreurSujetDejaTraite } from "./sujet-central-controle";
import { attribuerNumero, attribuerNumeroSousVerrou, creerSujet, prendreEpisode, PLAFOND_SUPPLEMENT_ADRESSE_USD, PLAFOND_SUPPLEMENT_USD, rattacherVideoAVariante, reporterCorps, retoucherCorps, retoucherVariante, synchroniserSujet, validerVersions, type BriefSujet } from "./generateur";
import { creerNotification } from "./notifications";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import { verrouBoucleTenu } from "./_boucle-etat";
import { abonnementsClaudeActifs, lireReglageSourcesClaude } from "./source-claude";
import { depots, ErreurStudio, ecrireParametre, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";

/* ------------------------------------------------------------------ */
/* État persistant de la chaîne                                        */
/* ------------------------------------------------------------------ */

const cleEtat = (generationId: Id) => `generateur.chaine.${generationId}`;
const cleOptions = (generationId: Id) => `generateur.chaine-options.${generationId}`;

interface OptionsGeneration {
  mode: ModeDiction;
  adresse: Adresse;
  formatId: string;
  reseaux: ReseauDeclinaison[];
  /** Corps supplémentaire : la chaîne repart de l'étape 4 sur le même fond. */
  depuisGenerationId?: Id;
  /**
   * L3-0 : d'où vient l'écriture, FIGÉ au lancement comme la chaîne. « usine » : chaque rôle repasse par le budget de
   * l'Usine, aussi à la reprise ou après un redémarrage. Absente : Will dans le studio (défaut manuel, inchangé).
   */
  origine?: OrigineLancement;
  /**
   * Chaîne qui écrit, FIGÉE au lancement (depuis le 23/10/2026 toute NOUVELLE écriture est sur la courte, `chaineDeLEcriture`) : une écriture
   * finit sur la chaîne où elle a commencé, même si le réglage change en route. Absente (écriture d'avant ce champ) : la
   * grande.
   */
  chaine?: ChaineEcriture;
}

/** Chaîne d'une écriture lancée (figée dans ses options). */
const chaineDe = (o: Pick<OptionsGeneration, "chaine">): ChaineEcriture => o.chaine ?? "grande";

export async function lireEtatChaine(generationId: Id): Promise<EtatChaine | null> {
  return lireParametre<EtatChaine | null>(cleEtat(generationId), null);
}

/* ------------------------------------------------------------------ */
/* Données de la chaîne, lues en base                                  */
/* ------------------------------------------------------------------ */

async function tournuresActives(): Promise<TournureControle[]> {
  return (await depots().tournesInterdites.lister((t) => !t.archiveLe)).map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, drapeaux: DRAPEAUX_TOURNURES, niveau: t.niveau, portee: t.portee }));
}

/**
 * E2E-2 parcours n° 8 : un corps ne voit que la limite validée DANS SON ADRESSE (au « vous » : les mots de Will ; au
 * « tu » : la même phrase au « tu »), jamais les deux : la chaîne cite la limite mot pour mot.
 */
function limiteDUneAutreAdresse(x: Matiere, m: ScriptMaitre, adresse: Adresse): boolean {
  if (x.type !== "limite" || x.source.detail !== `${PREFIXE_LIMITE_DU_SUJET}${m.id}` || !m.exception?.valideeParWill || !m.exception.texte) return false;
  const tu = vousVersTu(m.exception.texte);
  if (tu === m.exception.texte) return false;
  return adresse === "tu" ? x.texte === m.exception.texte : x.texte === tu && x.id !== m.exception.matiereId;
}

/** Série vue par la diversité : la 1re version de chacun des 10 derniers sujets écrits. */
async function serieDiversite(sauf?: Id): Promise<{ serie: ElementDiversite[]; intensites: ("douleur" | "gain" | "curiosite")[] }> {
  const d = depots();
  const maitres = (await d.scriptsMaitres.lister((m) => m.id !== sauf && m.numero !== undefined && !m.archiveLe)).sort((a, b) => a.creeLe.localeCompare(b.creeLe)).slice(-10);
  const variantes = versionsCourantes(await d.variantes.lister((v) => maitres.some((m) => m.id === v.scriptMaitreId)));
  const scripts = await d.scripts.lister((s) => maitres.some((m) => m.id === s.scriptMaitreId));
  const serie: ElementDiversite[] = [];
  for (const m of maitres) {
    const v = variantes.find((x) => x.scriptMaitreId === m.id);
    if (!v) continue;
    const script = scripts.find((s) => s.id === v.scriptId);
    const corps = (script?.blocs ?? []).flatMap((b) => b.segments.map((s) => s.texte));
    const texte = texteDesBlocs(assemblerBlocs({ blocs: script?.blocs ?? [] }, v));
    serie.push(elementDiversite({ accroche: v.ouverture[0]?.segments[0]?.texte ?? "", appel: v.appel.texte, boucle: v.boucle ? (v.fin.at(-1)?.segments[0]?.texte ?? "") : "", derniereInfo: corps.at(-1) ?? "", texte, recit: raconteUnClient(corps.join(" ")), intensite: m.angle?.intensite, rupture: m.angle?.rupture as ElementDiversite["rupture"] }));
  }
  return { serie, intensites: maitres.map((m) => m.angle?.intensite).filter((x): x is "douleur" | "gain" | "curiosite" => !!x) };
}

async function donneesDe(m: ScriptMaitre, o: OptionsGeneration): Promise<{ ok: true; donnees: DonneesGeneration; options: OptionsChaine } | { ok: false; manque: NonNullable<ScriptMaitre["manque"]> }> {
  const d = depots();
  const t = maintenant();
  // Le socle de Will (charte, style, textes, preuves, matières) : la même lecture que le tableau animé (`socle-will.ts`).
  const { chargerSocleWill } = await import("./socle-will");
  const [socle, maitres, variantes, videos, publications, tournures] = await Promise.all([
    // Une limite validée pour UN sujet ne sert qu'à lui (vérification E2E n° 1, problème n° 9).
    chargerSocleWill({ estDemo: !!m.estDemo, matieres: (x) => matierePourSujet(x, m.id) && !limiteDUneAutreAdresse(x, m, o.adresse) }),
    d.scriptsMaitres.lister((x) => x.id !== m.id),
    d.variantes.lister(),
    d.videos.lister(),
    d.publications.lister(),
    tournuresActives(),
  ]);
  const { matieres, preuves, contexteAxion: ctx, ficheStyle: fiche, exemplesStyle: exemples } = socle;
  const series: Record<string, ReturnType<typeof historiqueSerie>> = {};
  for (const r of o.reseaux) series[r] = historiqueSerie({ maitres, variantes, videos, publications }, r, 10);
  const { serie, intensites } = await serieDiversite(m.id);
  // Bloc `<gagnants>` mesuré, figé pour la journée (cache 1 h) ; absent tant que l'apprentissage est éteint.
  const mesures = await gagnantsDuJour(o.formatId);
  const gagnants = mesures ? { gagnantsMesures: mesures } : {};
  const z = etapeZero({
    maintenant: t,
    brief: { ...m.brief, formatId: o.formatId, reseaux: o.reseaux, adresseParDefaut: o.adresse },
    mode: o.mode,
    matieres,
    preuves,
    contexteAxion: ctx,
    ficheStyle: fiche,
    exemplesStyle: exemples,
    series,
    sujetsValides: maitres.filter((x) => versionsCourantes(variantes.filter((v) => v.scriptMaitreId === x.id)).some((v) => v.etat === "validee")).length,
    serieDiversite: serie,
    intensitesRecentes: intensites,
    tournures,
    // Apprentissage (éteint par défaut : `undefined` tant que le réglage est faux).
    poidsCorrection: await poidsApprentissage(),
  });
  if (!z.ok) return { ok: false, manque: z.manque };
  // Le choix déjà RÉSERVÉ sur le sujet prime (deux tours de boucle ne retirent pas la combinaison).
  // Dette #242 : la liste GLOBALE des noms sensibles du stock (`chargerSocleWill`) masque le socle : il reste identique
  // d'un sujet à l'autre (cache 1 h partagé), quelle que soit la matière lue pour ce sujet.
  const donnees: DonneesGeneration = { ...(m.choix ? { ...z.donnees, choix: m.choix, combinaisons: m.combinaisonsTransmises?.length ? m.combinaisonsTransmises : [m.choix] } : z.donnees), nomsSensibles: socle.nomsSensibles, ...gagnants };
  const options: OptionsChaine = {
    tournures,
    contexteWill: ctx ? { interdits: ctx.interdits, promessesInterdites: ctx.promessesInterdites, rolesDestinataires: ctx.rolesDestinataires, termesVagues: ctx.termesVagues, jargonInterdit: ctx.jargonInterdit, carnetVoix: ctx.carnetVoix.filter((x) => x.validee).map((x) => x.expression) } : undefined,
    modeChoix: m.brief.modeChoix,
    // Équipe 7 : « Vos hashtags » (Réglages › Mes réseaux), appliqués par le code aux versions.
    hashtags: await lireFamilles(),
  };
  // G6 : dès 5 vidéos mères mesurées, le débit réel du double remplace celui de la recette (B.4.2).
  if (o.mode === "avatar") {
    const { debitRecale } = await import("./fabrication-reseaux");
    const recale = await debitRecale(o.formatId);
    if (recale) options.debit = recale;
  }
  return { ok: true, donnees, options };
}

/* ------------------------------------------------------------------ */
/* Lancement (étape 0, gratuite)                                        */
/* ------------------------------------------------------------------ */

export type ResultatLancement =
  | { ok: true; scriptMaitreId: Id; numero: number; generationId: Id; prixAffiche: Montant; reserve: Montant }
  | { ok: false; scriptMaitreId: Id; manque: NonNullable<ScriptMaitre["manque"]>["type"]; ceQuIlFaudrait: string; reemploiPossible: NonNullable<NonNullable<ScriptMaitre["manque"]>["reemploiPossible"]> };

async function tauxUsdEur(): Promise<number> {
  return lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
}

/**
 * Prix affiché d'un lancement : la réserve maximale (plafond du sujet, B.3.4 n° 8) tant que le p90 n'est pas mesuré en
 * production. `"adresse"` : un supplément qui change d'adresse (« + Tu »), accroches réécrites comprises.
 */
export async function prixLancement(supplement: boolean | "adresse" = false, chaine?: ChaineEcriture): Promise<Montant> {
  return usdVersEur(Math.round((await plafondLancement(supplement, chaine)) * 100), await tauxUsdEur());
}

/**
 * Prix affiché d'une retouche (« Autre accroche », « Plus court », « Améliorer ») : le plafond de la retouche, comme pour
 * un supplément (correcteur 3, B11 : calculé, plus écrit en dur). `regenererVariante` réserve ce même plafond.
 */
export async function prixRetouche(): Promise<Montant> {
  // Le plafond d'une retouche reste fixe (une déclinaison) : jamais le réglage des suppléments.
  return usdVersEur(Math.round(PLAFOND_SUPPLEMENT_USD * 100), await tauxUsdEur());
}

/**
 * Plafond d'un lancement. Correctif après relecture (15/10) : celui d'un sujet est lu du réglage de la chaîne qui l'écrit
 * (`plafondChaineUsd`, défaut 1,50 $), plus en dur. Relecture finale A09 : sur la chaîne COURTE, un supplément a lui
 * aussi le plafond du réglage (son pire cas compte une déclinaison par réseau : 0,70 $ le refusait dès 3 réseaux) ; sur
 * la grande, les suppléments gardent les leurs (`plafondSupplementUsd`, 0,70 / 0,95 $ par défaut).
 */
async function plafondLancement(supplement: boolean | "adresse", chaine?: ChaineEcriture): Promise<number> {
  const c = chaine ?? (await chaineDeLEcriture());
  if (!supplement || c !== "grande") return plafondChaineUsd(c);
  return plafondSupplementUsd(supplement === "adresse");
}

/**
 * Plafonds d'un supplément de la GRANDE chaîne, lus d'un réglage (relecture A09) : « + Je lis », « + Autre format »
 * (0,70 $ par défaut) et « + Tu » (0,95 $). Sans réglage, un supplément refusé au plafond restait sans issue ; le refus
 * nomme maintenant le réglage à relever. Défauts inchangés. Sur la chaîne courte, un supplément a le plafond du sujet.
 */
export const PARAM_PLAFOND_SUPPLEMENT = "generateur.plafondSupplementUsd";
export const PARAM_PLAFOND_SUPPLEMENT_ADRESSE = "generateur.plafondSupplementAdresseUsd";
const reglageSupplement = (adresse: boolean) => (adresse ? PARAM_PLAFOND_SUPPLEMENT_ADRESSE : PARAM_PLAFOND_SUPPLEMENT);

async function plafondSupplementUsd(adresse: boolean): Promise<number> {
  const defaut = adresse ? PLAFOND_SUPPLEMENT_ADRESSE_USD : PLAFOND_SUPPLEMENT_USD;
  const v = await lireParametre<number>(reglageSupplement(adresse), defaut);
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : defaut;
}

/**
 * Réglage qui borne une écriture (et qu'il faut relever si son pire cas le dépasse) : celui de sa chaîne pour un sujet
 * ou pour un supplément de la chaîne courte (`generateur.plafondSujetUsd`), celui du supplément sur la grande ; aucun
 * pour une retouche.
 */
async function reglageDe(g: GenerationScript, o: OptionsGeneration | null): Promise<string | undefined> {
  if (g.portee === "retouche") return undefined;
  const chaine = chaineDe(o ?? {});
  if (g.portee === "sujet" || chaine !== "grande") return reglagePlafond(chaine);
  return o ? reglageSupplement(await changeAdresse(o)) : undefined;
}

/** Réglage de la chaîne de production et chaîne d'une nouvelle écriture : définis à côté du plafond qu'ils choisissent. */
export { chaineDeLEcriture, PARAM_CHAINE };

/** Le supplément change-t-il l'adresse de l'écriture d'où il part (« + Tu » sur un sujet au « vous ») ? */
async function changeAdresse(o: OptionsGeneration): Promise<boolean> {
  if (!o.depuisGenerationId) return false;
  const source = await lireParametre<OptionsGeneration | null>(cleOptions(o.depuisGenerationId), null);
  return !!source && source.adresse !== o.adresse;
}

/**
 * `lancerGeneration(brief)` (B.3.6) : crée le sujet, fait l'étape 0, et soit s'arrête à 0 € (manque, sans numéro),
 * soit réserve le choix et met l'écriture dans la boucle. Rien n'est appelé chez Claude dans cette requête.
 */
export async function lancerGeneration(entree: BriefSujet | { scriptMaitreId: Id }): Promise<ResultatLancement> {
  await exigerSession();
  const m0 = "scriptMaitreId" in entree ? await depots().scriptsMaitres.obtenir(entree.scriptMaitreId) : await creerSujet(entree);
  if (!m0) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  // Lot L5 : un NOUVEAU sujet est recontrôlé sous le verrou, au moment de prendre son numéro (deux demandes simultanées).
  const controle = "scriptMaitreId" in entree ? undefined : { confirmationSujet: entree.confirmationSujet };
  return lancerSurSujet(m0, { mode: m0.brief.modeParDefaut ?? formatGenerateur(m0.brief.formatId).recette.modeParDefaut, adresse: m0.brief.adresseParDefaut, formatId: m0.brief.formatId, reseaux: m0.brief.reseaux }, "sujet", controle);
}

/** Vérif A1 : le chemin d'un texte collé gardé mot pour mot (« Nouvelle vidéo », étape Script, onglet « Coller »). */
export const PHRASE_TEXTE_COLLE = "Votre texte est bien pris. Pour le garder mot pour mot, sans réécriture : « Nouvelle vidéo », étape Script, onglet « Coller ».";

async function lancerSurSujet(m: ScriptMaitre, options: OptionsGeneration, portee: GenerationScript["portee"] = "sujet", controle?: { confirmationSujet?: BriefSujet["confirmationSujet"] }): Promise<ResultatLancement> {
  const d = depots();
  // La chaîne est figée ICI, au lancement : l'écriture finira sur celle-ci.
  const o: OptionsGeneration = { ...options, chaine: await chaineDeLEcriture(m.brief.modeChoix) };
  const z = await donneesDe({ ...m, choix: portee === "sujet" ? undefined : m.choix }, o);
  if (!z.ok) {
    // Vérif A1 (constat du 09/10) : un texte COLLÉ qui ne suffit pas encore à l'écriture : la carte dit aussi comment
    // le garder tel quel (sans réécriture ni matière à ajouter).
    if (["MATIERE_INSUFFISANTE", "ANCRAGE_MANQUANT"].includes(z.manque.type) && estTexteColle(m.brief.phraseWill ?? m.brief.idee) && !z.manque.ceQuIlFaudrait.includes(PHRASE_TEXTE_COLLE)) {
      z.manque = { ...z.manque, ceQuIlFaudrait: `${z.manque.ceQuIlFaudrait} ${PHRASE_TEXTE_COLLE}` };
    }
    await d.scriptsMaitres.modifier(m.id, { manque: z.manque, etat: m.numero === undefined ? "brouillon" : m.etat });
    await journaliser("generateur", `Écriture non lancée, rien n'est payé : ${z.manque.ceQuIlFaudrait}`, { type: "sujet", id: m.id });
    return { ok: false, scriptMaitreId: m.id, manque: z.manque.type, ceQuIlFaudrait: z.manque.ceQuIlFaudrait, reemploiPossible: z.manque.reemploiPossible ?? [] };
  }
  const genre: boolean | "adresse" = portee === "sujet" ? false : (await changeAdresse(o)) ? "adresse" : true;
  // Paquet 4 (D3) : le mode est FIGÉ au lancement (essai tant que Claude n'est pas branché), jusqu'au bout de l'écriture.
  const essai = !(await claudeBranche());
  const generation: GenerationScript = {
    id: nouvelId("gen"),
    scriptMaitreId: m.id,
    hachageContexte: empreinte(JSON.stringify([m.brief, o, z.donnees.choix])),
    plafondUsd: await plafondLancement(genre, o.chaine),
    portee,
    etapes: [],
    statut: "en-cours",
    // Seconde relecture (R3) : `essai: false` explicite pour un lancement réel ; seules les écritures d'avant ce champ
    // n'en ont pas (voir `marquerEcrituresAnciennesEnEssai`).
    essai,
    estDemo: m.estDemo,
    ...horodatage(),
  };
  const doublon = await sousVerrou(async () => {
    // E2E-2 argent n° 12 (F1) : « + Je lis » (ou « Écrire ») touché deux fois, deux onglets : une seule écriture par
    // sujet et par demande. Le contrôle et l'enregistrement (réglages compris) se font d'un seul tenant.
    if (controle && portee === "sujet" && m.numero === undefined) {
      // Lot L5 : le contrôle « sujet déjà traité » est refait ICI, et le numéro est pris dans ce même verrou : deux demandes
      // simultanées sur la même idée ne passent plus toutes les deux. Perdante : son brouillon, vide, est retiré.
      try {
        await controlerSujetCentral({ ...m.brief, estDemo: m.estDemo, origineUsine: m.origineUsine, confirmationSujet: controle.confirmationSujet }, { versionDeSujetId: m.id });
      } catch (e) {
        if (e instanceof ErreurSujetDejaTraite) await d.scriptsMaitres.supprimer(m.id);
        throw e;
      }
    }
    for (const x of await d.generations.lister((y) => y.scriptMaitreId === m.id && y.portee === portee && (y.statut === "en-cours" || y.statut === "en-attente-credit"))) {
      const ox = await lireParametre<OptionsGeneration | null>(cleOptions(x.id), null);
      // Une écriture d'essai n'est pas le doublon d'un lancement réel (et inversement) : Claude relié, on relance en réel.
      if (ox && ox.mode === o.mode && ox.adresse === o.adresse && ox.formatId === o.formatId && ecritureEnEssai(x) === essai) return x;
    }
    await d.generations.enregistrer(generation);
    await ecrireParametre(cleOptions(generation.id), o);
    // Réservation sous verrou : un sujet en écriture compte dans la série (B.3.9 point 9).
    await d.scriptsMaitres.modifier(m.id, {
      choix: z.donnees.choix,
      combinaisonsTransmises: z.donnees.combinaisons,
      ancrages: z.donnees.choix.ancrages,
      etat: "en-ecriture",
      manque: undefined,
      generationId: generation.id,
      brief: { ...m.brief, pilier: z.donnees.sujet.pilier?.id ?? m.brief.pilier },
    } as Partial<ScriptMaitre>);
    if (controle && portee === "sujet") await attribuerNumeroSousVerrou(m.id, { episode: false });
    return null;
  });
  if (doublon) {
    const prix = await prixLancement(genre, chaineDe((await lireParametre<OptionsGeneration | null>(cleOptions(doublon.id), null)) ?? {}));
    return { ok: true, scriptMaitreId: m.id, numero: await attribuerNumero(m.id, { episode: false }), generationId: doublon.id, prixAffiche: prix, reserve: prix };
  }
  // Point du PREMIER APPEL PAYANT : le numéro est pris ici (B.2.4). Relecture finale : l'épisode de la série attend la
  // première étape vraiment payée (`prendreEpisode`) ; un essai ou une attente de crédit n'en consomme aucun.
  const numero = await attribuerNumero(m.id, { episode: false });
  await journaliser("generateur", `n° ${numero} : écriture lancée (${o.reseaux.length} réseau(x))`, { type: "sujet", id: m.id });
  assurerBoucleGeneration();
  const prix = await prixLancement(genre, o.chaine);
  return { ok: true, scriptMaitreId: m.id, numero, generationId: generation.id, prixAffiche: prix, reserve: prix };
}

/* ------------------------------------------------------------------ */
/* La boucle                                                            */
/* ------------------------------------------------------------------ */

const CLE_BOUCLE = Symbol.for("studio-axion-ia.boucle-generation");
interface EtatBoucleGeneration {
  minuterie?: ReturnType<typeof setInterval>;
  enCours: boolean;
  tours: number;
  /** Tests : la boucle n'est jamais démarrée d'elle-même (les tours sont appelés à la main). */
  suspendue?: boolean;
}
type AvecBoucle = typeof globalThis & { [CLE_BOUCLE]?: EtatBoucleGeneration };

export const INTERVALLE_BOUCLE_GENERATION_MS = 4_000;

function etatBoucle(): EtatBoucleGeneration {
  const g = globalThis as AvecBoucle;
  return (g[CLE_BOUCLE] ??= { enCours: false, tours: 0 });
}

/**
 * Démarre la boucle UNE fois par processus (minuterie non bloquante, premier tour immédiat), et SEULEMENT dans l'instance
 * qui tient le verrou de la boucle (relecture paquet 4, exactitude D1) : ailleurs, l'écriture reste en base et l'instance
 * qui tient le verrou la déroule. Jamais deux boucles qui paient le même rôle chez Claude.
 */
export function assurerBoucleGeneration(): void {
  const e = etatBoucle();
  if (e.minuterie || e.suspendue || !verrouBoucleTenu()) return;
  e.minuterie = setInterval(() => {
    // Verrou perdu entre deux tours (filet : `perdu()` arrête déjà la boucle).
    if (!verrouBoucleTenu()) return arreterBoucleGeneration();
    void tourBoucleGeneration();
  }, INTERVALLE_BOUCLE_GENERATION_MS);
  (e.minuterie as { unref?: () => void }).unref?.();
  void tourBoucleGeneration();
}

/** Tests et coupure de secours : plus aucun démarrage automatique (les tours restent appelables à la main). */
export function suspendreBoucleGeneration(suspendue: boolean): void {
  etatBoucle().suspendue = suspendue;
  if (suspendue) arreterBoucleGeneration();
}

export function arreterBoucleGeneration(): void {
  const e = etatBoucle();
  if (e.minuterie) clearInterval(e.minuterie);
  e.minuterie = undefined;
}

/** Exécutant d'une génération : chaque rôle passe par la brique Crédits (`executerRoleFacture`). */
function executeurFacture(generationId: Id, origine?: OrigineLancement): ExecuteurRoles & { facture: true } {
  // L3-0 : l'origine figée au lancement suit l'écriture (jamais perdue à la reprise) ; sans origine, aucun argument de plus.
  return { facture: true, executer: (role, entree) => (origine ? executerRoleFacture(generationId, role, entree, { origine }) : executerRoleFacture(generationId, role, entree)) };
}

/**
 * Un tour : relance des écritures en attente de crédit, puis UNE génération « en-cours » déroulée jusqu'à sa fin, sa
 * pause ou son arrêt. Sans empilement : un tour en cours fait sauter le suivant. Renvoie l'id traité.
 */
export async function tourBoucleGeneration(executeur?: (generationId: Id) => ExecuteurRoles): Promise<Id | null> {
  const e = etatBoucle();
  if (e.enCours) return null;
  e.enCours = true;
  e.tours++;
  let g: GenerationScript | undefined;
  try {
    // Seconde relecture (R3) : à la reprise, une écriture d'avant le champ `essai`, sans étape, passe en essai si Claude
    // n'est pas branché (elle ne partira jamais en réel sans prix ni accord).
    await marquerEcrituresAnciennesEnEssai();
    // Garde-fous budget (15/10) : sans geste de Will, rien ne repart ; les écritures débloquées deviennent « prêtes ».
    await reprendreGenerationsEnAttenteCredit();
    await fermerRetouchesOrphelines();
    const d = depots();
    // E2E-2 argent n° 1 et 2 : seules les écritures que la boucle sait dérouler (un sujet ou un supplément, jamais une
    // retouche), et pas celles qui attendent leur prochain essai après une panne : une écriture coincée ne bloque
    // jamais les autres.
    const t = maintenant();
    const candidates = (await d.generations.lister((x) => x.statut === "en-cours" && !x.simulee && x.portee !== "retouche")).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    const pannes = new Map<Id, PanneEcriture | null>();
    for (const c of candidates) pannes.set(c.id, await lireParametre<PanneEcriture | null>(clePanne(c.id), null));
    // Celles qui viennent de rater passent APRÈS les autres ; celles dont le prochain essai n'est pas venu attendent.
    g = [...candidates.filter((c) => !pannes.get(c.id)), ...candidates.filter((c) => !!pannes.get(c.id))].find((c) => (pannes.get(c.id)?.prochainEssai ?? "") <= t);
    if (!g) return null;
    const origine = (await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null))?.origine;
    try {
      await deroulerGeneration(g, executeur ? executeur(g.id) : executeurFacture(g.id, origine));
    } finally {
      // Le drapeau « Reprendre de Will » (seuil de confirmation levé) ne vaut que pour CE tour.
      await effacerRepriseDeWill(g.id);
    }
    // Relecture finale : l'épisode de la série se prend à la première étape vraiment payée (jamais par un essai).
    const apres = await d.generations.obtenir(g.id);
    if (apres && !ecritureEnEssai(apres) && apres.etapes.some((x) => !!x.termineLe && x.modeleDemande !== "simulation")) await prendreEpisode(g.scriptMaitreId);
    // Une réponse coupée (garde-fous budget, 15/10) laisse son arrêt : il attend « Reprendre l'écriture ».
    if (apres?.statut !== "echec" && (await lireParametre<PanneEcriture | null>(clePanne(g.id), null))) await ecrireParametre(clePanne(g.id), null);
    return g.id;
  } catch (err) {
    // Le message brut de l'exception va en console serveur ; le Journal (un écran) garde une phrase simple.
    console.warn(`[générateur] tour de boucle interrompu : ${(err as Error).message}`);
    // Garde-fous budget (15/10) : la panne arrête l'écriture au premier tour raté (`noterPanne`) ; rien ne repart seul.
    await journaliser("generateur", g ? "Tour de boucle interrompu : l'écriture s'arrête, « Reprendre l'écriture » la relance." : "Tour de boucle interrompu avant toute écriture.");
    if (g) await noterPanne(g, err).catch(() => undefined);
    return g?.id ?? null;
  } finally {
    e.enCours = false;
  }
}

/* ------------------------------------------------------------------ */
/* Pannes de l'écriture (E2E-2 argent n° 1 et 2)                       */
/* ------------------------------------------------------------------ */

const clePanne = (generationId: Id) => `generateur.panne.${generationId}`;

/** Panne d'une écriture : nombre d'essais ratés, raison, prochain essai ; `arretee` : plus aucun essai sans Will. */
export interface PanneEcriture {
  essais: number;
  code: string;
  message: string;
  le: string;
  prochainEssai: string;
  arretee: boolean;
}

/**
 * Garde-fous budget (15/10) : au PREMIER tour raté, l'écriture s'arrête (refus net, Claude muet, coupure) ; elle ne
 * rejoue plus seule une étape peut-être déjà payée. « Reprendre l'écriture » (geste de Will) la relance.
 */
export const PANNES_AVANT_ARRET = 1;
/**
 * Attente avant le prochain essai si une panne n'arrêtait pas l'écriture (`PANNES_AVANT_ARRET` > 1) : aussitôt (mais
 * APRÈS les autres écritures), puis 1 min. Avec `PANNES_AVANT_ARRET = 1`, la première panne l'arrête : aucun essai seul.
 */
export const ATTENTES_PANNE_MS = [0, 60_000];

export async function lirePanneEcriture(generationId: Id): Promise<PanneEcriture | null> {
  return lireParametre<PanneEcriture | null>(clePanne(generationId), null);
}

/** Message à Will, en mots simples, selon la raison de l'arrêt. */
function raisonArret(code: string, essais: number): string {
  if (code === CODE_REFUS_NET) return "Claude refuse cette écriture telle qu'elle est demandée : la réessayer donnerait le même refus.";
  if (code === "CLE_REFUSEE") return "Claude refuse la clé du studio : remplacez-la dans Réglages > Connexions, puis reprenez.";
  return essais > 1 ? `Claude n'a pas répondu ${essais} fois de suite.` : "Claude n'a pas répondu : l'écriture attend votre accord pour reprendre.";
}

/**
 * Un tour raté (garde-fous budget, 15/10) : dès le PREMIER échec (`PANNES_AVANT_ARRET = 1`), et toujours sur un refus
 * net (erreur 400, clé refusée), l'écriture s'arrête : statut « échec », Will est prévenu une fois, la fiche dit pourquoi
 * et propose « Reprendre l'écriture ». Aucun nouvel essai seul. Rien de ce qui est écrit n'est perdu.
 */
async function noterPanne(g: GenerationScript, err: unknown): Promise<void> {
  const d = depots();
  const code = err instanceof ErreurStudio ? err.code : "INCONNU";
  const avant = await lireParametre<PanneEcriture | null>(clePanne(g.id), null);
  const essais = (avant?.essais ?? 0) + 1;
  const arretee = code === CODE_REFUS_NET || code === "CLE_REFUSEE" || essais >= PANNES_AVANT_ARRET;
  const le = maintenant();
  const message = raisonArret(code, essais);
  const prochainEssai = new Date(Date.parse(le) + (ATTENTES_PANNE_MS[essais - 1] ?? ATTENTES_PANNE_MS.at(-1)!)).toISOString();
  await ecrireParametre(clePanne(g.id), { essais, code, message, le, prochainEssai, arretee } satisfies PanneEcriture);
  if (!arretee) return;
  const actuelle = await d.generations.obtenir(g.id);
  if (actuelle?.statut === "en-cours") await d.generations.modifier(g.id, { statut: "echec" });
  const m = await d.scriptsMaitres.obtenir(g.scriptMaitreId);
  if (m && g.portee === "sujet") await d.scriptsMaitres.modifier(m.id, { etat: "echec" });
  console.warn(`[studio] écriture arrêtée : ${code}`);
  await journaliser("generateur", `Écriture arrêtée : ${message}`, { type: "sujet", id: g.scriptMaitreId });
  await creerNotification({
    type: "echec",
    titre: g.portee === "sujet" ? "Une écriture s'est arrêtée" : "Un ajout s'est arrêté",
    message: `« ${m?.angle?.titre ?? m?.brief.idee ?? "Sujet"} » : ${message} Les autres sujets continuent.`,
    lien: `/ecrire/sujets/${g.scriptMaitreId}`,
    estDemo: g.estDemo,
  });
}

/** Écritures arrêtées sur panne que « Reprendre l'écriture » relancerait, avec le relèvement de chacune (dollars). */
async function ecrituresAReprendre(scriptMaitreId: Id): Promise<{ g: GenerationScript; releveUsd: number }[]> {
  const arretees = await depots().generations.lister((g) => g.scriptMaitreId === scriptMaitreId && g.statut === "echec" && g.portee !== "retouche");
  const sortie: { g: GenerationScript; releveUsd: number }[] = [];
  for (const g of arretees) {
    const panne = await lireParametre<PanneEcriture | null>(clePanne(g.id), null);
    if (!panne?.arretee || !(await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null))) continue;
    sortie.push({ g, releveUsd: await releveApresPannesUsd(g.id) });
  }
  return sortie;
}

/** Relecture finale G1 : supplément possible (euros) de la reprise ; nul quand rien n'est relevé. */
async function supplementReprise(liste: { releveUsd: number }[]): Promise<Montant | null> {
  const usd = liste.reduce((t, x) => t + x.releveUsd, 0);
  return usd > 0 ? usdVersEur(Math.ceil(usd * 100), await tauxUsdEur()) : null;
}

const phraseSupplement = (m: Montant) => `Reprendre peut coûter jusqu'à ${formaterMontant(m)} de plus : des appels à Claude restés sans réponse sont peut-être déjà payés, l'écriture refait ces étapes. Confirmez pour continuer.`;

/**
 * Re-relecture A09 : prix que « Reprendre l'écriture » fait confirmer. D'ordinaire le supplément des appels restés sans
 * réponse ; mais si la reprise relève le plafond au réglage (`releverPlafondAuReglage`), c'est TOUT le devis de la reprise
 * sur ce plafond relevé, comme `reprendreEcriture` (même règle pour les deux gestes).
 */
async function prixAConfirmerArretee(liste: { g: GenerationScript; releveUsd: number }[]): Promise<{ montant: Montant; phrase: string } | null> {
  let releveAuReglage = false;
  let prixUsd = 0;
  for (const { g, releveUsd } of liste) {
    const plafond = await plafondRepriseUsd(g);
    if (plafond > g.plafondUsd + 1e-9) releveAuReglage = true;
    prixUsd += (await devisReprise(g, plafond + releveUsd, releveUsd)).prixUsd;
  }
  if (releveAuReglage && prixUsd > 0) {
    const montant = usdVersEur(Math.ceil(prixUsd * 100), await tauxUsdEur());
    return { montant, phrase: `Reprendre peut coûter jusqu'à ${formaterMontant(montant)}. Confirmez pour continuer.` };
  }
  const supplement = await supplementReprise(liste);
  return supplement ? { montant: supplement, phrase: phraseSupplement(supplement) } : null;
}

/**
 * « Reprendre l'écriture » après un arrêt sur panne : elle repart de la dernière étape terminée (rien n'est repayé).
 * RELECTURE FINALE G1 : si la reprise relève le plafond du sujet (pire cas des appels restés sans réponse), ce montant
 * est montré et doit être confirmé (`accord` : centimes d'euro vus par Will) ; un accord ne vaut que pour UN relèvement
 * (les appels relevés sont notés, un nouveau cycle « panne puis reprise » redemande l'accord).
 */
export async function reprendreEcritureArretee(scriptMaitreId: Id, accord?: AccordPrix): Promise<boolean> {
  await exigerSession();
  const d = depots();
  const liste = await ecrituresAReprendre(scriptMaitreId);
  // Correctif après relecture (15/10) : la reprise (après une réponse coupée, une panne) ne part que si son pire cas,
  // RECALCULÉ avec ce qui est déjà dépensé, tient sous le plafond ; sinon le bouton l'a déjà dit, rien ne change ici.
  for (const { g, releveUsd } of liste) {
    const devis = await devisReprise(g, (await plafondRepriseUsd(g)) + releveUsd, releveUsd);
    if (!devis.possible) throw new ErreurStudio("REPRISE_IMPOSSIBLE", devis.raison!);
  }
  const aConfirmer = await prixAConfirmerArretee(liste);
  // Mode indicatif : le prix du jour vaut accord (journal + cloche) ; bloquant : l'accord reçu, inchangé.
  const confirme = aConfirmer ? await accordAutomatique(accordPropre(accord), aConfirmer.montant.centimes) : accordPropre(accord);
  if (aConfirmer && !(typeof confirme === "number" && confirme >= aConfirmer.montant.centimes)) throw new ErreurStudio("CONFIRMATION_REQUISE", aConfirmer.phrase, aConfirmer.montant.centimes);
  const supplement = await supplementReprise(liste);
  const indicatif = await budgetIndicatifPour();
  let n = 0;
  for (const { g, releveUsd } of liste) {
    // CORRECTEUR FINAL A (VERIF-E2E-1 n° 7) : les appels restés sans réponse ne bloquent plus la reprise au plafond.
    // G1 : jamais plus que le relèvement accepté ; plus haut entre-temps → le nouveau prix est redemandé.
    await releverPlafondAuReglage(g);
    // Indicatif : le relèvement du jour est accepté d'office (l'arrêt de sécurité à 5 × reste) ; bloquant : celui que Will a vu.
    const releve = await releverPlafondApresPannes(g.id, indicatif ? Number.POSITIVE_INFINITY : releveUsd);
    if (releve < 0) {
      const nouveau = (await supplementReprise(await ecrituresAReprendre(scriptMaitreId))) ?? supplement!;
      throw new ErreurStudio("CONFIRMATION_REQUISE", phraseSupplement(nouveau), nouveau.centimes);
    }
    await ecrireParametre(clePanne(g.id), null);
    if (releve > 0) await journaliser("generateur", `Reprise acceptée par Will : jusqu'à ${formaterUsd(releve)} $ de plus pour les appels restés sans réponse (ils restent comptés dans le mois).`, { type: "sujet", id: scriptMaitreId });
    await d.generations.modifier(g.id, { statut: "en-cours" });
    if (g.portee === "sujet") await d.scriptsMaitres.modifier(scriptMaitreId, { etat: "en-ecriture" });
    n++;
  }
  if (n) {
    await journaliser("generateur", "Écriture reprise par Will après un arrêt.", { type: "sujet", id: scriptMaitreId });
    assurerBoucleGeneration();
  }
  return n > 0;
}

/** Arrêt sur panne en cours sur ce sujet (la plus récente), pour l'écran. */
export async function ecritureArretee(scriptMaitreId: Id): Promise<{ message: string; portee: GenerationScript["portee"]; supplement?: Montant; bloque?: string } | null> {
  const d = depots();
  const g = (await d.generations.lister((x) => x.scriptMaitreId === scriptMaitreId && x.statut === "echec" && x.portee !== "retouche")).sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
  if (!g) return null;
  const panne = await lireParametre<PanneEcriture | null>(clePanne(g.id), null);
  if (!panne?.arretee) return null;
  // Relecture finale G1 : le supplément possible de la reprise, montré sur le bouton.
  const liste = await ecrituresAReprendre(scriptMaitreId);
  // Re-relecture A09 : le montant montré est celui que le geste fera confirmer (plafond relevé au réglage compris).
  const supplement = (await prixAConfirmerArretee(liste))?.montant;
  // Correctif après relecture (15/10) : si la reprise ne peut pas partir, le bouton dit pourquoi (jamais un prix puis un refus).
  let bloque: string | undefined;
  for (const x of liste) {
    const devis = await devisReprise(x.g, (await plafondRepriseUsd(x.g)) + x.releveUsd, x.releveUsd);
    if (!devis.possible) bloque ??= devis.raison;
  }
  return { message: panne.message, portee: g.portee, ...(supplement ? { supplement } : {}), ...(bloque ? { bloque } : {}) };
}

/* ------------------------------------------------------------------ */
/* « Reprendre (≈ X €) » : prix recalculé, confirmé par le serveur      */
/* ------------------------------------------------------------------ */

/** Ce que coûterait la reprise d'une écriture, au plus, et si elle peut partir (sans aucun appel). */
export interface DevisReprise {
  possible: boolean;
  /** Ce qui reste VRAIMENT à dépenser, au pire prudent, borné par le plafond (dollars). */
  prixUsd: number;
  plafondUsd: number;
  depenseUsd: number;
  /** Écriture en route avant la réserve : contrôle appel par appel, sans réserve. */
  sansReserve: boolean;
  raison?: string;
}

/**
 * Plafond d'une reprise : celui de l'écriture, ou son réglage (`reglageDe`) s'il a été relevé depuis ; une retouche garde
 * le sien.
 */
async function plafondRepriseUsd(g: GenerationScript): Promise<number> {
  if (g.portee === "retouche") return g.plafondUsd;
  const o = await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null);
  const chaine = chaineDe(o ?? {});
  if (g.portee === "sujet" || chaine !== "grande") return Math.max(g.plafondUsd, await plafondChaineUsd(chaine));
  // Supplément de la grande : son réglage, s'il a été relevé depuis (relecture A09).
  return o ? Math.max(g.plafondUsd, await plafondSupplementUsd(await changeAdresse(o))) : g.plafondUsd;
}

/** Au geste de Will, le plafond d'un sujet suit le réglage relevé (le prix montré l'a compté). */
async function releverPlafondAuReglage(g: GenerationScript): Promise<void> {
  const plafond = await plafondRepriseUsd(g);
  if (plafond > g.plafondUsd + 1e-9) {
    await depots().generations.modifier(g.id, { plafondUsd: plafond });
    await journaliser("generateur", `Plafond de l'écriture relevé au réglage : ${formaterUsd(plafond)} $.`, { type: "sujet", id: g.scriptMaitreId });
  }
}

/**
 * Correctif après relecture (15/10) : prix de « Reprendre » = pire cas PRUDENT de ce qui reste à écrire, RECALCULÉ depuis
 * l'état où la chaîne repart (étapes rejouées et retour en arrière compris), borné par ce que le plafond laisse. Même
 * calcul que la réserve du tour suivant (`reserverPireCasChaine`) : si le devis dit « possible », la reprise part ; sinon
 * il dit pourquoi, et aucun prix n'est proposé. Écriture déjà en route sans réserve : ce que le plafond laisse, au plus.
 */
async function devisReprise(g: GenerationScript, plafondUsd: number, releveUsd = 0): Promise<DevisReprise> {
  const depenseUsd = depenseGenerationUsd(g);
  const sansReserve = await ecritureSansReserve(g);
  const base = { plafondUsd, depenseUsd, sansReserve };
  if (ecritureEnEssai(g)) return { ...base, possible: true, prixUsd: 0 };
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(g.scriptMaitreId);
  const o = await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null);
  if (!m || !o) return { ...base, possible: false, prixUsd: 0, raison: "Cette écriture ne peut plus reprendre : son sujet ou ses réglages n'existent plus." };
  // Re-relecture A09 : la MÊME limite que la réserve du tour (`deroulerGeneration`), rangée avant la lecture des matières
  // (idempotent : la limite au « tu » de ce sujet n'est rangée qu'une fois).
  const limite = o.depuisGenerationId ? await limiteSelonAdresse(m, o.adresse) : null;
  const z = await donneesDe(m, o);
  if (!z.ok) return { ...base, possible: false, prixUsd: 0, raison: z.manque.ceQuIlFaudrait };
  const chaine = chaineDe(o);
  const depart = await departDe(g, o, limite);
  const pire = pireCasChaine(chaine, { donnees: z.donnees, options: optionsPireCas(chaine, optionsDeLaChaine(chaine, z), chaine === "courte" && (await memoireCentraleAllumee())), etatDepart: depart ?? undefined }).usd;
  // Mode indicatif (commande de Will) : le plafond du sujet est un repère, le prix ne bloque JAMAIS la reprise (aucune limite).
  const indicatif = await budgetIndicatifPour(o.origine);
  const limiteUsd = indicatif ? Infinity : plafondUsd;
  const reste = Math.max(0, limiteUsd - depenseUsd);
  const reglage = await reglageDe(g, o);
  if (sansReserve) {
    if (reste >= 0.01) return { ...base, possible: true, prixUsd: Math.min(pire, reste) };
    return { ...base, possible: false, prixUsd: 0, raison: `Plafond de l'écriture atteint (${formaterUsd(depenseUsd)} $ utilisés sur ${formaterUsd(plafondUsd)} $) : elle ne peut pas reprendre.${reglage ? ` Relevez le réglage « ${reglage} » pour la reprendre.` : ""}` };
  }
  if (depenseUsd + pire <= limiteUsd + 1e-9) return { ...base, possible: true, prixUsd: Math.min(pire, reste) };
  return { ...base, possible: false, prixUsd: 0, raison: await phrasePireCasTropHaut({ pireCasUsd: depenseUsd + pire, plafondUsd, reglage }, "elle ne peut pas reprendre") };
}

/** Écritures de ce sujet que « Reprendre (≈ X €) » relancerait (crédit, limite du mois, plafond). */
async function ecrituresBloquees(scriptMaitreId: Id): Promise<GenerationScript[]> {
  return (await depots().generations.lister((g) => g.scriptMaitreId === scriptMaitreId && g.portee !== "retouche" && (g.statut === "en-attente-credit" || g.statut === "plafond-atteint"))).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}

/** Reprise vue par l'écran : peut-elle partir maintenant, à quel prix (dollars), sinon pourquoi. */
export interface RepriseAffichee {
  possible: boolean;
  prixUsd: number;
  /** Re-relecture A09 : le prix en centimes d'euro, calculé comme celui que `reprendreEcriture` fait confirmer. */
  centimesEur: number;
  raison?: string;
}

async function repriseAffichee(g: GenerationScript): Promise<Omit<RepriseAffichee, "centimesEur">> {
  if (g.statut === "en-attente-credit" && !(await ecritureDebloquee(g.id))) {
    const abo = await abonnementsClaudeActifs();
    return { possible: false, prixUsd: 0, raison: abo === false && (await lireReglageSourcesClaude()).mode === "abonnements" ? `Pas encore possible : ${MESSAGE_AUCUN_COMPTE_CLAUDE}` : abo ? "Pas encore possible : attendez le renouvellement des comptes Claude, ou relevez la limite du mois ou le seuil, puis reprenez." : "Pas encore possible : rechargez Claude, ou relevez la limite du mois ou le seuil, puis reprenez." };
  }
  const devis = await devisReprise(g, await plafondRepriseUsd(g));
  return devis.possible ? { possible: true, prixUsd: devis.prixUsd } : { possible: false, prixUsd: 0, raison: devis.raison };
}

/**
 * Re-relecture A09 : « Reprendre (≈ X €) » vu par l'écran = la SOMME de toutes les écritures bloquées du sujet, celles
 * que `reprendreEcriture` relance et fait confirmer (même calcul, même arrondi) ; la première qui ne peut pas partir
 * donne sa raison.
 */
export async function devisRepriseDuSujet(scriptMaitreId: Id): Promise<RepriseAffichee> {
  let prixUsd = 0;
  for (const g of await ecrituresBloquees(scriptMaitreId)) {
    const r = await repriseAffichee(g);
    if (!r.possible) return { ...r, centimesEur: 0 };
    prixUsd += r.prixUsd;
  }
  return { possible: true, prixUsd, centimesEur: usdVersEur(Math.ceil(prixUsd * 100), await tauxUsdEur()).centimes };
}

/**
 * « Reprendre (≈ X €) » (geste de Will, correctif après relecture, 15/10) : relance l'écriture de CE sujet bloquée (crédit,
 * limite du mois, plafond). Dans l'ordre, AVANT tout changement : empêchement levé, sinon « Toujours bloquée » ; devis
 * possible, sinon sa raison ; puis le prix montré doit être CONFIRMÉ (`accord`, centimes d'euro), comme
 * `reprendreEcritureArretee` : un prix plus haut que l'accord est redemandé. Renvoie le nombre d'écritures relancées.
 */
export async function reprendreEcriture(scriptMaitreId: Id, accord?: AccordPrix): Promise<number> {
  await exigerSession();
  const liste = await ecrituresBloquees(scriptMaitreId);
  if (!liste.length) return 0;
  let prixUsd = 0;
  for (const g of liste) {
    const r = await repriseAffichee(g);
    if (!r.possible) throw new ErreurStudio(g.statut === "en-attente-credit" && !(await ecritureDebloquee(g.id)) ? "TOUJOURS_BLOQUEE" : "REPRISE_IMPOSSIBLE", r.raison!);
    prixUsd += r.prixUsd;
  }
  const prix = usdVersEur(Math.ceil(prixUsd * 100), await tauxUsdEur());
  const confirme = prix.centimes > 0 ? await accordAutomatique(accordPropre(accord), prix.centimes) : accordPropre(accord);
  if (prix.centimes > 0 && !(typeof confirme === "number" && confirme >= prix.centimes)) throw new ErreurStudio("CONFIRMATION_REQUISE", `Reprendre peut coûter jusqu'à ${formaterMontant(prix)}. Confirmez pour continuer.`, prix.centimes);
  const d = depots();
  let n = 0;
  for (const g of liste) {
    await releverPlafondAuReglage(g);
    if (g.statut === "plafond-atteint") {
      await d.generations.modifier(g.id, { statut: "en-cours" });
      await marquerRepriseDeWill(g.id);
      await journaliser("generateur", `Écriture reprise par Will (au plus ${formaterMontant(prix)}).`, { type: "sujet", id: scriptMaitreId });
      n++;
    }
  }
  if (liste.some((g) => g.statut === "en-attente-credit")) n += (await relancerEcrituresEnAttente(scriptMaitreId)).length;
  if (n) assurerBoucleGeneration();
  return n;
}

/* ------------------------------------------------------------------ */
/* Retouches en vol (E2E-2 argent n° 1)                                 */
/* ------------------------------------------------------------------ */

const CLE_RETOUCHES_EN_VOL = Symbol.for("studio-axion-ia.retouches-en-vol");
type AvecRetouches = typeof globalThis & { [CLE_RETOUCHES_EN_VOL]?: Set<Id> };
function retouchesEnVol(): Set<Id> {
  const g = globalThis as AvecRetouches;
  return (g[CLE_RETOUCHES_EN_VOL] ??= new Set());
}

/**
 * Une retouche se fait PENDANT le geste de Will (`regenererVariante`). Une retouche restée ouverte sans être en vol dans
 * ce processus (coupure avant la fin, redémarrage) n'aboutira jamais : elle est close « échec ». La version d'avant
 * est gardée, et Will peut la relancer d'un toucher.
 */
async function fermerRetouchesOrphelines(): Promise<number> {
  const d = depots();
  const enVol = retouchesEnVol();
  const orphelines = await d.generations.lister((g) => g.portee === "retouche" && (g.statut === "en-cours" || g.statut === "en-attente-credit" || g.statut === "en-pause") && !enVol.has(g.id));
  for (const g of orphelines) {
    await d.generations.modifier(g.id, { statut: "echec" });
    await journaliser("generateur", "Retouche interrompue (coupure ou redémarrage) : la version d'avant est gardée.", { type: "sujet", id: g.scriptMaitreId });
  }
  return orphelines.length;
}

/** Options de la chaîne : la courte et la chaîne « équipe » écrivent une version par réseau du sujet (production). */
function optionsDeLaChaine(chaine: ChaineEcriture, z: { donnees: DonneesGeneration; options: OptionsChaine }): OptionsChaine & { reseaux?: ReseauDeclinaison[] } {
  return chaine !== "grande" ? { ...z.options, reseaux: z.donnees.sujet.reseaux } : z.options;
}

/** Options du pire cas : chaîne courte avec la mémoire centrale allumée, le bloc mémoire maximal est compté (réglage éteint : options inchangées). */
function optionsPireCas<T extends OptionsChaine>(chaine: ChaineEcriture, options: T, memoireAllumee: boolean): T & { memoireAuPire?: boolean } {
  return chaine === "courte" && memoireAllumee ? { ...options, memoireAuPire: true } : options;
}

/** État d'où l'écriture repart (sans aucun appel) : son état sauvé, ou le fond de l'écriture d'où part un supplément. */
async function departDe(g: GenerationScript, o: OptionsGeneration, limite: Awaited<ReturnType<typeof limiteSelonAdresse>> | null): Promise<EtatChaine | null> {
  const depart = await lireEtatChaine(g.id);
  if (depart || !o.depuisGenerationId) return depart;
  // Corps supplémentaire (« + Je lis », « + Tu », « + Autre format ») : même fond, la chaîne repart de l'étape 5.
  const fond = await lireEtatChaine(o.depuisGenerationId);
  if (!fond) return null;
  const source = await lireParametre<OptionsGeneration | null>(cleOptions(o.depuisGenerationId), null);
  const base = { version: 1 as const, coutUsd: 0, journal: [], stratege: fond.stratege, angleRetenu: fond.angleRetenu, fond: fondAvecLimiteValidee(fond.fond, limite) };
  // Chaîne « équipe » : la décision du rédacteur en chef et le fond sont repris (jamais repayés) ; le script et les
  // accroches sont réécrits, dans l'adresse de ce corps. Sans décision du chef dans l'écriture d'origine : tout repart.
  if (chaineDe(o) === "equipe") {
    const equipe = (fond as EtatChaineEquipe).equipe;
    return equipe?.chef ? ({ ...base, etape: 1, equipe: { preparation: equipe.preparation, chef: equipe.chef } } as EtatChaineEquipe) : { ...base, etape: 0 };
  }
  // Chaîne courte : l'angle et le fond sont repris (jamais réécrits ni repayés), seul le script est écrit.
  if (chaineDe(o) === "courte") {
    const change = !!source && source.adresse !== o.adresse;
    // Relecture finale A09 : « + Tu » sur un sujet au « vous » : les accroches sont reprises et le script RÉÉCRIT les
    // finalistes au « tu » (les déclinaisons les reçoivent réécrites) ; contrôle par code : une accroche, une finaliste
    // ou une 1re ligne dans l'autre adresse est refusée (`adresseFautive`).
    if (!change || o.adresse === "tu") return { ...base, etape: 1, accroches: fond.accroches, exclues: fond.exclues, finalistes: fond.finalistes };
    // Vers le « vous » : les accroches sont RÉÉCRITES (appel a), l'angle d'origine gardé.
    return { ...base, etape: 0 };
  }
  // E2E-2 parcours n° 8 : l'adresse change (« + Tu » sur un sujet au « vous ») : les accroches sont RÉÉCRITES dans la
  // bonne adresse (la chaîne repart de l'étape 2 ; les angles et le fond ne sont pas repayés). Sinon elles sont reprises.
  return source && source.adresse !== o.adresse ? { ...base, etape: 2 } : { ...base, etape: 4, accroches: fond.accroches, exclues: fond.exclues, finalistes: fond.finalistes };
}

async function deroulerGeneration(g: GenerationScript, executeur: ExecuteurRoles & { facture?: boolean }): Promise<void> {
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(g.scriptMaitreId);
  const o = await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null);
  if (!m || !o) {
    // Écriture impossible à dérouler (sujet disparu, réglages perdus) : close, elle ne bloque plus la boucle.
    await d.generations.modifier(g.id, { statut: "echec" });
    await journaliser("generateur", "Écriture close : ses réglages ou son sujet n'existent plus.", { type: "sujet", id: g.scriptMaitreId });
    return;
  }
  // La limite validée, dans l'adresse de CE corps (E2E-2 parcours n° 8) : rangée avant la lecture des matières.
  const limite = o.depuisGenerationId ? await limiteSelonAdresse(m, o.adresse) : null;
  const z = await donneesDe(m, o);
  if (!z.ok) {
    await d.generations.modifier(g.id, { statut: "echec" });
    await d.scriptsMaitres.modifier(m.id, { manque: z.manque, etat: "a-completer" });
    return;
  }
  const depart = await departDe(g, o, limite);
  const chaine = chaineDe(o);
  const options = optionsDeLaChaine(chaine, z);
  // Réglage de la mémoire centrale lu UNE fois : sert à la réservation (pire cas) et à la préparation de la mémoire.
  const memoireAllumee = chaine === "courte" && (await memoireCentraleAllumee());
  // Garde-fous budget (15/10, corrigé après relecture) : à CHAQUE tour (lancement, reprise, retour à l'étape 3, manque
  // complété), le pire cas de toute la chaîne restante est recalculé avant le premier appel, dépense déjà faite comprise
  // (écriture payante seulement). Au-dessus du plafond, rien ne part. Une écriture déjà en route sans réserve au moment de
  // la mise en ligne n'est jamais arrêtée au milieu : elle garde le contrôle appel par appel.
  if (executeur.facture && !ecritureEnEssai(g) && (await claudeBranche()) && !(await ecritureSansReserve(g))) {
    const reserve = await reserverPireCasChaine(g.id, { pireCasRestantUsd: pireCasChaine(chaine, { donnees: z.donnees, options: optionsPireCas(chaine, options, memoireAllumee), etatDepart: depart ?? undefined }).usd, etape: depart ? etapeDeDepart(depart) : 0, chaine, reglage: await reglageDe(g, o), indicatif: await budgetIndicatifPour(o.origine) });
    if (!reserve.ok) return;
  }
  // L'aiguillage : la chaîne FIGÉE au lancement (courte en production, « équipe » derrière son réglage, grande derrière le
  // réglage et pour « je choisis »).
  const sauver = async (etat: EtatChaine) => ecrireParametre(cleEtat(g.id), etat);
  // Lot C3 : mémoire commune (réglage `ecriture.memoireCentrale`, coupé par défaut), chaîne courte seulement ; toute panne = sans mémoire.
  const memoire = chaine === "courte" ? await preparerMemoireCentrale({ formatId: z.donnees.sujet.formatId, nomsSensibles: nomsDuSocle(z.donnees), allumee: memoireAllumee }) : null;
  const r = chaine === "equipe" ? await executerChaineEquipe(z.donnees, executeur, options, depart ?? undefined, sauver) : chaine === "courte" ? await executerChaineCourte(z.donnees, executeur, memoire ? { ...options, memoire } : options, depart ?? undefined, sauver) : await executerChaine(z.donnees, executeur, options, depart ?? undefined, sauver);
  // Une sortie inutilisable est un échec TECHNIQUE (pas une matière manquante) : l'état ne garde pas l'arrêt, « Reprendre
  // l'écriture » refait l'étape (rien de ce qui est écrit n'est repayé).
  const sortieInvalide = r.statut === "arretee" && r.etat.arret?.type === "SORTIE_INVALIDE" ? r.etat.arret : null;
  if (sortieInvalide) delete r.etat.arret;
  await ecrireParametre(cleEtat(g.id), r.etat);
  const gen = await d.generations.obtenir(g.id);
  const utiliseUsd = gen ? depenseGenerationUsd(gen) : 0;
  const utilise = usdVersEur(Math.ceil(utiliseUsd * 100), await tauxUsdEur());
  if (r.statut === "terminee") {
    // Relecture finale A09 : une relecture inutilisable est dite (la version gardée est marquée « non relue »).
    if (r.etat.nonRelue) await journaliser("generateur", r.etat.nonRelue, { type: "sujet", id: m.id });
    await rangerSujet(m, g, o, r.etat, z.donnees);
    // Lot C3 : le script accepté entre dans la mémoire commune (réglage coupé : sans effet ; échec : silencieux).
    if (chaine === "courte") {
      const courte = r as Extract<Awaited<ReturnType<typeof executerChaineCourte>>, { statut: "terminee" }>;
      await enregistrerScriptCentral({ texte: texteVersion(courte.etat, courte.version), formatId: z.donnees.sujet.formatId, appels: courte.appels });
    }
    await d.generations.modifier(g.id, { statut: "terminee", simulee: (gen && ecritureEnEssai(gen)) || gen?.etapes.every((x) => x.modeleDemande === "simulation") || undefined });
  } else if (r.statut === "pause") {
    await d.generations.modifier(g.id, { statut: "en-pause" });
  } else if (sortieInvalide) {
    const message = `${sortieInvalide.message} Ce n'est pas une matière qui manque : « Reprendre l'écriture » refait cette étape.`;
    await ecrireParametre(clePanne(g.id), { essais: 1, code: "SORTIE_INVALIDE", message, le: maintenant(), prochainEssai: maintenant(), arretee: true } satisfies PanneEcriture);
    await d.generations.modifier(g.id, { statut: "echec" });
    if (g.portee === "sujet") await d.scriptsMaitres.modifier(m.id, { etat: "echec" });
    await journaliser("generateur", `Écriture arrêtée (réponse inutilisable), rien n'est perdu : ${sortieInvalide.message}`, { type: "sujet", id: m.id });
  } else if (r.statut === "arretee") {
    const a = r.etat.arret!;
    const type = a.type === "PREUVE_MANQUANTE" ? "PREUVE_MANQUANTE" : "ANCRAGE_MANQUANT";
    await d.generations.modifier(g.id, { statut: "en-pause" });
    await d.scriptsMaitres.modifier(m.id, { etat: "a-completer", manque: { type, etape: a.etape, ceQuIlFaudrait: `${a.message} · ${utilise.centimes ? `${(utilise.centimes / 100).toFixed(2).replace(".", ",")} € utilisés, rien n'est perdu, on reprend ici.` : "0 €."}` } });
    await journaliser("generateur", `Écriture mise en pause, rien n'est perdu : ${a.message}`, { type: "sujet", id: m.id });
  } else if (r.statut === "coupee") {
    // Garde-fous budget (15/10) : réponse coupée (`max_tokens`) : arrêt, le texte brut est gardé dans l'état, rien
    // n'est relancé ; « Reprendre l'écriture » (geste de Will) refait l'étape.
    await ecrireParametre(clePanne(g.id), { essais: 1, code: "REPONSE_COUPEE", message: r.message, le: maintenant(), prochainEssai: maintenant(), arretee: true } satisfies PanneEcriture);
    await d.generations.modifier(g.id, { statut: "echec" });
    if (g.portee === "sujet") await d.scriptsMaitres.modifier(m.id, { etat: "echec" });
    await journaliser("generateur", r.message, { type: "sujet", id: m.id });
  }
  // « attente » : le statut a été posé par `executerRoleFacture` (crédit, plafond, modèle) ; la reprise attend le geste
  // de Will (garde-fous budget, 15/10).
}

/* ------------------------------------------------------------------ */
/* Étape 13 : rangement                                                 */
/* ------------------------------------------------------------------ */

async function rangerSujet(m: ScriptMaitre, g: GenerationScript, o: OptionsGeneration, etat: EtatChaine, donnees: DonneesGeneration): Promise<Id[]> {
  const d = depots();
  const format = formatGenerateur(o.formatId);
  const k = etat.corps?.[etat.gagnant ?? 0];
  if (!k?.blocs || !etat.versions?.length) return [];
  const numero = await attribuerNumero(m.id, { episode: !ecritureEnEssai(g) });
  const script: Script = {
    id: nouvelId("script"),
    formatId: format.id,
    versionFormat: format.version,
    sujet: m.brief.idee,
    cible: m.brief.cible,
    adresse: o.adresse,
    version: 1,
    blocs: k.blocs,
    favori: false,
    reference: false,
    statutEditorial: "brouillon",
    ideeId: m.brief.ideeId,
    marqueId: m.marqueId,
    scriptMaitreId: m.id,
    mode: o.mode,
    versionRecette: format.recette.version,
    plan: k.planScript,
    estDemo: m.estDemo,
    ...horodatage(),
  };
  const aCompleter = !!k.limiteProposee || texteDesBlocs(k.blocs).includes("[LIMITE À VALIDER]");
  const nouvelles: VarianteReseau[] = etat.versions.map((v) => varianteDe(v, { m, numero, script, format, o, etat, aCompleter }));
  await sousVerrou(async () => {
    for (const n of nouvelles) {
      const existantes = await d.variantes.lister((x) => x.code === n.code);
      n.version = Math.max(0, ...existantes.map((x) => x.version)) + 1;
      if (existantes.some((x) => !x.archiveLe)) n.parentId = existantes.filter((x) => !x.archiveLe).sort((a, b) => b.version - a.version)[0].id;
    }
    await d.scripts.enregistrer(script);
    for (const n of nouvelles) await d.variantes.enregistrer(n);
  });
  const a = etat.stratege?.angles[etat.angleRetenu ?? 0];
  const f = etat.fond;
  await d.scriptsMaitres.modifier(m.id, {
    etat: undefined,
    manque: undefined,
    angle: a ? { titre: a.titre, promesse: a.promesse, structure: a.structure, sourceAngle: a.sourceAngle, risqueBanal: a.risqueBanal === "faible" ? 0.2 : a.risqueBanal === "moyen" ? 0.5 : 0.8, contrePied: a.contrePied, quiParleConseille: a.quiParleConseille, typeAngle: a.typeAngle, termePivot: a.termePivot, pertinences: a.pertinences, tests: a.tests, probleme: a.probleme, cout: a.cout, issue: a.issue, intensite: a.intensite, rupture: donnees.diversite?.rupture } : m.angle,
    theme: f?.theme,
    motCle: f?.motCle,
    motCleSource: "hypothese",
    emotion: donnees.choix.emotion,
    pointDeVue: donnees.choix.pointDeVue,
    idees: f?.idees,
    appuiPrincipal: f?.appuiPrincipal,
    exception: f && f.exception.source !== "aucune" ? { texte: k.limiteProposee ?? f.exception.texte, source: f.exception.source, matiereId: f.exception.matiereId, preuveId: f.exception.preuveId, valideeParWill: f.exception.source !== "proposition-machine", place: f.exception.place } : m.exception,
    envoi: f ? { destinataire: f.envoi.destinataireRole, phrase: f.envoi.phrase, preuveIds: [], destinataireRole: f.envoi.destinataireRole } : m.envoi,
    livraison: f?.livraison,
    accrochesFinalistes: etat.finalistes,
    criteresPropres: f?.criteresPropres.map((x, i) => ({ id: `BRF-${i + 1}`, texte: x.texte, origine: "role" as const })),
    corps: (etat.corps ?? []).map((x, i) => ({ scriptId: i === (etat.gagnant ?? 0) ? script.id : "", gagnant: i === (etat.gagnant ?? 0), preference: etat.preference ? { ordreAB: etat.preference.ordreAB, ordreBA: etat.preference.ordreBA } : undefined })),
    brief: { ...m.brief, formatsDemandes: [...new Set([...m.brief.formatsDemandes, format.id])] },
  } as Partial<ScriptMaitre>);
  await synchroniserSujet(m.id);
  // Corps supplémentaire écrit APRÈS la validation de la limite : elle entre aussitôt dans le texte et le téléprompteur.
  const apres = await d.scriptsMaitres.obtenir(m.id);
  if (apres?.exception?.valideeParWill && apres.exception.matiereId && apres.exception.texte) await appliquerLimiteValidee(m.id, apres.exception.texte, apres.exception.matiereId);
  await creerNotification({ type: "info", titre: `Vos ${nouvelles.length} versions sont prêtes`, message: `n° ${numero} · ${a?.titre ?? m.brief.idee}`, lien: `/ecrire/sujets/${m.id}`, estDemo: m.estDemo });
  await journaliser("generateur", `n° ${numero} : ${nouvelles.length} version(s) écrite(s), ${etat.coutUsd.toFixed(3)} $`, { type: "sujet", id: m.id });
  void g;
  return nouvelles.map((n) => n.id);
}

function varianteDe(v: VersionEcrite, x: { m: ScriptMaitre; numero: number; script: Script; format: ReturnType<typeof formatGenerateur>; o: OptionsGeneration; etat: EtatChaine; aCompleter: boolean }): VarianteReseau {
  const code = codeVariante({ numero: x.numero, codeFormat: x.format.codeClassement, reseau: v.reseau, mode: x.o.mode, adresse: x.o.adresse });
  const s = v.declinaison;
  const variante: VarianteReseau = {
    id: nouvelId("var"),
    code,
    scriptMaitreId: x.m.id,
    scriptId: x.script.id,
    formatId: x.format.id,
    reseau: v.reseau,
    version: 1,
    versionRecette: x.format.recette.version,
    ouverture: v.ouverture,
    fin: v.fin,
    accrocheId: s.accrocheId,
    motCle: x.etat.fond?.motCle,
    appel: v.appel,
    boucle: v.boucle,
    segmentFacultatifRetenu: v.segmentFacultatifRetenu,
    dureeEstimeeSec: Math.round(v.dureeSec),
    ratios: [x.format.ratioMaitre, ...x.format.ratios.filter((r) => r !== x.format.ratioMaitre)],
    encadre: { texte: s.encadre },
    couverture: { texte: s.couverture, motCle: x.etat.fond?.motCle ?? "" },
    publication: {
      texte: s.publication.texte,
      motsDiese: s.publication.motsDiese,
      premiereLigne: s.publication.premiereLigne,
      sources: [],
      commentaireEpingle: s.publication.commentaireEpingle,
      titres: s.publication.titres && s.publication.titres.length >= 2 ? [s.publication.titres[0], s.publication.titres[1]] : undefined,
      motsClesDeclares: s.publication.motsClesDeclares,
      motsClesBloques: s.publication.motsClesBloques,
      post: s.publication.post ? { ...s.publication.post, forme: "texte" } : undefined,
      rappels: {},
      etiquetteIAPlateforme: false,
      justifications: s.publication.justifications,
      typePublication: s.publication.post ? "video-native" : undefined,
      motCleVariante: s.publication.motCleVariante,
    },
    prompteur: v.prompteur,
    trame: v.trame,
    empreinteCorps: empreinteCorps(x.script.blocs),
    empreinteTexte: "",
    note: { globale: v.note.globale, criteres: v.note.criteres, commentaire: `Note par code (voyant ${v.note.voyant}) ; avis des juges indicatifs.` },
    controles: { passe: !v.violations.some((w) => w.bloquant), violations: v.violations, versionControles: 1, le: maintenant() },
    verdicts: v.verdicts ? { questions: v.verdicts.reponses.filter((r) => r.reponse !== "sans-objet").map((r) => ({ id: r.id, version: 1, reponse: r.reponse === "oui" })), indicatif: true } : undefined,
    etat: x.aCompleter ? "a-completer" : "a-relire",
    estDemo: x.m.estDemo,
    ...horodatage(),
  };
  variante.empreinteTexte = empreinte(texteDesBlocs(assemblerBlocs(x.script, variante)));
  return variante;
}

/* ------------------------------------------------------------------ */
/* Contrat du service (B.3.6), lot G4                                   */
/* ------------------------------------------------------------------ */

/** Sujet en pause ou arrêté : Will ajoute la matière ou la preuve manquante (validée d'office), et l'écriture repart d'où elle s'était arrêtée. */
export async function completerSujet(scriptMaitreId: Id, ajout: { matiere?: Omit<Matiere, "id" | "creeLe" | "modifieLe" | "statut" | "saisiePar">; matiereReprise?: Id; exception?: string }): Promise<ResultatLancement | { ok: true; reprise: true }> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  const imposees = [...(m.brief.matiereIdsImposees ?? [])];
  if (ajout.matiere) {
    const mat: Matiere = { ...ajout.matiere, id: nouvelId("mat"), saisiePar: "will", statut: "validee", estDemo: m.estDemo, ...horodatage() };
    await d.matieres.enregistrer(mat);
    imposees.unshift(mat.id);
  }
  if (ajout.matiereReprise) imposees.unshift(ajout.matiereReprise);
  if (ajout.exception?.trim()) await validerException(m.id, { texte: ajout.exception.trim() });
  await d.scriptsMaitres.modifier(m.id, { brief: { ...m.brief, matiereIdsImposees: [...new Set(imposees)] }, manque: undefined });
  const g = m.generationId ? await d.generations.obtenir(m.generationId) : null;
  const etat = g ? await lireEtatChaine(g.id) : null;
  if (g && etat) {
    // Reprise depuis la dernière étape terminée : l'arrêt est levé, les étapes terminées ne sont pas repayées.
    delete etat.arret;
    if (etat.etape < 6) delete etat.corps;
    await ecrireParametre(cleEtat(g.id), etat);
    await d.generations.modifier(g.id, { statut: "en-cours" });
    await d.scriptsMaitres.modifier(m.id, { etat: "en-ecriture" });
    assurerBoucleGeneration();
    return { ok: true, reprise: true };
  }
  return lancerGeneration({ scriptMaitreId: m.id });
}

/**
 * E2E-2 parcours n° 13 et données n° 4 : une matière dictée depuis la fiche d'un sujet est rangée comme dans « Mes
 * matières » (type choisi ou proposé, preuve d'un cas client ou d'une étude, accord), puis imposée au sujet et
 * l'écriture repart. Un cas client SANS accord est gardé mais ne compte pas : l'écran le dit et propose l'accord.
 */
export async function completerSujetParSaisie(scriptMaitreId: Id, saisie: { texte: string; type?: Matiere["type"]; accord?: boolean }): Promise<{ resultat: ResultatLancement | { ok: true; reprise: true }; matiere: Matiere }> {
  await exigerSession();
  const m = await depots().scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  const { ajouterMatiere } = await import("./matieres");
  const { matiere } = await ajouterMatiere({ texte: saisie.texte, type: saisie.type, accord: saisie.accord, estDemo: m.estDemo });
  return { resultat: await completerSujet(scriptMaitreId, { matiereReprise: matiere.id }), matiere };
}

/** Matières imposées à ce sujet qui attendent l'accord de la personne (elles ne sont pas citées sans lui). */
export async function matieresSansAccord(scriptMaitreId: Id): Promise<Pick<Matiere, "id" | "texte" | "type">[]> {
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  const ids = m?.brief.matiereIdsImposees ?? [];
  if (!ids.length) return [];
  return (await d.matieres.lister((x) => ids.includes(x.id) && !x.archiveLe && !x.retrait && !!x.accord?.requis && !x.accord.obtenu)).map((x) => ({ id: x.id, texte: x.texte, type: x.type }));
}

/** « J'ai son accord » sur la fiche du sujet : l'accord est noté, puis l'écriture repart avec cette matière. */
export async function donnerAccordEtReprendre(scriptMaitreId: Id, matiereId: Id): Promise<ResultatLancement | { ok: true; reprise: true }> {
  await exigerSession();
  const { basculerAccordMatiere } = await import("./matieres");
  await basculerAccordMatiere(matiereId, true);
  return completerSujet(scriptMaitreId, { matiereReprise: matiereId });
}

const EMPLACEMENT_LIMITE = "[LIMITE À VALIDER]";

/**
 * Corps supplémentaire (« + Je lis », « + Tu »…) repris sur le fond d'une écriture précédente : si Will a validé la
 * limite depuis, le fond porte la limite VALIDÉE (source « matiere »), plus la proposition de la machine. Sans cela le
 * plan du nouveau corps est refusé (C30 bis) et l'ajout s'arrête en silence (vérification E2E n° 1, problème n° 1).
 */
function fondAvecLimiteValidee(fond: EtatChaine["fond"], limite: { texte: string; matiereId: Id } | null): EtatChaine["fond"] {
  if (!fond || !limite) return fond;
  return { ...fond, exception: { ...fond.exception, source: "matiere", texte: limite.texte, matiereId: limite.matiereId } };
}

/**
 * Limite validée par Will, dans l'adresse du corps (E2E-2 parcours n° 8). Au « vous » : ses mots, tels quels. Au
 * « tu » : la même phrase au « tu » (`vousVersTu`), rangée comme limite de CE sujet seulement (jamais dans « Mes
 * matières ») pour être citée mot pour mot par la chaîne. Null : pas de limite validée.
 */
async function limiteSelonAdresse(m: ScriptMaitre, adresse: Adresse): Promise<{ texte: string; matiereId: Id } | null> {
  if (!m.exception?.valideeParWill || !m.exception.matiereId || !m.exception.texte) return null;
  const base = { texte: m.exception.texte, matiereId: m.exception.matiereId };
  if (adresse !== "tu") return base;
  const texte = vousVersTu(base.texte);
  if (texte === base.texte) return base;
  const d = depots();
  const detail = `${PREFIXE_LIMITE_DU_SUJET}${m.id}`;
  return sousVerrou(async () => {
    const deja = (await d.matieres.lister((x) => x.type === "limite" && x.texte === texte && x.source.detail === detail))[0];
    if (deja) return { texte, matiereId: deja.id };
    const mat: Matiere = { id: nouvelId("mat"), type: "limite", texte, source: { origine: "dictee", date: maintenant(), detail }, motsCles: [], pilier: m.brief.pilier, saisiePar: "proposee-machine", statut: "validee", estDemo: m.estDemo, ...horodatage() };
    await d.matieres.enregistrer(mat);
    return { texte, matiereId: mat.id };
  });
}

/** Insère la limite dans le corps : à l'emplacement « [LIMITE À VALIDER] », sinon juste après la livraison (ou à la fin du corps). */
export function insererLimite(blocs: BlocScript[], texte: string, matiereId: Id): BlocScript[] {
  const marquer = (g: BlocScript["segments"][number]) => ({ ...g, matiereIds: [...new Set([...(g.matiereIds ?? []), matiereId])], sourceTexte: { matiereId }, marqueurs: [...new Set([...(g.marqueurs ?? []), "exception" as const])] });
  if (texteDesBlocs(blocs).includes(EMPLACEMENT_LIMITE)) return blocs.map((b) => ({ ...b, segments: b.segments.map((g) => (g.texte.includes(EMPLACEMENT_LIMITE) ? marquer({ ...g, texte: g.texte.replace(EMPLACEMENT_LIMITE, texte) }) : g)) }));
  if (texteDesBlocs(blocs).includes(texte)) return blocs;
  const segment = marquer({ id: nouvelId("seg"), texte });
  let ib = -1;
  let is = -1;
  blocs.forEach((b, i) => b.segments.forEach((g, j) => { if (g.marqueurs?.includes("livraison")) { ib = i; is = j; } }));
  if (ib < 0) {
    ib = blocs.length - 1;
    is = (blocs[ib]?.segments.length ?? 0) - 1;
  }
  if (ib < 0) return [{ id: nouvelId("bloc"), blocRecette: "exception", segments: [segment] }];
  return blocs.map((b, i) => (i === ib ? { ...b, segments: [...b.segments.slice(0, is + 1), segment, ...b.segments.slice(is + 1)] } : b));
}

/**
 * La limite validée entre dans le TEXTE commun (nouvelle version du corps, reportée sur les N), dans le TÉLÉPROMPTEUR
 * des versions « je lis » et dans la case LIMITE de la trame. Les versions « à compléter » faute de limite repassent
 * « à relire ».
 */
async function appliquerLimiteValidee(scriptMaitreId: Id, texte: string, matiereId: Id): Promise<void> {
  const d = depots();
  const courantes = () => d.variantes.lister((x) => x.scriptMaitreId === scriptMaitreId && !x.archiveLe).then(versionsCourantes);
  // État de chaque version AVANT l'insertion : une version pas encore validée reste « à relire » (le report du corps la
  // passerait « à revoir » et « Valider les N » ne la prendrait plus) ; une version déjà validée est à revoir.
  const etatAvant = new Map((await courantes()).map((v) => [v.code, v.etat] as const));
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  // E2E-2 parcours n° 8 : dans un corps au « tu », la limite entre au « tu ».
  const selon = async (adresse: Adresse | undefined) => (adresse === "tu" && m ? ((await limiteSelonAdresse({ ...m, exception: { ...(m.exception ?? { place: "apres-livraison" as const, source: "matiere" as const }), texte, matiereId, valideeParWill: true } }, "tu")) ?? { texte, matiereId }) : { texte, matiereId });
  for (const sid of [...new Set((await courantes()).map((v) => v.scriptId))]) {
    const s = await d.scripts.obtenir(sid);
    if (!s) continue;
    const l = await selon(s.adresse);
    const blocs = insererLimite(s.blocs, l.texte, l.matiereId);
    if (JSON.stringify(blocs) === JSON.stringify(s.blocs)) continue;
    // Sans `exigerSession` : appelé aussi par la boucle (corps supplémentaire rangé après la validation).
    const nouveau: Script = { ...s, id: nouvelId("script"), version: s.version + 1, parentId: s.id, blocs, statutEditorial: "brouillon", creePourVideoId: undefined, ...horodatage() };
    await d.scripts.enregistrer(nouveau);
    await reporterCorps(nouveau.id);
  }
  for (const v of await courantes()) {
    const s = await d.scripts.obtenir(v.scriptId);
    const patch: Partial<VarianteReseau> = {};
    if (v.prompteur !== undefined && s) patch.prompteur = miseEnFormePrompteur(assemblerBlocs(s, v));
    if (v.trame) patch.trame = { ...v.trame, casesWill: { ...v.trame.casesWill, limite: await selon(s?.adresse) } };
    const avant = etatAvant.get(v.code);
    if (v.etat === "a-completer" || (v.etat === "a-reverifier" && (avant === "a-relire" || avant === "a-completer"))) patch.etat = "a-relire";
    if (Object.keys(patch).length) await d.variantes.modifier(v.id, patch);
  }
  await synchroniserSujet(scriptMaitreId);
}

/**
 * Limite proposée par la machine : « C'est juste » (un toucher) ou corrigée au micro. La limite est gardée pour CE sujet
 * seulement (jamais rangée dans « Mes matières » comme une dictée de Will, jamais reprise seule au sujet suivant),
 * validée, puis insérée dans le texte, le téléprompteur et la trame des N versions.
 */
export async function validerException(scriptMaitreId: Id, choix: "c-est-juste" | { texte: string }): Promise<void> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  const texte = choix === "c-est-juste" ? m.exception?.texte : choix.texte.trim();
  if (!texte) throw new ErreurStudio("LIMITE_VIDE", "Dites la limite en une phrase.");
  const mat: Matiere = {
    id: nouvelId("mat"),
    type: "limite",
    texte,
    source: { origine: "dictee", date: maintenant(), detail: `${PREFIXE_LIMITE_DU_SUJET}${m.id}` },
    motsCles: [],
    pilier: m.brief.pilier,
    saisiePar: choix === "c-est-juste" ? "proposee-machine" : "will",
    statut: "validee",
    estDemo: m.estDemo,
    ...horodatage(),
  };
  await d.matieres.enregistrer(mat);
  await d.scriptsMaitres.modifier(m.id, { exception: { ...(m.exception ?? { place: "apres-livraison" as const }), texte, source: "matiere", matiereId: mat.id, valideeParWill: true } });
  await appliquerLimiteValidee(m.id, texte, mat.id);
}

/** « Je choisis » : l'angle retenu par Will (pause après l'étape 1). */
export async function choisirAngle(scriptMaitreId: Id, index: number): Promise<void> {
  await reprendreAvecChoix(scriptMaitreId, (e) => ({ ...e, choixWill: { ...e.choixWill, angle: index }, angleRetenu: index }));
}

/** « Je choisis » : les accroches finalistes retenues par Will, dans son ordre (pause après l'étape 4). */
export async function choisirAccroches(scriptMaitreId: Id, accrocheIds: string[]): Promise<void> {
  if (!accrocheIds.length) throw new ErreurStudio("AUCUNE_ACCROCHE", "Choisissez au moins une accroche.");
  await reprendreAvecChoix(scriptMaitreId, (e) => ({ ...e, choixWill: { ...e.choixWill, accrocheIds }, etape: Math.min(e.etape, 3) }));
}

async function reprendreAvecChoix(scriptMaitreId: Id, changer: (e: EtatChaine) => EtatChaine): Promise<void> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  const g = m?.generationId ? await d.generations.obtenir(m.generationId) : null;
  const etat = g ? await lireEtatChaine(g.id) : null;
  if (!g || !etat) throw new ErreurStudio("PAS_DE_PAUSE", "Cette écriture n'attend pas de choix.");
  await ecrireParametre(cleEtat(g.id), changer(etat));
  await d.generations.modifier(g.id, { statut: "en-cours" });
  assurerBoucleGeneration();
}

/** « + Autre format », « + Je lis », « + Tu » : un corps supplémentaire sur le même fond (prix affiché sur le bouton). */
export async function ajouterDeclinaison(scriptMaitreId: Id, options: { formatId?: string; mode?: ModeDiction; adresse?: Adresse; reseaux?: ReseauDeclinaison[] }): Promise<ResultatLancement> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  if (m.numero === undefined || !m.generationId) return lancerGeneration({ scriptMaitreId });
  const formatId = options.formatId ?? m.brief.formatId;
  const format = formatGenerateur(formatId);
  const mode = options.mode ?? m.brief.modeParDefaut ?? format.recette.modeParDefaut;
  if (!format.recette.modesDiction.includes(mode)) throw new ErreurStudio("QUI_PARLE", "Ce type de vidéo ne se tourne pas de cette façon.");
  const o: OptionsGeneration = { formatId, mode, adresse: options.adresse ?? m.brief.adresseParDefaut, reseaux: format.declinaison === "aucune" ? (options.reseaux ?? m.brief.reseaux).slice(0, 1) : (options.reseaux ?? m.brief.reseaux), depuisGenerationId: m.generationId };
  const r = await lancerSurSujet(m, o, formatId === m.brief.formatId ? "corps-supplementaire" : "format-supplementaire");
  return r;
}

/** Plafond de retouches payantes par version (vérification E2E n° 1, n° 20) : au-delà, corriger une phrase (gratuit). */
export const RETOUCHES_MAX_PAR_VERSION = 5;
export const cleRetouches = (code: string) => `generateur.retouches.${code}`;

/** Voyant « Corps court » (contrôle C12) : « Plus court » n'a plus de sens sur cette version. Une phrase courte ou un appel court n'y comptent pas. */
export const estCorpsCourt = (x: { controle: string }): boolean => x.controle === "C12";

/** Retouche d'une version : « autre accroche », « plus court », « améliorer » ; l'ancienne version est gardée. */
export async function regenererVariante(varianteId: Id, demande: "autre-accroche" | "plus-court" | "ameliorer", executeur?: ExecuteurRoles): Promise<VarianteReseau> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (demande === "plus-court" && v.controles.violations.some(estCorpsCourt)) throw new ErreurStudio("DEJA_COURTE", "Cette version est déjà courte : « Plus court » n'est pas proposé.");
  const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
  if (!m?.generationId) throw new ErreurStudio("SANS_ECRITURE", "Cette version n'a pas été écrite par le générateur.");
  // E2E-2 parcours n° 8 : la retouche part de l'écriture de CETTE version (son adresse, ses accroches), pas de la
  // dernière écriture du sujet (une version au « vous » ne reçoit pas les accroches du « + Tu »).
  const origine = await generationDeLaVersion(m.id, v, m.generationId);
  const etat = await lireEtatChaine(origine);
  const o = await lireParametre<OptionsGeneration | null>(cleOptions(origine), null);
  if (!etat || !o) throw new ErreurStudio("SANS_ECRITURE", "L'écriture d'origine n'est plus disponible.");
  const z = await donneesDe(m, o);
  if (!z.ok) throw new ErreurStudio(z.manque.type, z.manque.ceQuIlFaudrait);
  const g: GenerationScript = { id: nouvelId("gen"), scriptMaitreId: m.id, hachageContexte: empreinte(`${v.id}:${demande}`), plafondUsd: PLAFOND_SUPPLEMENT_USD, portee: "retouche", etapes: [], statut: "en-cours", essai: !(await claudeBranche()), estDemo: m.estDemo, ...horodatage() };
  // E2E-2 argent n° 11 (B3) : la place dans le plafond des 5 retouches est PRISE sous verrou avant l'appel (des envois
  // simultanés ne la lisent plus tous libre), avec l'enregistrement de la retouche (jamais « en cours » hors du vol).
  await sousVerrou(async () => {
    const faites = await lireParametre<number>(cleRetouches(v.code), 0);
    if (faites >= RETOUCHES_MAX_PAR_VERSION) throw new ErreurStudio("PLAFOND_RETOUCHES", `${RETOUCHES_MAX_PAR_VERSION} retouches déjà faites sur cette version : corrigez une phrase à la main (gratuit) ou gardez-la.`);
    await ecrireParametre(cleRetouches(v.code), faites + 1);
    retouchesEnVol().add(g.id);
    await d.generations.enregistrer(g);
  });
  // E2E-2 argent n° 1 : quoi qu'il arrive (coupure, Claude indisponible, attente de crédit), la retouche se FERME
  // (« terminée » ou « échec ») et ne reste jamais « en cours » : la boucle d'écriture ne retombe plus dessus.
  let nv: VersionEcrite | null = null;
  let arret: string | null = null;
  try {
    nv = await redeclinerVersion(z.donnees, etat, v.reseau, executeur ?? executeurFacture(g.id), demande, { accroche: v.ouverture[0]?.segments[0]?.texte ?? "", dureeSec: v.dureeEstimeeSec }, z.options);
  } catch (e) {
    if (e instanceof ErreurStudio && e.code === "CLAUDE_INDISPONIBLE") throw new ErreurStudio("RETOUCHE_INTERROMPUE", "Claude n'a pas répondu : la retouche n'a pas abouti et la version d'avant est gardée. Réessayez dans un instant.");
    if (e instanceof ErreurStudio) throw e;
    // Attente de crédit, plafond, modèle : rien n'est parti pour cet appel (message de la brique Crédits).
    if (e instanceof Error && "arret" in e) arret = e.message;
    else throw e;
  } finally {
    retouchesEnVol().delete(g.id);
    const fin = await d.generations.obtenir(g.id);
    if (fin && fin.statut !== "terminee") await d.generations.modifier(g.id, { statut: nv ? "terminee" : "echec" });
    // Une retouche qui ne donne rien et n'a rien payé ne compte pas dans les 5 ; une retouche payée compte toujours.
    if (!nv && (!fin || depenseGenerationUsd(fin) === 0)) {
      await sousVerrou(async () => ecrireParametre(cleRetouches(v.code), Math.max(0, (await lireParametre<number>(cleRetouches(v.code), 1)) - 1)));
    }
  }
  if (arret) throw new ErreurStudio("RETOUCHE_EN_ATTENTE", `La retouche n'est pas partie : ${arret} La version d'avant est gardée.`);
  if (!nv) throw new ErreurStudio("RETOUCHE_IMPOSSIBLE", "La retouche n'a rien donné : la version d'avant est gardée.");
  return retoucherVariante(v.id, {
    ouverture: nv.ouverture,
    fin: nv.fin,
    encadre: { texte: nv.declinaison.encadre },
    publication: { texte: nv.declinaison.publication.texte, premiereLigne: nv.declinaison.publication.premiereLigne, motsDiese: nv.declinaison.publication.motsDiese, justifications: nv.declinaison.publication.justifications, motCleVariante: nv.declinaison.publication.motCleVariante },
  });
}

/** Écriture terminée dont vient une version : même format, même adresse, même façon de dire (la plus récente). */
async function generationDeLaVersion(scriptMaitreId: Id, v: VarianteReseau, parDefaut: Id): Promise<Id> {
  const d = depots();
  const s = await d.scripts.obtenir(v.scriptId);
  const gens = (await d.generations.lister((g) => g.scriptMaitreId === scriptMaitreId && g.portee !== "retouche" && g.statut === "terminee")).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  for (const g of gens) {
    const o = await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null);
    if (o && o.formatId === v.formatId && (!s?.adresse || o.adresse === s.adresse) && (!s?.mode || o.mode === s.mode)) return g.id;
  }
  return parDefaut;
}

/** Texte retouché à la main dans l'écran : ouverture et fin dans la version, le corps dans le texte commun (reporté sur les N). */
export async function enregistrerRetouche(varianteId: Id, blocs: BlocScript[]): Promise<VarianteReseau> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  const { ouverture, corps, fin } = repartirBlocs(blocs, formatGenerateur(v.formatId).recette.partiesDeclinaison);
  const script = await d.scripts.obtenir(v.scriptId);
  if (script && empreinteCorps(corps) !== empreinteCorps(assemblerBlocs(script, { ...v, ouverture: [], fin: [] }))) await retoucherCorps(script.id, corps);
  const courante = (await d.variantes.lister((x) => x.code === v.code)).reduce((a, b) => (b.version > a.version ? b : a));
  return retoucherVariante(courante.id, { ouverture, fin });
}

/** « Valider les N » : exige la limite validée par Will quand la machine l'a proposée (C30). */
export async function validerVariantes(varianteIds: Id[]): Promise<number> {
  await exigerSession();
  const d = depots();
  const sujets = new Set((await Promise.all(varianteIds.map((id) => d.variantes.obtenir(id)))).filter((x): x is VarianteReseau => !!x).map((v) => v.scriptMaitreId));
  for (const id of sujets) {
    const m = await d.scriptsMaitres.obtenir(id);
    if (m?.exception && m.exception.source === "proposition-machine" && !m.exception.valideeParWill) throw new ErreurStudio("LIMITE_A_VALIDER", "Validez d'abord la limite proposée (un toucher).");
  }
  return validerVersions(await suivreInsertionLimite(varianteIds));
}

/**
 * « Valider les N » touché avec les versions d'AVANT la validation de la limite (écran pas encore rafraîchi) : chaque
 * version remplacée UNIQUEMENT par l'insertion de la limite validée est suivie jusqu'à sa remplaçante. Toute autre
 * version remplacée (retouche, corps modifié) n'est pas suivie : Will doit voir le texte qu'il valide.
 */
async function suivreInsertionLimite(varianteIds: Id[]): Promise<Id[]> {
  const d = depots();
  const portentLimite = async (scriptId: Id, matiereId: Id) => (await d.scripts.obtenir(scriptId))?.blocs.some((b) => b.segments.some((g) => g.matiereIds?.includes(matiereId))) ?? false;
  const ids: Id[] = [];
  for (const id of varianteIds) {
    const v = await d.variantes.obtenir(id);
    const m = v ? await d.scriptsMaitres.obtenir(v.scriptMaitreId) : null;
    const matiereId = m?.exception?.valideeParWill ? m.exception.matiereId : undefined;
    const suite = v && matiereId ? (await d.variantes.lister((x) => x.parentId === v.id && x.code === v.code && !x.archiveLe))[0] : undefined;
    ids.push(suite && matiereId && !(await portentLimite(v!.scriptId, matiereId)) && (await portentLimite(suite.scriptId, matiereId)) ? suite.id : id);
  }
  return [...new Set(ids)];
}

/* ------------------------------------------------------------------ */
/* Fabrication intérimaire (avant G6)                                   */
/* ------------------------------------------------------------------ */

const cleOperation = (operationId: string) => `generateur.fabrication.${operationId}`;

/**
 * `fabriquerVariante` (intérim G4) : le texte assemblé de la version devient le texte d'une vidéo (point d'entrée public
 * de fabrication, voix et prononciations existantes), rattachée à la version (`reseau`, `varianteId`). Le pré-vol de la
 * brique Crédits est celui de `lancerFabrication`. Un identifiant d'opération rend le double toucher inoffensif.
 */
export async function fabriquerVariante(varianteId: Id, options: { operationId: string; lancer: boolean; prixConfirme?: AccordPrix }): Promise<{ videoId: Id; travailId?: Id; enAttente?: string }> {
  await exigerSession();
  const deja = await lireParametre<{ videoId: Id; travailId?: Id } | null>(cleOperation(options.operationId), null);
  if (deja) return deja;
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.etat !== "validee") throw new ErreurStudio("A_VALIDER", "Validez d'abord cette version.");
  if (options.lancer && !v.videoId) {
    // E2E-2 parcours n° 2 (fonction du correcteur argent) : budget, crédit et clé vérifiés AVANT toute création ; un
    // refus remonte tel quel et rien n'est créé.
    const { verifierAvantDeCreer } = await import("./fabrication-reseaux");
    // CORRECTEUR 1 — B6 : au-delà du seuil, la confirmation du prix vient de l'écran.
    await verifierAvantDeCreer([v.id], { confirme: accordPropre(options.prixConfirme) });
  }
  const resultat = await sousVerrou(async (): Promise<{ videoId: Id; travailId?: Id; cree: boolean }> => {
    const encore = await lireParametre<{ videoId: Id; travailId?: Id } | null>(cleOperation(options.operationId), null);
    if (encore) return { ...encore, cree: false };
    const actuelle = await d.variantes.obtenir(v.id);
    if (actuelle?.videoId) return { videoId: actuelle.videoId, cree: false };
    const script = await d.scripts.obtenir(v.scriptId);
    const blocs = assemblerBlocs({ blocs: script?.blocs ?? [] }, v);
    const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
    const assemble: Script = { ...(script as Script), id: nouvelId("script"), blocs, version: 1, parentId: undefined, creePourVideoId: undefined, sujet: m?.angle?.titre ?? script?.sujet ?? "", statutEditorial: "valide", ...horodatage() };
    await d.scripts.enregistrer(assemble);
    const videoId = await brouillonDeVersion(v.id, v.formatId, assemble.id, v.reseau);
    await d.scripts.modifier(assemble.id, { creePourVideoId: videoId });
    await rattacherVideoAVariante(videoId, v.id);
    // E2E-2 parcours n° 31 : même titre que les vidéos de « Fabriquer les N » (« 0001-AV-TT-T · sujet »).
    await d.videos.modifier(videoId, { titre: `${v.code} · ${assemble.sujet || "version"}` });
    const r = { videoId };
    await ecrireParametre(cleOperation(options.operationId), r);
    return { ...r, cree: true };
  });
  if (!options.lancer || resultat.travailId) return { videoId: resultat.videoId, travailId: resultat.travailId };
  // Lancement par le chemin sûr du correcteur argent : un refus de budget ou de crédit arrivé ENTRE la vérification et
  // le lancement ne lève pas : la vidéo « attend du crédit » et partira d'elle-même (la raison est rendue).
  const { lancerVideoDeVersion } = await import("./fabrication-reseaux");
  let t: { travailId?: Id; enAttente?: string };
  try {
    // Paquet 4 (D2) : le montant confirmé a été contrôlé juste avant la création (`verifierAvantDeCreer`) ; il repart
    // tel quel (seconde relecture, R2 : `true` ne couvre plus un prix au-delà du seuil).
    t = await lancerVideoDeVersion(resultat.videoId, accordPropre(options.prixConfirme));
  } catch (e) {
    // E2E-2 parcours n° 2 : un lancement REFUSÉ (budget du mois, crédit insuffisant…) ne laisse pas de brouillon
    // rattaché à la version (la ligne n'offrait plus que « Vidéo », grisée sans raison) : la version redevient
    // « à fabriquer », la raison remonte telle quelle à l'écran, et un nouveau toucher repart proprement.
    if (resultat.cree) await defaireBrouillonDeVersion(v.id, resultat.videoId, options.operationId);
    throw e;
  }
  const fin = { videoId: resultat.videoId, travailId: t.travailId };
  if (t.travailId) await ecrireParametre(cleOperation(options.operationId), fin);
  return { ...fin, enAttente: t.enAttente };
}

const cleBrouillonDeVersion = (varianteId: Id) => `generateur.brouillon-de-version.${varianteId}`;

/**
 * Brouillon de la vidéo d'une version : celui d'un lancement refusé plus tôt est REPRIS (désarchivé) plutôt qu'un
 * nouveau à chaque toucher : rien n'est effacé, rien ne s'accumule.
 */
async function brouillonDeVersion(varianteId: Id, formatId: string, scriptId: Id, reseau: IdReseau): Promise<Id> {
  const d = depots();
  const ancien = await lireParametre<Id | null>(cleBrouillonDeVersion(varianteId), null);
  const video = ancien ? await d.videos.obtenir(ancien) : null;
  // Formats par réseau T5 : la version dans le format de SON réseau, par la règle même du prix de `verifierAvantDeCreer` (sauf formats exclus de T5 : l'avocat)
  // (`ratiosDeLaVersion`), pour un brouillon neuf comme pour un brouillon REPRIS (créé avant T5 en 9:16 seul : il
  // reçoit le 4:5 que le prix a annoncé).
  const { ratiosDeLaVersion } = await import("./fabrication-reseaux");
  const ratios = await ratiosDeLaVersion({ formatId, reseau });
  // Un brouillon mis à la corbeille par Will n'est jamais repris (il resterait invisible tout en étant fabriqué et payé) :
  // un nouveau brouillon est créé, l'ancien reste à la corbeille.
  if (video && video.statut === "archivee" && video.statutAvantArchive === "brouillon" && !video.corbeilleLe) {
    await d.videos.modifier(video.id, { statut: "brouillon", statutAvantArchive: undefined, scriptId, ratios });
    await ecrireParametre(cleBrouillonDeVersion(varianteId), null);
    return video.id;
  }
  const { creerBrouillon } = await import("./videos");
  return creerBrouillon(formatId, { scriptId, reseaux: [reseau], ratios });
}

/** Lancement refusé : la version est détachée de son brouillon, rangé aux archives (jamais effacé) pour être repris. */
async function defaireBrouillonDeVersion(varianteId: Id, videoId: Id, operationId: string): Promise<void> {
  const d = depots();
  await sousVerrou(async () => {
    const v = await d.variantes.obtenir(varianteId);
    if (v?.videoId === videoId) await d.variantes.modifier(varianteId, { videoId: undefined });
    const video = await d.videos.obtenir(videoId);
    if (video?.statut === "brouillon") await d.videos.modifier(videoId, { statut: "archivee", statutAvantArchive: "brouillon", varianteId: undefined });
    await ecrireParametre(cleBrouillonDeVersion(varianteId), videoId);
    await ecrireParametre(cleOperation(operationId), null);
  });
  if (await d.variantes.obtenir(varianteId)) await synchroniserSujet((await d.variantes.obtenir(varianteId))!.scriptMaitreId);
}

/* ------------------------------------------------------------------ */
/* Lecture pour l'écran d'attente                                       */
/* ------------------------------------------------------------------ */

export const LIBELLES_ETAPES: Readonly<Record<number, string>> = { 0: "Préparation", 1: "Les angles", 2: "Le fond", 3: "Les accroches", 4: "Le tri des accroches", 6: "Le plan", 8: "Le texte", 9: "La relecture", 10: "Les corrections", 12: "Les versions par réseau" };
/** Étapes de la chaîne courte (état sauvé après chacune : la progression avance à chaque appel). */
export const LIBELLES_ETAPES_COURTE: Readonly<Record<number, string>> = { 0: "Préparation", 1: "L'angle et les accroches", 2: "Le script", 3: "La relecture", 4: "Les versions par réseau" };
/** Étapes de la chaîne « équipe ». */
export const LIBELLES_ETAPES_EQUIPE: Readonly<Record<number, string>> = { 0: "Préparation", 1: "Le rédacteur en chef", 2: "Le script", 3: "Les accroches", 4: "La relecture", 5: "Les versions par réseau" };

export async function etatEcriture(scriptMaitreId: Id): Promise<{ statut: GenerationScript["statut"] | null; etape: number; libelle: string; etapes?: number[]; utiliseUsd: number; pause?: EtatChaine["pause"]; angles?: { titre: string; probleme: string }[]; accroches?: { id: string; dit: string; famille: string }[]; medianeSec: number | null; essai: boolean; attenteSeuil: string | null; messageAttente: string | null; messagePlafond: string | null; preteAReprendre: boolean; reprise: RepriseAffichee | null; abonnements: boolean; aucunCompte: boolean } | null> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m?.generationId) return null;
  const g = await d.generations.obtenir(m.generationId);
  if (!g) return null;
  const e = await lireEtatChaine(g.id);
  const etape = e?.etape ?? 0;
  const o = await lireParametre<OptionsGeneration | null>(cleOptions(g.id), null);
  const chaine = chaineDe(o ?? {});
  const courte = chaine !== "grande";
  const libelles = chaine === "equipe" ? LIBELLES_ETAPES_EQUIPE : courte ? LIBELLES_ETAPES_COURTE : LIBELLES_ETAPES;
  const prochaine = Object.keys(libelles).map(Number).find((n) => n > etape) ?? Math.max(...Object.keys(libelles).map(Number));
  const durees = (await d.generations.lister((x) => x.statut === "terminee" && !x.simulee)).map((x) => (Date.parse(x.modifieLe) - Date.parse(x.creeLe)) / 1000).filter((x) => x > 0).sort((a, b) => a - b);
  const abonnements = await abonnementsClaudeActifs();
  const aucunCompte = (await lireReglageSourcesClaude()).mode === "abonnements" && !abonnements;
  return {
    statut: g.statut,
    etape,
    libelle: libelles[prochaine] ?? "Écriture",
    // Chaînes courte et « équipe » : leurs étapes (la barre de l'écran suit chaque appel) ; grande chaîne : celles de l'écran.
    etapes: courte ? Object.keys(libelles).map(Number).filter((n) => n > 0) : undefined,
    utiliseUsd: depenseGenerationUsd(g),
    pause: e?.pause,
    angles: e?.pause?.raison === "choisir-angle" ? e.stratege?.angles.map((a) => ({ titre: a.titre, probleme: a.probleme })) : undefined,
    accroches: e?.pause?.raison === "choisir-accroches" ? e.accroches?.map((a) => ({ id: a.id, dit: a.dit, famille: a.famille })) : undefined,
    medianeSec: durees.length ? durees[Math.floor(durees.length / 2)] : null,
    essai: ecritureEnEssai(g),
    attenteSeuil: g.statut === "en-attente-credit" ? await phraseAttenteSeuil(g.id) : null,
    messageAttente: g.statut === "en-attente-credit" ? aucunCompte ? MESSAGE_AUCUN_COMPTE_CLAUDE : await phraseAttenteCredit(g.id, abonnements) : null,
    // Garde-fous budget (15/10) : refus avant tout appel (prix au pire), reprise au geste de Will avec son prix.
    messagePlafond: g.statut === "plafond-atteint" ? await phraseReserveRefusee(g.id) : null,
    preteAReprendre: g.statut === "en-attente-credit" && (await ecriturePreteAReprendre(g.id)),
    // Correctif après relecture : « Reprendre (≈ X €) » seulement si la reprise peut partir ; sinon le bouton dit pourquoi.
    // Re-relecture A09 : la somme de toutes les écritures du sujet que le geste relance et fait confirmer.
    reprise: g.statut === "en-attente-credit" || g.statut === "plafond-atteint" ? await devisRepriseDuSujet(scriptMaitreId) : null,
    // Comptes d'abonnement : un forfait se renouvelle, on ne le « recharge » pas (textes de l'écran d'attente).
    abonnements,
    aucunCompte,
  };
}

/** Versions des rôles (fiche figée). */
export { versionsRoles, texteVersion };
