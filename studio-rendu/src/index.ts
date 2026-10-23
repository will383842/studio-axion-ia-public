/**
 * Point d'entrée de `studio-rendu` (conteneur SANS ÉTAT, lot M1b). Lancé avec une priorité basse (`nice`).
 * Variables : PORT (défaut 4100), STUDIO_RENDU_CLE (OBLIGATOIRE en production), R2_ACCOUNT_ID / R2_PUBLIC_HOST (hôte du
 * stockage, seul lu et écrit), STUDIO_RENDU_HOTES (hôtes en plus, facultatif), FFMPEG / FFPROBE (chemins, facultatifs).
 * STUDIO_RENDU_ESSAI=1 : essais sur ce poste seulement (adresses 127.0.0.1, fichiers locaux), sans effet en production.
 */
import { analyseMedia } from "./operations/analyse-media.js";
import { assemblage } from "./operations/assemblage.js";
import { captureSite } from "./operations/capture-site.js";
import { etalonnage } from "./operations/etalonnage.js";
import { composition } from "./operations/composition.js";
import { extrait } from "./operations/extrait.js";
import { imageFixe } from "./operations/image-fixe.js";
import { mesureSon } from "./operations/mesure-son.js";
import { miniature } from "./operations/miniature.js";
import { mixage } from "./operations/mixage.js";
import { nettoyageAudio } from "./operations/nettoyage-audio.js";
import { traitementImage } from "./operations/traitement-image.js";
import { ErreurRendu } from "./contrat.js";
import { FilesRendu, surveillerRejets } from "./files.js";
import { nettoyerTemporairesOrphelins } from "./nettoyage.js";
import { cleDeDemarrage, creerServeur } from "./serveur.js";

/** Import dynamique d'une opération : une panne de chargement donne un refus clair (jamais de chemin interne au client). */
async function charger<T>(nom: string, importer: () => Promise<T>): Promise<T> {
  try {
    return await importer();
  } catch (e) {
    console.error(`[studio-rendu] opération ${nom} non chargeable`, e);
    throw new ErreurRendu({ code: "indisponible", reessayable: false, message: `Opération ${nom} non chargeable dans ce conteneur` });
  }
}

// Audit D : dossiers temporaires laissés par un processus tué (manque de mémoire, SIGKILL), effacés AVANT tout rendu.
const orphelins = await nettoyerTemporairesOrphelins();
if (orphelins.length) console.log(`[studio-rendu] ${orphelins.length} dossier(s) temporaire(s) d'un arrêt brutal effacé(s)`);

const files = new FilesRendu({
  // Lot R4 (mesuré le 03/10 sur le poste de développement) : 3 miniatures demandées ensemble, compositions déjà
  // préparées → 18 s pour les deux premières (en parallèle), 11 s pour la troisième. 45 s laissent de la marge à un
  // serveur chargé ; à froid (compositions non préparées), deux sur trois dépassaient 30 s : voir le préchauffage.
  delaiCourteMs: 45_000,
  operations: {
    "analyse-media": analyseMedia,
    "image-fixe": imageFixe,
    composition,
    "nettoyage-audio": nettoyageAudio,
    "mesure-son": mesureSon,
    // Lot A2 (« Mes images ») : zones floutées sur une COPIE, vignette 9:16, mesures.
    "traitement-image": traitementImage,
    // Générateur G6 / G6b : morceaux de sons ou de prises mis bout à bout sur des coupes.
    assemblage,
    // « Source axion-ia.com » : captures d'écran et courtes vidéos des pages du site (file longue, un à la fois).
    "capture-site": captureSite,
    // Lot R4 : miniatures réelles (5 images autour d'un instant, la plus nette, titre dans la zone sûre).
    miniature,
    // Lot R5 : une LUT appliquée à une image ou une vidéo ; le son d'une voix prêt à publier (même chaîne que le montage).
    etalonnage,
    mixage,
    // Lot R7 (double HeyGen) : passage d'entraînement d'une prise (vidéo 1080) et tranches de l'audio maître (WAV).
    extrait,
    // Carrousels V2-A : pages VisuelPage en JPEG (mesures) puis PDF.
    // Chargées au PREMIER appel (import dynamique) : une panne d'import (validation Zod, composition) ne peut pas
    // empêcher le démarrage ni toucher les 12 autres opérations.
    "visuel-page": async (d, c) => (await charger("visuel-page", () => import("./operations/visuel-page.js"))).visuelPage(d, c),
    "assemblage-pdf": async (d, c) => (await charger("assemblage-pdf", () => import("./operations/assemblage-pdf.js"))).assemblagePdf(d, c),
    // « tranches-audio » (lot M6) : refusée clairement tant qu'elle n'existe pas.
  },
});

// Incident du 12/10 : un rejet non géré fait passer les rendus en cours en échec (jamais « en cours » sans fin).
surveillerRejets(files);

const port = Number(process.env.PORT ?? 4100);
let cle: string | undefined;
try {
  cle = cleDeDemarrage(process.env);
} catch (e) {
  console.error(`[studio-rendu] ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
const serveur = creerServeur(files, { cle });
serveur.listen(port, "0.0.0.0", () => console.log(`[studio-rendu] prêt sur le port ${port}`));
// Lot R4 : les compositions Remotion sont préparées dès le démarrage (≈ 8 s, une fois), pour que la PREMIÈRE miniature
// (ou image fixe) après un redémarrage tienne dans le délai de la file courte. Un échec n'empêche rien : la première
// demande les prépare alors elle-même.
void import("./remotion.js").then(({ paquetCompositions }) => paquetCompositions()).catch((e: unknown) => console.error("[studio-rendu] préparation des compositions en échec", e instanceof Error ? e.message : e));

// Carrousels V2-A : le paquet de MESURE des pages est construit de la même façon, sans bloquer le démarrage.
void import("./paquet-mesure.js").then(({ paquetMesure }) => paquetMesure()).catch((e: unknown) => console.error("[studio-rendu] préparation du paquet de mesure en échec", e instanceof Error ? e.message : e));

function arreter() {
  serveur.close();
  // Les rendus en cours sont perdus : le studio les soumettra à nouveau (même identifiant) au redémarrage.
  setTimeout(() => process.exit(0), 2_000).unref();
}
process.on("SIGTERM", arreter);
process.on("SIGINT", arreter);
