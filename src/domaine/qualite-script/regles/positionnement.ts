/**
 * SOCLE QUALITÉ · POSITIONNEMENT (PO), règles permanentes. PUR.
 * Observation seulement.
 *  PO-01 JAMAIS « faites-le vous-même » comme conclusion : l'entreprise est perdue face à l'IA, c'est notre métier, on
 *        s'occupe de tout. Donner de la valeur dans le corps reste permis ; montrer NOS outils (« voici ce qu'on met en
 *        place ») aussi. Lu sur la conclusion seulement (dernier quart, « à retenir », appel, fin).
 *  PO-02 JAMAIS « cet outil vient de sortir », « nouvel outil », « nouvelle fonctionnalité », « dernière mise à jour »,
 *        « X vient d'annoncer », « l'annonce de [un éditeur] », « l'annonce du lancement » (ni les gabarits 11 « annonce de la semaine » et 16 « j'ai testé les deux »).
 *  PO-03 parler du bénéfice pour l'entreprise (TPE, PME, ETI, grands groupes) : une phrase réunit l'entreprise et un gain.
 *  PO-04 tics d'écriture IA (« ce n'est pas X, c'est Y », superlatifs creux) : observation pure.
 */
import { part } from "../script";
import type { Contexte, ResultatRegle } from "../types";
import { faitLeVousMeme, NOUVEAUTE_OUTIL } from "@/domaine/positionnement";
import { ENTREPRISE, GAIN, norm, resultat } from "./outils";

export { FAITES_LE_VOUS_MEME, NOUVEAUTE_OUTIL, faitLeVousMeme } from "@/domaine/positionnement";

const BENEFICE = /(?:^|[^a-z])(gagn\w*|heures?|minutes?|jours?|temps|couts?|coute\w*|euros?|€|marges?|chiffre d'affaires|rendez-vous|erreurs?|risques?|toute seule|tout seul|automat\w*|chez vous|protege\w*|securi\w*|utile|plus vite|moins de|sans relance|signe\w*|classe)(?=$|[^a-z])/;

export const TICS_IA: readonly { motif: RegExp; libelle: string }[] = [
  { motif: /(?:^|[^a-z])(?:ce n'est pas|c'est pas|ce ne sont pas|il ne s'agit pas d)[^.!?]{1,60}(?:, c'est|\. c'est|, ce sont|, mais)(?=$|[^a-z])/, libelle: "« ce n'est pas X, c'est Y »" },
  { motif: /dans un monde ou/, libelle: "« dans un monde où »" },
  { motif: /voici pourquoi c'est important/, libelle: "« voici pourquoi c'est important »" },
  { motif: /(?:^|[^a-z])en conclusion(?=$|[^a-z])/, libelle: "« en conclusion »" },
  { motif: /(?:^|[^a-z])(revolutionnaire|game changer|incroyable|ultime|sans precedent|exceptionnel|extraordinaire|un veritable|plus que jamais|a l'ere de)(?=$|[^a-z])/, libelle: "un superlatif creux" },
];

export function reglesPositionnement(c: Contexte): ResultatRegle[] {
  const { script, lecture } = c;
  const out: ResultatRegle[] = [];

  const conclusion = script.lignes.filter((l, i) => l.partie === "a-retenir" || l.partie === "appel" || l.partie === "fin" || part(lecture, lecture.debutLigne[i]) >= 0.75);
  const diy = conclusion.map((l) => ({ l, m: faitLeVousMeme(l.dit) })).find((x) => x.m);
  out.push(
    diy
      ? resultat(c, "PO-01", "positionnement", "bloquant", "ecart", `La conclusion renvoie le spectateur à le faire seul (« ${diy.m} ») : concluez sur ce que nous mettons en place pour lui.`, { ligneId: diy.l.id })
      : resultat(c, "PO-01", "positionnement", "bloquant", "ok", "La conclusion ne dit pas « faites-le vous-même »."),
  );

  const nouveaute = script.lignes.map((l) => ({ l, m: NOUVEAUTE_OUTIL.exec(norm(l.dit)) })).find((x) => x.m);
  out.push(
    nouveaute
      ? resultat(c, "PO-02", "positionnement", "bloquant", "ecart", `Annonce d'outil (« ${nouveaute.m![1]} ») : parlez du bénéfice pour l'entreprise, pas de la nouveauté.`, { ligneId: nouveaute.l.id })
      : resultat(c, "PO-02", "positionnement", "bloquant", "ok", "Aucune annonce d'outil ou de nouveauté."),
  );

  const benefice = lecture.phrases.find((p) => {
    const t = norm(p.texte);
    return ENTREPRISE.test(t) && (BENEFICE.test(t) || GAIN.test(t));
  });
  out.push(
    benefice
      ? resultat(c, "PO-03", "positionnement", "alerte", "ok", "Le bénéfice pour l'entreprise est dit.", { ligneId: script.lignes[benefice.ligne]?.id })
      : resultat(c, "PO-03", "positionnement", "alerte", "ecart", "Aucune phrase ne relie l'entreprise du spectateur à un gain (temps, argent, clients, risque)."),
  );

  const tics = script.lignes.flatMap((l) => TICS_IA.filter((t) => t.motif.test(norm(l.dit))).map((t) => ({ l, t })));
  out.push(
    tics.length
      ? resultat(c, "PO-04", "positionnement", "info", "ecart", `Tic d'écriture IA : ${tics[0].t.libelle}.`, { ligneId: tics[0].l.id })
      : resultat(c, "PO-04", "positionnement", "info", "ok", "Aucun tic d'écriture IA repéré."),
  );
  return out;
}
