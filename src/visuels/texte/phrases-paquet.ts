import type { z } from "zod";
import { libelleDansPage } from "./libelles-champs";
import { Paquet, TAILLE_PAQUET_MAX } from "./session";

/** Nombre maximal de champs fautifs montrés d'un coup. */
const MAX_PHRASES = 5;

const TETE_PAQUET: Record<string, string> = { version: "Version du paquet", sujet: "Sujet", titre: "Titre", pourquoi: "Pourquoi", spec: "Carrousel" };

function lieu(chemin: readonly (string | number)[]): string {
  const [debut, ...reste] = chemin;
  if (debut === "spec") {
    if (reste[0] === "alt") return "Texte alternatif";
    if (reste[0] === "version") return "Version du carrousel";
    if (reste[0] === "pages") {
      if (typeof reste[1] !== "number") return "Pages du carrousel";
      const dansPage = reste.slice(2);
      const dans = libelleDansPage(dansPage.at(-1) === "type" ? dansPage.slice(0, -1) : dansPage);
      return `Page ${reste[1] + 1}${dans ? `, ${dans}` : ""}`;
    }
    return "Carrousel";
  }
  if (debut === "pourquoi" && typeof reste[0] === "number") return `Pourquoi, phrase ${reste[0] + 1}`;
  return TETE_PAQUET[String(debut)] ?? "Le paquet";
}

function detail(issue: z.core.$ZodIssue): string {
  const i = issue as unknown as Record<string, unknown>;
  const surPage = issue.path[0] === "spec" && issue.path[1] === "pages";
  switch (issue.code) {
    case "unrecognized_keys":
      return `champ inconnu « ${(i.keys as string[]).join(" », « ")} »`;
    case "too_big":
      return i.origin === "array" ? `trop nombreux (${String(i.maximum)} au plus)` : `trop long (${String(i.maximum)} signes au plus)`;
    case "too_small":
      return i.origin === "array" ? `trop peu nombreux (${String(i.minimum)} au moins)` : `trop court (${String(i.minimum)} signe${Number(i.minimum) > 1 ? "s" : ""} au moins)`;
    case "invalid_type":
      return "valeur absente ou du mauvais type";
    case "invalid_union":
      return surPage ? "type de page inconnu (voir la liste ci-dessous)" : "valeur non admise";
    case "invalid_value":
      return issue.path.at(-1) === "type" ? "type de page inconnu (voir la liste ci-dessous)" : "valeur non admise";
    case "invalid_format":
      return "aucun lien n'est permis dans un texte";
    default: {
      const signes = /\((\d+) signes au plus\)/.exec(issue.message);
      return signes ? `trop long (${signes[1]} signes au plus)` : issue.message.replace(/[.\s]+$/u, "");
    }
  }
}

/** Phrases (jusqu'à 5) qui disent, champ par champ, ce qui ne va pas dans un texte déposé. Liste vide : le paquet est lisible. PUR. */
export function phrasesPaquetSession(contenu: string): string[] {
  if (contenu.trim() === "") return ["Le texte déposé est vide."];
  if (new TextEncoder().encode(contenu).length > TAILLE_PAQUET_MAX) return ["Le texte dépasse 64 Ko : déposez-en un plus court."];
  let brut: unknown;
  try {
    brut = JSON.parse(contenu);
  } catch {
    return ["Le texte n'est pas un JSON lisible : vérifiez les accolades, les guillemets et les virgules."];
  }
  const lu = Paquet.safeParse(brut);
  if (lu.success) return [];
  const phrases = lu.error.issues.map((issue) => `${lieu(issue.path.map((k) => (typeof k === "symbol" ? String(k) : k)))} : ${detail(issue)}`);
  return [...new Set(phrases)].slice(0, MAX_PHRASES);
}
