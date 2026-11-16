/**
 * C4-U4.3 · extraits maison de la v4 : préparer l'extrait en clip 4:5 muet. Outils factices (aucun réseau, aucun ffmpeg).
 */
import { describe, expect, it } from "vitest";
import { OCTETS_MAX_EXTRAIT, type OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import { argumentsExtraitMaisonV4, preparerExtraitV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/preparer";

const URL = "https://exemple.test/signe/extrait.mp4?sig=abc";
const EXTRAIT = { debutSec: 10, finSec: 20 };
const CIBLE = { cle: "extraits/v4-1.mp4", dureeFenetreSec: 3 };

function fabrique(opts: { tailles?: number[]; ffmpegEchoue?: Error; verrou?: boolean } = {}) {
  const j = { ffmpeg: [] as string[][], telecharger: [] as string[][], deposer: [] as string[][], suppr: 0, verrou: 0 };
  const tailles = [...(opts.tailles ?? [1000])];
  const o: OutilsPreparation = {
    async executer(_p, args) { if (opts.ffmpegEchoue) throw opts.ffmpegEchoue; j.ffmpeg.push(args); return new Uint8Array(); },
    async telecharger(u, f) { j.telecharger.push([u, f]); },
    async dossierTravail(n) { return `/tmp/${n}`; },
    async taille() { return tailles.length > 1 ? tailles.shift()! : tailles[0]; },
    async deposer(f, c) { j.deposer.push([f, c]); return c; },
    async supprimerDossier() { j.suppr++; },
    ...(opts.verrou ? { async sousVerrou<T>(f: () => Promise<T>) { j.verrou++; return f(); } } : {}),
  };
  return { o, j };
}

describe("C4-U4.3 · préparer l'extrait maison v4", () => {
  it("arguments : muet, 4:5, 1080×1350, -t attendu, -ss avant -i", async () => {
    const { o, j } = fabrique();
    await preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse: URL, mode: "direct" });
    const a = j.ffmpeg[0];
    expect(a).toContain("-an");
    expect(a.join(" ")).toContain("crop='min(iw,ih*4/5)':'min(ih,iw*5/4)'");
    expect(a.join(" ")).toContain("scale=1080:1350");
    expect(a[a.indexOf("-t") + 1]).toBe((3.5).toFixed(2));
    expect(a[a.indexOf("-ss") + 1]).toBe("10.00");
    expect(a.indexOf("-ss")).toBeLessThan(a.indexOf("-i"));
    expect(argumentsExtraitMaisonV4("a", "b", 1, 3, 21)).toContain("-an");
  });
  it("direct : l'adresse signée va en -i, aucun téléchargement", async () => {
    const { o, j } = fabrique({ verrou: true });
    await preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse: URL, mode: "direct" });
    expect(j.ffmpeg[0][j.ffmpeg[0].indexOf("-i") + 1]).toBe(URL);
    expect(j.telecharger).toHaveLength(0);
    expect(j.verrou).toBe(1);
  });
  it("direct : http:// ou vide refusé sans ffmpeg", async () => {
    for (const adresse of ["http://x.test/a.mp4", ""]) {
      const { o, j } = fabrique();
      await expect(preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse, mode: "direct" })).rejects.toThrow();
      expect(j.ffmpeg).toHaveLength(0);
    }
  });
  it("telecharger : un téléchargement, -i sur le fichier local", async () => {
    const { o, j } = fabrique();
    await preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse: URL, mode: "telecharger" });
    expect(j.telecharger).toHaveLength(1);
    expect(j.telecharger[0][0]).toBe(URL);
    expect(j.ffmpeg[0][j.ffmpeg[0].indexOf("-i") + 1]).toBe(j.telecharger[0][1]);
  });
  it("clé déposée = clé demandée ; nettoyage en succès", async () => {
    const { o, j } = fabrique();
    const r = await preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse: URL, mode: "direct" });
    expect(r.cle).toBe(CIBLE.cle);
    expect(j.deposer[0][1]).toBe(CIBLE.cle);
    expect(j.suppr).toBe(1);
  });
  it("trop gros : CRF relevé jusqu'à 33 puis échec, rien déposé, nettoyage", async () => {
    const { o, j } = fabrique({ tailles: [OCTETS_MAX_EXTRAIT + 1] });
    await expect(preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse: URL, mode: "direct" })).rejects.toThrow();
    expect(j.ffmpeg.map((a) => a[a.indexOf("-crf") + 1])).toEqual(["21", "25", "29", "33"]);
    expect(j.deposer).toHaveLength(0);
    expect(j.suppr).toBe(1);
  });
  it("ENOENT relancée avec son code, nettoyage", async () => {
    const e = Object.assign(new Error("spawn ffmpeg ENOENT"), { code: "ENOENT" });
    const { o, j } = fabrique({ ffmpegEchoue: e });
    await expect(preparerExtraitV4(EXTRAIT, CIBLE, o, { adresse: URL, mode: "direct" })).rejects.toMatchObject({ code: "ENOENT" });
    expect(j.suppr).toBe(1);
  });
  it("plage trop courte : refus sans ffmpeg", async () => {
    const { o, j } = fabrique();
    await expect(preparerExtraitV4({ debutSec: 10, finSec: 10.2 }, { ...CIBLE, dureeFenetreSec: 4 }, o, { adresse: URL, mode: "direct" })).rejects.toThrow();
    expect(j.ffmpeg).toHaveLength(0);
  });
});
