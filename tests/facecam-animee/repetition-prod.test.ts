/**
 * RÉPÉTITION GÉNÉRALE DE LA CHAÎNE DE PRODUCTION (Lot I, ordre permanent de Will : de bout en bout, vrais fichiers). IGNORÉE par défaut
 * (rendu de plusieurs minutes) ; à lancer à la main :
 *   REPETITION_PROD=1 REPETITION_SORTIE=/chemin/dossier npx vitest run tests/facecam-animee/repetition-prod.test.ts
 *
 * La vraie prise (`motion-v4/communs/prise-complete-IMG7747.mp4`) passe par le MÊME CODE que sur le serveur :
 *  - moteur `montage-facecam-animee` (lancer, puis `avancer` toutes les 5 s comme la boucle de fond) et outils du service
 *    (`outilsFacecamAnimee`), avec, à la place des connexions du serveur :
 *      · un stockage local (adresses http://127.0.0.1 au lieu des adresses signées R2 ; lecture et dépôt réels),
 *      · la transcription faster-whisper de CETTE prise (`tests/fixtures/img7747-v2-montage-reel.json` : le modèle n'est pas téléchargeable ici),
 *      · un faux client Claude qui rejoue le plan de la répétition validée (`plan-realisateur.json`), passé par l'adaptateur du service ;
 *  - le VRAI service de rendu (`studio-rendu`, `tsx src/index.ts`, en local, mode essai pour les adresses 127.0.0.1) : opération
 *    `composition` en mode `facecam-v4` (montage FFmpeg de la prise, médias servis par `servirDossier`, composition, ré-encodage, vignette).
 * Puis la vidéo produite est comparée à la répétition validée (`video-complete.mp4`) : durée, plan (plaquettes, sous-titres), zéro Certifexemple,
 * PSNR image par image.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

const ACTIVE = process.env.REPETITION_PROD === "1";
const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const PRISE = join(RACINE, "studio-rendu/compositions/interface-claire/motion-v4/communs/prise-complete-IMG7747.mp4");
const SORTIE = process.env.REPETITION_SORTIE ?? join(tmpdir(), "repetition-prod-lot-i");
const PORT_RENDU = 4199;
const CLE_RENDU = "repetition-lot-i";

let stockage: Server | null = null;
let rendu: ChildProcess | null = null;
afterAll(async () => {
  rendu?.kill("SIGTERM");
  await new Promise<void>((ok) => (stockage ? stockage.close(() => ok()) : ok()));
});

/** Stockage local : GET / PUT d'un fichier par sa clé (comme une adresse signée R2). */
async function demarrerStockage(dossier: string): Promise<string> {
  stockage = createServer((req, res) => {
    const cle = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname.slice(1));
    const chemin = join(dossier, cle);
    if (req.method === "PUT") {
      mkdirSync(dirname(chemin), { recursive: true });
      const f = createWriteStream(chemin);
      req.pipe(f);
      f.on("finish", () => { res.writeHead(200); res.end(); });
      return;
    }
    if (!existsSync(chemin)) { res.writeHead(404); res.end(); return; }
    const { size } = statSync(chemin);
    res.writeHead(200, { "content-length": size, "content-type": "application/octet-stream" });
    createReadStream(chemin).pipe(res);
  });
  await new Promise<void>((ok) => stockage!.listen(0, "127.0.0.1", ok));
  return `http://127.0.0.1:${(stockage!.address() as AddressInfo).port}`;
}

async function demarrerRendu(journal: string): Promise<void> {
  const sortie = createWriteStream(journal);
  rendu = spawn(join(RACINE, "studio-rendu/node_modules/.bin/tsx"), ["src/index.ts"], {
    cwd: join(RACINE, "studio-rendu"),
    env: { ...process.env, PORT: String(PORT_RENDU), STUDIO_RENDU_CLE: CLE_RENDU, STUDIO_RENDU_ESSAI: "1", NODE_ENV: "development" },
  });
  rendu.stdout?.pipe(sortie);
  rendu.stderr?.pipe(sortie);
  for (let k = 0; k < 120; k++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT_RENDU}/sante`)).ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error("studio-rendu ne démarre pas");
}

const sondes = (f: string, quoi: string) => execFileSync("ffprobe", ["-v", "error", ...quoi.split(" "), "-of", "default=nw=1:nk=1", f]).toString().trim();

describe.skipIf(!ACTIVE)("Lot I · répétition générale de la chaîne de production", () => {
  it(
    "IMG_7747 → vidéo finale identique en contenu à la répétition validée",
    async () => {
      mkdirSync(SORTIE, { recursive: true });
      const dossierStockage = join(SORTIE, "stockage");
      const base = await demarrerStockage(dossierStockage);
      const priseCle = "studio/dev/entree/facecam-animee/f-IMG7747.mp4";
      mkdirSync(dirname(join(dossierStockage, priseCle)), { recursive: true });
      copyFileSync(PRISE, join(dossierStockage, priseCle));
      await demarrerRendu(join(SORTIE, "studio-rendu.log"));

      const [{ outilsFacecamAnimee }, { creerMoteurMontageFacecamAnimee }, { creerServiceRenduHttp }] = await Promise.all([
        import("@/services/facecam-animee"),
        import("@/moteurs/montage-facecam-animee"),
        import("@/fournisseurs/rendu/client"),
      ]);
      const brut = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };
      const script = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
      const valide = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
      const motsForts = [...new Set(valide.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
      const appelsClaude: string[] = [];

      const outils = await outilsFacecamAnimee({
        videoId: "v-repetition-lot-i",
        travailId: "trav-repetition-lot-i",
        production: false,
        signer: { lecture: async (cle) => `${base}/${encodeURI(cle)}`, depot: async (cle) => `${base}/${encodeURI(cle)}` },
        rendu: creerServiceRenduHttp(`http://127.0.0.1:${PORT_RENDU}`, { cle: CLE_RENDU }),
        transcrire: async () => ({ mots: brut.mots, dureeSec: 130.732 }),
        appelerRoleClaude: async (role, entree) => {
          appelsClaude.push(`${role.modele} · ${role.id} v${role.version} · ${entree.variable.length} car.`);
          return { ok: true, simule: false, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: valide.elementsV4, motsForts } };
        },
      });
      const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils });
      const commande = { videoId: "v-repetition-lot-i", formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"], briques: {}, distribution: [], entrees: { facecamAnimee: { priseCle, fichierId: "f-IMG7747", texteValide: script, accordEssaiReel: true } } } as unknown as CommandeFabrication;
      expect(moteur.refusAuLancement?.(commande)).toBeNull();

      const t0 = Date.now();
      let travail: Travail = await moteur.lancer(commande, { travailId: "trav-repetition-lot-i", versionId: "ver-repetition-lot-i", titre: "Répétition Lot I" });
      let resultat;
      const passages: string[] = [];
      while (travail.statut !== "termine" && Date.now() - t0 < 45 * 60_000) {
        const r = await moteur.avancer(travail, commande);
        travail = r.travail;
        resultat = r.resultat;
        const etat = travail.parametres?.facecamAnimeeV4 as { etape: string } | undefined;
        const ligne = `${Math.round((Date.now() - t0) / 1000)} s · ${travail.statut} · ${etat?.etape}`;
        if (passages.at(-1)?.split(" · ").slice(1).join() !== ligne.split(" · ").slice(1).join()) passages.push(ligne);
        if (travail.statut === "echec") break;
        if (travail.statut !== "termine") await new Promise((ok) => setTimeout(ok, 5000));
      }
      writeFileSync(join(SORTIE, "travail.json"), JSON.stringify({ passages, travail, appelsClaude }, null, 1));
      expect(travail.erreur).toBeUndefined();
      expect(travail.statut).toBe("termine");
      const sortie = resultat!.sorties[0];
      const video = join(dossierStockage, sortie.fichierCle);
      expect(existsSync(video)).toBe(true);
      expect(existsSync(join(dossierStockage, sortie.vignetteCle))).toBe(true);
      copyFileSync(video, join(SORTIE, "video-chaine-prod.mp4"));

      // Contenu : même plan que la répétition validée.
      const etat = travail.parametres!.facecamAnimeeV4 as { realisation: { plan: PlanFacecamAnimee; version: string; essais: number }; coupes: { gardes: unknown[]; dureeSec: number } };
      const plan = etat.realisation.plan;
      expect(etat.realisation.version).toBe("complete");
      expect(plan.elementsV4).toEqual(valide.elementsV4);
      expect(plan.groupes).toEqual(valide.groupes);
      expect(plan.duree).toBe(valide.duree);
      expect(JSON.stringify(plan.elementsV4)).not.toMatch(/certifexemple/i);

      // Fichier : durée, format, son ; comparaison image par image avec la vidéo validée.
      const valideMp4 = join(REPETITION, "video-complete.mp4");
      const duree = Number(sondes(video, "-show_entries format=duration"));
      const dureeValide = Number(sondes(valideMp4, "-show_entries format=duration"));
      const taille = sondes(video, "-select_streams v:0 -show_entries stream=width,height,r_frame_rate").split("\n");
      const audio = sondes(video, "-select_streams a:0 -show_entries stream=codec_name,sample_rate").split("\n");
      let journalPsnr = "";
      try {
        journalPsnr = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${video}" -i "${valideMp4}" -lavfi "[0:v][1:v]psnr" -f null - 2>&1 | grep -o 'average:[^ ]*' | tail -1`]).toString().trim();
      } catch {
        journalPsnr = "";
      }
      const rapport = { duree, dureeValide, taille, audio, psnrMoyen: journalPsnr, octets: statSync(video).size, gardes: etat.coupes.gardes.length, dureeMontee: etat.coupes.dureeSec, plaquettes: plan.elementsV4?.length, groupes: plan.groupes.length, essaisClaude: etat.realisation.essais, appelsClaude, passages, mesuresRendu: sortie };
      writeFileSync(join(SORTIE, "rapport-comparaison.json"), JSON.stringify(rapport, null, 1));
      console.info("[répétition Lot I]", JSON.stringify(rapport));
      expect(Math.abs(duree - dureeValide)).toBeLessThan(0.1);
      expect(taille.slice(0, 2)).toEqual(["1080", "1920"]);
      expect(taille[2]).toBe("30/1");
      expect(audio[0]).toBe("aac");
    },
    50 * 60_000,
  );
});
