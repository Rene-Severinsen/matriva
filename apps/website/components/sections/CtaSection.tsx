import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

export function CtaSection() {
  return (
    <section className="cta-section" id="status">
      <Container>
        <div className="cta-band">
          <div className="cta-band__mark">
            <Image
              src="/brand/matriva-app-icon.svg"
              alt=""
              width={72}
              height={72}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2>Matriva er under udvikling</h2>
            <p>
              Vi bygger et samlet boligoverblik med vedligeholdelsesopgaver,
              historik og dokumentation. Appen er endnu ikke lanceret.
            </p>
          </div>

          <Button href="mailto:hej@matriva.dk">Kontakt Matriva</Button>
        </div>
      </Container>
    </section>
  );
}
