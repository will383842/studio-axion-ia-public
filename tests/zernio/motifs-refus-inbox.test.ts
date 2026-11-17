/** Raison d'un refus d'envoi sous FORME FERMÉE : module pur (T1 à T10). Données FICTIVES. */
import { describe, expect, it } from "vitest";
import { motifRefusInbox, motifReseau } from "@/fournisseurs/publication/zernio-motifs-refus";
import { CODES_META_CONNUS, CODES_MOTIF_REFUS, CODES_ZERNIO_CONNUS, LIBELLES_MOTIF_REFUS, estRaisonRefus, formaterRaison, type RaisonRefus } from "@/domaine/guide-reseau/raison-refus";

const pf = (code: number, sousCode?: number, extra: Record<string, unknown> = {}) => ({ error: "platform_api_error", platformError: { code, ...(sousCode === undefined ? {} : { error_subcode: sousCode }), ...extra } });

describe("motifRefusInbox : corps sans JSON et corps vide (T1, T2)", () => {
  it("T1 phrase connue en texte brut -> code ; phrase inconnue -> raison-inconnue, aucun texte", () => {
    expect(motifRefusInbox(400, "The page has messages disabled in the settings").motif).toBe("messagerie-desactivee-sur-la-page");
    const inconnu = motifRefusInbox(400, "Jeanne Exemple a écrit n'importe quoi");
    expect(inconnu.motif).toBe("raison-inconnue");
    expect(JSON.stringify(inconnu)).not.toContain("Jeanne");
  });
  it("T2 corps vide, absent ou étrange -> raison-inconnue", () => {
    for (const c of [undefined, null, "", 12, [], {}]) expect(motifRefusInbox(400, c).motif).toBe("raison-inconnue");
    expect(motifRefusInbox(502, undefined).motif).toBe("erreur-serveur");
  });
});

describe("T3 table complète", () => {
  const lignes: Array<[string, number, unknown, string]> = [
    ["phrase messages disabled in settings", 400, { error: "The page has messages disabled in the settings" }, "messagerie-desactivee-sur-la-page"],
    ["phrase has messages disabled", 400, { message: "page has messages disabled" }, "messagerie-desactivee-sur-la-page"],
    ["sous-code 2534041", 400, pf(10, 2534041), "messagerie-instagram-desactivee"],
    ["phrase instagram direct messages", 400, { error: "Disabled access to Instagram direct messages" }, "messagerie-instagram-desactivee"],
    ["sous-code 2534024", 400, pf(10, 2534024), "fenetre-7-jours-depassee"],
    ["sous-code 2534022", 400, pf(10, 2534022), "fenetre-7-jours-depassee"],
    ["sous-code 2018278", 400, pf(10, 2018278), "fenetre-7-jours-depassee"],
    ["phrase outside allowed window", 400, { error: "Message sent outside of the allowed window" }, "fenetre-7-jours-depassee"],
    ["phrase older than 7 days", 400, { error: "comment older than 7 days" }, "fenetre-7-jours-depassee"],
    ["sous-code 2534023", 400, pf(10, 2534023), "reponse-privee-deja-envoyee"],
    ["code 10900", 400, pf(10900), "reponse-privee-deja-envoyee"],
    ["phrase already replied (forme exacte)", 400, { error: "already replied" }, "reponse-privee-deja-envoyee"],
    ["sous-code 2534025", 400, pf(10, 2534025), "commentaire-non-eligible"],
    ["phrase not eligible", 400, { error: "comment is not eligible" }, "commentaire-non-eligible"],
    ["code 10903", 400, pf(10903), "auteur-page-ou-confidentialite"],
    ["sous-code 2534014", 400, pf(100, 2534014), "auteur-introuvable"],
    ["phrase no matching user", 400, { error: "No matching user found" }, "auteur-introuvable"],
    ["code 551", 400, pf(551), "personne-injoignable"],
    ["sous-code 1545041", 400, pf(100, 1545041), "personne-injoignable"],
    ["sous-code 2018108", 400, pf(100, 2018108), "personne-injoignable"],
    ["phrase isn't receiving messages from you", 400, { error: "This person isn't receiving messages from you right now" }, "personne-injoignable"],
    ["phrase can't receive your messages", 400, { error: "user can't receive your messages" }, "personne-injoignable"],
    ["sous-code 2534066", 400, pf(10, 2534066), "reponse-privee-declinee"],
    ["code 2 + sous-code 1545133", 400, pf(2, 1545133), "elements-refuses-non-abonne"],
    ["code 200", 400, pf(200), "droits-manquants"],
    ["code 230", 400, pf(230), "droits-manquants"],
    ["sous-code 2018028", 400, pf(100, 2018028), "droits-manquants"],
    ["sous-code 1404170", 400, pf(100, 1404170), "droits-manquants"],
    ["phrase does not have permission", 400, { error: "app does not have permission" }, "droits-manquants"],
    ["phrase permissions error", 400, { error: "permissions error" }, "droits-manquants"],
    ["code 190", 400, pf(190), "jeton-expire-ou-invalide"],
    ["phrase access token", 400, { error: "Invalid access token" }, "jeton-expire-ou-invalide"],
    ["phrase session has expired", 400, { error: "The session has expired" }, "jeton-expire-ou-invalide"],
    ["code 100 + sous-code 33", 400, pf(100, 33), "commentaire-introuvable"],
    ["phrase does not exist", 400, { error: "Object does not exist" }, "commentaire-introuvable"],
    ["phrase has been deleted", 400, { error: "comment has been deleted" }, "commentaire-introuvable"],
    ["sous-code 1893063", 400, pf(100, 1893063), "envoi-restreint-temporairement"],
    ["phrase temporarily restricted", 400, { error: "page temporarily restricted" }, "envoi-restreint-temporairement"],
    ["sous-code 2018300", 400, pf(100, 2018300), "autre-application-aux-commandes"],
    ["code 613", 400, pf(613), "limite-meta"],
    ["code Zernio INBOX_REQUIRED", 403, { code: "INBOX_REQUIRED" }, "inbox-zernio-requise"],
    ["code Zernio message_allowance_exceeded", 403, { error: "message_allowance_exceeded" }, "quota-messages-zernio"],
    ["statut 404", 404, {}, "compte-zernio-introuvable"],
    ["phrase account not found", 400, { error: "account not found" }, "compte-zernio-introuvable"],
    ["statut 500 sans repère", 500, {}, "erreur-serveur"],
    ["tout le reste", 400, { error: "rien de connu" }, "raison-inconnue"],
  ];
  it.each(lignes)("%s -> %s", (_nom, statut, corps, attendu) => {
    expect(motifRefusInbox(statut, corps).motif).toBe(attendu);
  });
  it("le code Meta 10 seul est ambigu : raison-inconnue", () => {
    expect(motifRefusInbox(400, pf(10)).motif).toBe("raison-inconnue");
  });
  it("chaque motif de la liste a un libellé français", () => {
    for (const m of CODES_MOTIF_REFUS) expect(LIBELLES_MOTIF_REFUS[m].length).toBeGreaterThan(5);
  });
  it("motifReseau : délai ou coupure", () => {
    expect(motifReseau("TimeoutError").motif).toBe("delai-depasse");
    expect(motifReseau("AbortError").motif).toBe("delai-depasse");
    expect(motifReseau("TypeError").motif).toBe("coupure-reseau");
    expect(motifReseau("n'importe quoi de Jeanne Exemple").motif).toBe("coupure-reseau");
  });
});

describe("T4 à T10 : cas réel, texte libre, bornes", () => {
  it("T4 enveloppe Zernio platform_api_error, message réel du 17/11", () => {
    const r = motifRefusInbox(400, { error: "platform_api_error", message: "HTTP error! status: 400 - The page has messages disabled in the settings", details: { code: "platform_api_error" } });
    expect(r.motif).toBe("messagerie-desactivee-sur-la-page");
    expect(r.codeZernio).toBe("platform_api_error");
  });
  it("T4b corps réel : error est un objet {type, message}", () => {
    const corps = { error: { type: "platform_api_error", message: "HTTP error! status: 400 - The page has messages disabled in the settings" } };
    const r = motifRefusInbox(400, corps);
    expect(r.motif).toBe("messagerie-desactivee-sur-la-page");
    expect(r.codeZernio).toBe("platform_api_error");
    expect(JSON.stringify(r)).not.toContain("HTTP error");
  });
  it("T4b details.message : phrase connue lue dans details", () => {
    const r = motifRefusInbox(400, { error: "platform_api_error", details: { message: "The page has messages disabled in the settings" } });
    expect(r.motif).toBe("messagerie-desactivee-sur-la-page");
    expect(JSON.stringify(r)).not.toContain("disabled");
  });
  it("T4b error.code de la liste blanche gardé, hors liste ignoré", () => {
    expect(motifRefusInbox(400, { error: { code: "INBOX_REQUIRED" } }).codeZernio).toBe("INBOX_REQUIRED");
    expect(motifRefusInbox(400, { error: { type: "jeanne_exemple", code: "jeanne_exemple" } }).codeZernio).toBeNull();
  });
  it("T5 message inconnu avec nom, pseudo, adresse, identifiant de 17 chiffres et jeton : aucun fragment en sortie", () => {
    const corps = { error: "Jeanne Exemple (@jeanne_exemple) personne@exemple.invalid id 12345678901234567 jeton EAAB-faux-jeton a refusé" };
    const sortie = JSON.stringify(motifRefusInbox(400, corps));
    expect(motifRefusInbox(400, corps).motif).toBe("raison-inconnue");
    for (const f of ["Jeanne", "jeanne_exemple", "exemple.invalid", "12345678901234567", "EAAB"]) expect(sortie).not.toContain(f);
  });
  it("T6 phrase connue entourée de données : le code seul", () => {
    const r = motifRefusInbox(400, { error: "Object with ID 123456789012345 does not exist" });
    expect(r.motif).toBe("commentaire-introuvable");
    expect(JSON.stringify(r)).not.toContain("123456789012345");
  });
  it("T7 code Zernio hors liste ignoré", () => {
    const r = motifRefusInbox(400, { code: "jeanne_exemple", error: "jeanne_exemple" });
    expect(r.codeZernio).toBeNull();
    expect(JSON.stringify(r)).not.toContain("jeanne");
    for (const c of CODES_ZERNIO_CONNUS) expect(motifRefusInbox(400, { code: c }).codeZernio).toBe(c);
  });
  it("T8 codes Meta non entiers, négatifs ou de plus de 9 chiffres ignorés", () => {
    for (const code of [1.5, -190, 1234567890, "abc", "190abc", NaN, null, {}, [190]]) {
      const r = motifRefusInbox(400, { platformError: { code } });
      expect(r.meta).toBeNull();
      expect(r.motif).toBe("raison-inconnue");
    }
    expect(motifRefusInbox(400, { platformError: { code: "190" } }).meta).toEqual({ code: 190, sousCode: null });
    expect(motifRefusInbox(400, { details: { platformError: { code: 190, error_subcode: -5 } } }).meta).toEqual({ code: 190, sousCode: null });
    expect(motifRefusInbox(400, { error: { code: 190 } }).meta).toEqual({ code: 190, sousCode: null });
  });
  it("T8b liste fermée des codes Meta : un code ou sous-code inconnu n'apparaît nulle part", () => {
    const inconnu = 612345678;
    const r1 = motifRefusInbox(400, { platformError: { code: inconnu } });
    expect(r1.meta).toBeNull();
    expect(JSON.stringify(r1)).not.toContain(String(inconnu));
    const r2 = motifRefusInbox(400, { platformError: { code: 190, error_subcode: inconnu } });
    expect(r2.meta).toEqual({ code: 190, sousCode: null });
    expect(r2.motif).toBe("jeton-expire-ou-invalide");
    expect(JSON.stringify(r2)).not.toContain(String(inconnu));
    const r3 = motifRefusInbox(400, { error: { code: inconnu, error_subcode: inconnu, message: "The page has messages disabled in the settings" } });
    expect(r3.meta).toBeNull();
    expect(JSON.stringify(r3)).not.toContain(String(inconnu));
    for (const c of [2, 10, 100, 33, 1545133, 190, 2534041]) expect(CODES_META_CONNUS).toContain(c);
    expect(motifRefusInbox(400, pf(2, 1545133)).meta).toEqual({ code: 2, sousCode: 1545133 });
  });
  it("T9 caractères de contrôle et emoji : code conforme à ^[a-z0-9-]+$", () => {
    for (const s of ["\u0000\u0007 \u{1F600} messages disabled in the settings \n\t", "‮\u{1F4A9}", "x".repeat(3000)]) {
      const r = motifRefusInbox(400, { error: s, message: s });
      expect(r.motif).toMatch(/^[a-z0-9-]+$/);
    }
  });
  it("T10 corps de 1 Mo : temps borné", () => {
    const gros = "a ".repeat(500_000);
    const t0 = Date.now();
    motifRefusInbox(400, gros);
    motifRefusInbox(400, { error: gros, message: gros });
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("les nombres passent avant les phrases", () => {
    expect(motifRefusInbox(400, { ...pf(190), message: "the page has messages disabled in the settings" }).motif).toBe("jeton-expire-ou-invalide");
  });
  it("ne lève jamais (getter piégé)", () => {
    expect(() => motifRefusInbox(400, { get error(): string { throw new Error("boum"); } })).not.toThrow();
  });
});

describe("estRaisonRefus et formaterRaison", () => {
  const ok: RaisonRefus = { motif: "messagerie-desactivee-sur-la-page", statut: 400, codeClient: "refuse", meta: { code: 10, sousCode: 2018278 }, codeZernio: null };
  it("accepte une raison bien formée et la formate", () => {
    expect(estRaisonRefus(ok)).toBe(true);
    expect(formaterRaison(ok)).toBe(`${LIBELLES_MOTIF_REFUS["messagerie-desactivee-sur-la-page"]} [HTTP 400 · refuse · meta 10/2018278]`);
    expect(formaterRaison({ ...ok, statut: null, meta: null })).toBe(`${LIBELLES_MOTIF_REFUS["messagerie-desactivee-sur-la-page"]} [refuse]`);
  });
  it("rejette toute forme libre", () => {
    for (const x of [{ ...ok, meta: { code: 612345678, sousCode: null } }, { ...ok, meta: { code: 10, sousCode: 612345678 } }]) expect(estRaisonRefus(x)).toBe(false);
    for (const x of [null, "texte", { ...ok, motif: "Jeanne Exemple" }, { ...ok, statut: 99 }, { ...ok, statut: 600 }, { ...ok, statut: 400.5 }, { ...ok, codeClient: "jeanne_exemple" }, { ...ok, meta: { code: 1e10, sousCode: null } }, { ...ok, meta: { code: 1, sousCode: -1 } }, { ...ok, codeZernio: "jeanne_exemple" }, { ...ok, extra: "texte libre" }]) {
      expect(estRaisonRefus(x)).toBe(false);
    }
  });
});
