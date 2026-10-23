/**
 * Mini-vidéos : ressources du serveur (18/10/2026). Le dossier temporaire d'un candidat (extrait, planche de contrôle, source) est supprimé
 * dès que le candidat est déposé puis contrôlé, refusé ou en erreur ; le téléchargement compte les octets REÇUS (flux) et s'arrête au plafond
 * même sans en-tête content-length. Doubles et dossiers temporaires seulement, aucun réseau réel.
 */
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adaptateurStudio } from "@/moteurs/montage-facecam-animee/images/adaptateur";
import type { CandidatImage } from "@/moteurs/montage-facecam-animee/images/choisir";
import { remplirFenetres, type MiniVideoPreparee } from "@/moteurs/montage-facecam-animee/images";
import { preparateurMiniVideo, type OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import { outilsPreparationServeur } from "@/moteurs/montage-facecam-animee/images/production";
import { lireVerdictMiniVideo } from "@/moteurs/montage-facecam-animee/images/verification";

const c: CandidatImage = { source: "pexels", id: "42", genre: "video", cle: "https://x.invalid/v.mp4", largeur: 1080, hauteur: 1920, dureeSec: 12, description: "homme qui tape" };

describe("préparation · dossier temporaire", () => {
  it("une préparation qui échoue supprime son dossier entier", async () => {
    const supprimes: string[] = [];
    const o: OutilsPreparation = {
      executer: async () => {
        throw new Error("ffprobe a échoué");
      },
      telecharger: async () => undefined,
      dossierTravail: async (n) => `/travail/${n}`,
      taille: async () => 1,
      deposer: async (_f, cle) => cle,
      supprimerDossier: async (d) => void supprimes.push(d),
    };
    await expect(preparateurMiniVideo(o)(c, { fenetre: 0, dureeFenetreSec: 2 })).rejects.toThrow(/ffprobe/);
    expect(supprimes).toEqual(["/travail/pexels-42"]);
  });

  it("le résultat porte son dossier (pour que l'appelant le libère après le contrôle)", async () => {
    // outils doublés minimalistes : l'échec ci-dessus prouve la suppression ; ici on vérifie seulement la forme via l'adaptateur
    const supprimes: string[] = [];
    const prep: OutilsPreparation = { executer: async () => new Uint8Array(), telecharger: async () => undefined, dossierTravail: async (n) => n, taille: async () => 1, deposer: async (_f, k) => k, supprimerDossier: async (d) => void supprimes.push(d) };
    const dep = adaptateurStudio({ preparation: prep });
    await dep.liberer!({ cle: "k", depuisSec: 0, mouvement: 1, dossier: "/travail/pexels-42" } as MiniVideoPreparee);
    expect(supprimes).toEqual(["/travail/pexels-42"]);
    await dep.liberer!({ cle: "k", depuisSec: 0, mouvement: 1 } as MiniVideoPreparee); // sans dossier : rien
    expect(supprimes).toHaveLength(1);
  });
});

describe("remplirFenetres · le dossier du candidat est libéré après le contrôle, accepté ou refusé", () => {
  const prep = (n: number): MiniVideoPreparee => ({ cle: `videos/f${n}.mp4`, depuisSec: 0, mouvement: 6, pixelsChanges: 0.1, pixelsChangesMedian: 0.1, partFigee: 0, coupes: 0, dureeSec: 3.5, image: "/tmp/p.jpg", dossier: `/travail/${n}` });
  const lancer = async (verdict: string) => {
    const liberes: string[] = [];
    let n = 0;
    await remplirFenetres(
      { fenetres: [{ debut: 4, fin: 6.5, media: "fenetre-1", recherche: "homme qui tape", video: true }] },
      {
        chercher: async (d) => (d.page === 1 && d.source === "pexels" ? [c] : []),
        stocker: async (x) => x.cle,
        preparerMiniVideo: async () => prep(++n),
        liberer: async (p) => void liberes.push(p.dossier ?? ""),
        verifierMiniVideo: async () => lireVerdictMiniVideo(JSON.stringify({ verdict, texte: false, logo: false, grosPlanVisage: false, raison: "r" })),
      },
    );
    return liberes;
  };
  it("candidat accepté : dossier libéré", async () => {
    expect(await lancer("littéral")).toEqual(["/travail/1"]);
  });
  it("candidat refusé : dossier libéré aussi", async () => {
    const l = await lancer("hors sujet");
    expect(l.length).toBeGreaterThan(0);
    expect(l[0]).toBe("/travail/1");
  });
});

describe("outils du serveur", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("supprimerDossier efface le dossier entier et son contenu", async () => {
    const racine = mkdtempSync(join(tmpdir(), "res-"));
    const o = outilsPreparationServeur({ deposer: async (_c, cle) => cle, racine });
    const d = await o.dossierTravail("pexels-1");
    writeFileSync(join(d, "extrait.mp4"), "x");
    writeFileSync(join(d, "controle.jpg"), "x");
    await o.supprimerDossier!(d);
    expect(existsSync(d)).toBe(false);
    expect(readdirSync(racine)).toEqual([]);
  });

  it("téléchargement : les octets REÇUS sont comptés, coupure au plafond même sans en-tête content-length, fichier partiel effacé", async () => {
    const racine = mkdtempSync(join(tmpdir(), "res-"));
    const flux = new ReadableStream<Uint8Array>({
      start(ctrl) {
        for (let k = 0; k < 10; k++) ctrl.enqueue(new Uint8Array(1000));
        ctrl.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(flux, { status: 200 }))); // aucun content-length
    const o = outilsPreparationServeur({ deposer: async (_c, cle) => cle, racine, telechargementMaxOctets: 4000 });
    const fichier = join(racine, "source.mp4");
    await expect(o.telecharger("https://x.invalid/v.mp4", fichier)).rejects.toThrow(/trop lourd/);
    expect(existsSync(fichier)).toBe(false);
  });

  it("téléchargement sous le plafond : le fichier est écrit en entier", async () => {
    const racine = mkdtempSync(join(tmpdir(), "res-"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(3000), { status: 200 })));
    const o = outilsPreparationServeur({ deposer: async (_c, cle) => cle, racine, telechargementMaxOctets: 4000 });
    const fichier = join(racine, "source.mp4");
    await o.telecharger("https://x.invalid/v.mp4", fichier);
    expect(existsSync(fichier)).toBe(true);
  });

  it("un programme absent échoue avec code ENOENT et syscall « spawn » (c'est ce que la chaîne reconnaît comme une panne d'outil)", async () => {
    const o = outilsPreparationServeur({ deposer: async () => "" });
    await expect(o.executer("programme-absent" as never, [])).rejects.toMatchObject({ code: "ENOENT", syscall: expect.stringMatching(/^spawn/) });
  });
});
