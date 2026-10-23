"use client";

import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { creerElementAction, modifierValeurAction } from "@/app/(studio)/bibliotheque/actions";
import { BarreActionCollee, Bouton, Champ, Curseur, EtatVide, FeuilleBas, Icone, notifier, SelecteurPastilles, type NomIcone } from "@/components/ui";
import type { VueElement } from "@/services/vues";
import { CadreApercu } from "./CadreApercu";
import { FormatsParDefaut } from "./FormatsParDefaut";
import { SousTitreAnime } from "./SousTitreAnime";
import { gabaritDe, GABARITS } from "@/briques/sous-titres/style";
import type { GabaritSousTitres, IntensiteSousTitres } from "@/domaine/types";
import { valeurParDefaut, type FormatCourt, type ValeurSousTitres } from "./outils";

/** Les 4 styles retenus par Will (catalogue du 01/10) : deux bases, deux accents. */
const STYLES: { valeur: GabaritSousTitres; libelle: string; icone: NomIcone }[] = [
  { valeur: "karaoke", libelle: "Karaoké", icone: "pinceau" },
  { valeur: "minimal", libelle: "Minimal", icone: "sous-titres" },
  { valeur: "impact", libelle: "Impact", icone: "eclair" },
  { valeur: "bandeau", libelle: "Bandeau", icone: "texte" },
];

const INTENSITES: { valeur: IntensiteSousTitres; libelle: string }[] = [
  { valeur: "sobre", libelle: "Sobre" },
  { valeur: "equilibre", libelle: "Équilibré" },
  { valeur: "tres-dynamique", libelle: "Très dynamique" },
];

/** Valeur d'un style choisi : le gabarit fixe la police, la casse et le nombre de mots (réglables ensuite). */
function valeurDuGabarit(v: ValeurSousTitres, g: GabaritSousTitres): ValeurSousTitres {
  const d = GABARITS[g];
  return {
    ...v,
    gabarit: g,
    police: d.police,
    casse: d.casse,
    motsParLigne: d.motsMax,
    motsParLigneMin: d.motsMin,
    animation: g === "karaoke" ? "surlignage" : g === "impact" ? "pop" : "aucune",
    jetonEmphase: v.jetonEmphase ?? "orange-vif",
    chiffresAlignes: true,
  };
}

/** SOUS-TITRES (AV2.3-3) : styles animés avec aperçu en direct, création et réglage. */
export function EcranSousTitres({ styles, formats, avant, logo, ajouterAuDepart }: { styles: VueElement[]; formats: FormatCourt[]; avant: string | null; logo: string | null; ajouterAuDepart?: boolean }) {
  const [edition, setEdition] = useState<VueElement | "nouveau" | null>(ajouterAuDepart ? "nouveau" : null);
  const liste = styles.filter((s): s is VueElement & { valeur: ValeurSousTitres } => s.valeur.type === "style-sous-titres");

  return (
    <div>
      {liste.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liste.map((s, i) => (
            <motion.li key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button
                type="button"
                onClick={() => setEdition(s)}
                className="group block w-full overflow-hidden rounded-carte border border-trait bg-surface-1 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-trait-fort"
              >
                <CadreApercu avant={avant} sousTitres={s.valeur} mentionIA={false} className="rounded-none border-0" />
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-texte">{s.nom}</p>
                    <p className="truncate text-xs text-texte-faible">
                      {STYLES.find((a) => a.valeur === gabaritDe(s.valeur))?.libelle} · {s.valeur.motsParLigne} mots
                    </p>
                  </div>
                  {s.formatsParDefaut.length > 0 && (
                    <span className="grid size-7 place-items-center rounded-full bg-orange text-sur-orange" title="Par défaut d'un format">
                      <Icone nom="etoile" size={14} fill="currentColor" />
                    </span>
                  )}
                  <Icone nom="curseurs" size={18} className="text-texte-faible" />
                </div>
              </button>
            </motion.li>
          ))}
        </ul>
      ) : (
        <EtatVide icone="sous-titres" titre="Aucun style" phrase="Créez votre premier style de sous-titres." />
      )}

      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setEdition("nouveau")}>
          Nouveau style
        </Bouton>
      </BarreActionCollee>

      <FeuilleStyle key={edition === null ? "ferme" : edition === "nouveau" ? "nouveau" : edition.id} element={edition} formats={formats} avant={avant} logo={logo} onFermer={() => setEdition(null)} />
    </div>
  );
}

function FeuilleStyle({ element, formats, avant, logo, onFermer }: { element: VueElement | "nouveau" | null; formats: FormatCourt[]; avant: string | null; logo: string | null; onFermer: () => void }) {
  const existant = element && element !== "nouveau" && element.valeur.type === "style-sous-titres" ? element : null;
  const [nom, setNom] = useState(existant?.nom ?? "");
  const [v, setV] = useState<ValeurSousTitres>(existant ? (existant.valeur as ValeurSousTitres) : valeurDuGabarit(valeurParDefaut("style-sous-titres") as ValeurSousTitres, "karaoke"));
  const [intensite, setIntensite] = useState<IntensiteSousTitres>("equilibre");
  const gabarit = gabaritDe(v);
  const [enCours, demarrer] = useTransition();
  const maj = <K extends keyof ValeurSousTitres>(k: K, val: ValeurSousTitres[K]) => setV((x) => ({ ...x, [k]: val }));

  function enregistrer() {
    demarrer(async () => {
      const r = existant ? await modifierValeurAction(existant.id, v) : await creerElementAction({ type: "style-sous-titres", nom: nom || "Mon style", motsCles: [gabarit], valeur: v });
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(existant ? "Style enregistré" : "Style créé");
      onFermer();
    });
  }

  return (
    <FeuilleBas
      ouverte={element !== null}
      onOuverteChange={(o) => !o && onFermer()}
      titre={existant ? existant.nom : "Nouveau style"}
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} onClick={enregistrer}>
          {existant ? "Enregistrer" : "Créer ce style"}
        </Bouton>
      }
    >
      <div className="grid gap-5">
        <div className="sticky top-0 z-10 -mx-5 bg-surface-1 px-5 pb-2">
          {/* Le même cadre, et les sous-titres du moteur de rendu avec l'aperçu du mélange choisi. */}
          <div className="relative">
            <CadreApercu avant={avant} sousTitres={null} logo={logo} />
            <SousTitreAnime style={v} intensite={intensite} className="rounded-carte" />
          </div>
        </div>
        {!existant && <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Mon style" maxLength={60} />}
        <SelecteurPastilles libelle="Style" options={STYLES} valeur={gabarit} onChange={(x) => setV((y) => valeurDuGabarit(y, x))} />
        {(gabarit === "karaoke" || gabarit === "minimal") && (
          <SelecteurPastilles libelle="Aperçu du mélange" options={INTENSITES} valeur={intensite} onChange={setIntensite} />
        )}
        <SelecteurPastilles
          libelle="Position"
          options={[
            { valeur: "haut", libelle: "Haut" },
            { valeur: "centre", libelle: "Centre" },
            { valeur: "bas", libelle: "Bas" },
          ]}
          valeur={v.position}
          // Une position choisie remplace le centre réglé au pourcentage (48 % de l'avocat).
          onChange={(x) => setV((y) => ({ ...y, position: x, positionPct: x === "centre" ? y.positionPct : undefined }))}
        />
        <Curseur libelle="Mots par ligne" valeur={v.motsParLigne} min={GABARITS[gabarit].motsMin} max={GABARITS[gabarit].motsMax} onChange={(x) => maj("motsParLigne", x)} />
        <Curseur libelle="Taille" valeur={Math.round(v.tailleRelative * 100)} min={60} max={140} pas={5} unite=" %" onChange={(x) => maj("tailleRelative", x / 100)} />
        {existant && <FormatsParDefaut elementId={existant.id} type="style-sous-titres" actifs={existant.formatsParDefaut} formats={formats} className="border-t border-trait pt-5" />}
      </div>
    </FeuilleBas>
  );
}
