/** Page À publier, finitions : ligne compte + date, message de succès, vidéo suivante. */
import { describe, expect, it } from "vitest";
import { dateLisible, ligneCompteEtDate, messageSucces, videoSuivante } from "@/components/publication/finitions-envoi";
import type { LigneAPublier } from "@/services/a-publier";

const ligne = (videoId: string, reseau: string, etat?: { envoye: boolean }) => ({ videoId, reseau, cle: `${videoId}:${reseau}`, compte: {}, casesRequises: [], coches: {}, etat }) as unknown as LigneAPublier;

describe("ligne compte + date", () => {
  it("montre le compte et la date en une ligne", () => {
    const t = ligneCompteEtDate(["Axion IA"], "2026-10-05T09:00");
    expect(t).toContain("Compte : Axion IA");
    expect(t).toContain("octobre");
    expect(t).not.toContain("\n");
  });
  it("sans compte connu ou date illisible : le dit", () => {
    expect(ligneCompteEtDate([], "")).toBe("Compte : Compte lu au premier envoi · Date à choisir");
    expect(dateLisible("n'importe quoi")).toBeNull();
  });
  it("l'écran demande de cocher un compte : dit « aucun compte coché »", () => {
    expect(ligneCompteEtDate([], "", true)).toBe("Compte : aucun compte coché · Date à choisir");
    expect(ligneCompteEtDate(["A"], "", true)).toContain("Compte : A");
  });
  it("plusieurs comptes cochés : tous nommés", () => {
    expect(ligneCompteEtDate(["A", "B"], "")).toContain("A, B");
  });
});

describe("message de succès", () => {
  it("brouillon : dit l'état Brouillon dans Buffer", () => {
    expect(messageSucces("brouillon", 1)).toContain("brouillon dans Buffer");
  });
  it("programmé : dit programmée", () => {
    expect(messageSucces("programmer", 2)).toContain("programmée dans Buffer sur 2 comptes");
  });
});

describe("vidéo suivante", () => {
  const lignes = [ligne("v1", "instagram"), ligne("v2", "instagram", { envoye: true }), ligne("v3", "instagram"), ligne("v4", "tiktok")];
  it("prend la prochaine vidéo à envoyer, jamais l'actuelle ni une déjà envoyée", () => {
    expect(videoSuivante(lignes, "v1", "instagram")).toContain("/a-publier/v3");
  });
  it("sur un réseau ouvert, reste sur ce réseau", () => {
    expect(videoSuivante(lignes, "v3", "tiktok")).toContain("/a-publier/v4");
    expect(videoSuivante(lignes, "v4", "tiktok")).toBeNull();
  });
  it("suit le réseau demandé (celui du panneau), pas un autre : un panneau tiktok mène à une vidéo tiktok", () => {
    expect(videoSuivante(lignes, "v1", "tiktok")).toContain("/a-publier/v4");
    expect(videoSuivante(lignes, "v1", "tous")).toContain("/a-publier/v3");
  });
  it("filtre actif : « envoyées » mène à une vidéo envoyée, pas à une vidéo à envoyer", () => {
    expect(videoSuivante(lignes, "v1", "instagram", "envoyees")).toContain("/a-publier/v2");
    expect(videoSuivante(lignes, "v1", "instagram", "envoyees")).toContain("filtre=envoyees");
    const l2 = [ligne("v1", "instagram"), ligne("v2", "instagram", { envoye: true })];
    expect(videoSuivante(l2, "v1", "instagram", "a-envoyer")).toBeNull();
  });
  it("aucune autre vidéo : pas de bouton", () => {
    expect(videoSuivante([ligne("v1", "instagram")], "v1", "tous")).toBeNull();
  });
});
