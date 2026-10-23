/**
 * Textes de publication SIMULÉS (kit, AV2.3-11). PUR : partagé par le rédacteur simulé et les données de démonstration.
 * La phrase de durée et les mots-dièse dépendent du format et de la durée réelle de la vidéo.
 */
import type { Adresse, IdReseau } from "./types";
import { estReseauDeclinaison } from "@/reseaux/codes";
import { ecritureReseau } from "@/reseaux/ecriture";

/** Mots-dièse par format (le thème d'un format avocat n'est pas celui d'un podcast ou d'une démonstration). */
const MOTS_DIESE: Record<string, string[]> = {
  // « avocat » est un STYLE de vidéo : le thème reste celui d'Axion-IA (E2E-2 parcours n° 21), jamais le droit.
  avocat: ["#PME", "#IA", "#Automatisation", "#Dirigeant", "#AxionIA"],
  podcast: ["#Podcast", "#IA", "#Entrepreneuriat", "#PME", "#AxionIA"],
  "ecran-partage": ["#Productivité", "#Outils", "#IA", "#PME", "#AxionIA"],
  motion: ["#IA", "#PME", "#Chiffres", "#Productivité", "#AxionIA"],
  ugc: ["#Avis", "#IA", "#Productivité", "#PME", "#AxionIA"],
  selfie: ["#Entrepreneur", "#PME", "#IA", "#Coulisses", "#AxionIA"],
  "tableau-anime": ["#IA", "#PME", "#Automatisation", "#Entreprise", "#AxionIA"],
  defaut: ["#IA", "#PME", "#Entreprise", "#Productivité", "#AxionIA"],
};

export function motsDiesePour(formatId: string | undefined, reseau: IdReseau, nombre: number): string[] {
  const base = MOTS_DIESE[formatId ?? ""] ?? MOTS_DIESE.defaut;
  const liste = reseau === "youtube-shorts" ? ["#Shorts", ...base] : base;
  return liste.slice(0, Math.max(0, nombre));
}

/** « en moins d'une minute » seulement si c'est vrai ; sinon la durée réelle (« en 10 min », « en 1 min 30 »). */
export function phraseDuree(dureeSec: number | undefined, adresse: Adresse = "vous"): string {
  const debut = adresse === "tu" ? "Je t'explique tout" : "Je vous explique tout";
  if (!dureeSec || dureeSec <= 60) return `${debut} en moins d'une minute.`;
  const m = Math.floor(dureeSec / 60);
  const s = Math.round(dureeSec % 60);
  return `${debut} en ${s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`}.`;
}

/**
 * Assemble une légende sans jamais couper la mention IA ni les crédits :
 * c'est le corps qui est raccourci (avec « … ») si la limite du réseau est atteinte.
 */
export function composerLegende(corps: string, suffixes: string[], longueurMax: number): string {
  const fin = finJointe(suffixes);
  const sep = fin ? SEPARATEUR_FIN : "";
  const place = placeDuCorps(suffixes, longueurMax);
  if (place <= 0) return fin.slice(0, longueurMax);
  const c = corps.length > place ? `${corps.slice(0, Math.max(0, place - 1)).trimEnd()}…` : corps;
  return `${c}${sep}${fin}`;
}

/** Caractères laissés au corps une fois la fin (mention, crédits) posée par `composerLegende` (≤ 0 : aucune place). */
export function placeDuCorps(suffixes: string[], longueurMax: number): number {
  const fin = finJointe(suffixes);
  return longueurMax - fin.length - (fin ? SEPARATEUR_FIN.length : 0);
}

/** Séparateur entre le corps et la fin, et entre les éléments de la fin (une ligne vide). */
const SEPARATEUR_FIN = "\n\n";

function finJointe(suffixes: string[]): string {
  return suffixes.filter(Boolean).join(SEPARATEUR_FIN);
}

/** Fin d'un texte de publication, ajoutée par le code et jamais coupée : la mention (si activée), puis les crédits. */
export function finDuTexte(mention: string, credits: string[]): string[] {
  return [mention, ...credits.map((c) => `Crédit : ${c}`)].filter(Boolean);
}

/**
 * Corps SIMULÉ d'un texte de publication (sans mention ni crédits, ajoutés par `composerLegende`). PUR : partagé par le
 * rédacteur simulé et la simulation du rôle « publication » (lot R2) : le texte d'essai reste exactement le même.
 */
export function corpsTexteSimule(d: { reseau: IdReseau; titre: string; texteScript: string; dureeSec?: number; adresse?: Adresse }): string {
  const lue = d.texteScript.split(/(?<=[.?!])\s/)[0] ?? d.titre;
  // La première phrase est souvent le titre lui-même : jamais deux fois de suite (E2E-1 n° 12).
  const comparable = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const premiere = comparable(lue) === comparable(d.titre) ? "" : lue;
  return d.reseau === "linkedin"
    ? [d.titre, premiere, phraseDuree(d.dureeSec, d.adresse), d.adresse === "tu" ? "Et toi, qu'en penses-tu ?" : "Et vous, qu'en pensez-vous ?"].filter(Boolean).join("\n\n")
    : d.reseau === "youtube-shorts"
      ? d.titre
      : d.reseau === "youtube"
        ? premiere || d.titre
        : avecTermeDuCompte([d.titre, premiere].filter(Boolean).join("\n"), d.reseau);
}

/* ------------------------------------------------------------------ */
/* Équipe 7 : la description dit de quoi parle le compte (TikTok)       */
/* ------------------------------------------------------------------ */

/** Termes du compte d'un réseau (règle d'écriture `termesDuCompte`), vide s'il n'en a pas. */
export function termesDuCompte(reseau: IdReseau): string[] {
  return estReseauDeclinaison(reseau) ? (ecritureReseau(reseau).termesDuCompte?.valeur ?? []) : [];
}

const comparable = (t: string) =>
  ` ${t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;

/** Le texte écrit-il un des termes (mots entiers : « l'IA » oui, « PIAF » non) ? Par défaut : ceux de TikTok. */
export function contientTermeDuCompte(texte: string, termes: string[] = termesDuCompte("tiktok")): boolean {
  const t = comparable(texte);
  return termes.some((x) => comparable(x).trim() && t.includes(comparable(x)));
}

/** Ligne neutre ajoutée par le code quand la description n'écrit aucun terme du compte. */
export const LIGNE_TERME_DU_COMPTE = "Intelligence artificielle en entreprise.";

/**
 * Description d'un réseau qui a des termes du compte (TikTok) : si aucun n'y est écrit, le code ajoute une ligne neutre
 * à la fin du corps (jamais en première ligne : le mot-clé y reste). Ailleurs, rien ne change.
 */
export function avecTermeDuCompte(corps: string, reseau: IdReseau): string {
  const termes = termesDuCompte(reseau);
  if (!termes.length || contientTermeDuCompte(corps, termes)) return corps;
  return corps.trim() ? `${corps.trimEnd()}\n${LIGNE_TERME_DU_COMPTE}` : LIGNE_TERME_DU_COMPTE;
}
