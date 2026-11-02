/** Origine complète (contrat v3) : module pur, drapeau éteint par défaut, champs facultatifs. Fixtures fictives (.test, jetons génériques). */
import { describe, expect, it } from "vitest";
import {
  construireOrigineV3,
  corpsDemandeGuideV3,
  origineV3Active,
  postUrlValide,
  type OrigineBrute,
} from "@/domaine/guide-reseau/origine-v3";
import { corpsDemandeGuide, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";

const RUN: RunLu = { email: "lecteur@exemple.test", mot: "guide", reseau: "instagram", accord: "non_demande", guide: "guide-ia", versionTexteM1: "m1-v1" };
const PREFIXES = ["/compte-test/"];
const BRUTE: OrigineBrute = { postRef: "ref_post_0001", postUrl: "https://www.instagram.com/compte-test/p/abc123/", canal: "commentaire", compte: "page_principale", famille: "guide_reseau", detail: "autre_non_classe", versionTexte: "m1-v1", utmCampaign: "essai_test" };

describe("drapeau", () => {
  it("éteint par défaut ; seules les valeurs exactes 1 et true allument", () => {
    expect(origineV3Active({})).toBe(false);
    for (const v of ["0", "", "oui", "TRUE", " 1"]) expect(origineV3Active({ ORIGINE_V3_ENABLED: v })).toBe(false);
    expect(origineV3Active({ ORIGINE_V3_ENABLED: "1" })).toBe(true);
    expect(origineV3Active({ ORIGINE_V3_ENABLED: "true" })).toBe(true);
  });
});

describe("post_url publique contrôlée", () => {
  const ok = (u: string, r = "instagram") => postUrlValide(u, r, PREFIXES);
  it("accepte https, hôte exact de la liste, préfixe de nos comptes", () => {
    expect(ok("https://www.instagram.com/compte-test/p/abc123/")).toBe(true);
  });
  it("refuse http, hôte hors liste, sous-domaine piège, port, identifiant, paramètre, fragment, IDN, raccourcisseur", () => {
    for (const u of [
      "http://www.instagram.com/compte-test/p/abc123/",
      "https://autre.test/compte-test/p/abc123/",
      "https://www.instagram.com.autre.test/compte-test/p/abc123/",
      "https://evilinstagram.com/compte-test/p/abc123/",
      "https://www.instagram.com:8443/compte-test/p/abc123/",
      "https://u:p@www.instagram.com/compte-test/p/abc123/",
      "https://www.instagram.com/compte-test/p/abc123/?x=1",
      "https://www.instagram.com/compte-test/p/abc123/#f",
      "https://www.xn--instagram-9d3b.com/compte-test/p/abc123/",
      "https://bit.ly/abc123",
    ]) expect(ok(u), u).toBe(false);
  });
  it("refuse un chemin de profil et un chemin hors de nos comptes ; refuse tout sans liste de comptes", () => {
    expect(ok("https://www.instagram.com/compte-test/")).toBe(false);
    expect(ok("https://www.instagram.com/quelquun-test/p/abc123/")).toBe(false);
    expect(postUrlValide("https://www.instagram.com/compte-test/p/abc123/", "instagram", [])).toBe(false);
  });
  it("refuse plus de 300 caractères", () => {
    expect(ok("https://www.instagram.com/compte-test/p/" + "a".repeat(300) + "/")).toBe(false);
  });
});

describe("construireOrigineV3", () => {
  it("complète : champs dans un ordre fixe", () => {
    const r = construireOrigineV3(BRUTE, { reseau: "instagram", prefixesComptes: PREFIXES });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.origine)).toEqual(["post_ref", "post_url", "canal", "compte", "famille", "detail", "version_texte", "utm_campaign"]);
  });
  it("minimale (vide) : acceptée, aucun champ", () => {
    const r = construireOrigineV3({}, { reseau: "instagram", prefixesComptes: [] });
    expect(r).toEqual({ ok: true, origine: {} });
  });
  it("refuse les formes invalides sans répéter la valeur", () => {
    for (const [k, v] of [["postRef", "court"], ["canal", "autre"], ["compte", "@pseudo"], ["famille", "Famille Inconnue"], ["detail", "x"], ["versionTexte", "a b"], ["utmCampaign", "MAJ"]] as const) {
      const r = construireOrigineV3({ ...BRUTE, [k]: v }, { reseau: "instagram", prefixesComptes: PREFIXES });
      expect(r.ok, k).toBe(false);
      expect(JSON.stringify(r)).not.toContain(String(v));
    }
  });
  it("une post_url invalide est refusée en bloc (pas de demi-envoi)", () => {
    expect(construireOrigineV3({ ...BRUTE, postUrl: "http://x.test/" }, { reseau: "instagram", prefixesComptes: PREFIXES }).ok).toBe(false);
  });
  it("message privé refusé pour LinkedIn et TikTok, accepté sur Instagram et Facebook", () => {
    for (const reseau of ["linkedin_page", "tiktok"] as const) {
      expect(construireOrigineV3({ canal: "message_prive" }, { reseau, prefixesComptes: [] })).toEqual({ ok: false, code: "message_prive_interdit" });
      expect(construireOrigineV3({ canal: "commentaire" }, { reseau, prefixesComptes: [] }).ok).toBe(true);
    }
    for (const reseau of ["instagram", "facebook"] as const) expect(construireOrigineV3({ canal: "message_prive" }, { reseau, prefixesComptes: [] }).ok).toBe(true);
  });
});

describe("corps v3", () => {
  it('sans origine fournie le corps v1 porte "schemaVersion":1', () => {
    expect(corpsDemandeGuide(RUN, "run_exemple_0001")).toContain('"schemaVersion":1');
  });
  it("v3 : schemaVersion 3, mêmes clés v1 puis l'origine, aucun champ interdit", () => {
    const r = construireOrigineV3(BRUTE, { reseau: "instagram", prefixesComptes: PREFIXES });
    if (!r.ok) throw new Error("origine");
    const corps = corpsDemandeGuideV3(RUN, "run_exemple_0001", r.origine);
    const j = JSON.parse(corps);
    expect(j.schemaVersion).toBe(3);
    expect(j.post_ref).toBe("ref_post_0001");
    for (const interdit of ["pseudo", "nom", "texte", "commentaire", "profil"]) expect(Object.keys(j)).not.toContain(interdit);
    expect(corpsDemandeGuideV3(RUN, "run_exemple_0001", r.origine)).toBe(corps); // octets stables
  });
  it("v3 minimale : schemaVersion 3 sans champ d'origine", () => {
    const j = JSON.parse(corpsDemandeGuideV3(RUN, "run_exemple_0001", {}));
    expect(j.schemaVersion).toBe(3);
    expect(j.post_ref).toBeUndefined();
  });
});
