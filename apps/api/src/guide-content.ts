import { MAINTENANCE_CATALOG_VERSION } from "./maintenance-catalog.ts";

type GuideSectionSeed = {
  id: string;
  sectionType:
    | "introduction"
    | "why_it_matters"
    | "overview"
    | "tools_materials"
    | "safety"
    | "preparation"
    | "step"
    | "common_mistakes"
    | "completion_check"
    | "professional_help"
    | "print_note"
    | "custom";
  sectionKey: string;
  position: number;
  title: string | null;
  content: Record<string, unknown>;
};

type GuideTagSeed = {
  id: string;
  tagKey: string;
  label: string;
  tagType: "category" | "house_part" | "material" | "problem" | "audience";
};

type GuideSearchTermSeed = {
  id: string;
  term: string;
  termType: "keyword" | "synonym" | "problem" | "material" | "tag";
  weight: number;
};

export type GuideContentSeed = {
  template: {
    id: string;
    guideKey: string;
  };
  version: {
    id: string;
    versionNumber: number;
    title: string;
    summary: string;
  };
  catalogLink: {
    catalogKey: string;
    catalogVersion: string;
  };
  sections: ReadonlyArray<GuideSectionSeed>;
  tags: ReadonlyArray<GuideTagSeed>;
  searchTerms: ReadonlyArray<GuideSearchTermSeed>;
  printMetadata: {
    printTitle: string;
    printSubtitle: string;
    footerText: string;
    showHotspotLegend: boolean;
    sectionOrder: ReadonlyArray<string>;
    renderOptions: Record<string, unknown>;
  };
};

const commonTags = {
  maintenance: {
    id: "gtag_vedligeholdelse",
    tagKey: "vedligeholdelse",
    label: "Vedligeholdelse",
    tagType: "category" as const
  },
  visualInspection: {
    id: "gtag_visuelt_eftersyn",
    tagKey: "visuelt_eftersyn",
    label: "Visuelt eftersyn",
    tagType: "audience" as const
  }
};

export const guideContentSeeds: ReadonlyArray<GuideContentSeed> = [
  {
    template: {
      id: "guide_rens_tagrender",
      guideKey: "rens_tagrender"
    },
    version: {
      id: "gver_rens_tagrender_v1",
      versionNumber: 1,
      title: "Rens tagrender",
      summary:
        "En sikker gennemgang af tagrender og nedløb, så regnvand kan ledes væk fra huset."
    },
    catalogLink: {
      catalogKey: "gutters_clean",
      catalogVersion: MAINTENANCE_CATALOG_VERSION
    },
    sections: [
      {
        id: "gsec_rens_tagrender_intro",
        sectionType: "introduction",
        sectionKey: "introduction",
        position: 0,
        title: "Kort introduktion",
        content: {
          body:
            "Rensning af tagrender er en enkel, men vigtig vedligeholdelsesopgave. Gør kun arbejdet, hvis du kan komme sikkert til. Fra jorden eller et stabilt arbejdssted skal du kunne se, om vandet har en fri vej mod nedløbet."
        }
      },
      {
        id: "gsec_rens_tagrender_why",
        sectionType: "why_it_matters",
        sectionKey: "why_it_matters",
        position: 1,
        title: "Hvorfor det er vigtigt",
        content: {
          points: [
            "Blade, mos og snavs kan holde vand tilbage i tagrenden.",
            "Når vand løber over, kan det belaste facade, sokkel og arealer tæt ved huset.",
            "En visuel kontrol kan opdage løse beslag, utætte samlinger og skader, før de bliver større."
          ]
        }
      },
      {
        id: "gsec_rens_tagrender_overview",
        sectionType: "overview",
        sectionKey: "overview",
        position: 2,
        title: "Overblik og task-defaults",
        content: {
          estimatedDurationMinutes: 60,
          difficulty: "Middel",
          recommendedPeriods: [
            { season: "spring", label: "Forår", months: [3, 4, 5] },
            { season: "autumn", label: "Efterår", months: [9, 10, 11] }
          ],
          taskDefaults: {
            catalogKey: "gutters_clean",
            recurrenceInterval: "half_yearly",
            recurrenceAnchor: "completed_date",
            catalogRecommendationPeriod: {
              season: "autumn",
              type: "month_range",
              startMonth: 9,
              endMonth: 11
            },
            userChoice: "Vælg en konkret dato, når opgaven føjes til huset."
          }
        }
      },
      {
        id: "gsec_rens_tagrender_tools",
        sectionType: "tools_materials",
        sectionKey: "tools_materials",
        position: 3,
        title: "Værktøj og materialer",
        content: {
          items: [
            { name: "Arbejdshandsker", purpose: "Beskytter mod skarpe kanter og snavs." },
            { name: "Stabil stige eller andet sikkert arbejdsudstyr", purpose: "Brug kun udstyr, du kan placere sikkert." },
            { name: "Lille spand eller pose", purpose: "Opsamling af blade, mos og snavs." },
            { name: "Haveslange", purpose: "Skylning og kontrol af vandets vej, hvis det kan gøres sikkert." }
          ]
        }
      },
      {
        id: "gsec_rens_tagrender_safety",
        sectionType: "safety",
        sectionKey: "safety",
        position: 4,
        title: "Sikkerhed først",
        content: {
          warnings: [
            "Arbejd ikke på en våd, glat eller ustabil stige.",
            "Placér stigen på fast underlag og følg stigens producentanvisning.",
            "Undgå at række langt ud til siden. Flyt stigen i stedet.",
            "Stop, hvis adgangsforholdene, højden eller taget føles usikre."
          ],
          stopConditions: [
            "Du kan ikke udføre arbejdet med stabil fodfæste.",
            "Der er synlige løse tagdele, skarpe skader eller risiko for nedfald.",
            "Nedløb eller afløb kræver adskillelse eller arbejde, du ikke er tryg ved."
          ]
        }
      },
      {
        id: "gsec_rens_tagrender_prepare",
        sectionType: "preparation",
        sectionKey: "preparation",
        position: 5,
        title: "Forberedelse",
        content: {
          checklist: [
            "Vælg tørt vejr og gode lysforhold.",
            "Gå rundt om huset og notér, hvor vand tidligere har løbet over eller samlet sig.",
            "Kontrollér at stigen kan stå på et fast, plant underlag, før du begynder."
          ]
        }
      },
      {
        id: "gsec_rens_tagrender_step_1",
        sectionType: "step",
        sectionKey: "step_1_remove_debris",
        position: 6,
        title: "1. Fjern blade og snavs",
        content: {
          instruction:
            "Fjern blade, mos og andet løst snavs lidt ad gangen. Læg det i spanden eller posen i stedet for at skubbe det ned i nedløbet.",
          check: "Renden er fri for synligt løst materiale langs den del, du kan nå sikkert."
        }
      },
      {
        id: "gsec_rens_tagrender_step_2",
        sectionType: "step",
        sectionKey: "step_2_rinse_gutter",
        position: 7,
        title: "2. Skyl tagrenden",
        content: {
          instruction:
            "Skyl forsigtigt med vand mod nedløbet, hvis du kan gøre det uden at miste balancen eller sprøjte vand ind mod huset.",
          check: "Vandet bevæger sig mod nedløbet uden at stå stille eller løbe over kanten."
        }
      },
      {
        id: "gsec_rens_tagrender_step_3",
        sectionType: "step",
        sectionKey: "step_3_check_downpipe",
        position: 8,
        title: "3. Kontrollér nedløbet",
        content: {
          instruction:
            "Se om vandet fortsætter ned gennem nedløbsrøret, og kontrollér synlige samlinger og udløb fra jorden.",
          check: "Der er ikke tydelige blokeringer, dryp eller vand, der presser ud ved samlingerne."
        }
      },
      {
        id: "gsec_rens_tagrender_step_4",
        sectionType: "step",
        sectionKey: "step_4_inspect_condition",
        position: 9,
        title: "4. Se efter skader og fald",
        content: {
          instruction:
            "Se langs renden efter løse beslag, revner, rust eller andre synlige skader. Bemærk også, om vandet samler sig i stedet for at løbe mod nedløbet.",
          check: "Renden virker stabil, og vandet har en synlig vej mod nedløbet."
        }
      },
      {
        id: "gsec_rens_tagrender_mistakes",
        sectionType: "common_mistakes",
        sectionKey: "common_mistakes",
        position: 10,
        title: "Typiske fejl og problemtegn",
        content: {
          items: [
            "At skubbe blade ned i nedløbet, så blokeringen flytter sig i stedet for at forsvinde.",
            "At fortsætte arbejdet fra en ustabil stige eller ved dårligt vejr.",
            "At overse vand, der står stille i renden, eller samlinger der drypper efter skylning.",
            "At bøje eller belaste renden hårdt under rensning."
          ]
        }
      },
      {
        id: "gsec_rens_tagrender_complete",
        sectionType: "completion_check",
        sectionKey: "completion_check",
        position: 11,
        title: "Sådan ser det ud, når det er korrekt",
        content: {
          checklist: [
            "Tagrenden er fri for synlige blade, mos og løst snavs.",
            "Vandet løber mod og videre gennem nedløbet uden at løbe over.",
            "Der er ingen tydelige dryp, løse beslag eller synlige skader, der kræver opfølgning."
          ]
        }
      },
      {
        id: "gsec_rens_tagrender_help",
        sectionType: "professional_help",
        sectionKey: "professional_help",
        position: 12,
        title: "Hvornår skal du kontakte en fagperson?",
        content: {
          reasons: [
            "Du kan ikke komme sikkert til tagrenden.",
            "Nedløbet er fortsat blokeret, eller vandet løber ud ved skjulte samlinger.",
            "Der er rust, revner, løse beslag, deformering eller forkert fald, som ikke kan afklares visuelt.",
            "Der er tegn på fugt- eller vandskade på facade, sokkel eller ved huset."
          ],
          suggestedProfessionals: ["Blikkenslager", "Tagdækker"]
        }
      },
      {
        id: "gsec_rens_tagrender_visual_plan",
        sectionType: "custom",
        sectionKey: "visual_plan",
        position: 13,
        title: "Billed- og hotspotplan",
        content: {
          assetStatus: "pilot_assets_registered",
          referenceUniverse: "Matriva-huset",
          houseProfileAssessment: {
            value: "relevant_when_reference_assets_are_available",
            reason:
              "Tagrender, nedløb, materialer og monteringsdetaljer kan variere synligt mellem referencehuse. Der oprettes ingen House A/B/C-grænser eller asset-varianter, før referencehusene og billederne er godkendt."
          },
          images: [
            { key: "gutter_orientation", placement: "cover", altText: "House A med synlig tagrende og nedløb.", caption: "Find tagrenden og nedløbet, før du begynder.", description: "Orientering ved House A's tagkant og nedløb." },
            { key: "gutter_remove_debris", placement: "step", altText: "En behandsket hånd fjerner løse blade og almindeligt tørt snavs fra tagrenden.", caption: "Fjern løst snavs uden at presse det ned i nedløbet.", description: "Rutinemæssig rensning af en to år gammel tagrende med spredte blade, småkviste og almindeligt tørt organisk snavs." },
            { key: "gutter_flow_downpipe", placement: "step", altText: "Vand bevæger sig gennem tagrenden mod nedløbet.", caption: "Vandet skal have fri vej mod nedløbet.", description: "Kontrol af vandflow ved tagrendens hjørne og nedløb." },
            { key: "gutter_correct_result", placement: "after", altText: "Ren tagrende med frit nedløb ved House A.", caption: "En normalt ren rende leder vandet videre uden synlige problemer.", description: "Funktionelt rent slutresultat ved tagrendens hjørne." }
          ],
          plannedHotspots: [
            { label: "Blade og snavs", type: "tip", body: "Fjern løst materiale i stedet for at føre det ned i nedløbet." },
            { label: "Kontrollér faldet", type: "checkpoint", body: "Vand skal kunne bevæge sig mod nedløbet og ikke stå stille." },
            { label: "Kontrollér samlingen", type: "checkpoint", body: "Se efter synlige dryp, revner eller løse samlinger." },
            { label: "Tjek nedløbet", type: "checkpoint", body: "Vandet skal fortsætte frit gennem røret." }
          ],
          coordinatePolicy: "Hotspot-koordinater oprettes først, når det konkrete billede er godkendt."
        }
      },
      {
        id: "gsec_rens_tagrender_review_plan",
        sectionType: "custom",
        sectionKey: "review_plan",
        position: 15,
        title: "Faglig review før publicering",
        content: {
          validationStatus: "not_requested",
          requiredScopes: ["editorial", "technical", "safety", "visual"],
          scopeFocus: {
            editorial: "Klarhed, struktur og dansk boligejersprog.",
            technical: "Faglig korrekthed om tagrender, nedløb, fald og synlige skader.",
            safety: "Stige, adgangsforhold og klare stopbetingelser.",
            visual: "Matriva-husets referencebilleder, billedtekster og hotspotplaceringer."
          },
          publicationRule: "Ingen publicering før de nødvendige review-områder er godkendt af relevante fagpersoner."
        }
      },
      {
        id: "gsec_rens_tagrender_print_note",
        sectionType: "print_note",
        sectionKey: "print_note",
        position: 14,
        title: "Printnotat",
        content: {
          body: "Tag guiden med ud, men brug ikke en printet guide som erstatning for sikker vurdering af adgangsforholdene."
        }
      }
    ],
    tags: [
      commonTags.maintenance,
      commonTags.visualInspection,
      { id: "gtag_tag_og_tagrender", tagKey: "tag_og_tagrender", label: "Tag og tagrender", tagType: "house_part" },
      { id: "gtag_vandafledning", tagKey: "vandafledning", label: "Vandafledning", tagType: "house_part" },
      { id: "gtag_tilstoppet", tagKey: "tilstoppet", label: "Tilstoppet", tagType: "problem" }
    ],
    searchTerms: [
      { id: "gterm_tagrender_tagrende", term: "tagrende", termType: "keyword", weight: 10 },
      { id: "gterm_tagrender_tagrender", term: "tagrender", termType: "synonym", weight: 10 },
      { id: "gterm_tagrender_blade", term: "blade i tagrende", termType: "problem", weight: 8 },
      { id: "gterm_tagrender_tilstoppet", term: "tilstoppet tagrende", termType: "problem", weight: 9 },
      { id: "gterm_tagrender_nedloeb", term: "nedløb", termType: "keyword", weight: 8 },
      { id: "gterm_tagrender_nedloebsroer", term: "nedløbsrør", termType: "synonym", weight: 8 },
      { id: "gterm_tagrender_overloeb", term: "vand løber over tagrenden", termType: "problem", weight: 9 }
    ],
    printMetadata: {
      printTitle: "Rens tagrender",
      printSubtitle: "Matriva guide · kladde til faglig validering",
      footerText: "Matriva · Guideversion 1 · Kontrollér altid sikker adgang før arbejdet udføres.",
      showHotspotLegend: true,
      sectionOrder: ["introduction", "why_it_matters", "overview", "tools_materials", "safety", "preparation", "step_1_remove_debris", "step_2_rinse_gutter", "step_3_check_downpipe", "step_4_inspect_condition", "common_mistakes", "completion_check", "professional_help", "visual_plan", "print_note"],
      renderOptions: { brandHeader: true, includeVersionFooter: true, imagePolicy: "render_when_assets_exist", safetyEmphasis: "high" }
    }
  },
  {
    template: {
      id: "guide_tjek_fuger_vaadrum",
      guideKey: "tjek_fuger_vaadrum"
    },
    version: {
      id: "gver_tjek_fuger_vaadrum_v1",
      versionNumber: 1,
      title: "Tjek fuger i vådrum",
      summary:
        "En visuel egenkontrol af synlige fuger i badeværelse og andre vådrum – ikke en vejledning til at reparere vådrumskonstruktionen."
    },
    catalogLink: {
      catalogKey: "wetroom_joints_check",
      catalogVersion: MAINTENANCE_CATALOG_VERSION
    },
    sections: [
      {
        id: "gsec_fuger_vaadrum_intro",
        sectionType: "introduction",
        sectionKey: "introduction",
        position: 0,
        title: "Kort introduktion",
        content: {
          body:
            "Denne guide er en visuel egenkontrol af synlige fuger omkring vådrummets overflader. Den hjælper dig med at opdage forhold, der bør vurderes nærmere; den er ikke en instruktion i at reparere eller tætne vådrum."
        }
      },
      {
        id: "gsec_fuger_vaadrum_why",
        sectionType: "why_it_matters",
        sectionKey: "why_it_matters",
        position: 1,
        title: "Hvorfor det er vigtigt",
        content: {
          points: [
            "Synlige revner, løse fuger eller ændrede misfarvninger kan være tegn på, at et område bør undersøges.",
            "Hjørner, overgange og områder nær vandpåvirkning udsættes typisk for bevægelse og fugt.",
            "Tidlig observation gør det lettere at få faglig vurdering, før et muligt problem udvikler sig."
          ]
        }
      },
      {
        id: "gsec_fuger_vaadrum_overview",
        sectionType: "overview",
        sectionKey: "overview",
        position: 2,
        title: "Overblik og task-defaults",
        content: {
          estimatedDurationMinutes: 20,
          difficulty: "Let",
          recommendedPeriods: [{ season: "all_year", label: "Hele året" }],
          taskDefaults: {
            catalogKey: "wetroom_joints_check",
            recurrenceInterval: "yearly",
            recurrenceAnchor: "completed_date",
            catalogRecommendationPeriod: { season: "all_year", type: "all_year" },
            userChoice: "Vælg en konkret dato, når opgaven føjes til huset."
          },
          scopeBoundary: "Visuel observation af synlige fuger; ingen reparation, udskiftning eller indgreb i vådrumskonstruktionen."
        }
      },
      {
        id: "gsec_fuger_vaadrum_tools",
        sectionType: "tools_materials",
        sectionKey: "tools_materials",
        position: 3,
        title: "Det skal du bruge",
        content: {
          items: [
            { name: "God belysning", purpose: "Gør små revner, åbninger og farveændringer lettere at se." },
            { name: "Telefon eller notesblok", purpose: "Notér placering og udvikling, hvis et forhold skal følges op." }
          ],
          notNeeded: ["Kniv, skraber, fugemasse eller andre reparationsværktøjer"]
        }
      },
      {
        id: "gsec_fuger_vaadrum_safety",
        sectionType: "safety",
        sectionKey: "safety",
        position: 4,
        title: "Sikker og afgrænset egenkontrol",
        content: {
          warnings: [
            "Undgå at skære, skrabe eller trække i fuger som del af kontrollen.",
            "Vurder kun det, du kan se uden at afmontere sanitet, fliser eller andre bygningsdele.",
            "Stop og søg faglig rådgivning ved mistanke om fugt bag overfladen eller skade i konstruktionen."
          ]
        }
      },
      {
        id: "gsec_fuger_vaadrum_prepare",
        sectionType: "preparation",
        sectionKey: "preparation",
        position: 5,
        title: "Forberedelse",
        content: {
          checklist: [
            "Sørg for godt lys og tørre, synlige overflader.",
            "Start ved bruseniche og andre områder, der ofte udsættes for vand.",
            "Sammenlign om muligt med en intakt fuge et andet sted i rummet."
          ]
        }
      },
      {
        id: "gsec_fuger_vaadrum_step_1",
        sectionType: "step",
        sectionKey: "step_1_scan_surfaces",
        position: 6,
        title: "1. Gennemgå de synlige fuger",
        content: {
          instruction:
            "Se langs synlige fuger ved vægge, gulv og sanitet. Kig efter revner, manglende stykker, løse kanter eller markante farveændringer.",
          check: "Notér præcist, hvor du ser et forhold: område, fugetype og omfang."
        }
      },
      {
        id: "gsec_fuger_vaadrum_step_2",
        sectionType: "step",
        sectionKey: "step_2_check_corners",
        position: 7,
        title: "2. Kontrollér hjørner og overgange",
        content: {
          instruction:
            "Se særligt på hjørner, overgangen mellem gulv og væg og fuger omkring bruseniche, badekar, håndvask eller andet synligt sanitet.",
          check: "Der er ikke synlige åbninger, afbrudte fugelinjer eller tydelige skader i de vandudsatte overgange."
        }
      },
      {
        id: "gsec_fuger_vaadrum_step_3",
        sectionType: "step",
        sectionKey: "step_3_assess_discoloration",
        position: 8,
        title: "3. Vurder misfarvninger som observation",
        content: {
          instruction:
            "Læg mærke til nye eller udbredte misfarvninger, men undlad at konkludere årsag eller forsøge reparation. Tag eventuelt et billede til senere faglig vurdering.",
          check: "Observationen er dokumenteret uden at ændre på fugen eller overfladen."
        }
      },
      {
        id: "gsec_fuger_vaadrum_mistakes",
        sectionType: "common_mistakes",
        sectionKey: "common_mistakes",
        position: 9,
        title: "Typiske fejl og problemtegn",
        content: {
          items: [
            "At behandle en synlig misfarvning som bevis på en bestemt skade uden faglig vurdering.",
            "At skære i eller fjerne en fuge for at undersøge den nærmere.",
            "At overse overgangen mellem gulv og væg eller fuger lige ved brusenichen.",
            "At vente med opfølgning, hvis en revne, løs fuge eller misfarvning udvikler sig."
          ]
        }
      },
      {
        id: "gsec_fuger_vaadrum_complete",
        sectionType: "completion_check",
        sectionKey: "completion_check",
        position: 10,
        title: "Sådan ser en intakt synlig fuge ud",
        content: {
          checklist: [
            "Fugen fremstår sammenhængende uden synlige revner eller åbninger.",
            "Hjørner og overgange ser hele ud ved almindelig visuel kontrol.",
            "Der er ingen nye eller tydeligt udviklende problemtegn, som bør vurderes nærmere."
          ],
          limitation: "En intakt synlig fuge er ikke i sig selv dokumentation for hele vådrummets skjulte tæthed."
        }
      },
      {
        id: "gsec_fuger_vaadrum_help",
        sectionType: "professional_help",
        sectionKey: "professional_help",
        position: 11,
        title: "Hvornår skal du kontakte en fagperson?",
        content: {
          reasons: [
            "Du ser revner, åbninger, løse eller beskadigede fuger i vandudsatte områder.",
            "Misfarvninger er nye, udbredte, kommer igen eller ledsages af fugt, lugt eller anden mistanke om skade.",
            "Du er i tvivl om en fuge, overflade eller overgang er intakt.",
            "En vurdering vil kræve reparation, afmontering eller indgreb i vådrumskonstruktionen."
          ],
          suggestedProfessionals: ["Autoriseret VVS-installatør", "Fagperson med dokumenteret erfaring i vådrum"]
        }
      },
      {
        id: "gsec_fuger_vaadrum_visual_plan",
        sectionType: "custom",
        sectionKey: "visual_plan",
        position: 12,
        title: "Billed- og hotspotplan",
        content: {
          assetStatus: "planned_no_asset_file",
          referenceUniverse: "Matriva-huset",
          houseProfileAssessment: {
            value: "shared_default_expected",
            reason:
              "Egenkontrollen er primært den samme på tværs af byggeår. Der oprettes først profile-varianter, hvis godkendte referencebilleder viser en reel faglig eller visuel forskel."
          },
          images: [
            { key: "wetroom_overview", placement: "cover", altText: "Matriva-husets badeværelse med synlige vådrumsområder.", caption: "Start med et overblik over de synlige fuger.", description: "Oversigt over Matriva-husets badeværelse." },
            { key: "wetroom_shower", placement: "inline", altText: "Bruseniche med hjørnefuger og overgang mellem gulv og væg.", caption: "Se særligt på hjørner og overgange i brusenichen.", description: "Bruseniche med relevante kontrolpunkter." },
            { key: "wetroom_cracked_joint", placement: "step", altText: "Nærbillede af synlig revnet eller beskadiget fuge.", caption: "En synlig revne eller åbning bør følges op fagligt.", description: "Eksempel på revnet eller beskadiget synlig fuge." },
            { key: "wetroom_discoloration", placement: "step", altText: "Nærbillede af synlig misfarvning ved fuge.", caption: "Misfarvning er en observation, der kan kræve vurdering.", description: "Eksempel på misfarvning eller andet problemtegn." },
            { key: "wetroom_intact_joint", placement: "after", altText: "Nærbillede af intakt synlig fuge.", caption: "En intakt synlig fuge fremstår sammenhængende uden synlige åbninger.", description: "Eksempel på en intakt synlig fuge." }
          ],
          plannedHotspots: [
            { label: "Tjek hjørnefugen", type: "checkpoint", body: "Se efter sammenhængende fugelinjer i hjørner og overgange." },
            { label: "Se efter revner", type: "warning", body: "Synlige revner eller åbninger bør vurderes nærmere." },
            { label: "Kontrollér gulv/væg-overgangen", type: "checkpoint", body: "Vær ekstra opmærksom på synlige overgange i vandudsatte områder." },
            { label: "Se efter misfarvning", type: "tip", body: "Notér nye eller udviklende misfarvninger uden at konkludere årsag." }
          ],
          coordinatePolicy: "Hotspot-koordinater oprettes først, når det konkrete billede er godkendt."
        }
      },
      {
        id: "gsec_fuger_vaadrum_review_plan",
        sectionType: "custom",
        sectionKey: "review_plan",
        position: 14,
        title: "Faglig review før publicering",
        content: {
          validationStatus: "not_requested",
          requiredScopes: ["editorial", "technical", "safety", "visual"],
          scopeFocus: {
            editorial: "Klarhed om, at dette er en inspektionsguide og ikke en reparationsvejledning.",
            technical: "Faglig afgrænsning af synlige fuger og relevante observationspunkter.",
            safety: "Ingen risikable eller fagligt tvivlsomme instruktioner om vådrumstætning.",
            visual: "Referencebilleder af intakte og problematiske synlige fuger samt hotspotplaceringer."
          },
          publicationRule: "Ingen publicering før de nødvendige review-områder er godkendt af relevante fagpersoner."
        }
      },
      {
        id: "gsec_fuger_vaadrum_print_note",
        sectionType: "print_note",
        sectionKey: "print_note",
        position: 13,
        title: "Printnotat",
        content: {
          body: "Guiden er en visuel egenkontrol. Brug den ikke som instruktion til reparation eller tætning af vådrum."
        }
      }
    ],
    tags: [
      commonTags.maintenance,
      commonTags.visualInspection,
      { id: "gtag_vaadrum_area", tagKey: "vaadrum", label: "Vådrum", tagType: "house_part" },
      { id: "gtag_badevaerelse", tagKey: "badevaerelse", label: "Badeværelse", tagType: "house_part" },
      { id: "gtag_fuger_material", tagKey: "fuger", label: "Fuger", tagType: "material" },
      { id: "gtag_revner_problem", tagKey: "revner", label: "Revner", tagType: "problem" }
    ],
    searchTerms: [
      { id: "gterm_fuger_vaadrum_fuger", term: "fuger", termType: "keyword", weight: 10 },
      { id: "gterm_fuger_vaadrum_vaadrum", term: "vådrum", termType: "keyword", weight: 10 },
      { id: "gterm_fuger_vaadrum_badevaerelse", term: "badeværelse", termType: "synonym", weight: 9 },
      { id: "gterm_fuger_vaadrum_silikone", term: "silikonefuge", termType: "material", weight: 8 },
      { id: "gterm_fuger_vaadrum_revnet", term: "revnet fuge", termType: "problem", weight: 10 },
      { id: "gterm_fuger_vaadrum_misfarvet", term: "misfarvet fuge", termType: "problem", weight: 9 },
      { id: "gterm_fuger_vaadrum_bruse", term: "bruseniche", termType: "tag", weight: 8 }
    ],
    printMetadata: {
      printTitle: "Tjek fuger i vådrum",
      printSubtitle: "Matriva guide · kladde til faglig validering",
      footerText: "Matriva · Guideversion 1 · Visuel egenkontrol – ikke reparationsvejledning.",
      showHotspotLegend: true,
      sectionOrder: ["introduction", "why_it_matters", "overview", "tools_materials", "safety", "preparation", "step_1_scan_surfaces", "step_2_check_corners", "step_3_assess_discoloration", "common_mistakes", "completion_check", "professional_help", "visual_plan", "print_note"],
      renderOptions: { brandHeader: true, includeVersionFooter: true, imagePolicy: "render_when_assets_exist", safetyEmphasis: "high" }
    }
  }
];
