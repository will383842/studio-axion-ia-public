"use client";

/** Aperçu de l'écran commun avec le script v4 et un faux adaptateur : rien n'est envoyé, rien n'est payé. */
import { useMemo } from "react";
import { RelireScript } from "@/components/script/RelireScript";
import { notifier } from "@/components/ui/Toast";
import type { PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import { controlerEssai, DEBIT_V4, lignesV4 } from "./_exemple";

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function controler(s: ScriptRelu): Promise<PastilleControle[]> {
  await attendre(250);
  return controlerEssai(s);
}

async function lancer(s: ScriptRelu): Promise<ResultatLancement> {
  await attendre(600);
  notifier.succes(s.modifications.length ? `Essai : ${s.modifications.length} modification(s), rien n'est lancé.` : "Essai : rien n'est lancé.");
  return { ok: true };
}

export function ApercuRelireScript() {
  const lignes = useMemo(() => lignesV4(), []);
  return <RelireScript lignes={lignes} controler={controler} lancer={lancer} prixCentimes={420} debit={DEBIT_V4} texteLibre />;
}
