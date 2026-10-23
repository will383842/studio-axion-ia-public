/**
 * CE QUE WILL LIT d'un contrôle du script (vérification E2E n° 1, n° 18). PUR.
 *
 * Les messages des contrôles restent écrits pour la machine (codes, seuils, décimales) : ils servent à la réécriture
 * et aux journaux. À l'écran, on montre une phrase simple, sans jargon (« écart-type », « seuil », « segment »,
 * « relance », « plafond »), en virgule française et en secondes rondes.
 */
import type { ViolationControle } from "./types";

/** Premier nombre du message (« 8.7 » → 8,7), arrondi à la seconde. */
function secondes(message: string, rang = 0): string | null {
  const n = [...message.matchAll(/(\d+(?:[.,]\d+)?)\s*s\b/g)][rang]?.[1];
  return n ? `${Math.round(Number(n.replace(",", ".")))} s` : null;
}

/** Premier extrait entre guillemets français (« … »). */
function extrait(message: string): string | null {
  return /«\s*([^»]+?)\s*»/.exec(message)?.[1] ?? null;
}

const avec = (base: string, x: string | null, forme: (x: string) => string): string => (x ? forme(x) : base);

/** Phrases par contrôle ; null : le message d'origine est assez simple (il est seulement nettoyé). */
const PHRASES: Readonly<Record<string, (m: string) => string | null>> = {
  C9: () => "Les phrases ont presque toutes la même longueur : variez-en une ou deux.",
  "C9 bis": (m) => avec("Une phrase se dit trop vite : allégez-la.", extrait(m), (x) => `Phrase trop chargée pour être dite à l'aise : « ${x} ». Allégez-la.`),
  C11: (m) => avec("Un long moment sans rien de neuf : ajoutez une question ou un fait qui relance l'attention.", secondes(m), (s) => `Environ ${s} sans rien de neuf : ajoutez une question ou un fait qui relance l'attention.`),
  C12: (m) => {
    if (/^Corps court/.test(m)) return avec("Le milieu de la vidéo est court : vérifiez qu'il ne manque rien.", secondes(m), (s) => `Le milieu de la vidéo est court (${s}) : vérifiez qu'il ne manque rien.`);
    if (/^Corps de/.test(m)) return avec("Le milieu de la vidéo est trop long : à raccourcir.", secondes(m), (s) => `Le milieu de la vidéo est trop long (${s}) : à raccourcir.`);
    if (/au-delà de la zone/.test(m)) return avec("Plus long que ce que ce réseau conseille : à raccourcir.", secondes(m), (s) => `Vidéo de ${s}, plus longue que ce que ce réseau conseille : à raccourcir.`);
    if (/sous la zone/.test(m)) return avec("Plus courte que ce que ce réseau conseille. Rien d'obligatoire.", secondes(m), (s) => `Vidéo de ${s}, plus courte que ce que ce réseau conseille. Rien d'obligatoire.`);
    return null;
  },
  "C16 bis": () => "Un exemple sans chiffre tombe sur la phrase clé ou sur la dernière phrase : mieux vaut un fait chiffré.",
  C23: (m) => avec("Un long passage sans rien qui change à l'écran.", secondes(m), (s) => `${s} sans rien qui change à l'écran.`),
  C25: (m) => avec("Un sigle n'a pas encore de prononciation : vérifiez-le dans « Ma voix ».", extrait(m), (x) => `« ${x} » n'a pas encore de prononciation : vérifiez-la dans « Ma voix ».`),
  "C25 bis": (m) => avec("Un mot risque d'être mal prononcé.", extrait(m), (x) => `« ${x} » risque d'être mal prononcé.`),
  C26: (m) =>
    /^Phrase courte/.test(m)
      ? avec("Une phrase très courte : à rattacher à la suivante, ou à garder exprès.", extrait(m), (x) => `Phrase très courte (« ${x} ») : à rattacher à la suivante, ou à garder exprès.`)
      : avec("Une image reste longtemps sans changer.", secondes(m), (s) => `Une image reste ${s} sans changer.`),
  C29: (m) => (/nature différente/.test(m) ? "Deux preuves différentes dans la même phrase : séparez-les." : "Deux appuis dans la même phrase : séparez-les."),
  C31: (m) => avec("Votre matière arrive tard : mieux vaut la dire dans les 10 premières secondes.", secondes(m), (s) => `Votre matière arrive tard (à ${s}) : mieux vaut la dire dans les 10 premières secondes.`),
  C32: (m) => (/Ressenti/.test(m) ? "Votre double dit un ressenti : ce serait plus juste dit par vous." : null),
  C38: () => "La même idée revient trop souvent dans le texte.",
  "C38 bis": () => "La même preuve ou la même matière revient trop souvent.",
  C39: (m) => (/résultats de suite/.test(m) ? "Trois résultats d'affilée : glissez une question entre eux pour garder l'attention." : null),
  C46: (m) => avec("Rien de concret (un fait, une preuve, un geste) au début de la vidéo.", secondes(m), (s) => `Rien de concret (un fait, une preuve, un geste) dans les ${s} du début.`),
  "C46 bis": (m) => avec(m, secondes(m), (s) => m.replace(/attendu avant .*$/, `attendu dans les ${s} du début.`)),
  C63: (m) => (/plus court que les modèles/.test(m) ? "L'appel à agir est plus court que d'habitude." : null),
  C65: () => "Le ton annoncé ne se retrouve pas dans le texte : il a été corrigé.",
  C76: (m) => avec("Une de vos matières reste vague.", extrait(m), (x) => `Une de vos matières reste vague (« ${x} »).`),
  C78: (m) => avec("Le prix du problème arrive tard : mieux vaut le dire dans les 5 premières secondes.", secondes(m), (s) => `Le prix du problème arrive à ${s} : mieux vaut le dire dans les 5 premières secondes.`),
};

/** Nettoyage commun : virgule française, plus de parenthèse « (seuil …) » ni « (plafond …) », plus de « segment ». */
export function nettoyerMessage(message: string): string {
  return message
    .replace(/\s*\((?:seuil|plafond)[^)]*\)/g, "")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/\bsegments\b/g, "passages")
    .replace(/\bsegment\b/g, "passage")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

/** La phrase montrée à Will pour un contrôle. */
export function phraseControle(v: Pick<ViolationControle, "controle" | "message">): string {
  const p = PHRASES[v.controle]?.(v.message);
  return nettoyerMessage(p ?? v.message);
}
