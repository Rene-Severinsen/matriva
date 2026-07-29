import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { HouseMark } from "@/components/ui/Icons";

export function Footer() {
  return (
    <footer className="footer" id="kontakt">
      <Container>
        <div className="footer__grid">
          <div className="footer__about">
            <Link
              href="/"
              className="brand"
              aria-label="Matriva – gå til forsiden"
            >
              <span className="brand__mark">
                <HouseMark width="34" height="34" />
              </span>
              <span>Matriva</span>
            </Link>

            <p className="footer__copy">
              Matriva hjælper boligejere med at samle dokumenter, planlægge
              vedligeholdelse og få det fulde overblik over deres hjem.
            </p>
          </div>

          <div className="footer__column">
            <h2>Genveje</h2>
            <Link href="/#funktioner">Funktioner</Link>
            <Link href="/#saadan-virker-det">Sådan virker det</Link>
            <Link href="/#produktet">Produktet</Link>
            <Link href="/om-matriva">Om Matriva</Link>
            <Link href="/#status">Status</Link>
          </div>

          <div className="footer__column">
            <h2>Kontakt</h2>
            <p>Har du spørgsmål til Matriva, er du velkommen til at skrive.</p>
            <a href="mailto:hej@matriva.dk">hej@matriva.dk</a>
          </div>
        </div>

        <div className="footer__bottom">
          © 2026 Matriva. Alle rettigheder forbeholdes.
        </div>
      </Container>
    </footer>
  );
}
