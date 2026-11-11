/**
 * L3-08 : rôle « premier commentaire ». Simulation seulement : aucun appel, aucune clé.
 * Critères : lien sans répéter le post (LinkedIn, Facebook : transmis, « à confirmer ») ; Instagram à la main
 * (automatique seulement après la preuve RC-08) ; TikTok jamais ; jamais le même texte sur deux réseaux ; aucun
 * « commentez » ; fonctionne sans videoId (contenu importé à la main).
 */
import { describe, expect, it } from "vitest";
import { contenuDepuisVideoImportee } from "@/domaine/ecriture-post/adaptateurs";
import { composerPremierCommentaire, modePremierCommentaire, PREMIER_COMMENTAIRE_RESEAUX } from "@/domaine/ecriture-post/commentaire";
import { evaluerPremierCommentaire, entreePremierCommentaire, rolePremierCommentaire, simulerPremierCommentaire } from "@/generateur/roles/premier-commentaire";
import { proposerPremierCommentaire } from "@/services/premier-commentaire";

const LIEN = "https://exemple.fr/ressource?utm_medium=post";
const contenu = contenuDepuisVideoImportee({ titre: "Relancer un devis", description: "Trois relances suffisent pour retrouver vos devis restés sans réponse." });

describe("mode selon le réseau", () => {
  it("LinkedIn et Facebook : transmis, à confirmer, repli à la main", () => {
    for (const r of ["linkedin", "facebook"] as const) expect(modePremierCommentaire(r)).toEqual({ mode: "a-confirmer", transmettre: true, copier: true });
  });
  it("Instagram : à la main tant que RC-08 n'a rien prouvé, automatique après", () => {
    expect(modePremierCommentaire("instagram")).toEqual({ mode: "a-la-main", transmettre: false, copier: true });
    expect(modePremierCommentaire("instagram", { preuveRC08: true })).toEqual({ mode: "auto", transmettre: true, copier: true });
  });
  it("TikTok : jamais, même après la preuve", () => {
    expect(modePremierCommentaire("tiktok", { preuveRC08: true })).toEqual({ mode: "a-la-main", transmettre: false, copier: true });
  });
});

describe("texte", () => {
  it("objectif lien : le lien est donné sans répéter le post", () => {
    for (const r of ["linkedin", "facebook"] as const) {
      const t = composerPremierCommentaire({ contenu, reseau: r, objectif: "lien", lien: LIEN });
      expect(t).toContain(LIEN);
      expect(t).not.toContain(contenu.texteValide);
      expect(t).not.toContain(contenu.titre);
    }
  });
  it("deux réseaux n'ont jamais le même texte", () => {
    const textes = PREMIER_COMMENTAIRE_RESEAUX.map((r) => composerPremierCommentaire({ contenu, reseau: r, objectif: "lien", lien: LIEN }));
    expect(new Set(textes).size).toBe(textes.length);
    const sansLien = PREMIER_COMMENTAIRE_RESEAUX.map((r) => composerPremierCommentaire({ contenu, reseau: r }));
    expect(new Set(sansLien).size).toBe(sansLien.length);
  });
  it("aucun « commentez » ni tutoiement, sur tous les réseaux", () => {
    for (const r of PREMIER_COMMENTAIRE_RESEAUX) for (const lien of [LIEN, undefined]) {
      const t = composerPremierCommentaire({ contenu, reseau: r, objectif: lien ? "lien" : undefined, lien });
      expect(t).not.toMatch(/comment(ez|e|er)\b/i);
      expect(evaluerPremierCommentaire({ texte: t }, { reseau: r })).toEqual([]);
    }
  });
});

describe("évaluations", () => {
  it("« commentez » refusé", () => expect(evaluerPremierCommentaire({ texte: "Commentez ci-dessous !" }, { reseau: "linkedin" }).join(" ")).toMatch(/PC-01/));
  it("texte vide ou trop long refusé", () => {
    expect(evaluerPremierCommentaire({ texte: "  " }, { reseau: "linkedin" }).join(" ")).toMatch(/PC-02/);
    expect(evaluerPremierCommentaire({ texte: "a".repeat(5000) }, { reseau: "linkedin" }).join(" ")).toMatch(/PC-02/);
  });
  it("objectif lien : le lien doit y être", () => expect(evaluerPremierCommentaire({ texte: "Voici la suite." }, { reseau: "linkedin", objectif: "lien", lien: LIEN }).join(" ")).toMatch(/PC-03/));
  it("le rôle est défini et simulable sans appel", () => {
    expect(rolePremierCommentaire.id).toBe("premier-commentaire");
    const d = { reseau: "facebook" as const, contenu, objectif: "lien" as const, lien: LIEN };
    expect(simulerPremierCommentaire(entreePremierCommentaire(d)).texte).toContain(LIEN);
  });
});

describe("proposerPremierCommentaire(contenuSource, reseau) : sans videoId", () => {
  it("LinkedIn : texte transmis, à confirmer, repli Copier", async () => {
    const p = await proposerPremierCommentaire(contenu, "linkedin", { objectif: "lien", lien: LIEN });
    expect(p.mode).toBe("a-confirmer");
    expect(p.firstComment).toContain(LIEN);
    expect(p.copier).toBe(true);
  });
  it("Instagram et TikTok : bouton Copier, aucun firstComment", async () => {
    for (const r of ["instagram", "tiktok"] as const) {
      const p = await proposerPremierCommentaire(contenu, r, { objectif: "lien", lien: LIEN });
      expect(p.mode).toBe("a-la-main");
      expect(p.copier).toBe(true);
      expect(p.texte).toBeTruthy();
      expect("firstComment" in p).toBe(false);
    }
  });
  it("Instagram après la preuve RC-08 : automatique ; TikTok jamais", async () => {
    expect((await proposerPremierCommentaire(contenu, "instagram", { preuveRC08: true })).firstComment).toBeTruthy();
    expect("firstComment" in (await proposerPremierCommentaire(contenu, "tiktok", { preuveRC08: true }))).toBe(false);
  });
  it("objectif lien sans lien : refusé en clair, rien d'inventé", async () => {
    await expect(proposerPremierCommentaire(contenu, "linkedin", { objectif: "lien" })).rejects.toThrow(/lien/);
  });
});
