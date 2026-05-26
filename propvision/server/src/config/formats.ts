export interface FormatPreset {
  key: string;
  label: string;
  category: "social" | "listing" | "print";
  width: number;
  height: number;
  dpi?: number;
}

export const FORMAT_PRESETS: Record<string, FormatPreset> = {
  instagram_post: { key: "instagram_post", label: "Instagram Post (1:1)", category: "social", width: 1080, height: 1080 },
  instagram_story: { key: "instagram_story", label: "Instagram Story (9:16)", category: "social", width: 1080, height: 1920 },
  facebook_post: { key: "facebook_post", label: "Facebook Post", category: "social", width: 1200, height: 630 },
  facebook_cover: { key: "facebook_cover", label: "Facebook Cover", category: "social", width: 820, height: 312 },
  twitter_post: { key: "twitter_post", label: "Twitter / X Post", category: "social", width: 1200, height: 675 },
  linkedin_post: { key: "linkedin_post", label: "LinkedIn Post", category: "social", width: 1200, height: 627 },
  pinterest_pin: { key: "pinterest_pin", label: "Pinterest Pin (2:3)", category: "social", width: 1000, height: 1500 },
  mls_listing: { key: "mls_listing", label: "MLS Listing (4:3)", category: "listing", width: 2048, height: 1536 },
  zillow_realtor: { key: "zillow_realtor", label: "Zillow / Realtor", category: "listing", width: 2048, height: 1536 },
  print_flyer: { key: "print_flyer", label: "Print Flyer (Letter)", category: "print", width: 2550, height: 3300, dpi: 300 },
  print_postcard: { key: "print_postcard", label: "Print Postcard 6x4", category: "print", width: 1800, height: 1200, dpi: 300 },
  email_header: { key: "email_header", label: "Email Header", category: "social", width: 600, height: 200 },
};
