/**
 * ESSAI RÉEL DE BOUT EN BOUT DU STYLE « blocs/2 », SANS DÉPENSE : la vraie chaîne `fabriquerTableau` (fiche, contrôles,
 * calage, mise en page, scènes Remotion, composition FFmpeg avec bruitages) sur la fiche témoin « Formation », rendue par
 * les vraies opérations de `studio-rendu` lancées dans ce processus, avec un « seau » HTTP local à la place du stockage.
 *
 * La voix n'est PAS lue : la voix déjà enregistrée (`voix-formation.wav` et son `temps.json`, horodatages au temps final)
 * est posée dans le journal comme une étape « voix » déjà faite, sous l'empreinte exacte que la chaîne calcule ; la
 * recette de voix n'est donc pas appliquée une seconde fois. Tout outil payant lève une erreur s'il est appelé.
 *
 * Usage (racine, après `npm ci` dans `studio-rendu`, navigateur sans affichage installé pour Remotion) :
 *   npx tsx tests/tableau/style-v2-moteur/essai-reel.mts <voix.wav> <temps.json> <dossier> [vertical,carre,horizontal] [MOT]
 * Résultat : `<dossier>/seau/videos/…/*.mp4` et `<dossier>/compte-rendu.json`.
 */
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join, resolve } from "node:path";
import { controlerProprietes, proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "../../../src/fournisseurs/types";
import { empreinte, fabriquerTableau, texteVoixTableau, type JournalFabrication, type PreparationScenes } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { RECETTE_VOIX_TABLEAU, reglagesRecette } from "../../../src/moteurs/montage-tableau/recette-voix";
import type { AudioVoixTableau } from "../../../src/moteurs/montage-tableau/voix-tableau";
import { finEtAppelDuTableau } from "../../../src/services/tableau-fin";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const RACINE = process.cwd();
const [voixWav, tempsJson, dossierArg, sortiesArg, motArg] = process.argv.slice(2);
if (!voixWav || !tempsJson || !dossierArg) throw new Error("Usage : essai-reel.mts <voix.wav> <temps.json> <dossier> [sorties] [MOT]");
const dossier = resolve(dossierArg);
const seauDir = join(dossier, "seau");
mkdirSync(seauDir, { recursive: true });
const sorties = (sortiesArg ?? "vertical").split(",") as IdFormatSortie[];
const mot = motArg ?? "CINQ";

/** Fichier local d'une clé : les bruitages viennent de `public/`, le reste du seau. */
const chemin = (cle: string) => (cle.startsWith("/bruitages/") ? join(RACINE, "public", cle) : join(seauDir, cle));

// Seau HTTP : GET /f/<clé> lit, PUT /f/<clé> écrit.
const seau = createServer((req, res) => {
  const cle = decodeURIComponent((req.url ?? "").replace(/^\/f\//, "").split("?")[0]);
  const f = chemin(cle);
  if (req.method === "GET" || req.method === "HEAD") {
    if (!existsSync(f)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200);
    if (req.method === "HEAD") res.end();
    else createReadStream(f).pipe(res);
    return;
  }
  if (req.method === "PUT") {
    mkdirSync(dirname(f), { recursive: true });
    const o = createWriteStream(f);
    req.pipe(o);
    o.on("finish", () => {
      res.writeHead(200, { etag: '"essai"' });
      res.end();
    });
    return;
  }
  res.writeHead(405);
  res.end();
});
await new Promise<void>((ok) => seau.listen(0, "127.0.0.1", ok));
const url = (cle: string) => `http://127.0.0.1:${(seau.address() as AddressInfo).port}/f/${encodeURIComponent(cle)}`;

// Les vraies opérations de `studio-rendu`, dans ce processus (chemins calculés : hors du projet TypeScript racine).
const rendu = (m: string) => join(RACINE, "studio-rendu/src", m);
const { FilesRendu } = (await import(rendu("files.ts"))) as { FilesRendu: new (o: unknown) => { soumettre(d: DemandeRendu): unknown; etat(id: string): EtatRendu | null } };
const { composition } = (await import(rendu("operations/composition.ts"))) as { composition: unknown };
const files = new FilesRendu({ operations: { composition }, delaiCourteMs: 30 * 60_000 });
const service: ServiceRendu = {
  soumettre: async (d) => {
    files.soumettre(d);
    return { idRendu: d.idRendu };
  },
  etat: async (id) => files.etat(id) ?? { statut: "inconnu" },
} as ServiceRendu;

// Voix déjà enregistrée, posée comme étape faite (aucune lecture, aucune recette rejouée).
const temps = JSON.parse(readFileSync(tempsJson, "utf8")) as { dureeSec: number; phrases: { mots: { mot: string; debutSec: number; finSec: number }[] }[] };
const mots = temps.phrases.flatMap((p) => p.mots);
const cleVoixFichier = "voix/voix-formation.wav";
mkdirSync(join(seauDir, "voix"), { recursive: true });
copyFileSync(voixWav, chemin(cleVoixFichier));
const fiche = ficheFormation();
const idVoix = "voix-prototype-formation";
const fournisseurVoix = "heygen";
const reglagesLecture = { vitesse: RECETTE_VOIX_TABLEAU.synthese.vitesse, stabilite: 45, emotion: 30 };
const cleVoix = empreinte("voix", texteVoixTableau(fiche), idVoix, reglagesLecture, fournisseurVoix, reglagesRecette());
const audio: AudioVoixTableau = { fichierCle: cleVoixFichier, dureeSec: temps.dureeSec, mots, empreinte: cleVoix, reutilise: true, coutCentimes: 0, fournisseur: fournisseurVoix, caracteres: texteVoixTableau(fiche).length, coupures: 0, respirations: 0, motsParSeconde: mots.length / temps.dureeSec, vitesseConseillee: 1 };
const journal: { valeur: JournalFabrication } = { valeur: { version: "fabrication-tableau/1", etapes: { voix: { empreinte: cleVoix, dureeMs: 0, sortie: audio } } } };

const interdit = (quoi: string) => () => {
  throw new Error(`Appel interdit pendant l'essai : ${quoi}.`);
};
const t0 = Date.now();
const r = await fabriquerTableau({
  videoId: "essai-formation",
  env: "essai",
  lireFiche: async () => fiche,
  contexte: contexteFormation(),
  dejaVu: { coche: true, le: "2026-10-11" },
  sorties,
  choisirFin: (_appelId, sortie) => finEtAppelDuTableau(sortie === "carre" ? "linkedin" : sortie === "horizontal" ? "youtube" : "instagram", "fin-if-mot-envoi", undefined, { mot }),
  journal: { lire: async () => journal.valeur, ecrire: async (j) => void (journal.valeur = j) },
  budget: { tarifCentimesParCaractere: 0, verifierEtReserver: async () => interdit("réservation de la voix")() },
  voix: { voix: interdit("voix"), stockage: interdit("stockage de la voix"), aligneur: interdit("aligneur"), rendu: () => service, renduEstSimule: () => false, idVoix, reglages: reglagesLecture, tauxUsdEur: 1, fournisseurVoix, cle: (n: string) => `voix/${n}` } as never,
  preparation: { proprietesScenes, controlerProprietes } as unknown as PreparationScenes,
  scenes: { rendu: () => service, depot: async (cle) => url(cle), existe: async (cle) => existsSync(chemin(cle)) },
  montage: {
    rendu: () => service,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, url(c)])), depots: Object.fromEntries(depots.map((d) => [d.cle, url(d.cle)])) }),
    cle: (c, nom) => `videos/${c.videoId}/${nom}`,
  },
  attendre: () => new Promise<void>((ok) => setTimeout(ok, 1_000)),
});
const resume = {
  dureeTotaleSec: Math.round((Date.now() - t0) / 1000),
  coutCentimes: r.coutCentimes,
  dernierMotSec: mots.at(-1)!.finSec,
  sorties: r.sorties.map((s) => ({ format: s.format, largeur: s.largeur, hauteur: s.hauteur, dureeSec: s.dureeSec, fichier: chemin(s.cles.video), controles: s.controles.resume, controleFichier: s.controleFichier, fin: s.fin, phrases: s.controles.phrases })),
};
writeFileSync(join(dossier, "compte-rendu.json"), JSON.stringify(resume, null, 2));
console.log(JSON.stringify(resume, null, 2));
seau.close();
process.exit(0);
