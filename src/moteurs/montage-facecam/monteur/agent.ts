/**
 * AGENT MONTEUR FACE CAMÉRA — PILOTE (plan facecam v4, B.11, B.14, B.24 et précision « Discuter avec mon monteur »).
 * PUR : l'appel Claude et la relecture sont INJECTÉS (le service les branche sur le chemin de dépense existant).
 *
 * Déroulé d'un tour (lancement avec les consignes « Monteur, … », ou un message du fil) :
 *  1. plafond Claude du mois atteint → VERSION SIMPLE : règles fixes, modèles fixes, AUCUN appel Claude, aucune
 *     relecture ; la vidéo sort quand même, avec « Plafond du mois atteint — relever ? » ;
 *  2. sinon UN appel Claude (`roleMonteurFacecam`) ; sa réponse est relue opération par opération (Zod) ; réponse
 *     inutilisable ou appel refusé (plafond franchi entre-temps, crédit, panne) → version simple, sans nouvel appel ;
 *  3. application des opérations (garde-fous de la grammaire, détourage seulement à la demande) ;
 *  4. relecture des images de contrôle (injectée) : 1 correction au plus, jamais de seconde relecture. Une relecture
 *     qui échoue n'empêche jamais la livraison (règle de panne, B.24).
 */
import { EtatFacecam, MENTION_PLAFOND_FACECAM, type ConsigneFacecam } from "@/domaine/facecam";
import { comprendreDemandeFormats } from "@/briques/formats-facecam/demande";
import type { EntreeRole } from "@/generateur/roles/types";
import { appliquerOperations, cartesAutoActives, recalerPassages, type EtatMonteur, type PassageMonteur } from "./appliquer";
import type { EffetAConfirmer } from "./effet-realiste";
import { lireReponseMonteur, type OperationFacecam, type ReponseMonteur } from "./operations";
import { ancreConsigne, instantDans, PHRASE_NON_COMPRIS, reglesFixes, resumeOperation, variableMonteur, type ConsigneATraiter, type DonneesMonteur, type MessageFil, type SortieRelecture } from "./role";
import { menagerCartesAuto, nommeCarte, planCartesAuto, recalerReponse, sansMarqueurs } from "./cartes-chat";
import { texteCarteMotion, type CarteAutoVue } from "../cartes-video";
import { coupesActives, motsPourMonteur, type MotMonteur } from "./temps";
import type { MotHorodate } from "@/domaine/types";
import { DIT_INVISIBLE, phraseCouverture, type CouvertureMonteur } from "./couverture";

/** Réponse d'un appel Claude telle que la rend le chemin de dépense (`executerRolePourVideo`). */
export type ReponseAppel = { ok: true; simule: boolean; donnees?: unknown; invalide?: string; ecartees?: string[] } | { ok: false; arret: string; message: string };

/** Phrase dite à Will quand la version complète n'a rien pu rendre (jamais un « souci » sans explication). */
export const PHRASE_VERSION_SIMPLE_PANNE = "Le monteur complet n'a pas pu traiter cette demande ; j'ai appliqué la version simple. Réessayez dans un instant pour la version complète.";

/** Variable du nouvel essai : la même, plus les erreurs exactes de la réponse précédente. */
export function variableAvecErreurs(variable: string, erreurs: string[]): string {
  return `${variable}\n<erreurs_reponse_precedente>\n${erreurs.map((e) => `- ${e}`).join("\n")}\n</erreurs_reponse_precedente>\nTa réponse précédente avait ces opérations illisibles. Rends la réponse COMPLÈTE corrigée : chaque « parametres » est un objet JSON valide qui suit exactement la signature de son type.`;
}

const nbEcartees = (r: ReponseAppel) => (r.ok ? (r.ecartees?.length ?? 0) : 0);

export interface DependancesMonteur {
  /** UN appel Claude (rôle monteur). Absent : simulation par règles fixes. */
  appeler?: (entree: EntreeRole) => Promise<ReponseAppel>;
  /** Relecture des images de contrôle de l'état obtenu (injectée ; absente : pas de relecture). */
  relire?: (etat: EtatMonteur) => Promise<SortieRelecture | null>;
  nouvelId: (prefixe: string) => string;
  maintenant?: () => string;
  cleCarte?: (passageId: string) => string;
  /** Lot K : image de référence d'un effet réaliste → clé R2 ; part de plan large (bon endroit). */
  imageReference?: (ref: string) => string | undefined;
  largeurPlan?: (priseSec: number) => number;
}

export interface EntreeMonteur {
  titre: string;
  /** Transcription de la prise d'origine, au mot. */
  mots: MotHorodate[];
  dureePriseSec: number;
  etat: EtatMonteur;
  /** Consignes à traiter (dites « Monteur, … » ou écrites) ; celles déjà traitées sont ignorées. */
  consignes?: ConsigneFacecam[];
  /** Message du fil « Discuter avec mon monteur » (avec l'historique `fil`). */
  message?: string;
  fil?: MessageFil[];
  animations?: DonneesMonteur["animations"];
  habitudes?: string[];
  /** Plafond Claude du mois atteint (lu par le service AVANT tout appel). */
  plafondAtteint: boolean;
  /** Test en prod du 11/10 : la couverture que Will voit (miniature choisie) ; null : aucune. */
  couverture?: CouvertureMonteur | null;
}

export interface ResultatMonteur {
  etat: EtatMonteur;
  /** Réponse à montrer dans le fil (une phrase). */
  reponse: string;
  version: "complete" | "simple";
  /** Nombre d'appels Claude faits (0 en version simple). */
  appelsClaude: number;
  /** Consignes mises à jour (comprises, non comprises), dans `etat.facecam.consignes`. */
  comprises: number;
  nonComprises: number;
  /** Ce que le monteur a fait, une ligne par consigne comprise (« J'ai compris 3 consignes »). */
  resumes: { consigneId: string; resume: string; comprise: boolean }[];
  alertes: string[];
  aDeposer: { cle: string; contenu: { html: string; css: string; timeline: string } }[];
  /** État à montrer (plafond atteint, consigne non comprise, effet raté) ; absent : tout va bien. */
  etatFacecam?: EtatFacecam;
  /** Mention du plafond, quand la version simple vient du plafond. */
  mention?: string;
  /** Passages à détourage livrés en variante sans détourage (bords ratés à la relecture). */
  effetsRates: string[];
  /** Lot K : effets réalistes par IA préparés, PAYANTS : le service montre la carte de confirmation (rien n'est posé). */
  aConfirmer: EffetAConfirmer[];
  /** Test en prod du 11/10 : nouveau titre de couverture demandé (le service refait l'image ; aucun montage). */
  titreCouverture?: string;
}

/**
 * V6 « interdit de mentir » : quand une demande n'est pas rendue, la réponse dit ce qui a VRAIMENT été posé, puis ce qui
 * n'est pas encore possible ; la phrase de Claude (qui peut affirmer « C'est fait ») n'est pas reprise.
 */
export function reponseHonnete(faits: string[], pasEncore: string[]): string[] {
  const uniques = [...new Set(pasEncore)];
  return [faits.length ? `J'ai fait : ${[...new Set(faits)].join(", ").replace(/\.$/, "")}.` : null, ...uniques].filter((x): x is string => !!x);
}

/** Identifiant de consigne d'un message du fil. */
export const ID_FIL = "fil";

/** Consignes à traiter pour ce tour (non encore traitées), ancrées sur un mot. */
export function consignesATraiter(entree: EntreeMonteur, mots: MotMonteur[], idMessage?: string): ConsigneATraiter[] {
  const liste: ConsigneATraiter[] = (entree.consignes ?? [])
    // « comprise » = repérée (dite « Monteur, … » ou écrite), pas encore appliquée ; le monteur la passe à
    // « appliquee » ou « non-comprise ». Les consignes annulées ou déjà traitées ne repartent pas.
    .filter((c) => c.etat === "comprise")
    // Lot F1 : « fais-moi aussi une version carrée » est un format, fait par la chaîne : jamais une carte.
    .filter((c) => !comprendreDemandeFormats(c.texte))
    .map((c) => ({ id: c.id, texte: c.texte, origine: c.origine, ancre: ancreConsigne(c.texte, mots, c.dansPriseSec) }));
  if (entree.message?.trim()) liste.push({ id: idMessage ?? ID_FIL, texte: entree.message.trim(), origine: "fil", ancre: ancreConsigne(entree.message, mots) });
  return liste;
}

function donnees(entree: EntreeMonteur, mots: MotMonteur[], consignes: ConsigneATraiter[], vuesAuto: CarteAutoVue[]): DonneesMonteur {
  const retablies = new Set(entree.etat.facecam.coupes.retablies);
  const actives = cartesAutoActives(entree.etat);
  // Test réel du 10/10 : les cartes automatiques retirées ou effacées restent nommables (« remets la carte … »).
  const vus = new Set(actives.map((c) => c.id));
  const absentes = vuesAuto.filter((v) => v.etat !== "posee" && !vus.has(v.idStable) && vus.add(v.idStable));
  return {
    titre: entree.titre,
    mots,
    coupes: entree.etat.facecam.coupes.auto.map((c) => ({ id: c.id, type: c.type, debutSec: c.debutSec, finSec: c.finSec, libelle: c.libelle, retablie: retablies.has(c.id) })),
    passages: [
      ...entree.etat.facecam.passages.map((p) => ({ id: p.id, type: p.type, debutSec: p.debutSec, finSec: p.finSec, texte: p.texte, modele: p.modele })),
      // Vérif V1 : les cartes automatiques posées par l'habillage, nommables par Will (« enlève la carte sur … »).
      ...actives.map((c) => ({ id: c.id, type: "carte-auto", debutSec: c.debutSec, finSec: c.finSec, texte: c.texte, modele: c.modele })),
      ...absentes.map((v) => ({ id: v.idStable, type: v.etat === "retiree" ? "carte-auto-retiree" : "carte-auto-effacee", debutSec: v.debutSec, finSec: v.finSec, texte: texteCarteMotion(v.carte), modele: v.modele })),
    ].sort((a, b) => a.debutSec - b.debutSec),
    consignes,
    fil: entree.fil ?? [],
    animations: entree.animations ?? [],
    habitudes: entree.habitudes ?? [],
    image: { ...entree.etat.facecam.image },
    ...(entree.couverture !== undefined ? { couverture: entree.couverture } : {}),
  };
}

/** Un tour du monteur. Ne lève pas pour une panne de Claude : elle donne la version simple. */
export async function piloterMonteur(entree: EntreeMonteur, deps: DependancesMonteur): Promise<ResultatMonteur> {
  const mots = motsPourMonteur(entree.mots, coupesActives(entree.etat.facecam, entree.etat.reglages.coupesDemandees));
  const idMessage = entree.message?.trim() ? deps.nouvelId("msg") : undefined;
  const consignes = consignesATraiter(entree, mots, idMessage);
  // Cartes automatiques de la vidéo d'avant, planifiées comme la chaîne (posées, retirées, effacées).
  const vuesAuto = planCartesAuto(entree.etat, entree.mots, entree.dureePriseSec);
  const cartesAutoConnues = vuesAuto.map((v) => ({ id: v.idStable, cle: v.cle }));
  let version: ResultatMonteur["version"] = "complete";
  let appelsClaude = 0;
  let reponse: ReponseMonteur | null = null;
  let alertes: string[] = [];
  let mention: string | undefined;
  let panne: string | undefined;

  if (entree.plafondAtteint) {
    version = "simple";
    mention = MENTION_PLAFOND_FACECAM;
  } else if (deps.appeler && consignes.length) {
    const variable = variableMonteur(donnees(entree, mots, consignes, vuesAuto));
    const appeler = async (v: string): Promise<ReponseAppel> => {
      appelsClaude++;
      try {
        return await deps.appeler!({ contexte: {}, variable: v });
      } catch {
        return { ok: false, arret: "indisponible", message: "Claude n'a pas répondu." };
      }
    };
    const lire = (x: ReponseAppel) => {
      if (!x.ok || x.donnees === undefined) return null;
      const l = lireReponseMonteur(x.donnees);
      return l && (l.operations.length || l.consignes.length) ? l : null;
    };
    let r = await appeler(variable);
    let lu = lire(r);
    // Panne du 10/10 : UN nouvel essai, guidé par l'erreur exacte, quand Claude a répondu mais que des opérations
    // sont illisibles (ou la réponse entière). Il passe par le même chemin de dépense (plafonds, réservation).
    const erreurs = r.ok && !r.simule ? [...(r.ecartees ?? []), ...(r.invalide ? [r.invalide] : [])] : [];
    if (erreurs.length) {
      const r2 = await appeler(variableAvecErreurs(variable, erreurs));
      const lu2 = lire(r2);
      if (lu2 && (!lu || nbEcartees(r2) + lu2.ecartees.length < nbEcartees(r) + lu!.ecartees.length)) {
        r = r2;
        lu = lu2;
      }
    }
    if (lu) {
      reponse = { reponse: lu.reponse, operations: lu.operations, consignes: lu.consignes };
      const n = nbEcartees(r) + lu.ecartees.length;
      if (n) alertes.push(`${n} demande${n > 1 ? "s" : ""} mal formée${n > 1 ? "s" : ""} écartée${n > 1 ? "s" : ""}.`);
      if (r.ok && r.ecartees?.length) console.warn(`[studio] monteur : opérations écartées — ${r.ecartees.join(" | ").slice(0, 500)}`);
    }
    if (!reponse) {
      version = "simple";
      // Seul le plafond du MOIS se dit (« relever ? ») ; celui de la version (lot G) reste invisible : version simple.
      if (!r.ok && r.arret === "en-attente-credit") mention = MENTION_PLAFOND_FACECAM;
      // Panne ou réponse illisible : Will sait pourquoi c'est la version simple (le motif exact va au journal).
      else if ((!r.ok && r.arret !== "plafond-video") || (r.ok && !r.simule)) {
        panne = PHRASE_VERSION_SIMPLE_PANNE;
        alertes.push(r.ok ? `Réponse du monteur illisible : ${erreurs.join(" ; ").slice(0, 200) || "aucune opération"}.` : `Monteur indisponible : ${r.message}`);
      }
    }
  } else if (!deps.appeler) {
    // Claude pas relié : les règles fixes, comme la version simple (sans la mention du plafond).
    version = "simple";
  }
  // Vérif V1 : la version simple lit aussi les demandes d'ensemble et à plusieurs points (mots vus, éléments posés).
  if (!reponse)
    reponse = reglesFixes(consignes, {
      mots: mots.map((m) => ({ index: m.index, mot: m.mot, sec: m.monteeSec })),
      occupes: [...entree.etat.facecam.passages.map((p) => ({ debutSec: p.debutSec, finSec: p.finSec, type: p.type })), ...cartesAutoActives(entree.etat).map((c) => ({ debutSec: c.debutSec, finSec: c.finSec, type: "carte-auto" }))],
      ancrer: (texte) => ancreConsigne(texte, mots),
    });

  // Application, consigne par consigne (Annuler retire une consigne sans toucher aux autres).
  let etat = entree.etat;
  const aDeposer: ResultatMonteur["aDeposer"] = [];
  const resumes: ResultatMonteur["resumes"] = [];
  const dejaAppliquees = new Set<number>();
  const maintenant = deps.maintenant?.() ?? new Date().toISOString();
  const nouvellesConsignes: ConsigneFacecam[] = [];
  const aConfirmer: EffetAConfirmer[] = [];
  /** V6 : phrases « Pas encore possible » et ce qui a VRAIMENT été posé (la réponse à Will se construit dessus). */
  const pasEncore: string[] = [];
  const faitsReels: string[] = [];
  const remises: string[] = [];
  let titreCouverture: string | undefined;
  const noterRemises = (ops: OperationFacecam[]) =>
    ops.forEach((op) => {
      if (op.type === "remettre") remises.push(op.passageId);
      if (op.type === "changerTitreCouverture") titreCouverture = op.texte;
    });
  const extras = { cartesAutoConnues, ...(deps.imageReference ? { imageReference: deps.imageReference } : {}), ...(deps.largeurPlan ? { largeurPlan: deps.largeurPlan } : {}) };
  for (const c of consignes) {
    const lue = reponse.consignes.find((x) => x.consigneId === c.id || (c.origine === "fil" && x.consigneId === ID_FIL));
    const index = (lue?.operations ?? []).filter((i) => !dejaAppliquees.has(i) && reponse!.operations[i]);
    index.forEach((i) => dejaAppliquees.add(i));
    const ops = index.map((i) => reponse!.operations[i]);
    let comprise = !!lue?.comprise && ops.length > 0;
    let honnete: string | undefined;
    if (comprise) {
      const res = appliquerOperations(etat, ops, { mots, dureePriseSec: entree.dureePriseSec, origine: "demande", consigneId: c.id, nouvelId: deps.nouvelId, cleCarte: deps.cleCarte, ...extras });
      etat = res.etat;
      noterRemises(res.appliquees);
      aDeposer.push(...res.aDeposer);
      aConfirmer.push(...res.aConfirmer);
      alertes = alertes.concat(res.alertes);
      if (res.appliquees.length === 0) comprise = false;
      // V6 « interdit de mentir » : ce qui n'est pas rendu est dit tel quel, le résumé de Claude n'est pas repris.
      if (res.indisponibles.length) {
        const phrases = [...new Set(res.indisponibles.map((x) => x.phrase))];
        pasEncore.push(...phrases);
        const faits = res.appliquees.map(resumeOperation);
        faitsReels.push(...faits);
        honnete = [faits.length ? `${faits.join(", ")}.` : null, ...phrases].filter(Boolean).join(" ");
      } else if (comprise) faitsReels.push(lue?.resume?.trim() || resumeOperation(ops[0]));
    }
    const resume = honnete ?? (comprise ? (lue?.resume?.trim() || resumeOperation(ops[0])) : (lue?.resume?.trim() || "Je n'ai pas compris cette consigne : pouvez-vous la reformuler ?"));
    resumes.push({ consigneId: c.id, resume, comprise });
    const consigne: ConsigneFacecam = { id: c.id, origine: c.origine === "fil" ? "ecrite" : c.origine, texte: c.texte, etat: comprise ? "appliquee" : "non-comprise", le: maintenant };
    const existante = entree.consignes?.find((x) => x.id === c.id);
    if (existante?.dansPriseSec !== undefined) consigne.dansPriseSec = existante.dansPriseSec;
    nouvellesConsignes.push(consigne);
  }
  // Opérations décidées seules par Claude (sans consigne : « auto ») : garde-fous plus stricts (pas de détourage).
  const libres = reponse.operations.filter((_, i) => !dejaAppliquees.has(i));
  if (libres.length && version === "complete") {
    const res = appliquerOperations(etat, libres, { mots, dureePriseSec: entree.dureePriseSec, origine: "auto", nouvelId: deps.nouvelId, cleCarte: deps.cleCarte, cartesAutoConnues });
    etat = res.etat;
    noterRemises(res.appliquees);
    aDeposer.push(...res.aDeposer);
    alertes = alertes.concat(res.alertes);
    pasEncore.push(...res.indisponibles.map((x) => x.phrase));
  }
  const ids = new Set(nouvellesConsignes.map((c) => c.id));
  etat = { ...etat, facecam: { ...etat.facecam, consignes: [...etat.facecam.consignes.filter((c) => !ids.has(c.id)), ...nouvellesConsignes] } };
  // Vérif V1 : une coupe demandée ou un passage rétabli décale la vidéo montée ; les éléments déjà posés (et ceux de
  // ce tour, calés sur les coupes d'avant l'appel) suivent leurs mots (ancres dans la prise), comme « Rétablir ».
  if (JSON.stringify(coupesActives(etat.facecam, etat.reglages.coupesDemandees)) !== JSON.stringify(coupesActives(entree.etat.facecam, entree.etat.reglages.coupesDemandees))) etat = recalerPassages(etat);

  // Relecture des images de contrôle : version complète seulement, 1 correction au plus.
  const effetsRates: string[] = [];
  if (version === "complete" && deps.relire) {
    let relu: SortieRelecture | null = null;
    try {
      appelsClaude++;
      relu = await deps.relire(etat);
    } catch {
      relu = null;
      alertes.push("1 élément non relu — la vidéo est livrée.");
    }
    if (relu && !relu.ok) {
      // Bords ratés d'un effet à détourage : la variante sans détourage est livrée, avec « Effet non réussi — Réessayer ».
      for (const d of relu.defauts.filter((x) => x.defaut === "bords-detourage" && x.elementId)) {
        const p = etat.facecam.passages.find((x) => x.id === d.elementId) as PassageMonteur | undefined;
        if (p?.detourage) effetsRates.push(p.id);
      }
      if (effetsRates.length) {
        etat = { ...etat, facecam: { ...etat.facecam, passages: etat.facecam.passages.map((p) => (effetsRates.includes(p.id) ? { ...p, sansDetourage: true } : p)) } };
      }
      const corrections = relu.corrections.filter((op) => !(op.type === "masquerPersonne" || op.type === "texteDerriere" || op.type === "changerTitreCouverture"));
      if (corrections.length) {
        const res = appliquerOperations(etat, corrections as OperationFacecam[], { mots, dureePriseSec: entree.dureePriseSec, origine: "auto", nouvelId: deps.nouvelId, cleCarte: deps.cleCarte });
        etat = res.etat;
        aDeposer.push(...res.aDeposer);
        alertes = alertes.concat(res.alertes);
      }
    }
  }

  // Test réel du 10/10 : aucune carte automatique effacée en silence ; la réponse suit les cartes VRAIMENT posées.
  const placees = menagerCartesAuto(entree.etat, etat, {
    mots: entree.mots,
    dureePriseSec: entree.dureePriseSec,
    approximatif: (id) => instantDans(consignes.find((c) => c.id === id)?.texte ?? "") === null,
    remises,
  });
  etat = placees.etat;
  // Test réel du 11/10 : une seule affirmation par carte, d'après la planification réelle ; jamais de `*mot*` montré.
  const recaler = (texte: string) => recalerReponse(texte, placees);
  for (const r of resumes) r.resume = placees.phrases.find((p) => p.consigneId === r.consigneId)?.texte || recaler(r.resume) || placees.phrases.filter((p) => p.remplace && nommeCarte(r.resume, p.carte)).map((p) => p.texte).join(" ") || sansMarqueurs(r.resume);

  // Test en prod du 11/10 : un texte que Will voit sur la couverture n'est jamais dit « invisible à l'écran » ; on lui
  // montre la couverture et on demande où il le voit (jamais un montage refait au hasard).
  const couverture = entree.couverture;
  const dementi = !!couverture && [reponse.reponse, ...resumes.map((r) => r.resume)].some((t) => DIT_INVISIBLE.test(t ?? ""));
  if (dementi) for (const r of resumes) if (DIT_INVISIBLE.test(r.resume)) r.resume = phraseCouverture(couverture!);
  const comprises = resumes.filter((r) => r.comprise).length;
  const nonComprises = resumes.length - comprises;
  const phraseClaude = dementi ? phraseCouverture(couverture!) : reponse.reponse;
  const base = [panne, ...(pasEncore.length ? reponseHonnete(faitsReels, pasEncore) : [phraseClaude || (comprises ? "C'est fait." : PHRASE_NON_COMPRIS)]).map(recaler)].filter(Boolean).join(" ");
  const phrasesCartes = placees.phrases.filter((p) => p.remplace || !nommeCarte(base, p.carte)).map((p) => p.texte);
  const etatFacecam = mention ? EtatFacecam.PlafondAtteint : effetsRates.length ? EtatFacecam.EffetRate : nonComprises ? EtatFacecam.ConsigneNonComprise : undefined;
  return {
    etat,
    reponse: sansMarqueurs([base, ...phrasesCartes].filter(Boolean).join(" ")),
    version,
    appelsClaude,
    comprises,
    nonComprises,
    resumes,
    alertes,
    aDeposer,
    ...(etatFacecam ? { etatFacecam } : {}),
    ...(mention ? { mention } : {}),
    effetsRates,
    aConfirmer,
    ...(titreCouverture ? { titreCouverture } : {}),
  };
}
