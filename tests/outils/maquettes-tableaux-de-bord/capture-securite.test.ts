/**
 * T-EXT-41 : le navigateur de capture n'a aucun réseau. Lecture du TEXTE de `capturer.mts` : aucun navigateur lancé ici.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync("outils/maquettes-tableaux-de-bord/capture/capturer.mts", "utf8");
// Le code hors commentaires : un mot cité dans un commentaire ne compte ni pour ni contre.
const CODE = SRC.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("options du contexte de capture", () => {
  const contextes = [...CODE.matchAll(/browser\.newContext\(\{([\s\S]*?)\n\s*\}\);/g)].map((m) => m[1]!);
  it("les deux passes (film et contrôles) ouvrent un contexte", () => expect(contextes).toHaveLength(2));
  for (const [i] of [[0], [1]] as const) {
    it(`contexte ${i + 1} : offline, service workers bloqués, pas de téléchargement, aucune permission`, () => {
      expect(contextes[i]).toContain("offline: true");
      expect(contextes[i]).toContain('serviceWorker' + 's: "block"');
      expect(contextes[i]).toContain("acceptDownloads: false");
      expect(contextes[i]).toMatch(/permissions:\s*\[\]/);
    });
  }
  it("offline: true, serviceWorkers: \"block\" et acceptDownloads: false figurent dans le texte", () => {
    expect(CODE).toContain("offline: true");
    expect(CODE).toContain('serviceWorkers: "block"');
    expect(CODE).toContain("acceptDownloads: false");
  });
  it("bypassCSP n'apparaît nulle part (code ni commentaire)", () => expect(SRC.replace(/jamais `bypassCSP`/g, "")).not.toContain("bypassCSP"));
  it("aucun offline: false ni retrait du blocage", () => {
    expect(CODE).not.toMatch(/offline:\s*false/);
    expect(CODE).not.toMatch(/serviceWorkers:\s*"allow"/);
    expect(CODE).not.toMatch(/acceptDownloads:\s*true/);
  });
});

describe("ordre des gardes", () => {
  it("environnementAutorise est appelé dans principal avant tout appel d'une passe, et chromium.launch n'est que dans les passes", () => {
    const principal = CODE.slice(CODE.indexOf("async function principal"));
    const garde = principal.indexOf("environnementAutorise(process.env");
    expect(garde).toBeGreaterThan(-1);
    for (const appel of ["await passeFilm(", "await passeControles("]) expect(garde).toBeLessThan(principal.indexOf(appel));
    expect(principal).not.toContain("chromium.launch(");
    expect(CODE.match(/chromium\.launch\(/g)).toHaveLength(2);
  });
  it("context.route(\"**/*\" est posé avant le premier goto, dans chaque passe", () => {
    const parties = CODE.split(/async function (?=passe)/).slice(1);
    expect(parties).toHaveLength(2);
    for (const p of parties) {
      const route = p.indexOf('context.route("**/*"');
      const aller = p.indexOf("page.goto(");
      expect(route).toBeGreaterThan(-1);
      expect(aller).toBeGreaterThan(route);
    }
  });
  it("le contexte est créé avant la route, la route avant la page", () => {
    for (const p of CODE.split(/async function (?=passe)/).slice(1)) {
      expect(p.indexOf("browser.newContext")).toBeLessThan(p.indexOf('context.route("**/*"'));
      expect(p.indexOf('context.route("**/*"')).toBeLessThan(p.indexOf("context.newPage()"));
    }
  });
  it("le gestionnaire refuse tout ce que adresseAutorisee n'accepte pas", () => {
    expect(CODE).toMatch(/adresseAutorisee\(url, RACINES_MAQUETTE\)\) await route\.continue\(\)/);
    expect(CODE).toContain("await route.abort()");
  });
});

describe("capturer.mts ne vérifie pas la maquette lui-même", () => {
  it("n'importe pas securite-entrees (outils/ n'importe de src/ que le lecteur de scénario)", () => {
    expect(SRC).not.toContain("securite-entrees");
    expect(SRC).not.toContain("verifierMaquette");
  });
});

describe("T-EXT-51c : lancement de Chromium et chemins réels", () => {
  const lancements = [...CODE.matchAll(/chromium\.launch\(\{([^}]*)\}\)/g)].map((m) => m[1]!);
  it("deux lancements (film, contrôles), chacun avec chromiumSandbox, jamais désactivé en dur", () => {
    expect(lancements).toHaveLength(2);
    for (const l of lancements) expect(l).toMatch(/chromiumSandbox:\s*!EN_CONTENEUR/);
    expect(CODE).not.toMatch(/chromiumSandbox:\s*false/);
  });
  it("aucun --no-sandbox, aucun args, aucun ignoreDefaultArgs, aucun drapeau de lancement ajouté", () => {
    expect(CODE).not.toContain("no-sandbox");
    expect(CODE).not.toMatch(/\bargs:/);
    expect(CODE).not.toContain("ignoreDefaultArgs");
    expect(CODE).not.toMatch(/chromiumSandbox:\s*false/);
    for (const l of lancements) expect(l.replace(/\s+/g, " ").trim()).toBe("executablePath: process.env.CAPTURE_CHROMIUM || undefined, chromiumSandbox: !EN_CONTENEUR");
  });
  it("l'exécutable ne vient que de CAPTURE_CHROMIUM (sinon Playwright)", () => {
    expect(CODE.match(/executablePath/g)).toHaveLength(2);
    expect(CODE.match(/process\.env\.CAPTURE_CHROMIUM/g)).toHaveLength(2);
  });
  it("EN_CONTENEUR vient de indicesConteneur(existsSync) et est passé à la garde d'environnement", () => {
    expect(CODE).toMatch(/const EN_CONTENEUR = indicesConteneur\(existsSync\)/);
    expect(CODE).toMatch(/environnementAutorise\(process\.env, process\.platform, EN_CONTENEUR\)/);
  });
  it("les deux gestionnaires de route passent par adresseAutoriseeReelle avec realpathSync.native, avant route.continue", () => {
    const passes = CODE.split(/async function (?=passe)/).slice(1);
    expect(passes).toHaveLength(2);
    for (const p of passes) {
      const reel = p.indexOf("adresseAutoriseeReelle(url, RACINES_MAQUETTE, realpathSync.native)");
      expect(reel).toBeGreaterThan(-1);
      expect(reel).toBeLessThan(p.indexOf("await route.continue()"));
    }
  });
});
