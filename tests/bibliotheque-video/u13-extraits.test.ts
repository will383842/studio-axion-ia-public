import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { candidatsExtraits } from "@/services/bibliotheque-video";
import type { DemandeExtraits } from "@/briques/archive-extraits/choix";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, IdReseau, Licence } from "@/domaine/types";

const MAINTENANT = new Date("2026-11-16T12:00:00Z");
const lic = (p: Partial<Licence> = {}): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 5, texte: "Une facture claire", motsCles: ["facture"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
interface Opt { videoId: string; licence: Licence; famille: string[]; plages: PlageExtrait[] }
const el = (id: string, o: Partial<Opt> = {}): ElementBibliotheque =>
  ({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m",
    licence: o.licence ?? lic(),
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId: o.videoId ?? `v-${id}`, versionId: "ver", sortieId: "s", ratio: "9:16",
        licence: o.licence ?? lic(), famille: o.famille ?? [], plages: o.plages ?? [plage("p1")],
        rangee: false, sourcePreferee: false,
      },
    },
  }) as unknown as ElementBibliotheque;
const dem = (p: Partial<DemandeExtraits> = {}): DemandeExtraits => ({
  videoId: "nouvelle", capacite: "ecran.telephone-extrait", reseaux: ["linkedin"] as IdReseau[],
  dejaUtilisees: [], maintenant: MAINTENANT, ...p,
});

function ports(elements: ElementBibliotheque[]) {
  const ecritures = vi.fn();
  const depotsSimules = () => ({
    elements: {
      lister: async (f?: (e: ElementBibliotheque) => boolean) => (f ? elements.filter(f) : elements),
      creer: ecritures, modifier: ecritures, supprimer: ecritures,
    },
  });
  return { ports: { depots: depotsSimules } as never, ecritures };
}

describe("C1-U13 · candidatsExtraits", () => {
  it("convertit une plage en candidat (id = cle, visage aucun)", async () => {
    const { ports: p } = ports([el("a")]);
    const r = await candidatsExtraits(dem(), p);
    expect(r).toEqual([
      {
        id: "extrait:a:p1", cle: "extrait:a:p1", capacite: "ecran.telephone-extrait", elementId: "a", plageId: "p1",
        debutSec: 0, finSec: 5, ratio: "9:16", visage: "aucun", texteIncruste: false, famille: [],
      },
    ]);
  });
  it("visage de Williams marqué, sur LinkedIn", async () => {
    const { ports: p } = ports([el("a", { plages: [plage("p1", { avecVisage: true })] })]);
    expect((await candidatsExtraits(dem(), p))[0].visage).toBe("williams");
  });
  it("non-régression : une plage non utilisable (tiers exclu en amont) n'apparaît jamais", async () => {
    const { ports: p } = ports([el("a", { plages: [plage("t", { etat: "tiers" as never }), plage("ok")] })]);
    expect((await candidatsExtraits(dem(), p)).map((c) => c.plageId)).toEqual(["ok"]);
  });
  it("licence non ok : absente", async () => {
    const { ports: p } = ports([
      el("e", { licence: lic({ expireLe: "2026-01-01" }) }),
      el("v", { licence: lic({ type: "a-verifier" }) }),
    ]);
    expect(await candidatsExtraits(dem(), p)).toEqual([]);
  });
  it("une vidéo ne se cite pas elle-même (videoId et famille)", async () => {
    const { ports: p } = ports([el("a", { videoId: "nouvelle" }), el("b", { famille: ["nouvelle"] }), el("c")]);
    expect((await candidatsExtraits(dem(), p)).map((c) => c.elementId)).toEqual(["c"]);
  });
  it("plafond de 200 sur 250 plages, ordre stable", async () => {
    const plages = Array.from({ length: 250 }, (_, i) => plage(`p${i}`));
    const { ports: p } = ports([el("a", { plages })]);
    const r = await candidatsExtraits(dem(), p);
    expect(r).toHaveLength(200);
    expect(r[0].plageId).toBe("p0");
    expect(r[199].plageId).toBe("p199");
  });
  it("même entrée = même sortie ; 0 écriture", async () => {
    const { ports: p, ecritures } = ports([el("a"), el("b")]);
    const un = await candidatsExtraits(dem(), p);
    const deux = await candidatsExtraits(dem(), p);
    expect(deux).toEqual(un);
    expect(ecritures).not.toHaveBeenCalled();
  });
});
