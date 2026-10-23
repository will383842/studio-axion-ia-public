/**
 * G1a : un format à `declinaison: "aucune"` (format mono-réseau) donne UNE SEULE version, même si le sujet coche
 * plusieurs réseaux (plan v5 B.0 n° 19). Format « test » inscrit depuis `tests/` seulement, par des données ; fichier à
 * part (registre des formats propre à ce fichier de tests). Plus le cas `corps-distinct` : un texte par réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { formatEssai, matiere, preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
import { formatGenerateur, inscrireFormat, obtenirFormat } from "@/formats";
import { inscrireCodeFormat } from "@/formats/registre-codes";

const MDP = "essai-g1a-format-aucune";

inscrireFormat(formatEssai(obtenirFormat("avocat"), "test", "aucune"));
// Un second format d'essai, inscrit avec son propre code (ajout seul au registre), en corps distinct.
inscrireCodeFormat({ code: "TSD", formatId: "test-distinct" });
inscrireFormat(formatEssai(obtenirFormat("avocat"), "test-distinct", "corps-distinct"));

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await depots().matieres.enregistrer(matiere("Est-ce que ChatGPT peut lire nos factures ?", "question-recue"));
});

describe("déclinaison « aucune » et « corps distinct »", () => {
  it("« aucune » : une seule version, sur le premier réseau coché", async () => {
    expect(formatGenerateur("test").declinaison).toBe("aucune");
    const s = await gen.creerSujet({ idee: "ChatGPT et les factures", reseaux: ["linkedin", "tiktok", "instagram"], formatId: "test" });
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    expect(r.varianteIds).toHaveLength(1);
    expect(r.scriptIds).toHaveLength(1);
    const [v] = await depots().variantes.lister((x) => x.scriptMaitreId === s.id);
    expect(v).toMatchObject({ code: "0001-TST-LI", reseau: "linkedin" });
    const [vue] = await gen.listerSujets();
    expect(Object.values(vue.grille[0].cases).filter((c) => c.etat !== "absent")).toHaveLength(1);
  });

  it("« corps distinct » : un texte par réseau, une version par texte", async () => {
    const s = await gen.creerSujet({ idee: "ChatGPT et les factures", reseaux: ["tiktok", "facebook"], formatId: "test-distinct" });
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    expect(r.scriptIds).toHaveLength(2);
    const vs = await depots().variantes.lister((x) => x.scriptMaitreId === s.id);
    expect(vs.map((v) => v.code).sort()).toEqual(["0001-TSD-FB", "0001-TSD-TT"]);
    expect(new Set(vs.map((v) => v.scriptId)).size).toBe(2);
    // Retoucher le corps de TikTok ne touche pas Facebook (autre texte).
    const tt = vs.find((v) => v.reseau === "tiktok")!;
    const s1 = (await depots().scripts.obtenir(tt.scriptId))!;
    const { reportees } = await gen.retoucherCorps(s1.id, [{ ...s1.blocs[0], segments: [{ id: "n", texte: "Nouveau milieu." }] }]);
    expect(reportees).toHaveLength(1);
    expect((await depots().variantes.obtenir(vs.find((v) => v.reseau === "facebook")!.id))?.version).toBe(1);
    const [vue] = await gen.listerSujets();
    expect(vue.grille).toHaveLength(1);
    expect(vue.grille[0].scriptIds).toHaveLength(2); // l'ancien texte de TikTok, remplacé, n'y figure plus
    expect(vue.grille[0].cases.tiktok.etat).toBe("a-reverifier");
    expect(vue.grille[0].cases.facebook.etat).toBe("a-relire");
  });
});
