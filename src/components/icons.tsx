// Ícones de traço simples (sem ilustração) — cada um um <svg> 24×24.
import type { SVGProps } from "react";

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}
export function IconFolder(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h5l2 2h9v10H4V6z" />
    </svg>
  );
}
export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M15 17l5-5-5-5M20 12H9M12 4H5v16h7" />
    </svg>
  );
}
export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
export function IconAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l10 18H2L12 3zM12 10v4M12 17.5v.01" />
    </svg>
  );
}
export function IconUpload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </svg>
  );
}
export function IconGraph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7.6 7.6L16.4 6M6 8.2L11 16M18 8.2L13 16" />
    </svg>
  );
}
export function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12l16-8-6 16-2-7-8-1z" />
    </svg>
  );
}
