/**
 * LOTS R4-R5 — corrections de la relecture SÉCURITÉ (tête 2ec5382, veto). Chaque garde a son test, prouvé ROUGE en
 * cassant la garde puis vert une fois rétablie (voir docs/OUTILS-REELS-R5.md, « Corrections sécurité ») :
 *   n° 1  lecture d'un .cube bornée en TEMPS (expression sans ambiguïté, 32 signes par nombre, 256 par ligne) ;
 *   n° 2  lecture bornée en MÉMOIRE (ligne par ligne, lignes hors couleurs comptées, taille liée à la grille annoncée),
 *         dans le navigateur, le studio et studio-rendu ;
 *   n° 3  clé partagée obligatoire en production (studio-rendu ET studio) ;
 *   n° 4-5 studio-rendu ne lit et n'écrit que le stockage du studio (jamais un fichier local hors mode essai) ;
 *   n° 6  format imposé et fichier local seulement pour chaque entrée téléchargée ;
 *   n° 7  plafonds d'octets sur toutes les entrées, mixage par blocs et durée plafonnée.
 * Les n° 8 et 9 (import d'une LUT sans octets, raccourci de la simulation) sont dans `r5-etalonnage-son.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CARACTERES_MAX_LIGNE, LecteurCube, lireCube, NOMBRE_DECIMAL } from "@/lib/lut3d";
import { refusRenduSansCle } from "@/lib/demarrage";
import { obtenirServiceRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu } from "../studio-rendu/src/contrat";
import { FilesRendu } from "../studio-rendu/src/files";
import { lireCubeFichier } from "../studio-rendu/src/lut";
import { analyseMedia } from "../studio-rendu/src/operations/analyse-media";
import { etalonnage, OCTETS_MAX_VIDEO } from "../studio-rendu/src/operations/etalonnage";
import { entreePermise } from "../studio-rendu/src/operations/miniature";
import { DUREE_MAX_SEC, gainsEffacement, melangerParBlocs, mixage, OCTETS_MAX_VOIX } from "../studio-rendu/src/operations/mixage";
import { adressePermise, deposer, formatReconnu, hotesPermis, lectureLocale, modeEssai, OCTETS_MAX_ENTREE, telecharger } from "../studio-rendu/src/outils";
import { adressesRefusees, cleDeDemarrage, creerServeur } from "../studio-rendu/src/serveur";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const dossier = mkdtempSync(join(tmpdir(), "r45-securite-"));
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

/** Exécute `f` sans le mode essai (comme en production), puis le rétablit. */
async function sansEssai<T>(f: () => Promise<T> | T): Promise<T> {
  const avant = process.env.STUDIO_RENDU_ESSAI;
  delete process.env.STUDIO_RENDU_ESSAI;
  try {
    return await f();
  } finally {
    if (avant !== undefined) process.env.STUDIO_RENDU_ESSAI = avant;
  }
}

function chrono<T>(f: () => T): { ms: number; erreur: unknown } {
  const debut = performance.now();
  let erreur: unknown = null;
  try {
    f();
  } catch (e) {
    erreur = e;
  }
  return { ms: performance.now() - debut, erreur };
}

describe("n° 1 · .cube : lecture bornée en temps", () => {
  it("l'expression des nombres est sans ambiguïté : 200 000 chiffres suivis d'une lettre, refusés en moins de 50 ms", () => {
    const { ms } = chrono(() => expect(NOMBRE_DECIMAL.test("1".repeat(200_000) + "x")).toBe(false));
    expect(ms).toBeLessThan(50);
  });

  it("l'expression accepte et refuse exactement les mêmes nombres qu'avant", () => {
    for (const bon of ["0", "1", "1.", "1.5", ".5", "-0.25", "+3", "1e-3", "2.5E+2", "0.123456789"]) expect(NOMBRE_DECIMAL.test(bon), bon).toBe(true);
    for (const mauvais of ["", ".", "-", "1.2.3", "0x1", "Infinity", "NaN", "1e", "1e1234", "1,5", "--1", "1 2"]) expect(NOMBRE_DECIMAL.test(mauvais), mauvais).toBe(false);
  });

  it("un jeton de 1 Mo (fichier piégé) est refusé en moins de 50 ms, avant toute expression", () => {
    const piege = "LUT_3D_SIZE 17\n0 0 " + "1".repeat(1024 * 1024) + "x\n";
    const { ms, erreur } = chrono(() => lireCube(piege));
    expect(ms).toBeLessThan(50);
    expect(String(erreur)).toMatch(/beaucoup trop longue/);
  });

  it("32 signes au plus par nombre, 256 par ligne", () => {
    const entete = "LUT_3D_SIZE 2\n" + "0.5 0.5 0.5\n".repeat(7);
    expect(lireCube(entete + "0.5 0.5 " + "0." + "5".repeat(29)).taille).toBe(2); // 31 signes : lu
    expect(() => lireCube(entete + "0.5 0.5 " + "0." + "5".repeat(31))).toThrow(/illisible/); // 33 signes : refusé
    expect(() => lireCube(entete + "0.5 0.5 0.5" + " ".repeat(CARACTERES_MAX_LIGNE))).toThrow(/beaucoup trop longue/);
    expect(() => lireCube("# " + "x".repeat(CARACTERES_MAX_LIGNE) + "\n" + entete)).toThrow(/beaucoup trop longue/);
  });

  it("lu par morceaux, un jeton géant est refusé dès que la ligne en cours dépasse 256 signes", () => {
    const l = new LecteurCube().pousser("LUT_3D_SIZE 17\n0 0 ");
    expect(() => {
      for (let i = 0; i < 1000; i++) l.pousser("1".repeat(1024));
    }).toThrow(/beaucoup trop longue/);
  });
});

describe("relecture R45 (2e) D · fins de ligne des anciens fichiers Mac", () => {
  const cube = (fin: string) => `TITLE "x"${fin}LUT_3D_SIZE 5${fin}` + `0 0.5 1${fin}`.repeat(125);
  it("un .cube aux lignes finies par « \\r » seul se lit comme les autres ; « \\r\\n » compte pour une seule fin", () => {
    const attendu = lireCube(cube("\n"));
    for (const fin of ["\r", "\r\n"]) expect(lireCube(cube(fin)).donnees, JSON.stringify(fin)).toEqual(attendu.donnees);
    // Coupé entre « \r » et « \n » : toujours une seule fin de ligne (sinon une ligne vide en trop par couleur : refus, 64 au plus après les couleurs).
    const lecteur = new LecteurCube();
    for (const morceau of cube("\r\n").split(/(?<=\r)/)) lecteur.pousser(morceau);
    expect(lecteur.terminer().donnees).toEqual(attendu.donnees);
  });
});

describe("n° 2 · .cube : lecture bornée en mémoire", () => {
  it("50 Mo de sauts de ligne : refus rapide, sans mémoire géante (< 50 Mo de plus)", () => {
    const texte = "\n".repeat(50 * 1024 * 1024 - 32) + "LUT_3D_SIZE 2\n";
    expect(texte.indexOf("L")).toBeGreaterThan(0); // texte mis à plat AVANT la mesure (sa propre copie ne compte pas)
    const avant = process.memoryUsage();
    const { ms, erreur } = chrono(() => lireCube(texte));
    const apres = process.memoryUsage();
    expect(String(erreur)).toMatch(/trop de lignes vides/);
    expect(ms).toBeLessThan(500);
    expect(apres.rss - avant.rss).toBeLessThan(50 * 1024 * 1024);
    expect(apres.heapUsed - avant.heapUsed).toBeLessThan(50 * 1024 * 1024);
  });

  it("1 000 lignes hors couleurs avant les couleurs, 64 après", () => {
    const couleurs = "0.5 0.5 0.5\n".repeat(8);
    expect(lireCube("#\n".repeat(998) + "LUT_3D_SIZE 2\n" + couleurs).taille).toBe(2);
    expect(() => lireCube("#\n".repeat(1000) + "LUT_3D_SIZE 2\n" + couleurs)).toThrow(/trop de lignes vides/);
    expect(lireCube("LUT_3D_SIZE 2\n" + couleurs + "\n".repeat(63)).taille).toBe(2);
    expect(() => lireCube("LUT_3D_SIZE 2\n" + couleurs + "\n".repeat(65))).toThrow(/trop de lignes vides/);
  });

  it("taille du fichier liée à la grille annoncée : 80 signes par couleur en moyenne", () => {
    const n = 17;
    const longue = "0.5" + " ".repeat(240) + "0.5 0.5\n"; // 250 signes, lisible
    expect(() => lireCube(`LUT_3D_SIZE ${n}\n` + longue.repeat(n ** 3))).toThrow(/bien plus gros que ce qu'annonce sa taille/);
    expect(lireCube(`LUT_3D_SIZE ${n}\n` + "0.123456 0.123456 0.123456\n".repeat(n ** 3)).taille).toBe(n);
  });

  it("studio-rendu lit le fichier téléchargé au fil de l'eau : 50 Mo de sauts de ligne refusés sans le charger", async () => {
    const chemin = join(dossier, "piege.cube");
    writeFileSync(chemin, Buffer.alloc(50 * 1024 * 1024, 0x0a));
    const avant = process.memoryUsage().rss;
    const debut = performance.now();
    await expect(lireCubeFichier(chemin)).rejects.toThrow(/trop de lignes vides/);
    expect(performance.now() - debut).toBeLessThan(500);
    expect(process.memoryUsage().rss - avant).toBeLessThan(50 * 1024 * 1024);
    // Et un vrai fichier se lit comme avant.
    writeFileSync(chemin, "LUT_3D_SIZE 2\n" + "0 0 0\n".repeat(8));
    expect((await lireCubeFichier(chemin)).taille).toBe(2);
  });
});

describe("n° 3 · clé partagée obligatoire en production", () => {
  it("studio-rendu refuse de démarrer en production sans clé", () => {
    expect(() => cleDeDemarrage({ NODE_ENV: "production" })).toThrow(/refuse de démarrer/);
    expect(() => cleDeDemarrage({ NODE_ENV: "production", STUDIO_RENDU_CLE: "  " })).toThrow(/refuse de démarrer/);
    expect(cleDeDemarrage({ NODE_ENV: "production", STUDIO_RENDU_CLE: "abc" })).toBe("abc");
    expect(cleDeDemarrage({ NODE_ENV: "development" })).toBeUndefined();
  });

  it("le studio refuse un serveur de rendu relié sans clé en production (démarrage et client)", () => {
    const prod = { NODE_ENV: "production", STUDIO_RENDU_URL: "http://studio-rendu:4100" };
    expect(refusRenduSansCle(prod)).toMatch(/STUDIO_RENDU_CLE manque/);
    expect(refusRenduSansCle({ ...prod, STUDIO_RENDU_CLE: "abc" })).toBeNull();
    expect(refusRenduSansCle({ NODE_ENV: "production" })).toBeNull(); // rendu simulé : rien à protéger
    expect(refusRenduSansCle({ ...prod, NODE_ENV: "development" })).toBeNull();
    expect(() => obtenirServiceRendu(prod)).toThrow(/STUDIO_RENDU_CLE manque/);
    expect(() => obtenirServiceRendu({ ...prod, STUDIO_RENDU_CLE: "abc" })).not.toThrow();
  });
});

describe("n° 4-5 · studio-rendu ne lit et n'écrit que le stockage du studio", () => {
  const env = { R2_ACCOUNT_ID: "compte", NODE_ENV: "production" };

  it("hôtes permis : le point d'accès R2 du compte (calculé comme le studio), plus STUDIO_RENDU_HOTES", () => {
    expect(hotesPermis(env)).toEqual(["compte.r2.cloudflarestorage.com"]);
    expect(hotesPermis({ R2_ACCOUNT_ID: "compte", R2_PUBLIC_HOST: "https://compte.eu.r2.cloudflarestorage.com/" })).toEqual(["compte.eu.r2.cloudflarestorage.com"]);
    expect(hotesPermis({ STUDIO_RENDU_HOTES: " a.exemple , B.exemple" })).toEqual(["a.exemple", "b.exemple"]);
    expect(hotesPermis({})).toEqual([]);
  });

  it("adresse : https, hôte permis, sans port ni identifiants ; jamais une adresse interne", () => {
    expect(adressePermise("https://compte.r2.cloudflarestorage.com/seau/cle?X-Amz-Signature=s", env)).toBe(true);
    for (const mauvaise of [
      "http://compte.r2.cloudflarestorage.com/seau/cle",
      "https://compte.r2.cloudflarestorage.com:8443/seau/cle",
      "https://a:b@compte.r2.cloudflarestorage.com/seau/cle",
      "https://autre.r2.cloudflarestorage.com/seau/cle",
      "https://compte.r2.cloudflarestorage.com.attaque.exemple/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:4100/rendus",
      "file:///etc/passwd",
      "/proc/self/environ",
    ])
      expect(adressePermise(mauvaise, env), mauvaise).toBe(false);
  });

  it("relecture R45 (2e) A · une adresse lue autrement par FFmpeg est refusée : seule la forme normalisée passe", () => {
    // `new URL` lit `\` comme `/` (hôte R2) ; FFmpeg prend ce qui suit le dernier `@` (10.0.0.5:6379).
    for (const piege of [
      "https://compte.r2.cloudflarestorage.com\\@10.0.0.5:6379/x",
      "https://compte.r2.cloudflarestorage.com/x@10.0.0.5:6379/y",
      "https://compte.r2.cloudflarestorage.com/a b",
      "https://compte.r2.cloudflarestorage.com/a\tb",
      "https://compte.r2.cloudflarestorage.com/a\u0000b",
      " https://compte.r2.cloudflarestorage.com/x",
      "HTTPS://compte.r2.cloudflarestorage.com/x",
      "https://compte.r2.cloudflarestorage.com/a/../b",
      "https://compte.r2.cloudflarestorage.com",
    ])
      expect(adressePermise(piege, env), JSON.stringify(piege)).toBe(false);
    // Les adresses signées du studio sont déjà normalisées : elles passent toujours.
    expect(adressePermise("https://compte.r2.cloudflarestorage.com/seau/studio/prod/f%20x.mp4?X-Amz-Credential=a%2Fb&X-Amz-Signature=0f", env)).toBe(true);
    expect(() => entreePermise("https://r2\\@10.0.0.5:6379/x")).toThrow(/Adresse refusée/);
  });

  it("mode essai : seulement s'il est demandé, et jamais en production", () => {
    expect(modeEssai({ STUDIO_RENDU_ESSAI: "1", NODE_ENV: "test" })).toBe(true);
    expect(modeEssai({ STUDIO_RENDU_ESSAI: "1", NODE_ENV: "production" })).toBe(false);
    expect(modeEssai({ NODE_ENV: "test" })).toBe(false);
    expect(adressePermise("http://127.0.0.1:9/x", { STUDIO_RENDU_ESSAI: "1", NODE_ENV: "production" })).toBe(false);
    expect(adressePermise("http://127.0.0.1:9/x", { STUDIO_RENDU_ESSAI: "1", NODE_ENV: "test" })).toBe(true);
  });

  it("miniature : un chemin local n'est lu qu'en mode essai", async () => {
    expect(() => entreePermise("/tmp/video.mp4")).not.toThrow();
    await sansEssai(() => {
      expect(() => entreePermise("/proc/self/environ")).toThrow(/Adresse refusée/);
      expect(() => entreePermise("../autre-rendu/video.mp4")).toThrow(/Adresse refusée/);
      expect(() => entreePermise("http://127.0.0.1:9/v.mp4")).toThrow(/Adresse refusée/);
    });
  });

  describe("téléchargement, dépôt et serveur", () => {
    let serveur: Server;
    let base = "";
    let appels = 0;
    let segment: Buffer | null = null;
    beforeAll(async () => {
      if (ffmpegPresent) {
        spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=d=1:size=64x36", "-f", "mpegts", join(dossier, "segment.ts")]);
        segment = readFileSync(join(dossier, "segment.ts"));
      }
      serveur = createServer((req, res) => {
        appels++;
        // Redirection vers une autre adresse (ici du même poste, pour que la suivre RÉUSSISSE si la garde manquait).
        if (req.url === "/redirige") return void res.writeHead(302, { location: `${base}/interne` }).end();
        if (req.url === "/segment.ts" && segment) return void res.writeHead(200).end(segment);
        const annonce = /^\/annonce-(\d+)$/.exec(req.url ?? "");
        if (annonce) {
          // Taille annoncée : seul l'en-tête part, la suite ne viendra jamais (le téléchargement doit s'arrêter avant).
          res.writeHead(200, { "content-length": annonce[1] });
          res.write("x");
          return void setTimeout(() => res.destroy(), 2000).unref();
        }
        // Liste de lecture dont le morceau est servi ici : sans garde, FFmpeg la suivrait et la lirait sans erreur.
        if (req.url === "/liste.m3u8") return void res.writeHead(200).end(`#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n${base}/segment.ts\n#EXT-X-ENDLIST\n`);
        if (req.url === "/lut.cube") return void res.writeHead(200).end("LUT_3D_SIZE 2\n" + "0 0 0\n".repeat(8));
        res.writeHead(200).end("ok");
      });
      await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
      base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
    });
    afterAll(() => serveur.close());

    it("hors mode essai, une adresse non permise n'est jamais appelée (lecture comme dépôt)", async () => {
      appels = 0;
      await sansEssai(async () => {
        await expect(telecharger(`${base}/x`, join(dossier, "x"))).rejects.toThrow(/Adresse refusée/);
        writeFileSync(join(dossier, "sortie"), "x");
        await expect(deposer(`${base}/depot`, join(dossier, "sortie"), "text/plain")).rejects.toThrow(/Adresse refusée/);
      });
      expect(appels).toBe(0);
    });

    it("une redirection n'est jamais suivie", async () => {
      await expect(telecharger(`${base}/redirige`, join(dossier, "r"))).rejects.toThrow();
    });

    it("le serveur refuse (400) une demande dont une adresse n'est pas permise, rien n'est lancé", async () => {
      let lances = 0;
      const files = new FilesRendu({ operations: { "analyse-media": async () => (lances++, { mesures: {} }) } });
      const s = creerServeur(files);
      await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
      const adresse = `http://127.0.0.1:${(s.address() as AddressInfo).port}/rendus`;
      const demande = (media: string, depot = "https://r2/depot"): DemandeRendu => ({ idRendu: `a-${Math.random().toString(36).slice(2)}`, operation: "analyse-media", file: "courte", entrees: { media }, sortie: { urlDepot: depot, cle: "c" }, parametres: {} });
      try {
        for (const d of [demande("https://169.254.169.254/x"), demande("https://r2/x", "https://attaque.exemple/depot"), { ...demande("https://r2/x"), parametres: { depots: { master: { urlDepot: "https://attaque.exemple/m" } } } }]) {
          expect(adressesRefusees(d)).toBeGreaterThan(0);
          const r = await fetch(adresse, { method: "POST", body: JSON.stringify(d) });
          expect(r.status).toBe(400);
          expect(await r.json()).toEqual({ erreur: "adresse refusée" });
        }
        expect((await fetch(adresse, { method: "POST", body: JSON.stringify(demande("https://r2/x")) })).status).toBe(202);
      } finally {
        s.close();
      }
      expect(lances).toBeLessThanOrEqual(1);
    });

    it("relecture R45 (2e) B · capture du site : page axion-ia.com acceptée (202), autre site refusé, dépôt toujours vérifié", async () => {
      let lances = 0;
      const files = new FilesRendu({ operations: { "capture-site": async () => (lances++, { mesures: {} }) } });
      const s = creerServeur(files);
      await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
      const adresse = `http://127.0.0.1:${(s.address() as AddressInfo).port}/rendus`;
      const capture = (page: string, depot = "https://r2/studio/site/f.jpg?X-Amz-Signature=s"): DemandeRendu => ({ idRendu: `c-${Math.random().toString(36).slice(2)}`, operation: "capture-site", file: "longue", entrees: { page }, sortie: { urlDepot: depot, cle: "c" }, parametres: { type: "image", format: "9:16" } });
      try {
        expect(adressesRefusees(capture("https://www.axion-ia.com/avocats"))).toBe(0);
        expect((await fetch(adresse, { method: "POST", body: JSON.stringify(capture("https://www.axion-ia.com/avocats")) })).status).toBe(202);
        for (const d of [capture("https://exemple.com/"), capture("http://127.0.0.1:4100/rendus"), capture("https://www.axion-ia.com/avocats", "https://attaque.exemple/depot")]) {
          expect(adressesRefusees(d), d.entrees.page).toBeGreaterThan(0);
          expect((await fetch(adresse, { method: "POST", body: JSON.stringify(d) })).status).toBe(400);
        }
        // Les hôtes du site ne deviennent jamais lisibles ni cibles de dépôt pour les autres opérations.
        expect(adressePermise("https://www.axion-ia.com/avocats")).toBe(false);
        const analyse: DemandeRendu = { idRendu: "a-site", operation: "analyse-media", file: "courte", entrees: { media: "https://www.axion-ia.com/v.mp4" }, sortie: { urlDepot: "https://r2/d", cle: "a" }, parametres: {} };
        expect(adressesRefusees(analyse)).toBeGreaterThan(0);
        expect(adressesRefusees({ ...analyse, entrees: { page: "https://www.axion-ia.com/" } })).toBeGreaterThan(0);
      } finally {
        s.close();
      }
      expect(lances).toBeLessThanOrEqual(1);
    });

    it("n° 7 · plafond d'octets sur toute entrée (4 Go par défaut), vidéo d'étalonnage et voix du mixage comprises", async () => {
      expect(OCTETS_MAX_ENTREE).toBe(4 * 1024 ** 3);
      await expect(telecharger(`${base}/annonce-${5 * 1024 ** 3}`, join(dossier, "g"))).rejects.toThrow(/trop volumineuse/);
      const ctx = (nom: string) => ({ dossier: mkdtempSync(join(dossier, nom)), signal: new AbortController().signal, progression: () => undefined });
      expect(OCTETS_MAX_VIDEO).toBeLessThanOrEqual(OCTETS_MAX_ENTREE);
      await expect(etalonnage({ idRendu: "v", operation: "etalonnage", file: "longue", entrees: { video: `${base}/annonce-${5 * 1024 ** 3}`, lut: `${base}/lut.cube` }, sortie: { urlDepot: "", cle: "v" }, parametres: {} }, ctx("video-"))).rejects.toThrow(/trop volumineuse/);
      expect(OCTETS_MAX_VOIX).toBeLessThan(1024 ** 3);
      await expect(mixage({ idRendu: "m", operation: "mixage", file: "longue", entrees: { voix: `${base}/annonce-${500 * 1024 ** 2}` }, sortie: { urlDepot: "", cle: "m" }, parametres: {} }, ctx("voix-"))).rejects.toThrow(/trop volumineuse/);
    });

    it.skipIf(!ffmpegPresent)("n° 6 · une liste de lecture déguisée est refusée (étalonnage, mixage, analyse)", { timeout: 60_000 }, async () => {
      const ctx = (nom: string) => ({ dossier: mkdtempSync(join(dossier, nom)), signal: new AbortController().signal, progression: () => undefined });
      await expect(etalonnage({ idRendu: "e", operation: "etalonnage", file: "courte", entrees: { image: `${base}/liste.m3u8`, lut: `${base}/lut.cube` }, sortie: { urlDepot: "", cle: "e" }, parametres: {} }, ctx("img-"))).rejects.toThrow(/type non permis/);
      await expect(etalonnage({ idRendu: "e", operation: "etalonnage", file: "longue", entrees: { video: `${base}/liste.m3u8`, lut: `${base}/lut.cube` }, sortie: { urlDepot: "", cle: "e" }, parametres: {} }, ctx("vid-"))).rejects.toThrow(/type non permis/);
      await expect(mixage({ idRendu: "m", operation: "mixage", file: "longue", entrees: { voix: `${base}/liste.m3u8` }, sortie: { urlDepot: "", cle: "m" }, parametres: {} }, ctx("mix-"))).rejects.toThrow(/type non permis/);
      await expect(analyseMedia({ idRendu: "a", operation: "analyse-media", file: "courte", entrees: { media: `${base}/liste.m3u8` }, sortie: { urlDepot: "", cle: "a" }, parametres: {} }, ctx("ana-"))).rejects.toThrow();
    });
  });
});

describe("n° 6 · format reconnu puis imposé", () => {
  const octets = (...x: (number | string)[]) => new Uint8Array(x.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));
  it("formats reconnus à leurs premiers octets ; une liste de lecture ou un texte n'est rien", () => {
    expect(formatReconnu(octets(0x89, "PNG\r\n", 0x1a, 0x0a))).toBe("png_pipe");
    expect(formatReconnu(octets(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg_pipe");
    expect(formatReconnu(octets("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("webp_pipe");
    expect(formatReconnu(octets("RIFF", 0, 0, 0, 0, "WAVE"))).toBe("wav");
    expect(formatReconnu(octets("fLaC"))).toBe("flac");
    expect(formatReconnu(octets("OggS"))).toBe("ogg");
    expect(formatReconnu(octets("ID3", 4))).toBe("mp3");
    expect(formatReconnu(octets(0xff, 0xfb, 0x90))).toBe("mp3");
    expect(formatReconnu(octets(0, 0, 0, 0x20, "ftypisom"))).toBe("mov");
    for (const autre of ["#EXTM3U\n", "ffconcat version 1.0", "<?xml ", "[playlist]"]) expect(formatReconnu(octets(autre)), autre).toBeNull();
  });
  it("avant chaque entrée téléchargée : fichier local seulement, format imposé", () => {
    expect(lectureLocale("mov")).toEqual(["-protocol_whitelist", "file", "-f", "mov"]);
  });
});

describe("n° 7 · mixage : musique mélangée par blocs, durée plafonnée", () => {
  it("le calcul par blocs donne exactement les mêmes gains que le calcul d'un seul tenant", async () => {
    const n = 48_000 * 3 + 123;
    const voix = new Float32Array(n);
    for (let i = 0; i < n; i++) voix[i] = (i > 30_000 && i < 90_000 ? 0.3 : 0.0005) * Math.sin(i / 7);
    const musique = new Float32Array(n * 2).map((_, i) => 0.1 * Math.sin(i / 11));
    writeFileSync(join(dossier, "v.f32"), Buffer.from(voix.buffer));
    writeFileSync(join(dossier, "m.f32"), Buffer.from(musique.buffer.slice(0, (n - 5000) * 8))); // musique plus courte
    await melangerParBlocs(join(dossier, "v.f32"), join(dossier, "m.f32"), join(dossier, "s.f32"), 12, 4800);
    const b = readFileSync(join(dossier, "s.f32"));
    const sortie = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    const gains = gainsEffacement(voix, 12);
    expect(sortie.length).toBe(n * 2);
    for (const i of [0, 29_999, 35_000, 60_000, 95_000, n - 5001, n - 1]) {
      const x = voix[i] * Math.SQRT1_2;
      const m = i < n - 5000 ? musique[2 * i] : 0;
      expect(sortie[2 * i]).toBeCloseTo(x + m * gains[i], 6);
    }
  });

  it("au-delà de 10 minutes : refus clair, avant tout téléchargement", async () => {
    expect(DUREE_MAX_SEC).toBe(600);
    const ctx = { dossier: mkdtempSync(join(dossier, "duree-")), signal: new AbortController().signal, progression: () => undefined };
    await expect(mixage({ idRendu: "d", operation: "mixage", file: "longue", entrees: { voix: "http://127.0.0.1:1/jamais-appelee.wav" }, sortie: { urlDepot: "", cle: "d" }, parametres: { dureeSec: 601 } }, ctx)).rejects.toThrow(/10 minutes au plus/);
  });
});
