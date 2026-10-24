import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { creerRegistreMemoire, empreinteCarrousel, VERSION_RENDU, rendreCarrousel, type DependancesRenduVisuels } from "@/visuels/services/rendu";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

/** JSON à clés triées, comme `empreinteCarrousel` (recopié : la fonction n'est pas exportée). */
function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonique(x)}`).join(",")}}`;
  return JSON.stringify(v);
}

/** Service de rendu SIMULÉ (aucun Chromium) : enregistre les soumissions, répond « terminé » avec des mesures plausibles. */
function simule(options: { debordements?: number; textesEnZone?: number; chevauchements?: number; redemarrageApres?: number } = {}) {
  const soumises: DemandeRendu[] = [];
  const termines = new Set<string>();
  let etats = 0;
  const service: ServiceRendu = {
    async soumettre(d) {
      soumises.push(d);
      termines.add(d.idRendu);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      etats++;
      // Redémarrage du conteneur : le premier suivi après N états répond 404 (« inconnu ») et oublie tout.
      if (options.redemarrageApres !== undefined && etats === options.redemarrageApres) {
        termines.clear();
        return { statut: "inconnu" };
      }
      if (!termines.has(id)) return { statut: "inconnu" };
      const x2 = id.includes("-x2");
      const pdf = id.includes("-pdf");
      return { statut: "termine", sortieCle: `cle/${id}`, mesures: pdf ? { pages: 2, octets: 1000 } : { debordements: options.debordements ?? 0, textesEnZone: options.textesEnZone ?? 0, chevauchements: options.chevauchements ?? 0, taillePoliceMin: 26, largeur: x2 ? 2160 : 1080, hauteur: x2 ? 2700 : 1350, scale: x2 ? 2 : 1, octets: 5000 } };
    },
  };
  return { service, soumises };
}

function dependances(service: ServiceRendu): DependancesRenduVisuels {
  return {
    rendu: () => service,
    stockage: { urlDepot: async (cle) => `https://r2.exemple/depot/${cle}`, urlLecture: async (cle) => `https://r2.exemple/lecture/${cle}` },
    registre: creerRegistreMemoire(),
    attendre: async () => {},
    allume: async () => true,
  };
}

describe("M2-03 · service de rendu des visuels (rendu simulé)", () => {
  it("rend N pages ×1 et ×2, le PDF et la vignette", async () => {
    const { service, soumises } = simule();
    const r = await rendreCarrousel(CONTENU_ESSAI, dependances(service));
    expect(r.pages).toHaveLength(2);
    expect(soumises.filter((d) => d.operation === "visuel-page")).toHaveLength(4); // 2 pages × 2 échelles
    expect(soumises.filter((d) => d.operation === "assemblage-pdf")).toHaveLength(1);
    expect(soumises.filter((d) => d.operation === "visuel-page" && d.parametres.scale === 2)).toHaveLength(2);
    expect(r.pdfCle).toMatch(/\.pdf$/);
    expect(r.vignetteCle).toBe(r.pages[0].x1.cle);
    const pdf = soumises.find((d) => d.operation === "assemblage-pdf")!;
    expect(Object.keys(pdf.entrees)).toEqual(["page-1", "page-2"]);
    expect(pdf.sortie.urlDepot).toContain("depot/");
    for (const d of soumises) expect(d.file).toBe("courte");
  });
  it("IDEMPOTENT : même empreinte = aucun nouveau rendu", async () => {
    const { service, soumises } = simule();
    const deps = dependances(service);
    const a = await rendreCarrousel(CONTENU_ESSAI, deps);
    const n = soumises.length;
    const b = await rendreCarrousel(JSON.parse(JSON.stringify(CONTENU_ESSAI)), deps);
    expect(soumises).toHaveLength(n);
    expect(b).toEqual(a);
  });
  it("deux demandes simultanées de la même empreinte ne rendent qu'une fois", async () => {
    const { service, soumises } = simule();
    const deps = dependances(service);
    await Promise.all([rendreCarrousel(CONTENU_ESSAI, deps), rendreCarrousel(CONTENU_ESSAI, deps)]);
    expect(soumises.filter((d) => d.operation === "assemblage-pdf")).toHaveLength(1);
  });
  it("l'empreinte ne dépend pas de l'ordre des clés, mais change avec le contenu", () => {
    const renverse = { pages: CONTENU_ESSAI.pages, alt: CONTENU_ESSAI.alt, version: CONTENU_ESSAI.version };
    expect(empreinteCarrousel(renverse)).toBe(empreinteCarrousel(CONTENU_ESSAI));
    expect(empreinteCarrousel({ ...CONTENU_ESSAI, alt: `${CONTENU_ESSAI.alt} bis` })).not.toBe(empreinteCarrousel(CONTENU_ESSAI));
    expect(empreinteCarrousel(CONTENU_ESSAI)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("un contenu modifié donne un nouveau rendu", async () => {
    const { service, soumises } = simule();
    const deps = dependances(service);
    await rendreCarrousel(CONTENU_ESSAI, deps);
    const n = soumises.length;
    await rendreCarrousel({ ...CONTENU_ESSAI, alt: `${CONTENU_ESSAI.alt} bis` }, deps);
    expect(soumises.length).toBe(2 * n);
  });
  it("après un 404 de redémarrage, resoumet le MÊME idRendu", async () => {
    const { service, soumises } = simule({ redemarrageApres: 1 });
    const r = await rendreCarrousel(CONTENU_ESSAI, dependances(service));
    expect(r.pages).toHaveLength(2);
    const parId = new Map<string, number>();
    for (const d of soumises) parId.set(d.idRendu, (parId.get(d.idRendu) ?? 0) + 1);
    expect([...parId.values()].some((n) => n >= 2)).toBe(true);
    expect(soumises.every((d) => !/-e\d/.test(d.idRendu))).toBe(true); // jamais un nouvel identifiant pour un 404
  });
  it("un spec invalide est refusé avant tout rendu", async () => {
    const { service, soumises } = simule();
    await expect(rendreCarrousel({ ...CONTENU_ESSAI, pages: [] }, dependances(service))).rejects.toThrow();
    expect(soumises).toHaveLength(0);
  });
  it("une page qui déborde est refusée, rien n'est mémorisé et le PDF n'est pas assemblé", async () => {
    const { service, soumises } = simule({ debordements: 1 });
    const deps = dependances(service);
    await expect(rendreCarrousel(CONTENU_ESSAI, deps)).rejects.toThrow(/déborde/);
    expect(soumises.some((d) => d.operation === "assemblage-pdf")).toBe(false);
    expect(await deps.registre.lire(empreinteCarrousel(CONTENU_ESSAI))).toBeNull();
  });
  it("une page dont un texte entre dans une zone réservée (textesEnZone ≥ 1) est refusée, rien n'est mémorisé et le PDF n'est pas assemblé", async () => {
    const { service, soumises } = simule({ textesEnZone: 1 });
    const deps = dependances(service);
    await expect(rendreCarrousel(CONTENU_ESSAI, deps)).rejects.toThrow(/zone réservée/);
    expect(soumises.some((d) => d.operation === "assemblage-pdf")).toBe(false);
    expect(await deps.registre.lire(empreinteCarrousel(CONTENU_ESSAI))).toBeNull();
  });
  it("une mesure textesEnZone absente est refusée (aucune tolérance : un ancien studio-rendu ne publie pas de page non vérifiée)", async () => {
    const { service } = simule();
    const base = service.etat.bind(service);
    service.etat = async (id) => {
      const e = await base(id);
      return e.statut === "termine" && !id.includes("-pdf") ? { ...e, mesures: { debordements: 0, taillePoliceMin: 26 } } : e;
    };
    const err = await rendreCarrousel({ ...CONTENU_ESSAI, alt: "sans zone" }, dependances(service)).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/^La page \d+ : mesure des textes en zone réservée absente \(rendu refusé\)$/);
  });
  it("une page dont un texte chevauche un autre texte ou une illustration (chevauchements ≥ 1) est refusée, rien n'est mémorisé", async () => {
    const { service, soumises } = simule({ chevauchements: 1 });
    const deps = dependances(service);
    await expect(rendreCarrousel(CONTENU_ESSAI, deps)).rejects.toThrow(/chevauche/);
    expect(soumises.some((d) => d.operation === "assemblage-pdf")).toBe(false);
    expect(await deps.registre.lire(empreinteCarrousel(CONTENU_ESSAI))).toBeNull();
  });
  it("une mesure chevauchements absente est refusée", async () => {
    const { service } = simule();
    const base = service.etat.bind(service);
    service.etat = async (id) => {
      const e = await base(id);
      return e.statut === "termine" && !id.includes("-pdf") ? { ...e, mesures: { debordements: 0, textesEnZone: 0, taillePoliceMin: 26 } } : e;
    };
    const err = await rendreCarrousel({ ...CONTENU_ESSAI, alt: "sans chevauchements" }, dependances(service)).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/^La page \d+ : mesure des chevauchements absente \(rendu refusé\)$/);
  });
  it("interrupteur éteint = 0 soumission", async () => {
    const { service, soumises } = simule();
    await expect(rendreCarrousel({ ...CONTENU_ESSAI, alt: "éteint" }, { ...dependances(service), allume: async () => false })).rejects.toThrow(/éteint/);
    expect(soumises).toHaveLength(0);
  });
  it("une mesure de débordements absente ou non numérique est refusée", async () => {
    const { service } = simule();
    const base = service.etat.bind(service);
    service.etat = async (id) => {
      const e = await base(id);
      return e.statut === "termine" && !id.includes("-pdf") ? { ...e, mesures: { taillePoliceMin: 26 } } : e;
    };
    await expect(rendreCarrousel({ ...CONTENU_ESSAI, alt: "sans mesure" }, dependances(service))).rejects.toThrow(/mesure/i);
  });
  it("une taille de police absente lève une erreur distincte « mesure de la police absente », pas « texte sous 26 px »", async () => {
    const { service } = simule();
    const base = service.etat.bind(service);
    service.etat = async (id) => {
      const e = await base(id);
      return e.statut === "termine" && !id.includes("-pdf") ? { ...e, mesures: { debordements: 0 } } : e;
    };
    const err = await rendreCarrousel({ ...CONTENU_ESSAI, alt: "sans police" }, dependances(service)).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/^La page \d+ : mesure de la police absente \(rendu refusé\)$/);
    expect((err as Error).message).not.toMatch(/texte sous/);
  });
  it("les pages partent par lots d'une page (×1 et ×2) : jamais plus de 2 rendus simultanés", async () => {
    const { service } = simule();
    let actifs = 0;
    let max = 0;
    const soumettre = service.soumettre.bind(service);
    service.soumettre = async (d) => {
      if (d.operation === "visuel-page") {
        actifs++;
        max = Math.max(max, actifs);
        await new Promise((r) => setTimeout(r, 5));
        actifs--;
      }
      return soumettre(d);
    };
    await rendreCarrousel({ ...CONTENU_ESSAI, alt: "charge" }, dependances(service));
    expect(max).toBeLessThanOrEqual(2);
  });

  it("VERSION_RENDU est figée à visuel-page/8 (finitions : T21 à variantes, rubrique non répétée par le titre ; les rendus des versions précédentes ne servent plus)", () => {
    expect(VERSION_RENDU).toBe("visuel-page/8");
  });

  it("l'empreinte dépend de la version du rendu : même spec, version différente = autre empreinte", () => {
    const spec = JSON.stringify(CONTENU_ESSAI);
    const avecVersion = (v: string) => createHash("sha256").update(`${v}\n${canonique(JSON.parse(spec))}`).digest("hex");
    expect(empreinteCarrousel(CONTENU_ESSAI)).toBe(avecVersion(VERSION_RENDU));
    expect(empreinteCarrousel(CONTENU_ESSAI)).not.toBe(avecVersion("visuel-page/2"));
  });
});
