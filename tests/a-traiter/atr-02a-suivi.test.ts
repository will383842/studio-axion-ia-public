/** ATR-02a · suivi des cartes À traiter. Horloge figée, faux dépôts, aucune base réelle, aucun envoi. Exemples INVENTÉS. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/_commun", async (orig) => ({ ...(await orig<object>()), lireParametre: async (_id: string, defaut: unknown) => defaut }));
import {
  CRENEAUX_RAPPEL,
  MOTS_COMMERCIAUX,
  MOTS_SPAM,
  cartesMasquees,
  compteurs,
  delaiReponseMinutes,
  deposerRappelsCloche,
  estSpam,
  prioriteCarte,
  rappelsDus,
  trierParPriorite,
} from "@/services/a-traiter-suivi";
import { creerDepotMemoire, ignorerCarte, marquerCarteFaite } from "@/services/a-traiter";
import type { CarteATraiter } from "@/services/a-traiter-types";

const carte = (o: Partial<CarteATraiter> = {}): CarteATraiter => ({
  idEvenement: "e1",
  reseau: "instagram",
  post: "post-1",
  lienPost: null,
  mot: null,
  motif: "mot_inconnu",
  extrait: "Merci pour la vidéo",
  creeLe: "2026-11-10T08:00:00.000Z",
  statut: "a_traiter",
  kit: null,
  ...o,
});
/** Heure de Paris en novembre = UTC+1. */
const parisNov = (hhmm: string) => new Date(`2026-11-18T${hhmm}:00+01:00`);

describe("prioriteCarte", () => {
  it("1 : réclamation ou colère", () => {
    expect(prioriteCarte(carte({ extrait: "Je veux une réclamation" }))).toBe(1);
    expect(prioriteCarte(carte({ extrait: "C'est inadmissible" }))).toBe(1);
  });
  it("1 aussi quand la plainte cite un montant", () => {
    expect(prioriteCarte(carte({ extrait: "Arnaque, remboursez mes 30 euros, rien reçu" }))).toBe(1);
    expect(prioriteCarte(carte({ extrait: "Rien reçu après mon paiement de 30 €" }))).toBe(1);
    expect(prioriteCarte(carte({ extrait: "Quel est le prix ?" }))).toBe(4);
  });
  it("2 : demande commerciale ou de rendez-vous", () => {
    for (const m of ["devis", "rendez-vous", "rdv", "démo", "offre"])
      expect(prioriteCarte(carte({ extrait: `Un ${m} possible ?` }))).toBe(2);
    expect(MOTS_COMMERCIAUX).toEqual(expect.arrayContaining(["devis", "tarif", "appel"]));
  });
  it("3 : mot du guide ; 4 : le reste", () => {
    expect(prioriteCarte(carte({ mot: "GUIDE" }))).toBe(3);
    expect(prioriteCarte(carte())).toBe(4);
  });
  it("la réclamation passe avant le mot du guide", () => {
    expect(prioriteCarte(carte({ mot: "GUIDE", extrait: "reclamation" }))).toBe(1);
  });
  it("tri stable : priorité puis date la plus ancienne, spam masqué", () => {
    const l = [
      carte({ idEvenement: "a", creeLe: "2026-11-01T00:00:00Z" }),
      carte({ idEvenement: "b", creeLe: "2026-11-03T00:00:00Z", mot: "GUIDE" }),
      carte({ idEvenement: "c", creeLe: "2026-11-02T00:00:00Z", mot: "GUIDE" }),
      carte({ idEvenement: "s", extrait: "gagnez des followers", creeLe: "2026-10-01T00:00:00Z" }),
      carte({ idEvenement: "f", statut: "fait", mot: "GUIDE" }),
    ];
    expect(trierParPriorite(l).map((c) => c.idEvenement)).toEqual(["c", "b", "a"]);
  });
});

describe("estSpam et cartes masquées", () => {
  it("2 liens ou un mot de la liste", () => {
    expect(estSpam(carte({ extrait: "voir https://a.example et https://b.example" }))).toBe(true);
    expect(estSpam(carte({ extrait: "voir https://a.example" }))).toBe(false);
    expect(estSpam(carte({ extrait: "Super CASINO en ligne" }))).toBe(true);
    expect(MOTS_SPAM).toEqual(expect.arrayContaining(["crypto", "casino", "gagnez", "followers"]));
    expect(estSpam(carte())).toBe(false);
  });
  it("une carte spam reste en dépôt et dans cartesMasquees", () => {
    const l = [carte({ idEvenement: "s", extrait: "crypto" }), carte({ idEvenement: "n" })];
    expect(cartesMasquees(l).map((c) => c.idEvenement)).toEqual(["s"]);
    expect(l).toHaveLength(2);
  });
});

describe("heure du fait et de l'ignorance", () => {
  const prepare = async () => {
    const depot = creerDepotMemoire();
    await depot.ecrire([carte({ idEvenement: "x" }), carte({ idEvenement: "y" })]);
    return depot;
  };
  const env = { A_TRAITER_ENABLED: "1" };
  it("marquerCarteFaite pose faitLe (horloge injectable)", async () => {
    const depot = await prepare();
    const r = await marquerCarteFaite("x", { env, depot, horloge: () => "2026-11-18T10:00:00.000Z" });
    expect(r).toEqual({ issue: "execute", raison: "fait" });
    const x = (await depot.lire()).find((c) => c.idEvenement === "x");
    expect(x?.faitLe).toBe("2026-11-18T10:00:00.000Z");
    expect(x?.statut).toBe("fait");
  });
  it("ignorerCarte pose ignoreLe", async () => {
    const depot = await prepare();
    await ignorerCarte("y", { env, depot, horloge: () => "2026-11-18T11:00:00.000Z" });
    expect((await depot.lire()).find((c) => c.idEvenement === "y")?.ignoreLe).toBe("2026-11-18T11:00:00.000Z");
  });
  it("interrupteur éteint : rien n'est posé", async () => {
    const depot = await prepare();
    const r = await marquerCarteFaite("x", { env: {}, depot });
    expect(r.issue).toBe("simule");
    expect((await depot.lire())[0].faitLe).toBeUndefined();
  });
  it("délai de réponse en minutes, ou null", () => {
    expect(delaiReponseMinutes(carte({ creeLe: "2026-11-18T08:00:00Z", faitLe: "2026-11-18T09:30:00Z" }))).toBe(90);
    expect(delaiReponseMinutes(carte())).toBeNull();
  });
});

describe("rappelsDus (aux bornes)", () => {
  const vieille = carte({ creeLe: "2026-11-17T00:00:00Z" });
  const R = { creneaux: [8, 9, 13, 19, 20] as const };
  it("par défaut : 4 h, créneaux 9 h / 13 h / 19 h", () => {
    expect(CRENEAUX_RAPPEL).toEqual([9, 13, 19]);
    expect(rappelsDus([vieille], parisNov("09:10"))).toHaveLength(1);
    expect(rappelsDus([vieille], parisNov("10:00"))).toHaveLength(0);
    expect(rappelsDus([vieille], parisNov("13:00"))).toHaveLength(1);
    expect(rappelsDus([vieille], parisNov("19:59"))).toHaveLength(1);
  });
  it("7 h 59 : rien ; 8 h : dû", () => {
    expect(rappelsDus([vieille], parisNov("07:59"), R)).toHaveLength(0);
    expect(rappelsDus([vieille], parisNov("08:00"), R)).toHaveLength(1);
  });
  it("20 h : dû ; 20 h 01 : rien", () => {
    expect(rappelsDus([vieille], parisNov("20:00"), R)).toHaveLength(1);
    expect(rappelsDus([vieille], parisNov("20:01"), R)).toHaveLength(0);
  });
  it("3 h 59 sans réponse : rien ; 4 h : dû", () => {
    const c = carte({ creeLe: "2026-11-18T05:01:00Z" }); // 06:01 à Paris
    expect(rappelsDus([c], parisNov("10:00"), { creneaux: [10] })).toHaveLength(0); // 3 h 59
    expect(rappelsDus([carte({ creeLe: "2026-11-18T05:00:00Z" })], parisNov("10:00"), { creneaux: [10] })).toHaveLength(1); // 4 h
  });
  it("délai réglable ; spam, opposée, fait : jamais dus", () => {
    const c = carte({ creeLe: "2026-11-18T07:30:00Z" }); // 08:30 Paris, 40 min avant 09:10
    expect(rappelsDus([c], parisNov("09:10"))).toHaveLength(0);
    expect(rappelsDus([c], parisNov("09:10"), { delaiHeures: 0.5 })).toHaveLength(1);
    expect(rappelsDus([{ ...vieille, extrait: "casino" }, { ...vieille, opposee: true }, { ...vieille, statut: "fait" }], parisNov("09:10"))).toHaveLength(0);
  });
  it("heure d'été : 9 h de Paris = 7 h UTC", () => {
    const ancienne = carte({ creeLe: "2026-06-30T00:00:00Z" });
    expect(rappelsDus([ancienne], new Date("2026-07-01T07:10:00Z"))).toHaveLength(1);
    expect(rappelsDus([ancienne], new Date("2026-07-01T08:10:00Z"))).toHaveLength(0);
  });
});

describe("deposerRappelsCloche", () => {
  const vieille = carte({ creeLe: "2026-11-17T00:00:00Z" });
  const faux = (o: { actif?: boolean; reglage?: unknown; heure?: string } = {}) => {
    const creer = vi.fn(async () => undefined);
    const marques = new Set<string>();
    return {
      creer,
      marques,
      deps: {
        env: { A_TRAITER_ENABLED: o.actif === false ? "0" : "1" },
        maintenant: () => parisNov(o.heure ?? "09:10"),
        lireCartes: async () => [vieille],
        lireReglage: async () => ("reglage" in o ? o.reglage : true),
        creer,
        dejaDepose: async (k: string) => marques.has(k),
        marquerDepose: async (k: string) => void marques.add(k),
      },
    };
  };
  it("interrupteur éteint : ne fait RIEN (rien n'est même lu)", async () => {
    const f = faux({ actif: false });
    const lire = vi.fn(async () => [vieille]);
    expect(await deposerRappelsCloche({ ...f.deps, lireCartes: lire })).toEqual({ depose: false, raison: "interrupteur_eteint" });
    expect(lire).not.toHaveBeenCalled();
    expect(f.creer).not.toHaveBeenCalled();
  });
  it("sans réglage injecté : la lecture par défaut rend faux, rien n'est fait", async () => {
    const f = faux();
    const sans = { ...f.deps, lireReglage: undefined };
    expect(await deposerRappelsCloche(sans)).toEqual({ depose: false, raison: "rappels_eteints" });
    expect(f.creer).not.toHaveBeenCalled();
  });
  it("réglage faux (ou autre que true) : ne fait RIEN", async () => {
    for (const reglage of [false, "oui", 1, null]) {
      const f = faux({ reglage });
      await deposerRappelsCloche(f.deps);
      expect(f.creer).not.toHaveBeenCalled();
    }
  });
  it("une seule cloche par créneau et par jour, cloche seule", async () => {
    const f = faux();
    expect((await deposerRappelsCloche(f.deps)).depose).toBe(true);
    expect((await deposerRappelsCloche(f.deps)).depose).toBe(false);
    expect(f.creer).toHaveBeenCalledTimes(1);
    const [n, opts] = f.creer.mock.calls[0] as unknown as [Record<string, string>, Record<string, boolean>];
    expect(n).toMatchObject({ type: "info", lien: "/a-traiter" });
    expect(opts).toEqual({ cloche: true });
    expect(`${n.titre} ${n.message}`).not.toMatch(/€|\$|euro|prix|post-1|e1/i);
    expect(n.message).toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });
  it("hors créneau ou rien de dû : aucune cloche", async () => {
    const f = faux({ heure: "10:30" });
    expect((await deposerRappelsCloche(f.deps)).depose).toBe(false);
    expect(f.creer).not.toHaveBeenCalled();
  });
  it("créneau suivant le même jour : une nouvelle cloche", async () => {
    const f = faux();
    await deposerRappelsCloche(f.deps);
    await deposerRappelsCloche({ ...f.deps, maintenant: () => parisNov("13:05") });
    expect(f.creer).toHaveBeenCalledTimes(2);
  });
});

describe("compteurs", () => {
  it("arrivés, répondus, en retard, par réseau et par post", () => {
    const l = [
      carte({ idEvenement: "1", reseau: "instagram", post: "p1", creeLe: "2026-11-17T00:00:00Z" }),
      carte({ idEvenement: "2", reseau: "instagram", post: "p1", statut: "fait", faitLe: "2026-11-17T01:00:00Z" }),
      carte({ idEvenement: "3", reseau: "instagram", post: "p2", creeLe: "2026-11-18T08:00:00Z" }),
      carte({ idEvenement: "4", reseau: "facebook", post: "p9", creeLe: "2026-11-17T00:00:00Z" }),
    ];
    const c = compteurs(l, parisNov("12:00"));
    expect(c.parReseau.instagram).toEqual({ arrives: 3, repondus: 1, enRetard: 1 });
    expect(c.parReseau.facebook).toEqual({ arrives: 1, repondus: 0, enRetard: 1 });
    expect(c.parPost.instagram.p1).toEqual({ arrives: 2, repondus: 1, enRetard: 1 });
    expect(c.parPost.instagram.p2).toEqual({ arrives: 1, repondus: 0, enRetard: 0 });
  });
});
