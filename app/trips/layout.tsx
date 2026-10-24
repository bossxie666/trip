import "../budget-overrides.css";
import "../participant-presence.css";
import "../travel-journal-v12.css";

export default function TripsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    <link rel="preload" as="image" href="/assets/homepage-v3/mobile-shell.webp" media="(max-width: 680px)" fetchPriority="high" />
    <link rel="preload" as="image" href="/assets/homepage-v3/desktop-shell.webp" media="(min-width: 681px)" fetchPriority="high" />
    {children}
  </>;
}
