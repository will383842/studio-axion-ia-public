import { describe, expect, it } from "vitest";
import type { StatutPublication } from "@/domaine/types";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { STATUTS_PLAN, TRANSITIONS, STATUTS_ECRITS_PAR_USINE, transitionAutorisee, transitionner, verifierMiseAJour, validerCreneau, enregistrerDecalage, fusionnerDecalages, heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import { IMAGE_PUBLICATION, statutPlanDepuisPublication, statutPublicationDepuisPlan } from "@/domaine/plan-editorial/correspondances";

const base: CreneauEditorial = {
  id: "c1",
  jourVise: "2026-12-01",
  heuresParReseau: { linkedin: "2026-12-01T08:30:00.000Z" },
  compteCible: "compte-fictif",
  statut: "propose",
  decalages: 0,
  videoId: "v1",
};

describe("transitions du plan", () => {
  it("accepte une transition listée et refuse toutes les autres", () => {
    let listees = 0;
    for (const a of STATUTS_PLAN) for (const b of STATUTS_PLAN) {
      const ok = TRANSITIONS[a].includes(b);
      expect(transitionAutorisee(a, b)).toBe(ok);
      if (ok) listees++;
    }
    expect(listees).toBeGreaterThan(0);
    expect(transitionAutorisee("publie", "propose")).toBe(false);
    expect(transitionAutorisee("propose", "publie")).toBe(false);
    expect(transitionAutorisee("propose", "propose")).toBe(false);
  });
  it("transitionner refuse une transition non listée et ne mute pas", () => {
    const r = transitionner(base, "publie", "studio");
    expect(r.ok).toBe(false);
    expect(base.statut).toBe("propose");
    const ok = transitionner(base, "a_valider", "usine");
    expect(ok.ok && ok.creneau.statut).toBe("a_valider");
  });
  it("l'usine n'écrit jamais programme, publie ni echec", () => {
    expect([...STATUTS_ECRITS_PAR_USINE]).not.toContain("programme");
    expect([...STATUTS_ECRITS_PAR_USINE]).not.toContain("publie");
    expect([...STATUTS_ECRITS_PAR_USINE]).not.toContain("echec");
    const valide = { ...base, statut: "valide" as const };
    for (const cible of ["programme", "publie", "echec"] as const) {
      expect(transitionner(valide, cible, "usine").ok).toBe(false);
    }
    expect(transitionner(valide, "programme", "studio").ok).toBe(true);
  });
});

describe("correspondance avec les statuts de Publication", () => {
  const EXISTANTS: StatutPublication[] = ["brouillon", "programmee", "publiee", "echec"];
  it("chaque valeur existante a son image", () => {
    expect(Object.keys(IMAGE_PUBLICATION).sort()).toEqual([...EXISTANTS].sort());
    for (const p of EXISTANTS) expect(STATUTS_PLAN).toContain(statutPlanDepuisPublication(p));
  });
  it("va-et-vient cohérent pour programme, publie, echec", () => {
    expect(statutPublicationDepuisPlan("programme")).toBe("programmee");
    expect(statutPublicationDepuisPlan("publie")).toBe("publiee");
    expect(statutPublicationDepuisPlan("echec")).toBe("echec");
    expect(statutPublicationDepuisPlan("propose")).toBe("brouillon");
    expect(statutPlanDepuisPublication("publiee")).toBe("publie");
  });
});

describe("validation du créneau", () => {
  it("accepte un créneau avec une vidéo seule ou un visuel seul", () => {
    expect(validerCreneau(base)).toEqual([]);
    expect(validerCreneau({ ...base, videoId: undefined, visuelId: "x1" })).toEqual([]);
  });
  it("refuse videoId ET visuelId ensemble", () => {
    expect(validerCreneau({ ...base, visuelId: "x1" }).length).toBeGreaterThan(0);
  });
  it("refuse jour, heure ou compte invalides", () => {
    expect(validerCreneau({ ...base, jourVise: "01/12/2026" }).length).toBeGreaterThan(0);
    expect(validerCreneau({ ...base, heuresParReseau: { linkedin: "08:30" } }).length).toBeGreaterThan(0);
    expect(validerCreneau({ ...base, compteCible: "" }).length).toBeGreaterThan(0);
  });
});

describe("décalages", () => {
  it("ne diminue jamais", () => {
    const a = enregistrerDecalage(base);
    expect(a.decalages).toBe(1);
    expect(enregistrerDecalage(a).decalages).toBe(2);
    expect(base.decalages).toBe(0);
    expect(fusionnerDecalages(3, 1)).toBe(3);
    expect(fusionnerDecalages(1, 3)).toBe(3);
    expect(validerCreneau({ ...base, decalages: -1 }).length).toBeGreaterThan(0);
  });
  it("transitionner ne fait jamais baisser decalages", () => {
    const r = transitionner({ ...base, decalages: 2 }, "a_valider", "usine");
    expect(r.ok && r.creneau.decalages).toBe(2);
  });
});

describe("heure : stockage UTC, affichage Europe/Paris", () => {
  it("affiche l'heure de Paris en hiver et en été", () => {
    expect(heureAffichageParis("2026-12-01T08:30:00.000Z")).toBe("09:30");
    expect(heureAffichageParis("2026-07-01T08:30:00.000Z")).toBe("10:30");
  });
});

describe("corrections après relecture", () => {
  it("refuse un jour qui n'existe pas (30 février) et une heure inexistante", () => {
    expect(validerCreneau({ ...base, jourVise: "2026-02-30" }).length).toBeGreaterThan(0);
    expect(validerCreneau({ ...base, heuresParReseau: { linkedin: "2026-02-31T08:00:00Z" } }).length).toBeGreaterThan(0);
    expect(validerCreneau({ ...base, jourVise: "2028-02-29" })).toEqual([]);
    expect(validerCreneau({ ...base, jourVise: "2027-02-29" }).length).toBeGreaterThan(0);
  });
  it("la liste des réseaux du plan est celle de la taxonomie (non-divergence)", async () => {
    const { RESEAUX_TAXONOMIE } = await import("@/domaine/taxonomie-contenu");
    const { IDS_RESEAUX_PLAN } = await import("@/domaine/plan-editorial/correspondances");
    expect([...IDS_RESEAUX_PLAN]).toEqual([...RESEAUX_TAXONOMIE]);
  });
  it("verifierMiseAJour refuse une baisse de decalages", () => {
    const ancien = { ...base, decalages: 2 };
    expect(verifierMiseAJour(ancien, { ...ancien, decalages: 0 }).ok).toBe(false);
    expect(verifierMiseAJour(ancien, { ...ancien, decalages: 1 }).ok).toBe(false);
    expect(verifierMiseAJour(ancien, { ...ancien, decalages: 2 }).ok).toBe(true);
    expect(verifierMiseAJour(ancien, { ...ancien, decalages: 3 }).ok).toBe(true);
  });
});
