export const PUBLIC_DATA_CODEBOOK_VERSION = "2026-07-19.v4";

export type CodebookKey =
  | "buildingUse"
  | "lifecycle"
  | "outerWallMaterial"
  | "roofMaterial"
  | "supplementaryOuterWallMaterial"
  | "heatingInstallation"
  | "heatingSource"
  | "supplementaryHeating"
  | "unitUse"
  | "unitHousingType"
  | "unitAreaSource"
  | "unitFlexHomePermission"
  | "unitAddressFunction"
  | "unitToilet"
  | "unitBath"
  | "unitKitchen"
  | "floorType"
  | "groundWaterSupply"
  | "groundSewer"
  | "propertyType";

export type PublicCodeValue = {
  code: string;
  label: string | null;
  known: boolean;
  codebookKey: CodebookKey;
  deprecated?: boolean;
};

type CodebookEntry = {
  label: string;
  deprecated?: boolean;
};

const buildingUse = {
  "110": { label: "Stuehus til landbrugsejendom" },
  "120": { label: "Fritliggende enfamiliehus" },
  "121": { label: "Sammenbygget enfamiliehus" },
  "122": { label: "Fritliggende enfamiliehus i tæt-lav bebyggelse" },
  "130": {
    label: "Række-, kæde-, eller dobbelthus (lodret adskillelse mellem enhederne).",
    deprecated: true
  },
  "131": { label: "Række-, kæde- og klyngehus" },
  "132": { label: "Dobbelthus" },
  "140": { label: "Etagebolig-bygning, flerfamiliehus eller to-familiehus" },
  "150": { label: "Kollegium" },
  "160": { label: "Boligbygning til døgninstitution" },
  "185": { label: "Anneks i tilknytning til helårsbolig." },
  "190": { label: "Anden bygning til helårsbeboelse" },
  "210": {
    label: "Bygning til erhvervsmæssig produktion vedrørende landbrug, gartneri, råstofudvinding o. lign",
    deprecated: true
  },
  "211": { label: "Stald til svin" },
  "212": { label: "Stald til kvæg, får mv." },
  "213": { label: "Stald til fjerkræ" },
  "214": { label: "Minkhal" },
  "215": { label: "Væksthus" },
  "216": { label: "Lade til foder, afgrøder mv." },
  "217": { label: "Maskinhus, garage mv." },
  "218": { label: "Lade til halm, hø mv." },
  "219": { label: "Anden bygning til landbrug mv." },
  "220": {
    label: "Bygning til erhvervsmæssig produktion vedrørende industri, håndværk m.v. (fabrik, værksted o.lign.)",
    deprecated: true
  },
  "221": { label: "Bygning til industri med integreret produktionsapparat" },
  "222": { label: "Bygning til industri uden integreret produktionsapparat" },
  "223": { label: "Værksted" },
  "229": { label: "Anden bygning til produktion" },
  "230": {
    label: "El-, gas-, vand- eller varmeværk, forbrændingsanstalt m.v.",
    deprecated: true
  },
  "231": { label: "Bygning til energiproduktion" },
  "232": { label: "Bygning til energidistribution" },
  "233": { label: "Bygning til vandforsyning" },
  "234": { label: "Bygning til håndtering af affald og spildevand" },
  "239": { label: "Anden bygning til energiproduktion og forsyning" },
  "290": {
    label: "Anden bygning til landbrug, industri etc.",
    deprecated: true
  },
  "310": {
    label: "Transport- og garageanlæg (fragtmandshal, lufthavnsbygning, banegårdsbygning, parkeringshus). Garage med plads til et eller to køretøjer registreres med anvendelseskode 910",
    deprecated: true
  },
  "311": { label: "Bygning til jernbane- og busdrift" },
  "312": { label: "Bygning til luftfart" },
  "313": { label: "Bygning til parkering- og transportanlæg" },
  "314": { label: "Bygning til parkering af flere end to køretøjer i tilknytning til boliger" },
  "315": { label: "Havneanlæg" },
  "319": { label: "Andet transportanlæg" },
  "320": {
    label: "Bygning til kontor, handel, lager, herunder offentlig administration",
    deprecated: true
  },
  "321": { label: "Bygning til kontor" },
  "322": { label: "Bygning til detailhandel" },
  "323": { label: "Bygning til lager" },
  "324": { label: "Butikscenter" },
  "325": { label: "Tankstation" },
  "329": { label: "Anden bygning til kontor, handel og lager" },
  "330": {
    label: "Bygning til hotel, restaurant, vaskeri, frisør og anden servicevirksomhed",
    deprecated: true
  },
  "331": { label: "Hotel, kro eller konferencecenter med overnatning" },
  "332": { label: "Bed & breakfast mv." },
  "333": { label: "Restaurant, café og konferencecenter uden overnatning" },
  "334": { label: "Privat servicevirksomhed som frisør, vaskeri, netcafé mv." },
  "339": { label: "Anden bygning til serviceerhverv" },
  "390": {
    label: "Anden bygning til transport, handel etc",
    deprecated: true
  },
  "410": {
    label: "Bygning til biograf, teater, erhvervsmæssig udstilling, bibliotek, museum, kirke o. lign.",
    deprecated: true
  },
  "411": { label: "Biograf, teater, koncertsted mv." },
  "412": { label: "Museum" },
  "413": { label: "Bibliotek" },
  "414": { label: "Kirke eller anden bygning til trosudøvelse for statsanerkendte trossamfund" },
  "415": { label: "Forsamlingshus" },
  "416": { label: "Forlystelsespark" },
  "419": { label: "Anden bygning til kulturelle formål" },
  "420": {
    label: "Bygning til undervisning og forskning (skole, gymnasium, forskningslabratorium o.lign.).",
    deprecated: true
  },
  "421": { label: "Grundskole" },
  "422": { label: "Universitet" },
  "429": { label: "Anden bygning til undervisning og forskning" },
  "430": {
    label: "Bygning til hospital, sygehjem, fødeklinik o. lign.",
    deprecated: true
  },
  "431": { label: "Hospital og sygehus" },
  "432": { label: "Hospice, behandlingshjem mv." },
  "433": { label: "Sundhedscenter, lægehus, fødeklinik mv." },
  "439": { label: "Anden bygning til sundhedsformål" },
  "440": {
    label: "Bygning til daginstitution",
    deprecated: true
  },
  "441": { label: "Daginstitution" },
  "442": { label: "Servicefunktion på døgninstitution" },
  "443": { label: "Kaserne" },
  "444": { label: "Fængsel, arresthus mv." },
  "449": { label: "Anden bygning til institutionsformål" },
  "451": { label: "Beskyttelsesrum" },
  "490": {
    label: "Bygning til anden institution, herunder kaserne, fængsel o. lign.",
    deprecated: true
  },
  "510": { label: "Sommerhus" },
  "520": {
    label: "Bygning til feriekoloni, vandrehjem o.lign. bortset fra sommerhus",
    deprecated: true
  },
  "521": { label: "Feriecenter, center til campingplads mv." },
  "522": { label: "Bygning med ferielejligheder til erhvervsmæssig udlejning" },
  "523": { label: "Bygning med ferielejligheder til eget brug" },
  "529": { label: "Anden bygning til ferieformål" },
  "530": {
    label: "Bygning i forbindelse med idrætsudøvelse (klubhus, idrætshal, svømmehal o. lign.)",
    deprecated: true
  },
  "531": { label: "Klubhus i forbindelse med fritid og idræt" },
  "532": { label: "Svømmehal" },
  "533": { label: "Idrætshal" },
  "534": { label: "Tribune i forbindelse med stadion" },
  "535": { label: "Bygning til træning og opstaldning af heste" },
  "539": { label: "Anden bygning til idrætformål" },
  "540": { label: "Kolonihavehus" },
  "585": { label: "Anneks i tilknytning til fritids- og sommerhus" },
  "590": { label: "Anden bygning til fritidsformål" },
  "910": { label: "Garage" },
  "920": { label: "Carport" },
  "930": { label: "Udhus" },
  "940": { label: "Drivhus" },
  "950": { label: "Fritliggende overdækning" },
  "960": { label: "Fritliggende udestue" },
  "970": { label: "Tiloversbleven landbrugsbygning" },
  "990": { label: "Faldefærdig bygning" },
  "999": { label: "Ukendt bygning" }
} satisfies Record<string, CodebookEntry>;

const lifecycle = {
  "1": { label: "Start" },
  "2": { label: "Projekteret" },
  "3": { label: "Under Opførelse" },
  "4": { label: "Sagsgrund" },
  "5": { label: "Oprettet" },
  "6": { label: "Opført" },
  "7": { label: "Gældende" },
  "8": { label: "Godkendt" },
  "9": { label: "Afsluttet" },
  "10": { label: "Historisk" },
  "11": { label: "Fejlregistreret" },
  "12": { label: "Midlertidig Afsluttet" },
  "13": { label: "Delvis Afsluttet" },
  "14": { label: "Henlagt" },
  "15": { label: "Modtaget" },
  "16": { label: "UnderBehandling" },
  "17": { label: "Fejl" },
  "18": { label: "Udført" },
  "19": { label: "Foreløbig" },
  "20": { label: "BomSagModtaget" },
  "21": { label: "BomSagUnderBehandling" },
  "22": { label: "BomSagFejl" },
  "23": { label: "BomSagUdført" }
} satisfies Record<string, CodebookEntry>;

const outerWallMaterial = {
  "1": { label: "Mursten" },
  "2": { label: "Letbetonsten" },
  "3": { label: "Fibercement herunder asbest" },
  "4": { label: "Bindingsværk" },
  "5": { label: "Træ" },
  "6": { label: "Betonelementer" },
  "8": { label: "Metal" },
  "10": { label: "Fibercement uden asbest" },
  "11": { label: "Plastmaterialer" },
  "12": { label: "Glas" },
  "80": { label: "Ingen" },
  "90": { label: "Andet materiale" }
} satisfies Record<string, CodebookEntry>;

const roofMaterial = {
  "1": { label: "Tagpap med lille hældning" },
  "2": { label: "Tagpap med stor hældning" },
  "3": { label: "Fibercement herunder asbest" },
  "4": { label: "Betontagsten" },
  "5": { label: "Tegl" },
  "6": { label: "Metal" },
  "7": { label: "Stråtag" },
  "10": { label: "Fibercement uden asbest" },
  "11": { label: "Plastmaterialer" },
  "12": { label: "Glas" },
  "20": { label: "Levende tage" },
  "80": {
    label: "Ingen",
    deprecated: true
  },
  "90": { label: "Andet materiale" }
} satisfies Record<string, CodebookEntry>;

const supplementaryOuterWallMaterial = {
  "1": { label: "Mursten" },
  "2": { label: "Letbetonsten" },
  "3": { label: "Fibercement herunder asbest" },
  "4": { label: "Bindingsværk" },
  "5": { label: "Træ" },
  "6": { label: "Betonelementer" },
  "8": { label: "Metal" },
  "10": { label: "Fibercement uden asbest" },
  "11": { label: "Plastmaterialer" },
  "12": { label: "Glas" },
  "80": { label: "Ingen" },
  "90": { label: "Andet materiale" }
} satisfies Record<string, CodebookEntry>;

const heatingInstallation = {
  "1": { label: "Fjernvarme/blokvarme" },
  "2": { label: "Centralvarme med én fyringsenhed" },
  "3": { label: "Ovn til fast og flydende brændsel" },
  "5": { label: "Varmepumpe" },
  "6": { label: "Centralvarme med to fyringsenheder" },
  "7": { label: "Elvarme" },
  "8": { label: "Gasradiator" },
  "9": { label: "Ingen varmeinstallation" },
  "99": { label: "Varmeinstallation er registreret på enheder" }
} satisfies Record<string, CodebookEntry>;

const heatingSource = {
  "1": { label: "Elektricitet" },
  "2": { label: "Gasværksgas" },
  "3": { label: "Flydende brændsel" },
  "4": { label: "Fast brændsel" },
  "6": { label: "Halm" },
  "7": { label: "Naturgas" },
  "9": { label: "Andet" }
} satisfies Record<string, CodebookEntry>;

const supplementaryHeating = {
  "0": { label: "Ikke oplyst" },
  "1": { label: "Varmepumpe" },
  "2": { label: "Brændeovne og lignende med skorsten" },
  "3": { label: "Biopejse og lignende uden skorsten" },
  "4": { label: "Solvarmeanlæg" },
  "5": { label: "Pejs" },
  "6": { label: "Gasradiator" },
  "7": { label: "Elvarme" },
  "10": { label: "Biogasanlæg" },
  "80": { label: "Andet" },
  "90": {
    label: "Bygningen har ingen supplerende varme",
    deprecated: true
  }
} satisfies Record<string, CodebookEntry>;

const unitUse = {
  "110": { label: "Stuehus til landbrugsejendom" },
  "120": { label: "Fritliggende enfamiliehus" },
  "121": { label: "Sammenbygget enfamiliehus" },
  "122": { label: "Fritliggende enfamiliehus i tæt-lav bebyggelse" },
  "130": {
    label: "Række-, kæde- eller dobbelthus (lodret adskillelse mellem enhederne).",
    deprecated: true
  },
  "131": { label: "Række-, kæde- og klyngehus" },
  "132": { label: "Dobbelthus" },
  "140": { label: "Bolig i etageejendom, flerfamiliehus eller to-familiehus" },
  "150": { label: "Kollegiebolig" },
  "160": { label: "Bolig i døgninstitution" },
  "185": { label: "Anneks i tilknytning til helårsbolig" },
  "190": { label: "Anden enhed til helårsbeboelse" },
  "210": {
    label: "Erhvervsmæssig produktion vedrørende landbrug, skovbrug, gartneri, råstofudvinding og lign.",
    deprecated: true
  },
  "211": { label: "Stald til svin" },
  "212": { label: "Stald til kvæg, får mv." },
  "213": { label: "Stald til fjerkræ" },
  "214": { label: "Minkhal" },
  "215": { label: "Væksthus" },
  "216": { label: "Lade til foder, afgrøder mv." },
  "217": { label: "Maskinhus, garage mv." },
  "218": { label: "Lade til halm, hø mv." },
  "219": { label: "Anden enhed til landbrug mv." },
  "220": {
    label: "Erhvervsmæssig produktion vedrørende industri, håndværk m.v. (fabrik, værksted o. lign.)",
    deprecated: true
  },
  "221": { label: "Enhed til industri med integreret produktionsapparat" },
  "222": { label: "Enhed til industri uden integreret produktionsapparat" },
  "223": { label: "Værksted" },
  "229": { label: "Anden enhed til produktion" },
  "230": {
    label: "El-, gas-, vand- eller varmeværk, forbrændingsanstalt o. lign.",
    deprecated: true
  },
  "231": { label: "Enhed til energiproduktion" },
  "232": { label: "Enhed til energidistribution" },
  "233": { label: "Enhed til vandforsyning" },
  "234": { label: "Enhed til håndtering af affald og spildevand" },
  "239": { label: "Anden enhed til energiproduktion og forsyning" },
  "290": {
    label: "Anden enhed til produktion og lager i forbindelse med landbrug, industri o. lign.",
    deprecated: true
  },
  "310": {
    label: "Transport- og garageanlæg (fragtmandshal, lufthavnsbygning,banegårdsbygning o. lign.)",
    deprecated: true
  },
  "311": { label: "Enhed til jernbane- og busdrift" },
  "312": { label: "Enhed til luftfart" },
  "313": { label: "Enhed til parkerings- og transportanlæg" },
  "314": { label: "Enhed til parkering af flere end to køretøjer i tilknytning til boliger" },
  "315": { label: "Havneanlæg" },
  "319": { label: "Andet transportanlæg" },
  "320": {
    label: "Engroshandel og lager.",
    deprecated: true
  },
  "321": { label: "Enhed til kontor" },
  "322": { label: "Enhed til detailhandel" },
  "323": { label: "Enhed til lager" },
  "324": { label: "Butikscenter" },
  "325": { label: "Tankstation" },
  "329": { label: "Anden enhed til kontor, handel og lager" },
  "330": {
    label: "Detailhandel m.v.",
    deprecated: true
  },
  "331": { label: "Hotel, kro eller konferencecenter med overnatning" },
  "332": { label: "Bed & breakfast mv." },
  "333": { label: "Restaurant, café og konferencecenter uden overnatning" },
  "334": { label: "Privat servicevirksomhed som frisør, vaskeri, netcafé mv." },
  "339": { label: "Anden enhed til serviceerhverv" },
  "340": {
    label: "Pengeinstitut, forsikringsvirksomhed m.v.",
    deprecated: true
  },
  "350": {
    label: "Kontor og liberale erhverv bortset fra offentlig administration (kontorer for advokater, rådgivende ingeniører, klinikker o.lign.)",
    deprecated: true
  },
  "360": {
    label: "Offentlig administration.",
    deprecated: true
  },
  "370": {
    label: "Hotel, restauration, vaskeri, frisør og anden servicevirksomhed.",
    deprecated: true
  },
  "390": {
    label: "Anden enhed til handel, transport etc.",
    deprecated: true
  },
  "410": {
    label: "Biograf, teater, erhvervsmæssig udstilling m.v.",
    deprecated: true
  },
  "411": { label: "Biograf, teater, koncertsted mv." },
  "412": { label: "Museum" },
  "413": { label: "Bibliotek" },
  "414": { label: "Kirke eller anden enhed til trosudøvelse for statsanerkendte trossamfund" },
  "415": { label: "Forsamlingshus" },
  "416": { label: "Forlystelsespark" },
  "419": { label: "Anden enhed til kulturelle formål" },
  "420": {
    label: "Bibliotek, museum, kirke o. lign.",
    deprecated: true
  },
  "421": { label: "Grundskole" },
  "422": { label: "Universitet" },
  "429": { label: "Anden enhed til undervisning og forskning" },
  "430": {
    label: "Undervisning og forskning (skole, gymnasium, forskningslaboratorium).",
    deprecated: true
  },
  "431": { label: "Hospital og sygehus" },
  "432": { label: "Hospice, behandlingshjem mv." },
  "433": { label: "Sundhedscenter, lægehus, fødeklinik mv." },
  "439": { label: "Anden enhed til sundhedsformål" },
  "440": {
    label: "Hospital, fødeklinik o. lign.",
    deprecated: true
  },
  "441": { label: "Daginstitution" },
  "442": { label: "Servicefunktion på døgninstitution" },
  "443": { label: "Kaserne" },
  "444": { label: "Fængsel, arresthus mv." },
  "449": { label: "Anden enhed til institutionsformål" },
  "450": {
    label: "Daginstitution.",
    deprecated: true
  },
  "451": { label: "Enhed til beskyttelsesrum" },
  "490": {
    label: "Anden institution, herunder kaserne, fængsel m.v.",
    deprecated: true
  },
  "510": { label: "Sommerhus." },
  "520": {
    label: "Enhed til feriekoloni, vandrehjem o.lign. bortset fra sommerhus",
    deprecated: true
  },
  "521": { label: "Feriecenter, center til campingplads mv." },
  "522": { label: "Ferielejlighed til erhvervsmæssig udlejning" },
  "523": { label: "Ferielejlighed til eget brug" },
  "529": { label: "Anden enhed til ferieformål" },
  "530": {
    label: "Enhed i forbindelse med idrætsudøvelse (klubhus, idrætshal, svømmehal o. lign.).",
    deprecated: true
  },
  "531": { label: "Klubhus i forbindelse med fritid- og idræt" },
  "532": { label: "Svømmehal" },
  "533": { label: "Idrætshal" },
  "534": { label: "Tribune i forbindelse med stadion" },
  "535": { label: "Enhed til træning og opstaldning af heste" },
  "539": { label: "Anden enhed til idrætsformål" },
  "540": { label: "Kolonihavehus" },
  "585": { label: "Anneks i tilknytning til fritids- og sommerhus" },
  "590": { label: "Anden enhed til fritidsformål" }
} satisfies Record<string, CodebookEntry>;

const unitHousingType = {
  "1": { label: "Egentlig beboelseslejlighed med eget køkken" },
  "2": { label: "Blandet bolig og erhverv med eget køkken" },
  "3": { label: "Enkeltværelse uden eget køkken" },
  "4": { label: "Fællesbolig" },
  "5": { label: "Sommer- eller fritidsbolig" },
  "E": { label: "Andet" }
} satisfies Record<string, CodebookEntry>;

const unitAreaSource = {
  "1": { label: "Oplyst af ejer eller dennes repræsentant" },
  "2": { label: "Oplyst af kommunen" },
  "3": { label: "Oplyst af andre" },
  "4": { label: "Maskinelt oprettet" },
  "5": { label: "Oplyst og kontrolleret af kommunen" }
} satisfies Record<string, CodebookEntry>;

const unitFlexHomePermission = {
  "1": { label: "Upersonlig tilladelse uden tidsbegrænsning" },
  "2": { label: "Personlig tilladelse uden tidsbegrænsning" },
  "3": { label: "Upersonlig tilladelse med tidsbegrænsing" },
  "4": { label: "Personlig tilladelse med tidsbegrænsing" }
} satisfies Record<string, CodebookEntry>;

const unitAddressFunction = {
  "0": { label: "Vis Enheder under Opgange" },
  "1": { label: "Vis Enheder under Etager" },
  "2": { label: "Vis Enheder under både Opgange og Etager" }
} satisfies Record<string, CodebookEntry>;

const unitToilet = {
  "A": { label: "Vandskyllende toilet uden for enheden" },
  "B": { label: "Intet vandskyllende toilet" },
  "T": { label: "Vandskyllende toilet i enheden" }
} satisfies Record<string, CodebookEntry>;

const unitBath = {
  "C": { label: "Adgang til badeværelse" },
  "D": { label: "Hverken badeværelse eller adgang til badeværelse" },
  "V": { label: "Badeværelse i enheden" }
} satisfies Record<string, CodebookEntry>;

const unitKitchen = {
  "E": { label: "Eget køkken med afløb" },
  "F": { label: "Adgang til fælles køkken" },
  "G": { label: "Fast kogeinstallation i værelse eller på gang" },
  "H": { label: "Ingen fast kogeinstallation" }
} satisfies Record<string, CodebookEntry>;

const floorType = {
  "0": { label: "Regulær etage" },
  "1": { label: "Tagetage" },
  "2": { label: "Kælder" }
} satisfies Record<string, CodebookEntry>;

const groundWaterSupply = {
  "1": { label: "Alment vandforsyningsanlæg" },
  "2": { label: "Privat vandforsyningsanlæg" },
  "3": { label: "Enkeltindvindingsanlæg" },
  "4": { label: "Brønd" },
  "6": { label: "Ikke alment vandforsyningsanlæg" },
  "7": { label: "Vandforsyning er registreret på bygninger" },
  "9": { label: "Ingen vandforsyning" }
} satisfies Record<string, CodebookEntry>;

const groundSewer = {
  "1": { label: "Fælleskloakeret: spildevand + tag- og overfladevand" },
  "2": { label: "Fælleskloakeret: spildevand + delvis tag- og overfladevand" },
  "3": { label: "Fælleskloakeret: spildevand" },
  "4": { label: "Fælleskloakeret: tag- og overfladevand" },
  "5": { label: "Separatkloakeret: spildevand + tag- og overfladevand" },
  "6": { label: "Separatkloakeret: spildevand + delvis tag- og overfladevand" },
  "7": { label: "Separatkloakeret: spildevand" },
  "8": { label: "Separatkloakeret: tag- og overfladevand" },
  "9": { label: "Spildevandskloakeret: Spildevand" },
  "10": { label: "Afløb til offentligt kloaksystem" },
  "11": { label: "Afløb til fællesprivat kloaksystem" },
  "12": { label: "Afløb til fællesprivat kloaksystem med tilslutning til spildevandsforsyningens kloaksystem" },
  "20": { label: "Afløb til samletank" },
  "21": { label: "Afløb til samletank for toiletvand og mekanisk rensning af øvrigt spildevand" },
  "29": { label: "Mekanisk rensning med nedsivningsanlæg med tilladelse" },
  "30": { label: "Mekanisk rensning med nedsivningsanlæg (tilladelse ikke påkrævet)" },
  "31": { label: "Mekanisk rensning med privat udledning direkte til vandløb, søer eller havet" },
  "32": { label: "Mekanisk og biologisk rensning (ældre anlæg uden renseklasse)" },
  "70": { label: "Udledning uden rensning direkte til vandløb, søer eller havet" },
  "75": { label: "Afløbsforhold er registreret på bygninger" },
  "80": { label: "Anden type afløb" },
  "90": { label: "Ingen udledning" },
  "101": { label: "SOP: Minirenseanlæg med direkte udledning" },
  "102": { label: "SOP: Minirenseanlæg med udledning til markdræn" },
  "103": { label: "SOP: Minirenseanlæg med nedsivning i faskine" },
  "104": { label: "SOP: Nedsivning til sivedræn" },
  "105": { label: "SOP: Samletank" },
  "106": { label: "SOP: Pileanlæg med nedsivning (uden membran)" },
  "107": { label: "SOP: Pileanlæg uden udledning (med membran)" },
  "108": { label: "SOP: Beplantede filteranlæg med nedsivning i faskine" },
  "109": { label: "SOP: Sandfiltre med P-fældning i bundfældningstanken og direkte udledning" },
  "110": { label: "SOP: Sandfiltre med P-fældning i bundfældningstanken og udledning til markdræn" },
  "190": { label: "SOP: Andet" },
  "201": { label: "SO: Biologisk sandfilter med direkte udledning" },
  "202": { label: "SO: Biologisk sandfilter med udledning til markdræn" },
  "203": { label: "SO: Minirensanlæg med direkte udledning" },
  "204": { label: "SO: Minirenseanlæg med udledning til markdræn" },
  "205": { label: "SO: Beplantede filteranlæg med direkte udledning" },
  "206": { label: "SO: Beplantede filteranlæg med udledning til markdræn" },
  "290": { label: "SO: Andet" },
  "301": { label: "OP: Minirenseanlæg med direkte udledning" },
  "302": { label: "OP: Minirenseanlæg med udledning til markdræn" },
  "390": { label: "OP: Andet" },
  "401": { label: "O: Rodzoneanlæg med direkte udledning" },
  "402": { label: "O: Rodzoneanlæg med udledning til markdræn" },
  "403": { label: "O: Minirenseanlæg med direkte udledning" },
  "404": { label: "O: Minirenseanlæg med udledning til markdræn" },
  "490": { label: "O: Andet" },
  "501": { label: "Øvrige renseløsninger: Mekanisk med direkte udledning" },
  "502": { label: "Øvrige renseløsninger: Mekanisk med udledning til markdræn" },
  "503": { label: "Øvrige renseløsninger: Ældre nedsivningsanlæg med nedsivning til sivebrønd" },
  "504": { label: "Udledning til jordoverfladen" },
  "505": { label: "Udledning urenset" },
  "590": { label: "Øvrige renseløsninger: Andet" },
  "601": { label: "Anden type afløb (større end 30 PE med egen udledning)" },
  "701": { label: "Intet afløb" }
} satisfies Record<string, CodebookEntry>;

const propertyType = {
  "1": { label: "Matrikuleret Areal" },
  "2": { label: "BPFG" },
  "3": { label: "Ejerlejlighed" }
} satisfies Record<string, CodebookEntry>;

export const codebooks: Record<CodebookKey, Record<string, CodebookEntry>> = {
  buildingUse,
  lifecycle,
  outerWallMaterial,
  roofMaterial,
  supplementaryOuterWallMaterial,
  heatingInstallation,
  heatingSource,
  supplementaryHeating,
  unitUse,
  unitHousingType,
  unitAreaSource,
  unitFlexHomePermission,
  unitAddressFunction,
  unitToilet,
  unitBath,
  unitKitchen,
  floorType,
  groundWaterSupply,
  groundSewer,
  propertyType
} satisfies Record<CodebookKey, Record<string, CodebookEntry>>;
export function normalizeExternalCode(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

export function lookupCode(
  codebookKey: CodebookKey,
  value: unknown
): PublicCodeValue | null {
  const code = normalizeExternalCode(value);

  if (code === null) {
    return null;
  }

  const entry = codebooks[codebookKey][code];

  return {
    code,
    label: entry?.label ?? null,
    known: Boolean(entry),
    codebookKey,
    ...(entry?.deprecated ? { deprecated: true } : {})
  };
}
