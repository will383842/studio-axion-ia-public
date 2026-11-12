/**
 * MAQ-01 : quatre maquettes statiques (À publier, Stock, Infographie, Écrans sans prix).
 * Elles reprennent les couleurs, les mots et la disposition de la maquette validée du calendrier.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const ECRANS = ["a-publier", "stock", "infographie", "ecrans-sans-prix"] as const;
const chemin = (e: string) => join(RACINE, "docs/maquettes", e, "index.html");
const lire = (e: string) => readFileSync(chemin(e), "utf8");
const MASTER = readFileSync(join(RACINE, "docs/maquettes/calendrier/calendrier-du-studio.html"), "utf8");

/** Texte lu par une personne : sans balises <script> ni <style>, sans balises. */
function texteVisible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ");
}

describe.each(ECRANS)("maquette %s", (ecran) => {
  it("existe et s'ouvre sans serveur (un seul fichier, pas de script externe)", () => {
    expect(existsSync(chemin(ecran))).toBe(true);
    const html = lire(ecran);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).not.toMatch(/<script[^>]+\bsrc=/i);
    expect(html).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
    expect(html).not.toMatch(/(?:src|href|action)=["'](?!https:\/\/fonts\.(?:googleapis|gstatic)\.com|#)(?:https?:)?\/\//i);
  });

  it("porte la mention « Maquette fictive : rien n'est branché, rien ne part »", () => {
    expect(texteVisible(lire(ecran))).toContain("Maquette fictive : rien n'est branché, rien ne part");
  });

  it("n'affiche aucun montant en euros ou en dollars", () => {
    const t = texteVisible(lire(ecran));
    expect(t).not.toMatch(/[€£]/);
    expect(t).not.toMatch(/\d\s*(?:\$|USD|EUR|euros?|dollars?)/i);
    expect(t).not.toMatch(/(?:\$|USD|EUR)\s*\d/i);
    expect(t).not.toMatch(/\b(?:prix|tarif|facture|abonnement)\b/i);
  });

  it("vouvoie : aucun tutoiement dans les textes", () => {
    const t = texteVisible(lire(ecran));
    expect(t).not.toMatch(/(?<![\p{L}\p{N}])(?:tu|toi|ton|ta|tes|t')(?![\p{L}\p{N}])/iu);
    expect(t).not.toMatch(/\b(?:clique|choisis|ajoute|glisse|importe|écris|crée|regarde)\b/i);
    expect(t).toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });

  it("reprend les couleurs de la maquette du calendrier", () => {
    const html = lire(ecran);
    for (const jeton of ["--fond:#f4efe7", "--orange:#b4512a", "--LI:#0a66c2", "--IG:#d6336c", "--FB:#3b5bdb", "--TT:#0b8f8a"]) {
      expect(MASTER).toContain(jeton);
      expect(html).toContain(jeton);
    }
    expect(html).toContain('"Archivo Black"');
    expect(html).toContain("Manrope");
  });

  it("garde le menu du Studio et marque l'écran courant", () => {
    const html = lire(ecran);
    expect(html).toMatch(/<nav class="menu"[^>]*>/);
    expect((html.match(/<span class="cur">/g) ?? []).length).toBe(1);
    for (const mot of ["Accueil", "Mes vidéos", "Carrousels", "Écrire", "Calendrier", "À traiter", "Mesures", "Réglages"]) {
      expect(texteVisible(html)).toContain(mot);
    }
  });

  it("n'écrit ni message automatique ni mot privé évident", () => {
    const t = texteVisible(lire(ecran));
    expect(t).not.toMatch(/message automatique/i);
    expect(t).not.toMatch(/zernio/i);
    expect(lire(ecran)).not.toMatch(/[\w.+-]+@(?!exemple\.fr)[\w-]+\.\w+/);
  });

  it("ne propose aucune suppression (on archive)", () => {
    expect(texteVisible(lire(ecran))).not.toMatch(/\bsupprim|\beffac(?:er|ez)\b/i);
  });
});

describe("À publier : les trois formats", () => {
  const html = lire("a-publier");
  it.each([
    ["video", "Vidéo", "▶"],
    ["carrousel", "Carrousel", "▤"],
    ["infographie", "Infographie", "▨"],
  ])("montre %s avec une icône et un libellé", (format, libelle, icone) => {
    const re = new RegExp(`<[^>]*data-format="${format}"[^>]*>[\\s\\S]*?</li>`, "g");
    const cartes = html.match(re) ?? [];
    expect(cartes.length).toBeGreaterThanOrEqual(1);
    for (const c of cartes) {
      expect(c).toContain(`class="ico"`);
      expect(c).toContain(icone);
      expect(texteVisible(c)).toContain(libelle);
    }
  });
  it("garde les quatre réseaux et l'état de chaque publication", () => {
    for (const r of ["LinkedIn", "Instagram", "Facebook", "TikTok"]) expect(texteVisible(html)).toContain(r);
    expect(html).toMatch(/class="et e-(valider|programme|brouillon)/);
  });
  it("n'a qu'une action principale orange", () => {
    expect((html.match(/class="btn pri/g) ?? []).length).toBe(1);
  });
});

describe("Stock : onglets", () => {
  const html = lire("stock");
  it("propose les onglets Textes, Images, Vidéos, Carrousels, Infographies, avec Stock en titre", () => {
    expect(html).toMatch(/role="tablist"/);
    for (const o of ["Textes", "Images", "Vidéos", "Carrousels", "Infographies"]) {
      expect(html).toMatch(new RegExp(`role="tab"[^>]*>[^<]*${o}`));
    }
    expect(texteVisible(html)).toMatch(/Stock/);
    expect(html).toMatch(/aria-selected="true"/);
  });
  it("dit quand un onglet est vide", () => {
    expect(texteVisible(html)).toMatch(/Rien en stock|Rien à voir ici/);
  });
});

describe("Infographie : écran de création", () => {
  const html = lire("infographie");
  it("a un titre, des points clés, un style, un aperçu et un seul bouton principal", () => {
    expect(html).toMatch(/<label[^>]*for="inf-titre"/);
    expect(html).toMatch(/id="inf-points"/);
    expect(html).toMatch(/name="style"/);
    expect(html).toMatch(/id="inf-apercu"/);
    expect((html.match(/class="btn pri/g) ?? []).length).toBe(1);
    expect(texteVisible(html)).toContain("Infographie");
  });
});

describe("Écrans sans prix", () => {
  const html = lire("ecrans-sans-prix");
  it("parle en nombres de contenus possibles, jamais en argent", () => {
    const t = texteVisible(html);
    expect(t).toMatch(/\d+\s+(?:vidéos?|carrousels?|infographies?)/i);
    expect(t).toMatch(/réserve/i);
  });
  it("ne bloque jamais l'action : l'alerte reste une information", () => {
    expect(html).not.toMatch(/\bdisabled\b/);
    expect(texteVisible(html)).toMatch(/rien n'est bloqué/i);
  });
});
