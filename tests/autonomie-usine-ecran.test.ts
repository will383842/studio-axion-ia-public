/**
 * AUT-B — écran Réglages « L'Usine en automatique » : action serveur, bornes, refus clair, rendu, absence d'écriture ailleurs,
 * aucun montant codé en dur. Dépôts en mémoire, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh() {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { lireParametre } = await import("@/services/_commun");
const { reglerAutonomieUsineAction } = await import("@/app/(studio)/reglages/actions-autonomie-usine");
const { AutonomieUsine, nomDuMois, texteEtatAutonomie, TEXTES_AUTONOMIE_USINE } = await import("@/components/reglages/AutonomieUsine");
const { vueAutonomieUsine } = await import("@/services/autonomie-usine");
const { revalidatePath } = await import("next/cache");

const MDP = "aut-b-ecran";
const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const reglage = () => lireParametre<{ actif: boolean; plafondCents: number } | null>("usine.autonomie", null);
const vue = (o: Partial<Parameters<typeof texteEtatAutonomie>[0]> = {}) => ({ actif: false, plafondCents: 0, utiliseCents: 0, pourcentage: 0, mois: "2026-11", ...o });

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});
beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.mocked(revalidatePath).mockClear();
});

describe("action reglerAutonomieUsineAction", () => {
  it("sans session : refusée, rien n'est écrit", async () => {
    await expect(reglerAutonomieUsineAction(true, 200)).rejects.toBeTruthy();
    expect(await reglage()).toBeNull();
  });

  it("avec session : enregistre en centimes et rafraîchit /reglages", async () => {
    await auth.seConnecter(MDP, false);
    const r = await reglerAutonomieUsineAction(true, 200);
    expect(r.ok).toBe(true);
    expect(await reglage()).toMatchObject({ actif: true, plafondCents: 20_000 });
    expect(revalidatePath).toHaveBeenCalledWith("/reglages");
  });

  it("arrondit au centime le plus proche (19,99 € = 1 999 centimes)", async () => {
    await auth.seConnecter(MDP, false);
    await reglerAutonomieUsineAction(true, 19.99);
    expect((await reglage())?.plafondCents).toBe(1999);
  });

  it("bornes : 0 et 100 000 € acceptés éteint ; 100 000,01 € et négatif refusés", async () => {
    await auth.seConnecter(MDP, false);
    expect((await reglerAutonomieUsineAction(false, 0)).ok).toBe(true);
    expect((await reglerAutonomieUsineAction(true, 100_000)).ok).toBe(true);
    expect((await reglage())?.plafondCents).toBe(10_000_000);
    for (const v of [100_000.01, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = await reglerAutonomieUsineAction(true, v);
      expect(r.ok).toBe(false);
    }
    expect((await reglage())?.plafondCents).toBe(10_000_000);
  });

  it("allumer avec 0 € : refusé avec une phrase claire, rien n'est écrit", async () => {
    await auth.seConnecter(MDP, false);
    const r = await reglerAutonomieUsineAction(true, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(TEXTES_AUTONOMIE_USINE.zeroAllume);
    expect(await reglage()).toBeNull();
  });

  it("éteindre garde le plafond mais repasse en confirmation", async () => {
    await auth.seConnecter(MDP, false);
    await reglerAutonomieUsineAction(true, 50);
    await reglerAutonomieUsineAction(false, 50);
    expect(await reglage()).toMatchObject({ actif: false, plafondCents: 5000 });
    expect((await vueAutonomieUsine()).etat).toBe("confirmation");
  });
});

describe("rendu", () => {
  it("par défaut : éteint, phrase d'extinction et phrase fixe", () => {
    const html = renderToStaticMarkup(createElement(AutonomieUsine, { vue: vue() }));
    expect(html).toContain("Éteinte : chaque dépense de l&#x27;Usine demande votre confirmation.");
    expect(html).toContain("Au plafond, l&#x27;Usine s&#x27;arrête net. Vos fabrications dans le Studio ne sont pas concernées.");
    expect(html).toContain("Plafond du mois (€)");
    expect(html).toContain("Enregistrer");
    expect(html).toContain('id="usine-automatique"');
    expect(html).toContain('aria-checked="false"');
  });

  it("allumé : utilisé, plafond, pourcentage, mois de Paris", () => {
    const t = texteEtatAutonomie(vue({ actif: true, plafondCents: 20_000, utiliseCents: 5000, pourcentage: 25 }));
    expect(t.replace(/[\u00a0\u202f]/g, " ")).toBe("Utilisé : 50 € sur 200 € (25 %) · mois de novembre (heure de Paris)");
    const html = renderToStaticMarkup(createElement(AutonomieUsine, { vue: vue({ actif: true, plafondCents: 20_000, utiliseCents: 5000, pourcentage: 25 }) }));
    expect(html).toContain("mois de novembre (heure de Paris)");
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("Éteinte");
  });

  it("nom du mois en français", () => {
    expect(nomDuMois("2026-01")).toBe("janvier");
    expect(nomDuMois("2026-12")).toBe("décembre");
  });
});

describe("structure", () => {
  it("aucune autre action de Réglages ne touche `usine.autonomie`", () => {
    const dossier = "src/app/(studio)/reglages";
    const fautifs = readdirSync(join(RACINE, dossier))
      .filter((n) => /^actions.*\.ts$/.test(n) && n !== "actions-autonomie-usine.ts")
      .filter((n) => /usine\.autonomie|autonomie-usine/.test(sansCommentaires(lire(`${dossier}/${n}`))));
    expect(fautifs).toEqual([]);
  });

  it("l'action et le composant n'écrivent pas la clé eux-mêmes et appellent reglerAutonomieUsine", () => {
    const a = sansCommentaires(lire("src/app/(studio)/reglages/actions-autonomie-usine.ts"));
    expect(a).not.toMatch(/ecrireParametre|["'`]usine\.autonomie/);
    expect(a).toMatch(/reglerAutonomieUsine\(/);
    expect(a.indexOf("exigerSession()")).toBeGreaterThan(-1);
    expect(a).toMatch(/Math\.round\(plafondEuros \* 100\)/);
    expect(sansCommentaires(lire("src/components/reglages/AutonomieUsine.tsx"))).not.toMatch(/ecrireParametre|["'`]usine\.autonomie/);
  });

  it("aucun montant codé en dur (hors borne de 100 000 €) dans l'action et le composant", () => {
    const code = [
      sansCommentaires(lire("src/app/(studio)/reglages/actions-autonomie-usine.ts")),
      sansCommentaires(lire("src/components/reglages/AutonomieUsine.tsx")),
    ].join("\n").replace(/100_000/g, "BORNE").replace(/(["'`])(?:(?!\1)[^\\\n])*\1/g, '""');
    // pas de valeur initiale ni de défaut chiffré : aucun nombre ≥ 2 chiffres hors « * 100 » (conversion) et exemple d'aide
    const nombres = (code.match(/\b\d{2,}\b/g) ?? []).filter((n) => n !== "100" && n !== "15");
    expect(nombres).toEqual([]);
    expect(code).not.toMatch(/useState\((?:"\d|\d)/);
  });

  it("la carte est dans la rubrique Services reliés, avec l'ancre", () => {
    const p = lire("src/app/(studio)/reglages/page.tsx");
    expect(p).toMatch(/<CartePliante id="usine-automatique"/);
    expect(p.indexOf('id="usine-automatique"')).toBeGreaterThan(p.indexOf('<Rubrique id="services">'));
  });
});
