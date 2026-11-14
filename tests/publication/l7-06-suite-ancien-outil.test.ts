/**
 * L7-06 suite, points 4.4 et 4.5 : la pastille « Ancien outil » apparaît pour un compte encore routé chez Buffer
 * (écran « À publier » et Réglages > Zernio) ; « Changer » propose les DEUX outils, l'actuel marqué.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import type { CompteVue } from "@/app/(studio)/reglages/actions-zernio";
import type { LigneAPublier, VueAPublier } from "@/services/a-publier";
import type { ComplementLigne } from "@/services/a-publier-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/services/a-publier-zernio", () => ({ envoyerParOutilAction: async () => ({ ok: true, donnees: { nombre: 1, problemes: [] } }), marquerEnvoiVerifieAction: async () => ({ ok: true, donnees: { ok: true } }) }));

const { LignesAPublier } = await import("@/components/publication/LignesAPublier");
const { CarteCompte } = await import("@/components/reglages/BlocZernio");
const { estAncienOutil, outilsProposes } = await import("@/domaine/outil-publication");

const CASES = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
const ligne = { famille: "video", cle: "v-1:instagram", videoId: "v-1", titre: "Titre", jaquette: null, lecture: "/v.mp4", reseau: "instagram", reseauNom: "Instagram", texte: "Phrase", motsDiese: [], apercu: "Phrase", premierCommentaire: "", commentaireTransmissible: true, compte: { nom: "Compte", memorises: ["c1"] }, manquantes: [], casesRequises: [...CASES], coches: Object.fromEntries(CASES.map((c) => [c, true])) } as unknown as LigneAPublier;
const comp = (x: Partial<ComplementLigne>): ComplementLigne => ({ outil: "zernio", etat: "aucun", essai: false, bufferDisponible: true, aussiSur: [], ...x });
const vue: VueAPublier = { envoiSimule: false, modeBuffer: "brouillon", lignes: [ligne] };
const ecran = (c: ComplementLigne) => renderToStaticMarkup(createElement(LignesAPublier, { vue, complements: { [ligne.cle]: c }, reseauOuvert: "instagram" })).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const compte = (outil: "buffer" | "zernio"): CompteVue => ({ code: "ig-1", cle: "instagram:ig-1", reseau: "instagram", nom: "Compte exemple", relie: true, outil, mode: "brouillon", existeChezBuffer: true, basculeLe: null, dernierTest: null });
const carte = (outil: "buffer" | "zernio") => renderToStaticMarkup(createElement(CarteCompte, { compte: compte(outil), services: { changerRoutage: async () => ({ ok: true, donnees: undefined }), changerMode: async () => ({ ok: true, donnees: undefined }) } as never }));

describe("L7-06 suite · 4.4 pastille « Ancien outil »", () => {
  it("fonction pure : seul « buffer » est un ancien outil", () => {
    expect(estAncienOutil("buffer")).toBe(true);
    expect(["zernio", null, undefined, "autre"].map((o) => estAncienOutil(o))).toEqual([false, false, false, false]);
  });
  it("écran « À publier » : pastille pour un compte routé chez Buffer, pas pour Zernio", () => {
    expect(ecran(comp({ outil: "buffer" }))).toContain("Ancien outil");
    expect(ecran(comp({ outil: "zernio" }))).not.toContain("Ancien outil");
  });
  it("Réglages > Zernio : pastille sur la carte d'un compte encore chez Buffer, pas sur un compte Zernio", () => {
    expect(carte("buffer")).toContain("Ancien outil");
    expect(carte("zernio")).not.toContain("Ancien outil");
  });
});

describe("L7-06 suite · 4.5 « Changer d'outil » propose deux outils", () => {
  it("les deux outils, Zernio d'abord, l'actuel marqué (Zernio actuel)", () => {
    expect(outilsProposes("zernio")).toEqual([{ outil: "zernio", actuel: true, ancien: false }, { outil: "buffer", actuel: false, ancien: true }]);
  });
  it("les deux outils, l'actuel marqué (Buffer actuel)", () => {
    expect(outilsProposes("buffer")).toEqual([{ outil: "zernio", actuel: false, ancien: false }, { outil: "buffer", actuel: true, ancien: true }]);
  });
});
