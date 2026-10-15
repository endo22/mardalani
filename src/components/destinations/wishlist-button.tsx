"use client";

import { Button } from "@/components/ui/button";
import {
  getServerWishlistSnapshot,
  getWishlistSnapshot,
  subscribeWishlist,
  toggleWishlist,
  wishlistErrorMessage,
} from "@/lib/wishlist-storage";
import { Heart } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

interface WishlistButtonProps {
  slug: string;
  className?: string;
}

export function WishlistButton({ slug, className }: WishlistButtonProps) {
  const slugs = useSyncExternalStore(
    subscribeWishlist,
    getWishlistSnapshot,
    getServerWishlistSnapshot,
  );
  const saved = slugs.includes(slug);
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    const result = toggleWishlist(slug);
    if (!result.ok) {
      setError(wishlistErrorMessage(result.reason));
      return;
    }
    setError(null);
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={saved ? "primary" : "outline"}
        size="sm"
        data-testid={`wishlist-toggle-${slug}`}
        aria-pressed={saved}
        onClick={onToggle}
      >
        <Heart
          className="mr-1.5 h-4 w-4"
          aria-hidden
          fill={saved ? "currentColor" : "none"}
        />
        {saved ? "Saved to wishlist" : "Save to wishlist"}
      </Button>
      {error ? (
        <p
          className="mt-2 text-caption text-danger"
          role="alert"
          data-testid="wishlist-toggle-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
