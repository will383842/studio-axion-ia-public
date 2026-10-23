/**
 * CHAÎNE COURTE EN PRODUCTION · dette croisée #242 / #243 : le socle de Will est écrit en cache pour 1 h (2 × l'entrée).
 * Le pire cas prudent d'une chaîne (`totaliserPireCas`) et la marge des appels en vol le comptent au prix 1 h, jamais
 * au prix 5 min (1,25 ×) : la réserve n'est jamais sous-estimée. PUR, 0 $.
 */
import { describe, expect, it } from "vitest";
import { pireCasUsd, tarifDe } from "@/fournisseurs/claude/tarifs";
import { pireCasChaine } from "@/generateur/pire-cas";
import { pireCasPrudentAppel, totaliserPireCas, MEDIANES_BANC_G4_USD } from "@/generateur/roles/estimation";
import { construireRequete } from "@/generateur/roles/types";
import { ROLES_CHAINE_COURTE } from "@/generateur/chaine-courte";
import { jetonsEstimes } from "@/fournisseurs/claude/tarifs";
import { etapeZeroBanc, TOURNURES_G4 } from "../helpers/g4";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";
import { blocsEnCache } from "@/generateur/contexte";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";

const z = etapeZeroBanc(SUJETS_BANC[0]);
if (!z.ok) throw new Error("étape 0");
const d = z.donnees;
const entree = { contexte: blocsEnCache(d, parametresGenerateur(d.sujet.formatId)), variable: "x" };

describe("pire cas prudent : socle écrit en cache pour 1 h (2 × l'entrée)", () => {
  it("l'écriture du socle d'un rôle est comptée au prix 1 h (plus au prix 5 min)", () => {
    const role = ROLES_CHAINE_COURTE.script;
    const r = construireRequete(role, entree);
    const fin = r.systeme.findIndex((b) => b.cache === "1h");
    expect(fin).toBeGreaterThanOrEqual(0);
    const socle1h = jetonsEstimes(r.systeme.slice(0, fin + 1).map((b) => b.texte).join("\n"));
    const t = tarifDe(role.modele);
    const p = totaliserPireCas([{ etape: 1, n: 1, appel: pireCasPrudentAppel(role, entree) }]);
    const tout = jetonsEstimes(r.systeme.filter((b) => b.cache).map((b) => b.texte).join("\n"));
    // Le socle 1 h à (2 − 1) × l'entrée en plus ; le format et la consigne à (1,25 − 1) ×.
    expect(p.ecritureCacheUsd).toBeCloseTo((socle1h * (t.cacheEcrit1h - t.entree) + (tout - socle1h) * (t.cacheEcrit - t.entree)) / 1e6, 9);
    expect(p.ecritureCacheUsd).toBeGreaterThan((tout * (t.cacheEcrit - t.entree)) / 1e6);
  });

  it("la marge des appels en vol compte le socle au prix 1 h, comme le pré-vol", () => {
    const role = ROLES_CHAINE_COURTE.script;
    const a = pireCasPrudentAppel(role, entree);
    expect(a.jetonsSocle1h).toBeGreaterThan(0);
    expect(a.usd + a.surcoutEnVolUsd).toBeCloseTo(Math.max(a.usd, pireCasUsd(role.modele, a.jetonsEntree, role.maxTokens, a.jetonsSocle1h)), 9);
  });

  it("médianes de la chaîne courte (banc n° 3) : angle 0,14 $, script 0,17 $, relecture 0,035 $", () => {
    expect(MEDIANES_BANC_G4_USD["court-angle"]).toBe(0.14);
    expect(MEDIANES_BANC_G4_USD["court-script"]).toBe(0.17);
    expect(MEDIANES_BANC_G4_USD["court-relecture"]).toBe(0.035);
  });

  it("chaîne courte, 1 et 3 réseaux, plafond par défaut : sous 1,50 $", () => {
    const un = pireCasChaine("courte", { donnees: { ...d, sujet: { ...d.sujet, reseaux: d.sujet.reseaux.slice(0, 1) } }, options: { tournures: TOURNURES_G4, reseaux: d.sujet.reseaux.slice(0, 1) } });
    const trois = pireCasChaine("courte", { donnees: d, options: { tournures: TOURNURES_G4, reseaux: d.sujet.reseaux } });
    expect(d.sujet.reseaux).toHaveLength(3);
    expect(un.appels).toBe(3);
    expect(trois.appels).toBe(5);
    expect(trois.detail.filter((x) => x.role === "declinaison").reduce((t, x) => t + x.appels, 0)).toBe(2);
    expect(un.usd).toBeLessThan(trois.usd);
    expect(trois.usd).toBeLessThanOrEqual(1.5);
  });
});
