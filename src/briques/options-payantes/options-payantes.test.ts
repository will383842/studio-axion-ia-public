/**
 * LOT J — brique « options payantes » (PUR) : devis, carte, confirmation à usage unique (24 h), plafond prioritaire,
 * garde des fournisseurs réels, détection des demandes au monteur. Aucun réseau.
 */
import { describe, expect, it, vi } from "vitest";
import type { FournisseurHiggsfield } from "@/fournisseurs/higgsfield/types";
import { doubleSimulationMulticamera, type FournisseurMulticamera } from "@/fournisseurs/multicamera";
import {
  MESSAGE_OPTION_RETIREE,
  optionRetiree,
  annuler,
  avecAccord,
  confirmer,
  consommer,
  demanderConfirmation,
  ErreurOptionNonConfirmee,
  estimerOption,
  garderHiggsfield,
  garderMulticamera,
  lireEntreesOptions,
  montantEnvironEuros,
  optionDemandeePourVersion,
  optionsPayantesDemandees,
  phraseCarte,
  ranger,
  VALIDITE_CONFIRMATION_MS,
  verifier,
  vueCarte,
  type DemandeConfirmation,
  type GardeOptionPayante,
} from ".";

const T0 = new Date("2026-10-09T10:00:00.000Z");
const JETON = "a".repeat(64);
const ctx = { videoId: "v-1", versionId: "ver-1", dureeSec: 60 };

function demande(o: Partial<Parameters<typeof demanderConfirmation>[2]> = {}): DemandeConfirmation {
  // Vérif V4 : le Décor IA est retiré ; l'option Higgsfield de référence devient « effets main ultra réalistes » (même devis).
  const r = demanderConfirmation("effets-main-ultra", ctx, { maintenant: T0, jeton: JETON, origine: "fabrication", restantDuMoisCentimes: 10_000, ...o });
  if (r.statut !== "a-confirmer") throw new Error("plafond inattendu");
  return r.demande;
}
const presente = (extra: Partial<{ optionId: DemandeConfirmation["optionId"]; videoId: string; versionId: string; jeton: string }> = {}) => ({ optionId: "effets-main-ultra" as const, videoId: "v-1", versionId: "ver-2", jeton: JETON, ...extra });

describe("lot J · devis et carte", () => {
  it("Higgsfield : crédits du devis × prix du crédit réglable ; HeyGen : devis du double par angle", () => {
    // Kling : 2 crédits/s → 60 s = 120 crédits × 5 c = 6 €.
    expect(estimerOption("decor-ia", ctx)).toBe(600);
    expect(estimerOption("decor-ia", ctx, { prixCreditHiggsfieldCentimes: 8, tauxUsdEur: 0.9 })).toBe(960);
    expect(estimerOption("decor-ia", { ...ctx, modele: "flux_3_video_edit" })).toBe(300);
    expect(estimerOption("effets-main-ultra", { ...ctx, passagesSec: [2.2, 3] })).toBe((6 + 6) * 5);
    // HeyGen : 2 angles × 60 s × 7 c$ × 0,9.
    expect(estimerOption("multicamera-facecam", ctx)).toBe(756);
    expect(estimerOption("multicamera-avocat", { ...ctx, angles: 1 })).toBe(378);
  });

  it("phrase de la carte : « Option payante — environ X € pris sur vos crédits <outil>. »", () => {
    expect(phraseCarte({ montantCentimes: 600, outil: "higgsfield" })).toBe("Option payante — environ 6 € pris sur vos crédits Higgsfield.");
    expect(phraseCarte({ montantCentimes: 756, outil: "heygen" })).toBe("Option payante — environ 8 € pris sur vos crédits HeyGen.");
    expect(montantEnvironEuros(40)).toBe("moins de 1 €");
    expect(vueCarte(demande())).toMatchObject({ etat: "en-attente", libelle: "Effets main ultra réalistes", phrase: "Option payante — environ 6 € pris sur vos crédits Higgsfield." });
  });
});

describe("lot J · confirmation", () => {
  it("plafond prioritaire : estimation au-delà du restant du mois → aucune carte, version gratuite", () => {
    const r = demanderConfirmation("effets-main-ultra", ctx, { maintenant: T0, jeton: JETON, origine: "monteur", restantDuMoisCentimes: 599 });
    expect(r).toEqual({ statut: "plafond", message: expect.stringMatching(/Plafond du mois atteint.*version gratuite/) });
  });

  it("une seule réponse ; mauvais jeton refusé ; expirée après 24 h", () => {
    const d = demande();
    expect(confirmer(d, "b".repeat(64), T0)).toEqual({ ok: false, raison: "jeton" });
    const c = confirmer(d, JETON, T0);
    expect(c.ok && c.demande.etat).toBe("confirmee");
    expect(c.ok && confirmer(c.demande, JETON, T0)).toEqual({ ok: false, raison: "deja-traitee" });
    expect(c.ok && annuler(c.demande, JETON, T0)).toEqual({ ok: false, raison: "deja-traitee" });
    const tard = new Date(T0.getTime() + VALIDITE_CONFIRMATION_MS);
    expect(confirmer(d, JETON, tard)).toEqual({ ok: false, raison: "expiree" });
    expect(ranger([d], tard)[0].etat).toBe("expiree");
  });

  it("usage unique : la confirmation est consommée une fois, pour CETTE option et CETTE vidéo, liée à la version", () => {
    const d = demande();
    expect(consommer(d, presente(), T0)).toEqual({ ok: false, raison: "non-confirmee" });
    const c = confirmer(d, JETON, T0);
    if (!c.ok) throw new Error();
    expect(verifier(c.demande, presente({ optionId: "multicamera-facecam" }), T0)).toEqual({ ok: false, raison: "autre-option" });
    expect(verifier(c.demande, presente({ videoId: "v-2" }), T0)).toEqual({ ok: false, raison: "autre-video" });
    const u = consommer(c.demande, presente(), T0);
    expect(u.ok && u.demande).toMatchObject({ etat: "utilisee", versionId: "ver-2" });
    expect(u.ok && consommer(u.demande, presente({ versionId: "ver-3" }), T0)).toEqual({ ok: false, raison: "deja-utilisee" });
    // Confirmée mais utilisée trop tard : expirée.
    expect(consommer(c.demande, presente(), new Date(T0.getTime() + VALIDITE_CONFIRMATION_MS + 1))).toEqual({ ok: false, raison: "expiree" });
  });

  it("vérif V4 : liée à la version lancée par « Confirmer » ; une autre version qui recopie le jeton est refusée", () => {
    const c = confirmer(demande(), JETON, T0);
    if (!c.ok) throw new Error();
    const ciblee = { ...c.demande, versionCibleId: "ver-2" };
    expect(verifier(ciblee, presente({ versionId: "ver-copie" }), T0)).toEqual({ ok: false, raison: "autre-version" });
    expect(consommer(ciblee, presente(), T0).ok).toBe(true);
  });

  it("vérif V4 : Décor IA retiré — aucune carte, une ancienne carte ne se confirme pas, un ancien accord ne s'utilise pas", () => {
    expect(optionRetiree("decor-ia")).toBe(true);
    expect(demanderConfirmation("decor-ia", ctx, { maintenant: T0, jeton: JETON, origine: "fabrication", restantDuMoisCentimes: 100_000 })).toEqual({ statut: "coupee", message: MESSAGE_OPTION_RETIREE });
    const ancienne = { ...demande(), optionId: "decor-ia" as const, libelle: "Décor IA" };
    expect(confirmer(ancienne, JETON, T0)).toEqual({ ok: false, raison: "retiree" });
    expect(annuler(ancienne, JETON, T0).ok).toBe(true);
    const accord = { ...ancienne, etat: "confirmee" as const };
    expect(consommer(accord, presente({ optionId: "decor-ia" }), T0)).toEqual({ ok: false, raison: "retiree" });
    for (const id of ["effets-main-ultra", "multicamera-avocat", "multicamera-facecam", "effet-realiste-ia"] as const) expect(optionRetiree(id)).toBe(false);
  });

  it("annulée : jamais utilisable", () => {
    const a = annuler(demande(), JETON, T0);
    expect(a.ok && consommer(a.demande, presente(), T0)).toEqual({ ok: false, raison: "annulee" });
  });

  it("le jeton voyage dans les entrées de la version ; une entrée trafiquée est ignorée", () => {
    const e = avecAccord({ facecam: { x: 1 } }, "decor-ia", JETON);
    expect(lireEntreesOptions(e)).toEqual({ accords: { "decor-ia": JETON }, demandees: ["decor-ia"] });
    expect(optionDemandeePourVersion(e, "decor-ia")).toBe(true);
    expect(optionDemandeePourVersion(e, "multicamera-facecam")).toBe(false);
    expect(lireEntreesOptions({ optionsPayantes: { accords: { inconnue: JETON, "decor-ia": "court" }, demandees: ["x"] } })).toEqual({ accords: {}, demandees: [] });
  });
});

function higgsfieldReel(): FournisseurHiggsfield & { lancer: ReturnType<typeof vi.fn> } {
  return {
    id: "higgsfield",
    mode: "reel",
    lireSolde: async () => ({ ok: true, credits: 1000 }),
    envoyerMedia: async () => ({ ok: true, mediaId: "m" }),
    lancer: vi.fn(async () => ({ ok: true as const, idTravail: "t" })),
    suivre: async () => ({ statut: "en_file" }),
    telecharger: async () => ({ ok: true, octets: new Uint8Array() }),
  };
}
const garde = (ok: boolean): GardeOptionPayante & { appels: number } => {
  const g = { optionId: "decor-ia" as const, appels: 0, autoriser: async () => (g.appels++, ok) };
  return g;
};
const lancement = { modele: "kling_video_edit" as const, videoMediaId: "m", consigne: "c", dureeSec: 10, idempotence: "i" };

describe("lot J · garde des fournisseurs réels", () => {
  it("Higgsfield réel sans garde, ou garde qui refuse : aucun lancement (aucun crédit)", async () => {
    for (const g of [undefined, garde(false)]) {
      const f = higgsfieldReel();
      const r = await garderHiggsfield(f, g).lancer(lancement);
      expect(r.ok).toBe(false);
      expect(f.lancer).not.toHaveBeenCalled();
    }
  });

  it("Higgsfield réel confirmé : la confirmation est consommée UNE fois pour toute la passe", async () => {
    const f = higgsfieldReel();
    const g = garde(true);
    const gf = garderHiggsfield(f, g);
    for (let i = 0; i < 3; i++) expect((await gf.lancer(lancement)).ok).toBe(true);
    expect(f.lancer).toHaveBeenCalledTimes(3);
    expect(g.appels).toBe(1);
    expect(gf.mode).toBe("reel");
  });

  it("une garde qui plante vaut refus ; la simulation n'est pas enveloppée", async () => {
    const f = higgsfieldReel();
    const r = await garderHiggsfield(f, { optionId: "decor-ia", autoriser: async () => Promise.reject(new Error("panne")) }).lancer(lancement);
    expect(r.ok).toBe(false);
    const sim = { ...higgsfieldReel(), mode: "simulation" as const, id: "simulation" as const };
    expect(garderHiggsfield(sim, undefined)).toBe(sim);
  });

  it("multicaméra réelle sans confirmation : ni look ni rendu HeyGen", async () => {
    const appels: string[] = [];
    const reel: FournisseurMulticamera = { ...doubleSimulationMulticamera(), mode: "reel", preparerLook: async () => (appels.push("look"), { idExterne: "l" }), rendreAngle: async () => (appels.push("rendu"), { idTravailExterne: "r" }) };
    const g = garderMulticamera(reel, undefined);
    await expect(g.rendreAngle({} as never)).rejects.toBeInstanceOf(ErreurOptionNonConfirmee);
    await expect(g.preparerLook({ visageId: "v", angle: "cote" })).rejects.toBeInstanceOf(ErreurOptionNonConfirmee);
    expect(appels).toEqual([]);
    const ok = garderMulticamera(reel, garde(true));
    await ok.rendreAngle({} as never);
    expect(appels).toEqual(["rendu"]);
  });
});

describe("lot J · demandes au monteur", () => {
  it.each([
    ["Monteur, fais-le en 3 caméras", ["multicamera-facecam"]],
    ["change le décor : un bureau clair avec des plantes", ["decor-ia"]],
    ["remplace l'arrière-plan par une bibliothèque", ["decor-ia"]],
    ["fais l'effet de la main en ultra réaliste", ["effets-main-ultra"]],
    ["plus chaud, et un générique à la fin", []],
    ["garde mon décor, il est très bien", []],
    ["sans 3 caméras cette fois", []],
    ["pas d'ultra réaliste", []],
  ])("« %s »", (message, attendu) => {
    expect(optionsPayantesDemandees(message)).toEqual(attendu);
  });

  it("format avocat : la multicaméra est celle de l'avocat", () => {
    expect(optionsPayantesDemandees("en trois caméras", "avocat")).toEqual(["multicamera-avocat"]);
  });
});
