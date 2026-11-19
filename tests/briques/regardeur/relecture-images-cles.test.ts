import { describe, expect, it, vi } from "vitest";
import type { ImageLue, InstantRegard, VerdictRegard } from "../../../src/briques/regardeur";
import { IMAGES_CLES_MAX, relecteurImagesCles, versRelectureImagesCles } from "../../../src/briques/regardeur/relecture-images-cles";
import { IMAGES_CLES_RELUES, controlerVideoTableau, type OutilsControleTableau } from "../../../src/moteurs/montage-tableau/controles";
import { contexteExemple, copie, ficheErreurCorrigee } from "../../tableau/regles/exemples";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";

const MESURES_BONNES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 90 };
const inst = (n: number, over: Partial<InstantRegard> = {}): InstantRegard => ({ nom: `i${String(n).padStart(2, "0")}`, instantSec: n, partieId: `p${n}`, sorte: "partie", legende: "", texteAttendu: false, motsDits: [], ...over });
const img = (nom: string, over: Partial<ImageLue> = {}): ImageLue => ({ nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false, ...over });
const six = [1, 2, 3, 4, 5, 6].map((n) => inst(n));
const propre = { images: six.map((i) => img(i.nom)) };

describe("versRelectureImagesCles", () => {
  it("sans défaut : toutes les images lues, aucune remarque", () => {
    const v: VerdictRegard = { defauts: [], relues: 6, nonRelues: 0, partiesFautives: [] };
    expect(versRelectureImagesCles(v, six)).toEqual({ imagesLues: 6, remarques: [] });
  });
  it("un texte coupé à l'instant 3 : remarque image 3 avec le détail", async () => {
    const lire = vi.fn(async () => ({ images: six.map((i) => (i.nom === "i03" ? img(i.nom, { textes: [{ texte: "Un outil pour les dev", coupe: true, horsCadre: false }] }) : img(i.nom))) }));
    const r = await relecteurImagesCles({ instants: () => six, textesPermis: () => ["Un outil pour les devis"], lire })();
    expect(r.imagesLues).toBe(6);
    expect(r.remarques).toHaveLength(1);
    expect(r.remarques[0]).toMatchObject({ image: 3 });
    expect(r.remarques[0]!.raison).toContain("Un outil pour les dev");
  });
  it("une image non relue n'est pas une remarque", () => {
    const v: VerdictRegard = { defauts: [{ code: "non-relue", nom: "i02", instantSec: 2, partieId: "p2", detail: "L'image n'a pas pu être relue.", bloquantSiSur: false }], relues: 5, nonRelues: 1, partiesFautives: [] };
    expect(versRelectureImagesCles(v, six).remarques).toEqual([]);
  });
  it("aucune image relue : lève (jamais « rien à signaler »)", async () => {
    expect(() => versRelectureImagesCles({ defauts: [], relues: 0, nonRelues: 6, partiesFautives: [] }, six)).toThrow("aucune image relue");
    await expect(relecteurImagesCles({ instants: () => six, textesPermis: () => [], lire: async () => null })()).rejects.toThrow("aucune image relue");
  });
  it("au plus 6 images, comme le tableau", async () => {
    expect(IMAGES_CLES_MAX).toBe(IMAGES_CLES_RELUES);
    const dix = Array.from({ length: 10 }, (_, n) => inst(n + 1));
    const lire = vi.fn(async (i: InstantRegard[]) => ({ images: i.map((x) => img(x.nom)) }));
    const r = await relecteurImagesCles({ instants: () => dix, textesPermis: () => [], lire })();
    expect(lire.mock.calls[0]![0]).toHaveLength(6);
    expect(r.imagesLues).toBe(6);
  });
  it("une fin attendue manquante remonte comme remarque", async () => {
    const r = await relecteurImagesCles({ instants: () => [inst(1), inst(2, { sorte: "fin", partieId: null })], textesPermis: () => ["Un"], fin: () => ({ texte: "Prendre rendez-vous" }), lire: async (i) => ({ images: i.map((x) => img(x.nom)) }) })();
    expect(r.remarques.map((x) => x.image)).toEqual([2]);
  });
});

describe("compatibilité avec le crochet du tableau", () => {
  it("instance du tableau assignable à OutilsControleTableau['relireImagesCles'] (vérifié par tsc)", () => {
    const relecteur = relecteurImagesCles<[FicheTableau, MiseEnPageTableau]>({ instants: () => six, textesPermis: () => [], lire: async (i) => ({ images: i.map((x) => img(x.nom)) }) });
    const crochet: OutilsControleTableau["relireImagesCles"] = relecteur;
    expect(typeof crochet).toBe("function");
  });
  it("controlerVideoTableau : réussi, remarque, ou « non fait » selon le verdict ; 0 appel réel", async () => {
    const fiche = copie(ficheErreurCorrigee);
    const rapport = (lire: () => Promise<{ images: ImageLue[] } | null>) =>
      controlerVideoTableau(
        { fiche, contexte: contexteExemple(fiche), historique: [], dejaVu: { coche: true, le: "2026-10-10" }, mesures: MESURES_BONNES },
        { relireImagesCles: relecteurImagesCles<[FicheTableau, MiseEnPageTableau]>({ instants: () => six, textesPermis: () => ["Un outil pour les devis"], lire }) },
      );
    const ras = await rapport(async () => propre);
    expect(ras.verdict).toBe("livrable");
    expect(ras.nonFaits).toEqual([]);
    expect(ras.indicatifs).toEqual([]);
    const coupe = { images: six.map((i) => (i.nom === "i02" ? img(i.nom, { textes: [{ texte: "Un outil pour les dev", coupe: true, horsCadre: false }] }) : img(i.nom))) };
    const avecRemarque = await rapport(async () => coupe);
    expect(avecRemarque.indicatifs.map((l) => l.raison)).toEqual([expect.stringContaining("Image clé n° 2 : Texte coupé")]);
    const nonFait = await rapport(async () => null);
    expect(nonFait.nonFaits.map((l) => l.famille)).toEqual(["relecture"]);
    expect(nonFait.nonFaits[0]!.raison).toContain("aucune image relue");
  });
});
