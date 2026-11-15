/**
 * L6-07 : le sujet garde la date visée et l'état de validation venus de l'usine. Un ancien sujet (sans ces champs) se charge,
 * l'état vaut « propose » par défaut. Aucun appel réel.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const sujet = await import("@/services/usine-sujet");
const { listerFormatsActifs } = await import("@/formats");
import type { IdeeUsine } from "@/domaine/usine";

const formatId = () => listerFormatsActifs()[0].id;
const idee = (signature: string): IdeeUsine => ({
  signature,
  parts: { metier: "plombier", douleur: "d12", actualite: null },
  metier: "Plombier",
  taille: "TPE",
  douleur: "Les devis traînent trois jours.",
  casUsage: "Un devis envoyé dans l'heure.",
  format: formatId(),
});

describe("date visée et validation du sujet", () => {
  beforeAll(async () => {
    const { hash } = await import("@node-rs/argon2");
    process.env.SESSION_SECRET = "a".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("essai-date", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("essai-date", false);
    delete process.env.USINE_URL;
    delete process.env.USINE_PORTE_SECRET;
  });

  it("un sujet garde sa dateVisee, état « propose » par défaut", async () => {
    const s = await gen.creerSujet({ idee: "Devis rapides", reseaux: ["linkedin"], formatId: formatId(), dateVisee: "2026-12-03" });
    const relu = await depots().scriptsMaitres.obtenir(s.id);
    expect(relu).toMatchObject({ dateVisee: "2026-12-03", etatValidation: "propose" });
    expect(gen.etatValidationDuSujet(relu!)).toBe("propose");
  });

  it("sans date visée : aucun champ inventé, état « propose »", async () => {
    const s = await gen.creerSujet({ idee: "Devis rapides", reseaux: ["linkedin"], formatId: formatId() });
    const relu = await depots().scriptsMaitres.obtenir(s.id);
    expect(relu?.dateVisee).toBeUndefined();
    expect(gen.etatValidationDuSujet(relu!)).toBe("propose");
  });

  it("un état « valide » explicite est gardé", async () => {
    const s = await gen.creerSujet({ idee: "Devis rapides", reseaux: ["linkedin"], formatId: formatId(), etatValidation: "valide" });
    expect(gen.etatValidationDuSujet((await depots().scriptsMaitres.obtenir(s.id))!)).toBe("valide");
  });

  it("un ancien sujet sans les nouveaux champs se charge et se liste", async () => {
    const s = await gen.creerSujet({ idee: "Ancien sujet", reseaux: ["linkedin"], formatId: formatId() });
    const { dateVisee: _d, etatValidation: _e, ...ancien } = (await depots().scriptsMaitres.obtenir(s.id))!;
    await depots().scriptsMaitres.enregistrer(ancien as typeof s);
    const relu = await depots().scriptsMaitres.obtenir(s.id);
    expect(relu).toBeDefined();
    expect(gen.dateViseeDuSujet(relu!)).toBeUndefined();
    expect(gen.etatValidationDuSujet(relu!)).toBe("propose");
    expect((await gen.listerSujets()).length).toBe(1);
  });

  it("une valeur inconnue ou une date mal formée est ignorée, jamais fatale", async () => {
    const s = await gen.creerSujet({ idee: "Devis", reseaux: ["linkedin"], formatId: formatId(), dateVisee: "demain" });
    expect(gen.dateViseeDuSujet((await depots().scriptsMaitres.obtenir(s.id))!)).toBeUndefined();
    expect(gen.etatValidationDuSujet({ etatValidation: "n'importe quoi" } as never)).toBe("propose");
  });

  it("l'idée de l'usine porte sa date visée jusqu'au sujet", async () => {
    const r = await sujet.ecrireSujetDeLUsine(idee("sig-date-1"), { reseaux: ["tiktok"], typeContenu: "video", dateVisee: "2026-12-10" });
    const relu = await depots().scriptsMaitres.obtenir(r.id);
    expect(relu).toMatchObject({ dateVisee: "2026-12-10", etatValidation: "propose" });
  });
});
