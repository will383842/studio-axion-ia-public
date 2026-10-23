/**
 * LOTS R4-R5 — corrections de la relecture (03/10). Chaque défaut de comportement a son test, ROUGE sur 0ed687ae
 * (avant les corrections) puis vert :
 *   - téléchargement de studio-rendu plafonné (en-tête ET compteur du flux) ; LUT de plus de 50 Mo refusée ;
 *   - mixage : refus si la cible n'est pas atteinte, durée bornée, musique qui s'efface vraiment sous la voix ;
 *   - miniature : lecture limitée aux protocoles du réseau (jamais un fichier local), erreurs sans adresse signée ;
 *   - apostrophe typographique sur l'image ; couleurs d'Axion identiques aux jetons du studio.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contraintesTitre, COULEURS_MINIATURE, formatMiniature, hauteurBlocTitre, mettreEnPageTitre, placementTitre, TRAIT_BAS_PX, unitesCouverture, type RatioMiniature } from "../studio-rendu/compositions/commune/miniature-mise-en-page";
import { etalonnage } from "../studio-rendu/src/operations/etalonnage";
import * as operationMiniature from "../studio-rendu/src/operations/miniature";
import { mixage } from "../studio-rendu/src/operations/mixage";
import { telecharger } from "../studio-rendu/src/outils";
import { CARACTERES_MAX_CUBE, lireCube } from "@/lib/lut3d";
import { validerCube } from "@/lib/qc-lut";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("R4-R5 relecture · règles pures", () => {
  it("apostrophe typographique ’ sur l'image", () => {
    expect(unitesCouverture("Amende : l'erreur")).toEqual(["AMENDE :", "L’ERREUR"]);
  });
  it("« bas » : la place du trait SOUS le titre est réservée dans la zone du titre, quel que soit le format", () => {
    const mesure = (t: string, taille: number) => t.length * taille * 0.62;
    for (const r of ["9:16", "16:9", "4:5", "1:1"] as RatioMiniature[])
      for (const t of ["Amende : l'erreur", "Un PV de 135 € ?", "Rupture conventionnelle : vos droits"]) {
        const f = formatMiniature(r);
        const c = contraintesTitre(f, "bas");
        const m = mettreEnPageTitre(unitesCouverture(t), mesure, c);
        const hauteur = hauteurBlocTitre(m.lignes.length, m.taillePx, c);
        const { haut } = placementTitre(f, "bas", hauteur);
        expect(haut + hauteur + TRAIT_BAS_PX * (f.largeur / 1080), `${r} / ${t}`).toBeLessThanOrEqual(f.zoneTitre.y + f.zoneTitre.hauteur + 0.5);
      }
  });
  it("couleurs de la miniature = jetons du studio (`src/app/globals.css`)", () => {
    const css = readFileSync(join("src", "app", "globals.css"), "utf8");
    const jeton = (nom: string) => new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1]?.toUpperCase();
    expect(COULEURS_MINIATURE.fond).toBe(jeton("fond"));
    expect(COULEURS_MINIATURE.creme).toBe(jeton("texte"));
    expect(COULEURS_MINIATURE.orangeVif).toBe(jeton("orange-vif"));
    expect(COULEURS_MINIATURE.orange).toBe(jeton("orange"));
    expect(COULEURS_MINIATURE.surOrange).toBe(jeton("sur-orange"));
  });
  it("lecture d'une vidéo : seulement les protocoles du réseau (jamais un fichier local), format mov / mp4 imposé", () => {
    const { argumentsLecture } = operationMiniature as unknown as { argumentsLecture: (u: string) => string[] };
    expect(argumentsLecture("https://r2.exemple/v.mov?X-Amz-Signature=s")).toEqual(["-protocol_whitelist", "https,tls,tcp", "-f", "mov"]);
    expect(argumentsLecture("http://127.0.0.1:9/v.mp4")).toEqual(["-protocol_whitelist", "http,tcp", "-f", "mov"]);
  });
});

describe("R4-R5 relecture · fichier de couleur importé (.cube) lu sous bornes", () => {
  const entete = (n: number) => `LUT_3D_SIZE ${n}\n`;
  const lignes = (n: number, ligne = "0.5 0.5 0.5") => Array.from({ length: n }, () => ligne).join("\n");

  it("taille de grille bornée à 65 (66 ou 256 refusées AVANT toute réservation), annoncée une seule fois et avant les couleurs", () => {
    expect(lireCube(entete(65) + lignes(65 ** 3)).taille).toBe(65);
    expect(() => lireCube(entete(66) + lignes(66 ** 3))).toThrow(/65 points par côté au plus/);
    expect(() => lireCube(entete(256))).toThrow(/65 points par côté au plus/);
    expect(() => lireCube(entete(2) + entete(2) + lignes(8))).toThrow(/une seule fois/);
    expect(() => lireCube("0 0 0\n" + entete(2) + lignes(7))).toThrow(/avant ses couleurs/);
  });

  it("nombre de lignes cohérent : la lecture s'arrête à la première couleur en trop", () => {
    expect(() => lireCube(entete(2) + lignes(9))).toThrow(/annonce 8 couleurs mais en contient davantage/);
    expect(() => lireCube(entete(2) + lignes(7))).toThrow(/annonce 8 couleurs mais en contient 7/);
  });

  it("valeurs : nombres décimaux ordinaires, exactement 3 par ligne, entre −4 et 4 ; bornes lisibles et dans l'ordre", () => {
    for (const mauvaise of ["0x1 0 0", "Infinity 0 0", "1e400 0 0", "5 0 0", "-5 0 0", "0 0", "0 0 0 0", "0,5 0 0", "1e5 0 0"]) {
      expect(() => lireCube(entete(2) + lignes(7) + "\n" + mauvaise), mauvaise).toThrow(/illisible|annonce 8 couleurs mais en contient 7/); // « Infinity » ressemble à un mot d’en-tête : ignoré, la couleur manque → refus quand même
    }
    expect(lireCube(entete(2) + lignes(7) + "\n-0.01 1.02 .5").donnees[23]).toBeCloseTo(0.5, 6);
    expect(() => lireCube("DOMAIN_MIN 0 0 x\n" + entete(2) + lignes(8))).toThrow(/bornes .* illisibles/);
    expect(() => lireCube("DOMAIN_MIN 1 0 0\nDOMAIN_MAX 0 1 1\n" + entete(2) + lignes(8))).toThrow(/inversées/);
  });

  it("au-delà de 50 Mo de texte : refus immédiat", () => {
    expect(() => lireCube(" ".repeat(CARACTERES_MAX_CUBE + 1))).toThrow(/50 Mo/);
  });

  it("chaque refus est une phrase simple, sans nom technique (ni « LUT », ni « cube »)", () => {
    for (const texte of [entete(66), "LUT_1D_SIZE 16\n0 0 0", entete(2) + lignes(9), entete(2) + "0x1 0 0", "bonjour", entete(5) + lignes(125)]) {
      const v = validerCube(texte);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.erreur).not.toMatch(/LUT|cube|³/i);
    }
  });
});

describe.skipIf(!ffmpegPresent)("R4-R5 relecture · studio-rendu", { timeout: 120_000 }, () => {
  let serveur: Server;
  let base = "";
  const dossier = mkdtempSync(join(tmpdir(), "r45-relecture-"));
  const gros = Buffer.alloc(51 * 1024 * 1024, 0x30);
  const sources: Record<string, string> = {};

  beforeAll(async () => {
    sources["/image.png"] = join(dossier, "image.png");
    spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=size=64x36", "-frames:v", "1", sources["/image.png"]]);
    // Voix d'essai : silence 0-3 s, puis une « voix » (1 kHz modulé) de 3 à 7 s ; musique : 220 Hz continue.
    sources["/voix.wav"] = join(dossier, "voix.wav");
    spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=f=1000:d=4,volume=0.4,tremolo=f=4:d=0.6", "-af", "adelay=3000,apad=whole_dur=7.5", "-ar", "48000", "-ac", "1", sources["/voix.wav"]]);
    // « Voix » de bruit blanc : sa crête est trop haute pour tenir −9 LUFS sous −6 dBTP (cible impossible).
    sources["/bruit.wav"] = join(dossier, "bruit.wav");
    spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "anoisesrc=d=6:c=white:a=0.3", "-ar", "48000", "-ac", "1", sources["/bruit.wav"]]);
    sources["/musique.wav"] = join(dossier, "musique.wav");
    spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=f=220:d=8,volume=0.5", "-ar", "48000", "-ac", "2", sources["/musique.wav"]]);
    serveur = createServer((req, res) => {
      const url = (req.url ?? "").split("?")[0];
      if (url === "/gros-annonce") {
        res.writeHead(200, { "content-length": gros.length });
        res.end(gros);
        return;
      }
      if (url === "/gros-sans-longueur") {
        // Envoi par morceaux, sans longueur annoncée : seul le compteur du flux peut l'arrêter.
        res.writeHead(200, { "transfer-encoding": "chunked" });
        for (let i = 0; i < 51; i++) res.write(gros.subarray(i * 1024 * 1024, (i + 1) * 1024 * 1024));
        res.end();
        return;
      }
      const chemin = sources[url];
      if (!chemin) return void res.writeHead(404).end();
      res.writeHead(200);
      res.end(readFileSync(chemin));
    });
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    serveur.close();
    rmSync(dossier, { recursive: true, force: true });
  });
  const contexte = (nom: string) => {
    const d = join(dossier, nom);
    mkdirSync(d, { recursive: true });
    return { progression: () => undefined, dossier: d, signal: new AbortController().signal };
  };

  it("téléchargement plafonné : longueur annoncée trop grande, puis flux sans longueur trop long → refus clair", async () => {
    await expect(telecharger(`${base}/gros-annonce`, join(dossier, "a"), undefined, 10 * 1024 * 1024)).rejects.toThrow(/volumineuse/);
    await expect(telecharger(`${base}/gros-sans-longueur`, join(dossier, "b"), undefined, 10 * 1024 * 1024)).rejects.toThrow(/volumineuse/);
  });

  it("étalonnage : une LUT de plus de 50 Mo est refusée au téléchargement", async () => {
    await expect(
      etalonnage({ idRendu: "g", operation: "etalonnage", file: "courte", entrees: { image: `${base}/image.png`, lut: `${base}/gros-sans-longueur` }, sortie: { urlDepot: "", cle: "g" }, parametres: {} }, contexte("gros")),
    ).rejects.toThrow(/volumineuse/);
  });

  it("mixage : une durée absurde est refusée clairement", async () => {
    await expect(mixage({ idRendu: "d", operation: "mixage", file: "longue", entrees: { voix: `${base}/voix.wav` }, sortie: { urlDepot: "", cle: "d" }, parametres: { dureeSec: 1e9 } }, contexte("duree"))).rejects.toThrow(/durée/i);
  });

  it("mixage : cible impossible (−9 LUFS sous −6 dBTP) → refus, jamais un son livré hors cible", async () => {
    await expect(
      mixage({ idRendu: "c", operation: "mixage", file: "longue", entrees: { voix: `${base}/bruit.wav` }, sortie: { urlDepot: "", cle: "c" }, parametres: { lufs: -9, creteVraieMaxDbtp: -6 } }, contexte("cible")),
    ).rejects.toThrow(/niveau/i);
  });

  it("mixage : la musique s'efface sous la voix (au moins 6 dB de moins quand la voix parle)", async () => {
    const ctx = contexte("efface");
    await mixage({ idRendu: "m", operation: "mixage", file: "longue", entrees: { voix: `${base}/voix.wav`, musique: `${base}/musique.wav` }, sortie: { urlDepot: "", cle: "m" }, parametres: { baisseSousVoixDb: 12 } }, ctx);
    // Niveau de la seule musique (bande étroite autour de 220 Hz, filtre passé 3 fois : la voix à 1 kHz n'y fuit pas) sans voix (0,5-2,5 s) puis sous la voix (4-6,5 s).
    const niveau = (de: number, a: number) => {
      const s = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(de), "-to", String(a), "-i", join(ctx.dossier, "son-mixe.wav"), "-af", [1, 2, 3].map(() => "bandpass=f=220:width_type=q:w=8").join(",") + ",astats=metadata=0", "-f", "null", "-"]).stderr.toString();
      return Number(/Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+)/.exec(s)?.[1]);
    };
    const seule = niveau(0.5, 2.5);
    const sousVoix = niveau(4, 6.5);
    expect(Number.isFinite(seule) && Number.isFinite(sousVoix)).toBe(true);
    expect(seule - sousVoix).toBeGreaterThanOrEqual(6);
  });

  it("miniature : une erreur de lecture ne répète jamais l'adresse signée", async () => {
    const op = operationMiniature.creerOperationMiniature(async () => undefined);
    const e = await op(
      { idRendu: "s", operation: "miniature", file: "courte", entrees: { video: `${base}/absent.mp4?X-Amz-Signature=SECRET123` }, sortie: { urlDepot: "", cle: "s" }, parametres: { instantSec: 1, ratio: "9:16", couverture: "Titre" } },
      contexte("secret"),
    ).catch((x: Error) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).not.toContain("SECRET123");
  });
});
