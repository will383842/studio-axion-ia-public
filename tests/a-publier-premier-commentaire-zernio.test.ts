/**
 * Premier commentaire selon l'outil (Zernio) : Instagram, TikTok et YouTube « à la main » (bouton Copier, aucun firstComment) ;
 * Facebook et LinkedIn transmis mais « à confirmer », avec repli manuel. Aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { etatPremierCommentaire, blocPremierCommentaire } from "@/components/publication/finitions-envoi";
import { premierCommentaireTransmissibleZernio } from "@/fournisseurs/publication/zernio-corps";
import { LIBELLES_ENVOI } from "@/domaine/libelles";

describe("état du premier commentaire selon l'outil", () => {
  it("Zernio : Instagram, TikTok, YouTube à la main", () => {
    for (const r of ["instagram", "tiktok", "youtube"]) expect(etatPremierCommentaire("zernio", r)).toBe("a-la-main");
  });
  it("Zernio : Facebook et LinkedIn à confirmer", () => {
    for (const r of ["facebook", "linkedin"]) expect(etatPremierCommentaire("zernio", r)).toBe("a-confirmer");
  });
  it("Buffer : comportement inchangé (Instagram, Facebook, LinkedIn automatiques)", () => {
    for (const r of ["instagram", "facebook", "linkedin"]) expect(etatPremierCommentaire("buffer", r)).toBe("auto");
    for (const r of ["tiktok", "youtube"]) expect(etatPremierCommentaire("buffer", r)).toBe("a-la-main");
  });
  it("cohérence : « à la main » chez Zernio ⇔ le corps Zernio ne transmet pas (lecture sans modification)", () => {
    for (const r of ["instagram", "facebook", "linkedin", "tiktok", "youtube"]) {
      expect(etatPremierCommentaire("zernio", r) !== "a-la-main").toBe(premierCommentaireTransmissibleZernio(r));
    }
    const src = readFileSync("src/fournisseurs/publication/zernio-corps.ts", "utf8");
    expect(src.match(/firstComment/g)?.length).toBe(2);
    expect(src).not.toMatch(/case "instagram":[^]*?firstComment[^]*?case "facebook"/);
  });
  it("le texte « à la main » existe dans les libellés et les clés existantes sont intactes", () => {
    expect(LIBELLES_ENVOI.premierCommentaireALaMain).toMatch(/à la main/);
    expect(LIBELLES_ENVOI.premierCommentaireAConfirmer).toMatch(/confirmer/);
    expect(LIBELLES_ENVOI.premierCommentaire).toBe("Premier commentaire, posé automatiquement");
  });
});

describe("bloc d'affichage", () => {
  it("à la main : le texte est montré (pour le bouton Copier), titre « à poser à la main »", () => {
    const b = blocPremierCommentaire("instagram", "Le lien : exemple.fr", "a-la-main");
    expect(b).toMatchObject({ alaMain: true, texte: "Le lien : exemple.fr", copier: true });
    expect(b?.titre).toBe(LIBELLES_ENVOI.premierCommentaireALaMain);
  });
  it("à confirmer : transmis mais signalé, avec Copier en repli", () => {
    const b = blocPremierCommentaire("facebook", "Bonjour", "a-confirmer");
    expect(b).toMatchObject({ alaMain: false, copier: true });
    expect(b?.titre).toBe(LIBELLES_ENVOI.premierCommentaireAConfirmer);
  });
  it("sans état donné : comportement d'avant (Buffer)", () => {
    expect(blocPremierCommentaire("instagram", "x")).toMatchObject({ titre: LIBELLES_ENVOI.premierCommentaire, alaMain: false });
    expect(blocPremierCommentaire("tiktok", undefined)).toMatchObject({ alaMain: true });
  });
});
