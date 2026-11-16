/**
 * LOT A1 — réglage `buffer.gele` : ABSENT = GELÉ ; seul le booléen `false` dégèle (le doute gèle).
 * Le défaut de test `STUDIO_BUFFER_GEL_DEFAUT=degele` n'agit que hors production.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { bufferGele, PARAM_GELE } = await import("@/services/buffer-gel");

beforeEach(() => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  reinitialiserDepots();
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 · bufferGele()", () => {
  it("réglage absent → gelé", async () => {
    expect(await bufferGele()).toBe(true);
  });

  it("`true` → gelé ; `false` → dégelé", async () => {
    await ecrireParametre(PARAM_GELE, true);
    expect(await bufferGele()).toBe(true);
    await ecrireParametre(PARAM_GELE, false);
    expect(await bufferGele()).toBe(false);
  });

  it.each([["false"], [0], [null], ["non"], [""], [undefined]])("valeur %j → gelé (le doute gèle)", async (valeur) => {
    await ecrireParametre(PARAM_GELE, valeur);
    expect(await bufferGele()).toBe(true);
  });

  it("défaut de test `degele` hors production, réglage absent → dégelé", async () => {
    vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "degele");
    expect(await bufferGele()).toBe(false);
  });

  it("défaut `degele` ignoré en production → gelé", async () => {
    vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "degele");
    vi.stubEnv("NODE_ENV", "production");
    expect(await bufferGele()).toBe(true);
  });

  it("réglage `true` + défaut `degele` → gelé (le réglage prime)", async () => {
    vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "degele");
    await ecrireParametre(PARAM_GELE, true);
    expect(await bufferGele()).toBe(true);
  });

  it("réglage `false` sans variable → dégelé", async () => {
    await ecrireParametre(PARAM_GELE, false);
    expect(await bufferGele()).toBe(false);
  });

  it("une autre valeur que `degele` ne dégèle pas", async () => {
    vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "oui");
    expect(await bufferGele()).toBe(true);
  });
});
