import { ComponentType, forwardRef } from "react";
import {
  Compass,
  Scan,
  Sparkles,
  UserRound,
  Wine,
  type LucideProps,
} from "lucide-react";

const withStroke = (Component: ComponentType<LucideProps>) =>
  forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
    <Component ref={ref} strokeWidth={1.75} {...props} />
  ));

export const ForYouIcon = withStroke(Sparkles);
export const ExploreIcon = withStroke(Compass);
export const ScanIcon = withStroke(Scan);
export const MyWinesIcon = withStroke(Wine);
export const ProfileIcon = withStroke(UserRound);
