/**
 * FACE CAMÉRA ANIMÉE — LOT A « Socle » : fiche (code FA, masquée, sans musique, charte interface-claire/1), moteur
 * squelette au contrat commun (`testerMoteurVideo`, sans prix), et INDÉPENDANCE : le face caméra n'est pas touché.
 * Fournisseurs simulés, AUCUN appel réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { testerMoteurVideo } = await import("@/moteurs/contrat");
const { obtenirMoteur, choisirMoteurAuLancement } = await import("@/moteurs");
const { moteurMontageFacecamAnimee, etapesFabrication, CHARTE_FACECAM_ANIMEE } = await import("@/moteurs/montage-facecam-animee");
const formats = await import("@/formats");
const { codeDuFormat } = await import("@/formats/registre-codes");

import type { CommandeFabrication } from "@/domaine/types";

const MDP = "essai-facecam-animee-lot-a";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

async function commandeFacecamAnimee(): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return { ...c, formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"] };
}

testerMoteurVideo(moteurMontageFacecamAnimee, commandeFacecamAnimee, { sansPrix: true });

describe("face caméra animée · fiche (lot A)", () => {
  it("inscrite, code FA, active mais réservée à Will, son propre moteur, sans prix", () => {
    const f = formats.obtenirFormat("facecam-animee");
    expect(codeDuFormat("facecam-animee")).toBe("FA");
    expect(f.codeClassement).toBe("FA");
    expect(f.statut).toBe("actif");
    expect(f.reserveAWill).toBe(true);
    expect(formats.listerFormatsActifs().some((x) => x.id === "facecam-animee")).toBe(false);
    expect(formats.listerFormats().some((x) => x.id === "facecam-animee")).toBe(false);
    expect(formats.listerFormats({ inclureMasques: true }).some((x) => x.id === "facecam-animee")).toBe(true);
    expect(f.moteur).toBe("montage-facecam-animee");
    expect(choisirMoteurAuLancement("facecam-animee")).toBe("montage-facecam-animee");
    expect(f.sansPrix).toBe(true);
    expect(f.ratios).toEqual(["9:16"]);
  });

  it("prise filmée de Will (jamais d'avatar), aucune musique, bruitages et charte déclarés", () => {
    const f = formats.obtenirFormat("facecam-animee");
    expect(f.personnages.sources).toEqual(["rush"]);
    expect(f.pieces?.voix).toBe("prise-filmee");
    expect(f.musique).toBe("interdite");
    expect(f.pieces?.habillage).toBe(CHARTE_FACECAM_ANIMEE);
    expect(f.pieces?.sons?.length).toBeGreaterThan(0);
    expect(f.illustrations.sourcesAutorisees).not.toContain("generee-ia");
  });

  it("textes au vouvoiement, sans les mots interdits d'Axion-IA", () => {
    const f = formats.obtenirFormat("facecam-animee");
    const textes = JSON.stringify([f.nom, f.accroche, f.description, f.recetteScript, f.aFournir]);
    // Bornes tenant compte des accents (« \b » couperait « étiquettes » après le « é »).
    expect(textes).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu);
    expect(textes).not.toMatch(/villeexemple|gain garanti|certifexemple/i);
  });
});

describe("face caméra animée · moteur (lot A)", () => {
  it("refuse tout lancement réel tant que le chantier n'est pas fini", () => {
    expect(moteurMontageFacecamAnimee.refusAuLancement?.({} as never)).toMatchObject({ code: "FACECAM_ANIMEE_EN_CHANTIER" });
  });

  it("déclare la mise en scène, les photos et les bruitages ; sous le plafond Claude, pas de relecture", async () => {
    const c = await commandeFacecamAnimee();
    const cles = etapesFabrication(c).map((e) => e.cle);
    expect(cles).toEqual(expect.arrayContaining(["reception", "coupes", "mise-en-scene", "images", "bruitages", "montage", "export", "controle", "relecture"]));
    const simple = etapesFabrication({ ...c, plafondClaudeAtteint: true });
    expect(simple.map((e) => e.cle)).not.toContain("relecture");
    expect(simple.find((e) => e.cle === "mise-en-scene")?.nom).toMatch(/règles fixes/);
  });
});

describe("face caméra animée · indépendance (lot A)", () => {
  it("le face caméra garde sa fiche, son code et son moteur", () => {
    const fc = formats.obtenirFormat("facecam");
    expect(fc.codeClassement).toBe("FC");
    expect(fc.moteur).toBe("montage-facecam");
    expect(fc.statut).toBe("actif");
    expect(obtenirMoteur("montage-facecam").id).toBe("montage-facecam");
    expect(obtenirMoteur("montage-facecam-animee")).toBe(moteurMontageFacecamAnimee);
  });
});
