/**
 * C2-U5bis · cas concret : la capacité `texte.style-varie` (bibliothèque de la commande) ouvre les variantes de
 * sous-titres existantes, avec un marqueur de la charte. Sans entrée bibliothèque ou capacité non permise : rien ne change.
 */
import { describe, expect, it, vi } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { autoriserTexte } from "@/briques/charte/axion-2026";
import { MARQUEURS } from "@/briques/sous-titres/marqueur";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { MARQUEUR_STYLE_VARIE, SURLIGNAGE_CAS_CONCRET, surlignageCasConcret, VARIANTE_PAR_VIDEO } from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { TIRAGE_V4 } from "@/moteurs/montage-cas-concret/variete";
import { VARIANTE_PAR_VERSION } from "@/moteurs/montage-image-video/sous-titres-varies";
import { banc } from "../moteur/doubles";

const captures: Record<string, unknown>[] = [];
vi.mock("@/moteurs/montage-cas-concret/fabriquer", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-cas-concret/fabriquer")>();
  return { ...m, fabriquerCasConcret: (o: Record<string, unknown>) => { captures.push(o); return m.fabriquerCasConcret(o as never); } };
});

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
const surligne = { ...TIRAGE_V4.sousTitres, accent: "surlignage" as const };

function entree(permis: boolean | null): { bibliothequeVideo: EntreeBibliotheque } {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: (permis === null ? {} : { [ID.texteStyleVarie]: { permis } }) as ProfilVideo["capacites"], verrous: [] };
  return { bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-16" } };
}

/** Lance la fabrication jusqu'à l'appel de `fabriquerCasConcret` et rend les options reçues. */
async function optionsRecues(entreesEnPlus?: Record<string, unknown>): Promise<Record<string, unknown>> {
  captures.length = 0;
  const b = banc();
  const c0 = b.commande();
  const c: CommandeFabrication = entreesEnPlus ? { ...c0, entrees: { ...(c0.entrees as object), ...entreesEnPlus } } : c0;
  let t: Travail = await b.moteur.lancer(c, { travailId: "t-u5bis", versionId: "ver-u5bis", titre: "Essai", maintenant: T0 });
  for (let n = 0; n < 200 && !captures.length && t.statut !== "termine" && t.statut !== "echec"; n++) {
    t = (await b.moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, c, T0 + n * 1000)).travail;
  }
  expect(captures.length).toBeGreaterThan(0);
  return captures[0];
}

describe("C2-U5bis · constantes inchangées", () => {
  it("VARIANTE_PAR_VIDEO et VARIANTE_PAR_VERSION restent à false ; SURLIGNAGE_CAS_CONCRET garde sa valeur", () => {
    expect(VARIANTE_PAR_VIDEO).toBe(false);
    expect(VARIANTE_PAR_VERSION).toBe(false);
    expect(SURLIGNAGE_CAS_CONCRET).toEqual({ fond: SURLIGNAGE_CAS_CONCRET.fond, texte: SURLIGNAGE_CAS_CONCRET.texte, fondClair: SURLIGNAGE_CAS_CONCRET.fondClair, texteClair: SURLIGNAGE_CAS_CONCRET.texteClair });
    expect(surlignageCasConcret(surligne, true)).toEqual({ surlignage: SURLIGNAGE_CAS_CONCRET });
  });
});

describe("C2-U5bis · surlignage du chemin neuf", () => {
  it("avec marqueur : terracotta de la charte, lisible ; sans marqueur : SURLIGNAGE_CAS_CONCRET", () => {
    const r = surlignageCasConcret(surligne, true, MARQUEUR_STYLE_VARIE);
    expect(r.surlignage).toEqual(MARQUEURS.terracotta);
    expect(autoriserTexte(r.surlignage!.texte, r.surlignage!.fond)).toBe(true);
    expect(surlignageCasConcret(surligne, true).surlignage).toBe(SURLIGNAGE_CAS_CONCRET);
  });
  it("sans surlignage tiré ou inactif : rien", () => {
    expect(surlignageCasConcret(TIRAGE_V4.sousTitres, true, MARQUEUR_STYLE_VARIE)).toEqual({});
    expect(surlignageCasConcret(surligne, false, MARQUEUR_STYLE_VARIE)).toEqual({});
  });
});

describe("C2-U5bis · index.ts : options passées à fabriquerCasConcret", () => {
  it("aucune entrée bibliothèque : pas de clé styleVarie", async () => {
    expect(Object.keys(await optionsRecues())).not.toContain("styleVarie");
  });
  it("capacité non permise ou sans règle : pas de clé styleVarie, options identiques à « aucune entrée »", async () => {
    const sans = await optionsRecues();
    for (const p of [false, null] as const) {
      const o = await optionsRecues(entree(p));
      expect(Object.keys(o)).not.toContain("styleVarie");
      expect(Object.keys(o).sort()).toEqual(Object.keys(sans).sort());
    }
  });
  it("capacité permise : styleVarie === true", async () => {
    expect((await optionsRecues(entree(true))).styleVarie).toBe(true);
  });
});

