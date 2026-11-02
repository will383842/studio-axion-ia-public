/** S4.2 — la signature des appels (plan § 7.2) : vecteur fixe, sensibilité à chaque octet, même HMAC que les crochets. */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { chaineASigner } from "@/domaine/site-videos/contrat";
import { sha256Hex, signatureValide, signerAppel } from "@/fournisseurs/site/signature";

vi.mock("next/headers", async () => (await import("../helpers/next-mocks")).mockHeaders);

const SECRET = "secret-d-exemple-du-contrat";
const NONCE = "00112233445566778899aabbccddeeff";
/** Vecteur commun studio ↔ site (calculé avec l'algorithme de `src/server/videos/signature.ts` du site ; secret fictif). */
const V = {
  secret: "secret-fictif-de-test-pv2",
  horodatage: "1760781600",
  nonce: "00112233445566778899aabbccddeeff",
  methode: "POST",
  chemin: "/api/interne/demandes-guide-reseau",
  corps: '{"mot":"GUIDE","reseau":"instagram","accord":"non_demande","idRun":"run_exemple_0001"}',
  sha256Corps: "7fa43e9ae5d7c0a854f7d46e6b2be9cd7f0341916a708eaf3c06c9259a9f2722",
  signature: "v1=e9876c7e1b20ac0862c564b4a02acca0ce3a336f2c1c64b2111d4950b5bafab9",
};
const CORPS = '{"idStudio":"vid_1","versionPasseport":2}';

describe("S4.2 signature", () => {
  it("vecteur fixe : la chaîne signée et la signature attendues, calculées à la main", () => {
    const chaine = chaineASigner({ horodatage: "1760781600", nonce: NONCE, methode: "POST", chemin: "/api/interne/videos", sha256Corps: sha256Hex(CORPS) });
    expect(chaine).toBe(`v1\n1760781600\n${NONCE}\nPOST\n/api/interne/videos\n${sha256Hex(CORPS)}`);
    // Valeurs de référence calculées HORS du code, avec sha256sum et openssl (printf '%s' "<chaîne>" | openssl dgst -sha256 -hmac "<secret>").
    expect(sha256Hex(CORPS)).toBe("e74571e1f6b366bba154e7fd18af7b12448326760ad65cee062b9ae0c7d2b769");
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatageSec: 1760781600, nonce: NONCE });
    expect(e["x-axion-horodatage"]).toBe("1760781600");
    expect(e["x-axion-nonce"]).toBe(NONCE);
    expect(e["x-axion-signature"]).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(`v1=${createHmac("sha256", SECRET).update(chaine).digest("hex")}`).toBe(e["x-axion-signature"]);
  });

  it("un corps vide se signe avec le sha256 de la chaîne vide", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    const e = signerAppel({ secret: SECRET, methode: "GET", chemin: "/api/interne/videos/reglages", corps: "", horodatageSec: 1760781600, nonce: NONCE });
    expect(e["x-axion-signature"]).toBe(`v1=${createHmac("sha256", SECRET).update(`v1\n1760781600\n${NONCE}\nGET\n/api/interne/videos/reglages\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).digest("hex")}`);
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
    expect(signatureValide(SECRET, { ...base, signature: e["x-axion-signature"].slice(0, 62) })).toBe(false);
    expect(signatureValide(SECRET, { ...base, signature: "" })).toBe(false);
    expect(signatureValide("autre", { ...base, signature: e["x-axion-signature"] })).toBe(false);
  });

  it("le HMAC est celui des crochets : signatureCrochet(secret, chaîne) donne le hex après `v1=`", async () => {
    const { signatureCrochet } = await import("@/services/crochets");
    const chaine = chaineASigner({ horodatage: "1760781600", nonce: NONCE, methode: "POST", chemin: "/api/interne/videos", sha256Corps: sha256Hex(CORPS) });
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps: CORPS, horodatageSec: 1760781600, nonce: NONCE });
    expect(e["x-axion-signature"]).toBe(`v1=${signatureCrochet(SECRET, chaine)}`);
  });

  it("l'exemple écrit dans docs/site-videos/contrat/signature.exemple.md est la même signature", async () => {
    const { readFileSync } = await import("node:fs");
    const { corpsExemple } = await import("./helpers-contrat");
    const doc = readFileSync("docs/site-videos/contrat/signature.exemple.md", "utf8");
    const corps = JSON.stringify(corpsExemple());
    const e = signerAppel({ secret: SECRET, methode: "POST", chemin: "/api/interne/videos", corps, horodatageSec: 1760781600, nonce: NONCE });
    expect(doc).toContain(e["x-axion-signature"]);
  });

  it("VECTEUR COMMUN (route guides) : horodatage, nonce, méthode, chemin, corps, secret fictif → signature attendue, collée dans la doc", async () => {
    const { readFileSync } = await import("node:fs");
    const e = signerAppel({ secret: V.secret, methode: V.methode, chemin: V.chemin, corps: V.corps, horodatageSec: Number(V.horodatage), nonce: V.nonce });
    expect(sha256Hex(V.corps)).toBe(V.sha256Corps);
    expect(e["x-axion-signature"]).toBe(V.signature);
    expect(signatureValide(V.secret, { methode: V.methode, chemin: V.chemin, corps: V.corps, horodatage: V.horodatage, nonce: V.nonce, signature: V.signature })).toBe(true);
    for (const f of ["docs/site-videos/contrat/signature.exemple.md", "docs/zernio/parcours-viral/04-CONTRAT-SYNCHRO-champs.md"]) {
      const doc = readFileSync(f, "utf8");
      for (const v of [V.secret, V.horodatage, V.nonce, V.chemin, V.corps, V.sha256Corps, V.signature]) expect(doc).toContain(v);
    }
  });
});
