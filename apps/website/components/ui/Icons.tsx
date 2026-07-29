import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function HouseMark(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 41V20.5L24 7l16 13.5V41h-9V25l-7 7-7-7v16H8Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 13h15l4 5h19v22H5V13Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M5 21h38" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <rect
        x="6"
        y="10"
        width="36"
        height="32"
        rx="3"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M6 19h36M15 5v10M33 5v10"
        stroke="currentColor"
        strokeWidth="2.6"
      />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M24 5 40 11v11c0 10.5-6.4 17.2-16 21-9.6-3.8-16-10.5-16-21V11l16-6Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="m17 24 5 5 10-11"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <rect
        x="6"
        y="6"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <rect
        x="28"
        y="6"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <rect
        x="6"
        y="28"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <rect
        x="28"
        y="28"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2.6"
      />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M11 5h18l8 8v30H11V5Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M29 5v9h8M17 23h14M17 30h14M17 37h9"
        stroke="currentColor"
        strokeWidth="2.6"
      />
    </svg>
  );
}

export function ToolIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M30 8a10 10 0 0 0-12 12L6 32a5.7 5.7 0 0 0 8 8l12-12A10 10 0 0 0 38 16l-7 7-6-1-1-6 6-8Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 35h28l-4-6V19a10 10 0 0 0-20 0v10l-4 6Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M19 39a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <circle cx="18" cy="17" r="7" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="34" cy="19" r="5" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M5 42c0-8 5-13 13-13s13 5 13 13M29 31c7 0 12 4 12 11"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusHouseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 23 22 8l13 11v20H10V23"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle
        cx="36"
        cy="36"
        r="9"
        fill="var(--color-icon-background)"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M36 31v10M31 36h10"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="m15 24 6 6 13-15"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
