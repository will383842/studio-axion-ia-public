/** Carrousel continu P5 : service de bout en bout EN MÉMOIRE, avec un faux serveur de rendu. Aucun appel payant. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const MESURES_BONNES = { debordements: 0, taillePoliceMin: 30, textes: 12, textesSurCouture: 0, textesHorsMarge: 0, textesCoinReserve: 0, intrusionsMetaP1: 0, chevauchements: 0, debordCouture1: 1, traitsFinsSurCouture: 0, pages: 3, largeur: 3240, hauteur: 1350 };
const demandes: DemandeRendu[] = [];
let mesures: Record<string, number> = { ...MESURES_BONNES };
const fauxRendu: ServiceRendu = {
  async soumettre(d) {
    demandes.push(d);
    return { idRendu: d.idRendu };
  },
  async etat(id): Promise<EtatRendu> {
    const d = demandes.find((x) => x.idRendu === id);
    return { statut: "termine", sortieCle: d?.sortie.cle ?? "", mesures };
  },
};
vi.mock("@/fournisseurs/rendu/client", async (original) => ({ ...(await original<typeof import("@/fournisseurs/rendu/client")>()), obtenirServiceRendu: () => fauxRendu }));
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<typeof import("@/services/_commun")>()),
  fournisseur: async () => ({
    urlDepotDuree: async (cle: string) => `https://r2.exemple/depot/${cle}?sig=secret`,
    urlLectureDuree: async (cle: string) => `https://r2.exemple/lecture/${cle}?sig=secret`,
    urlLecture: async (cle: string) => `/lecture/${cle}`,
  }),
}));
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined, sessionApi: async () => (session.ouverte ? { id: "s" } : null) }));

import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { lireZip } from "@/lib/zip";
import { ecrireParametre } from "@/services/_commun";
import { definirGenerateur } from "@/visuels/interrupteur";
import { mettreALaCorbeille, restaurer } from "@/visuels/services/corbeille";
import { listerCarrousels } from "@/visuels/services/vues";
import { creerToileDepuisSujet, deposerSessionToile, lancerRenduToile, refaireToile, refuserToile, validerToile } from "@/visuels/continu/services/carrousels-continus";
import { dependancesContinus } from "@/visuels/continu/services/production-continus";
import { contenuZipToile, ficheToile, listerToiles } from "@/visuels/continu/services/vues-continus";
import { GET as zipGET } from "../../src/app/api/carrousels-continus/[id]/zip/route";
import { creerDepuisSujet } from "@/visuels/services/carrousels";
import { dependancesCarrousels } from "@/visuels/services/production";

const page = (type: string, titre: string) => ({ type, alt: titre, titre, texte: "Un texte court et clair pour vous." });
const toileDe = (n: number) => ({
  version: "toile/1" as const,
  format: "4:5" as const,
  pages: [page("X00", "Couverture"), ...[page("X01", "Étape un"), page("X03", "Étape trois"), page("X04", "Étape quatre"), page("X05", "Étape cinq"), page("X06", "Étape six"), page("X07", "Sept"), page("X08", "Huit"), page("X09", "Neuf"), page("X10", "Dix")].slice(0, n - 2), page("X02", "Appel")],
  raccords: [],
});

describe("carrousel continu P5 : service de bout en bout", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    demandes.length = 0;
    mesures = { ...MESURES_BONNES };
    session.ouverte = true;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("interrupteur éteint par défaut : GENERATEUR_ETEINT, aucune fiche, aucun rendu", async () => {
    const deps = dependancesContinus();
    await expect(creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    await ecrireParametre("carrousels-continus.actif", "true");
    await expect(creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    await expect(deps.rendre(toileDe(3) as never)).rejects.toThrow(/éteint/);
    expect(await depots().visuels.lister(() => true)).toHaveLength(0);
    expect(demandes).toHaveLength(0);
  });

  it("sujet → écrit → rendu → à valider → validé → corbeille → restauré", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.famille).toBe("carrousel-continu");
    expect(v?.statut).toBe("ecrit");
    await lancerRenduToile(id, deps);
    const rendu = await depots().visuels.obtenir(id);
    expect(rendu?.statut).toBe("a_valider");
    expect(rendu?.renduToile?.pages.length).toBe(rendu?.toile?.pages.length);
    expect(rendu?.renduToile?.pages[0].cle).toMatch(/page-1\.jpg$/);
    expect(rendu?.renduToile?.bandeCle).toMatch(/bande\.jpg$/);
    const d = demandes[0];
    expect(d.operation).toBe("toile-continue");
    expect(d.file).toBe("courte");
    expect(d.entrees).toEqual({});
    expect(d.parametres.qualite).toBe(95);
    expect((d.parametres.depotsPages as unknown[]).length).toBe(rendu?.toile?.pages.length);
    const fiche = await ficheToile(id, deps);
    expect(fiche.actionsPermises).toContain("valider");
    expect(fiche.zipUrl).toBe(`/api/carrousels-continus/${id}/zip`);
    await validerToile(id, deps);
    expect((await depots().visuels.obtenir(id))?.statut).toBe("valide");
    expect(await mettreALaCorbeille([id], deps)).toEqual({ mises: 1 });
    expect(await listerToiles("tous", deps)).toHaveLength(0);
    expect(await listerToiles("corbeille", deps)).toHaveLength(1);
    expect(await restaurer([id], deps)).toEqual({ restaurees: 1 });
    expect(await listerToiles("valides", deps)).toHaveLength(1);
  });

  it("refuser puis refaire (version +1)", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Trois gestes inventés pour demain", deps);
    await lancerRenduToile(id, deps);
    await refuserToile(id, "texte", undefined, "Trop long", deps);
    expect((await depots().visuels.obtenir(id))?.statut).toBe("refuse");
    await refaireToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("ecrit");
    expect(v?.versionSpec).toBe(2);
  });

  it("dépôt de session : paquet lu, aucune retouche automatique même avec une note basse", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = { ...dependancesContinus(), noter: () => 50 };
    const paquet = { version: "paquet-session-toile/1", sujet: "Ranger", titre: "Ranger son bureau", pourquoi: ["a", "b", "c"], toile: toileDe(3) };
    const { id } = await deposerSessionToile(JSON.stringify(paquet), deps);
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("a_valider");
    expect(v?.versionSpec).toBe(1);
  });

  it("sujet en simulation : une note sous 90 déclenche une retouche, puis « bloque » sous 85 à la version 3", async () => {
    await definirGenerateur("carrousels-continus", true);
    const notes = [87, 60, 60];
    const deps = { ...dependancesContinus(), noter: () => notes.shift() ?? 60 };
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.versionSpec).toBe(3);
    expect(v?.statut).toBe("bloque");
    expect(v?.erreur).toBe("note 60/100 : à refaire");
  });

  it("sujet en simulation : une note de 90 ou plus ne déclenche rien", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = { ...dependancesContinus(), noter: () => 92 };
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect([v?.versionSpec, v?.statut]).toEqual([1, "a_valider"]);
  });

  it("même toile → aucun second rendu", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = dependancesContinus();
    const toile = toileDe(3) as never;
    const a = await deps.rendre(toile);
    const n = demandes.length;
    const b = await deps.rendre(toile);
    expect(b).toEqual(a);
    expect(demandes).toHaveLength(n);
    expect(a.pages).toHaveLength(3);
  });

  it("mesure absente → echec_rendu avec la phrase", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    delete mesures.textesSurCouture;
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("echec_rendu");
    expect(v?.erreur).toMatch(/mesure .*absente/);
  });

  it.each([
    ["textesSurCouture", 1, /un texte passe sur la couture/],
    ["debordCouture1", 0, /n'invite pas à glisser/],
    ["taillePoliceMin", 20, /sous 26 px/],
    ["debordements", 2, /déborde/],
  ])("%s=%s → echec_rendu", async (cle, valeur, phrase) => {
    await definirGenerateur("carrousels-continus", true);
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    mesures[cle] = valeur;
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("echec_rendu");
    expect(v?.erreur).toMatch(phrase);
  });

  it("11 pages refusées avant tout rendu", async () => {
    await definirGenerateur("carrousels-continus", true);
    const onze = { ...toileDe(10), pages: [...toileDe(10).pages, page("X11", "Onze")] };
    await expect(dependancesContinus().rendre(onze as never)).rejects.toThrow();
    expect(demandes).toHaveLength(0);
  });

  it("ZIP : noms et nombre d'entrées", async () => {
    await definirGenerateur("carrousels-continus", true);
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    await lancerRenduToile(id, deps);
    const n = (await depots().visuels.obtenir(id))!.toile!.pages.length;
    const contenu = await contenuZipToile(id, deps);
    const noms = contenu.entrees.map((e) => e.nom);
    expect(noms).toHaveLength(n + 3);
    expect(noms.slice(0, n)).toEqual(Array.from({ length: n }, (_, i) => `page-${String(i + 1).padStart(2, "0")}.jpg`));
    expect(noms.slice(n)).toEqual(["texte-du-post.txt", "textes-alternatifs.txt", "LISEZMOI.txt"]);
    const alt = contenu.entrees.find((e) => e.nom === "textes-alternatifs.txt");
    expect("contenu" in alt! && alt.contenu.trim().split("\n")).toHaveLength(n);
    const lisezmoi = contenu.entrees.find((e) => e.nom === "LISEZMOI.txt");
    expect("contenu" in lisezmoi! && lisezmoi.contenu).toContain("4:5 : Instagram et Facebook ; 3:4 : téléchargement seulement, l'API Instagram refuse un ratio sous 0,8");

    const reponse = await zipGET(new Request("http://x") as never, { params: Promise.resolve({ id }) } as never);
    expect(reponse.headers.get("Content-Type")).toBe("application/zip");
    const octets = new Uint8Array(await reponse.arrayBuffer());
    expect(lireZip(octets).map((f) => f.nom)).toEqual(noms);
    session.ouverte = false;
    expect((await zipGET(new Request("http://x") as never, { params: Promise.resolve({ id }) } as never)).status).toBe(401);
  });

  it("la liste classique n'affiche pas une fiche continue (et inversement)", async () => {
    await definirGenerateur("carrousels-continus", true);
    await definirGenerateur("carrousels", true);
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", dependancesContinus());
    const classique = (await creerDepuisSujet("Trois gestes inventés pour demain", dependancesCarrousels())).id;
    const cartes = await listerCarrousels("tous", dependancesCarrousels());
    expect(cartes.map((c) => c.id)).toEqual([classique]);
    expect((await listerToiles("tous", dependancesContinus())).map((c) => c.id)).toEqual([id]);
  });
});

describe("carrousel continu P5 : correctifs de relecture", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    demandes.length = 0;
    mesures = { ...MESURES_BONNES };
    session.ouverte = true;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
    await definirGenerateur("carrousels-continus", true);
  });
  afterEach(() => vi.unstubAllGlobals());
  const paquetDe = (surcharge: Record<string, unknown>) => JSON.stringify({ version: "paquet-session-toile/1", sujet: "Ranger", titre: "Ranger son bureau", pourquoi: ["a", "b", "c"], toile: toileDe(3), ...surcharge });

  it("échec de rendu de la toile (pas une mesure absente) : « Refaire » au lieu de « Relancer le rendu »", async () => {
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    mesures.textesSurCouture = 1;
    await lancerRenduToile(id, deps);
    const fiche = await ficheToile(id, deps);
    expect(fiche.statut).toBe("echec_rendu");
    expect(fiche.actionsPermises).toContain("refaire");
    expect(fiche.actionsPermises).not.toContain("relancer_rendu");
  });

  it("mesure absente : « Relancer le rendu » reste proposé, pas « Refaire »", async () => {
    const deps = dependancesContinus();
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    delete mesures.textesSurCouture;
    await lancerRenduToile(id, deps);
    const fiche = await ficheToile(id, deps);
    expect(fiche.actionsPermises).toContain("relancer_rendu");
    expect(fiche.actionsPermises).not.toContain("refaire");
  });

  it.each([
    ["titre de plus de 120 signes", { titre: "T".repeat(121) }],
    ["titre absent", { titre: undefined }],
    ["pourquoi en texte", { pourquoi: "a, b, c" }],
    ["pourquoi avec un nombre", { pourquoi: ["a", 2] }],
    ["pourquoi trop long", { pourquoi: Array.from({ length: 40 }, () => "a") }],
  ])("paquet mal formé (%s) → bloque avec sa phrase", async (_nom, surcharge) => {
    const deps = dependancesContinus();
    const { id } = await deposerSessionToile(paquetDe(surcharge), deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("bloque");
    expect(v?.erreur).toMatch(/lecture du texte déposé/);
  });

  it.each([
    ["titre avec un mot interdit", { titre: "Un résultat garanti pour vous" }],
    ["titre avec un lien", { titre: "Voir exemple.com" }],
    ["pourquoi avec un mot interdit", { pourquoi: ["a", "Résultat garanti", "c"] }],
    ["pourquoi avec un lien", { pourquoi: ["a", "https://exemple.com", "c"] }],
  ])("session : %s → bloque, jamais « ecrit »", async (_nom, surcharge) => {
    const deps = dependancesContinus();
    const { id } = await deposerSessionToile(paquetDe(surcharge), deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("bloque");
    expect(v?.erreur).toMatch(/à retirer/);
  });

  it("interrupteur éteint après un premier rendu : la toile déjà connue n'est pas rendue à nouveau", async () => {
    const deps = dependancesContinus();
    await deps.rendre(toileDe(3) as never);
    await definirGenerateur("carrousels-continus", false);
    await expect(deps.rendre(toileDe(3) as never)).rejects.toThrow(/éteint/);
  });

  it("retouche automatique : aucun faux refus « Autre chose » dans la fiche", async () => {
    const notes = [87, 60, 60];
    const deps = { ...dependancesContinus(), noter: () => notes.shift() ?? 60 };
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("bloque");
    expect(v?.refus ?? []).toHaveLength(0);
  });

  it("retouche automatique : interrupteur éteint pendant la retouche → pas d'erreur, la fiche reste à valider", async () => {
    let allume = true;
    const base = dependancesContinus();
    const deps = { ...base, allume: async () => allume, noter: () => ((allume = false), 60) };
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    await expect(lancerRenduToile(id, deps)).resolves.toBeUndefined();
    const v = await depots().visuels.obtenir(id);
    expect([v?.statut, v?.versionSpec]).toEqual(["a_valider", 1]);
  });

  it("retouche automatique : fiche validée pendant la retouche → pas d'erreur, elle reste validée", async () => {
    const base = dependancesContinus();
    let cible = "";
    const deps = { ...base, noter: () => (void depots().visuels.modifier(cible, { statut: "valide" }), 60) };
    const { id } = await creerToileDepuisSujet("Cinq erreurs inventées au lancement", deps);
    cible = id;
    await expect(lancerRenduToile(id, deps)).resolves.toBeUndefined();
    expect((await depots().visuels.obtenir(id))?.statut).toBe("valide");
  });

  it("bout en bout en 3:4 : demande de rendu, fiche, ZIP", async () => {
    mesures = { ...MESURES_BONNES, hauteur: 1440 };
    const deps = dependancesContinus();
    const { id } = await deposerSessionToile(paquetDe({ toile: { ...toileDe(3), format: "3:4" } }), deps);
    await lancerRenduToile(id, deps);
    const v = await depots().visuels.obtenir(id);
    expect(v?.statut).toBe("a_valider");
    expect(v?.renduToile?.format).toBe("3:4");
    expect((demandes[0].parametres.proprietes as { toile: { format: string } }).toile.format).toBe("3:4");
    expect((await ficheToile(id, deps)).format).toBe("3:4");
    const zip = await contenuZipToile(id, deps);
    expect(zip.entrees).toHaveLength(6);
    const lisezmoi = zip.entrees.find((e) => e.nom === "LISEZMOI.txt");
    expect("contenu" in lisezmoi! && lisezmoi.contenu).toContain("3:4 : téléchargement seulement");
  });
});

describe("carrousel continu P5 : sources", () => {
  const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
  it("aucun import de production.ts hors de production-continus.ts", () => {
    const sources = [...fichiers("src/visuels/continu"), ...fichiers("src/app/api/carrousels-continus")].filter((f) => !f.endsWith("production-continus.ts"));
    expect(sources.length).toBeGreaterThan(0);
    for (const f of sources) expect(readFileSync(f, "utf8"), f).not.toMatch(/services\/production["']/);
  });
  it("le service n'ouvre ni production.ts, ni note.ts, ni les versions du carrousel classique", () => {
    for (const f of fichiers("src/visuels/continu")) expect(readFileSync(f, "utf8"), f).not.toMatch(/VERSION_RENDU|VERSION_COMPOSITION|controles-visuel\/note["']/);
  });
  it("la CI surveille les routes du continu", () => {
    expect(readFileSync(".github/workflows/tests-visuels.yml", "utf8")).toContain("src/app/api/carrousels-continus/**");
  });
  it("Réglages : 3e famille et action acceptée", () => {
    expect(readFileSync("src/app/(studio)/reglages/carrousels/page.tsx", "utf8")).toContain("Carrousels continus");
    expect(readFileSync("src/app/(studio)/reglages/carrousels/actions.ts", "utf8")).toContain("carrousels-continus");
  });
});
