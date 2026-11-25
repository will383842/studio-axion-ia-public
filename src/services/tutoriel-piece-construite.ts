/**
 * PHRASE-3 · LA MAQUETTE CRÉÉE DEPUIS UNE PHRASE, CONSTRUITE PAR LE STUDIO (sans IA, 0 €, aucun réseau, aucun navigateur).
 *
 * Depuis une `DescriptionMaquette` (`description-maquette.v1`, déjà relue) :
 *  - `construireLaMaquette` : le constructeur existant (`construireMaquette`, option vivante : c'est elle qui anime le film) écrit les
 *    4 fichiers de la maquette sur la charte, puis `controlerMaquette` (pur) les contrôle ; les défauts sont dits en phrases simples.
 *  - `apercuDuStudio` : l'aperçu que la chaîne range quand une maquette est « à construire » (empreinte = celle de la pièce, `controle` =
 *    le contrôle ci-dessus, AUCUNE image : le Studio n'a pas de navigateur ; `source: "studio"`).
 *  - `zipDeLaPieceGardee` : le .zip EN MÉMOIRE (date fixe, octets toujours les mêmes) de la maquette GARDÉE, que la capture automatique
 *    envoie au poste comme un dossier déposé. Il passe `extraireZipSur` comme n'importe quel dossier. L'empreinte de la pièce est revérifiée
 *    avant, et le parcours du réalisateur doit tomber sur des écrans et des zones qui existent dans la page construite.
 *
 * Les ressources (charte, police) sont lues à l'exécution dans `outils/` (comme la réserve de maquettes de démonstration : mêmes fonctions).
 * Le constructeur et le contrôle vivent sous `src/` (l'image du Studio n'embarque pas le reste d'`outils/`) ; `outils/` les ré-exporte.
 * Aucune donnée du client dans ce que ce fichier journalise : il ne journalise rien.
 */
import "server-only";
import { creerZip } from "@/lib/zip";
import { construireMaquette, NOMS_FICHIERS, type NomFichier } from "@/moteurs/montage-tutoriel-outil/constructeur/construire";
import { controlerMaquette, type Defaut, type NomsNeutres } from "@/moteurs/montage-tutoriel-outil/constructeur/controle-charte";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import type { PieceCreee } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import { empreinteDescription, VERSION_APERCU, type ApercuPiece } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import type { ScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";
import { DATE_ZIP, lireCharteEtPolice, lireFichierParDefaut, POLICE } from "./tutoriel-reserve-maquettes";
import { NOMS_NEUTRES } from "./tutoriel-piece-creee";

/** Clé de la maquette pour le contrôle de la charte (le nom neutre contrôlé est celui de la description elle-même). */
const CLE_MAQUETTE = "maquette-creee";

/** Phrases fixes (vouvoiement, sans mot technique, aucune donnée du client). */
export const PHRASE_CHARTE_ILLISIBLE = "La charte de la maquette n'a pas pu être lue : la capture automatique ne peut pas préparer ce film, déposez-le à la main.";
export const PHRASE_DESCRIPTION_ILLISIBLE = "Les textes de la maquette ne passent pas la relecture : demandez une autre proposition.";
export const PHRASE_PIECE_NON_GARDEE = "La maquette n'est pas (ou plus) celle que vous avez gardée : rien n'est filmé, gardez-la de nouveau.";
export const PHRASE_PARCOURS_HORS_MAQUETTE = "Le parcours prévu pour le film passe par un écran que la maquette gardée n'a pas : déposez le film à la main.";
export const PHRASE_MAQUETTE_REFUSEE = "La maquette gardée ne passe plus les règles de la charte : rien n'est filmé, déposez le film à la main.";
export const PHRASE_ZIP_TROP_GROS = "La maquette gardée est trop grosse pour le poste de capture : déposez le film à la main.";

/** Un défaut du contrôle de la charte, dit en une phrase simple (jamais le nom de la règle, ni une ligne de code). */
const PHRASE_DEFAUT: Record<string, string> = {
  bleu: "La maquette contient du bleu : la charte n'en veut pas.",
  jaune: "La maquette contient du jaune : la charte n'en veut pas.",
  degrade: "La maquette contient un dégradé de couleurs : la charte n'en veut pas.",
  police: "La maquette utilise une écriture qui n'est pas celle de la charte.",
  argent: "La maquette montre un montant en euros : elle n'en montre jamais.",
  marque: "La maquette porte un nom qui n'est pas un nom neutre.",
  flou: "La maquette contient un effet de flou : la charte n'en veut pas.",
  reseau: "La maquette appelle une adresse sur internet : elle doit se suffire à elle-même.",
  pilotage: "La maquette ne peut pas être commandée pour être filmée.",
};
const PHRASE_DEFAUT_AUTRE = "La maquette ne respecte pas une règle de la charte.";

/** Défauts du contrôle en phrases simples, sans doublon, dans l'ordre où ils sont trouvés. */
export function phrasesDesDefauts(defauts: readonly Defaut[]): string[] {
  return [...new Set(defauts.map((d) => PHRASE_DEFAUT[d.regle] ?? PHRASE_DEFAUT_AUTRE))];
}

export interface DependancesPieceConstruite {
  /** Lecture d'un fichier régulier (charte, police). Défaut : le disque, sans suivre un lien. */
  lireFichier?: (chemin: string) => Promise<Buffer>;
}

export interface MaquetteConstruite {
  description: DescriptionMaquette;
  /** Les 4 fichiers du constructeur, tels que contrôlés. */
  fichiers: Record<NomFichier, string>;
  /** La charte (déjà réécrite : la police se lit à côté de `styles.css`) et la police : de quoi faire le zip. */
  charteCss: string;
  police: Uint8Array;
  controle: { ok: boolean; defauts: string[] };
}

/** Erreur qui porte sa phrase (fixe, aucune donnée du client). */
export class ErreurPieceConstruite extends Error {
  constructor(readonly phrase: string) {
    super(phrase);
    this.name = "ErreurPieceConstruite";
  }
}

/** Empreinte de la description rangée dans la pièce, recalculée ; `null` si elle n'est pas calculable. */
function empreinteDeLaPiece(piece: PieceCreee): string | null {
  try {
    return empreinteDescription(piece.contenu as DescriptionMaquette);
  } catch {
    return null;
  }
}

/** La description de la pièce, relue strictement ; `null` si elle est illisible ou n'est pas celle de l'empreinte de la pièce. */
function descriptionDeLaPiece(piece: PieceCreee): DescriptionMaquette | null {
  try {
    if (piece.genre !== "maquette" || empreinteDeLaPiece(piece) !== piece.empreinte) return null;
    const lue = lireDescriptionMaquette(piece.contenu, { interdits: NOMS_NEUTRES.interdits });
    return lue.ok ? lue.description : null;
  } catch {
    return null;
  }
}

/**
 * Construit la maquette (vivante) et la contrôle. Lève `ErreurPieceConstruite` seulement si la charte ou la police sont illisibles
 * (panne d'installation : rien n'est alors rangé). Un défaut de la charte n'est pas une panne : il est rendu dans `controle`.
 */
export async function construireLaMaquette(description: DescriptionMaquette, dep: DependancesPieceConstruite = {}): Promise<MaquetteConstruite> {
  let charte: { css: string; police: Uint8Array };
  try {
    charte = await lireCharteEtPolice(dep.lireFichier ?? lireFichierParDefaut);
  } catch {
    throw new ErreurPieceConstruite(PHRASE_CHARTE_ILLISIBLE);
  }
  // Les écrans neutres de `ecrans-outils/` ne sont pas dans l'image du Studio : un écran d'un autre modèle est dessiné en écran générique
  // (comme le fait déjà l'écriture de la maquette sur le poste, `ecrans: {}`).
  const { fichiers } = construireMaquette(description, { charteCss: charte.css, ecrans: {} }, { vivant: true });
  const noms: NomsNeutres = { version: 1, verifieLe: "", interdits: NOMS_NEUTRES.interdits, maquettes: { [CLE_MAQUETTE]: { produit: description.nom, organisation: description.entreprise } } };
  const verdict = controlerMaquette(NOMS_FICHIERS.map((chemin) => ({ chemin, contenu: fichiers[chemin] })), noms, CLE_MAQUETTE);
  return { description, fichiers, charteCss: charte.css, police: charte.police, controle: { ok: verdict.ok, defauts: phrasesDesDefauts(verdict.defauts) } };
}

/**
 * L'aperçu que le Studio range pour une maquette « à construire » : sans image, `source: "studio"`, empreinte de la pièce.
 * `null` si la pièce n'est pas une maquette ou n'est plus celle de son empreinte (rien ne doit être rangé).
 * Une description que le constructeur ne sait pas relire donne un aperçu « à revoir » (contrôle en échec), jamais un arrêt muet.
 * Lève `ErreurPieceConstruite` si la charte est illisible (le port la rattrape : la pièce reste « à construire »).
 */
export async function apercuDuStudio(piece: PieceCreee, dep: DependancesPieceConstruite = {}): Promise<ApercuPiece | null> {
  if (piece.genre !== "maquette" || empreinteDeLaPiece(piece) !== piece.empreinte) return null;
  const description = descriptionDeLaPiece(piece);
  const controle = description ? (await construireLaMaquette(description, dep)).controle : { ok: false, defauts: [PHRASE_DESCRIPTION_ILLISIBLE] };
  return { version: VERSION_APERCU, empreinteDescription: piece.empreinte, images: [], controle, source: "studio" };
}

/** Écrans et zones que la page construite sait montrer : `window.demoMaquette.aller` accepte « avant », « maintenant », un écran ou une zone. */
export function cibles(description: DescriptionMaquette): Set<string> {
  return new Set(["avant", "maintenant", ...description.ecrans.map((e) => e.id), ...description.ecrans.flatMap((e) => e.zones.map((z) => z.id))]);
}

/** Les étapes du parcours qui visent un écran ou une zone absent de la maquette (identifiants des étapes, sans texte du client). */
export function etapesHorsMaquette(scenario: ScenarioMaquette, description: DescriptionMaquette, indexHtml: string): string[] {
  const permis = cibles(description);
  return scenario.etapes
    .filter((e) => {
      if (!permis.has(e.aller)) return true;
      // Une zone visée doit aussi se retrouver dans la page elle-même (`data-zone`), pas seulement dans la description.
      if (e.cible) {
        const m = /^\[data-zone="([^"]+)"\]$/.exec(e.cible);
        if (m && !indexHtml.includes(`data-zone="${m[1]}"`)) return true;
      }
      return false;
    })
    .map((e) => e.id);
}

/**
 * Le .zip EN MÉMOIRE de la maquette GARDÉE (même octets pour la même description) : `index.html`, `app.js`, `demo-data.js`, `styles.css`
 * et la police à la racine. Refus (phrase fixe) si la pièce n'est pas une maquette gardée dont l'empreinte est celle du oui de Williams,
 * si la charte la refuse, ou si le parcours (`scenario`) vise un écran ou une zone que la page n'a pas.
 */
export async function zipDeLaPieceGardee(piece: PieceCreee, scenario: ScenarioMaquette, dep: DependancesPieceConstruite = {}): Promise<{ ok: true; zip: Uint8Array } | { ok: false; phrase: string }> {
  try {
    if (piece.genre !== "maquette" || piece.statut !== "gardee" || piece.gardee?.empreinte !== piece.empreinte) return { ok: false, phrase: PHRASE_PIECE_NON_GARDEE };
    const description = descriptionDeLaPiece(piece);
    if (!description) return { ok: false, phrase: PHRASE_PIECE_NON_GARDEE };
    const c = await construireLaMaquette(description, dep);
    if (!c.controle.ok) return { ok: false, phrase: PHRASE_MAQUETTE_REFUSEE };
    if (etapesHorsMaquette(scenario, description, c.fichiers["index.html"]).length > 0) return { ok: false, phrase: PHRASE_PARCOURS_HORS_MAQUETTE };
    const enc = new TextEncoder();
    const fichiers = [
      ...NOMS_FICHIERS.map((nom) => ({ nom, donnees: enc.encode(c.fichiers[nom]), date: DATE_ZIP })),
      { nom: POLICE, donnees: c.police, date: DATE_ZIP },
    ];
    return { ok: true, zip: creerZip(fichiers) };
  } catch (e) {
    return { ok: false, phrase: e instanceof ErreurPieceConstruite ? e.phrase : PHRASE_MAQUETTE_REFUSEE };
  }
}
