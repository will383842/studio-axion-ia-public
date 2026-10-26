/**
 * Zéro blocage (mise en scène, rendu, livraison) : chaque refus devient une réparation automatique et une remarque.
 * Seul un rendu vraiment impossible (ErreurRenduDefinitifIV) arrête encore la fabrication.
 */
import { describe, expect, it, vi } from "vitest";
import { avancerIV, attendWillIV, avancerJusquAArretIV, ErreurRenduDefinitifIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import type { EntreeMiseEnSceneIV, ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const mode = vi.hoisted(() => ({ v: "normal" as "normal" | "refus-sauf-texte-seul" | "refus-toujours" | "refus-detail-toujours" | "panne-sauf-texte-seul" }));

vi.mock("@/moteurs/montage-image-video/mise-en-scene", async (orig) => {
  const reel = await orig<typeof import("@/moteurs/montage-image-video/mise-en-scene")>();
  return {
    ...reel,
    mettreEnSceneIV: (entree: EntreeMiseEnSceneIV): ResultatMiseEnSceneIV => {
      const complexe = entree.fiche.ecrans.some((e) => e.scene !== "titre");
      if (mode.v === "panne-sauf-texte-seul" && complexe) throw new Error("panne factice");
      const r = reel.mettreEnSceneIV(entree);
      const refuse = mode.v === "refus-toujours" || mode.v === "refus-detail-toujours" || (mode.v === "refus-sauf-texte-seul" && complexe);
      // Codes réels : Q16 n'est pas une ligne que le filet laisse passer ; Q12 en est une.
      const code = mode.v === "refus-detail-toujours" ? "Q12" : "Q16";
      return refuse ? { ...r, ok: false, rapport: { ...r.rapport, bloquants: [{ code, phrase: "refus factice" } as never] }, phrases: ["refus factice"] } : r;
    },
  };
});

async function prete(formats: Record<string, unknown> = {}): Promise<{ fini: EtatFabricationIV; o: OutilsFabricationIV }> {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { formats } as never)), o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    else break;
  }
  expect(e.etape).toBe("prete");
  return { fini: e, o };
}

const depuis = (fini: EtatFabricationIV, etape: "mise-en-scene" | "rendu"): EtatFabricationIV => {
  const e = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
  e.etape = etape;
  delete e.refus;
  delete e.scenes;
  delete e.ecransAdaptes;
  delete e.rendus;
  delete e.controles;
  delete e.livraison;
  return e;
};

describe("mise en scène : jamais d'arrêt sur un refus", () => {
  it("refus → composition plus simple (texte seul) + remarque, la fabrication continue", async () => {
    const { fini, o } = await prete();
    mode.v = "refus-sauf-texte-seul";
    const e = await avancerIV(depuis(fini, "mise-en-scene"), o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.refus).toBeUndefined();
    expect(e.journal.some((j) => j.startsWith("Remarque · mise en scène") && j.includes("texte seul"))).toBe(true);
    expect(Object.values(e.ecransAdaptes ?? {}).flat().length).toBeGreaterThan(0);
  });

  it("panne de la mise en scène → composition plus simple, pas d'IV_PANNE", async () => {
    const { fini, o } = await prete();
    mode.v = "panne-sauf-texte-seul";
    const e = await avancerIV(depuis(fini, "mise-en-scene"), o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.journal.some((j) => j.includes("panne factice"))).toBe(true);
  });

  it("refus d'une autre nature même en texte seul → jamais effacé, IV_MISE_EN_SCENE", async () => {
    const { fini, o } = await prete();
    mode.v = "refus-toujours";
    const e = await avancerIV({ ...depuis(fini, "mise-en-scene"), scenes: fini.scenes }, o);
    mode.v = "normal";
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_MISE_EN_SCENE");
    expect(e.refus?.message).toContain("refus factice");
  });

  it("défaut de détail seul même en texte seul → composition simple, remarque, la fabrication continue", async () => {
    const { fini, o } = await prete();
    mode.v = "refus-detail-toujours";
    const e = await avancerIV(depuis(fini, "mise-en-scene"), o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.refus).toBeUndefined();
    expect(e.journal.some((j) => j.includes("défaut de détail gardé"))).toBe(true);
  });

  it("trajet réel : repli → rendu (composition de repli réellement rendue, chiffres gardés) → contrôles → livraison", async () => {
    const { fini, o } = await prete();
    const rendus: Parameters<OutilsFabricationIV["rendre"]>[0][] = [];
    const outils: OutilsFabricationIV = { ...o, rendre: async (d) => (rendus.push(d), o.rendre(d)) };
    mode.v = "refus-sauf-texte-seul";
    let e = await avancerIV(depuis(fini, "mise-en-scene"), outils);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    e = await avancerJusquAArretIV(e, outils);
    expect(e.etape).toBe("prete");
    expect(e.refus).toBeUndefined();
    expect(rendus.length).toBeGreaterThan(0);
    // Ce qui est réellement rendu : les écrans adaptés sont en texte seul dans la demande de rendu, et leurs chiffres y restent.
    const ecrans = Object.values(e.ecransAdaptes ?? {}).flat();
    expect(ecrans.length).toBeGreaterThan(0);
    for (const d of rendus) {
      const texte = JSON.stringify(d.ligne);
      const adaptes = e.ecransAdaptes?.[d.version] ?? [];
      const version = (e.script!.fiche.ecrans ?? []).filter((x) => adaptes.includes(x.id));
      for (const ecran of version) for (const chiffre of ecran.textesEcran.join(" ").match(/\d+/g) ?? []) expect(texte).toContain(chiffre);
    }
    expect(e.livraison!.some((l) => l.version !== "aucune" && l.fichierCle)).toBe(true);
  });
});

describe("rendu : une panne est refaite, seul l'impossible arrête", () => {
  it("panne passagère → refait une fois, remarque au journal", async () => {
    const { fini, o } = await prete();
    let appels = 0;
    const outils: OutilsFabricationIV = { ...o, rendre: async (d) => (++appels === 1 ? Promise.reject(new Error("serveur de rendu coupé")) : o.rendre(d)) };
    const e = await avancerIV(depuis(fini, "rendu"), outils);
    expect(e.refus).toBeUndefined();
    expect(appels).toBe(2);
    expect(e.journal.some((j) => j.includes("refait automatiquement une fois"))).toBe(true);
  });

  it("nouvel essai qui répond « rendu en cours » → l'essai est gardé, la remarque reste, la reprise demande le bon essai", async () => {
    const { fini, o } = await prete();
    const essais: number[] = [];
    const enCours = Object.assign(new Error("rendu en cours"), { enCours: true });
    const outils: OutilsFabricationIV = {
      ...o,
      rendre: async (d) => {
        essais.push(d.essai ?? 1);
        if (essais.length === 1) throw new Error("serveur de rendu coupé");
        if (essais.length === 2) throw enCours;
        return o.rendre(d);
      },
    };
    const attente = await avancerIV(depuis(fini, "rendu"), outils);
    expect(attente.attente).toBeTruthy();
    expect(attente.refus).toBeUndefined();
    expect(attente.tentatives.rendu).toBe(2);
    expect(attente.journal.some((j) => j.includes("refait automatiquement une fois"))).toBe(true);
    const suite = await avancerIV({ ...attente, attente: undefined }, outils);
    expect(essais[2]).toBe(2);
    expect(suite.refus).toBeUndefined();
  });

  it("second échec du rendu → IV_PANNE", async () => {
    const { fini, o } = await prete();
    let appels = 0;
    const outils: OutilsFabricationIV = { ...o, rendre: async () => Promise.reject(new Error(`coupé ${++appels}`)) };
    const e = await avancerIV(depuis(fini, "rendu"), outils);
    expect(appels).toBe(2);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_PANNE");
  });

  it("rendu vraiment impossible → IV_RENDU, non réessayable", async () => {
    const { fini, o } = await prete();
    const outils: OutilsFabricationIV = { ...o, rendre: async () => Promise.reject(new ErreurRenduDefinitifIV("Irrendable.", ["écran trop long"])) };
    const e = await avancerIV(depuis(fini, "rendu"), outils);
    expect(e.refus?.code).toBe("IV_RENDU");
    expect(e.refus?.reessayable).toBe(false);
  });
});

describe("livraison : un réseau sans fichier ne bloque pas les autres", () => {
  it("rend à nouveau une fois, puis livre les autres réseaux avec une remarque", async () => {
    const { fini, o } = await prete();
    const cible = fini.livraison!.find((l) => l.version !== "aucune")!.reseau;
    const base = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
    base.etape = "livraison";
    base.livraison = base.livraison!.map((l) => (l.reseau === cible ? { ...l, fichierCle: undefined } : l));
    // 1) premier passage : retour au rendu, une seule fois, avec un essai de rendu neuf.
    const retour = await avancerIV(base, o);
    expect(retour.etape).toBe("rendu");
    expect(retour.tentatives.livraison).toBe(2);
    expect(retour.tentatives.rendu).toBe((base.tentatives.rendu ?? 1) + 1);
    // 2) toujours sans fichier au second passage : les autres partent, le réseau est noté « aucune ».
    const encore = JSON.parse(JSON.stringify(base)) as EtatFabricationIV;
    encore.tentatives.livraison = 2;
    const e = await avancerIV(encore, o);
    expect(e.etape).toBe("prete");
    expect(e.refus).toBeUndefined();
    expect(e.livraison!.find((l) => l.reseau === cible)!.version).toBe("aucune");
    expect(e.livraison!.filter((l) => l.version !== "aucune").length).toBeGreaterThan(0);
    expect(e.journal.some((j) => j.startsWith("Remarque · aucun fichier"))).toBe(true);
  });

  it("tous les réseaux sans fichier au second passage → IV_RENDU, jamais une vidéo prête à 0 réseau", async () => {
    const { fini, o } = await prete();
    const base = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
    base.etape = "livraison";
    base.tentatives.livraison = 2;
    base.livraison = base.livraison!.map((l) => ({ ...l, fichierCle: undefined }));
    const e = await avancerIV(base, o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_RENDU");
    expect(e.refus?.reessayable).toBe(true);
  });

  it("seul le fil Facebook 4:5 manque → le Reel 9:16 est livré avec une remarque", async () => {
    const { fini, o } = await prete({ facebook: ["9:16", "4:5"] });
    const fb = fini.livraison!.find((l) => l.reseau === "facebook" && l.version !== "aucune" && l.fichierCleFil);
    expect(fb).toBeTruthy();
    const base = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
    base.etape = "livraison";
    base.livraison = base.livraison!.map((l) => (l.reseau === "facebook" ? { ...l, fichierCleFil: undefined } : l));
    const e = await avancerIV(base, o);
    expect(e.etape).toBe("prete");
    const l = e.livraison!.find((x) => x.reseau === "facebook")!;
    expect(l.version).not.toBe("aucune");
    expect(l.fichierCle).toBeTruthy();
    expect(l.mention).toContain("fil 4:5");
  });

  it("refus IV_RENDU tous réseaux → la reprise repart du rendu, rendus vidés, livraison effacée", async () => {
    const { fini, o } = await prete();
    const base = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
    base.etape = "livraison";
    base.tentatives.livraison = 2;
    base.livraison = base.livraison!.map((l) => ({ ...l, fichierCle: undefined }));
    const refuse = await avancerIV(base, o);
    expect(refuse.refus?.code).toBe("IV_RENDU");
    const avant = refuse.tentatives.rendu ?? 1;
    const repris = reprendreIV(refuse);
    expect(repris.etape).toBe("rendu");
    expect(repris.refus).toBeUndefined();
    expect(repris.rendus).toBeUndefined();
    expect(repris.livraison).toBeUndefined();
    expect(repris.tentatives.rendu).toBe(avant + 1);
    expect(repris.tentatives.livraison).toBeUndefined();
  });
});
