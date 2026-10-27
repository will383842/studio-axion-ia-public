/** Refs inconnues (titre, sous-titre, pied, phrase-choc, nom de scène) : retirées sans appel, jamais un refus. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { ecrireScriptIV, sansRefsInconnues, type OutilsEcritureIV, type ReponseAppelIV } from "@/moteurs/montage-image-video/ecriture";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { cleFormule, type ChoixFormule } from "@/moteurs/montage-image-video/regles";

const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(
  ["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]),
);

function outils(reponses: (ReponseAppelIV | "simulation")[]): OutilsEcritureIV {
  let i = 0;
  return {
    budget: { reserver: async () => ({ ok: true }) },
    appeler: async (role: DefinitionRole, entree: EntreeRole) => {
      const r = reponses[i++] ?? "simulation";
      return r === "simulation" ? { ok: true, simule: true, donnees: role.simuler(entree) } : r;
    },
  };
}
const entree = () => ({ videoId: "v1", versionId: "s1", carte, choixFormules: GARDER });
const premier = carte.noeuds[0].id;

type Brute = { ecrans: { id: string; refs: string[]; surMot: { mot: number; action: string; ref?: string }[] }[] };
const ecran = (refs: unknown[], surMot: unknown[] = []) => ({ ecrans: [{ id: "e03", refs, surMot }] });

describe("sansRefsInconnues", () => {
  it("retire titre et sous-titre, garde l'id de la carte", () => {
    const r = sansRefsInconnues(ecran(["titre", "sous-titre", premier]), carte);
    expect((r.brute as Brute).ecrans[0].refs).toEqual([premier]);
    expect(r.retirees).toContain("titre (e03)");
    expect(r.retirees).toContain("sous-titre (e03)");
  });
  it("un surMot à ref inconnue perd la clé ref mais garde mot et action", () => {
    const r = sansRefsInconnues(ecran([premier], [{ mot: 1, action: "apparait", ref: "pied" }]), carte);
    expect((r.brute as Brute).ecrans[0].surMot[0]).toEqual({ mot: 1, action: "apparait" });
  });
  it("dédoublonne après normalisation", () => {
    const r = sansRefsInconnues(ecran([` ${premier.toUpperCase()} `, premier]), carte);
    expect((r.brute as Brute).ecrans[0].refs).toEqual([premier]);
    expect(r.retirees).toEqual([]);
  });
  it("ajoute aux refs un surMot.ref connu absent", () => {
    const r = sansRefsInconnues(ecran([], [{ mot: 0, action: "apparait", ref: premier }]), carte);
    expect((r.brute as Brute).ecrans[0].refs).toEqual([premier]);
  });
  it("rend brute tel quel sans tableau d'écrans", () => {
    const b = { x: 1 };
    expect(sansRefsInconnues(b, carte).brute).toBe(b);
  });
});

describe("ecrireScriptIV avec refs inconnues", () => {
  it("bout en bout : une seule réponse, réparée sans refus", async () => {
    const f = structuredClone(ficheSimulee("essai-c")!);
    f.ecrans.find((e) => e.id === "e03")!.refs.push("titre", "sous-titre");
    f.ecrans[f.ecrans.length - 1].refs.push("phrase-choc");
    const r = (await ecrireScriptIV(entree(), outils([{ ok: true, simule: true, donnees: f }]))) as Extract<Awaited<ReturnType<typeof ecrireScriptIV>>, { ok: true }>;
    expect(r.ok).toBe(true);
    expect(r.appels).toBe(1);
    expect(((r as { refus?: string[] }).refus ?? []).join(" ")).not.toMatch(/FORME|n'est pas sur l'image/);
    expect(r.verdict?.marques.some((m) => m.includes("hors de l'image"))).toBe(true);
  });
  it("non-régression : fiche intacte, mêmes fiche et marques", async () => {
    const f = ficheSimulee("essai-c")!;
    const r = (await ecrireScriptIV(entree(), outils([{ ok: true, simule: true, donnees: f }]))) as Extract<Awaited<ReturnType<typeof ecrireScriptIV>>, { ok: true }>;
    expect(r.ok).toBe(true);
    expect(r.verdict?.marques.some((m) => m.includes("hors de l'image"))).toBe(false);
    expect(r.fiche).toEqual(f);
  });
});
