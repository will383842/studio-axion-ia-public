// Planche du dosage (X3-13a) : tableau « gardé / retiré » par générateur et par cran permis. Pur : aucun rendu,
// aucun réseau, aucune écriture, aucun service. Lancer : npx tsx scripts/dosage-motion/planche.ts
import { appliquerDosage } from "@/briques/dosage-motion/commande";
import { CRANS_PERMIS, DOSAGE_DEFAUT_CODE, RETRAITS } from "@/briques/dosage-motion/crans";
import type { DosageMotion, IdGenerateurDosage, RetraitsDosage } from "@/briques/dosage-motion/types";
import type { CommandeFabrication } from "@/domaine/types";

export interface LignePlanche {
  generateur: IdGenerateurDosage;
  cran: DosageMotion;
  defautDuCode: boolean;
  retraits: RetraitsDosage;
  sousTitresPresents: true;
  commande: CommandeFabrication;
}

/** Commande de démonstration fixe (seuls les champs lus par `appliquerDosage` comptent). */
const COMMANDE_DEMO = {
  versionContrat: 2,
  videoId: "demo",
  formatId: "demo",
  versionFormat: 1,
  profilRenduVersion: 1,
  dureeCibleSec: 30,
  intensite: { niveau: "equilibre", bruitages: "discrets" },
  sousTitres: { base: "mot", intensite: "equilibre" },
  plans: [],
  entrees: {},
} as unknown as CommandeFabrication;

export function tableauDosage(): LignePlanche[] {
  const ids = Object.keys(CRANS_PERMIS) as IdGenerateurDosage[];
  return ids.flatMap((generateur) =>
    CRANS_PERMIS[generateur].map((cran) => ({
      generateur,
      cran,
      defautDuCode: DOSAGE_DEFAUT_CODE[generateur] === cran,
      retraits: RETRAITS[cran],
      sousTitresPresents: true as const,
      commande: appliquerDosage(COMMANDE_DEMO, { cran, choisiPar: "code" }),
    })),
  );
}

const rt = (retire: boolean) => (retire ? "retiré" : "gardé");

export function enMarkdown(lignes: LignePlanche[]): string {
  const tete = [
    "| Générateur | Cran | Défaut du code | Cartes | Pièces | Texte écran | Zooms | Accents | Transitions | Sous-titres présents | Commande (dosage · niveau) |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const corps = lignes.map((l) => {
    const r = l.retraits;
    return `| ${l.generateur} | ${l.cran} | ${l.defautDuCode ? "oui" : "non"} | ${rt(r.cartes)} | ${rt(r.illustrations)} | ${rt(r.texteEcran)} | ${rt(r.zooms)} | ${rt(r.effetsSpeciaux)} | ${r.transitions} | ${l.sousTitresPresents ? "oui" : "non"} | ${l.commande.dosageMotion?.cran} · ${l.commande.intensite?.niveau} |`;
  });
  return [...tete, ...corps].join("\n") + "\n";
}

if (process.argv[1] && /planche\.ts$/.test(process.argv[1])) {
  process.stdout.write(enMarkdown(tableauDosage()));
}
