/**
 * FIX-TABLEAU-FIN-CHOISIE-a (18/11, règle de Williams du 17/11) : une fin choisie qui ne serait ni dite ni écrite
 * bloque « Tout est bon » (écran et fabrication passent par `relireFicheTableau`).
 * Brouillon v-64a273d3580c : fin « Écrivez PLAN en commentaire » choisie, perdue sans un mot.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { finChoisieAbsente, LIBELLE_FIN_CHOISIE } from "../../../src/moteurs/montage-tableau/fin-choisie";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { relireFicheTableau } from "../../../src/moteurs/montage-tableau/relecture";
import { texteDitDe } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { validerDonneesScript } from "../../../src/services/tableau-creation";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { contexteDe } from "../reference-2/fiches";

const DOSSIER = new URL("../temoins/", import.meta.url);
const lire = (nom = "fiche-temoin-v-667edcd8e3a8-reference-3.json") => JSON.parse(readFileSync(new URL(nom, DOSSIER), "utf8")) as FicheTableau;

/** Le témoin sans sa page d'appel (la fin n'est ni dite ni écrite), fin « mot d'envoi » choisie. */
function sansAppel(appelId: string | null = "fin-if-mot-envoi"): FicheTableau {
  const f = lire();
  f.scenes = f.scenes.filter((s) => s.gabarit?.role !== "appel");
  f.appelId = appelId as never;
  return f;
}

async function relire(f: FicheTableau, reseaux: string[], mot = "PLAN") {
  const sorties = sortiesDesReseaux(reseaux);
  const choisirFin = choisirFinTableau({}, { sorties, mot });
  return relireFicheTableau({ fiche: f, contexte: contexteDe(f), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin });
}
const pointsFin = (r: Awaited<ReturnType<typeof relire>>) => r.points.filter((p) => p.libelle === LIBELLE_FIN_CHOISIE);

describe("(a) fin choisie ni dite ni écrite : bloquée", () => {
  it("point « Fin choisie » qui contient « Écrivez PLAN en commentaire », ok faux", async () => {
    const r = await relire(sansAppel(), ["instagram"]);
    expect(r.ok).toBe(false);
    const p = pointsFin(r);
    expect(p).toHaveLength(1);
    expect(p[0].message).toContain("Écrivez PLAN en commentaire");
    expect(p[0].message).toContain("Ajoutez-la à la fin du texte, ou choisissez « Aucune »");
  }, 60_000);
  it("plusieurs sorties : le même message n'est donné qu'une fois", async () => {
    const r = await relire(sansAppel(), ["instagram", "facebook", "youtube"]);
    expect(pointsFin(r).length).toBe(new Set(pointsFin(r).map((p) => p.message)).size);
    expect(pointsFin(r).length).toBeGreaterThan(0);
  }, 60_000);
});

describe("(b) la fin est dite dans le texte : rien à signaler", () => {
  it("« Écrivez PLAN en commentaire. Je vous l'envoie. » ajouté au dernier texte dit", async () => {
    const f = sansAppel();
    f.scenes[f.scenes.length - 1].texteDit += " Écrivez PLAN en commentaire. Je vous l'envoie.";
    expect(pointsFin(await relire(f, ["instagram"]))).toEqual([]);
  }, 60_000);
});

describe("(c) « Aucune » : FIX-FIN-NON-CHOISIE intacte", () => {
  it("appelId null : aucun point « Fin choisie »", async () => {
    expect(pointsFin(await relire(sansAppel(null), ["instagram"]))).toEqual([]);
  }, 60_000);
});

describe("(d) TikTok et Shorts seuls : leur fin a ses propres règles", () => {
  it("aucun point « Fin choisie »", async () => {
    expect(sortiesDesReseaux(["tiktok"])).toEqual(["vertical-liens"]);
    expect(pointsFin(await relire(sansAppel(), ["tiktok"]))).toEqual([]);
  }, 60_000);
});

describe("(e) les témoins reference-3 tels quels : aucun point neuf", () => {
  for (const nom of readdirSync(DOSSIER).filter((n) => /reference-3\.json$/.test(n)))
    it(nom, async () => {
      const f = lire(nom);
      expect(f.appelId ?? null).toBeNull();
      expect(pointsFin(await relire(f, ["instagram", "tiktok"]))).toEqual([]);
    }, 60_000);
});

describe("fonction pure", () => {
  const f = sansAppel();
  const fin = { id: "x", ecran: "Écrivez PLAN en commentaire" };
  it("nulle hors style par parties, sans fin, fin absente, sorties sans appel au mot", () => {
    expect(finChoisieAbsente({ ...f, habillage: "reference/2" } as FicheTableau, "vertical", fin)).toBeNull();
    expect(finChoisieAbsente(f, "vertical", undefined)).toBeNull();
    expect(finChoisieAbsente(f, "vertical", { absente: "Aucune" })).toBeNull();
    expect(finChoisieAbsente(f, "vertical-liens" as IdSortie, fin)).toBeNull();
  });
  it("message si absente, nulle si le texte dit la fin (casse, accents et ponctuation ignorés)", () => {
    expect(finChoisieAbsente(f, "vertical", fin)).toContain("n'est pas dans votre texte");
    const g = structuredClone(f);
    g.scenes[g.scenes.length - 1].texteDit += " ecrivez plan, en COMMENTAIRE !";
    expect(texteDitDe(g)).toContain("COMMENTAIRE");
    expect(finChoisieAbsente(g, "vertical", fin)).toBeNull();
  });
});

describe("(f) le champ est bien enregistré", () => {
  it("validerDonneesScript garde finId et mot (en capitales)", () => {
    const t = lire();
    const r = validerDonneesScript({ texte: t.scenes.map((s) => s.texteDit).join(" "), serieCode: "formation", structure: t.structure, douleur: t.douleur, gesteMinute: t.gesteMinute, finId: "fin-if-mot-envoi", mot: "plan", reseaux: ["fil-instagram-facebook"] });
    if (!r.ok) throw new Error(r.phrase);
    expect(r.donnees.finId).toBe("fin-if-mot-envoi");
    expect(r.donnees.mot).toBe("PLAN");
  });
});
