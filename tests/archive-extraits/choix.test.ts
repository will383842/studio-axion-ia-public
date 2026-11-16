import { describe, expect, it } from "vitest";
import { chercher, plagesDisponibles, type DemandeExtraits } from "@/briques/archive-extraits/choix";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, IdReseau, Licence } from "@/domaine/types";

const MAINTENANT = new Date("2026-11-16T12:00:00Z");
const lic = (p: Partial<Licence> = {}): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 5, texte: "Une facture claire", motsCles: ["facture"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
interface Opt { videoId: string; licence: Licence; famille: string[]; rangee: boolean; plages: PlageExtrait[]; estDemo: boolean; archiveLe: string }
const el = (id: string, o: Partial<Opt> = {}): ElementBibliotheque =>
  ({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m",
    licence: o.licence ?? lic(), estDemo: o.estDemo, archiveLe: o.archiveLe,
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId: o.videoId ?? `v-${id}`, versionId: "ver", sortieId: "s", ratio: "9:16",
        licence: o.licence ?? lic(), famille: o.famille ?? [], plages: o.plages ?? [plage("p1")],
        rangee: o.rangee ?? false, sourcePreferee: false,
      },
    },
  }) as unknown as ElementBibliotheque;
const dem = (p: Partial<DemandeExtraits> = {}): DemandeExtraits => ({
  videoId: "nouvelle", capacite: "ecran.telephone-extrait", reseaux: ["linkedin"] as IdReseau[],
  dejaUtilisees: [], maintenant: MAINTENANT, ...p,
});
const cles = (r: { cle: string }[]) => r.map((x) => x.cle);

describe("plagesDisponibles : filtres de droit", () => {
  it("1 : démo, archivée, rangée et autre type sont écartés", () => {
    const autre = { ...el("x"), type: "logo", valeur: { type: "logo", variante: "clair" } } as unknown as ElementBibliotheque;
    const r = plagesDisponibles([el("ok"), el("d", { estDemo: true }), el("a", { archiveLe: "2026-01-01" }), el("r", { rangee: true }), autre], dem());
    expect(cles(r)).toEqual(["extrait:ok:p1"]);
  });
  it("2 : licence expirée, à vérifier, non commerciale : rien", () => {
    const r = plagesDisponibles([
      el("e", { licence: lic({ expireLe: "2026-01-01" }) }),
      el("v", { licence: lic({ type: "a-verifier" }) }),
      el("n", { licence: lic({ usageCommercial: false }) }),
    ], dem());
    expect(r).toEqual([]);
  });
  it("2 : licence LinkedIn seule, vidéo visant Instagram : rien ; réseaux vides = tous", () => {
    const li = el("li", { licence: lic({ reseaux: ["linkedin"] }) });
    expect(plagesDisponibles([li], dem({ reseaux: ["instagram"] }))).toEqual([]);
    expect(plagesDisponibles([li], dem({ reseaux: ["linkedin", "instagram"] }))).toEqual([]);
    expect(cles(plagesDisponibles([li], dem({ reseaux: ["linkedin"] })))).toEqual(["extrait:li:p1"]);
    expect(plagesDisponibles([el("tous")], dem({ reseaux: ["instagram", "tiktok"] }))).toHaveLength(1);
  });
  it("2 : l'expiration se lit avec `maintenant`", () => {
    const e = el("e", { licence: lic({ expireLe: "2026-12-01" }) });
    expect(plagesDisponibles([e], dem())).toHaveLength(1);
    expect(plagesDisponibles([e], dem({ maintenant: new Date("2027-01-01") }))).toEqual([]);
  });
  it("3 : aucune autocitation (même vidéo ou famille)", () => {
    const r = plagesDisponibles([el("a", { videoId: "nouvelle" }), el("b", { famille: ["nouvelle"] }), el("c")], dem());
    expect(cles(r)).toEqual(["extrait:c:p1"]);
  });
  it("4 : seules les plages utilisables", () => {
    const e = el("e", { plages: [plage("u"), plage("x", { etat: "exclue" }), plage("y", { etat: "ecartee" }), plage("z", { etat: "a_verifier" })] });
    expect(cles(plagesDisponibles([e], dem()))).toEqual(["extrait:e:u"]);
  });
  it("5 : visage sur Instagram, défaut (vrai) accepté", () => {
    const e = el("e", { plages: [plage("v", { avecVisage: true })] });
    expect(plagesDisponibles([e], dem({ reseaux: ["instagram"] }))).toHaveLength(1);
  });
  it("5 : visage sur Instagram refusé si visageSurInstagram faux, accepté ailleurs", () => {
    const e = el("e", { plages: [plage("v", { avecVisage: true }), plage("s")] });
    const bloc = { visageSurInstagram: false, texteIncrusteAccepte: {}, dureeMinSec: 3, uneSourceParVideo: true };
    expect(cles(plagesDisponibles([e], dem({ reseaux: ["instagram"], bloc })))).toEqual(["extrait:e:s"]);
    expect(plagesDisponibles([e], dem({ reseaux: ["linkedin"], bloc }))).toHaveLength(2);
  });
  it("6 : texte incrusté refusé par défaut, accepté pour la seule capacité mise à true", () => {
    const e = el("e", { plages: [plage("t", { texteIncruste: true })] });
    expect(plagesDisponibles([e], dem())).toEqual([]);
    const bloc = { visageSurInstagram: true, texteIncrusteAccepte: { "ecran.telephone-extrait": true as const }, dureeMinSec: 3, uneSourceParVideo: true };
    expect(plagesDisponibles([e], dem({ bloc }))).toHaveLength(1);
    expect(plagesDisponibles([e], dem({ bloc, capacite: "ecran.autre" }))).toEqual([]);
  });
  it("7 : durée minimale (défaut 3 s, surchargeable)", () => {
    const e = el("e", { plages: [plage("c", { debutSec: 1, finSec: 3.5 }), plage("l", { debutSec: 0, finSec: 3 })] });
    expect(cles(plagesDisponibles([e], dem()))).toEqual(["extrait:e:l"]);
    expect(plagesDisponibles([e], dem({ dureeMinSec: 2 }))).toHaveLength(2);
  });
  it("8 : plage déjà utilisée refusée", () => {
    const e = el("e", { plages: [plage("p1"), plage("p2")] });
    const r = plagesDisponibles([e], dem({ dejaUtilisees: ["extrait:e:p1"] }));
    expect(cles(r)).toEqual([]); // une source par vidéo : toute la source est refusée
    const bloc = { visageSurInstagram: true, texteIncrusteAccepte: {}, dureeMinSec: 3, uneSourceParVideo: false };
    expect(cles(plagesDisponibles([e], dem({ dejaUtilisees: ["extrait:e:p1"], bloc })))).toEqual(["extrait:e:p2"]);
  });
  it("8 : uneSourceParVideo écarte les autres plages de la source déjà employée seulement", () => {
    const r = plagesDisponibles([el("a"), el("b")], dem({ dejaUtilisees: ["extrait:a:p9"] }));
    expect(cles(r)).toEqual(["extrait:b:p1"]);
  });
  it("sortie : champs de la plage, ordre reçu, déterminisme", () => {
    const els = [el("b"), el("a")];
    const r1 = plagesDisponibles(els, dem());
    expect(r1).toEqual(plagesDisponibles(els, dem()));
    expect(cles(r1)).toEqual(["extrait:b:p1", "extrait:a:p1"]);
    expect(r1[0]).toMatchObject({ elementId: "b", videoId: "v-b", ratio: "9:16", famille: [] });
  });
});

describe("chercher", () => {
  const els = [
    el("a", { plages: [plage("p1", { texte: "Facturé chaque mois", motsCles: [] }), plage("p2", { texte: "Autre", motsCles: ["devis"], etat: "exclue" })] }),
    el("r", { rangee: true, plages: [plage("p3", { texte: "x", motsCles: ["facture"] })] }),
  ];
  it("trouve « Facturé » avec « facture » (motsCles ou texte), tous états, fiches rangées comprises", () => {
    expect(chercher(els, "facture").map((x) => x.plage.id)).toEqual(["p1", "p3"]);
    expect(chercher(els, "facturé").map((x) => x.plage.id)).toEqual(["p1", "p3"]);
    expect(chercher(els, "devis")).toEqual([{ elementId: "a", plage: els[0].valeur.type === "source-extraits" ? els[0].valeur.fiche.plages[1] : undefined }]);
  });
  it("tous les mots doivent être présents", () => {
    expect(chercher(els, "facturé mois").map((x) => x.plage.id)).toEqual(["p1"]);
    expect(chercher(els, "facturé devis")).toEqual([]);
    expect(chercher(els, "chaque mois").map((x) => x.plage.id)).toEqual(["p1"]);
  });
  it("requête vide ou de mots vides : []", () => {
    expect(chercher(els, "")).toEqual([]);
    expect(chercher(els, "   le la ")).toEqual([]);
  });
});
