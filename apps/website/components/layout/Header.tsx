"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { HouseMark } from "@/components/ui/Icons";

const links = [
  ["Funktioner", "/#funktioner"],
  ["Sådan virker det", "/#saadan-virker-det"],
  ["Produktet", "/#produktet"],
  ["Om Matriva", "/om-matriva"],
  ["Kontakt", "/#kontakt"],
];

export function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <header className="header">
      <Container className="header__inner">
        <Link href="/" className="brand" aria-label="Matriva forside">
          <span className="brand__mark">
            <HouseMark width="36" height="36" />
          </span>
          <span>Matriva</span>
        </Link>

        <nav className="header__nav" aria-label="Primær navigation">
          {links.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <Button href="/#saadan-virker-det">Se hvordan Matriva virker</Button>

          <button
            className="header__menu-button"
            type="button"
            aria-label={open ? "Luk menu" : "Åbn menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav
          id="mobile-navigation"
          className="mobile-menu"
          data-open={open}
          aria-label="Mobilnavigation"
        >
          {links.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Button href="/#saadan-virker-det" onClick={() => setOpen(false)}>
            Se hvordan Matriva virker
          </Button>
        </nav>
      </Container>
    </header>
  );
}
