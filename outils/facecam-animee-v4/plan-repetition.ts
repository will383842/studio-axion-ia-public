/**
 * RÉPÉTITION GÉNÉRALE v4 — le PLAN DU RÉALISATEUR pour la prise complète de Will (IMG_7747, 82,7 s montées).
 *
 * Pas de clé Claude dans la session de répétition : ce plan a été écrit PAR MOI en suivant à la lettre la consigne du réalisateur
 * (`consigneRealisateur`, § 0 « plaquettes v4 »), puis PASSÉ DANS LA CHAÎNE RÉELLE : ce script appelle `realiser()` avec une fausse
 * « réponse de Claude » (le plan ci-dessous), si bien que lecture zod, `verifierPlan` (règles v4), essais guidés par les erreurs,
 * assemblage (sous-titres de la vraie voix, fps 30) sont exactement ceux de la production. Le plan est écrit à partir des mots horodatés
 * de `transcription.json` (instants lus avec `t("mot", occurrence)`, jamais recopiés à la main).
 *   npx tsx outils/facecam-animee-v4/plan-repetition.ts
 * Écrit `docs/facecam-animee-v4/repetition-generale/plan-realisateur.json` (le plan rendable) et `rapport-verification.json`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { realiser, type EntreeRealisateur, type MotTranscrit } from "../../src/moteurs/montage-facecam-animee/realisateur";
import { controlerDiversiteV4, evenementsDuPlanV4, priseSeuleV4, resoudreElementsV4 } from "../../src/moteurs/montage-facecam-animee/realisateur/regles-v4";
import type { ElementV4Plan } from "../../src/domaine/facecam-animee/plan";

const DOSSIER = "docs/facecam-animee-v4/repetition-generale";
const trans = JSON.parse(readFileSync(`${DOSSIER}/transcription.json`, "utf8")) as { dureeMonteeSec: number; motsMontesTexteValide: MotTranscrit[] };
const mots = trans.motsMontesTexteValide;
const DUREE = trans.dureeMonteeSec;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9'-]/g, "");
/** Début (s) de la `occ`-ième occurrence du mot `w` (orthographe de la transcription, accents et ponctuation ignorés). */
function t(w: string, occ = 0): number {
  const trouves = mots.filter((m) => norm(m.w) === norm(w));
  if (!trouves[occ]) throw new Error(`mot introuvable : ${w} #${occ}`);
  return trouves[occ].a;
}
/** Début de la première occurrence de `w` après l'instant `apres` (pour les mots qui reviennent). */
function tApres(w: string, apres: number): number {
  const m = mots.find((x) => x.a >= apres && norm(x.w) === norm(w));
  if (!m) throw new Error(`mot introuvable : ${w} après ${apres}`);
  return m.a;
}
const r = (x: number) => Math.round(x * 100) / 100;

/* Ligne de temps : chaque plaquette finit là où la suivante commence (la suivante entre dans l'image où la précédente sort).
 * Version du 17/10 (après avis de Will) : plaquettes plus COURTES et plus nombreuses (rythme mesuré ≥ 2,2 /s), trois passages en FENÊTRE VIDÉO LITTÉRALE
 * (mosaïque « devis / à la main / chiffres », duel « outil / embauche », mosaïque « visio avec notre équipe »), jamais « Certifexemple » à l'écran. */
const E: ElementV4Plan[] = [];
let curseur = 0;
const poser = (id: string, fin: number, champs: Omit<ElementV4Plan, "id" | "debut" | "fin">) => {
  const f = Math.min(r(fin), DUREE);
  E.push({ id, debut: curseur, fin: f, ...champs });
  curseur = f;
};

poser("EtiquetteTete", 1.4, { mots: ["VOTRE ENTREPRISE"], illustre: "Si votre entreprise avance" });
poser("CarteCalendrier", 3.4, { mots: ["VOS JOURNÉES"], instants: [r(t("journées")), r(t("finissent"))], illustre: "vos journées, elles, n'en finissent plus" });
poser("element-barre", 5.3, { mots: ["UN PROBLÈME"], lignes: [{ texte: "UNE FUITE", a: r(t("fuite", 0)) }], instants: [r(t("travail") + 0.3)], illustre: "vous n'avez pas un problème de travail, vous avez une fuite" });
poser("PileNotifications", 7.4, { lignes: [{ texte: "CE QUI SUIT", a: r(t("suit")) }, { texte: "POUR VOUS", a: r(t("pour")) }], illustre: "Et ce qui suit est pour vous" });
poser("Interjection", 8.2, { mots: ["SOIRÉES."], illustre: "Les soirées sur les devis" });
poser("MosaiqueVideos", 10.5, {
  mots: ["À LA MAIN"], instants: [r(t("main"))],
  recherches: ["signature d'un devis", "écriture à la main sur papier", "saisie des chiffres au clavier", "devis signé à la main"],
  medias: ["broll/broll-devis-signature-1080.mp4", "broll/broll-ecriture-papier-1080.mp4", "broll/broll-clavier-frappe-1080.mp4", "broll/lotE-devis.mp4"],
  illustre: "les devis, les relances à la main, les chiffres",
});
poser("BadgeProfil", 12.8, { mots: ["LA CHARGE NORMALE"], lignes: [{ texte: "UN DIRIGEANT", a: r(t("dirigeant", 0)) }], illustre: "ce n'est pas la charge normale d'un dirigeant" });
poser("CarteCalendrier", 14.9, { mots: ["CHAQUE JOUR"], instants: [r(t("temps", 0)), r(t("jour"))], illustre: "du temps qui s'échappe, chaque jour" });
poser("PileNotifications", 16.9, { lignes: [{ texte: "SANS BRUIT", a: r(t("sans")) }], illustre: "sans bruit" });
poser("CarteStatuts", 20.9, {
  mots: ["FORME", "ACCOMPAGNE", "AUDITE", "AXION-IA", "ONE-TO-ONE"],
  lignes: [{ texte: "LES ÉQUIPES", a: r(t("équipes", 0)) }, { texte: "LES DIRIGEANTS", a: r(t("dirigeants", 0)) }, { texte: "LES ENTREPRISES", a: r(t("entreprises", 0)) }],
  instants: [r(t("automatise") - 0.7)],
  illustre: "on forme les équipes, on accompagne les dirigeants",
});
poser("MotSaute", 22.4, { mots: ["AUTOMATISE", "TOUT"], illustre: "on automatise tout ce qui leur coûte du temps" });
poser("PileNotifications", 25.0, { lignes: [{ texte: "COÛTE DU TEMPS", a: r(t("coûte")) }, { texte: "PETITE STRUCTURE", a: r(t("Petite")) }, { texte: "EN CROISSANCE", a: r(t("croissance") + 0.02) }], illustre: "tout ce qui leur coûte du temps. Petite structure" });
poser("EtiquetteTete", 26.0, { mots: ["PARTOUT"], illustre: "groupe, partout" });
poser("FenetreTelephone", 28.0, { mots: ["PARTOUT", "JE VOIS", "RÉFLEXE"], instants: [r(t("vois"))], illustre: "partout, je vois le même réflexe" });
poser("GraphiqueBarres", 29.5, { mots: ["AJOUTANT"], instants: [r(t("colmater") + 0.2), r(t("ajoutant")), r(tApres("un", 29))], illustre: "On veut colmater en ajoutant un outil" });
poser("duel-video", 31.4, {
  mots: ["OUTIL", "EMBAUCHE"], instants: [r(t("embauche"))],
  recherches: ["un outil : l'ordinateur", "une embauche : l'équipe"],
  medias: ["broll/broll-bureau-ordinateur.mp4", "broll/broll-reunion-equipe.mp4"],
  illustre: "un outil de plus, une embauche de plus",
});
poser("CarteChecklist", 34.5, { mots: ["LA VRAIE"], lignes: [{ texte: "PREMIÈRE ÉTAPE", a: r(t("première", 0)) }, { texte: "TROUVER", a: r(t("trouver")) }, { texte: "LA FUITE", a: r(t("fuite", 1) - 0.2) }], illustre: "la vraie première étape, c'est de trouver la fuite" });
poser("BadgeProfil", 36.3, { mots: ["VOULAIT RECRUTER"], lignes: [{ texte: "UN DIRIGEANT", a: r(t("dirigeant", 1)) }], illustre: "Prenez un dirigeant qui voulait recruter" });
poser("CarrouselFeuillete", 38.8, { mots: ["RECRUTER", "ABSORBER", "L'ADMINISTRATIF"], instants: [r(t("recruter") + 0.2), r(t("absorber")), r(t("l'administratif"))], illustre: "pour absorber l'administratif" });
poser("EtiquetteTete", 40.3, { mots: ["OÙ PARTAIT LE TEMPS"], illustre: "On a d'abord regardé où partait le temps" });
poser("CarteChecklist", 44.3, { mots: ["RETROUVÉ"], lignes: [{ texte: "PAS DE RECRUTEMENT", a: r(t("recrutement") - 0.1) }, { texte: "SES ÉQUIPES", a: r(t("équipes", 1) + 0.1) }, { texte: "LEURS APRÈS-MIDI", a: r(t("après-midi")) }, { texte: "SES WEEK-ENDS", a: r(t("week-ends")) }], illustre: "ses équipes ont retrouvé leurs après-midi, ses week-ends" });
poser("MotSaute", 46.1, { mots: ["COMMENCER", "ON VOUS"], illustre: "on vous propose de commencer par là" });
poser("FenetreTelephone", 49.2, { mots: ["LE DIAGNOSTIC FUITE", "GRATUIT", "45 MINUTES"], illustre: "Un premier diagnostic gratuit de 45 minutes" });
poser("MosaiqueVideos", 51.5, {
  mots: ["NOTRE ÉQUIPE"], instants: [r(t("équipe", 0))],
  recherches: ["notre équipe en réunion", "visio sur ordinateur portable", "équipe devant l'ordinateur", "visio avec l'équipe au téléphone"],
  medias: ["broll/broll-reunion-equipe.mp4", "broll/broll-bureau-ordinateur.mp4", "broll/lotE-bureau.mp4", "broll/broll-telephone-main-defile.mp4"],
  illustre: "en visio avec notre équipe",
});
poser("BadgeCompteur", 54.0, { mots: ["VOTRE TEMPS"], nombre: 1, instants: [r(tApres("un", 51))], illustre: "Un, où part votre temps ?" });
poser("CarteChecklist", 58.3, { mots: ["DEUX"], lignes: [{ texte: "PEUT CHANGER", a: r(t("changer")) }, { texte: "EN PREMIER", a: r(t("premier", 1)) }, { texte: "BESOIN", a: r(t("besoin")) }], illustre: "qu'est-ce qui peut changer en premier ? de quoi avez-vous" });
poser("MotSaute", 60.0, { mots: ["FORMATION", "UNE"], illustre: "Une formation pour vos équipes" });
poser("CarrouselFeuillete", 62.5, { mots: ["AIDES", "OPCO", "POSSIBLES"], instants: [r(t("aides")), r(t("opco")), r(t("possibles"))], illustre: "des aides OPCO possibles" });
poser("Interjection", 63.5, { mots: ["ORIENTANT."], illustre: "en vous orientant vers les bonnes" });
poser("CarteStatuts", 67.4, {
  mots: ["ONE-TO-ONE", "COMPLET", "AUTOMATISATION", "OU PEUT-ÊTRE"],
  lignes: [{ texte: "ACCOMPAGNEMENT", a: r(t("accompagnement")) }, { texte: "AUDIT", a: r(t("audit")) }, { texte: "L'AUTOMATISATION", a: r(t("l'automatisation")) }],
  instants: [r(t("l'automatisation") + 0.6)],
  illustre: "un accompagnement one-to-one, un audit complet",
});
poser("EclatChiffre", 68.9, { nombre: 45, mots: ["MINUTES"], instants: [r(t("minutes", 1))], illustre: "En 45 minutes" });
poser("element-barre", 70.8, { mots: ["MIRACLE"], lignes: [{ texte: "PRIORITÉS", a: r(t("priorités")) }], instants: [r(t("miracle") + 0.35)], illustre: "pas de miracle, mais vous repartez avec vos priorités" });
poser("GraphiqueBarres", 74.3, { mots: ["L'IA"], instants: [r(t("comprendrez")), r(t("rapporte"))], illustre: "L'IA ne rapporte qu'à partir du moment où elle s'attaque" });
poser("Interjection", 75.4, { mots: ["S'ATTAQUE."], illustre: "elle s'attaque" });
poser("dalle-claquee", 76.4, { mots: ["FUITE"], illustre: "à la bonne fuite" });
poser("BadgeProfil", 78.0, { mots: ["QUELLE QUE SOIT"], lignes: [{ texte: "VOTRE TAILLE", a: r(t("taille")) }], illustre: "Quelle que soit votre taille" });
poser("CarteStatuts", 80.6, {
  mots: ["VOUS SENTEZ", "DU TEMPS", "RÉSERVEZ", "QUE DU TEMPS", "VOUS ÉCHAPPE"],
  lignes: [{ texte: "VOUS SENTEZ", a: r(t("sentez")) }, { texte: "DU TEMPS", a: r(tApres("temps", 78)) }, { texte: "RÉSERVEZ", a: r(t("réservez")) }],
  illustre: "si vous sentez que du temps vous échappe, réservez",
});
poser("FenetreTelephone", DUREE, { mots: ["RÉSERVEZ VOTRE APPEL", "DIAGNOSTIC GRATUIT", "RÉSERVEZ"], illustre: "réservez votre appel diagnostic gratuit" });

const MOTS_FORTS = ["entreprise", "fuite", "devis", "relances", "chiffres", "temps", "bruit", "forme", "accompagne", "audite", "automatise", "dirigeant", "dirigeants", "colmater", "outil", "embauche", "recruter", "recrutement", "week-ends", "après-midi", "diagnostic", "45", "minutes", "gratuit", "visio", "formation", "OPCO", "Certifexemple", "one-to-one", "audit", "miracle", "priorités", "l'IA", "réservez", "problème", "soirées"];

const entree: EntreeRealisateur = {
  mots,
  dureeSec: DUREE,
  titre: "Répétition générale v4 — prise complète IMG_7747",
  prise: { src: "prise-montee.mp4", finSec: DUREE, yeux: 0.31, centreX: 0.52, largeurVisage: 0.38 },
  fin: { debut: DUREE, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
};

const reponseDeClaude = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: E, motsForts: MOTS_FORTS };
async function principal() {
  let appels = 0;
  const resultat = await realiser(entree, { appeler: async () => { appels++; return { ok: true as const, donnees: reponseDeClaude }; } });

  console.log(`version : ${resultat.version} · essais : ${resultat.essais} · rendable : ${resultat.rendable} · plaquettes : ${E.length}`);
  for (const e of resultat.erreurs ?? []) console.log("ERREUR", e);
  for (const a of resultat.avertissements) console.log("avertissement", a);

  const resolu = resoudreElementsV4(E, DUREE).elements;
  const evts = evenementsDuPlanV4(resolu);
  const rapport = {
    version: resultat.version, essais: resultat.essais, appelsSimules: appels, rendable: resultat.rendable, erreurs: resultat.erreurs ?? [], avertissements: resultat.avertissements,
    plaquettes: E.length, evenements: evts.length, priseSeule: priseSeuleV4(resolu, DUREE),
    mesures: resultat.version === "complete" ? controlerDiversiteV4(resultat.plan, { mots }).mesures : null,
  };
  writeFileSync(`${DOSSIER}/rapport-verification.json`, JSON.stringify(rapport, null, 1));
  if (resultat.version === "complete") writeFileSync(`${DOSSIER}/plan-realisateur.json`, JSON.stringify(resultat.plan, null, 1));

}
principal().catch((e) => { console.error(e); process.exit(1); });
