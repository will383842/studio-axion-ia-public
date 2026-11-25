/** S-14-a : routeur pur du chat unique (table fermée par format, réglage éteint par défaut). Aucun appel réel. */
import { describe, expect, it } from "vitest";
import { listerFormats } from "@/formats";
import { CLES_REGLAGE_RETOUCHE, GENERATEURS_RETOUCHE } from "@/services/retouche-chat/generateurs";
import { CLE_REGLAGE_PORTE_UNIQUE, PHRASE_SANS_CHAT, choisirPorte, porteUniqueActive, routeDuFormat } from "@/services/retouche-chat/routeur";

const allume = async () => true;

describe("réglage retoucheChat.porteUnique", () => {
  it("clé fixée, éteinte par défaut, seul true exact allume", async () => {
    expect(CLE_REGLAGE_PORTE_UNIQUE).toBe("retoucheChat.porteUnique");
    expect(Object.values(CLES_REGLAGE_RETOUCHE)).not.toContain(CLE_REGLAGE_PORTE_UNIQUE);
    expect(await porteUniqueActive(async (_c, defaut) => defaut)).toBe(false);
    expect(await porteUniqueActive(async () => "true")).toBe(false);
    expect(await porteUniqueActive(async () => 1)).toBe(false);
    expect(await porteUniqueActive(async () => { throw new Error("panne"); })).toBe(false);
    expect(await porteUniqueActive(allume)).toBe(true);
  });
  it("éteint (absente, \"true\", 1) : « portes d'aujourd'hui » pour tous les formats", async () => {
    for (const lire of [async (_c: string, d: unknown) => d, async () => "true", async () => 1]) {
      for (const f of listerFormats({ inclureMasques: true, inclureReservesAWill: true })) expect(await choisirPorte(f.id, lire)).toEqual({ mode: "portes-actuelles" });
    }
  });
  it("lit la bonne clé, une seule fois", async () => {
    const vues: string[] = [];
    await choisirPorte("avocat", async (c) => (vues.push(c), true));
    expect(vues).toEqual([CLE_REGLAGE_PORTE_UNIQUE]);
  });
});

describe("table des portes", () => {
  it("les cinq générateurs du chat vont à leur adaptateur (le tutoriel à son film)", () => {
    expect(routeDuFormat("avocat")).toEqual({ porte: "plan-scenes", generateur: "avocat" });
    expect(routeDuFormat("image-video")).toEqual({ porte: "plan-scenes", generateur: "image-video" });
    expect(routeDuFormat("facecam-animee")).toEqual({ porte: "plan-scenes", generateur: "facecam-animee" });
    expect(routeDuFormat("video-longue")).toEqual({ porte: "plan-scenes", generateur: "video-longue" });
    expect(routeDuFormat("tutoriel-outil")).toEqual({ porte: "film-tutoriel", generateur: "tutoriel-outil" });
    for (const g of GENERATEURS_RETOUCHE) expect(routeDuFormat(g).porte).not.toBe("aucune");
  });
  it("tableau, cas concret, monteur et démo ont leur porte", () => {
    expect(routeDuFormat("tableau-anime")).toEqual({ porte: "tableau" });
    expect(routeDuFormat("cas-concret")).toEqual({ porte: "cas-concret" });
    expect(routeDuFormat("facecam")).toEqual({ porte: "monteur" });
    expect(routeDuFormat("demo-facecam")).toEqual({ porte: "demo", generateur: "demo-facecam", cle: "retoucheChat.demoFacecam" });
  });
  it("tout format de src/formats est traité : une porte ou une phrase simple sans jargon ni montant", () => {
    const formats = listerFormats({ inclureMasques: true, inclureReservesAWill: true });
    expect(formats.length).toBeGreaterThan(5);
    for (const f of formats) {
      const r = routeDuFormat(f.id);
      expect(r.porte).toBeTruthy();
      if (r.porte === "aucune") {
        expect(r.phrase).toBe(PHRASE_SANS_CHAT);
        expect(r.phrase).not.toMatch(/\d|[€$]|api|json|moteur|route/i);
      }
    }
  });
  it("podcast, tableau de bord, format inconnu ou propriété héritée : pas de chat, phrase simple", () => {
    for (const id of ["podcast", "tableau-de-bord", "inconnu", "", "__proto__", "constructor", "toString"]) expect(routeDuFormat(id)).toEqual({ porte: "aucune", phrase: PHRASE_SANS_CHAT });
  });
  it("allumé : la porte du format est rendue", async () => {
    expect(await choisirPorte("cas-concret", allume)).toEqual({ mode: "porte-unique", route: { porte: "cas-concret" } });
    expect(await choisirPorte("podcast", allume)).toEqual({ mode: "porte-unique", route: { porte: "aucune", phrase: PHRASE_SANS_CHAT } });
  });
});
