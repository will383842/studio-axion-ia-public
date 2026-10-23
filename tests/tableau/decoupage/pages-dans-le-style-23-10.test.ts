/**
 * Refus « page lisible » du 23/10/2026 (série Automatisations, style « tableau-blanc ») :
 * une page de plusieurs scènes tenait sur la page « ivoire » mais pas dans le style de la série. Le découpage réparait
 * la densité (page de plus) AVANT de poser le style de la série, puis jugeait DANS ce style : la réparation ne voyait
 * rien, le jugement refusait. Correctif : le style est posé avant la remise en forme (comme `pagesDuStyle`).
 *
 * ATTENTION : `mettreEnPage` importée ici est la SIMULATION (vi.mock remonté), pas la vraie ; aucune vraie fiche ne reproduit le cas.
 * Fiche témoin : la vraie réponse v-365dd2ae67ee (page 7 = scènes s07 + s08), série remplacée par Automatisations.
 * Aucune combinaison de textes réels n'a donné une page qui tienne en ivoire et pas en tableau-blanc (essais faits : fusion
 * de pages entières, textes allongés : ils butent sur d'autres règles du gabarit). On SIMULE donc la mise en page, qui garde
 * l'original mais refuse la page 7 en « tableau-blanc » tant qu'elle porte 2 scènes ou plus.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { decouperEnScenes, ficheACorriger, jugerFiche, partiesDuDecoupage, type EntreeDecoupage } from "@/moteurs/montage-tableau/decoupage";
import { pageTropChargee } from "@/moteurs/montage-tableau/densite";
import { ErreurMiseEnPage, mettreEnPage as mettreEnPageSimulee } from "@/moteurs/montage-tableau/mise-en-page";

const PAGE = 7;

vi.mock("@/moteurs/montage-tableau/mise-en-page", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/moteurs/montage-tableau/mise-en-page")>();
  return {
    ...original,
    mettreEnPage: ((fiche: { styleTableau?: string; scenes: { page: number }[] }, options?: unknown) => {
      if (fiche.styleTableau === "tableau-blanc" && fiche.scenes.filter((s) => s.page === 7).length >= 2) {
        throw new original.ErreurMiseEnPage("la page ne tient pas au-dessus de la bande des sous-titres (simulé)", 7);
      }
      return (original.mettreEnPage as (f: unknown, o?: unknown) => unknown)(fiche, options);
    }) as typeof original.mettreEnPage,
  };
});

type Cas = { texteScript: string; motsDouleur: string[] | null; parties: unknown; reponse: { scenes: { id: string; page: number; texteDit: string; elements: { type: string; preuveId?: string }[] }[]; [cle: string]: unknown } };
const cas: Cas = JSON.parse(readFileSync(join(__dirname, "temoins", "decoupage-v-365dd2ae67ee.json"), "utf8"));
cas.reponse.serie = { code: "automatisations", nom: "Automatisations" };

function entreeDe(c: Cas): EntreeDecoupage {
  const b = c.reponse as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const preuveIds = new Set<string>();
  for (const s of b.scenes) for (const e of s.elements) if (e.type === "preuve") preuveIds.add(e.preuveId);
  const parties = partiesDuDecoupage(c.parties);
  return {
    texteScript: c.texteScript,
    structure: b.structure,
    serie: b.serie,
    douleur: b.douleur,
    gesteMinute: b.gesteMinute,
    preuves: [...preuveIds].map((id) => ({ id, resume: "x" })),
    dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId,
    versionId: b.versionId,
    habillage: b.habillage,
    stylo: b.stylo,
    ratio: b.ratio,
    controle: {
      aujourdhui: "2026-10-18",
      sourcesChiffres: [],
      preuves: [],
      matieres: [...preuveIds].map((id) => ({ id, type: "demonstration", statut: "validee" })),
      ...(c.motsDouleur ? { motsDouleur: c.motsDouleur } : {}),
    },
    ...(parties ? { parties } : {}),
  } as EntreeDecoupage;
}

const dits = (scenes: { texteDit: string }[]) => scenes.map((s) => s.texteDit).join("|");
const pagesDe = (scenes: { page: number }[]) => Math.max(...scenes.map((s) => s.page));

describe("page de plusieurs scènes jugée dans le style de la série (refus du 23/10)", () => {
  const entree = entreeDe(cas);

  it("garde-fou : la page 7 a 2 scènes ; série Audit : la fiche passe ; en tableau-blanc le refus de page est SIMULÉ (vi.mock), ce n'est pas la vraie mise en page", () => {
    expect(cas.reponse.scenes.filter((s) => s.page === PAGE).length).toBeGreaterThanOrEqual(2);
    const audit = { ...cas, reponse: { ...cas.reponse, serie: { code: "audit", nom: "Audit" } } };
    const ok = jugerFiche(audit.reponse, entreeDe(audit));
    expect(ok.ok ? "ok" : ok.refus).toBe("ok");
    expect(() => mettreEnPageSimulee({ ...structuredClone(cas.reponse), styleTableau: "tableau-blanc" } as never)).toThrow(ErreurMiseEnPage);
  });

  it("jugerFiche : acceptée, sans style ajouté, une page de plus, texte dit inchangé", () => {
    const j = jugerFiche(cas.reponse, entree);
    expect(j.ok ? "ok" : j.refus).toBe("ok");
    if (!j.ok) return;
    expect(j.fiche.styleTableau).toBeUndefined();
    expect(pagesDe(j.fiche.scenes)).toBe(pagesDe(cas.reponse.scenes) + 1);
    expect(dits(j.fiche.scenes)).toBe(dits(cas.reponse.scenes));
  });

  it("de bout en bout : un seul appel, plus de relance", async () => {
    const r = await decouperEnScenes(entree, {
      appeler: async () => ({ ok: true, simule: false, donnees: JSON.stringify(cas.reponse), stopReason: "end_turn" }),
      budget: { reserver: async () => ({ ok: true }) },
    } as never);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.appels).toBe(1);
  });

  it("fiche « à corriger » : la page de plus est déjà faite dans le style de la série", () => {
    const gardee = ficheACorriger(cas.reponse as never, entree);
    expect(gardee.styleTableau).toBe("tableau-blanc");
    expect(pageTropChargee(gardee)).toBeNull();
  });
});
