import { describe, expect, it } from "vitest";
import { construireDemandeVisuel, type FichierVisuel } from "@/services/demande-publication-visuel";
import { verifierTexteAlternatif } from "@/services/texte-alternatif-visuel";

const image = (i: number, alt = `Schéma numéro ${i}`): FichierVisuel => ({ type: "image", cle: `visuels/fictif/p${i}.png`, alt });
const images = (n: number) => Array.from({ length: n }, (_, i) => image(i + 1));

describe("texte alternatif", () => {
  it("accepte 125 signes, refuse 126", () => {
    expect(verifierTexteAlternatif("a".repeat(125), "instagram")).toEqual({ ok: true });
    const r = verifierTexteAlternatif("a".repeat(126), "instagram");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("alt-trop-long");
  });
  it("refuse un alt vide", () => {
    const r = verifierTexteAlternatif("   ", "instagram");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("alt-vide");
  });
  it("refuse les mots Qualiopi et certifié", () => {
    for (const t of ["Formation Qualiopi", "Équipe certifiée", "Organisme certifié"]) {
      const r = verifierTexteAlternatif(t, "instagram");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs).toContain("alt-mot-interdit");
    }
  });
});

describe("demande de publication d'un visuel", () => {
  it("10 images avec alt valides : acceptées sur Instagram", () => {
    const r = construireDemandeVisuel({ reseau: "instagram", fichiers: images(10), legende: "Légende fictive" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.demande.reseau).toBe("instagram");
      expect(r.demande.medias).toHaveLength(10);
      expect(r.demande.medias[0]).toEqual({ cle: "visuels/fictif/p1.png", alt: "Schéma numéro 1" });
    }
  });
  it("11 images : refusées", () => {
    const r = construireDemandeVisuel({ reseau: "instagram", fichiers: images(11) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("trop-de-pages");
  });
  it("un PDF sur Instagram : refusé", () => {
    const r = construireDemandeVisuel({ reseau: "instagram", fichiers: [{ type: "pdf", cle: "visuels/fictif/doc.pdf", alt: "Document fictif" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("format-refuse");
  });
  it("un alt de 126 signes : refusé", () => {
    const r = construireDemandeVisuel({ reseau: "instagram", fichiers: [image(1, "a".repeat(126))] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("alt-trop-long");
  });
  it("aucun fichier : refusé", () => {
    const r = construireDemandeVisuel({ reseau: "instagram", fichiers: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("aucun-fichier");
  });
  it("légende trop longue : refusée", () => {
    const r = construireDemandeVisuel({ reseau: "instagram", fichiers: images(1), legende: "a".repeat(2201) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("legende-trop-longue");
  });
  it("LinkedIn : un PDF seul est permis, des images ne le sont pas", () => {
    expect(construireDemandeVisuel({ reseau: "linkedin", fichiers: [{ type: "pdf", cle: "visuels/fictif/doc.pdf", alt: "Document fictif" }] }).ok).toBe(true);
    const r = construireDemandeVisuel({ reseau: "linkedin", fichiers: images(2) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("format-refuse");
  });
  it("la demande est inerte : aucun envoi, brouillon à valider", () => {
    const r = construireDemandeVisuel({ reseau: "facebook", fichiers: images(2) });
    expect(r.ok && r.demande.envoiAutorise).toBe(false);
  });
});
