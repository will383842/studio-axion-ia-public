/** L8-12a : liste des contenus à relancer (lecture seule). Aucune base, aucun réseau : tout est injecté. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import type { Publication } from "@/domaine/types";
import { NOMBRE_MAX_AFFICHES, listerContenusARelancer, type DepsContenusARelancer } from "@/services/contenus-a-relancer";

const MAINTENANT = new Date("2026-12-01T12:00:00Z");
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const pub = (id: string, vues: number, extra: Partial<Publication> = {}): Publication =>
  ({
    id,
    reseau: "instagram",
    statut: "publiee",
    via: "manuel",
    date: ilYa(60),
    texte: `Texte d'origine ${id}`,
    videoId: `v-${id}`,
    stats: { vues },
    releves: [{ le: ilYa(20), jour: 1, source: "saisie", valeurs: { vues }, definitions: {} }],
    creeLe: ilYa(60),
    modifieLe: ilYa(60),
    ...extra,
  }) as unknown as Publication;

/** Trois publications notées sur Instagram, la meilleure en premier (a > b > c). */
const trio = () => [pub("a", 900), pub("b", 500), pub("c", 100)];

function deps(pubs: Publication[], creneaux: { id: string }[] = [], exemple: (e: { estDemo?: boolean }) => boolean = () => true) {
  const ecritures: string[] = [];
  const lever = (nom: string) => () => {
    ecritures.push(nom);
    throw new Error(`écriture interdite : ${nom}`);
  };
  const d = {
    publications: { lister: async (f?: (p: Publication) => boolean) => pubs.filter((p) => (f ? f(p) : true)), enregistrer: lever("publications.enregistrer"), supprimer: lever("publications.supprimer") },
    creneaux: { lister: async (f?: (c: { id: string }) => boolean) => creneaux.filter((c) => (f ? f(c) : true)), enregistrer: lever("creneaux.enregistrer"), supprimer: lever("creneaux.supprimer") },
    filtreExemples: async () => exemple,
  } as unknown as DepsContenusARelancer;
  return { d, ecritures };
}

const ids = async (pubs: Publication[], creneaux: { id: string }[] = []) => (await listerContenusARelancer(deps(pubs, creneaux).d, MAINTENANT)).map((l) => l.publicationId);

describe("constante proposée", () => {
  it("NOMBRE_MAX_AFFICHES est une hypothèse à 10", () => {
    expect(NOMBRE_MAX_AFFICHES).toEqual({ statut: "hypothese", valeur: 10 });
  });
});

describe("qui est listé", () => {
  it("liste les trois publications notées, meilleure d'abord", async () => {
    expect(await ids(trio())).toEqual(["a", "b", "c"]);
  });
  it("écarte la simulée, la non publiée, l'exemple et celle sans média", async () => {
    const mauvaises = [
      pub("sim", 800, { via: "simulation" }),
      pub("brouillon", 800, { statut: "brouillon" }),
      pub("echec", 800, { statut: "echec" }),
      pub("demo", 800, { estDemo: true } as Partial<Publication>),
      pub("sansmedia", 800, { videoId: undefined, visuelId: undefined }),
    ];
    const r = await listerContenusARelancer(deps([...trio(), ...mauvaises], [], (e) => !e.estDemo).d, MAINTENANT);
    expect(r.map((l) => l.publicationId)).toEqual(["a", "b", "c"]);
  });
  it("écarte une publication qui a la vidéo ET le visuel (source ambiguë)", async () => {
    expect(await ids([...trio(), pub("deux", 800, { visuelId: "x" })])).toEqual(["a", "b", "c"]);
  });
  it("écarte une publication mesurée depuis 3 jours", async () => {
    const recente = pub("recente", 950, { releves: [{ le: ilYa(3), jour: 1, source: "saisie", valeurs: { vues: 950 }, definitions: {} }] });
    expect(await ids([...trio(), recente])).toEqual(["a", "b", "c"]);
  });
  it("écarte une publication jamais mesurée (aucun relevé) : ce n'est pas un zéro", async () => {
    const sans = pub("sans", 950, { releves: undefined });
    expect(await ids([...trio(), sans])).toEqual(["a", "b", "c"]);
  });
  it("écarte un groupe de 2 sur un réseau", async () => {
    expect(await ids([pub("x", 900), pub("y", 100)])).toEqual([]);
  });
  it("écarte une publication notée dont le délai de republication est trop court (L8-08)", async () => {
    // 20 jours de publication sur Instagram (30 jours minimum) ; mesurée depuis 10 jours : notée mais trop tôt.
    const tot = pub("tot", 950, { date: ilYa(20), releves: [{ le: ilYa(10), jour: 1, source: "saisie", valeurs: { vues: 950 }, definitions: {} }] });
    expect(await ids([...trio(), tot])).toEqual(["a", "b", "c"]);
  });
  it("une publication sans aucun chiffre n'apparaît pas", async () => {
    const vide = pub("vide", 0, { stats: undefined });
    expect(await ids([...trio(), vide])).toEqual(["a", "b", "c"]);
  });
});

describe("ordre et plafond", () => {
  it("12 candidats notés donnent 10 lignes, les meilleurs d'abord", async () => {
    const douze = Array.from({ length: 12 }, (_, i) => pub(`p${String(i).padStart(2, "0")}`, 1000 - i * 10));
    const r = await listerContenusARelancer(deps(douze).d, MAINTENANT);
    expect(r).toHaveLength(NOMBRE_MAX_AFFICHES.valeur);
    expect(r.map((l) => l.publicationId)).toEqual(douze.slice(0, 10).map((p) => p.id));
  });
});

describe("ligne rendue", () => {
  it("porte les champs attendus, le média et le rang de republication déjà atteint", async () => {
    const pubs = [pub("a", 900), pub("b", 500, { videoId: undefined, visuelId: "vis-b" }), pub("c", 100)];
    const creneaux = [{ id: "republication-a-1" }, { id: "republication-a-2" }, { id: "republication-b-1" }, { id: "republication-ab-1" }, { id: "autre" }];
    const r = await listerContenusARelancer(deps(pubs, creneaux).d, MAINTENANT);
    const a = r.find((l) => l.publicationId === "a")!;
    expect(a).toMatchObject({ publicationId: "a", reseau: "instagram", date: pubs[0].date, media: "video", rangDejaAtteint: 2 });
    expect(r.find((l) => l.publicationId === "b")).toMatchObject({ media: "visuel", rangDejaAtteint: 1 });
    expect(r.find((l) => l.publicationId === "c")!.rangDejaAtteint).toBe(0);
  });
  it("coupe le texte d'origine à 80 signes", async () => {
    const long = "x".repeat(300);
    const r = await listerContenusARelancer(deps([pub("a", 900, { texte: long }), pub("b", 500), pub("c", 100)]).d, MAINTENANT);
    expect(r[0].debutTexte.length).toBeLessThanOrEqual(80);
    expect(r[0].debutTexte.length).toBeGreaterThan(0);
  });
  it("la raison cite le réseau et le rang, sans « score », sans « € », sans interdit", async () => {
    const r = await listerContenusARelancer(deps(trio()).d, MAINTENANT);
    expect(r[0].raison).toBe("Parmi les mieux classés de vos publications Instagram : 1re sur 3.");
    expect(r[1].raison).toBe("Parmi les mieux classés de vos publications Instagram : 2e sur 3.");
    for (const l of r) {
      expect(l.raison).toContain("Instagram");
      expect(l.raison.toLowerCase()).not.toContain("score");
      expect(l.raison).not.toContain("€");
      expect(l.raison).not.toMatch(/\b0[.,]\d+/);
      expect(interditsTousEcrivains(l.raison)).toEqual([]);
    }
  });
});

describe("lecture seule", () => {
  it("n'appelle aucune méthode d'écriture (les doublures lèvent) et ne modifie pas les entrées", async () => {
    const pubs = trio();
    const avant = JSON.stringify(pubs);
    const { d, ecritures } = deps(pubs, [{ id: "republication-a-1" }]);
    await listerContenusARelancer(d, MAINTENANT);
    expect(ecritures).toEqual([]);
    expect(JSON.stringify(pubs)).toBe(avant);
  });
  it("lectures bornées : le filtre transmis aux dépôts écarte les créneaux hors préfixe", async () => {
    let filtreCreneaux: ((c: { id: string }) => boolean) | undefined;
    const { d } = deps(trio());
    d.creneaux.lister = (async (f?: (c: { id: string }) => boolean) => ((filtreCreneaux = f), [])) as unknown as typeof d.creneaux.lister;
    await listerContenusARelancer(d, MAINTENANT);
    expect(filtreCreneaux).toBeTypeOf("function");
    expect(filtreCreneaux!({ id: "republication-a-1" })).toBe(true);
    expect(filtreCreneaux!({ id: "autre" })).toBe(false);
  });
});

describe("garde statique du fichier", () => {
  const source = readFileSync("src/services/contenus-a-relancer.ts", "utf8");
  it("ni lecture de réglage, ni requête, ni fournisseur, ni envoi", () => {
    expect(source).not.toContain("lireParametre");
    expect(source).not.toContain(".requete");
    for (const interdit of ["@/fournisseurs", "@/services/zernio", "envoi-depuis-creneau", "branchement-envoi-calendrier", "valider-entree", "reprise-envois"]) {
      expect(source).not.toContain(interdit);
    }
  });
  it("n'appelle aucune écriture et ne lit pas seuilPerformance", () => {
    expect(source).not.toMatch(/\.(enregistrer|supprimer|fusionner|mettreAJour|journaliser)\(/);
    expect(source).not.toContain("seuilPerformance");
  });
});
