import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chercher, plagesDisponibles, type DemandeExtraits } from "@/briques/archive-extraits/choix";
import { ficheAvecAttente } from "@/briques/archive-extraits/eligibilite-notees";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, IdReseau, Licence } from "@/domaine/types";

const MAINTENANT = new Date("2026-11-16T12:00:00Z");
const lic = (): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [] });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 5, texte: "Une facture claire", motsCles: ["facture"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
const el = (id: string, plages: PlageExtrait[], extra: Partial<FicheSourceExtraits> = {}): ElementBibliotheque =>
  ({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m", licence: lic(),
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId: `v-${id}`, versionId: "ver", sortieId: "s", ratio: "9:16", licence: lic(), famille: [],
        plages, rangee: false, sourcePreferee: false, ...extra,
      },
    },
  }) as unknown as ElementBibliotheque;
const dem = (p: Partial<DemandeExtraits> = {}): DemandeExtraits => ({
  videoId: "nouvelle", capacite: "ecran.telephone-extrait", reseaux: ["linkedin"] as IdReseau[],
  dejaUtilisees: [], maintenant: MAINTENANT, ...p,
});
const cles = (r: { cle: string }[]) => r.map((x) => x.cle);

const QUATRE = (): PlageExtrait[] => [
  plage("parlee"),
  plage("demo", { origine: "ecran-demo" }),
  plage("cas", { origine: "capture-cas", texteIncruste: true }),
  plage("scene", { origine: "scene", avecVisage: true }),
];
const JEUX: ElementBibliotheque[][] = [
  [el("a", QUATRE())],
  [el("b", [plage("p1")]), el("c", [plage("p2", { texteIncruste: true }), plage("p3", { avecVisage: true })])],
  [el("d", [plage("u"), plage("x", { etat: "exclue" })]), el("e", [plage("p1", { origine: "ecran-demo" })])],
];

describe("X4-11d : la pioche respecte attentePublication", () => {
  it("éteint = identique : champ absent, false ou \"true\"", () => {
    for (const jeu of JEUX) {
      const ref = plagesDisponibles(jeu, dem());
      expect(ref.length).toBeGreaterThan(0);
      for (const v of [false, "true" as never, 1 as never]) {
        const avec = jeu.map((e) => {
          const v0 = e.valeur as { type: "source-extraits"; fiche: FicheSourceExtraits };
          return { ...e, valeur: { ...v0, fiche: { ...v0.fiche, attentePublication: v } } } as ElementBibliotheque;
        });
        expect(plagesDisponibles(avec, dem())).toEqual(ref);
      }
    }
  });

  it("true : seule la plage ecran-demo sans visage ni texte, même si texte et visage sont permis", () => {
    const e = el("a", QUATRE(), { attentePublication: true });
    const bloc = { uneSourceParVideo: false, dureeMinSec: 1, visageSurInstagram: true, texteIncrusteAccepte: { "ecran.telephone-extrait": true } };
    const r = plagesDisponibles([e], dem({ bloc: bloc as never }));
    expect(cles(r)).toEqual(["extrait:a:demo"]);
    expect(cles(plagesDisponibles([e], dem({ reseaux: ["instagram"] as IdReseau[], bloc: bloc as never })))).toEqual(["extrait:a:demo"]);
    expect(cles(plagesDisponibles([e], dem()))).toEqual(["extrait:a:demo"]);
  });

  it("vidéo publiée ensuite : les plages permises d'aujourd'hui reviennent", () => {
    const e = el("a", QUATRE(), { attentePublication: true });
    const fiche = (e.valeur as { fiche: FicheSourceExtraits }).fiche;
    const publiee = { ...e, valeur: { type: "source-extraits", fiche: ficheAvecAttente(fiche, false) } } as unknown as ElementBibliotheque;
    const sans = el("a", QUATRE());
    expect(plagesDisponibles([publiee], dem())).toEqual(plagesDisponibles([sans], dem()));
    expect(cles(plagesDisponibles([publiee], dem())).length).toBeGreaterThan(1);
  });

  it("chercher rend aussi les plages d'une fiche en attente", () => {
    const e = el("a", QUATRE(), { attentePublication: true });
    expect(chercher([e], "facture").map((x) => x.plage.id)).toEqual(["parlee", "demo", "cas", "scene"]);
  });

  it("garde statique : aucun service, une seule occurrence de attentePublication", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/archive-extraits/choix.ts"), "utf8");
    expect(src).not.toMatch(/@\/services/);
    expect(src.match(/fiche\.attentePublication/g)).toHaveLength(1);
    expect(src).toMatch(/import \{ plageProposableAvantPublication \} from "\.\/attente-publication";/);
  });
});
