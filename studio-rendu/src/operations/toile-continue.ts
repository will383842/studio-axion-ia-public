/**
 * Opération `toile-continue` (file courte, carrousel continu P2) : UNE toile large (N × 1080 px) rendue en PNG sans perte, mesurée, puis
 * DÉCOUPÉE exactement en N JPEG par FFmpeg (`crop=1080:H:i×1080:0`). Avec une seule source, la tranche i vaut les colonnes [i·1080, (i+1)·1080)
 * de la toile : aucune couture ne peut se décaler. Le PNG ne quitte pas le conteneur.
 * Paramètres : `proprietes` ({ toile, versions }, validées par `validerProprietesToile`), `depotsPages` ({ cle, urlDepot } par page, chacune
 * passée par `exigerAdressePermise`), `qualite` (90 à 95, défaut 95). Jamais `scale` : à ×2, 10 pages dépasseraient 16 384 px. Aucune entrée.
 * Sortie : bande d'aperçu JPEG au quart (`sortie.urlDepot`). Mesures : celles de la toile (`MesureToile`), `ecartCoutureMax` (écart JPEG / PNG
 * sur les colonnes de bord), `coutureDecalee` (colonnes de bord plus proches d'une colonne voisine de la toile que de la bonne : doit valoir 0), `dureeMs`, `octetsPages`, `octetsPageMax`.
 */
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { HAUTEURS, LARGEUR_PAGE } from "../../../src/domaine/visuels/continu/geometrie.js";
import { validerProprietesToile } from "../../../src/domaine/visuels/continu/proprietes-toile.js";
import { extraireMesureToile, ID_COMPOSITION_TOILE } from "../../compositions/visuels/continu/mesure/protocole-toile.js";
import { ErreurRendu, type DemandeRendu, type Operation } from "../contrat.js";
import { deposer, executer, exigerAdressePermise, FFMPEG } from "../outils.js";
import { paquetToile } from "../paquet-toile.js";
import { REGLAGES_RENDU } from "../remotion.js";
import { contientUneUrl, sansChemins } from "./visuel-page.js";

export const QUALITE_TOILE = { min: 90, max: 95, defaut: 95 } as const;
const PARAMETRES_CONNUS = ["proprietes", "depotsPages", "qualite"];

export interface DepotPage {
  cle: string;
  urlDepot: string;
}

export interface EntreeRenduToile {
  /** Propriétés validées + `nonce`. */
  inputProps: Record<string, unknown>;
  /** Chemin du PNG de la toile entière. */
  sortie: string;
  surLog: (ligne: string) => void;
  signal: AbortSignal;
}

export interface DependancesToile {
  rendre(entree: EntreeRenduToile): Promise<{ largeur: number; hauteur: number }>;
  deposer(urlDepot: string, chemin: string, mime: string, signal?: AbortSignal): Promise<void>;
}

const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });

/** Réglages demandés, bornés ; lève un refus sinon (paramètre inconnu, `scale` compris). PUR. */
export function reglagesToile(parametres: DemandeRendu["parametres"]): { qualite: number } {
  if ("scale" in parametres) throw refus("scale : refusé, la toile se rend à ×1 seulement (×2 dépasserait 16 384 px)");
  const inconnu = Object.keys(parametres).find((k) => !PARAMETRES_CONNUS.includes(k));
  if (inconnu) throw refus(`Paramètre inconnu « ${inconnu} »`);
  const qualite = parametres.qualite ?? QUALITE_TOILE.defaut;
  if (typeof qualite !== "number" || !Number.isInteger(qualite) || qualite < QUALITE_TOILE.min || qualite > QUALITE_TOILE.max) {
    throw refus(`qualite : entier de ${QUALITE_TOILE.min} à ${QUALITE_TOILE.max}`);
  }
  return { qualite };
}

/** Une adresse de dépôt permise par page, exactement `{ cle, urlDepot }`, autant que de pages ; lève un refus sinon. PUR (selon l'environnement). */
export function verifierDepotsPages(liste: unknown, n: number): DepotPage[] {
  if (!Array.isArray(liste) || liste.length !== n) throw refus(`depotsPages : ${n} adresses attendues, une par page`);
  return liste.map((d, i) => {
    const cles = d && typeof d === "object" && !Array.isArray(d) ? Object.keys(d).sort().join(",") : "";
    const { cle, urlDepot } = (d ?? {}) as Partial<DepotPage>;
    if (cles !== "cle,urlDepot" || typeof cle !== "string" || !cle || typeof urlDepot !== "string") throw refus(`depotsPages : la page ${i + 1} attend { cle, urlDepot }`);
    return { cle, urlDepot: exigerAdressePermise(urlDepot) };
  });
}

/** Filtre FFmpeg de la tranche `i` : les colonnes [i·1080, (i+1)·1080) de la toile, sans mise à l'échelle. PUR. */
export function grapheDecoupe(i: number, hauteur: number): string {
  return `crop=${LARGEUR_PAGE}:${hauteur}:${i * LARGEUR_PAGE}:0`;
}

/** Échelle `-q:v` du JPEG (2 = la plus fine utile) : 93 à 95 → 2, 90 à 92 → 3. PUR. */
export function echelleJpeg(qualite: number): number {
  return qualite >= 93 ? 2 : 3;
}

/** Version de toile indisponible (studio et studio-rendu pas encore à la même version) : à réessayer ; « absente » ou « invalide », comme tout le reste : un refus. PUR. */
export function erreurDeValidationToile(message: string): ErreurRendu {
  if (message.startsWith("Version de toile indisponible")) return new ErreurRendu({ code: "indisponible", reessayable: true, message });
  return refus(message);
}

/** Plus grand écart (0-255, par canal) entre la colonne `colPage` d'une page RGB et la colonne `colToile` de la toile RGB. PUR. */
export function ecartColonne(page: Uint8Array, toile: Uint8Array, largeurToile: number, hauteur: number, colPage: number, colToile: number): number {
  let max = 0;
  for (let y = 0; y < hauteur; y++) {
    const a = (y * LARGEUR_PAGE + colPage) * 3;
    const b = (y * largeurToile + colToile) * 3;
    for (let k = 0; k < 3; k++) max = Math.max(max, Math.abs(page[a + k] - toile[b + k]));
  }
  return max;
}

/** Écart moyen (0-255, par canal) entre la colonne `colPage` d'une page RGB et la colonne `colToile` de la toile RGB. PUR. */
export function ecartMoyenColonne(page: Uint8Array, toile: Uint8Array, largeurToile: number, hauteur: number, colPage: number, colToile: number): number {
  let somme = 0;
  for (let y = 0; y < hauteur; y++) {
    const a = (y * LARGEUR_PAGE + colPage) * 3;
    const b = (y * largeurToile + colToile) * 3;
    for (let k = 0; k < 3; k++) somme += Math.abs(page[a + k] - toile[b + k]);
  }
  return somme / (hauteur * 3);
}

/** Vrai si la colonne exacte de la toile est au moins aussi proche de la colonne de la page que les colonnes décalées de ±1 (mesure discriminante : un décalage d'une colonne la rend fausse). PUR. */
export function colonneExacteLaPlusProche(page: Uint8Array, toile: Uint8Array, largeurToile: number, hauteur: number, colPage: number, colToile: number): boolean {
  const exacte = ecartMoyenColonne(page, toile, largeurToile, hauteur, colPage, colToile);
  return [-1, 1].every((d) => colToile + d < 0 || colToile + d >= largeurToile || exacte <= ecartMoyenColonne(page, toile, largeurToile, hauteur, colPage, colToile + d));
}

const enRgb = (entree: string, sortie: string, signal: AbortSignal) => executer(FFMPEG, ["-y", "-v", "error", "-i", entree, "-f", "rawvideo", "-pix_fmt", "rgb24", sortie], signal);

export function creerToileContinue(deps: DependancesToile): Operation {
  return async (demande, contexte) => {
    const debut = Date.now();
    if (Object.keys(demande.entrees).length > 0) throw refus("toile-continue n'accepte aucune entrée (aucune adresse)");
    const { qualite } = reglagesToile(demande.parametres);
    const brutes = demande.parametres.proprietes;
    if (contientUneUrl(brutes)) throw refus("Les propriétés de la toile ne peuvent contenir aucune adresse (URL)");
    let valides;
    try {
      valides = validerProprietesToile(brutes);
    } catch (e) {
      throw erreurDeValidationToile(e instanceof Error ? e.message : "Propriétés de toile invalides");
    }
    const n = valides.toile.pages.length;
    const depots = verifierDepotsPages(demande.parametres.depotsPages, n);
    const nonce = randomBytes(16).toString("hex");
    const lignes: string[] = [];
    const png = join(contexte.dossier, "toile.png");
    contexte.progression(5);
    let taille: { largeur: number; hauteur: number };
    try {
      taille = await deps.rendre({ inputProps: { ...valides, nonce }, sortie: png, surLog: (l) => lignes.push(l), signal: contexte.signal });
    } catch (e) {
      throw new ErreurRendu({ code: "indisponible", reessayable: true, message: `Rendu de la toile en échec : ${sansChemins(e instanceof Error ? e.message : String(e)).slice(0, 200)}` });
    }
    const dureeRenduMs = Date.now() - debut;
    contexte.progression(60);
    const mesure = extraireMesureToile(lignes, nonce);
    if (!mesure) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: "Mesure absente : la toile n'a pas rapporté sa mesure (rendu refusé)" });
    if (taille.largeur !== n * LARGEUR_PAGE) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: `Toile de ${taille.largeur} px au lieu de ${n * LARGEUR_PAGE}` });
    const hauteurAttendue = HAUTEURS[valides.toile.format];
    if (taille.hauteur !== hauteurAttendue) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: `Toile de ${taille.hauteur} px de haut au lieu de ${hauteurAttendue}` });
    if (mesure.largeur !== taille.largeur || mesure.hauteur !== taille.hauteur) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: `Mesure de ${mesure.largeur} × ${mesure.hauteur} px contraire au rendu de ${taille.largeur} × ${taille.hauteur} px` });

    // Découpe exacte, puis contrôle des colonnes de bord de chaque JPEG contre celles du PNG.
    const { hauteur } = taille;
    const toileRgb = join(contexte.dossier, "toile.rgb");
    await enRgb(png, toileRgb, contexte.signal);
    const brut = await readFile(toileRgb);
    const pages: string[] = [];
    let ecartCoutureMax = 0;
    let coutureDecalee = 0;
    for (let i = 0; i < n; i++) {
      const jpeg = join(contexte.dossier, `page-${i + 1}.jpg`);
      await executer(FFMPEG, ["-y", "-v", "error", "-i", png, "-vf", grapheDecoupe(i, hauteur), "-frames:v", "1", "-pix_fmt", "yuvj444p", "-q:v", String(echelleJpeg(qualite)), jpeg], contexte.signal);
      const rgb = join(contexte.dossier, `page-${i + 1}.rgb`);
      await enRgb(jpeg, rgb, contexte.signal);
      const page = await readFile(rgb);
      for (const [colPage, colToile] of [[0, i * LARGEUR_PAGE], [LARGEUR_PAGE - 1, (i + 1) * LARGEUR_PAGE - 1]]) {
        ecartCoutureMax = Math.max(ecartCoutureMax, ecartColonne(page, brut, taille.largeur, hauteur, colPage, colToile));
        if (!colonneExacteLaPlusProche(page, brut, taille.largeur, hauteur, colPage, colToile)) coutureDecalee++;
      }
      pages.push(jpeg);
      contexte.progression(60 + Math.round((30 * (i + 1)) / n));
    }
    const bande = join(contexte.dossier, "bande.jpg");
    await executer(FFMPEG, ["-y", "-v", "error", "-i", png, "-vf", "scale=iw/4:-1", "-frames:v", "1", "-q:v", "3", bande], contexte.signal);

    for (let i = 0; i < n; i++) await deps.deposer(depots[i].urlDepot, pages[i], "image/jpeg", contexte.signal);
    await deps.deposer(demande.sortie.urlDepot, bande, "image/jpeg", contexte.signal);
    const octets = await Promise.all(pages.map(async (p) => (await stat(p)).size));
    return {
      mesures: { ...mesure, ecartCoutureMax, coutureDecalee, octetsPages: octets.reduce((a, b) => a + b, 0), octetsPageMax: Math.max(...octets), dureeRenduMs, dureeMs: Date.now() - debut },
    };
  };
}

/**
 * Réglage du navigateur propre à la toile : `gl: "swiftshader"` (rastérisation logicielle de Chrome) au lieu de `swangle` (`REGLAGES_RENDU`,
 * émulation d'un processeur graphique, utile aux compositions animées). Mesuré le 25/10 sur une toile de 10 pages (10 800 × 1350, à chaud) :
 * 45 s en `swangle`, 8 s en `swiftshader`, pour une image identique à l'œil. La file courte coupe à 45 s.
 */
export const NAVIGATEUR_TOILE = { gl: "swiftshader" } as const;

/** Rendu réel : Remotion `renderStill` en PNG, ×1, sur le paquet de la toile. `navigateur` : chemin d'un navigateur local (essais seulement). */
export function rendreToileAvecRemotion(options: { navigateur?: string } = {}): DependancesToile["rendre"] {
  return async ({ inputProps, sortie, surLog, signal }) => {
    const { makeCancelSignal, renderStill, selectComposition } = await import("@remotion/renderer");
    const { cancelSignal, cancel } = makeCancelSignal();
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", () => cancel(), { once: true });
    const serveUrl = await paquetToile();
    const navigateur = options.navigateur ? { browserExecutable: options.navigateur } : {};
    const composition = await selectComposition({ serveUrl, id: ID_COMPOSITION_TOILE, inputProps, chromiumOptions: NAVIGATEUR_TOILE, ...navigateur });
    const onBrowserLog = (log: { text: string }) => surLog(log.text);
    await renderStill({ ...REGLAGES_RENDU, chromiumOptions: NAVIGATEUR_TOILE, composition, serveUrl, output: sortie, frame: 0, imageFormat: "png", scale: 1, inputProps, onBrowserLog, cancelSignal, ...navigateur } as never);
    return { largeur: composition.width, hauteur: composition.height };
  };
}

export const toileContinue: Operation = creerToileContinue({ rendre: rendreToileAvecRemotion(), deposer });
