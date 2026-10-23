/**
 * SOCLE QUALITÉ · RÉTENTION (RT). PUR. Observation seulement.
 *  RT-01 phrase longue : alerte au-delà de 14 mots, refus au-delà de 22 (calibrage du 18/10 ; avant 18 ; une énumération se lit comme une liste).
 *  RT-02 boucle ANNONCÉE interdite (« restez jusqu'au bout », « je vous le dis à la fin ») : motif de C40 d'Écrire.
 *  RT-03 boucle IMPLICITE tenue, encouragée (« trois réflexes » puis « Un. », « Deux. », « Trois. »).
 *  RT-04 la valeur arrive avant 40 % de la durée (fonction minimale « gain livré tôt »).
 *  RT-05 une relance entre 50 et 70 % de la durée (obligatoire à partir de 45 s, facultative à 30 s).
 *  RT-06 un changement à l'écran toutes les 2,5 s au plus (sauf face caméra ; mesuré sur de vrais écrans).
 *  RT-07 rien après la demande finale, pas de fin molle (« merci d'avoir regardé »).
 */
import { MOTIF_BOUCLE_META } from "@/domaine/controles-script/style";
import { classeDuree } from "../seuils";
import { motsUniteMax, part, type PhraseLue } from "../script";
import type { Contexte, ResultatRegle } from "../types";
import { GAIN, norm, resultat } from "./outils";
import { phrasesDeDemande } from "./prospects";

const CHIFFRES: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7 };
const OBJETS_COMPTES =
  "reflexes?|etapes?|erreurs?|gestes?|taches?|points?|raisons?|signes?|conseils?|questions?|gains?|regles?|astuces?|outils?|choses?|donnees?|facons?|methodes?|pieges?|criteres?|automatisations?|secrets?|lecons?";
const ANNONCE = new RegExp(`(?:^|[^a-z])(deux|trois|quatre|cinq|six|sept|[2-7]) (?:[a-z'-]+ )?(${OBJETS_COMPTES})(?=$|[^a-z])`);
const MARQUEUR = /^(un|deux|trois|quatre|cinq|six|sept|1|2|3|4|5|6|7)[.)]?$|^(premier|premiere|deuxieme|second|seconde|troisieme|quatrieme|cinquieme|sixieme|septieme)(?=$|[^a-z])/;
const RELANCE =
  /^(mais|sauf|pourtant|par contre|en revanche|attention|et la|et si|derriere|resultat|voici|maintenant|alors|nous, on|seulement|reste|le probleme)(?=$|[^a-z])|c'est la que|le plus important|le plus dur|le piege|le secret|la difference|le pire|le vrai/;
const FIN_MOLLE = /(merci d'avoir regarde|merci de m'avoir|voila,? c'est tout|a bientot|bonne journee|a la prochaine)/;

export function reglesRetention(c: Contexte): ResultatRegle[] {
  return [phraseLongue(c), boucleAnnoncee(c), boucleImplicite(c), valeurTot(c), relance(c), changementEcran(c), rienApres(c)];
}

function phraseLongue(c: Contexte): ResultatRegle {
  const { seuils, lecture, script } = c;
  const mesurees = lecture.phrases.map((p) => ({ p, n: motsUniteMax(p.texte) }));
  const pire = mesurees.reduce<{ p: PhraseLue; n: number } | null>((a, b) => (!a || b.n > a.n ? b : a), null);
  if (!pire) return resultat(c, "RT-01", "retention", "bloquant", "non-mesure", "Aucune phrase.");
  const ligneId = script.lignes[pire.p.ligne]?.id;
  if (pire.n > seuils.phraseRefusMots) return resultat(c, "RT-01", "retention", "bloquant", "ecart", `Une phrase fait ${pire.n} mots : ${seuils.phraseRefusMots} au plus (« ${pire.p.texte.slice(0, 60)}… »).`, { ligneId });
  if (pire.n > seuils.phraseAlerteMots) return resultat(c, "RT-01", "retention", "alerte", "ecart", `Une phrase fait ${pire.n} mots : au-delà de ${seuils.phraseAlerteMots}, coupez-la si possible.`, { ligneId });
  return resultat(c, "RT-01", "retention", "bloquant", "ok", `Phrase la plus longue : ${pire.n} mots.`);
}

function boucleAnnoncee(c: Contexte): ResultatRegle {
  for (const l of c.script.lignes) {
    if (l.partie === "appel") continue;
    const m = MOTIF_BOUCLE_META.exec(norm(l.dit));
    if (m) return resultat(c, "RT-02", "retention", "alerte", "ecart", `Boucle annoncée (« ${m[1]} ») : tenez la promesse sans l'annoncer.`, { ligneId: l.id });
  }
  return resultat(c, "RT-02", "retention", "alerte", "ok", "Aucune boucle annoncée.");
}

/** Le nombre annoncé est tenu : des marqueurs « Un. », « Deux. »… jusqu'à N, ou les N phrases suivantes en liste courte. */
function boucleImplicite(c: Contexte): ResultatRegle {
  const { lecture, script } = c;
  const phrases = lecture.phrases;
  for (let i = 0; i < phrases.length; i++) {
    const p = phrases[i];
    const partie = script.lignes[p.ligne]?.partie;
    if (!(partie === "accroche" || partie === "promesse" || part(lecture, p.debutSec) < 0.3)) continue;
    const m = ANNONCE.exec(norm(p.texte));
    if (!m) continue;
    const n = CHIFFRES[m[1]] ?? Number(m[1]);
    const suite = phrases.slice(i + 1);
    const marqueurs = suite.filter((s) => MARQUEUR.test(norm(s.texte))).length;
    const liste = suite.slice(0, n).length === n && suite.slice(0, n).every((s) => s.nbMots <= 6);
    const ligneId = script.lignes[p.ligne]?.id;
    if (marqueurs >= n || liste) return resultat(c, "RT-03", "retention", "alerte", "ok", `Boucle implicite tenue : « ${m[0].trim()} » annoncé, puis donné.`, { ligneId });
    return resultat(c, "RT-03", "retention", "alerte", "ecart", `« ${m[0].trim()} » est annoncé, mais les ${n} éléments ne sont pas tous donnés.`, { ligneId });
  }
  return resultat(c, "RT-03", "retention", "alerte", "ok", "Pas de boucle implicite (facultatif ; conseil : annoncer un nombre réel d'éléments et les donner).");
}

function valeurTot(c: Contexte): ResultatRegle {
  const { lecture, script, seuils } = c;
  const parPartie = script.lignes.findIndex((l) => l.partie === "corps" || l.partie === "preuve" || l.partie === "exemple");
  const tPartie = parPartie >= 0 ? lecture.debutLigne[parPartie] : Infinity;
  const gain = lecture.phrases.find((p, i) => i > 0 && script.lignes[p.ligne]?.partie !== "accroche" && GAIN.test(norm(p.texte)));
  const t = Math.min(tPartie, gain?.debutSec ?? Infinity);
  if (!Number.isFinite(t)) return resultat(c, "RT-04", "retention", "alerte", "ecart", "Aucune valeur concrète repérée (étape, preuve, exemple ou gain chiffré).");
  const p = Math.round(part(lecture, t) * 100);
  return p <= seuils.gainAvantPart * 100
    ? resultat(c, "RT-04", "retention", "alerte", "ok", `La valeur arrive à ${p} % de la durée.`)
    : resultat(c, "RT-04", "retention", "alerte", "ecart", `La valeur arrive à ${p} % de la durée : avant ${Math.round(seuils.gainAvantPart * 100)} %.`);
}

function relance(c: Contexte): ResultatRegle {
  const { lecture, seuils, script } = c;
  const classe = classeDuree(lecture.dureeSec, script.dureeViseeSec);
  const fenetre = lecture.phrases.filter((p) => {
    const x = part(lecture, p.debutSec);
    return x >= seuils.relanceDebutPart && x <= seuils.relanceFinPart;
  });
  const trouvee = fenetre.find((p) => {
    const t = norm(p.texte);
    return RELANCE.test(t) || /\?$/.test(p.texte.trim()) || MARQUEUR.test(t);
  });
  const fen = `${Math.round(seuils.relanceDebutPart * 100)} et ${Math.round(seuils.relanceFinPart * 100)} %`;
  if (trouvee) return resultat(c, "RT-05", "retention", "alerte", "ok", `Relance entre ${fen} : « ${trouvee.texte.slice(0, 50)} ».`, { ligneId: script.lignes[trouvee.ligne]?.id });
  if (classe.relance === "obligatoire") return resultat(c, "RT-05", "retention", "alerte", "ecart", `Aucune relance entre ${fen} de la durée (une question, un « mais », « c'est là que », l'étape suivante…).`);
  return resultat(c, "RT-05", "retention", "info", "ok", `Pas de relance entre ${fen} (facultative pour ${classe.viseeSec} s).`);
}

function changementEcran(c: Contexte): ResultatRegle {
  const { recette, lecture, script, seuils } = c;
  if (recette.faceCamera) return resultat(c, "RT-06", "retention", "alerte", "non-mesure", "Face caméra : la règle du changement à l'écran ne s'applique pas.");
  if (!recette.ecransReels) return resultat(c, "RT-06", "retention", "alerte", "non-mesure", "Les écrans sont décidés après le script (découpage) : mesuré plus tard.");
  const instants: { t: number; ligne: number }[] = [];
  script.lignes.forEach((l, i) => {
    instants.push({ t: lecture.debutLigne[i], ligne: i });
    const motsLigne = lecture.mots.filter((m) => m.ligne === i);
    for (const r of l.changements ?? []) if (motsLigne[r]) instants.push({ t: motsLigne[r].debutSec, ligne: i });
  });
  instants.push({ t: lecture.dureeSec, ligne: script.lignes.length - 1 });
  instants.sort((a, b) => a.t - b.t);
  let pire = { ecart: 0, ligne: 0 };
  for (let k = 1; k < instants.length; k++) {
    const e = instants[k].t - instants[k - 1].t;
    if (e > pire.ecart) pire = { ecart: e, ligne: instants[k - 1].ligne };
  }
  const e = +pire.ecart.toFixed(1);
  return e <= seuils.changementEcranSec
    ? resultat(c, "RT-06", "retention", "alerte", "ok", `Écran qui change toutes les ${e} s au plus.`)
    : resultat(c, "RT-06", "retention", "alerte", "ecart", `L'écran reste ${e} s sans changer : ${seuils.changementEcranSec} s au plus.`, { ligneId: script.lignes[pire.ligne]?.id });
}

function rienApres(c: Contexte): ResultatRegle {
  const { lecture, script } = c;
  const molle = script.lignes.find((l) => FIN_MOLLE.test(norm(l.dit)));
  if (molle) return resultat(c, "RT-07", "retention", "alerte", "ecart", "Fin molle : la demande est la dernière phrase.", { ligneId: molle.id });
  const demandes = phrasesDeDemande(c);
  const derniere = demandes[demandes.length - 1];
  if (!derniere) return resultat(c, "RT-07", "retention", "alerte", "ok", "Pas de fin molle.");
  const apres = lecture.phrases.slice(lecture.phrases.indexOf(derniere) + 1);
  return apres.length
    ? resultat(c, "RT-07", "retention", "alerte", "ecart", `${apres.length} phrase(s) après la demande finale : finissez sur la demande.`, { ligneId: script.lignes[apres[0].ligne]?.id })
    : resultat(c, "RT-07", "retention", "alerte", "ok", "Rien après la demande finale.");
}

