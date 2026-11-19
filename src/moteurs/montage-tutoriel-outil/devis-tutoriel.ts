/**
 * T-EXT-42 : DEVIS ET PLAFOND PAR VIDÉO du tutoriel d'outil, montrés AVANT toute dépense, EN QUANTITÉS (jamais en montant).
 *
 * Pur : aucun service, aucun appel, aucun montant. Le devis dit « combien d'appels à Claude, de caractères de voix, de
 * rendus » ; son empreinte change dès que le script, les rôles ou les formats changent, et l'accord de Williams (écrit
 * par l'écran de validation, clé d'entrée PROPRE `tutorielOutilDevis`) ne vaut que pour l'empreinte qu'il a vue.
 * Le plafond en dollars reste interne (T-EXT-30) et n'est jamais affiché.
 */
import type { Ratio } from "@/domaine/types";
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import { MOTS_PAR_SECONDE } from "./script";

/** Clé d'entrée propre à l'accord du devis (à côté de `tutorielOutil`, jamais dans `entrees.ts`). */
export const ENTREE_DEVIS_TUTORIEL = "tutorielOutilDevis";

const LIBELLE_ESSAI = "Rendu d'essai";
const LIBELLE_FORMATS = "Rendus des formats";

export const VERSION_DEVIS_TUTORIEL = "devis-tutoriel.v1";

export type PosteDevis = "claude" | "voix" | "rendu";
export type UniteDevis = "appel" | "caractere" | "seconde" | "rendu";

export interface LigneDevis {
  poste: PosteDevis;
  libelle: string;
  quantite: number;
  unite: UniteDevis;
}

export interface DevisTutoriel {
  version: typeof VERSION_DEVIS_TUTORIEL;
  lignes: LigneDevis[];
  empreinte: string;
}

export interface AccordDevis {
  empreinte: string;
  le: string;
}

export interface RoleDevis {
  id: string;
  essaisMax: number;
}

export interface Consommation {
  appelsClaude: number;
  caracteresVoix: number;
  rendus: number;
}

export interface EntreeDevis {
  roles: readonly RoleDevis[];
  caracteresScript: number;
  /** Le script lu : son empreinte entre dans celle du devis (un mot changé = nouvel accord, même à nombre de caractères égal). */
  texteScript?: string;
  motsScript: number;
  voixDejaPayee: boolean;
  ratios: readonly Ratio[];
  essai: boolean;
}

const entierPositif = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Lecture tolérante de l'accord posé par l'écran de validation : mal formé = pas d'accord. */
export function lireAccordDevis(entrees: Record<string, unknown> | undefined): AccordDevis | null {
  const e = entrees?.[ENTREE_DEVIS_TUTORIEL];
  if (!e || typeof e !== "object") return null;
  const { empreinte, le } = e as Record<string, unknown>;
  return typeof empreinte === "string" && empreinte.trim() && typeof le === "string" && le.trim() ? { empreinte: empreinte.trim(), le: le.trim() } : null;
}

/** Le devis, déterministe : appels Claude = Σ essais ; voix = caractères et secondes (0 si déjà payée) ; rendus = essai + formats. */
export function etablirDevis(e: EntreeDevis): DevisTutoriel {
  const appels = e.roles.reduce((s, r) => s + entierPositif(r.essaisMax), 0);
  const caracteres = e.voixDejaPayee ? 0 : entierPositif(e.caracteresScript);
  const secondes = e.voixDejaPayee ? 0 : Math.ceil(entierPositif(e.motsScript) / MOTS_PAR_SECONDE);
  const lignes: LigneDevis[] = [
    { poste: "claude", libelle: "Appels à Claude", quantite: appels, unite: "appel" },
    { poste: "voix", libelle: "Voix (caractères)", quantite: caracteres, unite: "caractere" },
    { poste: "voix", libelle: "Voix (durée)", quantite: secondes, unite: "seconde" },
    { poste: "rendu", libelle: LIBELLE_ESSAI, quantite: e.essai ? 1 : 0, unite: "rendu" },
    { poste: "rendu", libelle: LIBELLE_FORMATS, quantite: e.ratios.length, unite: "rendu" },
  ];
  return { version: VERSION_DEVIS_TUTORIEL, lignes, empreinte: fnv1a64(jsonCanonique({ lignes, ratios: [...e.ratios], roles: e.roles.map((r) => [r.id, entierPositif(r.essaisMax)]), script: fnv1a64(e.texteScript ?? "") })) };
}

const quantiteDe = (d: DevisTutoriel, unite: UniteDevis): number => d.lignes.filter((l) => l.unite === unite).reduce((s, l) => s + l.quantite, 0);
const quantiteLibelle = (d: DevisTutoriel, libelle: string): number => d.lignes.find((l) => l.libelle === libelle)?.quantite ?? 0;

/** Phrases montrées à Williams : des quantités, aucun montant. */
export function texteDevis(d: DevisTutoriel): string[] {
  const appels = quantiteDe(d, "appel");
  const caracteres = quantiteDe(d, "caractere");
  const secondes = quantiteDe(d, "seconde");
  const essai = quantiteLibelle(d, LIBELLE_ESSAI);
  const formats = quantiteLibelle(d, LIBELLE_FORMATS);
  const nomFormats = `${formats} format${formats > 1 ? "s" : ""}`;
  return [
    `Claude : ${appels} appel${appels > 1 ? "s" : ""} au plus`,
    caracteres ? `Voix : ${caracteres} caractères (environ ${secondes} s)` : "Voix : rien à lire pour cette vidéo",
    essai > 0 ? `Rendus : ${essai} essai et ${nomFormats}` : `Rendus : ${nomFormats}`,
  ];
}

/** Vrai seulement si Williams a vu CE devis : script, rôles ou formats changés → nouvel accord. */
export function accordValide(d: DevisTutoriel, accord: AccordDevis | null | undefined): boolean {
  return !!accord && accord.empreinte === d.empreinte;
}

const NOM_POSTE: Record<PosteDevis, string> = { claude: "Claude", voix: "voix", rendu: "rendus" };

/** Le plafond par vidéo, en quantités : atteint dès que le déjà consommé PLUS ce que l'étape peut encore dépenser (`aVenir`) dépasse (égal = encore dans le devis). */
export function resteDuDevis(d: DevisTutoriel, consomme: Consommation, aVenir: Partial<Consommation> = {}): { ok: true } | { ok: false; poste: PosteDevis; message: string } {
  const verifs: [PosteDevis, number, number][] = [
    ["claude", consomme.appelsClaude + entierPositif(aVenir.appelsClaude), quantiteDe(d, "appel")],
    ["voix", consomme.caracteresVoix + entierPositif(aVenir.caracteresVoix), quantiteDe(d, "caractere")],
    ["rendu", consomme.rendus + entierPositif(aVenir.rendus), quantiteDe(d, "rendu")],
  ];
  const depasse = verifs.find(([, vu, permis]) => vu > permis);
  return depasse ? { ok: false, poste: depasse[0], message: `Le devis de cette vidéo est atteint (${NOM_POSTE[depasse[0]]}) : rien de plus n'est lancé sans votre accord.` } : { ok: true };
}
