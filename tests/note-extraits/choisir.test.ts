import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { candidatsExtraits } from "@/services/bibliotheque-video";
import { plagesDisponibles } from "@/briques/archive-extraits/choix";
import type { DemandeExtraits } from "@/briques/archive-extraits/choix";
import type { ElementBibliotheque, IdReseau } from "@/domaine/types";
import { candidatNote, choisirExtrait } from "@/briques/note-extraits";
import { choisirExtrait as choisirExtraitPioche } from "@/briques/bibliotheque-video/pioche-extraits";
import type { PlageDisponible } from "@/briques/archive-extraits/choix";
import type { PlageExtrait } from "@/domaine/archive-extraits";

const CAP = "texte.test" as const;

function plage(id: string, extra: Partial<PlageExtrait> = {}): PlageExtrait {
  return { id, debutSec: 1, finSec: 5, texte: "", motsCles: [], avecVisage: false, texteIncruste: true, etat: "utilisable", ...extra } as PlageExtrait;
}
function dispo(id: string, extra: Partial<PlageExtrait> = {}, elementId = "el1"): PlageDisponible {
  return { cle: `extrait:${elementId}:${id}`, elementId, videoId: "v1", ratio: "9:16", famille: ["fam"], plage: plage(id, extra) } as PlageDisponible;
}

describe("NE/choisir", () => {
  it("choisirExtrait est la même fonction que celle de la pioche", () => {
    expect(choisirExtrait).toBe(choisirExtraitPioche);
  });

  it("plage notée : note, sujet et usages repris", () => {
    const c = candidatNote(dispo("a", { note: 80, sujet: "appels-offres", usages: ["ecran"] }), CAP);
    expect(c.note).toBe(80);
    expect(c.sujet).toBe("appels-offres");
    expect(c.usages).toEqual(["ecran"]);
    expect(c.id).toBe("extrait:el1:a");
    expect(c.cle).toBe(c.id);
    expect(c.capacite).toBe(CAP);
    expect(c.plageId).toBe("a");
    expect(c.visage).toBe("aucun");
    expect(c.texteIncruste).toBe(true);
    expect(c.famille).toEqual(["fam"]);
    expect("ancienneteJours" in c).toBe(false);
  });

  it("plage sans note : aucun champ note, sujet ni ancienneté ; usages vide ; visage williams", () => {
    const c = candidatNote(dispo("b", { avecVisage: true }), CAP);
    expect("note" in c).toBe(false);
    expect("sujet" in c).toBe(false);
    expect(c.usages).toEqual([]);
    expect(c.visage).toBe("williams");
  });

  it("ancienneté reprise seulement si fournie ; entrée figée non modifiée", () => {
    const d = dispo("c", { note: 50, usages: ["fond"] });
    Object.freeze(d.plage.usages);
    Object.freeze(d.plage);
    Object.freeze(d.famille);
    Object.freeze(d);
    const c = candidatNote(d, CAP, 12);
    expect(c.ancienneteJours).toBe(12);
    expect(c.usages).not.toBe(d.plage.usages);
    expect(c.famille).not.toBe(d.famille);
    expect(d.plage.usages).toEqual(["fond"]);
  });

  it("bout à bout : la notée au sujet identique l'emporte, même graine même choix", () => {
    const ds = [
      dispo("x", { note: 80, sujet: "appels-offres", usages: ["ecran"] }),
      dispo("y", { note: 80, sujet: "relances-et-suivi" as const, usages: ["ecran"] }),
      dispo("z", { usages: ["ecran"] }),
    ];
    const cands = ds.map((d) => candidatNote(d, CAP));
    const besoin = { usage: "ecran" as const, sujet: "appels-offres" as const, graine: "g1" };
    const r1 = choisirExtrait(cands, besoin, []);
    const r2 = choisirExtrait(cands, besoin, []);
    expect(r1?.plageId).toBe("x");
    expect(r2).toEqual(r1);
  });

  it("champs de base identiques à ceux de candidatsExtraits pour la même plage", async () => {
    const element = {
      id: "elA", type: "source-extraits", nom: "elA", motsCles: [], formatsParDefaut: [], marqueId: "m",
      licence: { type: "propriete", usageCommercial: true, reseaux: [] },
      valeur: {
        type: "source-extraits",
        fiche: {
          videoId: "vA", versionId: "ver", sortieId: "s", ratio: "9:16",
          licence: { type: "propriete", usageCommercial: true, reseaux: [] }, famille: ["famA"],
          plages: [
            plage("p1", { texte: "Une facture claire", motsCles: ["facture"], debutSec: 2, finSec: 7, avecVisage: true, texteIncruste: false, note: 70, sujet: "appels-offres", usages: ["ecran"] }),
            plage("p2", { texte: "Une facture claire", motsCles: ["facture"], debutSec: 0, finSec: 4, texteIncruste: false }),
          ],
          rangee: false, sourcePreferee: false,
        },
      },
    } as unknown as ElementBibliotheque;
    const demande: DemandeExtraits = {
      videoId: "nouvelle", capacite: "ecran.telephone-extrait", reseaux: ["linkedin"] as IdReseau[],
      dejaUtilisees: [], maintenant: new Date("2026-11-16T12:00:00Z"),
    };
    const ports = { depots: () => ({ elements: { lister: async (f?: (e: ElementBibliotheque) => boolean) => (f ? [element].filter(f) : [element]) } }) } as never;
    const ce = await candidatsExtraits(demande, ports);
    const cn = plagesDisponibles([element], demande).map((d) => candidatNote(d, demande.capacite));
    expect(ce.length).toBe(2);
    expect(cn.length).toBe(ce.length);
    const cles = ["id", "cle", "capacite", "elementId", "plageId", "debutSec", "finSec", "ratio", "visage", "texteIncruste", "famille"] as const;
    ce.forEach((c, i) => {
      for (const k of cles) expect(cn[i][k]).toEqual(c[k]);
    });
  });
});
