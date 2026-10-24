/**
 * Stock de cas par métier · lot K6 : l'import ne garde que les fiches `retenu-will`, retire les champs de relecture, refuse
 * tout ou rien, trie par numéro de fiche et ne fait monter la version que d'un cas dont le contenu change. Aucun fichier
 * écrit dans le dépôt (fonction pure `importerStock`).
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { alerteCourte } from "@/formats/cas-concret/catalogue/alerte-courte";
import { importerStock, lireExistant, principal, type ResultatImport } from "../../../scripts/importer-stock-cas";

const RANGEMENT = {
  secteur: "IN",
  metier: "industrie.mecanique-metallurgie",
  metierNom: "Atelier d'usinage",
  taille: "TPE",
  socle: "S02",
  inventaire: ["A7"],
  niveauPreuve: "lu-dans-le-code",
  douleur: "demandes-entrantes",
  casUsage: "industrie.mecanique-metallurgie.integration.c03",
  voisinCatalogue: null,
  angle: "Ici on trie la demande avant le chiffrage.",
};

/** Une fiche de l'export, telle que le fichier de Will la porte (avec ses champs de relecture). */
function fiche(numero: string, id: string, mot: string, statut = "retenu-will", cas: Record<string, unknown> = {}) {
  return {
    numero,
    statut,
    qualite: 19,
    rangement: { fiche: numero, ...RANGEMENT, statut, qualite: 19, descriptionPorteB: "Un texte pour la porte B." },
    cas: { ...alerteCourte, id, mot, version: 1, ...cas },
  };
}
const exportDe = (...fiches: unknown[]) => ({ version: 1, genere: "2026-10-19", fiches });
const ok = (r: ResultatImport) => {
  if (!r.ok) throw new Error(`refus inattendus : ${JSON.stringify(r.refus)}`);
  return r;
};

describe("import du stock (K6)", () => {
  it("importe 3 fiches retenues, triées par numéro de fiche, sans statut ni qualité ni description porte B", () => {
    const r = ok(importerStock(exportDe(fiche("IN-10", "cas-dix", "DIXIEME"), fiche("IN-02", "cas-deux", "DEUXIEME"), fiche("BT-01", "cas-bt", "BATIMENT"), fiche("IN-03", "cas-ecarte", "ECARTE", "relu-opus"))));
    expect(r.fichier.cas.map((l) => l.rangement.fiche)).toEqual(["BT-01", "IN-02", "IN-10"]);
    expect(r.fichier.cas.map((l) => l.cas.id)).toEqual(["cas-bt", "cas-deux", "cas-dix"]);
    for (const l of r.fichier.cas) {
      expect(Object.keys(l.rangement)).not.toEqual(expect.arrayContaining(["statut"]));
      expect(l.rangement).not.toHaveProperty("statut");
      expect(l.rangement).not.toHaveProperty("qualite");
      expect(l.rangement).not.toHaveProperty("descriptionPorteB");
      expect(l).not.toHaveProperty("statut");
    }
    expect(r.nouveaux).toHaveLength(3);
    expect(r.versionsAugmentees).toEqual([]);
  });

  it("refuse tout si une fiche est invalide : liste tous les refus, n'écrit rien (aucun fichier en sortie)", () => {
    const mauvaise = fiche("IN-02", "cas-mauvais", "MAUVAIS", "retenu-will", { promesse: "Votre rendez-vous se confirme tout seul sans que personne ne bouge" });
    const doublon = fiche("IN-03", "alerte-courte", "AUTRE");
    const r = importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT"), mauvaise, doublon));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refus.map((x) => x.fiche)).toEqual(["IN-02", "IN-03"]);
    expect(r.refus[0]?.raisons.join(" ")).toMatch(/plus de 8 mots/);
    expect(r.refus[1]?.raisons.join(" ")).toMatch(/déjà pris/);
  });

  it("refuse un export sans fiche retenue ou sans liste de fiches", () => {
    expect(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT", "relu-opus"))).ok).toBe(false);
    expect(importerStock({}).ok).toBe(false);
    expect(importerStock(null).ok).toBe(false);
  });

  it("la version d'un cas déjà importé n'augmente que si son contenu change", () => {
    const premier = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT"), fiche("IN-02", "cas-stable", "STABLE"))));
    expect(premier.fichier.cas.map((l) => l.cas.version)).toEqual([1, 1]);

    // Même export : rien ne bouge.
    const identique = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT"), fiche("IN-02", "cas-stable", "STABLE")), premier.fichier));
    expect(identique.fichier).toEqual(premier.fichier);
    expect(identique.versionsAugmentees).toEqual([]);

    // Un cas change : sa version monte de 1, l'autre reste.
    const change = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT", "retenu-will", { resultat: "Un résultat réécrit." }), fiche("IN-02", "cas-stable", "STABLE")), premier.fichier));
    expect(change.fichier.cas.map((l) => l.cas.version)).toEqual([2, 1]);
    expect(change.versionsAugmentees).toEqual([{ id: "cas-bon", avant: 1, apres: 2 }]);

    // Et une deuxième retouche : 2 -> 3, sans repartir de la version de la fiche (toujours 1).
    const encore = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT", "retenu-will", { resultat: "Encore autre chose." }), fiche("IN-02", "cas-stable", "STABLE")), change.fichier));
    expect(encore.fichier.cas[0]?.cas.version).toBe(3);
  });

  it("un cas qui avait un récit ne le perd jamais par un import : refus, rien d'écrit", () => {
    const recit = { sujet: "Vos demandes arrivent sans le poids.", scene: "Un client écrit sans donner le poids. Votre équipe rappelle.", exemple: "la demande de ce client", motsCles: ["demandes", "poids"] };
    const avec = ok(importerStock(exportDe(fiche("IN-01", "cas-recit", "RECITMOT", "retenu-will", { recit }))));
    expect(avec.fichier.cas[0]?.cas.recit).toEqual(recit);
    // La source n'a plus le récit (export ancien) : refus, avec la fiche et la raison.
    const perdu = importerStock(exportDe(fiche("IN-01", "cas-recit", "RECITMOT")), avec.fichier);
    expect(perdu.ok).toBe(false);
    if (!perdu.ok) expect(JSON.stringify(perdu.refus)).toContain("reportez le récit dans le fichier source");
    // Le même export avec le récit passe, sans monter la version.
    const garde = ok(importerStock(exportDe(fiche("IN-01", "cas-recit", "RECITMOT", "retenu-will", { recit })), avec.fichier));
    expect(garde.versionsAugmentees).toEqual([]);
  });

  it("un cas retiré est signalé ; remis, il repart au moins à sa dernière version + 1 ; un cas jamais retiré reste inchangé", () => {
    const v1 = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT"), fiche("IN-02", "cas-stable", "STABLE"))));
    const v2 = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT", "retenu-will", { resultat: "Réécrit." }), fiche("IN-02", "cas-stable", "STABLE")), v1.fichier));
    expect(v2.fichier.cas[0]?.cas.version).toBe(2);
    // IN-01 sort du stock.
    const sans = ok(importerStock(exportDe(fiche("IN-02", "cas-stable", "STABLE")), v2.fichier));
    expect(sans.retires).toEqual(["cas-bon"]);
    expect(sans.fichier.retires).toEqual([{ id: "cas-bon", derniereVersion: 2 }]);
    expect(sans.fichier.cas[0]?.cas.version).toBe(1);
    // Un import de plus sans lui garde la mémoire du retrait.
    const encoreSans = ok(importerStock(exportDe(fiche("IN-02", "cas-stable", "STABLE")), sans.fichier));
    expect(encoreSans.retires).toEqual([]);
    expect(encoreSans.fichier.retires).toEqual([{ id: "cas-bon", derniereVersion: 2 }]);
    // Il revient avec la version 1 de sa fiche : il repart à 3, l'autre cas ne bouge pas.
    const retour = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT"), fiche("IN-02", "cas-stable", "STABLE")), encoreSans.fichier));
    expect(retour.fichier.cas.map((l) => l.cas.version)).toEqual([3, 1]);
    expect(retour.versionsAugmentees).toEqual([{ id: "cas-bon", avant: 2, apres: 3 }]);
    // Rien n'a été retiré : pas de champ retires.
    expect(v1.fichier).not.toHaveProperty("retires");
    expect(retour.fichier).not.toHaveProperty("retires");
  });

  it("stock.json absent (ENOENT) = aucun cas importé ; JSON invalide = erreur, code 1, rien d'écrit", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "stock-k6-"));
    const absent = join(dossier, "absent.json");
    expect(await lireExistant(absent)).toBeNull();

    const entree = join(dossier, "export.json");
    writeFileSync(entree, JSON.stringify(exportDe(fiche("IN-01", "cas-bon", "BONMOT"))));
    const casse = join(dossier, "casse.json");
    writeFileSync(casse, "{ pas du json");
    await expect(lireExistant(casse)).rejects.toBeTruthy();
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await principal([entree, "--sortie", casse])).toBe(1);
      expect(readFileSync(casse, "utf8")).toBe("{ pas du json");
      // Fichier absent : l'import se fait.
      expect(await principal([entree, "--sortie", absent])).toBe(0);
      expect(existsSync(absent)).toBe(true);
    } finally {
      erreur.mockRestore();
      log.mockRestore();
    }
  });

  it("une retouche du rangement seul ne change pas la version du cas", () => {
    const premier = ok(importerStock(exportDe(fiche("IN-01", "cas-bon", "BONMOT"))));
    const autre = fiche("IN-01", "cas-bon", "BONMOT");
    autre.rangement.angle = "Un autre angle de présentation.";
    const r = ok(importerStock(exportDe(autre), premier.fichier));
    expect(r.fichier.cas[0]?.cas.version).toBe(1);
    expect(r.fichier.cas[0]?.rangement.angle).toBe("Un autre angle de présentation.");
  });
});

const EXPORT_VRAIES_FICHES = process.env.STOCK_CAS_METIERS_JSON ?? "<fichier local non publié>";

describe.skipIf(!existsSync(EXPORT_VRAIES_FICHES))("import du stock · les VRAIES fiches (K6)", () => {
  it("toutes les fiches de l'export, marquées « retenu-will » en mémoire, passent l'import (chargeur et refus avant le prix) : zéro refus", () => {
    const exporte = JSON.parse(readFileSync(EXPORT_VRAIES_FICHES, "utf8").replace(/^\uFEFF/, "")) as { fiches: Array<Record<string, unknown>> };
    const marque = { ...exporte, fiches: exporte.fiches.map((f) => ({ ...f, statut: "retenu-will" })) };
    const r = importerStock(marque);
    expect(r.ok ? [] : r.refus.map((x) => `${x.fiche} ${x.id ?? ""} : ${x.raisons.join(" ; ")}`)).toEqual([]);
    if (!r.ok) return;
    expect(r.fichier.cas).toHaveLength(exporte.fiches.length);
    // Triées par numéro de fiche.
    const numeros = r.fichier.cas.map((l) => l.rangement.fiche);
    expect(numeros).toEqual([...numeros].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })));
    // Rejouer l'import sur son propre résultat ne change rien (aucune version ne monte).
    const encore = importerStock(marque, r.fichier);
    expect(encore.ok && encore.versionsAugmentees).toEqual([]);
  });
});
