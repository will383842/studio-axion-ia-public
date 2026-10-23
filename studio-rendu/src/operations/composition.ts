/**
 * Opération `composition` (file LONGUE, un montage à la fois) — lot M4, plan B.7 ; accélérée au lot M4b ; commune à
 * tous les formats depuis le 02/10 (brique `src/briques/composition`, la recette du format est déjà dans les paramètres).
 *
 * Mode « complet » (une vidéo d'UN format d'image) :
 *   1. entrées téléchargées dans le dossier de travail (adresses signées), servies en local au navigateur ;
 *   2. SON : chaîne de la voix, −14 LUFS, crête vraie ≤ −1,5 dBTP, ton de pièce bouclé (`son/chaine.ts`) ;
 *   3-4. calques 1-5 (décor, double, accessoire, recadrage, illustrations) puis LUT (tétraédrique, plages de temps,
 *      intensité), vignette, grain en luminance → `master-sans-texte`. Lot M4b : en UNE passe FFmpeg
 *      (`composition/image-ffmpeg.ts`), sur un décor et un accessoire préparés UNE fois ; le navigateur ne dessine
 *      plus les calques image que pour le double SIMULÉ (silhouette) : Remotion « CompositionImage » puis FFmpeg ;
 *   5. Remotion « CompositionTexte » (calques 6 bis, 7, 8) en PNG transparents, UNE image par état différent du texte
 *      (lot M4b, `composition/texte-instants.ts`), EN MÊME TEMPS que 3-4 ;
 *   6. FFmpeg : texte posé sur le master, H.264 High 4.1 plafonné à 16 Mb/s (lot M4b : CRF 17 en une passe ;
 *      VBR 2 passes 12-16 Mb/s si la demande le dit), GOP fermé, `+faststart`, `yuv420p` BT.709 / tv, AAC-LC 48 kHz ;
 *   7. MESURES SUR LE FICHIER EXPORTÉ (étiquettes, débit, LUFS, crête vraie, pauses, image noire) ; si la crête
 *      dépasse, le son est refait plus bas (au plus deux fois) et remplacé dans le master (image recopiée) ;
 *   7 bis. NOTE VMAF (09/10) contre ce que x264 a reçu ; sous le seuil (93, réglable), UNE relance à un CRF plus bas ;
 *   8. dépôts : la vidéo (sortie), le master sans texte et la vignette.
 * Mode « recalque » (gratuit) : seulement 5, 6, 7, 7 bis et le dépôt, sur le master déjà fabriqué (entrée « master »).
 * Sans paramètre `mode` : l'ancienne composition d'essai (lot M1b), inchangée.
 * `STUDIO_RENDU_IMAGE=navigateur` force l'ancien chemin des calques image (comparaison, secours).
 */
import { existsSync } from "node:fs";
import { mkdir, open, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ecrireCube, melangerAvecIdentite } from "../../../src/lib/qc-lut.js";
import { PREFIXE_ENTREE, tailleAccessoire, type ParametresDemandeComposition, type ProprietesImageComposition, type ProprietesTexteComposition, type SourceDouble } from "../../../src/briques/composition/scene.js";
import { ErreurRendu, type ContexteOperation, type DemandeRendu, type Operation } from "../contrat.js";
import { argumentsExport, argumentsMaster, argumentsVmaf, exportRelance, grapheCouleurs, imageNoireEnTete, lireExport, lireVmaf, listeConcatTexte, moovAvantMdat, seuilVmaf, sourceGrain, type NoteVmaf } from "../composition/ffmpeg.js";
import { controlerCouleurs, type PaireCouleurs } from "../composition/couleurs.js";
import { argumentsImageFfmpeg, filtresFonduFin, imageParFfmpeg, tailleCanevas, type FichierDouble, type FichiersImage } from "../composition/image-ffmpeg.js";
import { instantsTexte } from "../composition/texte-instants.js";
import { mesurerFinVideo } from "../composition/fin-video.js";
import { fichierEntree, remplacerReferences } from "../composition/entrees.js";
import { servirDossier } from "../composition/serveur-fichiers.js";
import { compositionFacecamV4 } from "./facecam-v4.js";
import { deposer, executer, executerAvecErreurs, exigerAdressePermise, FFMPEG, FFPROBE, sansAdresses, telecharger } from "../outils.js";
import { lireCubeFichier } from "../lut.js";
import { coeursDisponibles, paquetCompositions, REGLAGES_RENDU } from "../remotion.js";
import { chargerClientLambda, configLambda, rendreSurLambda } from "../remotion-lambda.js";
import { PAN_VOIX_STEREO, preparerSon } from "../son/chaine.js";
import { mesurerFichier } from "../son/mesure.js";
import { mesurerBordsNoirs, mesuresBords } from "../controle-bords.js";

/** Composition d'essai du lot M1b (aucun mode). */
async function compositionEssai(demande: DemandeRendu, contexte: ContexteOperation) {
  const id = typeof demande.parametres.composition === "string" ? demande.parametres.composition : "Essai";
  const proprietes = { ...((demande.parametres.proprietes ?? {}) as Record<string, unknown>), ...demande.entrees };
  const { makeCancelSignal, renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await paquetCompositions();
  const choisie = await selectComposition({ serveUrl, id, inputProps: proprietes }).catch((e: Error) => {
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Composition « ${id} » introuvable : ${e.message}` });
  });
  const { cancelSignal, cancel } = makeCancelSignal();
  contexte.signal.addEventListener("abort", () => cancel());
  const sortie = join(contexte.dossier, "video.mp4");
  // Lot I (facultatif) : `parametres.crf` (0-51) pour un rendu quasi sans perte (effets spéciaux posés sur la piste
  // 10 bits) ; absent : réglages par défaut, comme avant.
  const crf = typeof demande.parametres.crf === "number" && Number.isFinite(demande.parametres.crf) ? { crf: Math.max(0, Math.min(51, Math.round(demande.parametres.crf))), colorSpace: "bt709" as const } : {};
  await renderMedia({ ...REGLAGES_RENDU, composition: choisie, serveUrl, codec: "h264", ...crf, outputLocation: sortie, inputProps: proprietes, cancelSignal, onProgress: ({ progress }) => contexte.progression(progress * 95) });
  await deposer(demande.sortie.urlDepot, sortie, "video/mp4", contexte.signal);
  return { mesures: { images: choisie.durationInFrames, fps: choisie.fps } };
}

/** Rend les calques image dans le navigateur (repli : double simulé « silhouette »), en vidéo H.264 quasi sans perte. */
async function rendreImageRemotion(proprietes: Record<string, unknown>, sortie: string, contexte: ContexteOperation, progression: (p: number) => void): Promise<void> {
  const { makeCancelSignal, renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await paquetCompositions();
  const composition = await selectComposition({ serveUrl, id: "CompositionImage", inputProps: proprietes });
  const { cancelSignal, cancel } = makeCancelSignal();
  contexte.signal.addEventListener("abort", () => cancel());
  await renderMedia({
    ...REGLAGES_RENDU,
    composition,
    serveUrl,
    codec: "h264",
    crf: 10,
    colorSpace: "bt709",
    imageFormat: "jpeg",
    jpegQuality: 95,
    muted: true,
    outputLocation: sortie,
    inputProps: proprietes,
    cancelSignal,
    onProgress: ({ progress }) => progression(progress),
  });
}

/**
 * Calques texte en PNG transparents, UNE image par état différent (lot M4b) : `t-000000.png`… et la liste
 * `liste.txt` (démultiplexeur `concat`) qui dit combien d'images de la vidéo chacune tient. Renvoie le nombre
 * d'images rendues et, si Remotion Lambda est allumé (éteint par défaut), son coût : le calque est alors rendu sur
 * AWS en vidéo transparente `texte.mov`, avec les adresses SIGNÉES des entrées (Lambda ne voit pas ce serveur).
 */
async function rendreTexte(
  brut: ProprietesTexteComposition,
  adresses: { locales: Record<string, string>; signees: Record<string, string> },
  sortie: string,
  contexte: ContexteOperation,
  progression: (p: number) => void,
): Promise<{ images: number; coutLambdaUsd?: number }> {
  await mkdir(sortie, { recursive: true });
  const lambda = configLambda();
  if (lambda) {
    const r = await rendreSurLambda(lambda, await chargerClientLambda(), { composition: "CompositionTexte", inputProps: remplacerReferences(brut, adresses.signees) as unknown as Record<string, unknown>, transparent: true }, join(sortie, "texte.mov"), { signal: contexte.signal, progression });
    return { images: brut.images, coutLambdaUsd: r.coutUsd };
  }
  const texte = remplacerReferences(brut, adresses.locales);
  const { makeCancelSignal, renderFrames, selectComposition } = await import("@remotion/renderer");
  const { instants, durees } = instantsTexte(texte);
  const proprietes = { ...texte, instants } as unknown as Record<string, unknown>;
  const serveUrl = await paquetCompositions();
  const composition = await selectComposition({ serveUrl, id: "CompositionTexte", inputProps: proprietes });
  const { cancelSignal, cancel } = makeCancelSignal();
  contexte.signal.addEventListener("abort", () => cancel());
  let faites = 0;
  await renderFrames({
    ...REGLAGES_RENDU,
    composition,
    serveUrl,
    imageFormat: "png",
    outputDir: sortie,
    inputProps: proprietes,
    cancelSignal,
    onStart: () => undefined,
    onFrameUpdate: () => progression(++faites / composition.durationInFrames),
  });
  // Séquence continue t-000000.png… (l'ordre de Remotion est celui des numéros), puis la liste des durées.
  const fichiers = (await readdir(sortie)).filter((f) => f.endsWith(".png") && !f.startsWith("t-")).sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  const noms: string[] = [];
  for (const [i, f] of fichiers.entries()) {
    const nom = `t-${String(i).padStart(6, "0")}.png`;
    await rename(join(sortie, f), join(sortie, nom));
    noms.push(nom);
  }
  if (noms.length !== durees.length) throw new ErreurRendu({ code: "inconnu", reessayable: true, message: `Calques texte incomplets (${noms.length} images sur ${durees.length}).` });
  await writeFile(join(sortie, "liste.txt"), listeConcatTexte(noms, durees, texte.fps));
  return { images: noms.length };
}

/** Nom de l'entrée désignée par une référence `entree:<nom>` (sinon null). */
const nomEntree = (valeur: string | undefined): string | null => (valeur?.startsWith(PREFIXE_ENTREE) ? valeur.slice(PREFIXE_ENTREE.length) : null);

/**
 * Décor PRÊT pour FFmpeg (lot M4b), fait UNE fois : « cover » à la taille du canevas, agrandi de 4 % et flouté comme
 * dans le navigateur (`blur(flou × k)`, `scale(1.04)`), en PNG. Sans image : null (la teinte suffit).
 */
async function preparerDecor(image: ProprietesImageComposition, locaux: Record<string, string>, dossier: string, signal: AbortSignal): Promise<string | null> {
  const nom = nomEntree(image.decor.image);
  if (!nom || !locaux[nom]) return null;
  const { largeur, hauteur } = tailleCanevas(image);
  const flou = image.decor.flouPx * (image.largeur / 1080);
  const agrandi = flou > 0 ? 1.04 : 1;
  const filtre = [`scale=${Math.ceil((largeur * agrandi) / 2) * 2}:${Math.ceil((hauteur * agrandi) / 2) * 2}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${largeur}:${hauteur}`, "format=rgb24"];
  if (flou > 0) filtre.push(`gblur=sigma=${flou.toFixed(2)}`);
  await executerAvecErreurs(FFMPEG, ["-hide_banner", "-y", "-i", locaux[nom], "-frames:v", "1", "-vf", filtre.join(","), "decor-pret.png"], signal, dossier);
  return "decor-pret.png";
}

/** Accessoire PRÊT (lot M4b) : dessiné et flouté UNE fois par le navigateur (`renderStill`), en PNG transparent. */
async function preparerAccessoire(image: ProprietesImageComposition, adresses: Record<string, string>, dossier: string): Promise<FichiersImage["accessoire"]> {
  if (!image.accessoire) return undefined;
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const proprietes = { accessoire: remplacerReferences(image.accessoire, adresses), lumiere: image.contour?.couleur } as unknown as Record<string, unknown>;
  const serveUrl = await paquetCompositions();
  const composition = await selectComposition({ serveUrl, id: "CompositionAccessoire", inputProps: proprietes });
  await renderStill({ composition, serveUrl, output: join(dossier, "accessoire.png"), imageFormat: "png", inputProps: proprietes, chromiumOptions: REGLAGES_RENDU.chromiumOptions });
  const t = tailleAccessoire(image.accessoire);
  return { fichier: "accessoire.png", x: t.x, y: t.y, largeur: t.largeur, hauteur: t.hauteur };
}

/** Fichier local d'une source du double (webm transparent ou image détourée). */
function fichierDouble(source: SourceDouble | undefined, locaux: Record<string, string>): FichierDouble | undefined {
  if (!source || source.type === "silhouette") return undefined;
  // Lot R7d : second angle rendu par passages, un webm par passage, posé à son moment.
  if (source.type === "tranches") {
    const tranches = source.morceaux.map((m) => {
      const nom = nomEntree(m.url);
      if (!nom || !locaux[nom]) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Passage du second angle absent de la demande." });
      return { fichier: locaux[nom], debutSec: m.debutSec, finSec: m.finSec };
    });
    if (!tranches.length) return undefined;
    return { fichier: tranches[0].fichier, video: true, tranches };
  }
  const nom = nomEntree(source.url);
  if (!nom || !locaux[nom]) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Piste du double absente de la demande." });
  return { fichier: locaux[nom], video: source.type === "video" };
}

/** Facecam lot C : fichiers locaux des cartes d'écran partagé (rien si aucun plan n'en a). */
function cartesEcranPartage(image: ProprietesImageComposition, locaux: Record<string, string>): { cartes?: Record<string, string> } {
  const cartes: Record<string, string> = {};
  for (const pl of image.plans) {
    const nom = nomEntree(pl.ecranPartage?.carte);
    if (!pl.ecranPartage) continue;
    if (!nom || !locaux[nom]) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Carte d'un écran partagé absente de la demande." });
    cartes[nom] = locaux[nom];
  }
  // Facecam lot G : cartes des mises en page (côté, vignette), même table.
  for (const pl of image.plans) {
    if (!pl.miseEnPage) continue;
    const nom = nomEntree(pl.miseEnPage.carte);
    if (!nom || !locaux[nom]) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Carte d'une mise en page absente de la demande." });
    cartes[nom] = locaux[nom];
  }
  return Object.keys(cartes).length ? { cartes } : {};
}

/** Mission H, multicaméra : fichiers locaux des angles fabriqués (rien si la composition n'en a pas). */
function camerasLocales(image: ProprietesImageComposition, locaux: Record<string, string>): { cameras?: FichiersImage["cameras"] } {
  if (!image.cameras) return {};
  const cameras: NonNullable<FichiersImage["cameras"]> = {};
  for (const angle of ["cote", "contre-plongee"] as const) {
    const f = fichierDouble(image.cameras[angle], locaux);
    if (f) cameras[angle] = f;
  }
  return Object.keys(cameras).length ? { cameras } : {};
}

type ParametresSonRemix = Extract<ParametresDemandeComposition, { mode: "complet" }>["son"];

/** Lot « bruitages » (02/10) : fichiers locaux des sons posés (une entrée absente est une erreur claire). */
function bruitagesLocaux(son: Pick<ParametresSonRemix, "bruitages">, locaux: Record<string, string>, dossier: string): { chemin: string; debutSec: number; gainDb: number; passeHautHz: number }[] {
  return (son.bruitages ?? []).map((b) => {
    const f = locaux[b.entree];
    if (!f) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Bruitage « ${b.entree} » absent de la demande.` });
    return { chemin: join(dossier, f), debutSec: b.debutSec, gainDb: b.gainDb, passeHautHz: b.passeHautHz };
  });
}

/** Mesures des bruitages posés : nombre, niveau de la voix, écart le plus faible et le plus fort sous la voix (dB). */
function mesuresBruitages(son: { bruitages?: { voixDb: number; sons: { ecartDb: number; niveauDb: number }[] } }): Record<string, number> {
  const b = son.bruitages;
  if (!b?.sons.length) return {};
  const ecarts = b.sons.map((x) => b.voixDb - x.niveauDb);
  return { bruitages: b.sons.length, bruitagesSousVoixMinDb: +Math.min(...ecarts).toFixed(2), bruitagesSousVoixMaxDb: +Math.max(...ecarts).toFixed(2) };
}

/** Remplace le son du master (image recopiée telle quelle) : correction de crête sans refaire l'image. */
async function remplacerSonMaster(master: string, son: string, dossier: string, signal: AbortSignal, fonduAudio?: string): Promise<void> {
  const sortie = join(dossier, "master-son.mov");
  // Correcteur réel 2 : le fondu de fin du son est gardé quand le son est refait.
  await executerAvecErreurs(FFMPEG, ["-hide_banner", "-y", "-i", master, "-i", son, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", fonduAudio ? `${fonduAudio},${PAN_VOIX_STEREO}` : PAN_VOIX_STEREO, "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2", "-shortest", sortie], signal, dossier);
  await rename(sortie, master);
}

/**
 * Mesures du fichier exporté : étiquettes et débit (ffprobe), `+faststart`, son (crête vraie, pauses), image noire.
 * 14/10 (fin propre) : niveau du son sur la dernière 0,1 s (`sonDerniere100msDb`) et écart moyen entre les deux
 * dernières images (`mouvementDerniereImage`), relus par `controleFinPropre` ; une mesure en panne est omise.
 */
export async function mesurerExport(video: string, pauses: [number, number][], signal?: AbortSignal, options: { bords?: boolean; instantsBords?: readonly number[] } = {}): Promise<Record<string, number>> {
  const probe = lireExport(await executer(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", video], signal));
  const f = await open(video, "r");
  const entete = Buffer.alloc(4 * 1024 * 1024);
  const { bytesRead } = await f.read(entete, 0, entete.length, 0);
  await f.close();
  const son = await mesurerFichier(video, pauses, signal);
  const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-nostats", "-t", "0.5", "-i", video, "-an", "-vf", "blackdetect=d=0.04:pix_th=0.06:pic_th=0.98", "-f", "null", "-"], signal);
  // 11/10 (demandé par `export.mesurerBords`) : colonnes et rangées noires au bord de l'image ; une mesure en panne
  // ne bloque pas l'export (`bordNoirErreur`, le studio la dit « non mesurée »).
  const fin = await mesurerFinVideo(video, signal);
  const bords = options.bords ? await mesurerBordsNoirs({ ffmpeg: FFMPEG, fichier: video, largeur: probe.largeur, hauteur: probe.hauteur, dureeSec: probe.dureeSec, signal, ...(options.instantsBords?.length && probe.dureeSec > 0 ? { parts: options.instantsBords.map((s) => Math.min(1, Math.max(0, s / probe.dureeSec))) } : {}) }).then(mesuresBords, () => ({ bordNoirErreur: 1 })) : {};
  return {
    ...probe,
    ...bords,
    faststart: moovAvantMdat(entete.subarray(0, bytesRead)) ? 1 : 0,
    imageNoireTete: imageNoireEnTete(erreurs) ? 1 : 0,
    lufs: son.lufs,
    lra: son.lra,
    creteVraieDbtp: son.creteVraieDbtp,
    pauses: son.pauses,
    pauseMinDb: son.pauseMinDb,
    pauseMaxDb: son.pauseMaxDb,
    ...(Number.isFinite(fin.sonDerniere100msDb) ? { sonDerniere100msDb: fin.sonDerniere100msDb } : {}),
    ...(Number.isFinite(fin.mouvementDerniereImage) ? { mouvementDerniereImage: fin.mouvementDerniereImage } : {}),
  };
}

/**
 * Texte posé sur le master puis export final en deux passes (dossier de travail = répertoire courant de FFmpeg).
 * Le dossier du texte contient soit une image par image (`t-%06d.png`), soit (lot M4b) une image par état et sa
 * liste `liste.txt`.
 */
export async function exporter(master: string, dossierTexte: string, exportP: ParametresDemandeComposition["export"], dossier: string, signal?: AbortSignal, nom = "video.mp4"): Promise<string> {
  const video = join(dossier, nom);
  const a = argumentsExport(master, texteExport(dossierTexte), exportP, "passe", video, coeursDisponibles());
  if (a.passe1.length) await executerAvecErreurs(FFMPEG, a.passe1, signal, dossier);
  await executerAvecErreurs(FFMPEG, a.passe2, signal, dossier);
  return video;
}

/** Calque texte tel que l'export le lit : liste `concat` (M4b), vidéo transparente (Lambda) ou séquence PNG. */
function texteExport(dossierTexte: string): string {
  const liste = join(dossierTexte, "liste.txt");
  const film = join(dossierTexte, "texte.mov");
  return existsSync(liste) ? liste : existsSync(film) ? film : join(dossierTexte, "t-%06d.png");
}

/** Note VMAF d'un export (09/10) : comparé à ce que x264 a reçu (master + texte repassés dans le graphe d'export). */
export async function mesurerVmaf(video: string, master: string, dossierTexte: string, exportP: ParametresDemandeComposition["export"], dossier: string, signal?: AbortSignal): Promise<NoteVmaf> {
  const journal = `vmaf-${Date.now().toString(36)}.json`;
  await executerAvecErreurs(FFMPEG, argumentsVmaf(video, master, texteExport(dossierTexte), exportP, journal, coeursDisponibles()), signal, dossier);
  return lireVmaf(await readFile(join(dossier, journal), "utf8"));
}

/**
 * Après l'export final : note VMAF dans les mesures (`vmaf`, `vmafMin`, `vmafP5`, `vmafSeuil`) ; sous le seuil, UNE
 * relance de l'export à un CRF plus bas (`exportRelance`), gardée si sa note est au moins égale (`vmafRelance`,
 * `vmafAvantRelance`, `crfRelance`). L'alerte est posée par le studio (`controlesExport`). Une mesure en panne ne
 * bloque jamais la livraison (`vmafErreur` = 1).
 */
export async function noterEtRelancer(video: string, master: string, dossierTexte: string, exportP: ParametresDemandeComposition["export"], dossier: string, pauses: [number, number][], mesures: Record<string, number>, signal?: AbortSignal): Promise<{ video: string; mesures: Record<string, number> }> {
  const seuil = seuilVmaf(exportP);
  if (seuil === null) return { video, mesures };
  const debut = Date.now();
  try {
    const note = await mesurerVmaf(video, master, dossierTexte, exportP, dossier, signal);
    let sortie: Record<string, number> = { ...mesures, ...note, vmafSeuil: seuil };
    const relance = seuil > 0 && note.vmaf < seuil ? exportRelance(exportP) : null;
    if (relance) {
      const autre = await exporter(master, dossierTexte, relance, dossier, signal, "video-relance.mp4");
      const note2 = await mesurerVmaf(autre, master, dossierTexte, relance, dossier, signal);
      const suivi = { vmafRelance: 1, vmafAvantRelance: note.vmaf, ...(relance.mode === "crf" ? { crfRelance: relance.crf ?? 17 } : { debitRelanceKbps: relance.debitKbps }) };
      if (note2.vmaf >= note.vmaf) {
        await rename(autre, video);
        sortie = { ...(await mesurerExport(video, pauses, signal, { bords: !!exportP.mesurerBords, instantsBords: exportP.instantsBords })), ...note2, vmafSeuil: seuil, ...suivi };
      } else sortie = { ...sortie, ...suivi, vmafRelanceGardee: 0 };
    }
    return { video, mesures: { ...sortie, tempsVmafSec: +((Date.now() - debut) / 1000).toFixed(1) } };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(`Note VMAF impossible : ${(e as Error).message}`);
    return { video, mesures: { ...mesures, vmafErreur: 1 } };
  }
}

/**
 * Garde-fou des couleurs (10/10) : mesures `couleurs*` de l'export comparé à la prise étalonnée (`couleursAberrantes`
 * = 1 au-delà du seuil ; le studio bloque alors la livraison). Une mesure impossible ne bloque jamais (`couleursErreur`).
 */
export async function couleursDeLExport(video: string, reference: string | undefined, paires: PaireCouleurs[], signal?: AbortSignal): Promise<Record<string, number>> {
  if (!reference || !paires.length) return { couleursErreur: 1 };
  try {
    return await controlerCouleurs(FFMPEG, video, exigerAdressePermise(reference), paires, signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(`Contrôle des couleurs impossible : ${sansAdresses((e as Error).message)}`);
    return { couleursErreur: 1 };
  }
}

async function vignette(video: string, dossier: string, instantSec: number, signal: AbortSignal): Promise<string> {
  const chemin = join(dossier, "vignette.jpg");
  await executer(FFMPEG, ["-hide_banner", "-y", "-ss", instantSec.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "3", chemin], signal);
  return chemin;
}

export const composition: Operation = async (demande, contexte) => {
  const p = demande.parametres as Partial<ParametresDemandeComposition> & { mode?: string };
  // Face caméra animée v4 (Lot I) : opération à part (prise montée + médias servis + composition `InterfaceClaireFaceCameraV4`).
  if ((demande.parametres as { mode?: unknown }).mode === "facecam-v4") return compositionFacecamV4(demande, contexte);
  if (p.mode !== "complet" && p.mode !== "recalque") return compositionEssai(demande, contexte);
  const params = p as ParametresDemandeComposition;
  const debut = Date.now();
  const temps: Record<string, number> = {};
  const chrono = (cle: string, depuis: number) => (temps[cle] = +((Date.now() - depuis) / 1000).toFixed(1));
  const dossier = contexte.dossier;
  // Images du texte dans un dossier neuf (un dossier de travail réutilisé ne mélange jamais deux rendus).
  const dossierTexte = join(dossier, `texte-${Date.now().toString(36)}`);

  // 1. Entrées → fichiers locaux, servis au navigateur de Remotion. 10/10 : la prise étalonnée du garde-fou des couleurs
  // n'est PAS téléchargée (quelques images lues à distance, `-ss` par plages).
  const locaux: Record<string, string> = {};
  const controleCouleurs = params.mode === "complet" ? params.controleCouleurs : undefined;
  for (const [nom, url] of Object.entries(demande.entrees)) {
    if (nom === controleCouleurs?.entree) continue;
    const fichier = fichierEntree(nom, url);
    await telecharger(url, join(dossier, fichier), contexte.signal);
    locaux[nom] = fichier;
  }
  contexte.progression(3);
  const serveur = await servirDossier(dossier);
  try {
    const adresses = Object.fromEntries(Object.entries(locaux).map(([nom, f]) => [nom, `${serveur.base}/${encodeURIComponent(f)}`]));
    const pauses = params.son.pauses;

    if (params.mode === "complet") {
      const mesuresSon: Record<string, number> = {};
      // 2. Son.
      let t = Date.now();
      const voix = locaux[params.son.entreeVoix];
      if (!voix) await executer(FFMPEG, ["-hide_banner", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", params.dureeSec.toFixed(3), join(dossier, "silence.wav")], contexte.signal);
      const reglagesSon = {
        voix: join(dossier, voix ?? "silence.wav"),
        tonPiece: params.son.entreeTonPiece && locaux[params.son.entreeTonPiece] ? join(dossier, locaux[params.son.entreeTonPiece]) : undefined,
        dureeSec: params.dureeSec,
        dossier,
        passeHautHz: params.son.passeHautHz,
        seuilLraCompression: params.son.seuilLraCompression,
        ratioCompression: params.son.ratioCompression,
        lufs: params.son.lufs,
        creteVraieMaxDbtp: params.son.creteVraieMaxDbtp,
        tonPieceDb: params.son.tonPieceDb,
        graine: params.son.graine,
        signal: contexte.signal,
        // Lot « bruitages » (02/10) : absent ou vide, la chaîne est celle d'avant (démonstration M4 identique).
        ...(params.son.bruitages?.length ? { bruitages: bruitagesLocaux(params.son, locaux, dossier) } : {}),
      };
      let son = await preparerSon(reglagesSon);
      Object.assign(mesuresSon, { lraBrut: son.lraBrut, compression: son.compression ? 1 : 0, gainDb: son.gainDb, tonDeSynthese: son.tonDeSynthese ? 1 : 0 }, mesuresBruitages(son));
      chrono("tempsSonSec", t);
      contexte.progression(8);

      // LUT déjà mélangées à leur intensité (chemins relatifs au dossier de travail).
      const luts: { fichier: string; plages: [number, number][] }[] = [];
      for (const [i, l] of params.couleurs.luts.entries()) {
        if (!locaux[l.entree] || !l.plages.length) continue;
        const melangee = melangerAvecIdentite(await lireCubeFichier(join(dossier, locaux[l.entree])), l.intensite);
        const nom = `lut-${i + 1}-melangee.cube`;
        await writeFile(join(dossier, nom), ecrireCube(melangee));
        luts.push({ fichier: nom, plages: l.plages });
      }
      const taille = { largeur: params.image.largeur, hauteur: params.image.hauteur };
      const master = join(dossier, "master-sans-texte.mov");
      const parFfmpeg = imageParFfmpeg(params.image) && process.env.STUDIO_RENDU_IMAGE !== "navigateur";
      mesuresSon.imageParFfmpeg = parFfmpeg ? 1 : 0;

      // 3-4. Calques image + couleurs → master  ‖  5. calques texte. En même temps : le texte ne dépend pas de
      // l'image, et le navigateur attend souvent là où FFmpeg calcule.
      const imageEtCouleurs = async () => {
        const t0 = Date.now();
        if (parFfmpeg) {
          const [decor, accessoire] = await Promise.all([preparerDecor(params.image, locaux, dossier, contexte.signal), preparerAccessoire(params.image, adresses, dossier)]);
          const illustrations: FichiersImage["illustrations"] = {};
          params.image.plans.forEach((pl, i) => {
            const nom = nomEntree(pl.illustration?.url);
            if (pl.type === "illustration" && nom && locaux[nom]) illustrations[i] = { fichier: locaux[nom], video: !!pl.illustration?.video };
          });
          const fichiers: FichiersImage = {
            decor: decor ?? undefined,
            doubles: { principal: fichierDouble(params.image.doubles.principal, locaux)!, second: fichierDouble(params.image.doubles.second, locaux) },
            accessoire,
            illustrations,
            luts,
            son: son.chemin,
            // Facecam lot C : cartes des écrans partagés (absentes : aucune, comme avant).
            ...cartesEcranPartage(params.image, locaux),
            // Mission H : angles de la multicaméra (absents : une seule caméra, comme avant).
            ...camerasLocales(params.image, locaux),
          };
          await executerAvecErreurs(FFMPEG, argumentsImageFfmpeg(params.image, params.couleurs, fichiers, params.dureeSec, "master-sans-texte.mov", { fils: coeursDisponibles() }), contexte.signal, dossier);
          temps.tempsImageSec = +((Date.now() - t0) / 1000).toFixed(1);
          temps.tempsCouleursSec = 0;
        } else {
          await rendreImageRemotion(remplacerReferences(params.image, adresses) as unknown as Record<string, unknown>, join(dossier, "image.mp4"), contexte, (x) => contexte.progression(8 + x * 37));
          temps.tempsImageSec = +((Date.now() - t0) / 1000).toFixed(1);
          const t1 = Date.now();
          await executerAvecErreurs(
            FFMPEG,
            argumentsMaster("image.mp4", son.chemin, grapheCouleurs(params.couleurs, luts, taille), sourceGrain(taille, params.couleurs.grainTaillePx, params.export.fps, params.dureeSec), "master-sans-texte.mov"),
            contexte.signal,
            dossier,
          );
          temps.tempsCouleursSec = +((Date.now() - t1) / 1000).toFixed(1);
        }
      };
      const texte = async () => {
        const t0 = Date.now();
        const r = await rendreTexte(params.texte, { locales: adresses, signees: demande.entrees }, dossierTexte, contexte, (x) => contexte.progression(8 + x * 20));
        mesuresSon.imagesTexte = r.images;
        if (r.coutLambdaUsd !== undefined) mesuresSon.coutLambdaUsd = r.coutLambdaUsd;
        temps.tempsTexteSec = +((Date.now() - t0) / 1000).toFixed(1);
      };
      t = Date.now();
      await Promise.all([imageEtCouleurs(), texte()]);
      chrono("tempsImageEtTexteSec", t);
      contexte.progression(55);

      // 6-7. Export, mesures ; le son est refait plus bas si la crête vraie dépasse (au plus deux fois).
      t = Date.now();
      let video = await exporter(master, dossierTexte, params.export, dossier, contexte.signal);
      let mesures = await mesurerExport(video, pauses, contexte.signal, { bords: !!params.export.mesurerBords, instantsBords: params.export.instantsBords });
      let correctionDb = 0;
      for (let essai = 1; essai <= 2 && mesures.creteVraieDbtp > params.son.creteVraieMaxDbtp; essai++) {
        correctionDb += params.son.creteVraieMaxDbtp - mesures.creteVraieDbtp - 0.3;
        son = await preparerSon({ ...reglagesSon, correctionDb });
        await remplacerSonMaster(master, son.chemin, dossier, contexte.signal, params.image.fonduFinSec ? filtresFonduFin(params.dureeSec, params.image.fonduFinSec).audio : undefined);
        video = await exporter(master, dossierTexte, params.export, dossier, contexte.signal);
        mesures = await mesurerExport(video, pauses, contexte.signal, { bords: !!params.export.mesurerBords, instantsBords: params.export.instantsBords });
        mesuresSon.corrections = essai;
      }
      chrono("tempsExportSec", t);
      // 7 bis (09/10). Note de qualité VMAF ; sous le seuil, une seule relance plus fine.
      ({ video, mesures } = await noterEtRelancer(video, master, dossierTexte, params.export, dossier, pauses, mesures, contexte.signal));
      // 7 ter (10/10). Garde-fou des couleurs : l'export contre la prise étalonnée (le master peut être déjà faux).
      if (controleCouleurs) mesures = { ...mesures, ...(await couleursDeLExport(video, demande.entrees[controleCouleurs.entree], controleCouleurs.paires, contexte.signal)) };
      contexte.progression(95);
      const premierDouble = params.image.plans.find((x) => x.type === "double");
      const vign = await vignette(video, dossier, Math.min(params.dureeSec - 0.1, Math.max(0.5, (premierDouble?.debutSec ?? 0) + 0.5)), contexte.signal);
      await deposer(demande.sortie.urlDepot, video, "video/mp4", contexte.signal);
      await deposer(params.depots.master.urlDepot, master, "video/quicktime", contexte.signal);
      await deposer(params.depots.vignette.urlDepot, vign, "image/jpeg", contexte.signal);
      temps.tempsTotalSec = +((Date.now() - debut) / 1000).toFixed(1);
      return { mesures: { ...mesures, ...mesuresSon, ...temps, images: params.image.images } };
    }

    // --- Recalque : texte seulement, sur le master déjà fabriqué ---
    if (!locaux.master) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « master » manquante pour le recalque." });
    const master = join(dossier, locaux.master);
    let t = Date.now();
    // Lot « bruitages » (02/10) : remixage — le son seul est refait et remplace celui du master (image recopiée).
    const remix = (params as { remixage?: { son: ParametresSonRemix } }).remixage;
    let mesuresRemix: Record<string, number> = {};
    if (remix) {
      const s = remix.son;
      const voix = locaux[s.entreeVoix];
      if (!voix) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « voix » manquante pour refaire le son." });
      const son = await preparerSon({
        voix: join(dossier, voix),
        tonPiece: s.entreeTonPiece && locaux[s.entreeTonPiece] ? join(dossier, locaux[s.entreeTonPiece]) : undefined,
        dureeSec: params.dureeSec,
        dossier,
        passeHautHz: s.passeHautHz,
        seuilLraCompression: s.seuilLraCompression,
        ratioCompression: s.ratioCompression,
        lufs: s.lufs,
        creteVraieMaxDbtp: s.creteVraieMaxDbtp,
        tonPieceDb: s.tonPieceDb,
        graine: s.graine,
        signal: contexte.signal,
        ...(s.bruitages?.length ? { bruitages: bruitagesLocaux(s, locaux, dossier) } : {}),
      });
      await remplacerSonMaster(master, son.chemin, dossier, contexte.signal);
      mesuresRemix = { remixage: 1, gainDb: son.gainDb, ...mesuresBruitages(son) };
      chrono("tempsSonSec", t);
      t = Date.now();
    }
    const rt = await rendreTexte(params.texte, { locales: adresses, signees: demande.entrees }, dossierTexte, contexte, (x) => contexte.progression(5 + x * 60));
    const imagesTexte = rt.images;
    chrono("tempsTexteSec", t);
    t = Date.now();
    const exporte = await exporter(master, dossierTexte, params.export, dossier, contexte.signal);
    chrono("tempsExportSec", t);
    const { video, mesures } = await noterEtRelancer(exporte, master, dossierTexte, params.export, dossier, pauses, await mesurerExport(exporte, pauses, contexte.signal, { bords: !!params.export.mesurerBords, instantsBords: params.export.instantsBords }), contexte.signal);
    const vign = await vignette(video, dossier, Math.min(params.dureeSec - 0.1, 1), contexte.signal);
    await deposer(demande.sortie.urlDepot, video, "video/mp4", contexte.signal);
    await deposer(params.depots.vignette.urlDepot, vign, "image/jpeg", contexte.signal);
    // Remixage : le master au nouveau son devient la piste `master-sans-texte` de la nouvelle version.
    const depotMaster = (params.depots as { master?: { urlDepot: string } }).master;
    if (remix && depotMaster?.urlDepot) await deposer(depotMaster.urlDepot, master, "video/quicktime", contexte.signal);
    temps.tempsTotalSec = +((Date.now() - debut) / 1000).toFixed(1);
    return { mesures: { ...mesures, ...mesuresRemix, ...temps, imagesTexte, ...(rt.coutLambdaUsd !== undefined ? { coutLambdaUsd: rt.coutLambdaUsd } : {}), images: params.texte.images } };
  } finally {
    await serveur.fermer();
  }
};
