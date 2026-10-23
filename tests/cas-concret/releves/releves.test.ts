/**
 * P2S · lot B · relevés par publication sur la fiche d'une vidéo : état vide, ligne par réseau, aucune personne.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { PHRASE_SANS_RELEVE, Releves } from "../../../src/components/formats/cas-concret/releves/Releves";
import type { LigneSuivi } from "../../../src/services/cas-concret-suivi";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const { suiviDesVideos } = await import("@/services/cas-concret-suivi");

const MDP = "cas-concret-releves";
const texteDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const ligne = (o: Partial<LigneSuivi>): LigneSuivi => ({ videoId: "v", titre: "t", reseau: "facebook", date: "2026-10-12", codeSuivi: "0042-CC-FB", visites: 0, mesure: false, ...o });

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Réglage `casConcret.releves` allumé DANS LE DOUBLE seulement (éteint par défaut dans le studio).
  await ecrireParametre("casConcret.releves", true);
});

describe("bloc des relevés (pur)", () => {
  it("état vide : « Pas encore de relevé »", () => {
    expect(texteDe(renderToStaticMarkup(createElement(Releves, { lignes: [] })))).toContain(PHRASE_SANS_RELEVE);
    expect(texteDe(renderToStaticMarkup(createElement(Releves, { lignes: [ligne({}), ligne({ reseau: "instagram" })] })))).toContain(PHRASE_SANS_RELEVE);
  });

  it("par réseau : vues, visites venues du lien, code de version ; jamais de personne", () => {
    const t = texteDe(renderToStaticMarkup(createElement(Releves, { lignes: [ligne({ vues: 400, visites: 12, mesure: true }), ligne({ reseau: "instagram", visites: 5, mesure: true })] })));
    expect(t).toContain("Facebook");
    expect(t).toContain("Vues : 400");
    expect(t).toContain("Visites venues du lien : 12");
    expect(t).toContain("Code de version : 0042-CC-FB");
    expect(t).toContain("Instagram");
    expect(t).toContain("Vues : pas encore de mesure");
    expect(t).not.toMatch(/prospect|rendez-vous|guide|fichier clients|personne/i);
  });
});

describe("suiviDesVideos({ videoId })", () => {
  it("ne rend que les lignes de cette vidéo", async () => {
    const base = (await depots().videos.obtenir("v-03"))!;
    for (const id of ["cc-1", "cc-2"]) {
      await depots().videos.enregistrer({ ...base, id, formatId: "cas-concret", statut: "terminee", entrees: { casConcret: { codeSuivi: `cc-${id}`, reseaux: ["facebook", "instagram"], essai: false } } } as never);
    }
    const s = await suiviDesVideos({ videoId: "cc-1", visites: { mode: "simulation", lire: async () => null } });
    expect(s.lignes.map((l) => l.videoId)).toEqual(["cc-1", "cc-1"]);
  });
});
