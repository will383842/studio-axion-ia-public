/**
 * L0-16 — contrôle de production en lecture seule : clés posées (oui/non), interrupteurs (valeur), aucun secret,
 * aucun appel réseau. Tests autonomes : environnement et paramètres sont des doublures locales.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { etatProduction, type LecteurParametre } from "@/services/etat-production";

const SECRETS = ["sk-fictif-1234567890", "cle-fictive-abcdef", "jeton-fictif-zzzz"];
const env = {
  HEYGEN_API_KEY: SECRETS[0],
  ZERNIO_API_KEY: SECRETS[1],
  ELEVENLABS_API_KEY: "   ",
  FAL_KEY: SECRETS[2],
} as Record<string, string>;

const parametres = (m: Record<string, unknown>): LecteurParametre => async (id) => m[id];

afterEach(() => vi.unstubAllGlobals());

describe("etatProduction", () => {
  it("dit si chaque clé est posée, sans jamais la renvoyer", async () => {
    const r = await etatProduction(env, parametres({}));
    const par = Object.fromEntries(r.cles.map((c) => [c.variable, c.posee]));
    expect(par.HEYGEN_API_KEY).toBe(true);
    expect(par.ZERNIO_API_KEY).toBe(true);
    expect(par.ELEVENLABS_API_KEY).toBe(false); // vide ou espaces = non posée
    expect(par.FAL_KEY).toBe(true);
    const texte = JSON.stringify(r);
    for (const s of SECRETS) expect(texte).not.toContain(s);
  });

  it("ne fait aucun appel réseau", async () => {
    const f = vi.fn(() => {
      throw new Error("réseau interdit");
    });
    vi.stubGlobal("fetch", f);
    await etatProduction(env, parametres({}));
    expect(f).not.toHaveBeenCalled();
  });

  it("lit la valeur des interrupteurs : envoi du calendrier fermé par défaut, arrêt global ouvert par défaut", async () => {
    const r = await etatProduction({}, parametres({}));
    const par = Object.fromEntries(r.interrupteurs.map((i) => [i.cle, i.allume]));
    expect(par["zernio.envoi_calendrier_autorise"]).toBe(false);
    expect(par["zernio.envoi_autorise"]).toBe(true);
    expect(r.cles.every((c) => c.posee === false)).toBe(true);
  });

  it("seul le booléen exact true allume ; le reste éteint", async () => {
    const r = await etatProduction({}, parametres({ "zernio.envoi_calendrier_autorise": "true", "zernio.envoi_autorise": 1 }));
    const par = Object.fromEntries(r.interrupteurs.map((i) => [i.cle, i.allume]));
    expect(par["zernio.envoi_calendrier_autorise"]).toBe(false);
    expect(par["zernio.envoi_autorise"]).toBe(true); // valeur non booléenne = comme absente
    const r2 = await etatProduction({}, parametres({ "zernio.envoi_calendrier_autorise": true, "zernio.envoi_autorise": false }));
    const p2 = Object.fromEntries(r2.interrupteurs.map((i) => [i.cle, i.allume]));
    expect(p2["zernio.envoi_calendrier_autorise"]).toBe(true);
    expect(p2["zernio.envoi_autorise"]).toBe(false);
  });

  it("une lecture qui échoue donne « éteint » sans casser et sans fuite du message d'erreur", async () => {
    const r = await etatProduction(env, async () => {
      throw new Error(`panne ${SECRETS[0]}`);
    });
    expect(r.interrupteurs.find((i) => i.cle === "zernio.envoi_calendrier_autorise")?.allume).toBe(false);
    expect(JSON.stringify(r)).not.toContain(SECRETS[0]);
  });
});
