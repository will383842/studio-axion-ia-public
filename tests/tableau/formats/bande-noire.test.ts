/**
 * BANDE NOIRE AU BORD (défaut de l'essai réel du 11/10 : colonnes 1072 à 1079 noires, l'image utile faisant 1072 =
 * 67 × 16 px). Cause trouvée : la conversion `yuv420p → gbrp` du FFmpeg 8.1.1 de l'image `studio-rendu`, dans le
 * graphe d'EXPORT (`grapheExport`), laisse noires les colonnes au-delà du dernier multiple de 16.
 *
 *  - la mesure des bords (`studio-rendu/src/controle-bords.ts`) rougit sur une image fabriquée avec une bande et passe
 *    sur une image saine ;
 *  - le contrôle de la sortie (`controles-sortie.ts`) le dit en clair, avec les colonnes ;
 *  - l'export du tableau passe par la conversion sûre ; les autres formats gardent le graphe d'avant ;
 *  - avec FFmpeg (celui du poste, ou `FFMPEG=…`) : fichiers réels, et l'export du tableau n'a aucune bande.
 *    Rouge d'abord : avec `FFMPEG` = le 8.1.1 de l'image et SANS la conversion sûre, la bande de 8 colonnes revient.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerSortie } from "../../../src/moteurs/montage-tableau/controles-sortie";
import { argumentsExport, grapheExport } from "../../../studio-rendu/src/composition/ffmpeg";
import { bordsNoirs, mesurerBordsNoirs, mesuresBords } from "../../../studio-rendu/src/controle-bords";

/** Image grise W × H couleur de page (luminance 220), avec `bande` colonnes noires (16) à droite. */
function image(W: number, H: number, bande = 0): Uint8Array {
  const b = new Uint8Array(W * H).fill(220);
  for (let y = 0; y < H; y++) for (let x = W - bande; x < W; x++) b[y * W + x] = 16;
  return b;
}

describe("mesure des bords noirs (pure)", () => {
  it("rougit sur une image avec une bande de 8 px à droite", () => {
    expect(bordsNoirs(image(1080, 1920, 8), 1080, 1920)).toEqual({ gauche: 0, droite: 8, haut: 0, bas: 0 });
  });

  it("passe sur une image saine", () => {
    expect(bordsNoirs(image(1080, 1920), 1080, 1920)).toEqual({ gauche: 0, droite: 0, haut: 0, bas: 0 });
  });

  it("un décor sombre n'est pas une bande (un seul pixel plus clair suffit)", () => {
    const b = new Uint8Array(64 * 32).fill(20);
    for (let x = 0; x < 64; x++) b[16 * 64 + x] = 90;
    expect(bordsNoirs(b, 64, 32)).toEqual({ gauche: 0, droite: 0, haut: 16, bas: 15 });
  });
});

describe("contrôle du fichier d'une sortie", () => {
  it("bande de 8 px : non conforme, colonnes nommées", () => {
    const c = controlerSortie("vertical", { largeur: 1080, hauteur: 1920, ...mesuresBords({ gauche: 0, droite: 8, haut: 0, bas: 0 }) });
    expect(c.etat).toBe("non-conforme");
    expect(c.phrases).toEqual(["Bande noire de 8 colonnes au bord droit (colonnes 1072 à 1079)."]);
  });

  it("image saine aux dimensions exactes : conforme", () => {
    for (const [id, l, h] of [["vertical", 1080, 1920], ["portrait", 1080, 1350], ["carre", 1080, 1080], ["horizontal", 1920, 1080]] as const)
      expect(controlerSortie(id, { largeur: l, hauteur: h, ...mesuresBords({ gauche: 0, droite: 0, haut: 0, bas: 0 }) })).toEqual({ format: id, etat: "conforme", phrases: [] });
  });

  it("dimensions fausses : non conforme ; mesures absentes : non mesuré, jamais conforme", () => {
    expect(controlerSortie("carre", { largeur: 1072, hauteur: 1080, ...mesuresBords({ gauche: 0, droite: 0, haut: 0, bas: 0 }) }).phrases).toEqual(["Dimensions 1072 × 1080 au lieu de 1080 × 1080 (Carré 1:1)."]);
    expect(controlerSortie("vertical", {}).etat).toBe("non-mesure");
    expect(controlerSortie("vertical", { largeur: 1080, hauteur: 1920, bordNoirErreur: 1 }).etat).toBe("non-mesure");
  });
});

describe("export : conversion RVB sûre", () => {
  it("demandée : le master passe par gbrap ; absente : graphe d'avant, inchangé", () => {
    expect(grapheExport(false, { master: "[0:v]", texte: "[1:v]", sortie: "[v]", conversionRvbSure: true })).toContain("scale=in_color_matrix=bt709:in_range=tv,format=gbrap,format=gbrp[m]");
    expect(grapheExport(false)).toContain("scale=in_color_matrix=bt709:in_range=tv,format=gbrp[m]");
    expect(grapheExport(false)).not.toContain("gbrap,format=gbrp");
  });
});

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const version = /ffmpeg version (\S+)/.exec(spawnSync(FFMPEG, ["-hide_banner", "-version"], { encoding: "utf8" }).stdout ?? "")?.[1] ?? null;
if (!version) console.warn(`[bande-noire] FFmpeg introuvable (${FFMPEG}) : fichiers réels NON testés.`);

describe.skipIf(!version)(`fichiers réels (FFmpeg ${version ?? "absent"})`, () => {
  const dossier = mkdtempSync(join(tmpdir(), "bande-noire-"));
  const ff = (...args: string[]) => {
    const r = spawnSync(FFMPEG, ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier, encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const video = (nom: string, filtre: string, W = 1080, H = 1920) => {
    ff("-f", "lavfi", "-i", `color=c=0xE9DCC8:s=${W}x${H}:r=25:d=1${filtre}`, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", nom);
    return join(dossier, nom);
  };

  it("vidéo avec une bande de 8 px : mesurée ; vidéo saine : rien", async () => {
    const mesure = (fichier: string, W = 1080, H = 1920) => mesurerBordsNoirs({ ffmpeg: FFMPEG, fichier, largeur: W, hauteur: H, dureeSec: 1 });
    expect(await mesure(video("bande.mp4", ",crop=1072:1920:0:0,pad=1080:1920:0:0:black"))).toEqual({ gauche: 0, droite: 8, haut: 0, bas: 0 });
    expect(await mesure(video("saine.mp4", ""))).toEqual({ gauche: 0, droite: 0, haut: 0, bas: 0 });
    expect(await mesure(video("saine-16x9.mp4", "", 1920, 1080), 1920, 1080)).toEqual({ gauche: 0, droite: 0, haut: 0, bas: 0 });
  }, 60_000);

  it("export du tableau (conversion sûre) d'un master 1080 px : aucune bande, dans chaque format", async () => {
    for (const [W, H] of [[1080, 1920], [1080, 1350], [1080, 1080], [1920, 1080]]) {
      ff("-f", "lavfi", "-i", `color=c=0xE9DCC8:s=${W}x${H}:r=25:d=1`, "-f", "lavfi", "-i", "sine=d=1", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-c:a", "pcm_s24le", "-shortest", "master.mov");
      ff("-f", "lavfi", "-i", `color=c=black@0:s=${W}x${H},format=rgba`, "-frames:v", "1", "t-000000.png");
      writeFileSync(join(dossier, "liste.txt"), "ffconcat version 1.0\nfile t-000000.png\nduration 1\nfile t-000000.png\n");
      const e = { fps: 25, mode: "crf" as const, crf: 17, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000, conversionRvbSure: true };
      ff(...argumentsExport("master.mov", "liste.txt", e, "passe", "sortie.mp4").passe2.slice(2));
      expect(await mesurerBordsNoirs({ ffmpeg: FFMPEG, fichier: join(dossier, "sortie.mp4"), largeur: W, hauteur: H, dureeSec: 1 }), `${W} × ${H}`).toEqual({ gauche: 0, droite: 0, haut: 0, bas: 0 });
    }
  }, 120_000);
});
