import { HeartIcon, HouseIcon, LayersIcon, ShirtIcon, SparklesIcon, UserRoundIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Desktop sidebar order. */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/home", label: "Today", icon: HouseIcon },
  { href: "/wardrobe", label: "Wardrobe", icon: ShirtIcon },
  { href: "/outfits", label: "Outfits", icon: LayersIcon },
  { href: "/try-on", label: "Try-On", icon: SparklesIcon },
  { href: "/saved-outfits", label: "Saved", icon: HeartIcon },
  { href: "/profile", label: "Profile", icon: UserRoundIcon },
];

/** Mobile bottom bar: Home / Wardrobe / Outfits / Try-On / Profile. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/home", label: "Today", icon: HouseIcon },
  { href: "/wardrobe", label: "Wardrobe", icon: ShirtIcon },
  { href: "/saved-outfits", label: "Saved", icon: HeartIcon },
  { href: "/try-on", label: "Try-On", icon: SparklesIcon },
  { href: "/profile", label: "Profile", icon: UserRoundIcon },
];
