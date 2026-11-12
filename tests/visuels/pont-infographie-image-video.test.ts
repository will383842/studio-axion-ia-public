/**
 * L7-34 · pont infographie → « Image → vidéo » : un clic crée la vidéo à partir de l'infographie DÉJÀ rendue, sans nouveau rendu ;
 * deux clics en même temps = un seul dépôt. Éteint (interrupteur « infographies ») : rien ne part. Dépôt et rendu simulés, aucun prix.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const espion = vi.hoisted(() => ({ deposer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/mode-budget", () => ({ avecAccordAutomatique: async (appel: (a?: number) => Promise<unknown>, accord?: number) => appel(accord) }));
vi.mock("@/services/image-video-ecran", async (importer) => ({ ...(await importer<typeof import("@/services/image-video-ecran")>()), deposerImageVideo: espion.deposer }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { creerPontImageVideo, fichierImageVideo } = await import("@/visuels/services/infographies");
const { creerVideoDepuisInfographieAction } = await import("@/app/(studio)/image-video/actions");
const { formatImageVideo } = await import("@/formats/image-video");

const rendu = { reseau: "linkedin" as const, ratio: "1:1" as const, empreinte: "ab".repeat(32), cle: "studio/dev/visuels/abab/infographie-linkedin.jpg" };

beforeEach(() => {
  reinitialiserDepots();
  espion.deposer.mockReset();
  espion.deposer.mockResolvedValue({ statut: "lancee", videoId: "v1" });
});

describe("L7-34 · le fichier d'entrée vient de l'infographie rendue", () => {
  it("clé, image JPEG et dimensions du ratio : rien n'est rendu de nouveau", () => {
    const f = fichierImageVideo(rendu);
    expect(f.cleStockage).toBe(rendu.cle);
    expect(f.mime).toBe("image/jpeg");
    expect({ l: f.largeur, h: f.hauteur }).toEqual({ l: 1080, h: 1080 });
    expect(fichierImageVideo({ ...rendu, ratio: "9:16" }).hauteur).toBe(1920);
  });
  it("le format reste masqué et annonce la source infographie", () => {
    expect(formatImageVideo.statut).toBe("masque");
    expect(formatImageVideo.aFournir.join(" ")).toMatch(/infographie/i);
  });
});

describe("L7-34 · pont (un clic, sans double rendu)", () => {
  it("un clic = un dépôt avec la clé de l'infographie, sans soumission de rendu", async () => {
    const soumettre = vi.fn();
    const deposer = vi.fn(async () => ({ statut: "lancee" as const, videoId: "v1" }));
    const pont = creerPontImageVideo(deposer);
    const r = await pont(rendu, { reseaux: ["linkedin"] });
    expect(r).toEqual({ statut: "lancee", videoId: "v1" });
    expect(deposer).toHaveBeenCalledTimes(1);
    expect(soumettre).not.toHaveBeenCalled();
    const [demande, fichier] = deposer.mock.calls[0] as unknown as [{ fichierId: string; reseaux: string[]; largeur: number; hauteur: number }, { cleStockage: string }];
    expect(fichier.cleStockage).toBe(rendu.cle);
    expect(demande.fichierId).toBe(fichierImageVideo(rendu).id);
    expect(demande.reseaux).toEqual(["linkedin"]);
    expect({ l: demande.largeur, h: demande.hauteur }).toEqual({ l: 1080, h: 1080 });
  });
  it("deux clics en même temps sur la même infographie : un seul dépôt, même issue", async () => {
    let fin!: () => void;
    const attente = new Promise<void>((r) => (fin = r));
    const deposer = vi.fn(async () => {
      await attente;
      return { statut: "lancee" as const, videoId: "v1" };
    });
    const pont = creerPontImageVideo(deposer);
    const a = pont(rendu, { reseaux: ["linkedin"] });
    const b = pont(rendu, { reseaux: ["linkedin"] });
    fin();
    expect(await a).toEqual(await b);
    expect(deposer).toHaveBeenCalledTimes(1);
  });
  it("après un refus, un nouveau clic est possible", async () => {
    const deposer = vi.fn().mockResolvedValueOnce({ statut: "refusee", phrase: "non" }).mockResolvedValueOnce({ statut: "lancee", videoId: "v2" });
    const pont = creerPontImageVideo(deposer);
    expect((await pont(rendu, { reseaux: ["linkedin"] })).statut).toBe("refusee");
    expect((await pont(rendu, { reseaux: ["linkedin"] })).statut).toBe("lancee");
    expect(deposer).toHaveBeenCalledTimes(2);
  });
});

describe("L7-34 · action serveur", () => {
  it("éteint par défaut : GENERATEUR_ETEINT, aucun dépôt", async () => {
    const r = await creerVideoDepuisInfographieAction(rendu, { reseaux: ["linkedin"] });
    expect(r).toMatchObject({ ok: false, code: "GENERATEUR_ETEINT" });
    expect(espion.deposer).not.toHaveBeenCalled();
  });
  it("allumé : le dépôt reçoit l'infographie comme fichier d'entrée (accord confirmé inchangé)", async () => {
    await ecrireParametre("infographies.actif", true);
    const r = await creerVideoDepuisInfographieAction(rendu, { reseaux: ["linkedin"], accordCentimes: 123 });
    expect(r).toEqual({ ok: true, donnees: { statut: "lancee", videoId: "v1" } });
    expect(espion.deposer).toHaveBeenCalledTimes(1);
    const [demande, dep] = espion.deposer.mock.calls[0];
    expect(demande.accordCentimes).toBe(123);
    expect((await dep.fichier()).cleStockage).toBe(rendu.cle);
  });
  it("une infographie sans clé est refusée avant tout dépôt", async () => {
    await ecrireParametre("infographies.actif", true);
    const r = await creerVideoDepuisInfographieAction({ ...rendu, cle: "" }, { reseaux: ["linkedin"] });
    expect(r.ok).toBe(false);
    expect(espion.deposer).not.toHaveBeenCalled();
  });
});
