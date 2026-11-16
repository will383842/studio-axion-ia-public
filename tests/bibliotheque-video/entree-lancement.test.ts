import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const commun = await import("@/services/_commun");
const { entreeBibliothequeDuLancement, lecteurDepuisEntree } = await import("@/services/bibliotheque-video");
const { lireEntreeBibliotheque } = await import("@/briques/bibliotheque-video/schema");
const { profilDuFormat } = await import("@/briques/bibliotheque-video/profils");
const { graineDe } = await import("@/briques/bibliotheque-video/graine");
const { lecteurDepuisEntree: lecteurBrique } = await import("@/briques/bibliotheque-video/lecteur");

const CLE = "bibliothequeVideo.cas-concret";
const video = { id: "vidEnCours", formatId: "cas-concret" };
const jour = (n: number) => `2026-11-${String(n).padStart(2, "0")}T10:00:00.000Z`;
const versionFigee = (n: number, cle: string) => ({
  id: `ver${n}`, videoId: `vid${n}`, statut: "prete", creeLe: jour(n),
  commande: { formatId: "cas-concret", entrees: { bibliothequeVideo: { choix: [{ capacite: "texte.style-varie", cle }] } } },
}) as never;

beforeEach(() => { reinitialiserDepots(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("réglage éteint ou illisible → {} sans aucune clé", () => {
  it.each([["absent", undefined], ["false", false], ["oui", "oui"], ["autre clé", { autre: 1 }]])("%s", async (_n, valeur) => {
    if (valeur !== undefined) await commun.ecrireParametre(CLE, valeur);
    const r = await entreeBibliothequeDuLancement(video);
    expect(r).toEqual({});
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("lecture qui lève", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("boum"));
    expect(await entreeBibliothequeDuLancement(video)).toEqual({});
  });
});

describe("estimation", () => {
  it("{} et aucune lecture de dépôt", async () => {
    await commun.ecrireParametre(CLE, true);
    const espions = [vi.spyOn(depots().parametres, "obtenir"), vi.spyOn(depots().versions, "lister"), vi.spyOn(depots().travaux, "lister")];
    expect(await entreeBibliothequeDuLancement(video, { estimation: true })).toEqual({});
    for (const e of espions) expect(e).not.toHaveBeenCalled();
  });
});

describe("réglage allumé", () => {
  it("true : entrée valide, profil du code, aucune capacité neuve", async () => {
    await commun.ecrireParametre(CLE, true);
    const r = await entreeBibliothequeDuLancement(video);
    const entree = lireEntreeBibliotheque(r);
    expect(entree).not.toBeNull();
    expect(entree?.profil).toEqual(profilDuFormat("cas-concret"));
    expect(entree?.choix).toBeUndefined();
    expect(Object.keys(r)).toEqual(["bibliothequeVideo"]);
  });

  it("capacité listée : permise dans le profil figé, profil du code inchangé", async () => {
    await commun.ecrireParametre(CLE, { capacites: ["texte.surlignage-marqueur"] });
    const entree = lireEntreeBibliotheque(await entreeBibliothequeDuLancement(video));
    expect(entree?.profil.capacites["texte.surlignage-marqueur"]?.permis).toBe(true);
    expect(profilDuFormat("cas-concret").capacites["texte.surlignage-marqueur"]?.permis).toBe(false);
  });

  it("listée inconnue, absente ou verrouillée : ignorée", async () => {
    await commun.ecrireParametre(CLE, { capacites: ["texte.inconnue-du-profil", "calque.texte-derriere-double"] });
    const entree = lireEntreeBibliotheque(await entreeBibliothequeDuLancement(video));
    expect(entree?.profil).toEqual(profilDuFormat("cas-concret"));
    await commun.ecrireParametre("bibliothequeVideo.facecam-animee", { capacites: ["etalonnage.lut-clair-obscur"] });
    const fa = lireEntreeBibliotheque(await entreeBibliothequeDuLancement({ id: "v", formatId: "facecam-animee" }));
    expect(fa?.profil).toEqual(profilDuFormat("facecam-animee"));
  });

  it("graine stable, figeeLe = maintenant(), recents = mémoire fusionnée", async () => {
    await commun.ecrireParametre(CLE, true);
    for (let n = 1; n <= 3; n++) await depots().versions.enregistrer(versionFigee(n, `s${n}`));
    vi.spyOn(commun, "maintenant").mockReturnValue("2026-11-20T00:00:00.000Z");
    const a = lireEntreeBibliotheque(await entreeBibliothequeDuLancement(video));
    const b = lireEntreeBibliotheque(await entreeBibliothequeDuLancement(video));
    expect(a?.graine).toBe(graineDe("vidEnCours", "cas-concret"));
    expect(a?.graine).toBe(b?.graine);
    expect(a?.figeeLe).toBe("2026-11-20T00:00:00.000Z");
    expect(a?.recents.map((r) => r.videoId)).toEqual(["vid3", "vid2", "vid1"]);
  });

  it("fenêtre respectée", async () => {
    await commun.ecrireParametre(CLE, true);
    const fenetre = profilDuFormat("cas-concret").memoire.fenetreVideos;
    for (let n = 1; n <= fenetre + 5; n++) await depots().versions.enregistrer(versionFigee(n, `s${n}`));
    const entree = lireEntreeBibliotheque(await entreeBibliothequeDuLancement(video));
    expect(new Set(entree?.recents.map((r) => r.videoId)).size).toBe(fenetre);
  });

  it("une mémoire qui lève : entrée construite, autres sources gardées", async () => {
    await commun.ecrireParametre(CLE, true);
    await depots().versions.enregistrer(versionFigee(1, "s1"));
    vi.spyOn(depots().travaux, "lister").mockRejectedValue(new Error("boum"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const entree = lireEntreeBibliotheque(await entreeBibliothequeDuLancement(video));
    expect(entree).not.toBeNull();
    expect(entree?.recents.map((r) => r.videoId)).toEqual(["vid1"]);
  });
});

describe("ré-export et garde", () => {
  it("lecteurDepuisEntree est celui de la brique", () => {
    expect(lecteurDepuisEntree).toBe(lecteurBrique);
  });

  it("aucune écriture, aucun argent, aucun fournisseur", () => {
    for (const f of ["src/services/bibliotheque-video.ts", "src/briques/bibliotheque-video/permissions.ts"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s).not.toMatch(/ecrireParametre/);
      expect(s).not.toMatch(/from\s+"@\/fournisseurs/);
      const imports = s.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/budget|argent|plafond|cout|prix/i);
    }
  });
});
