/** L7-26 : conservation durable des commentaires et de « À traiter ». ON GARDE TOUT. Personnes et textes inventés, aucun réseau. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarteATraiter } from "@/services/a-traiter-types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const D = await import("@/services/commentaires-depot");
const { creerDepotParametre } = await import("@/services/a-traiter-depot");

const AUTEUR_A = `p1.abcd1234.${"a".repeat(64)}`;
const AUTEUR_B = `p1.abcd1234.${"b".repeat(64)}`;
const JOUR = 86_400_000;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (jours: number) => new Date(T0 + jours * JOUR).toISOString();

const com = (id: string, plus: Partial<import("@/services/commentaires-depot").NouveauCommentaire> = {}) => ({
  idEvenement: id, reseau: "linkedin", post: "post_1", auteur: AUTEUR_A, texte: `Texte inventé numéro ${id}, merci pour la vidéo`, recuLe: iso(0), ...plus,
});
const carte = (id: string): CarteATraiter => ({
  idEvenement: id, reseau: "tiktok", post: "post_1", lienPost: null, mot: "GUIDE", motif: "mot_manuel",
  extrait: "GUIDE", creeLe: iso(0), statut: "a_traiter", kit: null,
});

let alertes: { titre: string; message: string }[];
const nouveau = (jours = 0) => D.creerDepotCommentaires({ maintenant: () => iso(jours), alerter: async (a) => void alertes.push(a) });

beforeEach(() => {
  reinitialiserDepots();
  vi.unstubAllEnvs();
  alertes = [];
});

describe("conservation : aucune suppression, aucune durée qui efface", () => {
  it("un commentaire de 91 jours est toujours présent et lisible, à l'identique", async () => {
    await nouveau(0).enregistrer(com("e1"));
    const plusTard = nouveau(91);
    const l = await plusTard.lire();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ idEvenement: "e1", texte: "Texte inventé numéro e1, merci pour la vidéo", auteur: AUTEUR_A, recuLe: iso(0) });
    expect(await nouveau(3650).lire()).toHaveLength(1);
  });
  it("un nouvel enregistrement ne touche jamais les lignes anciennes", async () => {
    const d = nouveau(0);
    await d.enregistrer(com("e1"));
    const d91 = nouveau(91);
    await d91.enregistrer(com("e2", { recuLe: iso(91) }));
    expect((await d91.lire()).map((x) => x.idEvenement)).toEqual(["e1", "e2"]);
  });
  it("aucune porte de suppression, de purge ou d'anonymisation n'est exposée", () => {
    const noms = [...Object.keys(D), ...Object.keys(nouveau())].join(" ").toLowerCase();
    for (const mot of ["supprim", "purg", "anonym", "effacer", "delete", "remove", "retention", "conservation_jours"]) expect(noms).not.toContain(mot);
  });
  it("un doublon d'événement est ignoré sans écraser la ligne existante", async () => {
    const d = nouveau();
    expect(await d.enregistrer(com("e1"))).toBe("cree");
    expect(await d.enregistrer(com("e1", { texte: "Autre texte inventé" }))).toBe("deja_present");
    const l = await d.lire();
    expect(l).toHaveLength(1);
    expect(l[0]!.texte).toContain("numéro e1");
  });
  it("écritures simultanées : aucune ligne perdue", async () => {
    const d = nouveau();
    await Promise.all(["a", "b", "c", "d", "e"].map((i) => d.enregistrer(com(i))));
    expect(await d.lire()).toHaveLength(5);
  });
  it("redémarrage simulé : un autre dépôt relit tout", async () => {
    await nouveau().enregistrer(com("e1"));
    expect(await nouveau(91).lire()).toHaveLength(1);
  });
  it("contenu illisible : lire et écrire lèvent, rien n'est écrasé", async () => {
    await Com.ecrireParametre(D.PARAM_COMMENTAIRES_DEPOT, { pas: "une liste" });
    const d = nouveau();
    await expect(d.lire()).rejects.toThrow();
    await expect(d.enregistrer(com("e1"))).rejects.toThrow();
    expect(await Com.lireParametre(D.PARAM_COMMENTAIRES_DEPOT, null)).toEqual({ pas: "une liste" });
  });
  it("auteur : empreinte seulement, jamais d'e-mail ni d'identifiant brut", async () => {
    const d = nouveau();
    for (const mauvais of ["marie@exemple.fr", "12345", "", "@pseudo"]) await expect(d.enregistrer(com("e1", { auteur: mauvais }))).rejects.toThrow("auteur_invalide");
    expect(await d.lire()).toEqual([]);
  });
  it("l'empreinte d'auteur est stable, distincte par personne, et ne contient pas l'identifiant", () => {
    const a = D.empreinteAuteur("contact_inventé_1");
    expect(a).toBe(D.empreinteAuteur("contact_inventé_1"));
    expect(a).not.toBe(D.empreinteAuteur("contact_inventé_2"));
    expect(a).not.toContain("inventé");
  });
  it("« À traiter » : une carte de 91 jours reste lisible, une écriture ne retire rien", async () => {
    const d = creerDepotParametre();
    await d.ecrire([carte("c1"), carte("c2")]);
    await d.ecrire([carte("c3")]);
    expect((await creerDepotParametre().lire()).map((c) => c.idEvenement).sort()).toEqual(["c1", "c2", "c3"]);
  });
});

describe("opposition ou demande d'effacement : écart des envois, alerte, journal, aucune suppression", () => {
  it("met la personne à l'écart sans supprimer aucune ligne", async () => {
    const d = nouveau(10);
    await d.enregistrer(com("e1"));
    await d.enregistrer(com("e2", { auteur: AUTEUR_B }));
    await d.enregistrer(com("e3"));
    const r = await d.demanderEffacement(AUTEUR_A);
    expect(r).toEqual({ lignesEcartees: 2 });
    const l = await d.lire();
    expect(l).toHaveLength(3);
    expect(l.find((x) => x.idEvenement === "e1")).toMatchObject({ ecarteDesEnvois: true, demandeEffacementLe: iso(10), texte: "Texte inventé numéro e1, merci pour la vidéo" });
    expect(l.find((x) => x.idEvenement === "e2")?.ecarteDesEnvois).toBe(false);
    expect((await d.listerPourEnvoi()).map((x) => x.idEvenement)).toEqual(["e2"]);
    expect(await d.auteurEcarte(AUTEUR_A)).toBe(true);
    expect(await d.auteurEcarte(AUTEUR_B)).toBe(false);
  });
  it("lève une alerte pour le fondateur, une seule par demande, sans texte ni identifiant", async () => {
    const d = nouveau();
    await d.enregistrer(com("e1"));
    await d.demanderEffacement(AUTEUR_A);
    expect(alertes).toHaveLength(1);
    const s = JSON.stringify(alertes);
    expect(s).not.toContain(AUTEUR_A);
    expect(s).not.toContain("Texte inventé");
    expect(s).toContain("décid");
  });
  it("écrit une ligne de journal sans texte ni identifiant de personne", async () => {
    const d = nouveau();
    await d.enregistrer(com("e1"));
    await d.demanderEffacement(AUTEUR_A);
    const evs = await depots().evenements.lister((e) => e.type === "commentaire_effacement_demande");
    expect(evs).toHaveLength(1);
    expect(JSON.stringify(await depots().evenements.lister())).not.toMatch(/Texte inventé|p1\.abcd1234/);
  });
  it("demande pour un auteur sans ligne : alerte et journal quand même (zéro ligne écartée), l'auteur reste écarté pour l'avenir", async () => {
    const d = nouveau();
    expect(await d.demanderEffacement(AUTEUR_B)).toEqual({ lignesEcartees: 0 });
    expect(alertes).toHaveLength(1);
    await d.enregistrer(com("e9", { auteur: AUTEUR_B }));
    expect((await d.lire())[0]!.ecarteDesEnvois).toBe(true);
    expect(await d.listerPourEnvoi()).toEqual([]);
  });
  it("répéter la demande ne perd rien et garde la date de la première", async () => {
    await nouveau(10).enregistrer(com("e1"));
    await nouveau(10).demanderEffacement(AUTEUR_A);
    await nouveau(50).demanderEffacement(AUTEUR_A);
    const l = await nouveau(60).lire();
    expect(l).toHaveLength(1);
    expect(l[0]!.demandeEffacementLe).toBe(iso(10));
  });
  it("auteur invalide : lève, rien n'est écrit, aucune alerte", async () => {
    await expect(nouveau().demanderEffacement("marie@exemple.fr")).rejects.toThrow("auteur_invalide");
    expect(alertes).toEqual([]);
  });
  it("l'alerte échoue : la mise à l'écart est tout de même faite, la demande remonte l'erreur", async () => {
    const d = D.creerDepotCommentaires({ maintenant: () => iso(0), alerter: async () => { throw new Error("cloche"); } });
    await d.enregistrer(com("e1"));
    await expect(d.demanderEffacement(AUTEUR_A)).rejects.toThrow();
    const l = await d.lire();
    expect(l).toHaveLength(1);
    expect(l[0]!.ecarteDesEnvois).toBe(true);
  });
  it("aucun appel réseau, aucun envoi", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const d = nouveau();
    await d.enregistrer(com("e1"));
    await d.demanderEffacement(AUTEUR_A);
    expect(f).not.toHaveBeenCalled();
  });
});
