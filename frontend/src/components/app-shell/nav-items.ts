import {
  CalendarDaysIcon,
  CircleCheckBigIcon,
  HouseIcon,
  RepeatIcon,
  UserIcon,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Hoje", icon: HouseIcon },
  { href: "/tasks", label: "Tarefas", icon: CircleCheckBigIcon },
  { href: "/habits", label: "Hábitos", icon: RepeatIcon },
  { href: "/calendar", label: "Calendário", icon: CalendarDaysIcon },
  { href: "/profile", label: "Perfil", icon: UserIcon },
] as const;

/** "/" only matches itself; other items also match their sub-pages. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
