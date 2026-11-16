/** PR A · doute d'opposition en commentaire : lecture PURE sans contenu (Facebook/Instagram, LinkedIn/TikTok). Données fictives, aucun réseau. */
import { describe, expect, it } from "vitest";
import { lireEvenementCommentaire, type EnveloppeZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { lireCommentaireManuel } from "@/domaine/guide-reseau/commentaire-manuel";

const env = (plateforme: string, c: object = {}): EnveloppeZernio => ({
  id: "evt_1", event: "comment.received", timestampSec: 1_760_781_600,
  racine: { account: { accountId: "acc_1", platform: plateforme }, comment: { id: "com_1", platformPostId: "post_1", text: "GUIDE", author: { id: "auteur_1" }, ...c } },
});
const LONG = "bonjour " + "x".repeat(100) + " stop " + "y".repeat(140);
const DOUTES = ["stop pls", "stop thx", "stop GUIDE", "stop it", "stop please GUIDE", "ne stoppez pas", LONG];
const PAS_DOUTE = ["STOP", "stop merci", "GUIDE", "bonjour", "bonjour " + "z".repeat(242)];

const lecteurs = [
  ["facebook", (p: string, t: string, c: object = {}) => lireEvenementCommentaire(env(p, { text: t, ...c }), ["GUIDE"])],
  ["instagram", (p: string, t: string, c: object = {}) => lireEvenementCommentaire(env(p, { text: t, ...c }), ["GUIDE"])],
  ["linkedin", (p: string, t: string, c: object = {}) => lireCommentaireManuel(env(p, { text: t, ...c }), ["GUIDE"])],
  ["tiktok", (p: string, t: string, c: object = {}) => lireCommentaireManuel(env(p, { text: t, ...c }), ["GUIDE"])],
] as const;

describe.each(lecteurs)("doute en commentaire · %s", (reseau, lire) => {
  it.each(DOUTES)("A1/A6 doute : %s", (t) => {
    const ev = lire(reseau, t)!;
    expect(ev.motSeul).toBeNull();
    expect((ev as { doute?: true }).doute).toBe(true);
  });
  it.each(PAS_DOUTE)("A2/A6 pas de doute : %s", (t) => {
    const ev = lire(reseau, t)!;
    expect("doute" in ev).toBe(false);
  });
  it("A3 notre compte + « stop pls » : pas de doute", () => {
    const ev = lire(reseau, "stop pls", { author: { id: "acc_1" } })!;
    expect("doute" in ev).toBe(false);
    const ev2 = lire(reseau, "stop pls", { author: { id: "x", isOwnAccount: true } })!;
    expect("doute" in ev2).toBe(false);
  });
  it("A4 aucun texte ni extrait dans la charge", () => {
    for (const t of ["stop pls", "stop thx", "stop it", "stop GUIDE", LONG]) {
      const s = JSON.stringify(lire(reseau, t));
      for (const m of ["PLS", "THX", "pls", "thx", "stop", "STOP", "xxxx", "yyyy"]) expect(s).not.toContain(m);
      expect(s).not.toContain(t);
      expect(s).not.toMatch(/\bIT\b/i);
    }
  });
  it("A5 exclusivité : un mot seul n'est jamais un doute", () => {
    for (const t of ["STOP", "stop", "Stop, merci", "arrêtez", "arretez svp", "désinscrire", "GUIDE", "guide merci", "unsubscribe", "stop stop", "stoppez", "ne stoppez pas", "stop pls", "stop GUIDE"]) {
      const ev = lire(reseau, t)!;
      if (ev.motSeul !== null) expect("doute" in ev).toBe(false);
    }
  });
  it("sans doute : la charge garde exactement ses clés d'avant", () => {
    expect(Object.keys(lire(reseau, "GUIDE")!)).not.toContain("doute");
    expect(Object.keys(lire(reseau, "bonjour")!)).not.toContain("doute");
  });
});
