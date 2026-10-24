/**
 * Opération `visuel-page` (file courte, carrousels V2-A, M2-01) : UNE page de la composition VisuelPage en JPEG.
 * Paramètres : `proprietes` ({ spec, index }, validées par `validerProprietesPage` : schéma Zod strict), `scale` (1 ou 2,
 * défaut 1), `jpegQuality` (88 à 90, défaut 88). AUCUNE URL n'est acceptée : ni dans `proprietes`, ni en entrée.
 * Mesures (SEC-02) : la page écrit une ligne dans la console du navigateur, lue par `onBrowserLog` ; seule la ligne qui porte
 * le NONCE tiré pour CE rendu compte. Mesure absente = échec. Un texte coupé dans une carte fait échouer le rendu (refus).
 * Sortie : JPEG déposé à `sortie.urlDepot`. Mesures : debordements, taillePoliceMin, largeur, hauteur, scale, octets.
 */
import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { validerProprietesPage } from "../../../src/visuels/proprietes-page.js";
import { extraireMesure, formaterMesure, ID_COMPOSITION_MESURE } from "../../compositions/visuels/mesure/protocole.js";
import { ErreurRendu, type DemandeRendu, type Operation } from "../contrat.js";
import { deposer } from "../outils.js";
import { paquetMesure } from "../paquet-mesure.js";
import { REGLAGES_RENDU } from "../remotion.js";

export { extraireMesure, formaterMesure };

export const SCALES_PERMIS = [1, 2] as const;
export const QUALITE_JPEG = { min: 88, max: 90, defaut: 88 } as const;
const PARAMETRES_CONNUS = ["proprietes", "scale", "jpegQuality"];

export interface EntreeRendu {
  /** Propriétés validées + `nonce` : tout ce que la composition reçoit. */
  inputProps: Record<string, unknown>;
  scale: number;
  jpegQuality: number;
  sortie: string;
  surLog: (ligne: string) => void;
  signal: AbortSignal;
}

export interface DependancesVisuelPage {
  rendre(entree: EntreeRendu): Promise<{ largeur: number; hauteur: number }>;
  deposer(urlDepot: string, chemin: string, mime: string, signal?: AbortSignal): Promise<void>;
}

const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });

/** Vrai si une chaîne ressemble à une adresse : schéma, « // », « www. » ou « data: ». PUR. */
export function ressembleAUneUrl(s: string): boolean {
  return /(?:^|[^a-z0-9])[a-z][a-z0-9+.-]*:\s*\/\/|\/\/|www\./i.test(s) || /(?:^|[^a-z0-9])(?:data|javascript|file|blob|mailto):/i.test(s);
}

/** Cherche une URL dans toutes les chaînes (clés comprises) d'une valeur JSON. PUR. */
export function contientUneUrl(valeur: unknown): boolean {
  if (typeof valeur === "string") return ressembleAUneUrl(valeur);
  if (Array.isArray(valeur)) return valeur.some(contientUneUrl);
  if (valeur && typeof valeur === "object") return Object.entries(valeur).some(([k, v]) => ressembleAUneUrl(k) || contientUneUrl(v));
  return false;
}

/** Réglages demandés, bornés ; lève un refus sinon. PUR. */
export function reglagesVisuelPage(parametres: DemandeRendu["parametres"]): { scale: number; jpegQuality: number } {
  const inconnu = Object.keys(parametres).find((k) => !PARAMETRES_CONNUS.includes(k));
  if (inconnu) throw refus(`Paramètre inconnu « ${inconnu} »`);
  const scale = parametres.scale ?? 1;
  if (scale !== 1 && scale !== 2) throw refus("scale : 1 ou 2 seulement");
  const jpegQuality = parametres.jpegQuality ?? QUALITE_JPEG.defaut;
  if (typeof jpegQuality !== "number" || !Number.isInteger(jpegQuality) || jpegQuality < QUALITE_JPEG.min || jpegQuality > QUALITE_JPEG.max) {
    throw refus(`jpegQuality : entier de ${QUALITE_JPEG.min} à ${QUALITE_JPEG.max}`);
  }
  return { scale, jpegQuality };
}

/**
 * Propriétés refusées par `validerProprietesPage` : un refus, sauf une version de composition inconnue (le studio et studio-rendu
 * ne sont pas encore à la même version, mise en ligne en cours) : indisponible, à réessayer. PUR.
 */
export function erreurDeValidation(message: string): ErreurRendu {
  if (message.startsWith("Version de composition")) return new ErreurRendu({ code: "indisponible", reessayable: true, message });
  return refus(message);
}

/** Message sans chemin interne (dossiers du conteneur, fichiers sources) : ils ne regardent pas le studio. PUR. */
export function sansChemins(message: string): string {
  return message
    .replace(/(?:[A-Za-z]:)?[\\/][^\s"'`:;)]*[\\/][^\s"'`:;)]*/g, "…")
    .replace(/[^\s"'`/\\]+\.(?:[cm]?[jt]sx?|json|node)\b(?::\d+)*/g, "…");
}

export function creerVisuelPage(deps: DependancesVisuelPage): Operation {
  return async (demande, contexte) => {
    if (Object.keys(demande.entrees).length > 0) throw refus("visuel-page n'accepte aucune entrée (aucune adresse)");
    const { scale, jpegQuality } = reglagesVisuelPage(demande.parametres);
    const brutes = demande.parametres.proprietes;
    if (contientUneUrl(brutes)) throw refus("Les propriétés de la page ne peuvent contenir aucune adresse (URL)");
    let valides;
    try {
      valides = validerProprietesPage(brutes);
    } catch (e) {
      throw erreurDeValidation(e instanceof Error ? e.message : "Propriétés de page invalides");
    }
    const nonce = randomBytes(16).toString("hex");
    const lignes: string[] = [];
    const sortie = join(contexte.dossier, "page.jpg");
    contexte.progression(10);
    let taille: { largeur: number; hauteur: number };
    try {
      taille = await deps.rendre({ inputProps: { ...valides, nonce }, scale, jpegQuality, sortie, surLog: (l) => lignes.push(l), signal: contexte.signal });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Texte coupé : la composition a fait échouer le rendu. Rien à réessayer, le contenu est à corriger.
      if (/déborde/.test(message)) throw refus(message);
      throw new ErreurRendu({ code: "indisponible", reessayable: true, message: `Rendu de la page en échec : ${sansChemins(message).slice(0, 200)}` });
    }
    contexte.progression(70);
    const mesure = extraireMesure(lignes, nonce);
    if (!mesure) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: "Mesure absente : la page n'a pas rapporté sa mesure (rendu refusé)" });
    await deps.deposer(demande.sortie.urlDepot, sortie, "image/jpeg", contexte.signal);
    const { size } = await stat(sortie);
    return { mesures: { ...mesure, largeur: taille.largeur, hauteur: taille.hauteur, scale, octets: size } };
  };
}

/** Rendu réel : Remotion `renderStill` en JPEG sur le paquet de mesure. `navigateur` : chemin d'un Chromium local (essais seulement). */
export function rendreAvecRemotion(options: { navigateur?: string } = {}): DependancesVisuelPage["rendre"] {
  return async ({ inputProps, scale, jpegQuality, sortie, surLog, signal }) => {
    const { makeCancelSignal, renderStill, selectComposition } = await import("@remotion/renderer");
    // Annulation (comme `miniature`) : l'arrêt de la demande ferme le navigateur au lieu de le laisser finir.
    const { cancelSignal, cancel } = makeCancelSignal();
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", () => cancel(), { once: true });
    const serveUrl = await paquetMesure();
    const navigateur = options.navigateur ? { browserExecutable: options.navigateur } : {};
    const composition = await selectComposition({ serveUrl, id: ID_COMPOSITION_MESURE, inputProps, ...navigateur });
    const onBrowserLog = (log: { text: string }) => surLog(log.text);
    await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output: sortie, frame: 0, imageFormat: "jpeg", jpegQuality, scale, inputProps, onBrowserLog, cancelSignal, ...navigateur } as never);
    return { largeur: composition.width * scale, hauteur: composition.height * scale };
  };
}

export const visuelPage: Operation = creerVisuelPage({ rendre: rendreAvecRemotion(), deposer });
