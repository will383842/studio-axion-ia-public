/**
 * PR 8a (plan scripts du tableau, §8 point 1) : en production, la règle 13 ne recevait ni les interdits de Will ni les mots
 * interdits de la marque (`contexteRegles` ne passait que la date, les preuves et les matières). Un titre écrit
 * « certifié » passait donc à l'écran alors que la voix, elle, était contrôlée. Mémoire seulement, aucun réseau.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { regleControlesScript } from "../../../src/moteurs/montage-tableau/regles";
import { contexteFormationV3, ficheFormationV3Brute } from "../reference-3/fiches";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { contexteRegles } = await import("@/services/tableau-creation");
const { variableDecoupage } = await import("../../../src/moteurs/montage-tableau/decoupage");

const T0 = "2026-10-01T10:00:00.000Z";

async function poserLaMarque(extra: { interdits?: { id: string; texte: string; regex?: string; origine: string }[]; jargonInterdit?: string[]; promessesInterdites?: string[] }) {
  await depots().contexteAxion.enregistrer({
    id: "contexte-axion-v1",
    version: 1,
    positionIds: [],
    piliers: [],
    interdits: extra.interdits ?? [],
    jargonAutorise: [],
    jargonInterdit: extra.jargonInterdit ?? [],
    promessesInterdites: extra.promessesInterdites ?? [],
    carnetVoix: [],
    termesVagues: [],
    rolesDestinataires: [],
    creeLe: T0,
    modifieLe: T0,
  });
}

/** La fiche témoin, avec « certifié » dans un titre écrit seulement (la voix ne le dit pas). */
function ficheTitreCertifie() {
  const f = ficheFormationV3Brute();
  const titre = f.scenes[1].elements.find((e) => e.id === "e03") as { texte: string };
  titre.texte = "Formation certifiée";
  return f;
}

beforeEach(() => reinitialiserDepots());

describe("contexteRegles transmet les interdits de la marque", () => {
  it("un titre écrit « certifié » est refusé à l'écran quand la marque l'interdit", async () => {
    await poserLaMarque({ promessesInterdites: ["certifiée"] });
    const f = ficheTitreCertifie();
    const contexte = { ...(await contexteRegles("2026-10-18")), texteScript: f.scenes.map((s) => s.texteDit).join(" ") };
    expect(regleControlesScript(f, contexte).map((m) => m.detail)).toEqual([expect.stringContaining("mot interdit « certifiée »")]);
  });

  it("un interdit de Will avec expression est appliqué aux textes écrits", async () => {
    await poserLaMarque({ interdits: [{ id: "i1", texte: "Jamais « formation certifiée ».", regex: "formation certifi", origine: "test" }] });
    const f = ficheTitreCertifie();
    const contexte = { ...(await contexteRegles("2026-10-18")), texteScript: "" };
    expect(regleControlesScript(f, contexte).map((m) => m.detail)).toEqual([expect.stringContaining("enfreint un interdit de Will")]);
  });

  it("la fiche validée (« Exemple illustratif », axion-ia.com) reste acceptée, marque sans interdit ou avec interdits courants", async () => {
    await poserLaMarque({ jargonInterdit: ["synergie"], promessesInterdites: ["garanti à 100 %"] });
    const f = ficheFormationV3Brute();
    const { interdits, motsInterdits } = await contexteRegles("2026-10-15");
    const contexte = { ...contexteFormationV3(f), interdits, motsInterdits };
    expect(regleControlesScript(f, contexte)).toEqual([]);
  });
});

describe("mots interdits de la marque : écrit seulement", () => {
  it("brouillon existant avec un mot interdit dans la voix : aucun refus sur le texte dit (le texte dit est le script validé)", async () => {
    await poserLaMarque({ promessesInterdites: ["certifiée"] });
    const f = ficheTitreCertifie();
    f.scenes[0].texteDit = `${f.scenes[0].texteDit} Une formation certifiée.`;
    const ctx = await contexteRegles("2026-10-18");
    const contexte = { ...ctx, texteScript: f.scenes.map((s) => s.texteDit).join(" ") };
    const details = regleControlesScript(f, contexte).map((m) => m.detail);
    expect(details).toHaveLength(1);
    expect(details[0]).not.toContain("Une formation certifiée.");
  });

  it("interdit de Will dans la voix d'un brouillon existant : aucun refus sur le texte dit", async () => {
    await poserLaMarque({ interdits: [{ id: "i1", texte: "Jamais « formation certifiée ».", regex: "formation certifi", origine: "test" }] });
    const f = ficheFormationV3Brute();
    f.scenes[0].texteDit = `${f.scenes[0].texteDit} Une formation certifiée.`;
    const ctx = await contexteRegles("2026-10-18");
    const contexte = { ...ctx, texteScript: f.scenes.map((s) => s.texteDit).join(" ") };
    const details = regleControlesScript(f, contexte).map((m) => m.detail);
    expect(details.filter((d) => d.includes("interdit de Will"))).toEqual([]);
  });

  it("le prompt du découpage donne à Claude les mots interdits et les interdits de Will", async () => {
    await poserLaMarque({ jargonInterdit: ["synergie"], promessesInterdites: ["certifiée"], interdits: [{ id: "i1", texte: "Jamais « formation certifiée ».", regex: "formation certifi", origine: "test" }] });
    const ctx = await contexteRegles("2026-10-18");
    const v = variableDecoupage({ structure: "erreur-corrigee", serie: {}, douleur: "d", gesteMinute: "g", preuves: [], dessins: [], texteScript: "t", controle: { ...ctx, texteScript: undefined } } as never);
    expect(v).toContain("<mots_interdits>\nsynergie, certifiée\n</mots_interdits>");
    expect(v).toContain("Jamais « formation certifiée ».");
  });
});
