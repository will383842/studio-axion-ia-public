/** Aiguillage d'un mot commenté : mot inconnu → GUIDE (si configuré, sinon « À traiter » sans envoi) ; personne opposée → silence ; LinkedIn/TikTok : réponse publique seule. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { decisionPourMot } = await import("@/domaine/guide-reseau/decision-mot");
const A = await import("@/services/a-traiter");

const LISTE = ["GUIDE"] as const;
describe("decisionPourMot (pur)", () => {
  it("mot connu : réponse publique ; message privé seulement Instagram/Facebook en canal privé", () => {
    expect(decisionPourMot({ mot: "guide", reseau: "instagram", canal: "commentaire", mots: LISTE })).toEqual({ action: "reponse_publique", motRetenu: "GUIDE" });
    expect(decisionPourMot({ mot: "GUIDE", reseau: "facebook", canal: "message_prive", mots: LISTE })).toEqual({ action: "message_prive", motRetenu: "GUIDE" });
  });
  it("LinkedIn et TikTok : jamais de message privé, même demandé", () => {
    for (const reseau of ["linkedin_page", "tiktok"] as const) expect(decisionPourMot({ mot: "GUIDE", reseau, canal: "message_prive", mots: LISTE })).toEqual({ action: "reponse_publique", motRetenu: "GUIDE" });
  });
  it("mot inconnu, absent, ou liste illisible/vide/sans GUIDE : À traiter, jamais d'envoi", () => {
    for (const mots of [["DEVIS"], null, []] as const) {
      expect(decisionPourMot({ mot: "AUTRE", reseau: "instagram", canal: "message_prive", mots })).toEqual({ action: "a_traiter", motif: "mot_inconnu" });
    }
    expect(decisionPourMot({ mot: null, reseau: "instagram", canal: "commentaire", mots: ["DEVIS"] })).toEqual({ action: "a_traiter", motif: "mot_inconnu" });
    expect(decisionPourMot({ mot: "GUIDE", reseau: "tiktok", canal: "commentaire", mots: null })).toEqual({ action: "a_traiter", motif: "mot_inconnu" });
  });
});

describe("orienterCommentaire (service)", () => {
  const entree = { idEvenement: "ev-a1", post: "post-1", commentaire: "AUTRE", reseau: "instagram" as const, canal: "commentaire" as const };
  it("drapeau absent : inerte, rien d'écrit, aucune lecture de liste", async () => {
    const depot = A.creerDepotMemoire();
    const lecteur = vi.fn(async () => LISTE);
    const r = await A.orienterCommentaire({ ...entree, mot: "AUTRE" }, { env: {}, depot, lireMots: lecteur });
    expect(r).toEqual({ issue: "simule", raison: "interrupteur_eteint" });
    expect(await depot.lire()).toEqual([]);
    expect(lecteur).not.toHaveBeenCalled();
  });
  it("drapeau allumé, mot inconnu : carte « mot_inconnu », aucune action d'envoi", async () => {
    const depot = A.creerDepotMemoire();
    const r = await A.orienterCommentaire({ ...entree, mot: "AUTRE" }, { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => ["DEVIS"] });
    expect(r).toEqual({ issue: "execute", action: "a_traiter", raison: "ajoute" });
    const cartes = await depot.lire();
    expect(cartes).toHaveLength(1);
    expect(cartes[0].motif).toBe("mot_inconnu");
  });
  it("liste illisible (exception) : traité comme mot inconnu", async () => {
    const depot = A.creerDepotMemoire();
    const r = await A.orienterCommentaire({ ...entree, mot: "GUIDE" }, { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => { throw new Error("x"); } });
    expect(r.issue === "execute" && r.action).toBe("a_traiter");
  });
  it("mot connu : décision seulement, rien dans la file, rien envoyé", async () => {
    const depot = A.creerDepotMemoire();
    const r = await A.orienterCommentaire({ ...entree, mot: "GUIDE" }, { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => LISTE });
    expect(r).toEqual({ issue: "execute", action: "reponse_publique", raison: "mot_connu", motRetenu: "GUIDE" });
    expect(await depot.lire()).toEqual([]);
  });
});
