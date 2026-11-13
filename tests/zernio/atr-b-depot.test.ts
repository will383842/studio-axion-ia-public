/** ATR-B : dépôt persistant de la file « À traiter » (paramètre a_traiter.cartes). Données fictives, aucun réseau. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarteATraiter } from "@/services/a-traiter-types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const { creerDepotParametre, PARAM_CARTES_A_TRAITER } = await import("@/services/a-traiter-depot");
const A = await import("@/services/a-traiter");

const carte = (id: string, plus: Partial<CarteATraiter> = {}): CarteATraiter => ({
  idEvenement: id, reseau: "tiktok", post: "post_1", lienPost: null, mot: "GUIDE", motif: "mot_manuel",
  extrait: "GUIDE", creeLe: "2026-01-01T00:00:00.000Z", statut: "a_traiter", kit: null, ...plus,
});

beforeEach(() => {
  reinitialiserDepots();
  vi.unstubAllEnvs();
});

describe("creerDepotParametre", () => {
  it("nom du paramètre figé", () => expect(PARAM_CARTES_A_TRAITER).toBe("a_traiter.cartes"));
  it("vide au départ ; écriture puis relecture par un autre dépôt (redémarrage simulé)", async () => {
    expect(await creerDepotParametre().lire()).toEqual([]);
    await creerDepotParametre().ecrire([carte("e1"), carte("e2")]);
    expect((await creerDepotParametre().lire()).map((c) => c.idEvenement)).toEqual(["e1", "e2"]);
  });
  it("une écriture ne fait jamais disparaître une carte (fusion par idEvenement)", async () => {
    const d = creerDepotParametre();
    await d.ecrire([carte("e1"), carte("e2")]);
    await d.ecrire([carte("e3")]);
    expect((await d.lire()).map((c) => c.idEvenement).sort()).toEqual(["e1", "e2", "e3"]);
  });
  it("la version écrite l'emporte pour un même idEvenement, sans doublon", async () => {
    const d = creerDepotParametre();
    await d.ecrire([carte("e1"), carte("e2")]);
    await d.ecrire([carte("e1", { statut: "fait" })]);
    const l = await d.lire();
    expect(l).toHaveLength(2);
    expect(l.find((c) => c.idEvenement === "e1")?.statut).toBe("fait");
  });
  it("écritures simultanées : aucune carte perdue (sous sousVerrou)", async () => {
    const d = creerDepotParametre();
    await Promise.all(["a", "b", "c", "d"].map((i) => d.ecrire([carte(i)])));
    expect(await d.lire()).toHaveLength(4);
  });
  it("écrit sous sousVerrou", async () => {
    const v = vi.spyOn(Com, "sousVerrou");
    await creerDepotParametre().ecrire([carte("e1")]);
    expect(v).toHaveBeenCalled();
  });
  it("contenu illisible : lecture et écriture lèvent, rien n'est écrasé", async () => {
    await Com.ecrireParametre(PARAM_CARTES_A_TRAITER, { pas: "une liste" });
    const d = creerDepotParametre();
    await expect(d.lire()).rejects.toThrow();
    await expect(d.ecrire([carte("e1")])).rejects.toThrow();
    expect(await Com.lireParametre(PARAM_CARTES_A_TRAITER, null)).toEqual({ pas: "une liste" });
  });
  it("base illisible : lire lève", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base"));
    await expect(creerDepotParametre().lire()).rejects.toThrow();
  });
  it("enregistrerATraiter sur ce dépôt : la carte survit au redémarrage, doublon refusé", async () => {
    const env = { A_TRAITER_ENABLED: "1" };
    const e = { idEvenement: "ev1", reseau: "linkedin", post: "post_1", motif: "mot_manuel", commentaire: "GUIDE" };
    expect((await A.enregistrerATraiter(e, { env, depot: creerDepotParametre() })).raison).toBe("ajoute");
    expect((await A.enregistrerATraiter(e, { env, depot: creerDepotParametre() })).raison).toBe("deja_present");
    expect(await creerDepotParametre().lire()).toHaveLength(1);
  });
  it("les champs facultatifs d'ATR-A traversent enregistrerATraiter, sans valeur hors liste", async () => {
    const env = { A_TRAITER_ENABLED: "1" };
    const depot = creerDepotParametre();
    await A.enregistrerATraiter(
      { idEvenement: "ev2", reseau: "tiktok", post: "post_1", motif: "mot_manuel", commentaire: "GUIDE", idCompte: "acc_1", cible: "post_1", titreCible: "Guide <b>", message: "indisponible", raisonSansMessage: "tiktok_sans_message_prive" },
      { env, depot },
    );
    await A.enregistrerATraiter(
      { idEvenement: "ev3", reseau: "tiktok", post: "post_1", motif: "mot_manuel", commentaire: "GUIDE", idCompte: "a b", message: "autre" as never, raisonSansMessage: "texte libre" as never },
      { env, depot },
    );
    const l = await depot.lire();
    expect(l.find((c) => c.idEvenement === "ev2")).toMatchObject({ idCompte: "acc_1", cible: "post_1", titreCible: "Guide &lt;b&gt;", message: "indisponible", raisonSansMessage: "tiktok_sans_message_prive" });
    const c3 = l.find((c) => c.idEvenement === "ev3")!;
    expect(c3.idCompte).toBeUndefined();
    expect(c3.message).toBeUndefined();
    expect(c3.raisonSansMessage).toBeUndefined();
  });
});
