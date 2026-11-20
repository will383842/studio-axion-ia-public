import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compterEchecs, type FamilleEchec, type LigneEchec } from "@/domaine/journal-echecs";
import { compterIssues, issueDe, type IssueEchec } from "@/domaine/issue-des-echecs";
import type { Travail } from "@/domaine/types";

type VueTravail = Pick<Travail, "statut" | "tentatives" | "reprise">;
const travail = (statut: Travail["statut"], tentatives = 1): VueTravail => ({ statut, tentatives });

function ligne(travailId: string, essai: number, code = "FOURNISSEUR_INDISPONIBLE", famille: FamilleEchec = "fournisseur", jour = essai): LigneEchec {
  return {
    date: `2026-11-${String(10 + jour).padStart(2, "0")}T10:00:00.000Z`,
    videoId: "v1",
    travailId,
    generateur: "g",
    moteur: "m",
    etape: "e",
    code,
    famille,
    phrase: "p",
    detail: "d",
    essai,
  };
}
const carte = (...paires: [string, VueTravail][]) => new Map<string, VueTravail>(paires);

describe("issueDe : les 4 issues", () => {
  it("travail absent, en échec ou annulé : resté à Williams", () => {
    const l = ligne("t", 1);
    expect(issueDe(l, undefined)).toBe("reste-a-williams");
    expect(issueDe(l, travail("echec"))).toBe("reste-a-williams");
    expect(issueDe(l, travail("annule"))).toBe("reste-a-williams");
  });
  it("en file ou en cours : encore en cours", () => {
    expect(issueDe(ligne("t", 1), travail("en_file"))).toBe("en-cours");
    expect(issueDe(ligne("t", 1), travail("en_cours"))).toBe("en-cours");
  });
  it("terminé après une panne rendue : reparti seul", () => {
    expect(issueDe(ligne("t", 1, "FACECAM_NON_RELIE", "reglage"), travail("termine"))).toBe("reparti-seul");
  });
  it("terminé après un autre échec : repris", () => {
    expect(issueDe(ligne("t", 1), travail("termine", 2))).toBe("repris");
  });
  it("même code de panne rendue mais travail en échec : resté à Williams", () => {
    expect(issueDe(ligne("t", 1, "FACECAM_NON_RELIE"), travail("echec"))).toBe("reste-a-williams");
  });
});

describe("compterIssues", () => {
  it("une ligne par issue", () => {
    const lignes = [ligne("a", 1, "FACECAM_NON_RELIE"), ligne("b", 1), ligne("c", 1), ligne("d", 1)];
    const t = carte(["a", travail("termine")], ["b", travail("termine", 2)], ["c", travail("en_cours")], ["d", travail("echec")]);
    expect(compterIssues(lignes, t)).toEqual({ "reparti-seul": 1, repris: 1, "en-cours": 1, "reste-a-williams": 1 });
  });
  it("3 essais puis terminé : compté une seule fois, repris", () => {
    const lignes = [ligne("a", 1), ligne("a", 2), ligne("a", 3)];
    expect(compterIssues(lignes, carte(["a", travail("termine", 4)]))).toEqual({ "reparti-seul": 0, repris: 1, "en-cours": 0, "reste-a-williams": 0 });
  });
  it("la ligne la plus récente décide, quel que soit l'ordre reçu", () => {
    const lignes = [ligne("a", 2, "IV_NON_RELIE"), ligne("a", 1, "FOURNISSEUR_INDISPONIBLE")];
    expect(compterIssues(lignes, carte(["a", travail("termine", 3)]))["reparti-seul"]).toBe(1);
  });
  it("les attentes de validation ne sont pas des échecs", () => {
    const l = ligne("a", 1, "IV_CARTE_A_VALIDER", "attente-validation");
    expect(compterIssues([l], carte(["a", travail("termine")]))).toEqual({ "reparti-seul": 0, repris: 0, "en-cours": 0, "reste-a-williams": 0 });
  });
  it("travail inconnu de la table : resté à Williams", () => {
    expect(compterIssues([ligne("x", 1)], new Map())["reste-a-williams"]).toBe(1);
  });
  it("le type IssueEchec couvre les 4 clés", () => {
    const cles: IssueEchec[] = ["reparti-seul", "repris", "en-cours", "reste-a-williams"];
    expect(Object.keys(compterIssues([], new Map())).sort()).toEqual([...cles].sort());
  });
});

describe("éteint = identique", () => {
  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return fichiers(chemin);
      return /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
    });
  }
  // S-13-AFFICHAGE-v19c 19/11 (voulue, verdict des 2 relecteurs) : liste fermée exacte, seule la page neuve importe le service.
  it("seule la page neuve importe issue-des-echecs (service) ; le domaine n'est importé que par le service", () => {
    const PAGE = join("src", "app", "(studio)", "reglages", "echecs", "issues", "page.tsx");
    const SERVICE = join("src", "services", "issue-des-echecs.ts");
    const fautifs = fichiers("src").filter((f) => !f.endsWith("issue-des-echecs.ts") && /issue-des-echecs/.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([PAGE]);
    const domaine = fichiers("src").filter((f) => f !== SERVICE && f !== join("src", "domaine", "issue-des-echecs.ts") && /domaine\/issue-des-echecs/.test(readFileSync(f, "utf8")));
    expect(domaine).toEqual([]);
  });
  it("compterEchecs rend le même bilan sur les lignes à plusieurs essais", () => {
    const lignes = [ligne("a", 1, "FOURNISSEUR_INDISPONIBLE", "fournisseur", 1), ligne("a", 2, "FOURNISSEUR_INDISPONIBLE", "fournisseur", 2), ligne("a", 3, "FOURNISSEUR_INDISPONIBLE", "fournisseur", 3)];
    const bilan = compterEchecs(lignes, "2026-11-14T12:00:00.000Z");
    expect(bilan.jours7.total).toBe(3);
    expect(bilan.jours7.parFamille).toEqual({ fournisseur: 3 });
    expect(bilan.jours30.parCode).toEqual({ FOURNISSEUR_INDISPONIBLE: 3 });
  });
});
