/**
 * C95 · POSITIONNEMENT DE WILL (lot A2). PUR. « Jamais faites-le vous-même, on s'occupe de tout pour vous » et jamais
 * d'annonce d'outil. Machine : BLOQUANT (garde-fou) ; texte de Will : information seulement.
 * La conclusion (dernier quart, appel, boucle) passe par `faitLeVousMeme` ; le corps passe par `diyFormule` et `tutorielNumerote`, tout le texte dit par
 * `NOUVEAUTE_OUTIL` (règles partagées : `domaine/positionnement`).
 */
import { diyFormule, faitLeVousMeme, NOUVEAUTE_OUTIL, tutorielNumerote } from "@/domaine/positionnement";
import { segmentsParles, type Analyse, type Collecte } from "./analyse";
import { normaliser } from "./texte";
import type { EntreeControle } from "./types";

export function c95(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a);
  if (!parles.length) return;
  const debutDernierQuart = a.dureeSec * 0.75;
  const conclusion = parles.filter((s) => s.role === "appel" || s.role === "boucle" || s.debutSec >= debutDernierQuart);
  const fin = conclusion.map((s) => ({ s, m: faitLeVousMeme(s.dit) })).find((x) => x.m);
  if (fin) {
    col.ajouter("C95", `La conclusion renvoie le spectateur à le faire seul (« ${fin.m} ») : concluez sur ce que nous mettons en place pour lui.`, { segmentIndex: fin.s.index });
    return;
  }
  const nouveaute = parles.map((s) => ({ s, m: NOUVEAUTE_OUTIL.exec(normaliser(s.dit)) })).find((x) => x.m);
  if (nouveaute) {
    col.ajouter("C95", `Annonce d'outil (« ${nouveaute.m![1]} ») : parlez du bénéfice pour l'entreprise, pas de la nouveauté.`, { segmentIndex: nouveaute.s.index });
    return;
  }
  // Le CORPS seul (jamais l'appel ni la boucle) : une formule « faites-le », ou un tutoriel NUMÉROTÉ (« Un. Listez… Deux. Cochez… »).
  // La suite de 3 impératifs sans numéro n'est qu'une alerte (C96).
  const corps = parles.filter((s) => s.role === "corps" || s.role === "promesse").map((s) => s.dit).join(" ");
  const formule = diyFormule(corps);
  if (formule) col.ajouter("C95", `Le corps renvoie le spectateur à le faire seul (« ${formule} ») : montrez ce que NOUS mettons en place, jamais un tutoriel.`);
  else if (tutorielNumerote(corps, e.adresse)) col.ajouter("C95", "Le corps est un tutoriel numéroté (« Un. Listez… Deux. Cochez… ») : montrez ce que NOUS mettons en place, jamais un tutoriel.");
}
