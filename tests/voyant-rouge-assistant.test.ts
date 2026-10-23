/**
 * Voyant rouge dans l'assistant : le lancement entouré du second oui (lancer-avec-voyant). Serveur et fenêtre de
 * confirmation remplacés : on vérifie l'ordre des appels et qu'une seule question est posée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appels: { malgreVoyant?: boolean; scriptRelu?: string }[] = [];
let reponses: object[] = [];
vi.mock("@/app/(studio)/nouvelle/[format]/actions", () => ({
  lancerFabricationAction: async (_id: string, _c: unknown, scriptRelu: string | undefined, v: { malgreVoyant?: boolean }) => {
    appels.push({ ...v, scriptRelu });
    return reponses.shift();
  },
}));
const questions: string[] = [];
vi.mock("@/components/ui/ConfirmationPrix", () => ({ confirmerPrix: async (o: { message: string }) => (questions.push(o.message), 1) }));

const { lancerAvecVoyant } = await import("@/assistant/etapes/lancer-avec-voyant");
const { entreesAvecOrigine } = await import("@/domaine/voyant-rouge");
const rouge = { ok: false, code: "VOYANT_ROUGE", message: "La version A a une note de 60 sur 100. Voulez-vous quand même lancer la voix ? Elle est payante." };
const prix = { ok: false, code: "CONFIRMATION_REQUISE", message: "Plus cher que d'habitude", montant: 120 };
const ok = { ok: true, donnees: { travailId: "t", versionId: "v" } };

beforeEach(() => {
  appels.length = 0;
  questions.length = 0;
});

describe("lancement de l'assistant avec le second oui du voyant", () => {
  it("version rouge : une question avec la vraie raison, puis le lancement avec la confirmation", async () => {
    reponses = [rouge, ok];
    const r = await lancerAvecVoyant("v-03", true, "emp", { current: false });
    expect(r.ok).toBe(true);
    expect(questions).toEqual([rouge.message]);
    expect(appels).toEqual([
      { malgreVoyant: false, scriptRelu: "emp" },
      { malgreVoyant: true, scriptRelu: "emp" },
    ]);
  });
  it("oui au voyant puis nouvelle confirmation du prix (relance de la relecture) : une seule question voyant", async () => {
    reponses = [rouge, prix, ok];
    const oui = { current: false };
    const r1 = await lancerAvecVoyant("v-03", true, "emp", oui);
    expect(r1).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const r2 = await lancerAvecVoyant("v-03", 120, "emp", oui);
    expect(r2.ok).toBe(true);
    expect(questions).toHaveLength(1);
    expect(appels.map((a) => a.malgreVoyant)).toEqual([false, true, true]);
  });
  it("rien à confirmer : un seul appel, aucune question", async () => {
    reponses = [ok];
    await lancerAvecVoyant("v-03", true, undefined, { current: false });
    expect(questions).toHaveLength(0);
    expect(appels).toHaveLength(1);
  });
});

describe("version d'origine gardée avec le brouillon (entrees de la vidéo)", () => {
  it("elle s'ajoute aux entrées existantes et s'efface quand un autre texte est choisi ou collé", () => {
    const avec = entreesAvecOrigine({ autre: 1 }, "var-1");
    expect(avec).toEqual({ autre: 1, varianteOrigineId: "var-1" });
    expect(entreesAvecOrigine(avec)).toEqual({ autre: 1 });
    expect(entreesAvecOrigine(undefined)).toEqual({});
  });
});

describe("texte collé par Will dans l'assistant : la version d'origine est effacée (pas de question voyant)", () => {
  // Pas de rendu de composant ici (aucune bibliothèque DOM dans le projet) : on lit la source de chaque zone « Coller ».
  it("chaque ZoneColler de l'assistant efface la version d'origine dans son onBlocs", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const dossier = "src/assistant/etapes";
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".tsx"));
    let zones = 0;
    for (const f of fichiers) {
      const src = readFileSync(`${dossier}/${f}`, "utf8");
      for (const m of src.matchAll(/<ZoneColler\b[\s\S]*?(?=<\/|\/>\s*\n|\)\s*\}\s*\/>)/g)) {
        zones++;
        expect(`${f}: ${m[0].includes("entreesAvecOrigine(brouillon.entrees)")}`).toBe(`${f}: true`);
      }
    }
    expect(zones).toBeGreaterThanOrEqual(2);
  });
});
