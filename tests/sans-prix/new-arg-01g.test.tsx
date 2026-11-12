/**
 * NEW-ARG-01g · aucun montant à l'écran dans les écrans du lot g (écriture en cours, fabrication des réseaux, fiche du
 * sujet, relecture, ajout de prononciation, téléchargement). Les textes venus du serveur peuvent contenir un prix :
 * ils sont rendus sans montant. Les coûts restent enregistrés ; seuls les affichages changent. Rendu serveur seulement.
 */
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));
vi.mock("@/app/(studio)/ecrire/sujets/actions", () => new Proxy({}, { get: () => async () => ({ ok: true }) }));

const { EcritureEnCours } = await import("@/components/generateur/EcritureEnCours");
const { EtatFabricationVersion } = await import("@/components/generateur/FabricationReseaux");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const SANS_ARGENT = /€|\$|euros?\b|dollars?\b|\bUSD\b|\bEUR\b|\d+[.,]\d{2}\s*(?:€|\$)/i;
const ETAT = { statut: "echec", etape: 2, libelle: "Écriture", utiliseEur: "1,20 €", medianeMin: null };

describe("EcritureEnCours", () => {
  it("message, raison de reprise et blocage venus du serveur : aucun montant", () => {
    const t = texte(
      renderToStaticMarkup(
        createElement(EcritureEnCours, {
          id: "s1",
          etat: { ...ETAT, statut: "en-attente-credit", message: "Il reste 0,80 € sur les 5 € du mois.", reprise: { possible: false, raison: "Il faudrait environ 3,40 € de plus." } },
        }),
      ),
    );
    expect(t).not.toMatch(SANS_ARGENT);
    expect(t).toContain("ce coût");
  });
  it("écriture arrêtée avec un blocage chiffré : aucun montant", () => {
    const t = texte(renderToStaticMarkup(createElement(EcritureEnCours, { id: "s1", etat: { ...ETAT, bloque: "Plafond de 50 euros atteint." } })));
    expect(t).not.toMatch(SANS_ARGENT);
  });
});

describe("EtatFabricationVersion", () => {
  const base = { attendConfirmation: false, attendMere: false, attendCredit: true, enCours: false, points: [] as string[] };
  it("raison d'attente et avatar parlé chiffrés : aucun montant", () => {
    const t = texte(renderToStaticMarkup(createElement(EtatFabricationVersion, { sujetId: "s1", etat: { ...base, raisonAttente: "Attend 2,50 € de crédit." } as never })));
    expect(t).not.toMatch(SANS_ARGENT);
    const u = texte(renderToStaticMarkup(createElement(EtatFabricationVersion, { sujetId: "s1", etat: { ...base, attendCredit: false, attendConfirmation: true, videoId: "v", avatarParle: "Voix incluse, 1,10 €." } as never })));
    expect(u).not.toMatch(SANS_ARGENT);
  });
});

describe("garde de source : tout message du serveur affiché ou notifié passe par messageSansMontant", () => {
  const FICHIERS = [
    "src/components/generateur/EcritureEnCours.tsx",
    "src/components/generateur/FabricationReseaux.tsx",
    "src/components/generateur/FicheSujet.tsx",
    "src/components/generateur/RelireVersions.tsx",
    "src/components/prononciations/FeuilleAjoutPrononciation.tsx",
    "src/components/publication/FeuilleTelecharger.tsx",
  ];
  it.each(FICHIERS)("%s : aucun notifier.erreur(...message) brut", (f) => {
    const src = readFileSync(f, "utf8");
    const bruts = src.split("\n").filter((l) => /notifier\.erreur\(\s*(?:r|res|ignorees\[0\])\.message/.test(l) || /notifier\.erreur\(`\$\{ignorees\[0\]\.code\} : \$\{ignorees/.test(l));
    expect(bruts).toEqual([]);
  });
  it.each(FICHIERS)("%s : aucun symbole d'argent écrit dans le rendu", (f) => {
    const src = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\{\/\*/.test(l));
    expect(src.filter((l) => /["'`>][^"'`]*[€$]\s|\beuros\b/.test(l) && !/\$\{/.test(l))).toEqual([]);
  });
});
