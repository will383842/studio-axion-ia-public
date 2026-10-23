/**
 * DIVERSITÉ ET RUPTURES (addendum du 02/10, §2 sexies, ordre de Will du 03/10 ; lot G4). PUR.
 *
 * Les règles « douleur », « récit de cas client » et « cible située » ne doivent jamais devenir une formule. Sur les 10
 * dernières vidéos de la série :
 *  - C84 ouvertures qui tournent : jamais la même manière d'ouvrir 2 fois d'affilée ni plus de 2 fois sur 5 ;
 *        « Un dirigeant… » en 1re phrase au plus 1 vidéo sur 4 ;
 *  - C85 récit de cas client au plus 1 vidéo sur 3 ;
 *  - C86 fins qui tournent : jamais la même fin 3 fois d'affilée ; « écrivez-nous » au plus 1 vidéo sur 3 ;
 *  - C87 une expression marquante au plus 1 fois par vidéo et pas dans 2 vidéos d'affilée ;
 *  - C88 environ 1 sujet sur 5 en RUPTURE (forme inattendue, mêmes garde-fous) ;
 *  - douleur au plus 2 sur 3 (C80, `probleme.ts`), les autres en gain ou en curiosité : c'est l'INTENSITÉ ; la douleur reste nommée dans chaque script (C94).
 * `consignesDiversite` traduit la série en consignes pour les rôles ; `controlerDiversite` vérifie une version écrite.
 */
import type { ViolationControle } from "./types";

export const TYPES_OUVERTURE = ["resultat-dabord", "scene-present", "question-recue", "chiffre", "idee-recue-dementie", "geste-ecran", "avis-tranche", "vous-direct", "citation-dirigeant", "situation"] as const;
export type TypeOuverture = (typeof TYPES_OUVERTURE)[number];

export const TYPES_FIN = ["appel", "fin-sur-le-fait", "question-ouverte", "boucle", "defi"] as const;
export type TypeFin = (typeof TYPES_FIN)[number];

export const RUPTURES = ["liste-rapide", "demonstration-ecran", "coulisses", "reponse-commentaire", "pour-contre", "erreur-de-will", "defi-chronometre"] as const;
export type Rupture = (typeof RUPTURES)[number];

export const LIBELLES_RUPTURE: Readonly<Record<Rupture, string>> = {
  "liste-rapide": "liste rapide (« 3 tâches que… »)",
  "demonstration-ecran": "démonstration à l'écran",
  coulisses: "coulisses d'Axion-IA",
  "reponse-commentaire": "réponse à un commentaire réel",
  "pour-contre": "mini-débat pour / contre",
  "erreur-de-will": "une erreur que Will a faite",
  "defi-chronometre": "défi chronométré",
};

/** Expressions marquantes qui ne passent pas dans 2 vidéos d'affilée. */
export const EXPRESSIONS_MARQUANTES = ["sauf que", "résultat :", "le pire", "et là", "concrètement", "la vérité", "en réalité", "le problème", "spoiler", "par contre", "en revanche", "à moins que"];

export type Intensite = "douleur" | "gain" | "curiosite";

export interface ElementDiversite {
  ouverture: TypeOuverture;
  unDirigeant: boolean;
  fin: TypeFin;
  ecrivezNous: boolean;
  recit: boolean;
  intensite?: Intensite;
  rupture?: Rupture;
  expressions: string[];
}

function norm(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "'");
}

/** Manière d'ouvrir, lue sur la 1re phrase dite. */
export function typeOuverture(phrase: string): TypeOuverture {
  const n = norm(phrase.trim());
  if (/^(on m\x27a demande|question recue|on me demande|vous m\x27avez demande|on m\x27a ecrit)/.test(n)) return "question-recue";
  if (/^«|^\x22|m\x27a dit :|nous a dit :/.test(n)) return "citation-dirigeant";
  if (/(on vous a dit|vous pensez|on croit|les gens (pensent|croient)|tout le monde (pense|croit))/.test(n)) return "idee-recue-dementie";
  if (/^(regardez|voici|je vous montre|a l\x27ecran)/.test(n)) return "geste-ecran";
  if (/(aujourd\x27hui ?:|est passe de|sont passes de|ne prend plus|zero heure|a ete divise|j\x27ai fait annuler|je lui ai obtenu|nous lui avons)/.test(n)) return "resultat-dabord";
  if (/^\d|^(un|une|deux|trois|quatre|cinq|dix|cent|mille)\b[^.]{0,20}\b(heures?|jours?|%|pour cent|euros?|fichiers?|devis|factures?)/.test(n)) return "chiffre";
  if (/^(il ne faut jamais|ne (confiez|signez|payez|faites)|n\x27(acceptez|envoyez))|totalement|c\x27est (illegal|une erreur|inutile)|mon verdict/.test(n)) return "avis-tranche";
  if (/^(vous|votre|vos)\b/.test(n)) return "vous-direct";
  if (/^(chez|mardi|lundi|ce matin|hier|la semaine derniere|un (dirigeant|client|patron|daf|comptable)|une (dirigeante|cliente|daf|comptable))/.test(n)) return "scene-present";
  return "situation";
}

/** Fin d'une version : appel (et « écrivez-nous »), question ouverte, défi, boucle, fin sur le fait. */
export function typeFin(appel: string, boucle: string, derniereInfo: string): { fin: TypeFin; ecrivezNous: boolean } {
  const a = norm(appel.trim());
  const ecrivezNous = /(ecrivez[- ]nous|contactez[- ]nous|envoyez[- ]nous un message|ecrivez-moi|contactez-moi)/.test(a);
  if (boucle.trim()) return { fin: "boucle", ecrivezNous };
  if (/(essayez|testez|cette semaine|faites l.essai)/.test(a)) return { fin: "defi", ecrivezNous };
  if (a && a.endsWith("?")) return { fin: "question-ouverte", ecrivezNous };
  if (a) return { fin: "appel", ecrivezNous };
  if (norm(derniereInfo).trim().endsWith("?")) return { fin: "question-ouverte", ecrivezNous };
  return { fin: "fin-sur-le-fait", ecrivezNous };
}

export function expressionsDe(texte: string): string[] {
  const n = norm(texte);
  return EXPRESSIONS_MARQUANTES.filter((e) => n.includes(norm(e)));
}

/** Ce qu'une version écrite apporte à la série. */
export function elementDiversite(o: { accroche: string; appel: string; boucle: string; derniereInfo: string; texte: string; recit: boolean; intensite?: Intensite; rupture?: Rupture }): ElementDiversite {
  const f = typeFin(o.appel, o.boucle, o.derniereInfo);
  return { ouverture: typeOuverture(o.accroche), unDirigeant: /^un(e)? (dirigeant|dirigeante|patron|chef d'entreprise)\b/.test(norm(o.accroche.trim())), fin: f.fin, ecrivezNous: f.ecrivezNous, recit: o.recit, intensite: o.intensite, rupture: o.rupture, expressions: expressionsDe(o.texte) };
}

export interface ConsignesDiversite {
  ouverturesInterdites: TypeOuverture[];
  unDirigeantInterdit: boolean;
  finsInterdites: TypeFin[];
  ecrivezNousInterdit: boolean;
  recitInterdit: boolean;
  douleurInterdite: boolean;
  expressionsInterdites: string[];
  /** Ce sujet doit sortir du moule (≈ 1 sur 5). */
  rupture?: Rupture;
}

/** Les règles de la série traduites en consignes pour le sujet suivant (10 dernières vidéos). */
export function consignesDiversite(serie: readonly ElementDiversite[], possibles: { ruptures?: readonly Rupture[] } = {}): ConsignesDiversite {
  const dix = serie.slice(-10);
  const cinq = dix.slice(-5);
  const quatre = dix.slice(-4);
  const trois = dix.slice(-3);
  const dernier = dix.at(-1);
  const ouverturesInterdites = TYPES_OUVERTURE.filter((t) => dernier?.ouverture === t || cinq.filter((x) => x.ouverture === t).length >= 2);
  const deuxFins = dix.slice(-2);
  const finsInterdites = TYPES_FIN.filter((t) => deuxFins.length === 2 && deuxFins.every((x) => x.fin === t));
  const ruptureDue = dix.length >= 4 && !dix.slice(-4).some((x) => x.rupture);
  const dejaFaites = new Set(dix.map((x) => x.rupture).filter(Boolean));
  const candidates = (possibles.ruptures ?? RUPTURES).filter((r) => !dejaFaites.has(r));
  return {
    ouverturesInterdites,
    unDirigeantInterdit: quatre.slice(-3).some((x) => x.unDirigeant),
    finsInterdites,
    ecrivezNousInterdit: trois.slice(-2).some((x) => x.ecrivezNous),
    recitInterdit: trois.slice(-2).some((x) => x.recit),
    douleurInterdite: trois.slice(-2).length === 2 && trois.slice(-2).every((x) => x.intensite === "douleur"),
    expressionsInterdites: dernier?.expressions ?? [],
    rupture: ruptureDue ? (candidates[0] ?? (possibles.ruptures ?? RUPTURES)[0]) : undefined,
  };
}

/** Rendu pour les rôles (données). */
export function rendreConsignesDiversite(c: ConsignesDiversite): string {
  const l: string[] = [];
  if (c.ouverturesInterdites.length) l.push(`Manières d'ouvrir déjà trop utilisées (à éviter) : ${c.ouverturesInterdites.join(", ")}.`);
  if (c.unDirigeantInterdit) l.push("Interdit cette fois : commencer la 1re phrase par « Un dirigeant… ».");
  if (c.finsInterdites.length) l.push(`Fins déjà utilisées deux fois de suite (à éviter) : ${c.finsInterdites.join(", ")}.`);
  if (c.ecrivezNousInterdit) l.push("Interdit cette fois : un appel « écrivez-nous » ou « contactez-nous ».");
  if (c.recitInterdit) l.push("Pas de récit de cas client cette fois (déjà dans une des 2 dernières vidéos).");
  if (c.douleurInterdite) l.push("Pas d'angle « douleur » cette fois : un angle « gain » ou « curiosité » (« saviez-vous que… »), toujours utile.");
  if (c.expressionsInterdites.length) l.push(`Expressions de la vidéo précédente, à ne pas reprendre : ${c.expressionsInterdites.map((x) => `« ${x} »`).join(", ")}.`);
  if (c.rupture) l.push(`CE SUJET EST UNE RUPTURE : forme inattendue « ${LIBELLES_RUPTURE[c.rupture]} », dans le domaine d'Axion-IA, avec les mêmes garde-fous (vrai, prouvé, utile).`);
  return l.length ? `<diversite>\n${l.join("\n")}\n</diversite>` : "";
}

const a = (controle: string, message: string): ViolationControle => ({ controle, message, bloquant: false, niveau: "alerte" });

/** Contrôle de série d'une version écrite face aux 10 dernières (C84-C88, alertes : jamais bloquantes). */
export function controlerDiversite(serie: readonly ElementDiversite[], nouveau: ElementDiversite): ViolationControle[] {
  const dix = serie.slice(-10);
  const out: ViolationControle[] = [];
  if (dix.at(-1)?.ouverture === nouveau.ouverture) out.push(a("C84", `Même manière d'ouvrir que la vidéo précédente (« ${nouveau.ouverture} »).`));
  else if (dix.slice(-4).filter((x) => x.ouverture === nouveau.ouverture).length >= 2) out.push(a("C84", `« ${nouveau.ouverture} » : plus de 2 ouvertures sur 5.`));
  if (nouveau.unDirigeant && dix.slice(-3).some((x) => x.unDirigeant)) out.push(a("C84", "« Un dirigeant… » en 1re phrase plus d'une vidéo sur 4."));
  if (nouveau.recit && dix.slice(-2).some((x) => x.recit)) out.push(a("C85", "Récit de cas client plus d'une vidéo sur 3."));
  if (dix.slice(-2).length === 2 && dix.slice(-2).every((x) => x.fin === nouveau.fin)) out.push(a("C86", `Même fin 3 fois d'affilée (« ${nouveau.fin} »).`));
  if (nouveau.ecrivezNous && dix.slice(-2).some((x) => x.ecrivezNous)) out.push(a("C86", "« Écrivez-nous » plus d'une vidéo sur 3."));
  const reprises = nouveau.expressions.filter((e) => dix.at(-1)?.expressions.includes(e));
  if (reprises.length) out.push(a("C87", `Expression marquante reprise de la vidéo précédente : ${reprises.map((x) => `« ${x} »`).join(", ")}.`));
  if (dix.length >= 4 && !dix.slice(-4).some((x) => x.rupture) && !nouveau.rupture) out.push({ controle: "C88", message: "Aucune rupture depuis 5 sujets : la prochaine devrait sortir du moule.", bloquant: false, niveau: "info" });
  return out;
}
