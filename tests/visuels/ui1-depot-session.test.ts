/** UI-1 : dépôt d'un texte de session (validation AVANT la fiche, phrases précises) et aide au format générée. */
import { describe, expect, it } from "vitest";
import { LIMITES } from "@/briques/visuels/limites";
import { capaciteCarte, capaciteEtape, capaciteListe, PAGES, TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { DepotMemoire } from "@/donnees/memoire";
import type { Visuel } from "@/domaine/visuels/visuel";
import { interditsDans } from "@/visuels/services/production";
import { creerDepuisFormulaire } from "@/visuels/services/creation";
import { ErreurVisuel, deposerSession, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { aideFormat, EXEMPLES_PAGES, MODELE_PAQUET } from "@/visuels/texte/aide-format";
import { lirePaquetSession } from "@/visuels/texte/session";
import { phrasesPaquetSession } from "@/visuels/texte/phrases-paquet";
import { CarrouselSpec, Page } from "@/domaine/visuels/schema";

const modele = () => JSON.parse(MODELE_PAQUET) as { spec: { pages: Record<string, unknown>[] } } & Record<string, unknown>;

describe("phrases précises d'un paquet invalide", () => {
  it("un point trop long : « Page 2, point 1 : trop long (N signes au plus) »", () => {
    const p = modele();
    p.spec.pages[1] = { type: "T06", titre: "Votre routine", points: [{ texte: "x".repeat(130) }, { texte: "Un deuxième geste" }, { texte: "Un troisième geste" }] };
    const phrases = phrasesPaquetSession(JSON.stringify(p));
    expect(phrases).toHaveLength(1);
    expect(phrases[0]).toMatch(/^Page 2, point 1 : trop long \(\d+ signes au plus\)$/);
  });
  it("jusqu'à 5 champs fautifs", () => {
    const p = modele();
    p.spec.pages = p.spec.pages.map((pg) => (pg.type === "T21" ? pg : { ...pg, titre: "x".repeat(200) }));
    expect(phrasesPaquetSession(JSON.stringify(p)).length).toBe(5);
  });
  it("JSON illisible, vide, trop gros : une phrase en français", () => {
    expect(phrasesPaquetSession("{ pas du json")[0]).toMatch(/JSON/);
    expect(phrasesPaquetSession("   ")[0]).toMatch(/vide/);
    expect(phrasesPaquetSession("x".repeat(70_000))[0]).toMatch(/64 Ko/);
  });
  it("un type de page inconnu et une clé inconnue", () => {
    const p = modele();
    p.spec.pages[1] = { type: "T99" };
    expect(phrasesPaquetSession(JSON.stringify(p))[0]).toMatch(/^Page 2 : type de page inconnu/);
    const q = modele();
    q.extra = 1;
    expect(phrasesPaquetSession(JSON.stringify(q))[0]).toMatch(/champ inconnu « extra »/);
  });
  it("paquet valide : aucune phrase", () => {
    expect(phrasesPaquetSession(MODELE_PAQUET)).toEqual([]);
  });
});

function monter() {
  const depot = new DepotMemoire<Visuel>();
  let chaine: Promise<unknown> = Promise.resolve();
  let allume = true;
  const deps = {
    depot,
    texte: () => ({ mode: "session" as const, ecrire: async (d: { type: string; contenu?: string }) => lirePaquetSession(d.contenu ?? "") }),
    porte: controlerCarrousel,
    contextePorte: async () => ({ faitsDisponibles: false, interditsDans }),
    allume: async () => allume,
    rendre: async () => { throw new Error("pas de rendu ici"); },
    rendreReseaux: async () => { throw new Error("pas de rendu ici"); },
    urlLecture: async (c: string) => c,
    verrou: (f: () => Promise<unknown>) => { const s = chaine.then(f, f); chaine = s.catch(() => undefined); return s; },
    maintenant: () => "2026-10-23T10:00:00.000Z",
    lireParametre: async <T>(_i: string, d: T) => d,
    ecrireParametre: async () => undefined,
  } as unknown as DependancesCarrousels;
  return { deps, depot, eteindre: () => { allume = false; } };
}
const donnees = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };

describe("création depuis le formulaire : aucune fiche pour un paquet invalide", () => {
  it("paquet invalide : phrases précises, texte gardé, aucune fiche", async () => {
    const b = monter();
    const p = modele();
    p.spec.pages[1] = { type: "T06", titre: "Votre routine", points: [{ texte: "x".repeat(130) }, { texte: "Un deuxième geste" }, { texte: "Un troisième geste" }] };
    const contenu = JSON.stringify(p);
    const r = await creerDepuisFormulaire(donnees({ type: "paquet-session", contenu }), b.deps);
    expect(r).toMatchObject({ contenu });
    expect("erreurs" in r && r.erreurs[0]).toMatch(/^Page 2, point 1 : trop long/);
    expect(await b.depot.lister(() => true)).toHaveLength(0);
  });
  it("deposerSession lève PAQUET_INVALIDE avec les phrases, sans créer de fiche", async () => {
    const b = monter();
    const e = await deposerSession("{ pas du json", b.deps).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurVisuel);
    expect((e as ErreurVisuel).code).toBe("PAQUET_INVALIDE");
    expect((e as ErreurVisuel).details?.[0]).toMatch(/JSON/);
    expect(await b.depot.lister(() => true)).toHaveLength(0);
  });
  it("paquet valide : une fiche, passée en vert", async () => {
    const b = monter();
    const r = await creerDepuisFormulaire(donnees({ type: "paquet-session", contenu: MODELE_PAQUET }), b.deps);
    expect(r).toHaveProperty("id");
    const [v] = await b.depot.lister(() => true);
    expect(v?.erreur).toBeUndefined();
    expect(v?.statut).toBe("ecrit");
    expect(v?.rapport?.verdict).toBe("vert");
  });
  it("générateur éteint : un seul état « eteint », aucune fiche", async () => {
    const b = monter();
    b.eteindre();
    const r = await creerDepuisFormulaire(donnees({ type: "sujet", sujet: "Un sujet" }), b.deps);
    expect(r).toMatchObject({ eteint: true });
    expect(await b.depot.lister(() => true)).toHaveLength(0);
  });
});

describe("modèle JSON copiable", () => {
  const ctx = { faitsDisponibles: false, interditsDans };
  it("passe le schéma et la porte en VERT", () => {
    const lu = lirePaquetSession(MODELE_PAQUET);
    const { rapport } = controlerCarrousel(lu.spec, ctx);
    expect(rapport.controles.map((c) => c.phrase)).toEqual([]);
    expect(rapport.verdict).toBe("vert");
  });
  it("sans chiffre (hors numéros de version), ni « Grenoble », « Aucun gain garanti », « J'aide »", () => {
    const sansVersions = MODELE_PAQUET.replace(/"(?:paquet-session-carrousel|carrousel)\/1"/g, '""').replace(/"type": "T\d+[A-Z]?"/g, '"type": ""');
    expect(sansVersions).not.toMatch(/\d/);
    expect(MODELE_PAQUET).not.toMatch(/grenoble|aucun gain garanti|j['’]aide/i);
  });
  it("est du JSON copiable, indenté", () => {
    expect(() => JSON.parse(MODELE_PAQUET)).not.toThrow();
    expect(MODELE_PAQUET).toContain("\n  ");
  });
});

describe("aide au format générée depuis le registre et le schéma", () => {
  const aide = aideFormat();
  const type = (id: string) => aide.types.find((t) => t.id === id)!;
  it("liste TOUS les types du registre, dans l'ordre, avec nom et rôle du registre", () => {
    expect(aide.types.map((t) => t.id)).toEqual([...TYPES_PAGE]);
    for (const t of aide.types) {
      expect(t.nom).toBe(PAGES[t.id as keyof typeof PAGES].nom);
      expect(t.role).toBe(PAGES[t.id as keyof typeof PAGES].role);
    }
  });
  it("un exemple valide par type du registre", () => {
    for (const id of TYPES_PAGE) expect(Page.safeParse(EXEMPLES_PAGES[id]).success, id).toBe(true);
  });
  it("limites du titre = registre (borné par le plafond général)", () => {
    for (const id of TYPES_PAGE) {
      const max = Math.min(PAGES[id].titreMax, LIMITES.titreMax);
      if (PAGES[id].titreMax === 0) expect(type(id).lignes.join("|"), id).not.toMatch(/^titre/m);
      else expect(type(id).lignes.find((l) => l.startsWith("titre")), id).toContain(`${max} signes au plus`);
    }
  });
  it("nombre d'éléments = registre", () => {
    expect(type("T06").lignes.join("\n")).toContain(`points : ${PAGES.T06.elements.min} à ${PAGES.T06.elements.max}`);
    expect(type("T20").lignes.join("\n")).toContain(`étapes : ${PAGES.T20.elements.min} à ${PAGES.T20.elements.max}`);
    expect(type("T02").lignes.join("\n")).toContain(`cartes : 2 à ${PAGES.T02.cartesMax}`);
  });
  it("signes par élément selon le nombre d'éléments = fonctions de capacité du registre", () => {
    const point = type("T06").lignes.find((l) => l.startsWith("texte de chaque point"))!;
    expect(point).toContain(`${capaciteListe(3).texte} signes (3 points)`);
    expect(point).toContain(`${capaciteListe(4).texte} signes (4 points)`);
    const etape = type("T20").lignes.find((l) => l.startsWith("titre de chaque étape"))!;
    expect(etape).toContain(`${capaciteEtape(3).titre} signes (3 étapes)`);
    const carte = type("T02").lignes.find((l) => l.startsWith("titre de chaque carte"))!;
    expect(carte).toContain(`${capaciteCarte(2).titre} signes (2 cartes)`);
    expect(carte).toMatch(new RegExp(`${capaciteCarte(6).titre} signes \\((?:5 à )?6 cartes\\)`));
  });
  it("T21 : aucun champ, texte posé par le code", () => {
    expect(type("T21").lignes.join(" ")).toMatch(/aucun texte/);
  });
  it("les exemples forment des carrousels valides (le modèle l'est)", () => {
    expect(CarrouselSpec.safeParse(modele().spec).success).toBe(true);
  });
});

describe("texte sans aucune correction typographique", () => {
  it("la porte ne rend pas de texte corrigé : la fiche garde le texte validé au lieu de se bloquer", async () => {
    const b = monter();
    const { id } = await deposerSession(MODELE_PAQUET, b.deps);
    const v = await b.depot.obtenir(id);
    expect(v?.statut).toBe("ecrit");
    expect(v?.spec?.pages).toHaveLength(7);
  });
});
