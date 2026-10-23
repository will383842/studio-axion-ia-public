/** Harmonisation H4 : adaptateurs purs du dépôt image → vidéo (étapes, récents) et action collée du dépôt. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { etapesImageVideo, versRecentsImageVideo, versSuiviFabricationIV, versSuiviLot, etapesLot } from "@/components/formats/image-video/vues-gabarit";

describe("etapesImageVideo", () => {
  it("le dépôt est la première étape, les cinq écrans sont listés", () => {
    const e = etapesImageVideo("depot");
    expect(e.courante).toBe(0);
    expect(e.etapes).toHaveLength(5);
    expect(etapesImageVideo("depot").etapes[0].cle).toBeTruthy();
  });
});

describe("versRecentsImageVideo", () => {
  it("deux groupes : lots puis vidéos, liens de reprise", () => {
    const g = versRecentsImageVideo([{ lotId: "l 1", ligne: "3 vidéos" }], [{ videoId: "v1", titre: "Ma vidéo", le: "2026-10-18T14:05:00" }]);
    expect(g.map((x) => x.titre)).toEqual(["Vos lots", "Vos vidéos"]);
    expect(g[0].elements[0]).toMatchObject({ id: "l 1", href: "/image-video/lot/l%201", titre: "3 vidéos" });
    expect(g[1].elements[0]).toMatchObject({ id: "v1", href: "/image-video/v1", titre: "Ma vidéo", date: "2026-10-18T14:05:00" });
  });

  it("rien : aucun groupe", () => {
    expect(versRecentsImageVideo([], [])).toEqual([]);
  });
});

describe("dépôt : l'action est dans la barre collée de l'enfant", () => {
  it("Depot porte BoutonFabriquer dans BarreActionCollee, la page n'en passe pas", () => {
    const depot = readFileSync("src/components/formats/image-video/Depot.tsx", "utf8");
    const lot = readFileSync("src/components/formats/image-video/DepotLot.tsx", "utf8");
    for (const s of [depot, lot]) expect(s).toMatch(/<BarreActionCollee>\s*<BoutonFabriquer/);
    expect(readFileSync("src/app/(studio)/image-video/page.tsx", "utf8")).not.toMatch(/\baction=/);
  });
});

describe("H5 · versSuiviFabricationIV", () => {
  const pas = (...etats: ("fait" | "en-cours" | "a-venir" | "arrete")[]) => etats.map((etat, i) => ({ cle: (["lecture", "ecriture", "voix", "rendu"] as const)[i], nom: `Pas ${i}`, etat }));
  const base = { engageCentimes: 120, plafondCentimes: 500, payeCentimes: 50, attente: false };

  it("en cours : étapes reprises, aucun montant dans la vue normalisée", () => {
    const v = versSuiviFabricationIV({ ...base, pas: pas("fait", "en-cours", "a-venir") });
    expect(v.etat).toBe("en-cours");
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "en-cours", "a-venir"]);
    expect(JSON.stringify(v)).not.toMatch(/centimes|€|120|500/);
  });

  it("une étape arrêtée : état « arretee », l'étape est marquée arrêtée", () => {
    const v = versSuiviFabricationIV({ ...base, pas: pas("fait", "arrete", "a-venir") });
    expect(v.etat).toBe("arretee");
    expect(v.etapes[1].etat).toBe("arretee");
  });

  it("tout fait : prête", () => {
    expect(versSuiviFabricationIV({ ...base, pas: pas("fait", "fait") }).etat).toBe("prete");
  });
});

describe("H5 · page d'une vidéo", () => {
  const page = readFileSync("src/app/(studio)/image-video/[videoId]/page.tsx", "utf8");
  it("les deux branches du réglage imageVideo.relireScript restent rendues, sans action passée au gabarit", () => {
    expect(page).toMatch(/vue\.script\.relireScript \?[\s\S]*<ScriptRelireIV[\s\S]*:[\s\S]*<ScriptEcrans/);
    expect(page).toMatch(/<GabaritCreation/);
    expect(page).not.toMatch(/\baction=/);
  });
  it("Fabrication rend ses étapes via SuiviFabrication, sondage 4 s inchangé", () => {
    const f = readFileSync("src/components/formats/image-video/Fabrication.tsx", "utf8");
    expect(f).toMatch(/<SuiviFabrication/);
    expect(f).toMatch(/RELECTURE_MS = 4000/);
  });
});

describe("H6 · lot d'images", () => {
  const vue = (p: Record<string, unknown>) => ({ etape: 1, statut: "en-cours", enCours: true, aRelire: [], action: "arreter", ...p }) as never;

  it("étapes du lot : trois, la courante allumée", () => {
    expect(etapesLot(1).etapes.map((e) => e.libelle)).toEqual(["Les images", "Fabrication", "À relire"]);
    expect(etapesLot(2).courante).toBe(2);
  });

  it("lot qui avance : fabrication en cours, aucun montant", () => {
    const v = versSuiviLot(vue({}));
    expect(v.etat).toBe("en-cours");
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "en-cours", "a-venir"]);
    expect(JSON.stringify(v)).not.toMatch(/centimes|€/);
  });

  it("lot en pause (action « reprendre ») : arrêté", () => {
    expect(versSuiviLot(vue({ action: "reprendre", pause: "Le plafond est atteint." })).etat).toBe("arretee");
  });

  it("fini avec des vidéos mises de côté : à relire, l'étape « À relire » est signalée", () => {
    const v = versSuiviLot(vue({ etape: 2, enCours: false, aRelire: [{}], action: "relire" }));
    expect(v.etat).toBe("a-relire");
    expect(v.etapes[2].etat).toBe("arretee");
  });

  it("fini sans rien à relire : prêt", () => {
    expect(versSuiviLot(vue({ etape: 2, statut: "termine", enCours: false, action: null })).etat).toBe("prete");
  });

  it("arrêté par Will, rien à relire : arrêté, jamais « prêt » à 100 %", () => {
    const v = versSuiviLot(vue({ etape: 2, statut: "arrete", enCours: false, action: null }));
    expect(v.etat).toBe("arretee");
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "arretee", "a-venir"]);
    expect(v.message).toBeTruthy();
  });

  it("SuiviLot : une seule BarreActionCollee dans le source, suivi rendu via SuiviFabrication, sondage 4 s inchangé", () => {
    const s = readFileSync("src/components/formats/image-video/SuiviLot.tsx", "utf8");
    expect(s.match(/<BarreActionCollee\b/g)).toHaveLength(1);
    expect(s).toMatch(/<SuiviFabrication/);
    expect(s).toMatch(/RELECTURE_LOT_MS = 4000/);
  });
});
