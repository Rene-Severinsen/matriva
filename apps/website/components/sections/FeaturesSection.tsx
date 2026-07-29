import {
  BellIcon,
  CalendarIcon,
  GridIcon,
  ShieldIcon,
  ToolIcon,
} from "@/components/ui/Icons";
import { Container } from "@/components/ui/Container";

const features = [
  {
    icon: GridIcon,
    title: "Boligens overblik",
    copy: "Saml registrerede boligoplysninger og dine egne informationer i ét overskueligt udgangspunkt.",
  },
  {
    icon: ToolIcon,
    title: "Vedligeholdelsesopgaver",
    copy: "Opret opgaver, sæt deadlines og følg status på boligens løbende vedligeholdelse.",
  },
  {
    icon: ShieldIcon,
    title: "Matriva-anbefalinger",
    copy: "Få relevante forslag til vedligeholdelse med udgangspunkt i boligens registrerede oplysninger.",
  },
  {
    icon: CalendarIcon,
    title: "Historik og dokumentation",
    copy: "Registrér udført arbejde, datoer og noter, så boligens vedligeholdelseshistorik bevares.",
  },
  {
    icon: BellIcon,
    title: "Dokumenter og påmindelser",
    copy: "Saml boligpapirer, planlæg deadlines, og få påmindelser.",
  },
];

export function FeaturesSection() {
  return (
    <section className="features-section" id="funktioner">
      <Container>
        <header className="features-section__header">
          <h2 className="section-heading">Matriva giver dig overblik</h2>
        </header>

        <div className="feature-grid">
          {features.map(({ icon: Icon, title, copy }) => (
            <article className="feature-card" key={title}>
              <div className="icon-box">
                <Icon width="44" height="44" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
