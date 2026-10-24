/**
 * H3 · rendu par réseau (service, rendu simulé) : une version par CADRE (LinkedIn : pages + PDF ; Meta, pour Instagram ET Facebook : une seule
 * série de JPEG, sans PDF), empreinte propre à chaque cadre, refus d'une page qui empiète sur une zone réservée, interrupteur vérifié avant
 * toute soumission. Sans cadre, l'empreinte et les demandes du rendu actuel ne changent pas.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { validerProprietesPage } from "@/visuels/proprietes-page";
import { canonique, empreinteCarrousel, rendreCarrousel, rendrePageVisuel, VERSION_RENDU, creerRegistreMemoire } from "@/visuels/services/rendu";
import { creerRegistreVersionsMemoire, empreinteReseau, rendreVersionsReseaux, titreDocument, type DependancesRenduReseaux } from "@/visuels/services/rendu-reseaux";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

/** Service SIMULÉ : enregistre les soumissions, répond « terminé » ; `intrusions` : mesures renvoyées pour la page 1. */
function simule(options: { intrusions?: Record<string, number> } = {}) {
  const soumises: DemandeRendu[] = [];
  const service: ServiceRendu = {
    async soumettre(d) {
      soumises.push(d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const pdf = id.endsWith("-pdf");
      const p1 = /-p1-x/.test(id);
      const base = { debordements: 0, textesEnZone: 0, chevauchements: 0, taillePoliceMin: 26, intrusions: 0 };
      return { statut: "termine", sortieCle: `cle/${id}`, mesures: pdf ? { pages: 2, octets: 1000 } : p1 && options.intrusions ? { ...base, ...options.intrusions } : base };
    },
  };
  return { service, soumises };
}

function dependances(service: ServiceRendu, allume = true): DependancesRenduReseaux {
  return {
    rendu: () => service,
    stockage: { urlDepot: async (cle) => `https://r2.exemple/depot/${cle}`, urlLecture: async (cle) => `https://r2.exemple/lecture/${cle}` },
    registre: creerRegistreVersionsMemoire(),
    attendre: async () => {},
    allume: async () => allume,
  };
}

const pagesDe = (s: DemandeRendu[]) => s.filter((d) => d.operation === "visuel-page");
const pdfsDe = (s: DemandeRendu[]) => s.filter((d) => d.operation === "assemblage-pdf");
const proprietes = (d: DemandeRendu) => d.parametres.proprietes as Record<string, unknown>;

describe("H3 · rendreVersionsReseaux", () => {
  it("Instagram + Facebook : UNE seule série de JPEG (cadre meta), aucun PDF", async () => {
    const { service, soumises } = simule();
    const versions = await rendreVersionsReseaux(CONTENU_ESSAI, ["instagram", "facebook"], dependances(service));
    expect(versions).toHaveLength(1);
    expect(versions[0].cadre).toBe("meta");
    expect(versions[0].reseaux).toEqual(["instagram", "facebook"]);
    expect(versions[0].pdfCle).toBeNull();
    expect(pagesDe(soumises)).toHaveLength(CONTENU_ESSAI.pages.length);
    expect(pdfsDe(soumises)).toHaveLength(0);
    for (const d of pagesDe(soumises)) expect(proprietes(d).cadre).toBe("meta");
  });
  it("LinkedIn : les pages (×1 et ×2) et UN PDF, titre de document de 40 signes au plus", async () => {
    const { service, soumises } = simule();
    const [v] = await rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin"], dependances(service));
    expect(v.cadre).toBe("linkedin");
    expect(v.pages).toHaveLength(CONTENU_ESSAI.pages.length);
    expect(pagesDe(soumises)).toHaveLength(2 * CONTENU_ESSAI.pages.length);
    expect(pdfsDe(soumises)).toHaveLength(1);
    expect(v.pdfCle).toMatch(/\.pdf$/);
    const titre = String(pdfsDe(soumises)[0].parametres.titre);
    expect([...titre].length).toBeLessThanOrEqual(40);
    for (const d of pagesDe(soumises)) expect(proprietes(d).cadre).toBe("linkedin");
  });
  it("les trois réseaux : deux versions (linkedin, meta), un seul PDF", async () => {
    const { service, soumises } = simule();
    const versions = await rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin", "instagram", "facebook"], dependances(service));
    expect(versions.map((v) => v.cadre)).toEqual(["linkedin", "meta"]);
    expect(pdfsDe(soumises)).toHaveLength(1);
    expect(new Set(versions.map((v) => v.empreinte)).size).toBe(2);
  });
  it("une page qui empiète sur une zone réservée est refusée (nom de la zone dans le message)", async () => {
    const { service } = simule({ intrusions: { intrusions: 1, intrusion_pastilleTitre: 1 } });
    await expect(rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin"], dependances(service))).rejects.toThrow("La page 1 empiète sur une zone réservée (pastilleTitre)");
  });
  it("une mesure `intrusions` absente dans un cadre est refusée", async () => {
    const { service } = simule({ intrusions: { intrusions: undefined as unknown as number } });
    await expect(rendreVersionsReseaux(CONTENU_ESSAI, ["instagram"], dependances(service))).rejects.toThrow(/intrusions absente/);
  });
  it("générateur éteint : 0 demande", async () => {
    const { service, soumises } = simule();
    await expect(rendreVersionsReseaux(CONTENU_ESSAI, ["linkedin", "facebook"], dependances(service, false))).rejects.toThrow(/éteint/);
    expect(soumises).toHaveLength(0);
  });
  it("IDEMPOTENT : même spec et même cadre = aucun nouveau rendu", async () => {
    const { service, soumises } = simule();
    const deps = dependances(service);
    const a = await rendreVersionsReseaux(CONTENU_ESSAI, ["facebook"], deps);
    const n = soumises.length;
    const b = await rendreVersionsReseaux(CONTENU_ESSAI, ["instagram"], deps);
    expect(soumises).toHaveLength(n);
    expect(b[0].empreinte).toBe(a[0].empreinte);
  });
  it("aucun réseau ou un réseau inconnu : refusé avant tout rendu", async () => {
    const { service, soumises } = simule();
    await expect(rendreVersionsReseaux(CONTENU_ESSAI, [], dependances(service))).rejects.toThrow(/réseau/);
    await expect(rendreVersionsReseaux(CONTENU_ESSAI, ["tiktok" as never], dependances(service))).rejects.toThrow(/réseau/);
    expect(soumises).toHaveLength(0);
  });
});

describe("H3 · empreintes", () => {
  const valide = validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 }).spec;
  it("sans cadre : l'empreinte du rendu actuel est inchangée", () => {
    expect(empreinteCarrousel(CONTENU_ESSAI)).toBe(createHash("sha256").update(`${VERSION_RENDU}\n${canonique(valide)}`).digest("hex"));
  });
  it("par cadre : sha256(VERSION_RENDU + \"\\ncadre=\" + cadre + \"\\n\" + canonique(spec)), distincte de l'empreinte sans cadre", () => {
    for (const cadre of ["linkedin", "meta"] as const) {
      expect(empreinteReseau(CONTENU_ESSAI, cadre)).toBe(createHash("sha256").update(`${VERSION_RENDU}\ncadre=${cadre}\n${canonique(valide)}`).digest("hex"));
      expect(empreinteReseau(CONTENU_ESSAI, cadre)).not.toBe(empreinteCarrousel(CONTENU_ESSAI));
    }
  });
});

describe("H3 · rendrePageVisuel et rendu sans cadre", () => {
  it("le rendu sans cadre n'envoie aucune clé `cadre`", async () => {
    const { service, soumises } = simule();
    await rendreCarrousel({ ...CONTENU_ESSAI, alt: "Variante sans cadre" }, { ...dependances(service), registre: creerRegistreMemoire() });
    for (const d of pagesDe(soumises)) expect(Object.keys(proprietes(d))).toEqual(["spec", "index"]);
  });
  it("rendrePageVisuel refuse une page qui empiète sur une zone réservée", async () => {
    const { service } = simule({ intrusions: { intrusions: 2, intrusion_carreFacebookHaut: 2 } });
    const spec = validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 }).spec;
    await expect(
      rendrePageVisuel({ service, attente: { delaiMs: 1000, attendre: async () => {} }, stockage: dependances(service).stockage, base: "b", idBase: "visuel-x", spec, index: 0, scale: 1, cadre: "meta" }),
    ).rejects.toThrow("La page 1 empiète sur une zone réservée (carreFacebookHaut)");
  });
  it("titre du document : 40 signes au plus, coupé sur un mot", () => {
    expect(titreDocument("Un titre court")).toBe("Un titre court");
    const long = titreDocument("Ranger classer noter relire trier poser choisir garder ouvrir");
    expect([...long].length).toBeLessThanOrEqual(40);
    expect(long.endsWith("…")).toBe(true);
  });
});
