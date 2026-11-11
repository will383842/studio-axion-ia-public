/**
 * Lien signé de la page « Recevoir le guide » (fiche Z3a-Studio-1). Données FICTIVES.
 * Contrat croisé avec le site : même fixture (SHA-256 identique), même jeton, même conv.
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { construireLienGuide, creerJetonLien, lireSecretLien, refConversationLien } from "@/domaine/guide-reseau/lien-guide";

const CHEMIN = join(__dirname, "aides", "lien-page-guide.v2.json");
// Même constante que dans le test du site (lien-page-guide.spec.ts).
const SHA256_FIXTURE_V2 = "ac4f453e61c2cebd30768473866d968457665d4e53275d226a3d8339947611b9";
const f = JSON.parse(readFileSync(CHEMIN, "utf8")) as {
  secret: string;
  maintenant_ms: number;
  donnees: Parameters<typeof creerJetonLien>[0];
  jeton: string;
  lien: string;
  vecteur_calcul_conv: { secret_empreinte: string; cle_idempotence: string; conv_attendu: string };
};

describe("lien signé · contrat croisé avec le site", () => {
  it("le SHA-256 du fichier fixture égale la constante partagée avec le site", () => {
    expect(createHash("sha256").update(readFileSync(CHEMIN)).digest("hex")).toBe(SHA256_FIXTURE_V2);
  });

  it("creerJetonLien(fixture) reproduit exactement le jeton du site", () => {
    expect(creerJetonLien(f.donnees, f.secret, f.maintenant_ms)).toBe(f.jeton);
  });

  it("construireLienGuide(jeton) reproduit le lien de la fixture", () => {
    expect(construireLienGuide(f.jeton)).toBe(f.lien);
  });

  it("refConversationLien(vecteur) === conv_attendu", () => {
    const v = f.vecteur_calcul_conv;
    expect(refConversationLien(v.secret_empreinte, v.cle_idempotence)).toBe(v.conv_attendu);
    expect(v.conv_attendu).toMatch(/^c1_[A-Za-z0-9_-]{22}$/);
  });

  it("la conv ne contient jamais l'entrée brute (clé, secret, ni la clé en base64url)", () => {
    const v = f.vecteur_calcul_conv;
    const conv = refConversationLien(v.secret_empreinte, v.cle_idempotence);
    expect(conv).not.toContain(v.cle_idempotence);
    expect(conv).not.toContain(v.secret_empreinte);
    expect(conv).not.toContain(Buffer.from(v.cle_idempotence).toString("base64url"));
    expect(conv).not.toContain("run_example");
  });

  it("la conv est un HMAC-SHA256 domaine-séparé, pas un simple condensé", () => {
    const v = f.vecteur_calcul_conv;
    const attendu = "c1_" + createHmac("sha256", v.secret_empreinte).update(`studio/lien-conv/v1\0${v.cle_idempotence}`).digest("base64url").slice(0, 22);
    expect(refConversationLien(v.secret_empreinte, v.cle_idempotence)).toBe(attendu);
    expect(refConversationLien("autre-secret-fictif-example-test-0123456789", v.cle_idempotence)).not.toBe(attendu);
  });

  it("le jeton expire 48 h après l'instant de signature", () => {
    const charge = JSON.parse(Buffer.from(creerJetonLien(f.donnees, f.secret, f.maintenant_ms).split(".")[0]!, "base64url").toString("utf8")) as { exp: number };
    expect(charge.exp).toBe(Math.floor(f.maintenant_ms / 1000) + 172800);
  });

  it("construireLienGuide : null au-delà de 512 caractères", () => {
    const entete = "https://axion-ia.com/guide-reseau?j=";
    expect(construireLienGuide("a".repeat(512 - entete.length))).toHaveLength(512);
    expect(construireLienGuide("a".repeat(513 - entete.length))).toBeNull();
  });
});

describe("lireSecretLien · jamais de repli", () => {
  const BON = "secret-lien-fictif-example-test-0123456789";
  const SITE = "secret-site-fictif-example-test-0123456789";
  const EMPR = "secret-empreinte-fictif-example-test-0123456789";

  it("secret valide, distinct des deux autres : rendu tel quel", () => {
    expect(lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: BON, SITE_GUIDES_RESEAU_SECRET: SITE, STUDIO_EMPREINTE_SECRET: EMPR })).toBe(BON);
  });

  it("absent => null", () => {
    expect(lireSecretLien({ SITE_GUIDES_RESEAU_SECRET: SITE, STUDIO_EMPREINTE_SECRET: EMPR })).toBeNull();
  });

  it("moins de 32 caractères => null", () => {
    expect(lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: "x".repeat(31) })).toBeNull();
  });

  it("égal à SITE_GUIDES_RESEAU_SECRET => null", () => {
    expect(lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: SITE, SITE_GUIDES_RESEAU_SECRET: SITE })).toBeNull();
  });

  it("égal à STUDIO_EMPREINTE_SECRET => null", () => {
    expect(lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: EMPR, STUDIO_EMPREINTE_SECRET: EMPR })).toBeNull();
  });
});
