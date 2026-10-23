/**
 * SOCLE QUALITÉ · PROSPECTS (PR). PUR. Observation seulement.
 *  PR-01 la cible est nommée tôt (métier, taille TPE/PME/ETI/grande entreprise, fonction ou situation ; « vous »), dans les 10 premières secondes.
 *  PR-02 UNE SEULE DEMANDE, EN FIN, LIÉE À L'IDÉE. Une question suivie d'une demande
 *        compte pour une seule demande (ex. : « quelle tâche pourrait se faire toute seule ? Écrivez PLAN… »).
 *  PR-03 l'appel est permis sur le réseau (`APPELS_PAR_RESEAU`, `seuils.ts`).
 *  PR-04 pas de jargon de l'IA dans les 5 premières secondes.
 *  PR-05 UNE vidéo = UNE cible : au plus une taille d'entreprise nommée (TPE, PME, ETI, grand groupe).
 */
import { APPELS_PAR_RESEAU, type TypeAppelSocle } from "../seuils";
import { part, type PhraseLue } from "../script";
import type { Contexte, ResultatRegle } from "../types";
import { ENTREPRISE, norm, racinesCommunes, resultat } from "./outils";

/**
 * Verbes d'une demande (sur le texte normalisé). Les verbes sans ambiguïté comptent partout ; « écrivez / tapez / envoyez /
 * partagez » sont aussi des gestes du corps (« Écrivez la décision en une phrase ») : ils ne comptent qu'en fin de script.
 */
const VERBE_DEMANDE = /(?:^|[^a-z])(reservez|commentez|contactez|appelez|abonnez|cliquez|telechargez|inscrivez|prenez rendez-vous|rejoignez|ecrivez-moi|envoyez-moi)(?=$|[^a-z])/;
const VERBE_GESTE = /(?:^|[^a-z])(ecrivez|tapez|envoyez|partagez)(?=$|-vous|[^a-z-])/;
/** Indicatif, pas impératif : « Vous la tapez dans le CRM ». */
const INDICATIF = /(?:^|[^a-z])vous (?:(?:l'|la |le |les |y |en |nous )\s*)?(?:reservez|commentez|contactez|appelez|abonnez|cliquez|telechargez|inscrivez|rejoignez|ecrivez|tapez|envoyez|partagez)(?=$|[^a-z])/;
const PARTIES_CORPS: readonly string[] = ["accroche", "douleur", "corps", "exemple", "preuve"];
const CIBLE = new RegExp(`${ENTREPRISE.source}|(?:^|[^a-z])(vous|votre|vos)(?=$|[^a-z])`);
const JARGON = /(?:^|[^a-z])(llm|prompts?|rag|api|tokens?|fine-tuning|no-code|low-code|workflows?|agents? ia|modeles? de langage|machine learning|deep learning|gpt-?\d\w*|ia generative)(?=$|[^a-z])/;

/** Une phrase est-elle dans la zone de fin (parties d'appel, ou dernier quart de la durée) ? */
function enFin(c: Contexte, p: PhraseLue): boolean {
  const partie = c.script.lignes[p.ligne]?.partie;
  return partie === "appel" || partie === "question" || partie === "fin" || part(c.lecture, p.debutSec) >= 0.75;
}

const estQuestion = (p: PhraseLue) => /\?["»”)]*$/.test(p.texte.trim());

/**
 * Les phrases de demande : celles qui portent un verbe de demande ; sans elles, la dernière question de la fin. Une
 * question suivie d'une demande ne compte pas à part.
 */
export function phrasesDeDemande(c: Contexte): PhraseLue[] {
  const estDemande = (p: PhraseLue) => {
    const t = norm(p.texte);
    if (INDICATIF.test(t)) return false;
    if (VERBE_DEMANDE.test(t)) return true;
    return VERBE_GESTE.test(t) && !/(?:^|[^a-z])a retenir/.test(t) && enFin(c, p) && !PARTIES_CORPS.includes(c.script.lignes[p.ligne]?.partie ?? "");
  };
  const avecVerbe = c.lecture.phrases.filter(estDemande);
  if (avecVerbe.length) return avecVerbe;
  const questions = c.lecture.phrases.filter((p) => estQuestion(p) && enFin(c, p));
  return questions.length ? [questions[questions.length - 1]] : [];
}

/** La forme d'une demande (sur le texte brut : le MOT à commenter est en capitales). */
export function typeAppel(phrase: string): TypeAppelSocle {
  const n = norm(phrase);
  if (/(?:commentez|ecrivez|tapez|mettez)\b/.test(n) && /commentaire|commentez/.test(n) && /\b[A-ZÀ-Ý]{2,}\b/.test(phrase.replace(/^\S+/, ""))) return "commentez-mot";
  if (/message prive|en prive|\bmp\b|par message/.test(n)) return "message-prive";
  if (/abonnez/.test(n)) return "abonnement";
  if (/(?:^|[^a-z])lien(?=$|[^a-z])/.test(n)) return "lien";
  if (/diagnostic|rendez-vous|reservez|un appel/.test(n)) return "diagnostic";
  if (/envoyez|partagez/.test(n)) return "envoi";
  return "question";
}

/** Les tailles d'entreprise (une vidéo n'en nomme qu'une : PR-05). */
const TAILLES: readonly [string, RegExp][] = [
  ["TPE", /(?:^|[^a-z])tpe(?=$|[^a-z])/],
  ["PME", /(?:^|[^a-z])pme(?=$|[^a-z])/],
  ["ETI", /(?:^|[^a-z])eti(?=$|[^a-z])/],
  ["grand groupe", /(?:^|[^a-z])(grands? groupes?|grandes? entreprises?)(?=$|[^a-z])/],
];

/** Les tailles d'entreprise nommées dans un texte (normalisé ici). */
export function taillesNommees(texte: string): string[] {
  const n = norm(texte);
  return TAILLES.filter(([, m]) => m.test(n)).map(([t]) => t);
}

export function reglesProspects(c: Contexte): ResultatRegle[] {
  const { lecture, script, seuils, recette } = c;
  const out: ResultatRegle[] = [];

  const cible = lecture.phrases.find((p) => CIBLE.test(norm(p.texte)));
  out.push(
    cible && cible.debutSec <= seuils.ciblePremieresSec
      ? resultat(c, "PR-01", "prospects", "alerte", "ok", `Cible nommée à ${+cible.debutSec.toFixed(1)} s.`)
      : resultat(c, "PR-01", "prospects", "alerte", "ecart", `La cible (métier, taille TPE/PME/ETI/grande entreprise, fonction ou situation) n'est pas nommée dans les ${seuils.ciblePremieresSec} premières secondes.`),
  );

  const tailles = taillesNommees(script.lignes.map((l) => l.dit).join(" "));
  out.push(
    tailles.length > 1
      ? resultat(c, "PR-05", "prospects", "alerte", "ecart", `Plusieurs cibles (${tailles.join(", ")}) : une vidéo = une seule cible.`)
      : resultat(c, "PR-05", "prospects", "alerte", "ok", "Une seule cible."),
  );

  const demandes = phrasesDeDemande(c);
  if (!demandes.length) {
    out.push(
      (script.reseau && recette.demandeFinaleParReseau?.[script.reseau] || recette.demandeFinale) === "facultative"
        ? resultat(c, "PR-02", "prospects", "alerte", "ok", "Pas de demande (facultative pour ce format).")
        : resultat(c, "PR-02", "prospects", "alerte", "ecart", "Aucune demande en fin de script : une seule, liée à l'idée."),
    );
  } else {
    const derniere = demandes[demandes.length - 1];
    const ligneId = script.lignes[derniere.ligne]?.id;
    const i = lecture.phrases.indexOf(derniere);
    const avant = lecture.phrases.slice(0, Math.max(0, i - 1)).map((p) => p.texte).join(" ");
    const autour = [lecture.phrases[i - 1]?.texte ?? "", derniere.texte].join(" ");
    if (demandes.length > 1) out.push(resultat(c, "PR-02", "prospects", "alerte", "ecart", `${demandes.length} demandes : une seule, en fin.`, { ligneId: script.lignes[demandes[0].ligne]?.id }));
    else if (!enFin(c, derniere)) out.push(resultat(c, "PR-02", "prospects", "alerte", "ecart", "La demande n'est pas en fin de script.", { ligneId }));
    else if (!racinesCommunes(autour, avant).length) out.push(resultat(c, "PR-02", "prospects", "alerte", "ecart", "La demande n'est pas liée à l'idée du script.", { ligneId }));
    else out.push(resultat(c, "PR-02", "prospects", "alerte", "ok", "Une seule demande, en fin, liée à l'idée.", { ligneId }));

    const type = typeAppel(derniere.texte);
    const reseaux = script.reseau ? [script.reseau] : recette.reseaux;
    const refus = reseaux.filter((r) => !APPELS_PAR_RESEAU[r].permis.includes(type));
    out.push(
      refus.length
        ? resultat(c, "PR-03", "prospects", "alerte", "ecart", APPELS_PAR_RESEAU[refus[0]].ecartes[type] ?? `Cet appel n'est pas prévu sur ${refus.join(", ")}.`, { ligneId })
        : resultat(c, "PR-03", "prospects", "alerte", "ok", `Appel permis sur ${reseaux.join(", ")}.`, { ligneId }),
    );
  }
  if (!demandes.length) out.push(resultat(c, "PR-03", "prospects", "alerte", "non-mesure", "Pas de demande : rien à vérifier par réseau."));

  const debut = norm(lecture.mots.filter((m) => m.debutSec < 5).map((m) => m.mot).join(" "));
  const jargon = JARGON.exec(debut);
  out.push(
    jargon
      ? resultat(c, "PR-04", "prospects", "info", "ecart", `Jargon dans les 5 premières secondes : « ${jargon[1]} ».`, { ligneId: script.lignes[0]?.id })
      : resultat(c, "PR-04", "prospects", "info", "ok", "Pas de jargon dans les 5 premières secondes."),
  );
  return out;
}
