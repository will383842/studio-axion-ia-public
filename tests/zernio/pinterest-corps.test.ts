/** PR 3 Pinterest · corps Zernio d'une épingle : refus avant le réseau, forme exacte. Données fictives (exemple.fr). */
import { describe, expect, it } from "vitest";
import { analyserCible, corpsPostZernio, plateformeZernio, premierCommentaireTransmissibleZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { lienDuSite } from "@/fournisseurs/publication/liens-du-site";

const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const DOMAINE = "exemple.fr";
const img = (alt = "Une photo d'exemple") => ({ url: "https://exemple.test/a.png", texteAlternatif: alt });
const d = (p: Partial<DemandeZernio> = {}): DemandeZernio => ({
  reseau: "pinterest",
  texte: "Description d'exemple",
  date: "2026-11-05T10:00:00Z",
  fichierCle: "https://exemple.test/a.png",
  cible: "acc:pin:111",
  cleEnvoi: "c".repeat(64),
  images: [img()],
  epingle: { titre: "Titre d'exemple", lien: "https://exemple.fr/page" },
  ...p,
});
const corps = (p: Partial<DemandeZernio> = {}, domaineSite: string | undefined | null = DOMAINE) => corpsPostZernio(d(p), { maintenant: MAINTENANT, domaineSite: domaineSite ?? undefined });
const refuse = (p: Partial<DemandeZernio>) => expect(() => corps(p)).toThrow();

describe("Pinterest · corps", () => {
  it("cible acc:pin:111 → entrée pinterest, boardId, title, link ; brouillon ; clé du Studio", () => {
    const c = corps();
    expect(c.platforms[0]).toEqual({ platform: "pinterest", accountId: "acc", platformSpecificData: { boardId: "111", title: "Titre d'exemple", link: "https://exemple.fr/page" } });
    expect(c.isDraft).toBe(true);
    expect(c.metadata).toEqual({ origine: "studio", studioCle: "c".repeat(64) });
    expect(c.content).toBe("Description d'exemple");
    expect(c.mediaItems).toEqual([{ type: "image", url: "https://exemple.test/a.png", altText: "Une photo d'exemple" }]);
  });
  it("contenuIA vrai → isAiGenerated: true ; faux ou absent → champ absent", () => {
    expect(corps({ contenuIA: true }).platforms[0].platformSpecificData).toMatchObject({ isAiGenerated: true });
    expect(corps({ contenuIA: false }).platforms[0].platformSpecificData).not.toHaveProperty("isAiGenerated");
    expect(corps().platforms[0].platformSpecificData).not.toHaveProperty("isAiGenerated");
  });
  it("jamais boardSectionId, coverImage*, firstComment", () => {
    const s = corps({ premierCommentaire: "Bonjour" }).platforms[0].platformSpecificData as Record<string, unknown>;
    for (const k of ["boardSectionId", "coverImageUrl", "coverImageKeyFrameTime", "firstComment"]) expect(s).not.toHaveProperty(k);
  });
  it("alt de 500 signes accepté sur Pinterest ; 126 refusé sur Instagram (non-régression)", () => {
    expect(() => corps({ images: [img("a".repeat(500))] })).not.toThrow();
    expect(() => corps({ images: [img("a".repeat(501))] })).toThrow(/500/);
    expect(() => corpsPostZernio({ reseau: "instagram", texte: "t", date: "2026-11-05T10:00:00Z", fichierCle: "x", cible: "acc", images: [img("a".repeat(126))] }, { maintenant: MAINTENANT })).toThrow(/125/);
  });
  it("refus avant tout réseau", () => {
    refuse({ cible: "acc" }); // aucun tableau : le premier tableau n'est jamais utilisé
    refuse({ epingle: { titre: "t".repeat(101), lien: "https://exemple.fr/p" } });
    refuse({ epingle: { titre: "   ", lien: "https://exemple.fr/p" } });
    refuse({ epingle: undefined });
    refuse({ texte: "d".repeat(801) });
    refuse({ images: [img("")] });
    refuse({ images: [img("a".repeat(501))] });
    refuse({ epingle: { titre: "T", lien: "http://exemple.fr/p" } });
    refuse({ epingle: { titre: "T", lien: "https://u:p@exemple.fr/p" } });
    refuse({ epingle: { titre: "T", lien: "https://exemple.fr:8443/p" } });
    refuse({ epingle: { titre: "T", lien: "https://www.exemple.fr/p" } }); // sous-domaine
    refuse({ epingle: { titre: "T", lien: "https://autre.fr/p" } });
    refuse({ epingle: { titre: "T", lien: "https://exemple.fr/" + "a".repeat(2000) } });
    refuse({ images: [img(), img()] });
    refuse({ images: undefined, fichierCle: "https://exemple.test/v.mp4" }); // vidéo
    refuse({ images: undefined, document: { url: "https://exemple.test/d.pdf", titre: "Guide" } });
  });
  it("domaine du site absent ou vide : tout lien refusé, avec le code lien-hors-domaine", () => {
    for (const dom of [null, ""]) expect(() => corps({}, dom)).toThrowError(expect.objectContaining({ code: "lien-hors-domaine" }));
  });
  it("lien hors domaine → code lien-hors-domaine", () => {
    expect(() => corps({ epingle: { titre: "T", lien: "https://autre.fr/p" } })).toThrowError(expect.objectContaining({ code: "lien-hors-domaine" }));
  });
  it("mot interdit dans le titre ou la description refusé", () => {
    const interdit = ["cert", "ifié"].join("");
    refuse({ epingle: { titre: `Titre ${interdit}`, lien: "https://exemple.fr/p" } });
    refuse({ texte: `Texte ${interdit}` });
  });
  it("cible pin : tableau numérique seulement", () => {
    expect(analyserCible("acc:pin:111")).toMatchObject({ accountId: "acc", tableauId: "111" });
    for (const m of ["acc:pin:", "acc:pin:abc", "acc:pin:1:2", `acc:pin:${"1".repeat(25)}`]) expect(() => analyserCible(m)).toThrow();
  });
  it("plateforme et premier commentaire", () => {
    expect(plateformeZernio("pinterest")).toBe("pinterest");
    expect(premierCommentaireTransmissibleZernio("pinterest")).toBe(false);
  });
});

describe("lienDuSite", () => {
  it("égalité stricte de l'hôte, https, sans identifiants ni port", () => {
    expect(lienDuSite("https://exemple.fr/x", "exemple.fr")).toBe(true);
    expect(lienDuSite("https://EXEMPLE.fr./x", "exemple.fr")).toBe(true);
    for (const l of ["http://exemple.fr/", "https://a.exemple.fr/", "https://exemple.fr:1/", "https://u@exemple.fr/", "n'importe quoi", "https://exemple.fr.evil.test/"]) expect(lienDuSite(l, "exemple.fr")).toBe(false);
    expect(lienDuSite("https://exemple.fr/x", "")).toBe(false);
  });
});
