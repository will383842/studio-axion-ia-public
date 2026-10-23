/**
 * `studio-rendu` après l'incident du 12/10 : toute erreur d'un rendu écrit `echec` avec un motif lisible ; durée maximale
 * proportionnée à la longueur ; un rejet non géré ne laisse jamais un rendu « en cours » ; après un redémarrage, un
 * identifiant inconnu répond « inconnu » (404). Sans Docker, sans Remotion.
 */
import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErreurRendu, type DemandeRendu, type Operation } from "../../studio-rendu/src/contrat";
import { delaiRendu, dureeDemandeeSec, FilesRendu, motifEchec, surveillerRejets } from "../../studio-rendu/src/files";
import { creerServeur } from "../../studio-rendu/src/serveur";

const MIN = 60_000;
const dossierFactice = async () => "inexistant";
const scene = (id: string, debutMs: number, finMs: number): DemandeRendu => ({ idRendu: id, operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: "https://r2/depot", cle: `scenes/${id}.mp4` }, parametres: { composition: "TableauScene", proprietes: { scene: { id, debutMs, finMs } }, crf: 12 } });
const montage = (id: string, dureeSec: number): DemandeRendu => ({ idRendu: id, operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: "https://r2/depot", cle: `videos/${id}.mp4` }, parametres: { mode: "complet", dureeSec } });
const tour = () => new Promise((r) => setTimeout(r, 30));

afterEach(() => vi.useRealTimers());

describe("motif lisible de chaque erreur", () => {
  it("erreur Remotion simulée (navigateur fermé) : échec réessayable, motif lisible", async () => {
    const op: Operation = async () => {
      throw new Error("Protocol error (Page.bringToFront): Target closed. https://www.remotion.dev/docs/target-closed");
    };
    const files = new FilesRendu({ operations: { composition: op }, creerDossier: dossierFactice });
    files.soumettre(scene("s1", 0, 5_000));
    await files.inactif();
    expect(files.etat("s1")).toEqual({ statut: "echec", erreur: { code: "indisponible", reessayable: true, message: expect.stringMatching(/^Le navigateur du rendu s'est fermé pendant le dessin \(Protocol error.*Target closed/) } });
  });

  it("FFmpeg (erreur typée), message vide, valeur non-Error", () => {
    expect(motifEchec(new ErreurRendu({ code: "inconnu", reessayable: true, message: "FFmpeg a échoué (code 1)." }))).toEqual({ code: "inconnu", reessayable: true, message: "FFmpeg a échoué (code 1)." });
    expect(motifEchec(new Error(""))).toMatchObject({ reessayable: true, message: "Le rendu a échoué sans message." });
    expect(motifEchec("panne")).toMatchObject({ code: "inconnu", message: "panne" });
  });
});

describe("durée maximale proportionnée", () => {
  const o = { delaiCourteMs: 45_000, delaiLongueMs: 20 * MIN };
  it("scène de 5 s : 11 min 40 ; montage de 2 min : plafond d'avant (20 min) ; durée inconnue : plafond ; file courte inchangée", () => {
    expect(dureeDemandeeSec(scene("a", 1_000, 6_000))).toBe(5);
    expect(delaiRendu(scene("a", 1_000, 6_000), o)).toBe(11 * MIN + 40_000);
    expect(delaiRendu(montage("m", 30), o)).toBe(20 * MIN);
    expect(delaiRendu(montage("m", 120), o)).toBe(20 * MIN);
    expect(delaiRendu({ ...montage("m", 0), parametres: {} }, o)).toBe(20 * MIN);
    expect(delaiRendu({ ...montage("c", 3), file: "courte" }, o)).toBe(45_000);
  });

  it("une scène dont le rendu ne rend jamais la main passe en échec à son délai (pas 20 min)", async () => {
    vi.useFakeTimers();
    const op: Operation = () => new Promise(() => undefined);
    const files = new FilesRendu({ operations: { composition: op }, creerDossier: dossierFactice });
    files.soumettre(scene("s2", 0, 5_000));
    await vi.advanceTimersByTimeAsync(11 * MIN + 39_000);
    expect(files.etat("s2")?.statut).toBe("en_cours");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(files.etat("s2")).toEqual({ statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Délai de 700 s dépassé." } });
  });
});

describe("rejet non géré", () => {
  it("les rendus en cours passent en échec ; leur fin tardive n'écrase rien ; la file repart", async () => {
    const relacher: (() => void)[] = [];
    const op: Operation = () => new Promise((ok) => relacher.push(() => ok({})));
    const files = new FilesRendu({ operations: { composition: op }, creerDossier: dossierFactice });
    const processus = new EventEmitter();
    const lignes: string[] = [];
    const retirer = surveillerRejets(files, processus as never, (l) => lignes.push(l));
    files.soumettre(scene("s3", 0, 5_000));
    files.soumettre(scene("s4", 0, 5_000));
    await tour();
    expect(files.etat("s3")?.statut).toBe("en_cours");
    processus.emit("unhandledRejection", new Error("Target closed"), Promise.resolve());
    expect(files.etat("s3")).toEqual({ statut: "echec", erreur: { code: "inconnu", reessayable: true, message: "Erreur non attrapée pendant le rendu : Target closed" } });
    expect(lignes[0]).toMatch(/s3 en échec/);
    relacher[0]();
    await tour();
    expect(files.etat("s3")?.statut).toBe("echec");
    expect(files.etat("s4")?.statut).toBe("en_cours");
    relacher[1]();
    await files.inactif();
    expect(files.etat("s4")?.statut).toBe("termine");
    retirer();
    expect(processus.listenerCount("unhandledRejection")).toBe(0);
  });
});

describe("après un redémarrage", () => {
  it("un identifiant inconnu répond « inconnu » (404), pas un état périmé", async () => {
    const avant = new FilesRendu({ operations: { composition: async () => ({}) }, creerDossier: dossierFactice });
    avant.soumettre(scene("s5", 0, 5_000));
    await avant.inactif();
    expect(avant.etat("s5")?.statut).toBe("termine");
    const apres = new FilesRendu({ operations: { composition: async () => ({}) }, creerDossier: dossierFactice });
    const serveur = creerServeur(apres);
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    try {
      const r = await fetch(`http://127.0.0.1:${(serveur.address() as AddressInfo).port}/rendus/s5`);
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ statut: "inconnu" });
    } finally {
      serveur.close();
    }
  });

  it("un échec est journalisé avec l'identifiant du rendu, jamais l'adresse de dépôt", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const op: Operation = async () => {
      throw new Error("https://r2.exemple/cle?X-Amz-Signature=abc: Server returned 403");
    };
    const files = new FilesRendu({ operations: { composition: op }, creerDossier: dossierFactice });
    files.soumettre(scene("s-journal", 0, 5_000));
    await files.inactif();
    const sortie = erreurs.mock.calls.map((a) => a.join(" ")).join("\n");
    erreurs.mockRestore();
    expect(sortie).toContain("s-journal");
    expect(sortie).toContain("Server returned 403");
    expect(sortie).not.toContain("https://");
    expect(sortie).not.toContain("X-Amz-Signature");
    expect(sortie).not.toContain("https://r2/depot");
  });
});
