/** L7-26 : conservation durable des commentaires et de « À traiter ». ON GARDE TOUT. Personnes et textes inventés, aucun réseau. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CarteATraiter } from "@/services/a-traiter-types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const D = await import("@/services/commentaires-depot");
const { empreintesOpposees, enregistrerOppositionParEmpreinte, enregistrerOppositionPersonne, enregistrerOpposition } = await import("@/services/oppositions-mots");
const { creerDepotParametre } = await import("@/services/a-traiter-depot");

const AUTEUR_A = D.empreinteAuteur("contact_inventé_a");
const AUTEUR_B = D.empreinteAuteur("contact_inventé_b");
const FORMES_A = D.empreintesAuteur("contact_inventé_a");
const FORMES_B = D.empreintesAuteur("contact_inventé_b");
const formesDe = (auteur: string): string[] => (auteur === AUTEUR_B ? FORMES_B : FORMES_A);
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

/** `formesAuteur` est OBLIGATOIRE : ce petit assistant ne fait que le fournir à partir de l'auteur de la ligne. */
const enr = (d: import("@/services/commentaires-depot").DepotCommentaires, c: import("@/services/commentaires-depot").NouveauCommentaire) => d.enregistrer(c, formesDe(c.auteur));

let alertes: { titre: string; message: string }[];
const nouveau = (jours = 0) => D.creerDepotCommentaires({ maintenant: () => iso(jours), alerter: async (a) => void alertes.push(a) });

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  reinitialiserDepots();
  vi.unstubAllEnvs();
  alertes = [];
});

describe("conservation : aucune suppression, aucune durée qui efface", () => {
  it("un commentaire de 91 jours est toujours présent et lisible, à l'identique", async () => {
    await enr(nouveau(0), com("e1"));
    const plusTard = nouveau(91);
    const l = await plusTard.lire();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ idEvenement: "e1", texte: "Texte inventé numéro e1, merci pour la vidéo", auteur: AUTEUR_A, recuLe: iso(0) });
    expect(await nouveau(3650).lire()).toHaveLength(1);
  });
  it("un nouvel enregistrement ne touche jamais les lignes anciennes", async () => {
    const d = nouveau(0);
    await enr(d, com("e1"));
    const d91 = nouveau(91);
    await enr(d91, com("e2", { recuLe: iso(91) }));
    expect((await d91.lire()).map((x) => x.idEvenement)).toEqual(["e1", "e2"]);
  });
  it("aucune porte de suppression, de purge ou d'anonymisation n'est exposée", () => {
    const noms = [...Object.keys(D), ...Object.keys(nouveau())].join(" ").toLowerCase();
    for (const mot of ["supprim", "purg", "anonym", "effacer", "delete", "remove", "retention", "conservation_jours"]) expect(noms).not.toContain(mot);
  });
  it("un doublon d'événement est ignoré sans écraser la ligne existante", async () => {
    const d = nouveau();
    expect(await enr(d, com("e1"))).toBe("cree");
    expect(await enr(d, com("e1", { texte: "Autre texte inventé" }))).toBe("deja_present");
    const l = await d.lire();
    expect(l).toHaveLength(1);
    expect(l[0]!.texte).toContain("numéro e1");
  });
  it("écritures simultanées : aucune ligne perdue", async () => {
    const d = nouveau();
    await Promise.all(["a", "b", "c", "d", "e"].map((i) => enr(d, com(i))));
    expect(await d.lire()).toHaveLength(5);
  });
  it("redémarrage simulé : un autre dépôt relit tout", async () => {
    await enr(nouveau(), com("e1"));
    expect(await nouveau(91).lire()).toHaveLength(1);
  });
  it("contenu illisible : lire et écrire lèvent, rien n'est écrasé", async () => {
    await Com.ecrireParametre(D.PARAM_COMMENTAIRES_DEPOT, { pas: "une liste" });
    const d = nouveau();
    await expect(d.lire()).rejects.toThrow("commentaires_illisibles");
    await expect(enr(d, com("e1"))).rejects.toThrow("commentaires_illisibles");
    expect(await Com.lireParametre(D.PARAM_COMMENTAIRES_DEPOT, null)).toEqual({ pas: "une liste" });
  });
  it("auteur : empreinte seulement, jamais d'e-mail ni d'identifiant brut", async () => {
    const d = nouveau();
    for (const mauvais of ["marie@exemple.fr", "12345", "", "@pseudo"]) await expect(enr(d, com("e1", { auteur: mauvais }))).rejects.toThrow("auteur_invalide");
    expect(await d.lire()).toEqual([]);
  });
  it("l'empreinte d'auteur est stable, distincte par personne, et ne contient pas l'identifiant", () => {
    const a = D.empreinteAuteur("contact_inventé_1");
    expect(a).toBe(D.empreinteAuteur("contact_inventé_1"));
    expect(a).not.toBe(D.empreinteAuteur("contact_inventé_2"));
    expect(a).not.toContain("inventé");
  });
  it("« À traiter » : une carte de 91 jours reste lisible, une écriture ne retire rien", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(T0);
      const d = creerDepotParametre();
      await d.ecrire([carte("c1"), carte("c2")]);
      vi.setSystemTime(T0 + 91 * JOUR);
      await d.ecrire([{ ...carte("c3"), creeLe: iso(91) }]);
      const l = await creerDepotParametre().lire();
      expect(l.map((c) => c.idEvenement).sort()).toEqual(["c1", "c2", "c3"]);
      expect(l.find((c) => c.idEvenement === "c1")).toMatchObject({ creeLe: iso(0), extrait: "GUIDE", statut: "a_traiter" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("opposition ou demande d'effacement : écart des envois, alerte, journal, aucune suppression", () => {
  it("met la personne à l'écart sans supprimer aucune ligne", async () => {
    const d = nouveau(10);
    await enr(d, com("e1"));
    await enr(d, com("e2", { auteur: AUTEUR_B }));
    await enr(d, com("e3"));
    const r = await d.demanderEffacement(AUTEUR_A, FORMES_A);
    expect(r).toEqual({ lignesEcartees: 2 });
    const l = await d.lire();
    expect(l).toHaveLength(3);
    expect(l.find((x) => x.idEvenement === "e1")).toMatchObject({ ecarteDesEnvois: true, demandeEffacementLe: iso(10), texte: "Texte inventé numéro e1, merci pour la vidéo" });
    expect(l.find((x) => x.idEvenement === "e2")?.ecarteDesEnvois).toBe(false);
    expect((await d.listerPourEnvoi()).map((x) => x.idEvenement)).toEqual(["e2"]);
    expect(await d.auteurEcarte(AUTEUR_A, FORMES_A)).toBe(true);
    expect(await d.auteurEcarte(AUTEUR_B, FORMES_B)).toBe(false);
  });
  it("lève une alerte pour le fondateur, une seule par demande, sans texte ni identifiant", async () => {
    const d = nouveau();
    await enr(d, com("e1"));
    await d.demanderEffacement(AUTEUR_A, FORMES_A);
    expect(alertes).toHaveLength(1);
    const s = JSON.stringify(alertes);
    expect(s).not.toContain(AUTEUR_A);
    expect(s).not.toContain("Texte inventé");
    expect(s).toContain("décid");
  });
  it("écrit une ligne de journal sans texte ni identifiant de personne", async () => {
    const d = nouveau();
    await enr(d, com("e1"));
    await d.demanderEffacement(AUTEUR_A, FORMES_A);
    const evs = await depots().evenements.lister((e) => e.type === "commentaire_effacement_demande");
    expect(evs).toHaveLength(1);
    expect(JSON.stringify(await depots().evenements.lister())).not.toMatch(/Texte inventé|p1\.|[0-9a-f]{32}/);
  });
  it("demande pour un auteur sans ligne : alerte et journal quand même (zéro ligne écartée), l'auteur reste écarté pour l'avenir", async () => {
    const d = nouveau();
    expect(await d.demanderEffacement(AUTEUR_B, FORMES_B)).toEqual({ lignesEcartees: 0 });
    expect(alertes).toHaveLength(1);
    await enr(d, com("e9", { auteur: AUTEUR_B }));
    expect((await d.lire())[0]!.ecarteDesEnvois).toBe(true);
    expect(await d.listerPourEnvoi()).toEqual([]);
  });
  it("répéter la demande ne perd rien et garde la date de la première", async () => {
    await enr(nouveau(10), com("e1"));
    await nouveau(10).demanderEffacement(AUTEUR_A, FORMES_A);
    await nouveau(50).demanderEffacement(AUTEUR_A, FORMES_A);
    const l = await nouveau(60).lire();
    expect(l).toHaveLength(1);
    expect(l[0]!.demandeEffacementLe).toBe(iso(10));
  });
  it("auteur invalide : lève, rien n'est écrit, aucune alerte", async () => {
    await expect(nouveau().demanderEffacement("marie@exemple.fr", ["marie@exemple.fr"])).rejects.toThrow("auteur_invalide");
    expect(alertes).toEqual([]);
  });
  it("l'alerte échoue : la mise à l'écart est tout de même faite, la demande remonte l'erreur", async () => {
    const d = D.creerDepotCommentaires({ maintenant: () => iso(0), alerter: async () => { throw new Error("cloche"); } });
    await enr(d, com("e1"));
    await expect(d.demanderEffacement(AUTEUR_A, FORMES_A)).rejects.toThrow("cloche");
    const l = await d.lire();
    expect(l).toHaveLength(1);
    expect(l[0]!.ecarteDesEnvois).toBe(true);
  });
  it("aucun appel réseau, aucun envoi", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const d = nouveau();
    await enr(d, com("e1"));
    await d.demanderEffacement(AUTEUR_A, FORMES_A);
    expect(f).not.toHaveBeenCalled();
  });
  it("une opposition inscrite au registre commun (mots.oppositions) écarte les lignes, ailleurs qu'ici", async () => {
    const d = nouveau();
    await enr(d, com("e1"));
    await enr(d, com("e2", { auteur: AUTEUR_B }));
    await enregistrerOppositionParEmpreinte(AUTEUR_A);
    expect(await d.auteurEcarte(AUTEUR_A, FORMES_A)).toBe(true);
    expect((await d.listerPourEnvoi()).map((x) => x.idEvenement)).toEqual(["e2"]);
    expect(await d.lire()).toHaveLength(2);
    await enr(d, com("e3"));
    expect((await d.lire()).find((x) => x.idEvenement === "e3")?.ecarteDesEnvois).toBe(true);
  });
  it("une demande d'effacement inscrit la personne au registre commun mots.oppositions", async () => {
    await nouveau().demanderEffacement(AUTEUR_A, FORMES_A);
    expect(await empreintesOpposees([AUTEUR_A])).toBe(true);
    expect(await empreintesOpposees([AUTEUR_B])).toBe(false);
  });
  it("rotation du secret d'empreinte : la personne opposée sous l'ancien secret reste écartée avec les formes de son identifiant", async () => {
    const ancien = "ancien-secret-fictif-de-test-0123456789abcdef";
    const courant = process.env.STUDIO_EMPREINTE_SECRET!;
    vi.stubEnv("STUDIO_EMPREINTE_SECRET", ancien);
    const vieille = D.empreinteAuteur("contact_inventé_r");
    await enregistrerOppositionPersonne(["contact_inventé_r"], []);
    vi.stubEnv("STUDIO_EMPREINTE_SECRET", courant);
    vi.stubEnv("STUDIO_EMPREINTE_SECRET_ANCIEN", ancien);
    const nouvelle = D.empreinteAuteur("contact_inventé_r");
    expect(nouvelle).not.toBe(vieille);
    const d = nouveau();
    await d.enregistrer(com("e1", { auteur: nouvelle }), D.empreintesAuteur("contact_inventé_r"));
    expect((await d.lire())[0]!.ecarteDesEnvois).toBe(true);
    expect(await d.auteurEcarte(nouvelle, D.empreintesAuteur("contact_inventé_r"))).toBe(true);
    // Échec fermé : la ligne écartée n'est jamais proposée à l'envoi (garde le drapeau de ligne, indépendamment du registre).
    expect(await d.listerPourEnvoi()).toEqual([]);
  });
  it("kid inconnu ou forme héritée : refusés avant toute écriture, le registre commun reste lisible, aucune alerte", async () => {
    const d = nouveau();
    const inconnu = `p1.deadbeef.${"a".repeat(64)}`;
    const heritee = "b".repeat(32);
    for (const mauvais of [inconnu, heritee]) {
      await expect(d.demanderEffacement(mauvais, [mauvais])).rejects.toThrow("auteur_invalide");
      await expect(enr(d, com("e1", { auteur: mauvais }))).rejects.toThrow("auteur_invalide");
    }
    expect(alertes).toEqual([]);
    expect(await d.lire()).toEqual([]);
    expect(await empreintesOpposees([AUTEUR_A])).toBe(false);
    expect(await Com.lireParametre("mots.oppositions", [])).toEqual([]);
  });
  it("la forme héritée reste admise comme forme de recherche seulement", async () => {
    const d = nouveau();
    await d.enregistrer(com("e1"), [AUTEUR_A, "c".repeat(32)]);
    expect(await d.auteurEcarte(AUTEUR_A, [AUTEUR_A, "c".repeat(32)])).toBe(false);
  });
  it("dépôt illisible : la demande est tout de même journalisée et alertée, puis l'erreur remonte", async () => {
    await Com.ecrireParametre(D.PARAM_COMMENTAIRES_DEPOT, { pas: "une liste" });
    await expect(nouveau().demanderEffacement(AUTEUR_A, FORMES_A)).rejects.toThrow("commentaires_illisibles");
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.message).toContain("pas pu être mises à jour");
    expect(await depots().evenements.lister((e) => e.type === "commentaire_effacement_demande")).toHaveLength(1);
    expect(await empreintesOpposees([AUTEUR_A])).toBe(true);
  });
  it("champs vides, non textuels ou date invalide : refusés", async () => {
    const d = nouveau();
    for (const mauvais of [{ idEvenement: "" }, { reseau: " " }, { post: "" }, { texte: "" }, { recuLe: "pas une date" }, { texte: 5 as unknown as string }]) await expect(enr(d, com("e1", mauvais))).rejects.toThrow("commentaire_invalide");
    expect(await d.lire()).toEqual([]);
  });
  it("registre commun illisible : la demande est tout de même journalisée et alertée, puis l'erreur remonte", async () => {
    await Com.ecrireParametre("mots.oppositions", { pas: "une liste" });
    await expect(nouveau().demanderEffacement(AUTEUR_A, FORMES_A)).rejects.toBeInstanceOf(Error);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.message).toContain("registre commun");
    expect(await depots().evenements.lister((e) => e.type === "commentaire_effacement_demande")).toHaveLength(1);
  });
  it("rotation, autre sens : ligne écrite sous l'ancien secret, opposition inscrite ensuite sous la forme courante seule : la ligne n'est pas proposée à l'envoi", async () => {
    const ancien = "ancien-secret-fictif-de-test-0123456789abcdef";
    const courant = process.env.STUDIO_EMPREINTE_SECRET!;
    vi.stubEnv("STUDIO_EMPREINTE_SECRET", ancien);
    const vieille = D.empreinteAuteur("contact_inventé_s");
    const formesVieille = D.empreintesAuteur("contact_inventé_s");
    await nouveau().enregistrer(com("e1", { auteur: vieille }), formesVieille);
    vi.stubEnv("STUDIO_EMPREINTE_SECRET", courant);
    vi.stubEnv("STUDIO_EMPREINTE_SECRET_ANCIEN", ancien);
    await enregistrerOpposition("contact_inventé_s");
    const d = nouveau();
    expect(await d.listerPourEnvoi()).toEqual([]);
    expect(await d.lire()).toHaveLength(1);
  });
  it("formesAuteur est obligatoire : absente ou ne contenant pas l'auteur, enregistrer, demanderEffacement et auteurEcarte lèvent auteur_invalide, sans rien écrire ni alerter", async () => {
    const d = nouveau();
    type Ouvert = { enregistrer(c: unknown, f?: unknown): Promise<unknown>; demanderEffacement(a: string, f?: unknown): Promise<unknown>; auteurEcarte(a: string, f?: unknown): Promise<unknown> };
    const o = d as unknown as Ouvert;
    const autre = [AUTEUR_B];
    for (const f of [undefined, [], autre]) {
      await expect(o.enregistrer(com("e1"), f)).rejects.toThrow("auteur_invalide");
      await expect(o.demanderEffacement(AUTEUR_A, f)).rejects.toThrow("auteur_invalide");
      await expect(o.auteurEcarte(AUTEUR_A, f)).rejects.toThrow("auteur_invalide");
    }
    expect(await d.lire()).toEqual([]);
    expect(alertes).toEqual([]);
    expect(await depots().evenements.lister((e) => e.type === "commentaire_effacement_demande")).toHaveLength(0);
    expect(await empreintesOpposees([AUTEUR_A])).toBe(false);
  });
  it("une ligne sous le secret courant et sans opposition est proposée à l'envoi", async () => {
    const d = nouveau();
    await enr(d, com("e1"));
    expect((await d.listerPourEnvoi()).map((x) => x.idEvenement)).toEqual(["e1"]);
  });
});
