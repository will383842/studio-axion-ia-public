/** S4.2 — la signature des appels (plan § 7.2) : vecteur fixe, sensibilité à chaque octet, même HMAC que les crochets. */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { chaineASigner } from "@/domaine/site-videos/contrat";
import { sha256Hex, signatureValide, signerAppel } from "@/fournisseurs/site/signature";

vi.mock("next/headers", async () => (await import("../helpers/next-mocks")).mockHeaders);

const SECRET = "secret-d-exemple-du-contrat";
const NONCE = "00112233445566778899aabbccddeeff";
const CORPS = '{"idStudio":"vid_1","versionPasseport":2}';

describe("S4.2 signature", () => {
  it("vecteur fixe : la chaîne signée et la signature attendues, calculées à la main", () => {
    const chaine = chaineASigner({ horodatage: "1760781600", nonce: NONCE, methode: "POST", chemin: "/api/interne/videos", sha256Corps: sha256Hex(CORPS) });
    expect(chaine).toBe(`1760781600.${NONCE}.POST./api/interne/videos.${sha256Hex(CORPS)}`);
    // Valeurs de référence calculées HORS du code, avec sha256sum et openssl (printf '%s' "<chaîne>" | openssl dgst -sha256 -hmac "<secret>").
    expect(sha256Hex(CORPS)).toBe("e74571e1f6b366bba154e7fd18af7b12448326760ad65cee062b9ae0c7d2b769");
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatageSec: 1760781600, nonce: NONCE });
    expect(e["x-axion-horodatage"]).toBe("1760781600");
    expect(e["x-axion-nonce"]).toBe(NONCE);
    expect(e["x-axion-signature"]).toBe("6662924502eaedc9f0020dc574309ff7fe29b95161812d853798661630b1e221");
    expect(createHmac("sha256", SECRET).update(chaine).digest("hex")).toBe(e["x-axion-signature"]);
  });

  it("un corps vide se signe avec le sha256 de la chaîne vide", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    const e = signerAppel({ secret: SECRET, methode: "GET", chemin: "/api/interne/videos/reglages", corps: "", horodatageSec: 1760781600, nonce: NONCE });
    expect(e["x-axion-signature"]).toBe(createHmac("sha256", SECRET).update(`1760781600.${NONCE}.GET./api/interne/videos/reglages.e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).digest("hex"));
  });

  it("le corps modifié d'un octet, ou n'importe quel autre élément, change la signature", () => {
    const base = { secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatageSec: 1760781600, nonce: NONCE };
    const ref = signerAppel(base)["x-axion-signature"];
    expect(signerAppel({ ...base, corps: CORPS.replace("2}", "3}") })["x-axion-signature"]).not.toBe(ref);
    expect(signerAppel({ ...base, methode: "DELETE" })["x-axion-signature"]).not.toBe(ref);
    expect(signerAppel({ ...base, chemin: "/api/interne/videos/x" })["x-axion-signature"]).not.toBe(ref);
    expect(signerAppel({ ...base, horodatageSec: 1760781601 })["x-axion-signature"]).not.toBe(ref);
    expect(signerAppel({ ...base, nonce: "f".repeat(32) })["x-axion-signature"]).not.toBe(ref);
    expect(signerAppel({ ...base, secret: `${SECRET}!` })["x-axion-signature"]).not.toBe(ref);
  });

  it("le nonce est aléatoire (16 octets en hexadécimal) quand on ne le donne pas", () => {
    const a = signerAppel({ secret: SECRET, methode: "GET", chemin: "/x", corps: "", horodatageSec: 1 })["x-axion-nonce"];
    const b = signerAppel({ secret: SECRET, methode: "GET", chemin: "/x", corps: "", horodatageSec: 1 })["x-axion-nonce"];
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it("la vérification accepte la bonne signature et refuse une signature de longueur différente", () => {
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatageSec: 1760781600, nonce: NONCE });
    const base = { methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatage: "1760781600", nonce: NONCE };
    expect(signatureValide(SECRET, { ...base, signature: e["x-axion-signature"] })).toBe(true);
    expect(signatureValide(SECRET, { ...base, signature: e["x-axion-signature"].slice(0, 60) })).toBe(false);
    expect(signatureValide(SECRET, { ...base, signature: "" })).toBe(false);
    expect(signatureValide("autre", { ...base, signature: e["x-axion-signature"] })).toBe(false);
  });

  it("c'est la même fonction que les crochets : signatureCrochet(secret, chaîne) donne la même signature", async () => {
    const { signatureCrochet } = await import("@/services/crochets");
    const chaine = chaineASigner({ horodatage: "1760781600", nonce: NONCE, methode: "POST", chemin: "/api/interne/videos", sha256Corps: sha256Hex(CORPS) });
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatageSec: 1760781600, nonce: NONCE });
    expect(e["x-axion-signature"]).toBe(signatureCrochet(SECRET, chaine));
  });

  it("l'exemple écrit dans docs/site-videos/contrat/signature.exemple.md est la même signature", async () => {
    const { readFileSync } = await import("node:fs");
    const { corpsExemple } = await import("./helpers-contrat");
    const doc = readFileSync("docs/site-videos/contrat/signature.exemple.md", "utf8");
    const corps = JSON.stringify(corpsExemple());
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps, horodatageSec: 1760781600, nonce: NONCE });
    expect(doc).toContain(e["x-axion-signature"]);
  });
});
