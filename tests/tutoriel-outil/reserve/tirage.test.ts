/** RES-3 : tirage atomique et lancement sans clic. Aucun appel réel : tout est injecté, aucun fournisseur, 0 €. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void magasin.set(id, structuredClone(v)),
  };
});

import { CLE_BAIL_TIRAGE, REGLAGES_RESERVE_DEFAUT, type ReglagesReserve } from "@/domaine/tutoriel-reserve";
import { prendreBail, rendreBail } from "@/donnees/memoire";
import { origineFournisseurCourante } from "@/services/plafond-fournisseur";
import { ajouterElementReserve, lireElementReserve, lireTirageReserve } from "@/services/tutoriel-reserve";
import { CLE_BAIL_LANCEMENT, conditionsTirage, tirerSuivantReserve, type DependancesTirage } from "@/services/tutoriel-reserve-tirage";

const nouveau = (id: string, source: { type: "idee"; phrase: string } | { type: "dossier"; fichierId: string; nomFichier: string; attestationImages: boolean } | { type: "maquette-demo"; dossier: string } = { type: "idee", phrase: "Un tableau de bord pour un atelier" }, script?: string) => ({
  id,
  titre: id,
  source,
  ...(script ? { script } : {}),
  fin: "aucune" as const,
  ajouteLe: "2026-11-01T00:00:00.000Z",
  ajoutePar: "fondateur" as const,
});

const ACTIF: ReglagesReserve = { ...REGLAGES_RESERVE_DEFAUT, actif: true };

interface Banc {
  dep: DependancesTirage;
  lancements: { voix: boolean; fichierId?: string; origine: string }[];
  cloches: string[];
}
/** Tout est « bon » ; un test éteint UNE condition. */
function banc(surcharge: Partial<DependancesTirage> = {}): Banc {
  const b: Banc = { dep: {}, lancements: [], cloches: [] };
  b.dep = {
    maintenant: () => "2026-11-21T10:00:00.000Z",
    reglages: async () => ACTIF,
    interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
    interrupteur: async () => true,
    equipe: async () => true,
    tauxUsdEur: async () => 0.9,
    plafondVideoUsd: async () => 1,
    plafondMoisAtteint: async () => false,
    accordSansClic: async () => true,
    sousPlafondUsine: async () => true,
    // Comme l'adaptateur réel : la vidéo est notée sur l'élément AVANT le lancement.
    lancer: async (_e, o) => {
      const { noterBrouillon, ...options } = o;
      const videoId = `v-${b.lancements.length + 1}`;
      await noterBrouillon(videoId);
      b.lancements.push({ ...options, origine: origineFournisseurCourante() });
      return { statut: "lancee", videoId };
    },
    notifier: async (n) => void b.cloches.push(`${n.titre} ${n.message ?? ""}`),
    ...surcharge,
  };
  return b;
}

beforeEach(async () => {
  magasin.clear();
  await rendreBail(CLE_BAIL_TIRAGE, "autre-titulaire");
  await rendreBail(CLE_BAIL_LANCEMENT, "autre-titulaire");
});

describe("tirerSuivantReserve", () => {
  it("cas nominal : prise, lancement sans voix en origine usine, cloche sans montant", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc();
    const r = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(r).toMatchObject({ etat: "pris", deja: false, elementId: "res-premier1", videoId: "v-1" });
    expect(b.lancements).toEqual([{ voix: false, origine: "usine" }]);
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("pris");
    expect((await lireTirageReserve("cle-usine-01"))?.videoId).toBe("v-1");
    expect(b.cloches.join("")).not.toMatch(/€|euro/i);
  });

  it("rejeu de la même clé : même réponse, lancer appelé une seule fois", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc();
    await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    const r2 = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(r2).toMatchObject({ etat: "pris", deja: true, elementId: "res-premier1", videoId: "v-1" });
    expect(b.lancements).toHaveLength(1);
  });

  it("rejeu d'une clé dont la fiche porte une vidéo : toujours « pris, déjà », même si l'élément a changé d'état", async () => {
    for (const vers of ["fait", "a_revoir", "en_reserve"] as const) {
      magasin.clear();
      await ajouterElementReserve(nouveau("res-premier1"));
      const b = banc();
      await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
      const { changerEtatReserve } = await import("@/services/tutoriel-reserve");
      await changerEtatReserve("res-premier1", vers, { patch: { prise: undefined } });
      expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toMatchObject({ etat: "pris", deja: true, elementId: "res-premier1", videoId: "v-1" });
      expect(b.lancements).toHaveLength(1);
    }
  });

  it("ARGENT : lancer note la vidéo puis refuse : 1er appel échec, rejeu même échec, lancer appelé une seule fois", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    let appels = 0;
    const b = banc({ lancer: async (_e, o) => { appels++; await o.noterBrouillon("v-9"); return { statut: "refusee", phrase: "Panne passagère.", definitif: false }; } });
    const un = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(un).toMatchObject({ etat: "echec", elementId: "res-premier1", retourEnReserve: true });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toEqual(un);
    expect(appels).toBe(1);
  });

  it("ARGENT : la note de la vidéo échoue ou n'est pas relue : refus, vidéo jamais lancée, rien n'est payé", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ noterVideo: async () => { throw new Error("base"); } });
    const r = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(r).toMatchObject({ etat: "echec", retourEnReserve: true });
    expect(b.lancements).toHaveLength(0);
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("en_reserve");

    // Note « réussie » mais qui ne se relit pas (écriture perdue) : même refus.
    magasin.clear();
    await ajouterElementReserve(nouveau("res-second01"));
    const b2 = banc({ noterVideo: async () => undefined });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02" }, b2.dep)).toMatchObject({ etat: "echec" });
    expect(b2.lancements).toHaveLength(0);
  });

  it("interrupteur de la réserve éteint : « eteint », rien n'est écrit ni lancé ; l'essai passe quand même les conditions", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ reglages: async () => REGLAGES_RESERVE_DEFAUT });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toEqual({ etat: "eteint" });
    expect(await tirerSuivantReserve({ declencheur: "rythme", cle: "cle-rythme-1" }, b.dep)).toEqual({ etat: "eteint" });
    expect(await lireTirageReserve("cle-usine-01")).toBeNull();
    expect(b.lancements).toHaveLength(0);
    const essai = await tirerSuivantReserve({ declencheur: "essai", cle: "cle-essai-01" }, b.dep);
    expect(essai.etat).toBe("pris");
    const ferme = banc({ reglages: async () => REGLAGES_RESERVE_DEFAUT, interrupteurs: async () => ({ formulaire: false, dossier: true, phrase: true }) });
    await ajouterElementReserve(nouveau("res-second01"));
    expect(await tirerSuivantReserve({ declencheur: "essai", cle: "cle-essai-02" }, ferme.dep)).toMatchObject({ etat: "attente", raison: "formulaire_ferme" });
  });

  it("réserve lue en échec : « eteint »", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ reglages: async () => { throw new Error("base"); } });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toEqual({ etat: "eteint" });
  });

  it("réserve vide : « reserve_vide », rien d'écrit", async () => {
    const b = banc();
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toEqual({ etat: "reserve_vide" });
    expect(await lireTirageReserve("cle-usine-01")).toBeNull();
  });

  it("clé invalide : refus, rien n'est écrit", async () => {
    await expect(tirerSuivantReserve({ declencheur: "usine", cle: "x" }, banc().dep)).rejects.toThrow();
  });

  const CAS: { raison: string; surcharge: () => Partial<DependancesTirage>; element?: ReturnType<typeof nouveau>; reglages?: ReglagesReserve }[] = [
    { raison: "formulaire_ferme", surcharge: () => ({ interrupteurs: async () => ({ formulaire: false, dossier: true, phrase: true }) }) },
    { raison: "entree_fermee", surcharge: () => ({ interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: false }) }) },
    { raison: "entree_fermee", element: nouveau("res-dossier1", { type: "dossier", fichierId: "f1", nomFichier: "a.zip", attestationImages: true }), surcharge: () => ({ interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: true }) }) },
    { raison: "entree_fermee", element: nouveau("res-demo0001", { type: "maquette-demo", dossier: "01-courriels" }), surcharge: () => ({ interrupteurs: async () => ({ formulaire: true, dossier: false, phrase: true }) }) },
    { raison: "equipe_eteinte", surcharge: () => ({ equipe: async () => false }) },
    { raison: "equipe_eteinte", surcharge: () => ({ equipe: async () => { throw new Error("illisible"); } }) },
    { raison: "plafond_video", surcharge: () => ({ plafondVideoUsd: async () => 1.38, tauxUsdEur: async () => 0.95 }) },
    { raison: "voix_sans_devis", reglages: { ...ACTIF, voix: true }, surcharge: () => ({ interrupteur: async (cle: string) => cle !== "tutoriel.devisAvantDepense" }) },
    { raison: "plafond_video", surcharge: () => ({ plafondVideoUsd: async () => 5 }) },
    { raison: "plafond_video", surcharge: () => ({ plafondVideoUsd: async () => { throw new Error("illisible"); } }) },
    { raison: "plafond_mois", surcharge: () => ({ plafondMoisAtteint: async () => true }) },
    { raison: "plafond_mois", surcharge: () => ({ plafondMoisAtteint: async () => { throw new Error("illisible"); } }) },
    { raison: "autonomie_usine", surcharge: () => ({ accordSansClic: async () => false }) },
    { raison: "autonomie_usine", surcharge: () => ({ sousPlafondUsine: async () => false }) },
    { raison: "autonomie_usine", surcharge: () => ({ sousPlafondUsine: async () => { throw new Error("illisible"); } }) },
  ];
  it.each(CAS.map((c, i) => [i, c.raison, c] as const))("attente %i « %s » : l'élément reste en réserve, aucun lancement", async (_i, raison, c) => {
    const el = c.element ?? nouveau("res-premier1");
    await ajouterElementReserve(el);
    const b = banc({ ...c.surcharge(), ...(c.reglages ? { reglages: async () => c.reglages! } : {}) });
    const r = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(r).toMatchObject({ etat: "attente", raison });
    expect(b.lancements).toHaveLength(0);
    expect((await lireElementReserve(el.id))?.etat).toBe("en_reserve");
    expect(await lireTirageReserve("cle-usine-01")).toBeNull();
  });

  it("un script collé dispense de l'équipe", async () => {
    await ajouterElementReserve(nouveau("res-premier1", undefined, "Un texte déjà écrit."));
    const b = banc({ equipe: async () => false });
    expect((await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).etat).toBe("pris");
  });

  it("équipe : même règle que deposerTutoriel (tutoriel.equipe ET tutoriel.claude), lue dans les réglages", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const el = (await lireElementReserve("res-premier1"))!;
    const sansEquipe = { ...banc().dep, equipe: undefined };
    magasin.set("tutoriel.equipe", true);
    expect(await conditionsTirage(el, ACTIF, sansEquipe)).toMatchObject({ raison: "equipe_eteinte" });
    magasin.set("tutoriel.claude", true);
    expect(await conditionsTirage(el, ACTIF, sansEquipe)).toBeNull();
  });

  it("taux $→€ : le plus haut du défaut (0,9) et du réglage ; réglage plus bas ou illisible : défaut", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const el = (await lireElementReserve("res-premier1"))!;
    // 1,38 $ : 125 c€ au taux 0,9 (égalité acceptée), 132 c€ au taux 0,95 (refus).
    const avec = (taux: () => Promise<number>) => banc({ plafondVideoUsd: async () => 1.38, tauxUsdEur: taux }).dep;
    expect(await conditionsTirage(el, ACTIF, avec(async () => 0.95))).toMatchObject({ raison: "plafond_video" });
    expect(await conditionsTirage(el, ACTIF, avec(async () => 0.5))).toBeNull();
    expect(await conditionsTirage(el, ACTIF, avec(async () => { throw new Error("illisible"); }))).toBeNull();
    expect(await conditionsTirage(el, ACTIF, avec(async () => Number.NaN))).toBeNull();
  });

  it("plafond par vidéo : l'égalité est acceptée (1,25 € = 125 centimes)", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    // 1,25 € ÷ 0,9 = 1,3888… $ : on prend le plafond en dollars qui donne exactement 125 centimes après conversion.
    const b = banc({ plafondVideoUsd: async () => 125 / 90 });
    const r = await conditionsTirage((await lireElementReserve("res-premier1"))!, ACTIF, b.dep);
    expect(r).toBeNull();
  });

  it("voix allumée : le lancement la reçoit seulement si le devis est allumé", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ reglages: async () => ({ ...ACTIF, voix: true }) });
    await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(b.lancements[0]?.voix).toBe(true);
  });

  it("double tirage simultané, deux clés : une prise, l'autre attend ou la réserve est vide", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    await ajouterElementReserve(nouveau("res-second01"));
    const b = banc();
    const [a, c] = await Promise.all([tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep), tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02" }, b.dep)]);
    expect([a.etat, c.etat].filter((x) => x === "pris")).toHaveLength(1);
    expect([a, c].find((x) => x.etat !== "pris")).toMatchObject({ etat: "attente", raison: "deja_en_cours" });
    expect(b.lancements).toHaveLength(1);
    expect((await lireElementReserve("res-second01"))?.etat).toBe("en_reserve");
  });

  it("démo sans fichier : le fichier est fabriqué une fois et passé au lancement ; sans fichier possible : à revoir", async () => {
    await ajouterElementReserve(nouveau("demo-01-courriels", { type: "maquette-demo", dossier: "01-courriels" }));
    const b = banc({ fichierDemo: async () => ({ fichierId: "f-demo" }) });
    await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(b.lancements[0]?.fichierId).toBe("f-demo");

    magasin.clear();
    await ajouterElementReserve(nouveau("demo-02-projets", { type: "maquette-demo", dossier: "02-projets" }));
    const b2 = banc({ fichierDemo: async () => { throw new Error("stockage"); } });
    const r = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02" }, b2.dep);
    expect(r).toMatchObject({ etat: "echec", retourEnReserve: false });
    expect(b2.lancements).toHaveLength(0);
    expect((await lireElementReserve("demo-02-projets"))?.etat).toBe("a_revoir");
  });

  it("échec 1 : retour en réserve, tentative 1 ; échec 2 : à revoir", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ lancer: async () => ({ statut: "refusee", phrase: "Panne passagère.", definitif: false }) });
    const r1 = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep);
    expect(r1).toMatchObject({ etat: "echec", retourEnReserve: true });
    const e1 = await lireElementReserve("res-premier1");
    expect(e1).toMatchObject({ etat: "en_reserve", tentatives: 1 });
    expect(e1?.prise).toBeUndefined();
    const r2 = await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02" }, b.dep);
    expect(r2).toMatchObject({ etat: "echec", retourEnReserve: false });
    expect(await lireElementReserve("res-premier1")).toMatchObject({ etat: "a_revoir", tentatives: 2 });
  });

  it("refus définitif : à revoir dès le premier échec ; exception du lancement : jamais de relance", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ lancer: async () => ({ statut: "refusee", phrase: "Dossier refusé.", definitif: true }) });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toMatchObject({ etat: "echec", retourEnReserve: false });
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("a_revoir");

    await ajouterElementReserve(nouveau("res-second01"));
    const b2 = banc({ lancer: async () => { throw new Error("panne"); } });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02" }, b2.dep)).toMatchObject({ etat: "echec" });
    expect(await prendreBail(CLE_BAIL_LANCEMENT, "autre-titulaire", 1000)).toBe(true); // rendu malgré l'échec
    await rendreBail(CLE_BAIL_LANCEMENT, "autre-titulaire");

    magasin.clear();
    await ajouterElementReserve(nouveau("res-tiers001"));
    const b3 = banc({ rendreBail: async (c, t) => { await rendreBail(c, t); throw new Error("rendu en panne"); } });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-03" }, b3.dep)).toMatchObject({ etat: "pris" }); // échec du rendu absorbé
  });

  it("bail occupé par une autre machine : « attente bail_occupe », rien d'écrit", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ prendre: async () => "bail_occupe" });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toMatchObject({ etat: "attente", raison: "bail_occupe" });
    expect(b.lancements).toHaveLength(0);
  });

  it("prise qui rend « deja_en_cours » (garde réelle sous verrou) : attente, rien n'est lancé", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const b = banc({ prendre: async () => "deja_en_cours" });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toMatchObject({ etat: "attente", raison: "deja_en_cours" });
    expect(b.lancements).toHaveLength(0);
  });

  it("élément demandé : pris celui-là ; inconnu ou déjà pris : réserve vide", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    await ajouterElementReserve(nouveau("res-second01"));
    const b = banc();
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01", elementId: "res-second01" }, b.dep)).toMatchObject({ etat: "pris", elementId: "res-second01" });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02", elementId: "res-inconnu1" }, banc().dep)).toEqual({ etat: "reserve_vide" });
  });

  it("ARGENT : bail de lancement tenu par une autre machine : attente bail_occupe, rien de pris, rien de lancé", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    expect(await prendreBail(CLE_BAIL_LANCEMENT, "autre-titulaire", 60_000)).toBe(true);
    const b = banc();
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toMatchObject({ etat: "attente", raison: "bail_occupe" });
    expect(b.lancements).toHaveLength(0);
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("en_reserve");
    expect(await lireTirageReserve("cle-usine-01")).toBeNull();
  });

  it("ARGENT : bail de lancement rendu après un tirage normal et après une exception du lancement", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const rendus: string[] = [];
    const rendreBailEspion = async (c: string, t: string) => { rendus.push(c); await rendreBail(c, t); };
    const b = banc({ rendreBail: rendreBailEspion });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-01" }, b.dep)).toMatchObject({ etat: "pris" });
    expect(rendus).toContain(CLE_BAIL_LANCEMENT);
    expect(await prendreBail(CLE_BAIL_LANCEMENT, "autre-titulaire", 1000)).toBe(true);
    await rendreBail(CLE_BAIL_LANCEMENT, "autre-titulaire");

    magasin.clear();
    await ajouterElementReserve(nouveau("res-second01"));
    const b2 = banc({ lancer: async () => { throw new Error("panne"); }, rendreBail: async (c, t) => { await rendreBail(c, t); throw new Error("rendu en panne"); } });
    expect(await tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-02" }, b2.dep)).toMatchObject({ etat: "echec" }); // exception du rendu absorbée
    const b3 = banc({ prendre: async () => { throw new Error("base"); } });
    await rendreBail(CLE_BAIL_LANCEMENT, "x");
    await expect(tirerSuivantReserve({ declencheur: "usine", cle: "cle-usine-03" }, b3.dep)).rejects.toThrow("base");
  });
});
