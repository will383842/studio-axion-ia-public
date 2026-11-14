import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FORMULATIONS_KIT,
  LIMITE_TIKTOK,
  construireReponse,
  contientMentionAutomatique,
  copiePossible,
  detecterAEcrireSoiMeme,
  type EntreeKit,
} from "@/services/a-traiter-kit";
import { KitReponse } from "@/components/a-traiter/KitReponse";

const LIEN = "https://exemple.fr/g/abc";
const base: EntreeKit = {
  idEvenement: "evt-1",
  reseau: "linkedin",
  mot: "GUIDE",
  titreGuide: "Le guide",
  lienGuide: LIEN,
  lienCommentaire: "https://www.linkedin.com/feed/post-42?commentaire=c1",
  commentaire: "GUIDE merci",
};
const tt = (o: Partial<EntreeKit> = {}): EntreeKit => ({ ...base, reseau: "tiktok", lienCommentaire: "https://www.tiktok.com/@x/video/1", ...o });
const reponse = (e: EntreeKit, ligne?: string) => {
  const r = construireReponse(e, ligne);
  if (r.genre !== "reponse") throw new Error("reponse attendue");
  return r;
};

describe("ATR-03 kit de réponse manuelle", () => {
  it("critère 1 : réponse tirée des formulations validées, avec le lien du guide", () => {
    const r = reponse(base);
    expect(r.texte).toContain(LIEN);
    expect(r.texte).toContain("Le guide");
    expect(r.texte.endsWith(LIEN)).toBe(true); // lien à la fin, sans ponctuation
    expect(r.copiable).toBe(true);
    expect(FORMULATIONS_KIT.length).toBeGreaterThan(1);
  });

  it("une formulation par conversation : stable au rejeu, variable d'une conversation à l'autre", () => {
    expect(reponse(base).texte).toBe(reponse(base).texte);
    const textes = new Set(Array.from({ length: 40 }, (_, i) => reponse({ ...base, idEvenement: `evt-${i}` }).texte));
    expect(textes.size).toBeGreaterThan(1);
  });

  it("sans lien https, sans titre ou sans mot requis : aucune réponse toute faite", () => {
    expect(construireReponse({ ...base, lienGuide: null }).genre).toBe("indisponible");
    expect(construireReponse({ ...base, lienGuide: "http://exemple.fr/g" }).genre).toBe("indisponible");
    expect(construireReponse({ ...base, titreGuide: "" }).genre).toBe("indisponible");
  });

  it("correctif : aucune formulation ne contient de mention automatique ni de signature", () => {
    for (const f of FORMULATIONS_KIT) {
      expect(contientMentionAutomatique(f.texte)).toBe(false);
      expect(f.texte.toLowerCase()).not.toContain("axion");
    }
    for (let i = 0; i < 50; i++)
      for (const reseau of ["linkedin", "tiktok"] as const) {
        const r = construireReponse({ ...base, reseau, idEvenement: `e${i}` });
        if (r.genre === "reponse") expect(contientMentionAutomatique(r.texte)).toBe(false);
      }
  });

  it("le détecteur de mention refuse la mention, les variantes et la signature", () => {
    expect(contientMentionAutomatique("Message automatique envoyé par Axion IA")).toBe(true);
    expect(contientMentionAutomatique("message AUTOMATIQUE")).toBe(true);
    expect(contientMentionAutomatique("Envoyé automatiquement")).toBe(true);
    expect(contientMentionAutomatique("Cordialement,\nL'équipe Axion IA")).toBe(true);
    expect(contientMentionAutomatique("Bonjour et merci !")).toBe(false);
  });

  it("une première ligne personnalisée portant la mention est refusée", () => {
    const r = reponse(base, "Message automatique envoyé par Axion IA");
    expect(r.texte).not.toContain("automatique");
    expect(r.premiereLigneRefusee).toBe(true);
  });

  it("critère 2 : TikTok, limite aux bornes 150 / 151", () => {
    expect(LIMITE_TIKTOK).toBe(150);
    expect(copiePossible("tiktok", "a".repeat(150))).toBe(true);
    expect(copiePossible("tiktok", "a".repeat(151))).toBe(false);
    expect(copiePossible("tiktok", "é".repeat(150))).toBe(true);
    expect(copiePossible("tiktok", "é".repeat(151))).toBe(false);
    expect(copiePossible("tiktok", "bonjour @quelquun")).toBe(false);
    expect(copiePossible("tiktok", "bonjour ＠quelquun")).toBe(false);
    expect(copiePossible("linkedin", "a".repeat(151))).toBe(true);
  });

  it("critère 2 : la réponse TikTok est courte, copiable, sans @", () => {
    for (let i = 0; i < 30; i++) {
      const r = reponse(tt({ idEvenement: `t${i}` }));
      expect([...r.texte].length).toBeLessThanOrEqual(150);
      expect(r.texte).not.toContain("@");
      expect(r.copiable).toBe(true);
    }
  });

  it("critère 2 : un lien trop long ou une première ligne trop longue retire la copie TikTok", () => {
    const long = reponse(tt({ lienGuide: "https://exemple.fr/" + "x".repeat(200) }));
    expect([...long.texte].length).toBeGreaterThan(150);
    expect(long.copiable).toBe(false);
    const avecArobase = reponse(tt(), "Bonjour @pseudo");
    expect(avecArobase.copiable).toBe(false);
    const ligneLongue = reponse(tt(), "Bonjour " + "y".repeat(110));
    expect(ligneLongue.copiable).toBe(false);
    expect(ligneLongue.raisonNonCopiable).toBe("trop_long");
    // au-delà de 120 caractères, la première ligne n'est pas retenue : la phrase validée est gardée
    const refusee = reponse(tt(), "Bonjour " + "y".repeat(160));
    expect(refusee.premiereLigneRefusee).toBe(true);
    expect(refusee.copiable).toBe(true);
  });

  it("critère 3 : la première ligne se personnalise avant la copie", () => {
    const r = reponse(base);
    expect(r.premiereLigne.length).toBeGreaterThan(0);
    const p = reponse(base, "Bonjour chez vous !");
    expect(p.texte.startsWith("Bonjour chez vous !")).toBe(true);
    expect(p.texte.endsWith(LIEN)).toBe(true);
    expect(p.texte).not.toContain(r.premiereLigne + " ");
    // la formulation choisie ne change pas quand on personnalise
    expect(p.indice).toBe(r.indice);
    // saut de ligne et espaces superflus nettoyés
    expect(reponse(base, "  Merci\nvous  ").texte.startsWith("Merci vous ")).toBe(true);
    // ligne vide : on garde la validée
    expect(reponse(base, "   ").texte).toBe(r.texte);
  });

  it.each([
    ["Quel est le prix ?", "prix"],
    ["C'est combien ?", "prix"],
    ["Quel tarif svp", "prix"],
    ["c'est payant ? 20 €", "prix"],
    ["C'est une arnaque, je veux un remboursement", "reclamation"],
    ["Je n'ai rien reçu, c'est scandaleux", "reclamation"],
    ["Honte à vous, j'en ai marre", "colere"],
    ["VRAIMENT PAS CONTENT DU TOUT !!!", "colere"],
  ])("critère 4 : « %s » = à écrire soi-même (%s), aucun texte tout fait", (commentaire, raison) => {
    expect(detecterAEcrireSoiMeme(commentaire)).toBe(raison);
    for (const reseau of ["linkedin", "tiktok"] as const) {
      const r = construireReponse({ ...base, reseau, commentaire });
      expect(r).toEqual({ genre: "a_ecrire_soi_meme", raison });
      expect(JSON.stringify(r)).not.toContain(LIEN);
    }
  });

  it("critère 4 : un commentaire normal n'est pas signalé", () => {
    expect(detecterAEcrireSoiMeme("GUIDE merci beaucoup")).toBeNull();
    expect(detecterAEcrireSoiMeme("Super contenu, j'adore")).toBeNull();
    expect(detecterAEcrireSoiMeme("")).toBeNull();
  });

  it("critère 4 : le drapeau explicite de la carte l'emporte", () => {
    expect(construireReponse({ ...base, aEcrireSoiMeme: true }).genre).toBe("a_ecrire_soi_meme");
  });

  it("critère 6 : LinkedIn plus posé que TikTok ; TikTok court", () => {
    const moy = (reseau: "linkedin" | "tiktok") => {
      const l = Array.from({ length: 60 }, (_, i) => [...reponse({ ...base, reseau, idEvenement: `m${i}` }).texte].length);
      return l.reduce((a, b) => a + b, 0) / l.length;
    };
    expect(moy("tiktok")).toBeLessThan(moy("linkedin"));
    expect(FORMULATIONS_KIT.some((f) => f.reseaux.includes("linkedin"))).toBe(true);
    expect(FORMULATIONS_KIT.some((f) => f.reseaux.includes("tiktok"))).toBe(true);
  });

  it("réseau autre que LinkedIn ou TikTok : aucun kit", () => {
    expect(construireReponse({ ...base, reseau: "youtube" }).genre).toBe("indisponible");
  });

  it("critère 5 : le kit ne fait que copier, aucun appel d'écriture ni réseau", async () => {
    const appels: string[] = [];
    const faux = vi.fn(() => {
      appels.push("fetch");
      throw new Error("ecriture_interdite");
    });
    vi.stubGlobal("fetch", faux);
    try {
      for (const reseau of ["linkedin", "tiktok"] as const) reponse({ ...base, reseau });
      renderToStaticMarkup(createElement(KitReponse, { entree: base }));
    } finally {
      vi.unstubAllGlobals();
    }
    expect(faux).not.toHaveBeenCalled();
    for (const f of ["src/services/a-traiter-kit.ts", "src/components/a-traiter/KitReponse.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|method:\s*["']P/);
      expect(src).not.toMatch(/zernio|mots-|server-only|node:|from "@\/services\/(?!a-traiter-kit)/);
    }
  });
});

describe("ATR-03 composant KitReponse", () => {
  const rendre = (e: EntreeKit) => renderToStaticMarkup(createElement(KitReponse, { entree: e }));

  it("critère 1 : texte, lien du guide, boutons Copier et Ouvrir le commentaire", () => {
    const html = rendre(base);
    expect(html).toContain(LIEN);
    expect(html).toContain("Copier");
    expect(html).toContain("Ouvrir le commentaire");
    expect(html).toContain('href="https://www.linkedin.com/feed/post-42?commentaire=c1"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("critère 2 : TikTok trop long, pas de bouton Copier", () => {
    const html = rendre(tt({ lienGuide: "https://exemple.fr/" + "x".repeat(200) }));
    expect(html).not.toContain("data-copier");
    expect(html).toContain("150");
    expect(html).toContain("Ouvrir le commentaire");
  });

  it("critère 4 : drapeau « à écrire soi-même », ni texte ni bouton Copier", () => {
    const html = rendre({ ...base, commentaire: "C'est quoi le prix ?" });
    expect(html).toContain("À écrire soi-même");
    expect(html).not.toContain("data-copier");
    expect(html).not.toContain(LIEN);
    expect(html).toContain("Ouvrir le commentaire");
  });

  it("ouvrir le commentaire : lien https seulement, sinon pas de bouton", () => {
    expect(rendre({ ...base, lienCommentaire: "javascript:alert(1)" })).not.toContain("Ouvrir le commentaire");
    expect(rendre({ ...base, lienCommentaire: null })).not.toContain("Ouvrir le commentaire");
  });

  it("aucune mention automatique ni signature dans l'écran", () => {
    expect(contientMentionAutomatique(rendre(base))).toBe(false);
  });
});
