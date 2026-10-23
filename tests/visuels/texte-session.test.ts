import { describe, expect, it } from "vitest";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { creerFournisseurSession, lirePaquetSession } from "@/visuels/texte/session";

const spec = {
  version: "carrousel/1",
  alt: "Carrousel d'exemple sur le rangement d'un bureau",
  pages: [
    { type: "T01", titre: "Ranger son bureau", sousTitre: "Un geste après l'autre" },
    { type: "T06", titre: "Les bons réflexes", points: [{ texte: "Vider le plateau" }, { texte: "Trier les papiers" }, { texte: "Essuyer la surface" }] },
    { type: "T21" },
  ],
};
const paquet = (extra: object = {}) => ({
  version: "paquet-session-carrousel/1",
  sujet: "Ranger son bureau",
  titre: "Ranger son bureau",
  pourquoi: ["Couverture simple.", "Des réflexes à retenir.", "Invitation finale."],
  spec,
  ...extra,
});
const lire = (o: unknown) => lirePaquetSession(JSON.stringify(o));
const echec = (contenu: string) => {
  try {
    lirePaquetSession(contenu);
  } catch (e) {
    return e as Error & { code?: string };
  }
  throw new Error("aucune erreur levée");
};

describe("lirePaquetSession", () => {
  it("accepte un paquet valide", () => {
    const r = lire(paquet());
    expect(r.mode).toBe("session");
    expect(r.titre).toBe("Ranger son bureau");
    expect(r.pourquoi).toHaveLength(3);
    expect(CarrouselSpec.safeParse(r.spec).success).toBe(true);
  });

  it("refuse un paquet dont la dernière page n'est pas T21, avec le chemin spec.pages", () => {
    const deux = { ...spec, pages: spec.pages.slice(0, 2) };
    const e = echec(JSON.stringify(paquet({ spec: deux, pourquoi: ["Couverture simple.", "Des réflexes à retenir."] })));
    expect(e.code).toBe("PAQUET_INVALIDE");
    expect(e.message).toMatch(/spec\.pages/u);
    expect(e.message).toMatch(/T21/u);
  });

  it("refuse 64 Ko + 1 octet et accepte moins", () => {
    const json = JSON.stringify(paquet());
    const trop = " ".repeat(64 * 1024 + 1 - Buffer.byteLength(json)) + json;
    expect(Buffer.byteLength(trop)).toBe(64 * 1024 + 1);
    expect(echec(trop).code).toBe("PAQUET_INVALIDE");
    const limite = trop.slice(1);
    expect(Buffer.byteLength(limite)).toBe(64 * 1024);
    expect(() => lirePaquetSession(limite)).not.toThrow();
  });

  it("refuse une clé inconnue, au sommet comme dans la spec", () => {
    const a = echec(JSON.stringify(paquet({ extra: 1 })));
    expect(a.code).toBe("PAQUET_INVALIDE");
    expect(a.message).toMatch(/extra/u);
    const b = echec(JSON.stringify(paquet({ spec: { ...spec, couleur: "rouge" } })));
    expect(b.code).toBe("PAQUET_INVALIDE");
    expect(b.message).toMatch(/spec/u);
  });

  it("refuse une URL dans un texte, avec le chemin du champ", () => {
    const pages = [...spec.pages];
    pages[0] = { type: "T01", titre: "Voir https://exemple.fr", sousTitre: "Un geste" } as never;
    const e = echec(JSON.stringify(paquet({ spec: { ...spec, pages } })));
    expect(e.code).toBe("PAQUET_INVALIDE");
    expect(e.message).toMatch(/spec\.pages\.0\.titre/u);
  });

  it("refuse une mauvaise version et trop de phrases de pourquoi", () => {
    expect(echec(JSON.stringify(paquet({ version: "autre" }))).message).toMatch(/version/u);
    expect(echec(JSON.stringify(paquet({ pourquoi: Array.from({ length: 11 }, () => "Une phrase.") }))).message).toMatch(/pourquoi/u);
    expect(echec(JSON.stringify(paquet({ pourquoi: ["x".repeat(201)] }))).message).toMatch(/pourquoi/u);
    expect(echec(JSON.stringify(paquet({ titre: "x".repeat(121) }))).message).toMatch(/titre/u);
  });

  it("refuse un lien dans le titre, avec le chemin titre", () => {
    const e = echec(JSON.stringify(paquet({ titre: "Voir exemple.fr" })));
    expect(e.code).toBe("PAQUET_INVALIDE");
    expect(e.message).toMatch(/« titre »/u);
  });

  it("refuse un caractère invisible dans pourquoi, avec le chemin pourquoi.0", () => {
    const e = echec(JSON.stringify(paquet({ pourquoi: ["\u200B...", "Des réflexes.", "Invitation finale."] })));
    expect(e.code).toBe("PAQUET_INVALIDE");
    expect(e.message).toMatch(/« pourquoi\.0 »/u);
  });

  it("refuse un lien dans le sujet", () => {
    expect(echec(JSON.stringify(paquet({ sujet: "Voir exemple.fr" }))).message).toMatch(/« sujet »/u);
  });

  it("exige une phrase de pourquoi par page", () => {
    const e = echec(JSON.stringify(paquet({ pourquoi: ["Une seule."] })));
    expect(e.code).toBe("PAQUET_INVALIDE");
    expect(e.message).toMatch(/« pourquoi »/u);
    expect(e.message).toMatch(/Une phrase de pourquoi par page/u);
  });

  it("répond par une phrase claire en français à un JSON cassé", () => {
    const e = echec('{"version": "paquet-session-carrousel/1", ');
    expect(e.code).toBe("PAQUET_INVALIDE");
    expect(e.message).toMatch(/JSON/u);
    expect(e.message).toMatch(/[.]$/u);
    expect(e.message).not.toMatch(/Unexpected|position \d/u);
  });
});

describe("creerFournisseurSession", () => {
  const f = creerFournisseurSession();
  it("est en mode session et lit un paquet", async () => {
    expect(f.mode).toBe("session");
    const r = await f.ecrire({ type: "paquet-session", contenu: JSON.stringify(paquet()) });
    expect(r.mode).toBe("session");
  });
  it("refuse un sujet avec SESSION_ATTENDUE", async () => {
    await expect(f.ecrire({ type: "sujet", sujet: "Ranger" })).rejects.toMatchObject({ code: "SESSION_ATTENDUE" });
  });
});
