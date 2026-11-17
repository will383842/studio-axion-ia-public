import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  POLITIQUE_NOTEES,
  eligibiliteNotees,
  estPolitiqueNotees,
  ficheAvecAttente,
} from "@/briques/archive-extraits/eligibilite-notees";
import { videoEligible } from "@/briques/archive-extraits/inscription";
import type { FicheSourceExtraits } from "@/domaine/archive-extraits";
import type { Video } from "@/domaine/types";

type V = Pick<Video, "estDemo" | "statut" | "corbeilleLe" | "etapeEditoriale">;
const prete: V = { estDemo: false, statut: "prete", corbeilleLe: undefined, etapeEditoriale: "validee" } as V;
const ctx = { versionEnEssai: false, sortieDemo: false, aSousTitres: true };

function fiche(): FicheSourceExtraits {
  return {
    videoId: "v1",
    versionId: "ver1",
    sortieId: "s1",
    ratio: "9:16",
    famille: [],
    plages: [],
    rangee: false,
    sourcePreferee: true,
  } as unknown as FicheSourceExtraits;
}

describe("eligibiliteNotees", () => {
  it("vidéo prête non publiée : admise, en attente", () => {
    expect(eligibiliteNotees(prete, ctx)).toEqual({ eligible: true, attentePublication: true });
  });
  it("vidéo prête publiée : admise, plus en attente", () => {
    const r = eligibiliteNotees({ ...prete, etapeEditoriale: "publiee" }, ctx);
    expect(r).toEqual({ eligible: true, attentePublication: false });
  });
  const cas: Array<[string, V, Partial<typeof ctx>]> = [
    ["exemple", { ...prete, estDemo: true }, {}],
    ["corbeille", { ...prete, corbeilleLe: "2026-01-01T00:00:00Z" } as V, {}],
    ["essai", prete, { versionEnEssai: true }],
    ["sortie d'exemple", prete, { sortieDemo: true }],
    ["sans sous-titres", prete, { aSousTitres: false }],
    ["pas prête", { ...prete, statut: "en_cours" } as unknown as V, {}],
  ];
  it.each(cas)("%s : jamais admise, même raison que videoEligible", (_n, v, extra) => {
    const c = { ...ctx, ...extra };
    const r = eligibiliteNotees(v, c);
    const ref = videoEligible(v, { ...c, politique: "pretes" });
    expect(r.eligible).toBe(false);
    expect(r.raison).toBe(ref.raison);
    expect(r.attentePublication).toBe(false);
  });
});

describe("estPolitiqueNotees", () => {
  it("vrai seulement pour la chaîne exacte", () => {
    expect(POLITIQUE_NOTEES).toBe("notees");
    expect(estPolitiqueNotees("notees")).toBe(true);
    for (const v of ["pretes", "Notees", true, null, undefined]) expect(estPolitiqueNotees(v)).toBe(false);
  });
});

describe("ficheAvecAttente", () => {
  it("false sur fiche sans champ : égalité profonde, champ absent", () => {
    const f = fiche();
    const r = ficheAvecAttente(f, false);
    expect(r).toEqual(f);
    expect("attentePublication" in r).toBe(false);
  });
  it("true puis false : retour à l'identique", () => {
    const f = fiche();
    const a = ficheAvecAttente(f, true);
    expect(a.attentePublication).toBe(true);
    expect(ficheAvecAttente(a, false)).toEqual(f);
  });
  it("entrée gelée non modifiée", () => {
    const f = Object.freeze(fiche());
    expect(() => ficheAvecAttente(f, true)).not.toThrow();
    expect("attentePublication" in f).toBe(false);
  });
});

describe("garde statique", () => {
  it("aucun import de services, depots, reglages, server-only", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/archive-extraits/eligibilite-notees.ts"), "utf8");
    for (const m of ["@/services", "depots", "reglages", "server-only"]) {
      expect(src).not.toContain(m);
    }
  });
});
