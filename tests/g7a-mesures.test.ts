/**
 * G7a : MESURE MINIMALE (plan v5 B.5.5, B.8 §2). Critères de la ligne G7a : saisie J+3 / J+7 (3 mesures), version et
 * identifiant Buffer écrits à l'envoi, lien suivi par version, tuile « Mesures à saisir », aucune prédiction.
 * Dépôts en mémoire, envoi Buffer SIMULÉ (aucun appel réseau).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { controlerSaisie, DEFINITIONS_MESURES, echeanceMesure, instantParis, lienDeVersion, lireNombreFr, PAGE_SUIVIE_PAR_DEFAUT, pageDuLien, partagesParPortee } from "@/domaine/mesures";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const pub = await import("@/services/publications");
const mes = await import("@/services/mesures");

const MDP = "essai-g7a-mesures";
const JOUR = 86_400_000;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Sujet TikTok, version validée, vidéo v-02 rangée dessous, « Avant de publier » coché. */
async function versionTikTok() {
  await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
  const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: ["tiktok", "linkedin"], formatId: "avocat" });
  const e = await gen.ecrireSujetSimule(s.id);
  if (!e.ok) throw new Error("écriture refusée");
  const vue = (await gen.obtenirSujet(s.id))!;
  const tt = vue.versions.find((v) => v.variante.reseau === "tiktok")!.variante;
  await gen.validerVersions([tt.id]);
  await gen.rangerVideo("v-02", tt.id);
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier("v-02", c, true);
  return { sujetId: s.id, variante: (await depots().variantes.obtenir(tt.id))! };
}

const SAISIE = { abandon3s: 38.5, dureeMoyenneSec: 14.2, partages: 12, portee: 2400 };

describe("échéances J+3 et J+7 (pur)", () => {
  const base = { via: "manuel" as const, statut: "publiee" as const, date: "2026-10-01T09:00:00.000Z", varianteId: "var-1" };
  const a = (jours: number) => new Date(Date.parse(base.date) + jours * JOUR);
  it("rien avant J+3, J+3 de J+3 à J+7, J+7 ensuite ; un relevé fait n'est plus demandé", () => {
    expect(echeanceMesure(base, a(2.9))).toBeNull();
    expect(echeanceMesure(base, a(3))).toBe(3);
    expect(echeanceMesure(base, a(6.9))).toBe(3);
    expect(echeanceMesure({ ...base, releves: [{ le: "", jour: 3, source: "saisie", valeurs: { vues: 0, likes: 0, commentaires: 0, partages: 0 }, definitions: {} }] }, a(5))).toBeNull();
    expect(echeanceMesure(base, a(7))).toBe(7);
    expect(echeanceMesure({ ...base, releves: [{ le: "", jour: 7, source: "saisie", valeurs: { vues: 0, likes: 0, commentaires: 0, partages: 0 }, definitions: {} }] }, a(9))).toBeNull();
  });
  it("jamais un essai, jamais une publication sans version, jamais un brouillon", () => {
    expect(echeanceMesure({ ...base, via: "simulation" }, a(4))).toBeNull();
    expect(echeanceMesure({ ...base, varianteId: undefined }, a(4))).toBeNull();
    expect(echeanceMesure({ ...base, statut: "brouillon" }, a(4))).toBeNull();
    expect(echeanceMesure({ ...base, statut: "programmee", via: "buffer" }, a(4))).toBe(3);
  });
});

describe("saisie en un écran : 3 mesures (pur)", () => {
  it("abandon à 3 s, durée moyenne, partages ÷ portée (calculé, jamais saisi)", () => {
    const r = controlerSaisie(SAISIE);
    expect(r).toEqual({ ok: true, valeurs: { tauxAbandon3s: 38.5, dureeMoyenneVueSec: 14.2, partages: 12, portee: 2400, partagesParPortee: 0.5 } });
    expect(partagesParPortee(1, 3)).toBe(33.33);
  });
  it("bornes : pourcentage 0-100, entiers pour partages et portée, portée ≥ 1", () => {
    expect(controlerSaisie({ ...SAISIE, abandon3s: 101 })).toMatchObject({ ok: false, champ: "abandon3s" });
    expect(controlerSaisie({ ...SAISIE, partages: 1.5 })).toMatchObject({ ok: false, champ: "partages" });
    expect(controlerSaisie({ ...SAISIE, portee: 0 })).toMatchObject({ ok: false, champ: "portee" });
    expect(controlerSaisie({ ...SAISIE, dureeMoyenneSec: Number.NaN })).toMatchObject({ ok: false, champ: "dureeMoyenneSec" });
  });
  it("clavier français : « 38,5 », « 2 400 », « 12 % »", () => {
    expect(lireNombreFr("38,5")).toBe(38.5);
    expect(lireNombreFr("2 400")).toBe(2400);
    expect(lireNombreFr("12 %")).toBe(12);
    expect(lireNombreFr("")).toBeNaN();
    expect(lireNombreFr("abc")).toBeNaN();
  });
});

describe("lien suivi par version (pur)", () => {
  it("page permise du site + utm_source=<réseau>&utm_medium=video&utm_campaign=<code>&utm_content=<activité>", () => {
    expect(lienDeVersion("https://axion-ia.com/fr/guide-ia", { reseau: "tiktok", code: "0042-AV-TT" })).toBe(
      "https://axion-ia.com/fr/guide-ia?utm_source=tiktok&utm_medium=video&utm_campaign=0042-AV-TT&utm_content=clients",
    );
  });
  it("jamais une réservation directe ni un autre site : retour à la page par défaut", () => {
    for (const p of ["https://calendly.com/axion/30min", "https://axion-ia.com/reserver", "http://axion-ia.com/", "https://exemple.com/", "https://axion-ia.com/", "pas une adresse"]) {
      expect(pageDuLien(p), p).toBe("/fr/diagnostic");
    }
    expect(pageDuLien(PAGE_SUIVIE_PAR_DEFAUT)).toBe("/fr/diagnostic");
    expect(pageDuLien("https://axion-ia.com/fr/appel?depuis=video-tiktok")).toBe("/fr/appel");
  });
  it("code ou réseau refusé : aucun lien, jamais un lien faux", () => {
    expect(lienDeVersion(undefined, { reseau: "tiktok", code: "v-02" })).toBeUndefined();
    expect(lienDeVersion(undefined, { reseau: "twitter", code: "0042-AV-TT" })).toBeUndefined();
  });
});

describe("heure de Paris", () => {
  it("9 h à Paris en heure d'été et d'hiver", () => {
    expect(instantParis("2026-10-06", "09:00")).toBe("2026-10-06T07:00:00.000Z");
    expect(instantParis("2026-11-02", "09:00")).toBe("2026-11-02T08:00:00.000Z");
  });
});

describe("à l'envoi : version, identifiant Buffer et lien suivi écrits sur la publication", () => {
  it("envoi (simulé) : varianteId, idExterne et lienSuivi ; le kit montre le lien suivi de la version", async () => {
    const { variante } = await versionTikTok();
    const kit = await pub.obtenirKit("v-02");
    expect(kit?.variante?.champs.lienSuivi).toBe(lienDeVersion(PAGE_SUIVIE_PAR_DEFAUT, variante));
    expect(kit?.variante?.sujetId).toBe(variante.scriptMaitreId);
    const r = await pub.envoyerVersBuffer("v-02", ["tiktok"], "2026-10-06T07:00:00.000Z");
    expect(r.simulation).toBe(true);
    expect(r.publications[0]).toMatchObject({ reseau: "tiktok", varianteId: variante.id, via: "simulation", statut: "brouillon" });
    expect(r.publications[0].idExterne).toBeTruthy();
    expect(r.publications[0].lienSuivi).toContain(`utm_campaign=${variante.code}`);
    // Un essai n'est jamais mesuré.
    expect(await mes.listerMesuresASaisir(new Date("2026-10-20T00:00:00Z"))).toHaveLength(0);
  });

  it("le lien suit la page réglée par Will (`publication.pageSuivie`)", async () => {
    const { variante } = await versionTikTok();
    await depots().parametres.enregistrer({ id: "publication.pageSuivie", valeur: "https://axion-ia.com/fr/diagnostic", creeLe: "2026-10-02T00:00:00Z", modifieLe: "2026-10-02T00:00:00Z" });
    expect(await mes.lienSuiviVersion(variante)).toBe(`https://axion-ia.com/fr/diagnostic?utm_source=tiktok&utm_medium=video&utm_campaign=${variante.code}&utm_content=clients`);
  });

  it("« Je l'ai publiée moi-même » sur le réseau de la version : la publication porte la version et son lien suivi", async () => {
    const { variante } = await versionTikTok();
    const p = await pub.noterPublicationManuelle("v-02", "tiktok", "2026-10-01T09:00:00.000Z", "publiee");
    expect(p).toMatchObject({ varianteId: variante.id, via: "manuel", statut: "publiee" });
    expect(p.lienSuivi).toContain("utm_source=tiktok");
    // Ailleurs que sur son réseau : pas de version (rien n'est mesuré au nom de la version).
    const ailleurs = await pub.noterPublicationManuelle("v-02", "linkedin", "2026-10-01T09:00:00.000Z", "publiee");
    expect(ailleurs.varianteId).toBeUndefined();
  });
});

describe("mesures à saisir : J+3 puis J+7, en ajout seul", () => {
  async function publiee() {
    const { variante } = await versionTikTok();
    const p = await pub.noterPublicationManuelle("v-02", "tiktok", "2026-10-01T09:00:00.000Z", "publiee");
    return { variante, p };
  }

  it("la tuile compte les vidéos attendues ; la liste porte le code, le réseau et J+3", async () => {
    const { variante, p } = await publiee();
    expect(await mes.compterMesuresASaisir(new Date("2026-10-03T09:00:00Z"))).toBe(0);
    expect(await mes.compterMesuresASaisir(new Date("2026-10-04T10:00:00Z"))).toBe(1);
    const l = await mes.listerMesuresASaisir(new Date("2026-10-04T10:00:00Z"));
    expect(l).toEqual([expect.objectContaining({ publicationId: p.id, code: variante.code, reseau: "tiktok", jour: 3 })]);
  });

  it("une publication gardée dont la vidéo a été supprimée n'est plus proposée à la saisie (ni comptée)", async () => {
    await publiee();
    const instant = new Date("2026-10-04T10:00:00Z");
    expect(await mes.compterMesuresASaisir(instant)).toBe(1);
    await depots().videos.supprimer("v-02");
    expect(await mes.listerMesuresASaisir(instant)).toEqual([]);
    expect(await mes.compterMesuresASaisir(instant)).toBe(0);
  });

  it("enregistrer J+3 puis J+7 : deux relevés datés avec leurs définitions, le premier jamais écrasé", async () => {
    const { p } = await publiee();
    const j3 = await mes.enregistrerMesures(p.id, SAISIE, new Date("2026-10-04T10:00:00Z"));
    expect(j3.releves).toHaveLength(1);
    expect(j3.releves![0]).toMatchObject({ jour: 3, source: "saisie", le: "2026-10-04T10:00:00.000Z", valeurs: { tauxAbandon3s: 38.5, dureeMoyenneVueSec: 14.2, partagesParPortee: 0.5, portee: 2400 } });
    expect(j3.releves![0].definitions).toEqual(DEFINITIONS_MESURES);
    expect(j3.stats).toMatchObject({ tauxAbandon3s: 38.5 });
    await expect(mes.enregistrerMesures(p.id, SAISIE, new Date("2026-10-05T10:00:00Z"))).rejects.toMatchObject({ code: "RIEN_A_SAISIR" });
    expect(await mes.compterMesuresASaisir(new Date("2026-10-05T10:00:00Z"))).toBe(0);
    expect((await mes.listerMesuresASaisir(new Date("2026-10-08T10:00:00Z")))[0]).toMatchObject({ jour: 7 });
    const j7 = await mes.enregistrerMesures(p.id, { ...SAISIE, abandon3s: 41, partages: 30, portee: 6000 }, new Date("2026-10-08T10:00:00Z"));
    expect(j7.releves!.map((r) => r.jour)).toEqual([3, 7]);
    expect(j7.releves![0].valeurs.tauxAbandon3s).toBe(38.5);
    expect(j7.stats).toMatchObject({ tauxAbandon3s: 41, partagesParPortee: 0.5 });
    expect(await mes.compterMesuresASaisir(new Date("2026-12-01T00:00:00Z"))).toBe(0);
    const saisies = await mes.listerMesuresSaisies();
    expect(saisies.map((s) => s.jour)).toEqual([7, 3]);
  });

  it("une saisie hors bornes est refusée, rien n'est écrit", async () => {
    const { p } = await publiee();
    await expect(mes.enregistrerMesures(p.id, { ...SAISIE, abandon3s: 140 }, new Date("2026-10-04T10:00:00Z"))).rejects.toMatchObject({ code: "SAISIE" });
    expect((await depots().publications.obtenir(p.id))?.releves).toBeUndefined();
  });

  it("une publication programmée (Buffer) qu'on mesure passe publiée, la vidéo aussi", async () => {
    const { variante } = await versionTikTok();
    await depots().publications.enregistrer({ id: "pub-buffer", videoId: "v-02", reseau: "tiktok", statut: "programmee", via: "buffer", date: "2026-10-01T07:00:00.000Z", texte: "", idExterne: "buf-1", varianteId: variante.id, creeLe: "2026-10-01T00:00:00Z", modifieLe: "2026-10-01T00:00:00Z" });
    await mes.enregistrerMesures("pub-buffer", SAISIE, new Date("2026-10-04T10:00:00Z"));
    expect((await depots().publications.obtenir("pub-buffer"))?.statut).toBe("publiee");
    expect((await depots().videos.obtenir("v-02"))?.etapeEditoriale).toBe("publiee");
  });
});

describe("aucune prédiction", () => {
  it("le relevé ne contient que les chiffres saisis (et les compteurs d'avant), aucune valeur estimée", async () => {
    const { variante } = await versionTikTok();
    const p = await pub.noterPublicationManuelle("v-02", "tiktok", "2026-10-01T09:00:00.000Z", "publiee");
    expect(p.varianteId).toBe(variante.id);
    const r = await mes.enregistrerMesures(p.id, SAISIE, new Date("2026-10-04T10:00:00Z"));
    expect(Object.keys(r.releves![0].valeurs).sort()).toEqual(["commentaires", "dureeMoyenneVueSec", "likes", "partages", "partagesParPortee", "portee", "tauxAbandon3s", "vues"]);
  });

  it("ni l'écran, ni le service, ni le domaine ne parlent de prévision ; lexique interdit absent de l'écran", () => {
    const racine = join(__dirname, "..");
    const lire = (f: string) => readFileSync(join(racine, f), "utf8");
    const ecran = [lire("src/components/generateur/SaisieMesures.tsx"), lire("src/app/(studio)/mesures/page.tsx")].join("\n");
    for (const f of [ecran, lire("src/services/mesures.ts"), lire("src/domaine/mesures.ts")]) expect(f).not.toMatch(/pr[ée]vision|pr[ée]vu(es?)? de vues|vues attendues|estimation de vues/i);
    const textes = [...ecran.matchAll(/>([^<>{}]+)</g), ...ecran.matchAll(/(?:libelle|titre|description|phrase|message): "([^"]+)"/g)].map((m) => m[1]).join(" ");
    expect(textes).not.toMatch(/\b(job|render|prompt|token|API|upload|pipeline|workflow|mock|fictif|dashboard|avatar)\b/i);
    expect(textes).toMatch(/Partis avant 3 s/);
  });
});
