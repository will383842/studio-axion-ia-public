/**
 * CIBLES DE PUBLICATION ZERNIO (z2e, D9) : où part un envoi, jamais une page par défaut.
 * Cibles du Studio : « accountId », « accountId:fb:<pageId> », « accountId:li:<n°> », « accountId:li:profil » (profil seulement
 * s'il est prouvé : le fournisseur ne le liste que dans ce cas). Ces identifiants vivent en base sur le serveur, jamais dans le dépôt.
 * Facebook et LinkedIn : la cible est TOUJOURS explicite (choisie parmi celles que le fournisseur liste).
 * Fonction sans effet de bord : elle lit la liste des comptes que le fournisseur rend, rien d'autre.
 */
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";
import type { IdReseau } from "@/domaine/types";
import { pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import { journaliserEnvoi } from "./journal-envoi";

export type CiblesZernio = { ok: true; canaux: CanalPublication[] } | { ok: false; code: "CIBLE_ABSENTE" | "CIBLE_INCONNUE" | "CIBLE_AMBIGUE"; message: string };

/** Réseaux dont la cible doit être choisie à la main : plusieurs pages ou profils sous un même compte. */
const CIBLE_EXPLICITE: readonly string[] = ["facebook", "linkedin"];

export async function ciblesZernioPour(service: FournisseurPublication, reseau: IdReseau, choisies?: string[]): Promise<CiblesZernio> {
  const c = await ciblesZernioPourInterne(service, reseau, choisies);
  // Trace sans nom ni identifiant de compte : le code du refus, ou « OK » et le nombre de comptes ciblés.
  journaliserEnvoi({ action: "ciblesZernioPour", outil: "zernio", reseau, code: c.ok ? "OK" : c.code, nbComptes: c.ok ? c.canaux.length : 0 });
  return c;
}

async function ciblesZernioPourInterne(service: FournisseurPublication, reseau: IdReseau, choisies?: string[]): Promise<CiblesZernio> {
  if (!service.listerCanaux) return { ok: false, code: "CIBLE_ABSENTE", message: "L'outil de publication ne donne pas la liste de ses comptes : l'envoi est refusé." };
  const plateforme = plateformeZernio(reseau);
  const disponibles = (await service.listerCanaux()).filter((c) => c.service === plateforme && !c.deconnecte && !canalInterdit(c));
  const demandees = [...new Set((choisies ?? []).filter((c) => typeof c === "string" && c.trim()))];
  if (demandees.length) {
    // Traduction ambiguë (deux comptes de Zernio portent le nom choisi) : le refus nomme les choix, jamais un tirage au sort.
    const ambigu = demandees.find((id) => id.startsWith(`${SELECTION_NON_TRADUITE}|`));
    if (ambigu) return { ok: false, code: "CIBLE_AMBIGUE", message: ambigu.slice(SELECTION_NON_TRADUITE.length + 1) };
    const inconnues = demandees.filter((id) => !disponibles.some((c) => c.id === id));
    if (inconnues.length) return { ok: false, code: "CIBLE_INCONNUE", message: "Le compte choisi n'est pas relié à l'outil de publication pour ce réseau." };
    return { ok: true, canaux: demandees.map((id) => disponibles.find((c) => c.id === id)!) };
  }
  // Rien de choisi : jamais pour Facebook ni LinkedIn (aucune page par défaut) ; ailleurs, seulement s'il n'y a qu'un compte.
  if (CIBLE_EXPLICITE.includes(plateforme)) {
    const noms = disponibles.map((c) => `« ${c.nom} »`);
    const aCocher = noms.length ? ` Pages ou profils reliés à Zernio : ${noms.join(", ")}.` : "";
    return { ok: false, code: "CIBLE_ABSENTE", message: `Cochez la page ou le profil de destination (liste « Compte Buffer » de la page) : aucune cible par défaut n'est utilisée.${aCocher}` };
  }
  if (disponibles.length === 1) return { ok: true, canaux: disponibles };
  if (!disponibles.length) return { ok: false, code: "CIBLE_ABSENTE", message: "Aucun compte relié à l'outil de publication pour ce réseau." };
  return { ok: false, code: "CIBLE_AMBIGUE", message: "Plusieurs comptes sont reliés pour ce réseau : choisissez-en un." };
}

/** Marqueur d'une présélection qui ne se traduit pas : jamais un identifiant de Zernio, donc refusé net (CIBLE_INCONNUE). */
export const SELECTION_NON_TRADUITE = "selection-buffer-non-traduite";

/** Marqueur porteur d'un refus clair (« marqueur|phrase ») : ciblesZernioPour rend la phrase telle quelle. */
const idPageDe = (c: CanalPublication) => (c.id.includes(":fb:") ? c.id.split(":fb:")[1] : undefined);

/** Page Facebook de la liste des pages jamais ciblées (identifiant de page ET nom normalisé). */
const canalInterdit = (c: CanalPublication) => c.service === "facebook" && pageInterdite(idPageDe(c), c.nom);

/** Même page vue par plusieurs comptes, aucun n'ayant cette page par défaut : refus qui le dit (jamais de choix au hasard). */
const refusMemePage = (nom: string) =>
  `${SELECTION_NON_TRADUITE}|La page « ${nom} » est visible depuis plusieurs comptes de l'outil de publication, et aucun d'eux ne l'a comme page par défaut : l'envoi est refusé, rien n'est choisi au hasard. Réglez la page par défaut du compte voulu chez l'outil de publication, ou gardez un seul de ces comptes relié.`;

const refusAmbigu = (nom: string, homonymes: CanalPublication[]) =>
  `${SELECTION_NON_TRADUITE}|Plusieurs comptes de l'outil de publication portent le nom « ${nom} » (${homonymes.map((c) => `…${c.id.slice(-6)}`).join(" et ")}) : l'envoi est refusé, rien n'est choisi au hasard. Gardez un seul de ces comptes relié, ou renommez-en un chez l'outil de publication.`;

const normaliserNom = (nom: string) => nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Présélection de l'écran (identifiants de canaux BUFFER) → cibles de ZERNIO, par le service et le nom du compte.
 * Aucun identifiant ne passe d'un outil à l'autre : un compte Buffer sans homologue de même nom n'est jamais deviné.
 * - rien de présélectionné : `undefined` (le choix habituel de Zernio s'applique : le seul compte, sinon refus clair) ;
 * - un seul compte présélectionné sans homologue : `undefined` aussi (Zernio retombe sur son seul compte du réseau, ou refuse s'ils sont plusieurs) ;
 * - plusieurs comptes dont un sans homologue : le marqueur, donc refus (rien ne part sur un autre compte que ceux choisis).
 * Fonction sans effet de bord : elle lit la liste des comptes de Zernio, rien d'autre.
 */
export async function traduireSelectionVersZernio(service: FournisseurPublication, reseau: IdReseau, choisisBuffer: string[] | undefined, canauxBuffer: CanalPublication[]): Promise<string[] | undefined> {
  const ids = [...new Set((choisisBuffer ?? []).filter((c) => typeof c === "string" && c.trim()))];
  if (!ids.length) return undefined;
  if (!service.listerCanaux) return [SELECTION_NON_TRADUITE];
  const plateforme = plateformeZernio(reseau);
  const disponibles = (await service.listerCanaux()).filter((c) => c.service === plateforme && !c.deconnecte && !canalInterdit(c));
  const traduits: string[] = [];
  let sansHomologue = 0;
  let ambigu: string | undefined;
  for (const id of ids) {
    const source = canauxBuffer.find((c) => c.id === id);
    const homologue = source ? disponibles.filter((c) => normaliserNom(c.nom) === normaliserNom(source.nom)) : [];
    if (homologue.length === 1) traduits.push(homologue[0].id);
    else if (homologue.length > 1 && source) {
      const pages = new Set(homologue.map(idPageDe));
      ambigu ??= pages.size === 1 && !pages.has(undefined) ? refusMemePage(source.nom) : refusAmbigu(source.nom, homologue);
    }
    else sansHomologue++;
  }
  if (ambigu) return [ambigu];
  if (!sansHomologue) return [...new Set(traduits)];
  if (ids.length === 1) return undefined;
  return [SELECTION_NON_TRADUITE];
}
