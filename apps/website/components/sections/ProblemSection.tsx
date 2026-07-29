import { CalendarIcon, FolderIcon, ShieldIcon } from "@/components/ui/Icons";
import { Container } from "@/components/ui/Container";

const items = [
  {
    icon: FolderIcon,
    title: "Dokumenter overalt",
    copy: "Vigtige papirer ligger spredt i mapper, skyer og e-mails. Tidskrævende at finde, når du har brug for dem.",
  },
  {
    icon: CalendarIcon,
    title: "Glemmer vedligeholdelse",
    copy: "Travl hverdag gør det nemt at glemme små ting – som kan blive dyre, hvis de ikke bliver gjort i tide.",
  },
  {
    icon: ShieldIcon,
    title: "Overblik mangler",
    copy: "Hvad er husets stand? Hvad skal laves hvornår? Det er svært at danne sig det fulde billede.",
  },
];

export function ProblemSection() {
  return (
    <section className="problem-section">
      <Container>
        <h2 className="problem-section__title">Kender du det?</h2>

        <div className="problem-grid">
          {items.map(({ icon: Icon, title, copy }) => (
            <article className="problem-card" key={title}>
              <div className="icon-box">
                <Icon width="45" height="45" />
              </div>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
