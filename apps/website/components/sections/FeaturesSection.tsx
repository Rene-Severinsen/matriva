import {
  BellIcon,
  DocumentIcon,
  GridIcon,
  ToolIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { Container } from "@/components/ui/Container";

const features = [
  {
    icon: GridIcon,
    title: "Overblik",
    copy: "Se status på dit hus og få et tydeligt overblik over alt det vigtige ét sted.",
  },
  {
    icon: DocumentIcon,
    title: "Dokumenter",
    copy: "Gem alle dine dokumenter sikkert og find dem nemt, når du har brug for dem.",
  },
  {
    icon: ToolIcon,
    title: "Vedligeholdelse",
    copy: "Få styr på opgaver og serviceeftersyn – så intet bliver glemt.",
  },
  {
    icon: BellIcon,
    title: "Påmindelser",
    copy: "Modtag beskeder, når det er tid til handling. Vi holder styr på deadlines.",
  },
  {
    icon: UsersIcon,
    title: "Deling",
    copy: "Del dit hus med familien eller håndværkere og giv den rette adgang.",
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
