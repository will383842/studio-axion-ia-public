import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IDS_TRANSITIONS_COMMUNES,
  TRANSITIONS_COMMUNES,
  type IdTransitionCommune,
} from "@/briques/motion/habillage-commun/transitions";
import { CHARTE_AXION, TEINTES_INTERDITES } from "@/briques/jetons-motion";
import { TRANSITIONS, TRANSITION_MIN_MS, TRANSITION_MAX_MS } from "@/briques/plan-scenes/zones";

const SOURCE = readFileSync(join(__dirname, "../../../src/briques/motion/habillage-commun/transitions.ts"), "utf8");
const BOITE = { largeur: 800, hauteur: 450 };
const IDS = [...IDS_TRANSITIONS_COMMUNES] as IdTransitionCommune[];
const PAS = Array.from({ length: 21 }, (_, i) => i / 20);

describe("catalogue commun des transitions (C6-H1)", () => {
  it("14 identifiants exacts, uniques, dans l'ordre, liste blanche", () => {
    expect([...IDS_TRANSITIONS_COMMUNES]).toEqual([
      "fondu", "glisse-haut", "glisse-bas", "glisse-gauche", "glisse-droite", "zoom-doux", "glisse-flou",
      "iris", "volet-ligne", "poussee", "reflet-entree", "volet-terracotta", "flash-ivoire", "glisse-flou-axe",
    ]);
    expect(new Set(IDS).size).toBe(14);
    expect(Object.keys(TRANSITIONS_COMMUNES)).toHaveLength(14);
    for (const id of IDS) {
      expect(TRANSITIONS_COMMUNES[id].id).toBe(id);
      expect(id).not.toMatch(/cube|page|mosaique|glitch/);
      expect(TRANSITIONS_COMMUNES[id].sonConseille).toBeNull();
    }
  });

  it("t = 1 est neutre, t = 0 est invisible ou couvert", () => {
    for (const id of IDS) {
      for (const sens of ["entree", "sortie"] as const) {
        const s1 = TRANSITIONS_COMMUNES[id].style(1, sens, BOITE);
        expect(s1.opacity ?? 1, id).toBe(1);
        const tr = String(s1.transform ?? "");
        expect(tr.replace(/translate[XY]\(0px\)|scale\(1\)|scaleX\(1\)|\s/g, ""), id).toBe("");
        expect(s1.filter, id).toBeUndefined();
        expect(s1.clipPath, id).toBeUndefined();
        expect(s1.boxShadow, id).toBeUndefined();
        expect(s1.backgroundImage, id).toBeUndefined();
        expect(s1.backgroundColor, id).toBeUndefined();
        const s0 = TRANSITIONS_COMMUNES[id].style(0, sens, BOITE);
        const couvert =
          s0.opacity === 0 ||
          /^circle\(0%/.test(String(s0.clipPath)) ||
          /^inset\(0 100% 0 0\)$/.test(String(s0.clipPath)) ||
          /, 1\)/.test(String(s0.boxShadow));
        expect(couvert, id).toBe(true);
      }
    }
  });

  it("égalité figée avec effet() (valeurs littérales ; C6-H3 ajoutera l'égalité par import d'effet)", () => {
    const attendu: Record<string, Record<string, object>> = {
      fondu: { 0: { opacity: 0 }, 0.25: { opacity: 0.25 }, 0.5: { opacity: 0.5 }, 1: { opacity: 1 } },
      "glisse-haut": {
        0: { opacity: 0, transform: "translateY(40px)" },
        0.25: { opacity: 0.25, transform: "translateY(30px)" },
        0.5: { opacity: 0.5, transform: "translateY(20px)" },
        1: { opacity: 1, transform: "translateY(0px)" },
      },
      "glisse-gauche": {
        0: { opacity: 0, transform: "translateX(60px)" },
        0.25: { opacity: 0.25, transform: "translateX(45px)" },
        0.5: { opacity: 0.5, transform: "translateX(30px)" },
        1: { opacity: 1, transform: "translateX(0px)" },
      },
      "zoom-doux": {
        0: { opacity: 0, transform: "scale(0.94)" },
        0.25: { opacity: 0.25, transform: "scale(0.96)" },
        0.5: { opacity: 0.5, transform: "scale(0.97)" },
        1: { opacity: 1, transform: "scale(1)" },
      },
    };
    for (const [id, parT] of Object.entries(attendu)) {
      for (const [t, valeur] of Object.entries(parT)) {
        const d = TRANSITIONS_COMMUNES[id as IdTransitionCommune];
        expect(d.style(Number(t), "entree", BOITE), `${id} ${t}`).toEqual(valeur);
        expect(d.style(Number(t), "sortie", BOITE), `${id} ${t} sortie`).toEqual(valeur);
      }
    }
    expect(TRANSITIONS_COMMUNES["glisse-bas"].style(0, "entree", BOITE).transform).toBe("translateY(-40px)");
    expect(TRANSITIONS_COMMUNES["glisse-droite"].style(0, "entree", BOITE).transform).toBe("translateX(-60px)");
  });

  it("TRANSITIONS de zones.ts reste figé (protège K1)", () => {
    expect([...TRANSITIONS]).toEqual(["fondu", "glisse-haut", "glisse-gauche", "zoom-doux"]);
  });

  it("durées bornées ; glisse-flou ≤ 400 ms, flou ∈ {0, 6, 12} px", () => {
    for (const id of IDS) {
      const d = TRANSITIONS_COMMUNES[id];
      if (d.emprise === "boite") {
        expect(d.dureeMs[0]).toBeGreaterThanOrEqual(TRANSITION_MIN_MS);
        expect(d.dureeMs[1]).toBeLessThanOrEqual(TRANSITION_MAX_MS);
      }
      expect(d.dureeMs[0]).toBeLessThanOrEqual(d.dureeMs[1]);
    }
    expect(TRANSITIONS_COMMUNES["glisse-flou"].dureeMs[1]).toBeLessThanOrEqual(400);
    for (const t of PAS) {
      const f = String(TRANSITIONS_COMMUNES["glisse-flou"].style(t, "entree", BOITE).filter ?? "blur(0px)");
      const m = /^blur\((\d+)px\)$/.exec(f);
      expect(m, f).not.toBeNull();
      expect([0, 6, 12]).toContain(Number(m![1]));
    }
    for (const t of PAS) expect(TRANSITIONS_COMMUNES["glisse-flou-axe"].style(t, "entree", BOITE).filter).toBeUndefined();
  });

  it("couleurs : seulement la charte, aucune teinte interdite", () => {
    const permis = new Set(Object.values(CHARTE_AXION).map((h) => {
      const n = parseInt(h.slice(1), 16);
      return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    }));
    for (const id of IDS) {
      for (const t of PAS) {
        const txt = JSON.stringify(TRANSITIONS_COMMUNES[id].style(t, "entree", BOITE));
        for (const h of txt.match(/#[0-9a-fA-F]{6}/g) ?? []) {
          const n = parseInt(h.slice(1), 16);
          expect(permis.has(`${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`), `${id} ${h}`).toBe(true);
        }
        for (const m of txt.matchAll(/rgba\((\d+), (\d+), (\d+),/g)) expect(permis.has(`${m[1]},${m[2]},${m[3]}`), `${id} ${m[0]}`).toBe(true);
        for (const mot of [...TEINTES_INTERDITES, "turquoise"]) expect(txt.toLowerCase()).not.toContain(mot);
      }
    }
  });

  it("emprise, attendMesure, monotonie, déterminisme", () => {
    expect(IDS.filter((i) => TRANSITIONS_COMMUNES[i].emprise === "plein-cadre")).toEqual(["volet-terracotta"]);
    expect(IDS.filter((i) => TRANSITIONS_COMMUNES[i].attendMesure)).toEqual(["glisse-flou", "glisse-flou-axe"]);
    for (const id of IDS) {
      const d = TRANSITIONS_COMMUNES[id];
      if (d.emprise === "plein-cadre") for (const t of PAS) expect(d.style(t, "entree", BOITE).filter, id).toBeUndefined();
      let prec = -1;
      for (const t of PAS) {
        const o = Number(d.style(t, "entree", BOITE).opacity ?? 1);
        expect(o, `${id} ${t}`).toBeGreaterThanOrEqual(prec);
        prec = o;
        expect(d.style(t, "entree", BOITE)).toEqual(d.style(t, "entree", BOITE));
      }
    }
  });

  it("source pur : pas de alias, hasard, zod ni remotion", () => {
    expect(SOURCE).not.toContain("@/");
    expect(SOURCE).not.toContain("Math.random");
    const imports = SOURCE.split("\n").filter((l) => /^\s*(import|export) .* from /.test(l));
    for (const l of imports) {
      expect(l).not.toMatch(/zod|remotion/);
      expect(l).toMatch(/from "(\.\.?\/|react")/);
    }
  });
});
