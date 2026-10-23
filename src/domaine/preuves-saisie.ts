/**
 * PREUVES ALLÉGÉES (générateur, plan v5 B.10 ligne G2). PUR : importable côté client.
 *
 * Une preuve se saisit en < 20 s : Will dicte l'énoncé (la phrase exacte qu'on peut dire) ; tout le reste prend une
 * valeur par défaut (type, nature, valeurs, source « Dictée » datée du jour, péremption par type). Le « à ne pas dire »
 * est PROPOSÉ par le code et validé d'un toucher : chaque proposition ne contient AUCUN fait nouveau (aucun chiffre qui
 * ne soit déjà dans l'énoncé), elle ne fait que nommer une déformation à éviter.
 */
import type { DateIso, Preuve } from "./types";
import { peremptionParDefaut } from "./preuves";

const UNITES = "%|€|k€|euros?|h|heures?|jours?|semaines?|mois|ans?|années?|minutes?|min|clients?|salariés?|personnes?|onglets?|versions?|fichiers?|factures?|fois";
const RE_VALEUR = new RegExp(String.raw`(\d+(?:[ \u00a0\u202f.]\d{3})*(?:,\d+)?)\s?(${UNITES})?(?![\p{L}])`, "giu");

/** Valeurs chiffrées d'un énoncé, telles qu'écrites (`brut`), avec leur valeur numérique et leur unité. */
export function extraireValeurs(enonce: string): Preuve["valeurs"] {
  const sortie: Preuve["valeurs"] = [];
  for (const m of enonce.matchAll(RE_VALEUR)) {
    const nombre = Number(m[1].replace(/[   .]/g, "").replace(",", "."));
    if (!Number.isFinite(nombre)) continue;
    sortie.push({ brut: m[0].trim(), normalise: nombre, unite: m[2]?.toLowerCase() });
  }
  return sortie;
}

function normaliser(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Type proposé (confirmé d'un toucher). */
export function proposerTypePreuve(enonce: string): Preuve["type"] {
  const n = normaliser(enonce);
  if (/\b(loi|decret|article|reglement|code du travail|code civil|obligatoire depuis|arrete)\b/.test(n)) return "regle-loi";
  if (/https?:\/\/|\b(etude|selon|enquete|sondage|barometre|rapport)\b/.test(n)) return "etude";
  if (/\b(client|cliente|chez un|chez une|une pme que j|un dirigeant que j)\b/.test(n)) return "cas-client";
  return "chiffre-interne";
}

const MOTS_VAGUES = /\b(une partie|beaucoup|plusieurs|la plupart|souvent|certains|certaines|pas mal|enormement|nettement|moins de temps|plus vite)\b/;

/** Nature : chiffrée si l'énoncé porte un chiffre ; vague (« une partie ») ; sinon qualitative (un ressenti). */
export function natureDe(enonce: string, valeurs: Preuve["valeurs"] = extraireValeurs(enonce)): Preuve["nature"] {
  if (valeurs.length) return "chiffree";
  if (MOTS_VAGUES.test(normaliser(enonce))) return "vague";
  return "qualitative";
}

export interface SaisiePreuve {
  enonce: string;
  /** « Ce qu'on peut dire » : formulations autorisées en plus de l'énoncé. */
  peutDire?: string[];
  type?: Preuve["type"];
  source?: Partial<Preuve["source"]>;
  client?: Preuve["client"];
  pilier?: string;
}

/** Une preuve complète à partir de l'énoncé seul (valeurs par défaut de G2). Saisie par Will : validée d'office. */
export function preuveParDefaut(s: SaisiePreuve, maintenant: DateIso): Omit<Preuve, "id" | "creeLe" | "modifieLe"> {
  const enonce = s.enonce.trim();
  const type = s.type ?? proposerTypePreuve(enonce);
  const valeurs = extraireValeurs(enonce);
  const nature = natureDe(enonce, valeurs);
  const date = s.source?.date ?? maintenant;
  return {
    enonce,
    type,
    nature,
    valeurs,
    formulationsAutorisees: [enonce, ...(s.peutDire ?? []).map((x) => x.trim()).filter((x) => x && x !== enonce)],
    formulationsInterdites: [],
    motsClesIncompatibles: [],
    source: { titre: s.source?.titre?.trim() || "Dictée", url: s.source?.url, date, editeurOutil: s.source?.editeurOutil },
    saisiePar: "will",
    niveau: type === "etude" || type === "regle-loi" ? "prouve" : nature === "qualitative" ? "opinion" : "observe",
    client: type === "cas-client" ? (s.client ?? { anonymise: true, accordEcrit: false }) : s.client,
    motsCles: [],
    pilier: s.pilier,
    statut: "validee",
    valideeLe: maintenant,
    perimeLe: peremptionParDefaut({ preuve: type }, date) ?? undefined,
  };
}

export interface PropositionANePasDire {
  texte: string;
  raison: string;
}

/** Les nombres d'un texte (pour vérifier qu'une proposition n'ajoute aucun fait). */
export function nombresDe(texte: string): string[] {
  return (texte.match(/\d+(?:[,.]\d+)?/g) ?? []).map((x) => x.replace(",", "."));
}

/** Une proposition n'ajoute aucun fait : chacun de ses nombres figure déjà dans l'énoncé. */
export function sansFaitAjoute(enonce: string, proposition: string): boolean {
  const permis = new Set(nombresDe(enonce));
  return nombresDe(proposition).every((n) => permis.has(n));
}

/** Unités féminines (accord de « garanti », « gagné »). */
function feminin(unite: string): boolean {
  return /^(h|heures?|semaines?|minutes?|min|années?|personnes?|versions?|factures?|fois|%)$/i.test(unite);
}

/** « de 6 heures à 1 heure » (même unité) : le gain réel, avec l'unité au pluriel. */
function gainDe(p: Pick<Preuve, "enonce" | "valeurs">): { gain: string; unite: string } | null {
  const [a, b] = p.valeurs;
  if (!a || !b || !/\bde\s/i.test(p.enonce) || !/\sà\s/i.test(p.enonce)) return null;
  const ua = (a.unite ?? "").replace(/s$/, "");
  const ub = (b.unite ?? "").replace(/s$/, "");
  if (!ua || ua !== ub) return null;
  const gain = Math.abs(a.normalise - b.normalise);
  if (!gain) return null;
  const unite = ua === "h" ? "heures" : /s$|x$/.test(ua) || ua === "%" || ua === "€" || ua === "mois" ? ua : `${ua}s`;
  return { gain: String(gain).replace(".", ","), unite };
}

/**
 * « À ne pas dire » PROPOSÉ (validé d'un toucher, jamais appliqué avant) : exagérer, promettre, généraliser un cas,
 * chiffrer un ordre de grandeur vague, présenter un ressenti comme une mesure. Aucune proposition n'ajoute de fait.
 */
export function proposerANePasDire(p: Pick<Preuve, "enonce" | "type" | "nature" | "valeurs">): PropositionANePasDire[] {
  const sortie: PropositionANePasDire[] = [];
  const v = p.valeurs[0];
  const g = gainDe(p);
  if (p.nature === "chiffree" && g) {
    // « passée de 6 heures à 1 heure » : la déformation porte sur le GAIN (5 heures), pas sur le premier nombre.
    const e = feminin(g.unite) ? "e" : "";
    const quoi = `${g.gain} ${g.unite} gagné${e}s`;
    sortie.push({ texte: `plus de ${quoi}`, raison: "Exagère le gain" });
    sortie.push({ texte: `${quoi} garanti${e}s`, raison: "Promet un résultat" });
    sortie.push({ texte: p.type === "cas-client" ? `${quoi} pour tous nos clients` : `${quoi} à chaque fois`, raison: p.type === "cas-client" ? "Fait d'un cas une règle" : "Généralise" });
    sortie.push({ texte: `en moyenne ${quoi}`, raison: "Une moyenne qui n'a pas été mesurée" });
    const vus = new Set<string>();
    return sortie.filter((x) => sansFaitAjoute(`${p.enonce} ${g.gain}`, x.texte) && !vus.has(x.texte) && !!vus.add(x.texte)).slice(0, 4);
  }
  if (p.nature === "chiffree" && v) {
    const accord = v.unite && feminin(v.unite) ? "garanties" : "garantis";
    sortie.push({ texte: `plus de ${v.brut}`, raison: "Exagère le chiffre" });
    sortie.push({ texte: `${v.brut} ${accord}`, raison: "Promet un résultat" });
    if (p.type === "cas-client") {
      sortie.push({ texte: `${v.brut} pour tous nos clients`, raison: "Fait d'un cas une règle" });
      sortie.push({ texte: `en moyenne ${v.brut}`, raison: "Une moyenne qui n'a pas été mesurée" });
    } else {
      sortie.push({ texte: `${v.brut} à chaque fois`, raison: "Généralise" });
    }
  } else if (p.nature === "vague") {
    sortie.push({ texte: "tous", raison: "Change « une partie » en totalité" });
    sortie.push({ texte: "systématiquement", raison: "Généralise" });
    sortie.push({ texte: "un chiffre précis", raison: "Chiffre un ordre de grandeur" });
  } else {
    sortie.push({ texte: "c'est prouvé", raison: "Un ressenti présenté comme une mesure" });
    sortie.push({ texte: "à coup sûr", raison: "Promet un résultat" });
  }
  const vus = new Set<string>();
  return sortie.filter((x) => sansFaitAjoute(p.enonce, x.texte) && !vus.has(x.texte) && !!vus.add(x.texte)).slice(0, 4);
}
