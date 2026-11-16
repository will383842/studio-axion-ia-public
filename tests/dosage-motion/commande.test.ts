/**
 * X3-03 : le dosage de l'animation figé dans la commande. Tout éteint : commande ET prix identiques.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { avecDosageMotion } = await import("@/services/dosage-motion");
const { appliquerDosage } = await import("@/briques/dosage-motion/commande");
const { NIVEAU_DU_DOSAGE } = await import("@/briques/dosage-motion/crans");
const { moteurDeCommande } = await import("@/moteurs");

import type { CommandeFabrication } from "@/domaine/types";

const MDP = "dosage-commande";
// Avocat (vraie vidéo v-03) + copies de v-03 sur d'autres formats (seuls l'avocat et le podcast ont un texte de démo).
const FORMATS_TESTES = ["avocat", "facecam", "cas-concret", "tableau-anime", "facecam-animee", "motion"];
const VIDEOS = FORMATS_TESTES.map((f) => `t-${f}`);

async function semerVideosParFormat() {
  const v = (await depots().videos.obtenir("v-03"))!;
  const s = (await depots().scripts.obtenir(v.scriptId!))!;
  for (const f of FORMATS_TESTES) {
    await depots().scripts.enregistrer({ ...s, id: `ts-${f}`, formatId: f });
    await depots().videos.enregistrer({ ...v, id: `t-${f}`, formatId: f, scriptId: `ts-${f}` });
  }
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await semerVideosParFormat();
  // Moteur réel de l'avocat (et non la simulation) : le prix comparé est celui du vrai montage.
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

const commandeSimple = (extra: Partial<CommandeFabrication> = {}) =>
  ({ moteurId: "montage-avocat", intensite: { niveau: "equilibre", bruitages: "aucun" }, sousTitres: { base: "karaoke", intensite: "equilibre" }, ...extra }) as unknown as CommandeFabrication;

async function poserChoix(videoId: string, cran: string) {
  const v = await depots().videos.obtenir(videoId);
  await depots().videos.enregistrer({ ...v!, styles: { ...v!.styles, dosageMotion: cran as never } });
}

describe("X3-03 · éteint = identique", () => {
  it("interrupteur absent : même objet rendu, aucune clé dosageMotion", async () => {
    const c = commandeSimple();
    const v = (await depots().videos.obtenir("v-03"))!;
    expect(await avecDosageMotion(v, c)).toBe(c);
    expect("dosageMotion" in c).toBe(false);
  });

  it("interrupteur à autre chose que true : même objet", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    for (const val of ["true", 1, "oui", false]) {
      await ecrireParametre("dosageMotion.actif", val);
      const c = commandeSimple();
      expect(await avecDosageMotion(v, c)).toBe(c);
    }
  });

  it("sur 5 formats (avocat compris), lancement et estimation : commande et prix identiques à l'interrupteur explicitement éteint", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-16T10:00:00Z"), toFake: ["Date"] });
    try {
      const avant: Record<string, unknown> = {};
      for (const id of VIDEOS) {
        const v = (await depots().videos.obtenir(id))!;
        const script = (await depots().scripts.obtenir(v.scriptId!))!;
        const c = await fabrication.construireCommande(id);
        expect("dosageMotion" in c).toBe(false);
        const e = await fabrication.construireCommandeEstimation(v, script);
        avant[id] = { c, e, prix: await moteurDeCommande(c).estimer(c), prixE: await moteurDeCommande(e).estimer(e) };
      }
      await ecrireParametre("dosageMotion.actif", false);
      for (const id of VIDEOS) {
        const v = (await depots().videos.obtenir(id))!;
        const script = (await depots().scripts.obtenir(v.scriptId!))!;
        const c = await fabrication.construireCommande(id);
        const e = await fabrication.construireCommandeEstimation(v, script);
        const apres = { c, e, prix: await moteurDeCommande(c).estimer(c), prixE: await moteurDeCommande(e).estimer(e) };
        expect(apres).toStrictEqual(avant[id]);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("lecture du réglage qui lève une erreur : commande rendue par référence", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const spy = vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("lecture"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = commandeSimple();
    expect(await avecDosageMotion(v, c)).toBe(c);
    spy.mockRestore();
    warn.mockRestore();
  });
});

describe("X3-03 · allumé", () => {
  // Le moteur d'une commande est figé au lancement ; hors essai on pose celui du format (réglage `moteur.<format>`).
  beforeEach(async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
  });

  it("moteur de simulation : commande rendue telle quelle", async () => {
    await ecrireParametre("moteur.avocat", "simulation");
    await ecrireParametre("dosageMotion.actif", true);
    const c = await fabrication.construireCommande("v-03");
    expect("dosageMotion" in c).toBe(false);
  });

  it("avocat + choix « aucun » de la vidéo : intensité sobre, cran figé, choisiPar video", async () => {
    await ecrireParametre("dosageMotion.actif", true);
    await poserChoix("v-03", "aucun");
    const c = await fabrication.construireCommande("v-03");
    expect(c.dosageMotion).toEqual({ cran: "aucun", choisiPar: "video" });
    expect(c.intensite?.niveau).toBe("sobre");
    expect(c.sousTitres?.intensite).toBe("sobre");
  });

  it("sans choix : cran du défaut du générateur, choisiPar generateur", async () => {
    await ecrireParametre("dosageMotion.actif", true);
    await ecrireParametre("dosageMotion.defauts", { avocat: "sobre" });
    const c = await fabrication.construireCommande("v-03");
    expect(c.dosageMotion).toEqual({ cran: "sobre", choisiPar: "generateur" });
    expect(c.intensite?.niveau).toBe("sobre");
  });

  it("estimation et lancement donnent le même cran et la même intensité", async () => {
    await ecrireParametre("dosageMotion.actif", true);
    await poserChoix("v-03", "dynamique");
    const v = (await depots().videos.obtenir("v-03"))!;
    const script = (await depots().scripts.obtenir(v.scriptId!))!;
    const c = await fabrication.construireCommande("v-03");
    const e = await fabrication.construireCommandeEstimation(v, script);
    expect(e.dosageMotion).toEqual(c.dosageMotion);
    expect(e.intensite).toEqual(c.intensite);
    expect(c.intensite?.niveau).toBe(NIVEAU_DU_DOSAGE.dynamique);
  });

  it("v4 (facecam-animee) : dynamique, intensité et sous-titres inchangés", () => {
    const c = commandeSimple({ moteurId: "montage-facecam-animee" } as never);
    const r = appliquerDosage(c, { cran: "dynamique", choisiPar: "generateur", v4: true });
    expect(r.dosageMotion).toEqual({ cran: "dynamique", choisiPar: "generateur" });
    expect(r.intensite).toBe(c.intensite);
    expect(r.sousTitres).toBe(c.sousTitres);
  });

  it("R3 · avocat en montage-avocat, lancement ET estimation : equilibre = prix éteint ligne par ligne ; autres crans ≤ éteint", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const script = (await depots().scripts.obtenir(v.scriptId!))!;
    const eteintL = await fabrication.construireCommande("v-03");
    const eteintE = await fabrication.construireCommandeEstimation(v, script);
    expect(eteintL.moteurId).toBe("montage-avocat");
    const prixL0 = await moteurDeCommande(eteintL).estimer(eteintL);
    const prixE0 = await moteurDeCommande(eteintE).estimer(eteintE);
    await ecrireParametre("dosageMotion.actif", true);
    for (const cran of ["aucun", "sobre", "equilibre", "dynamique"]) {
      await poserChoix("v-03", cran);
      const vv = (await depots().videos.obtenir("v-03"))!;
      const l = await fabrication.construireCommande("v-03");
      const e = await fabrication.construireCommandeEstimation(vv, script);
      expect(l.dosageMotion?.cran).toBe(cran);
      const prixL = await moteurDeCommande(l).estimer(l);
      const prixE = await moteurDeCommande(e).estimer(e);
      if (cran === "equilibre") {
        expect(prixL.lignes).toStrictEqual(prixL0.lignes);
        expect(prixL.total).toStrictEqual(prixL0.total);
        expect(prixE.lignes).toStrictEqual(prixE0.lignes);
        expect(prixE.total).toStrictEqual(prixE0.total);
      }
      expect(prixL.total.centimes).toBeLessThanOrEqual(prixL0.total.centimes);
      expect(prixE.total.centimes).toBeLessThanOrEqual(prixE0.total.centimes);
    }
  });

  it("v4 par le service (facecam-animee) : choix sobre posé, cran dynamique, intensité et sous-titres identiques à l'éteint", async () => {
    const eteint = await fabrication.construireCommande("t-facecam-animee");
    await ecrireParametre("dosageMotion.actif", true);
    await poserChoix("t-facecam-animee", "sobre");
    const c = await fabrication.construireCommande("t-facecam-animee");
    expect(c.dosageMotion?.cran).toBe("dynamique");
    expect(c.intensite).toStrictEqual(eteint.intensite);
    expect(c.sousTitres).toStrictEqual(eteint.sousTitres);
  });

  it("appliquerDosage : nouvelle commande, l'entrée n'est pas modifiée, sous-titres gardés non nuls", () => {
    const c = commandeSimple();
    const copie = structuredClone(c);
    const r = appliquerDosage(c, { cran: "sobre", choisiPar: "video" });
    expect(c).toStrictEqual(copie);
    expect(r).not.toBe(c);
    expect(r.sousTitres).toEqual({ base: "karaoke", intensite: "sobre" });
    expect(r.intensite).toEqual({ niveau: "sobre", bruitages: "aucun" });
  });

  it("appliquerDosage qui lève une erreur : commande rendue par référence", async () => {
    await ecrireParametre("dosageMotion.actif", true);
    const v = (await depots().videos.obtenir("v-03"))!;
    const c = new Proxy(commandeSimple(), { ownKeys() { throw new Error("boom"); } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await avecDosageMotion(v, c)).toBe(c);
    warn.mockRestore();
  });

  it("une retouche relit la commande figée : le cran reste celui du lancement", async () => {
    await ecrireParametre("dosageMotion.actif", true);
    await poserChoix("v-03", "sobre");
    const c = await fabrication.construireCommande("v-03");
    await ecrireParametre("dosageMotion.actif", false);
    expect(structuredClone(c).dosageMotion).toEqual({ cran: "sobre", choisiPar: "video" });
  });
});

describe("X3-03 · gardes statiques", () => {
  const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("le service n'importe pas fabrication ; la brique n'importe aucun service ni moteur ni argent", () => {
    expect(lire("src/services/dosage-motion.ts")).not.toMatch(/from\s+["']\.\/fabrication["']/);
    const b = lire("src/briques/dosage-motion/commande.ts");
    expect(b).not.toMatch(/from\s+["']@\/(services|moteurs)/);
    expect(b).not.toMatch(/studio-rendu|credits|Math\.random|Date\./);
  });
  it("fabrication.ts : exactement 1 import ajouté et 2 lignes modifiées", () => {
    const f = lire("src/services/fabrication.ts");
    expect(f.match(/avecDosageMotion/g)?.length).toBe(3);
  });
});
