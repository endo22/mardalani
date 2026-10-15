import { SiteHeader } from "@/components/layout/site-header";
import { WishlistWorkspace } from "@/components/wishlist/wishlist-workspace";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wishlist",
  description:
    "Destinations saved locally in this browser for MARDALANI planning.",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <WishlistWorkspace />
      </main>
    </>
  );
}
