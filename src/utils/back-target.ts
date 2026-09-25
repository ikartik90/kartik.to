export interface BackTarget {
  href: string;
  label: string;
}

const INDEX: BackTarget = { href: "/", label: "index" };

export function getBackTarget(pathname: string): BackTarget | null {
  const isIndex = pathname.split("/").filter(Boolean).length === 0;
  return isIndex ? null : INDEX;
}
