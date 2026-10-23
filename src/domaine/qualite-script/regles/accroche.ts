/**
 * SOCLE QUALITÉ · ACCROCHE (AC). PUR. Observation seulement.
 *  AC-01 1re phrase de 12 mots au plus.
 *  AC-02 1re phrase finie avant 3 s, au débit déclaré par la recette.
 *  AC-03 accroche entière finie avant 5 s (sauf écart de recette).
 *  AC-04 pas de préambule ni de salut (« Bonjour », « Aujourd'hui », « Dans cette vidéo »…).
 *  AC-05 un déclencheur dans les 9 premiers mots : un chiffre, une contradiction ou « pour qui ».
 *  AC-06 une tension posée tôt : la douleur du dirigeant ou une curiosité (fonction minimale).
 */
import { lignesDe, part } from "../script";
import type { Contexte, ResultatRegle } from "../types";
import { ENTREPRISE, NOMBRE, norm, resultat } from "./outils";

const PREAMBULE = /^(bonjour|salut|hello|coucou|bienvenue|aujourd'hui|dans cette video|dans cette courte video|je vais vous|on va voir|on va parler|petite video|stop\b)/;
const CONTRADICTION = /(?:^|[^a-z])(non|faux|jamais|arretez|erreur|piege|pas besoin|personne|pourtant|en fait|contrairement|mythe|idee recue|de trop)(?=$|[^a-z])/;
const POUR_QUI = /(?:^|[^a-z])(vous|votre|vos)(?=$|[^a-z])/;
const DOULEUR = /(?:^|[^a-z])(perd\w*|pertes?|coute\w*|couts?|risques?|problemes?|erreurs?|oubli\w*|trop|retards?|pieges?|dangers?|fuite\w*|amendes?|courir apres|relanc\w*|rien autorise|personne ne|de trop|a la main|chaque semaine|plus d'une heure|des heures)(?=$|[^a-z])/;
const CURIOSITE = /(\?|se cache|secret|surpren\w*|personne ne|vous ne savez|pourquoi|devinez|le troisieme|le dernier)/;

export function reglesAccroche(c: Contexte): ResultatRegle[] {
  const { lecture, seuils, script } = c;
  const premiere = lecture.phrases[0];
  if (!premiere) return [resultat(c, "AC-01", "accroche", "alerte", "non-mesure", "Script vide : rien à mesurer.")];
  const ligneId = script.lignes[premiere.ligne]?.id;
  const out: ResultatRegle[] = [];

  out.push(
    premiere.nbMots <= seuils.premierePhraseMotsMax
      ? resultat(c, "AC-01", "accroche", "alerte", "ok", `1re phrase : ${premiere.nbMots} mots.`)
      : resultat(c, "AC-01", "accroche", "alerte", "ecart", `La 1re phrase fait ${premiere.nbMots} mots : ${seuils.premierePhraseMotsMax} au plus.`, { ligneId }),
  );
  const finSec = +premiere.finSec.toFixed(2);
  out.push(
    premiere.finSec <= seuils.premierePhraseFinSec
      ? resultat(c, "AC-02", "accroche", "alerte", "ok", `1re phrase finie à ${finSec} s.`)
      : resultat(c, "AC-02", "accroche", "alerte", "ecart", `La 1re phrase finit à ${finSec} s : elle doit finir avant ${seuils.premierePhraseFinSec} s.`, { ligneId }),
  );

  const accroche = lignesDe(script, "accroche");
  if (accroche.length) {
    const derniere = script.lignes.indexOf(accroche[accroche.length - 1]);
    const motsAccroche = lecture.mots.filter((m) => m.ligne <= derniere && script.lignes[m.ligne].partie === "accroche");
    const fin = motsAccroche.length ? motsAccroche[motsAccroche.length - 1].finSec : 0;
    out.push(
      fin <= seuils.accrocheFinSecMax
        ? resultat(c, "AC-03", "accroche", "alerte", "ok", `Accroche finie à ${+fin.toFixed(2)} s.`)
        : resultat(c, "AC-03", "accroche", "alerte", "ecart", `L'accroche finit à ${+fin.toFixed(2)} s : ${seuils.accrocheFinSecMax} s au plus.`, { ligneId: accroche[0].id }),
    );
  } else out.push(resultat(c, "AC-03", "accroche", "alerte", "non-mesure", "Aucune ligne marquée « accroche » : seule la 1re phrase est mesurée."));

  const debut = norm(premiere.texte);
  out.push(
    PREAMBULE.test(debut)
      ? resultat(c, "AC-04", "accroche", "alerte", "ecart", "La 1re phrase commence par un préambule : entrez directement dans le sujet.", { ligneId })
      : resultat(c, "AC-04", "accroche", "alerte", "ok", "Pas de préambule."),
  );

  const neuf = norm(lecture.mots.slice(0, 9).map((m) => m.mot).join(" "));
  const declencheur = NOMBRE.test(neuf) ? "un chiffre" : CONTRADICTION.test(neuf) ? "une contradiction" : POUR_QUI.test(neuf) || ENTREPRISE.test(neuf) ? "« pour qui »" : null;
  out.push(
    declencheur
      ? resultat(c, "AC-05", "accroche", "info", "ok", `Déclencheur dans les 9 premiers mots : ${declencheur}.`)
      : resultat(c, "AC-05", "accroche", "info", "ecart", "Aucun chiffre, aucune contradiction ni « pour qui » dans les 9 premiers mots.", { ligneId }),
  );

  const tot = lecture.phrases.filter((p) => part(lecture, p.debutSec) < 0.4).map((p) => norm(p.texte)).join(" ");
  const tension = lignesDe(script, "douleur").length ? "la douleur" : DOULEUR.test(tot) ? "une douleur" : CURIOSITE.test(tot) ? "une curiosité" : null;
  out.push(
    tension
      ? resultat(c, "AC-06", "accroche", "alerte", "ok", `Tension posée : ${tension}.`)
      : resultat(c, "AC-06", "accroche", "alerte", "ecart", "Aucune tension avant 40 % : ni douleur du dirigeant, ni curiosité."),
  );
  return out;
}
