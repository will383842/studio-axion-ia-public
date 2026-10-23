"use client";

import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { enregistrerAccordAction } from "@/app/(studio)/personnages/actions";
import { BarreActionCollee, Bouton, CaseACocher, Champ, Icone, notifier, PastilleEssai, ZoneDepot, type NomIcone } from "@/components/ui";
import { dateLongue } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { VueFichePersonnage } from "@/services/B-personnages-bibliotheque";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { tailleLisible } from "./outils";

function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Onglet ACCORD (personne réelle) : case + document + date, BLOQUANT tant qu'incomplet (B.4-6). */
export function OngletAccord({ fiche }: { fiche: VueFichePersonnage }) {
  const accord = fiche.personnage.accord;
  const valide = fiche.accordValide;
  const [modifier, setModifier] = useState(!valide);
  const [coche, setCoche] = useState(false);
  const [document, setDocument] = useState<File | null>(null);
  const [date, setDate] = useState(aujourdhui());
  const [perimetre, setPerimetre] = useState("");
  const [enCours, demarrer] = useTransition();
  const nom = fiche.personnage.nom;

  const etapes: { fait: boolean; libelle: string; icone: NomIcone }[] = [
    { fait: coche, libelle: "Case", icone: "coche" },
    { fait: !!document, libelle: "Document", icone: "document" },
    { fait: !!date, libelle: "Date", icone: "calendrier" },
  ];
  const complet = etapes.every((e) => e.fait);

  function enregistrer() {
    if (!complet || !document) return void notifier.erreur("Cochez la case, déposez le document et indiquez la date.");
    demarrer(async () => {
      const e = await envoyerFichiers([document], { typeEntite: "accord", entiteId: fiche.personnage.id });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await enregistrerAccordAction(fiche.personnage.id, { case: coche, document: { fichierId: e.fichierIds[0] }, date, perimetre });
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`Accord de ${nom} enregistré`, "Son double et sa voix sont débloqués.");
      setModifier(false);
    });
  }

  if (valide && !modifier) {
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative isolate overflow-hidden rounded-carte border border-sauge/40 bg-sauge-doux p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-sauge text-fond">
              <Icone nom="bouclier" size={22} />
            </span>
            <div>
              <p className="font-semibold text-texte">Accord enregistré</p>
              <p className="text-sm text-sauge">{accord?.date ? `Signé le ${dateLongue(accord.date)}` : "Complet"}</p>
            </div>
          </div>
        </motion.div>
        <ul className="grid gap-2">
          <LigneAccord icone="coche" titre="Accord écrit confirmé" />
          <LigneAccord icone="document" titre={fiche.accordDocument?.nom ?? "Document déposé"} lien={fiche.accordDocument?.url ?? undefined} detail={fiche.accordDocument?.url ? undefined : "Document gardé"} essai={!fiche.accordDocument?.url} />
          {accord?.perimetre && <LigneAccord icone="info" titre={accord.perimetre} />}
        </ul>
        <BarreActionCollee>
          <Bouton taille="lg" variante="secondaire" icone="ecrire" onClick={() => setModifier(true)}>
            Remplacer l&apos;accord
          </Bouton>
        </BarreActionCollee>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Les trois preuves, en gros */}
      <div className="grid grid-cols-3 gap-2">
        {etapes.map((e) => (
          <div key={e.libelle} className={cn("flex flex-col items-center gap-2 rounded-carte border p-3 transition-colors duration-200", e.fait ? "border-sauge/40 bg-sauge-doux" : "border-trait bg-surface-1")}>
            <motion.span animate={{ scale: e.fait ? [1, 1.15, 1] : 1 }} className={cn("grid size-10 place-items-center rounded-full", e.fait ? "bg-sauge text-fond" : "bg-surface-3 text-texte-faible")}>
              <Icone nom={e.fait ? "coche" : e.icone} size={18} strokeWidth={e.fait ? 3 : 1.9} />
            </motion.span>
            <span className={cn("text-sm font-semibold", e.fait ? "text-sauge" : "text-texte-doux")}>{e.libelle}</span>
          </div>
        ))}
      </div>

      <div className="rounded-carte border border-trait bg-surface-1 p-4">
        <CaseACocher coche={coche} onChange={setCoche} libelle={`J'ai l'accord écrit de ${nom}`} detail="Pour son visage et sa voix, dans mes vidéos." />
      </div>

      {document ? (
        <div className="flex min-h-14 items-center gap-3 rounded-carte border border-trait bg-surface-1 px-4">
          <Icone nom="document" size={20} className="text-orange-vif" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-texte">{document.name}</span>
            <span className="text-xs text-texte-faible">{tailleLisible(document.size)}</span>
          </span>
          <button type="button" aria-label="Retirer le document" onClick={() => setDocument(null)} className="-mr-2 grid size-11 place-items-center rounded-full text-texte-faible hover:text-texte">
            <Icone nom="fermer" size={18} />
          </button>
        </div>
      ) : (
        <ZoneDepot compacte multiple={false} libelle="Déposer l'accord signé" detail="PDF ou photo" accepte="application/pdf,image/*" icone="document" onFichiers={(f) => setDocument(f[0] ?? null)} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ libelle="Date de l'accord" type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} icone="calendrier" />
        <Champ libelle="Ce qui est autorisé (facultatif)" value={perimetre} onChange={(e) => setPerimetre(e.target.value)} placeholder="Vidéos Axion, 2 ans" maxLength={200} />
      </div>

      <BarreActionCollee secondaire={valide ? <Bouton variante="fantome" onClick={() => setModifier(false)}>Annuler</Bouton> : undefined}>
        <Bouton taille="lg" icone="bouclier" chargement={enCours} disabled={!complet} onClick={enregistrer}>
          Enregistrer l&apos;accord
        </Bouton>
      </BarreActionCollee>
    </div>
  );
}

function LigneAccord({ icone, titre, lien, detail, essai }: { icone: NomIcone; titre: string; lien?: string; detail?: string; essai?: boolean }) {
  const contenu = (
    <>
      <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-sauge">
        <Icone nom={icone} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-texte">{titre}</span>
        {detail && <span className="block truncate text-xs text-texte-faible">{detail}</span>}
      </span>
      {essai && <PastilleEssai />}
      {lien && <Icone nom="oeil" size={18} className="text-texte-faible" />}
    </>
  );
  return (
    <li>
      {lien ? (
        <a href={lien} target="_blank" rel="noreferrer" className="flex min-h-14 items-center gap-3 rounded-carte border border-trait bg-surface-1 px-4 hover:border-trait-fort">
          {contenu}
        </a>
      ) : (
        <div className="flex min-h-14 items-center gap-3 rounded-carte border border-trait bg-surface-1 px-4">{contenu}</div>
      )}
    </li>
  );
}
