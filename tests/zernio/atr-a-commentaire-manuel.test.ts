/** ATR-A : lecture SANS CONTENU d'un comment.received LinkedIn/TikTok. Données fictives, aucun réseau. */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { type EnveloppeZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { lireCommentaireManuel } from "@/domaine/guide-reseau/commentaire-manuel";

const env = (plateforme: string, c: object = {}, racine: object = {}): EnveloppeZernio => ({
  id: "evt_1", event: "comment.received", timestampSec: 1_760_781_600,
  racine: { account: { accountId: "acc_1", platform: plateforme }, comment: { id: "com_1", platformPostId: "post_1", text: "GUIDE", author: { id: "auteur_1" }, ...c }, ...racine },
});
const URN = "urn:li:activity:7000000000000000001";

describe("lireCommentaireManuel", () => {
  it("lit un commentaire LinkedIn fictif : mot seul normalisé, aucun texte", () => {
    const r = lireCommentaireManuel(env("LinkedIn"), ["GUIDE"]);
    expect(r).toEqual({ idCommentaire: "com_1", idCompte: "acc_1", reseau: "linkedin_page", repere: "post_1", lienPost: null, idAuteur: "auteur_1", proprio: false, motSeul: "GUIDE", estReponse: false });
  });
  it("lit un commentaire TikTok fictif", () => {
    const r = lireCommentaireManuel(env("tiktok", { text: "guide !", isReply: true }));
    expect(r).toMatchObject({ reseau: "tiktok", motSeul: "GUIDE", estReponse: true });
  });
  it("Facebook et Instagram : null", () => {
    expect(lireCommentaireManuel(env("facebook"))).toBeNull();
    expect(lireCommentaireManuel(env("instagram"))).toBeNull();
    expect(lireCommentaireManuel(env(""))).toBeNull();
  });
  it("autre événement : null", () => {
    expect(lireCommentaireManuel({ ...env("tiktok"), event: "message.received" })).toBeNull();
  });
  it("plateforme prise dans le commentaire si le compte n'en porte pas", () => {
    const e = env("x", { platform: "TikTok" }, { account: { accountId: "acc_1" } });
    expect(lireCommentaireManuel(e)?.reseau).toBe("tiktok");
  });
  it("URN LinkedIn : repère = li_ + empreinte, jamais l'URN", () => {
    const r = lireCommentaireManuel(env("linkedin", { platformPostId: URN }))!;
    expect(r.repere).toBe("li_" + createHash("sha256").update(URN).digest("base64url").slice(0, 22));
    expect(r.repere).toHaveLength(25);
    expect(JSON.stringify(r)).not.toContain("urn:li");
  });
  it("identifiants mal formés : null", () => {
    expect(lireCommentaireManuel(env("linkedin", { platformPostId: "urn:li:activity" }))).toBeNull();
    expect(lireCommentaireManuel(env("linkedin", { platformPostId: "urn:li:activity:a b" }))).toBeNull();
    expect(lireCommentaireManuel(env("linkedin", { platformPostId: "a".repeat(129) }))).toBeNull();
    expect(lireCommentaireManuel(env("linkedin", { id: "com 1" }))).toBeNull();
    expect(lireCommentaireManuel(env("linkedin", { id: undefined }))).toBeNull();
    expect(lireCommentaireManuel(env("linkedin", { author: { id: "x@y.fr" } }))).toBeNull();
    expect(lireCommentaireManuel(env("linkedin", {}, { account: { accountId: "a/b", platform: "linkedin" } }))).toBeNull();
  });
  it("lien : https et hôtes permis seulement, sans identifiants", () => {
    const l = (u: string) => lireCommentaireManuel(env("linkedin", { postUrl: u }))!.lienPost;
    expect(l("https://www.linkedin.com/posts/exemple-1")).toBe("https://www.linkedin.com/posts/exemple-1");
    expect(l("https://tiktok.com/@x/video/1")).not.toBeNull();
    expect(l("http://www.linkedin.com/posts/1")).toBeNull();
    expect(l("https://evil.example.com/linkedin.com")).toBeNull();
    expect(l("https://www.linkedin.com.evil.example/p")).toBeNull();
    expect(l("https://user:mdp@www.linkedin.com/p")).toBeNull();
    expect(l("pas un lien")).toBeNull();
    expect(l("https://www.linkedin.com/posts/exemple-1?token=secret&u=1#frag")).toBe("https://www.linkedin.com/posts/exemple-1");
  });
  it("texte long : motSeul null ; phrase quelconque : null", () => {
    expect(lireCommentaireManuel(env("tiktok", { text: "GUIDE " + "a".repeat(300) }))!.motSeul).toBeNull();
    expect(lireCommentaireManuel(env("tiktok", { text: "je veux le guide merci beaucoup" }), ["GUIDE"])!.motSeul).toBeNull();
  });
  it("opposition : forme canonique ; notre propre commentaire : proprio, motSeul null", () => {
    expect(lireCommentaireManuel(env("linkedin", { text: "Stop, merci" }))!.motSeul).toBe("STOP");
    const p = lireCommentaireManuel(env("linkedin", { author: { id: "x", isOwnAccount: true } }))!;
    expect(p).toMatchObject({ proprio: true, motSeul: null, idAuteur: "acc_1" });
    expect(lireCommentaireManuel(env("linkedin", { author: { id: "acc_1" } }))!.proprio).toBe(true);
    const e = env("linkedin", { author: { id: "plat_9" } }, { account: { accountId: "acc_1", platformAccountId: "plat_9", platform: "linkedin" } });
    expect(lireCommentaireManuel(e)).toMatchObject({ proprio: true, motSeul: null, idAuteur: "acc_1" });
  });
  it("aucun champ texte brut dans le résultat", () => {
    const texte = "Mon adresse lecteur@example.com GUIDE";
    const r = lireCommentaireManuel(env("tiktok", { text: texte, author: { id: "a_1", name: "Pseudo Fictif" } }))!;
    const s = JSON.stringify(r);
    expect(s).not.toContain("lecteur@example.com");
    expect(s).not.toContain("Pseudo");
    expect(Object.keys(r).sort()).toEqual(["estReponse", "idAuteur", "idCommentaire", "idCompte", "lienPost", "motSeul", "proprio", "repere", "reseau"]);
    expect(lireCommentaireManuel(env("tiktok", { text: "GUIDE" }))!.motSeul).toBe("GUIDE");
  });
});
