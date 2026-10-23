import { OngletsLiens } from "@/components/ui/Onglets";

export type VueOnglet = "tous" | "a_valider" | "valides" | "corbeille";

const ONGLETS: { vue: VueOnglet; libelle: string }[] = [
  { vue: "tous", libelle: "Tous" },
  { vue: "a_valider", libelle: "À valider" },
  { vue: "valides", libelle: "Validés" },
  { vue: "corbeille", libelle: "Corbeille" },
];

export function OngletsCarrousels({ actif, compteurs, base = "/carrousels" }: { actif: VueOnglet; compteurs?: Partial<Record<VueOnglet, number>>; base?: string }) {
  return (
    <OngletsLiens
      libelle="Vos carrousels"
      onglets={ONGLETS.map((o) => ({ href: `${base}?vue=${o.vue}`, libelle: o.libelle, compteur: compteurs?.[o.vue], actif: o.vue === actif }))}
    />
  );
}
