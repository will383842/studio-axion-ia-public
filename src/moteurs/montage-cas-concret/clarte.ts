/**
 * CLARTÉ D'UN SCRIPT (24/10/2026). Le script réel de LT-02 était incompréhensible : sujet jamais dit, aucune scène ni exemple
 * suivi, étiquettes abstraites lues telles quelles, « Possible. », question finale sans rapport. Ce contrôle PUR relit une
 * fiche déjà valide au regard du récit du cas (`cas.recit`) :
 *  C1 chaque mot clé du récit est dit dans les 3 premiers écrans ;
 *  C2 au moins 2 mots pleins de la scène, absents des tâches « avant » (qui se disent de toute façon), sont dits avant la bascule ;
 *  C3 le nom noyau de l'exemple (son premier mot plein) ou un mot clé est repris dans la moitié au moins des étapes, et au
 *     résultat ou à la question ; aucune étape ne commence par un pronom (« Elle », « Il », « Tout ») sans ce nom dans la phrase d'avant ;
 *  C4 aucune phrase de moins de 3 mots (« Possible. ») ;
 *  C5 aucune phrase égale au titre d'une étape du cas (une étiquette lue telle quelle) ;
 *  C6 la question finale reprend un mot clé ou le nom noyau de l'exemple ;
 *  C7 aucune suite de 5 mots reprise d'une description de forme (`PATRONS`).
 * Sans récit : seulement C4, C5 et C7, en alerte (jamais un refus). Les mots se comparent par leur racine
 * (« demande » et « demandes » sont le même mot).
 */
import { motsPleins, racine } from "@/domaine/controles-script/texte";
import { phrasesDe } from "@/domaine/lecture";
import { sequencesDe } from "@/domaine/ecriture-commune/ressemblance";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { cleMot, motsLus, type FicheEcrans } from "./fiche";
import { PATRONS } from "./patrons-ecriture";

export type CritereClarte = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
export interface ManqueClarte {
  critere: CritereClarte;
  detail: string;
}

/** Nombre minimal de mots pleins de la scène, absents des tâches « avant » (qui se disent de toute façon), à dire avant la bascule. */
export const SCENE_MOTS_PLEINS_MIN = 2;
/** Une phrase dite compte au moins ce nombre de mots lus. */
export const PHRASE_MOTS_MIN = 3;
/** Longueur de la suite de mots qu'une forme de patron ne doit pas voir recopiée. */
export const SUITE_FORME_MAX = 5;

const racinesDe = (t: string): Set<string> => new Set(motsPleins(t).map(racine));
/** Un mot clé (« e-mails », « rendez-vous ») compte pour les racines de ses mots pleins. */
const racinesDuMot = (m: string): string[] => motsPleins(m).map(racine);
const cleTitre = (t: string) => motsLus(t.replace(/\*/g, "")).map(cleMot).join(" ");
const PREFIXE = /^\s*(avant|résultat|resultat)\s*:\s*/i;

let formesCache: Set<string> | undefined;
const sequencesDesFormes = (): Set<string> => (formesCache ??= new Set(Object.values(PATRONS).flatMap((l) => l.flatMap((p) => sequencesDe(p.forme, SUITE_FORME_MAX)))));

/** Les manques de clarté d'une fiche. `refuser` : le cas a un récit, tous les critères comptent. */
export function controlerClarte(fiche: FicheEcrans, cas: Pick<CasConcret, "recit" | "etapes" | "avant">): ManqueClarte[] {
  const manques: ManqueClarte[] = [];
  const ecrans = fiche.ecrans;
  const dit = (i: number, j: number) => ecrans.slice(i, j).map((e) => e.texteDit).join(" ");
  // Les points d'un sigle lu (« I.A. », « C.R.M. ») ne finissent pas une phrase.
  const tout = ecrans.map((e) => e.texteDit).join(" ").replace(/(?<![\p{L}\p{N}])(?:\p{Lu}\.){2,}/gu, (m) => m.replace(/\./g, ""));
  const phrases = phrasesDe(tout);

  // C4 : phrase trop courte (le préfixe « Avant : » ou « Résultat : » ne compte pas).
  for (const p of phrases) {
    const n = motsLus(p.replace(PREFIXE, "")).length;
    if (n < PHRASE_MOTS_MIN) manques.push({ critere: "C4", detail: `la phrase « ${p} » est trop courte (${n} mot${n > 1 ? "s" : ""}) : une phrase compte au moins ${PHRASE_MOTS_MIN} mots et nomme son sujet.` });
  }
  // C5 : une phrase égale au titre d'une étape du cas est une étiquette lue telle quelle.
  const titres = new Map(cas.etapes.map((e) => [cleTitre(e.titre), e.titre]));
  for (const p of phrases) {
    const t = titres.get(cleTitre(p.replace(PREFIXE, "")));
    if (t) manques.push({ critere: "C5", detail: `la phrase « ${p} » n'est que le titre d'étape « ${t} » : dites ce qui arrive à l'exemple suivi, pas une étiquette.` });
  }
  // C7 : une suite de mots recopiée d'une description de forme.
  const formes = sequencesDesFormes();
  const copiees = sequencesDe(tout, SUITE_FORME_MAX).filter((s) => formes.has(s));
  if (copiees.length) manques.push({ critere: "C7", detail: `le script recopie une description de forme (« ${copiees[0]} ») : une forme se suit, elle ne se dit pas.` });

  const r = cas.recit;
  if (r) {
    // C1 : les mots clés dans les 3 premiers écrans.
    const premiers = racinesDe(dit(0, 3));
    const absents = r.motsCles.filter((m) => !racinesDuMot(m).every((x) => premiers.has(x)));
    if (absents.length) manques.push({ critere: "C1", detail: `les trois premiers écrans ne disent pas ${absents.map((m) => `« ${m} »`).join(", ")} : le sujet (« ${r.sujet} ») doit être compris avant le 3e écran.` });

    // C2 : la scène, avant la bascule.
    const iTitre = ecrans.findIndex((e) => e.type === "titre");
    const avantBascule = racinesDe(dit(0, iTitre < 0 ? Math.max(3, ecrans.findIndex((e) => e.type === "etape")) : iTitre));
    const taches = racinesDe(cas.avant.taches.join(" "));
    const scene = [...racinesDe(r.scene)].filter((m) => !taches.has(m));
    const dits = scene.filter((m) => avantBascule.has(m));
    if (dits.length < SCENE_MOTS_PLEINS_MIN) manques.push({ critere: "C2", detail: `la scène n'est pas racontée avant la bascule : ${dits.length} mot${dits.length > 1 ? "s" : ""} plein${dits.length > 1 ? "s" : ""} de « ${r.scene} » (hors tâches « avant ») dit${dits.length > 1 ? "s" : ""}, il en faut ${SCENE_MOTS_PLEINS_MIN} au moins.` });

    // C3 : l'exemple suivi à travers les étapes, puis au résultat ou à la question.
    // Seuls comptent le nom noyau de l'exemple (son premier mot plein) et les mots clés.
    const noyau = motsPleins(r.exemple).slice(0, 1).map(racine);
    const suivis = new Set([...noyau, ...r.motsCles.flatMap(racinesDuMot)]);
    const reprend = (t: string) => [...racinesDe(t)].some((m) => suivis.has(m));
    const etapes = ecrans.filter((e) => e.type === "etape" || e.type === "objet");
    const reprises = etapes.filter((e) => reprend(e.texteDit)).length;
    const bout = ecrans.filter((e) => e.type === "resultat" || e.type === "question").some((e) => reprend(e.texteDit));
    // Une étape ne commence pas par un pronom (« Elle est triée », « Tout s'enregistre ») sans le nom dans la phrase d'avant.
    const PRONOM = /^(?:(?:puis|alors|ensuite|et|complète,?)\s+)?(?:elle|il|elles|ils|tout|cela|ça)(?![\p{L}])/iu;
    const sansNom = ecrans.filter((e, i) => (e.type === "etape" || e.type === "objet") && PRONOM.test(e.texteDit.trim()) && !(i > 0 && reprend(ecrans[i - 1].texteDit)));
    if (sansNom.length) manques.push({ critere: "C3", detail: `l'étape « ${sansNom[0].texteDit.trim()} » commence par un pronom sans que le nom (« ${r.exemple} ») soit dans la phrase d'avant : nommez la chose.` });
    if (etapes.length && (reprises * 2 < etapes.length || !bout)) {
      manques.push({ critere: "C3", detail: `l'exemple suivi (« ${r.exemple} ») n'est repris que dans ${reprises} étape${reprises > 1 ? "s" : ""} sur ${etapes.length}${bout ? "" : ", ni au résultat ni à la question"} : chaque étape dit ce qui arrive à cette chose.` });
    }

    // C6 : la question finale parle du même problème.
    const question = ecrans.filter((e) => e.type === "question").at(-1);
    if (question) {
      const permis = new Set([...r.motsCles.flatMap(racinesDuMot), ...motsPleins(r.exemple).slice(0, 1).map(racine)]);
      if (![...racinesDe(question.texteDit)].some((m) => permis.has(m))) manques.push({ critere: "C6", detail: `la question finale (« ${question.texteDit.trim()} ») ne porte pas sur le problème du sujet (« ${r.sujet} »).` });
    }
  }
  return r ? manques : manques.filter((m) => m.critere === "C4" || m.critere === "C5" || m.critere === "C7");
}

/** Le refus (ou la note) d'un manque, avec son critère. */
export const messageClarte = (m: ManqueClarte): string => `Clarté ${m.critere} : ${m.detail}`;
