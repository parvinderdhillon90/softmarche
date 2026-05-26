export type Platform = "FACEBOOK" | "INSTAGRAM";
export type PostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED";
export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL";

export interface Account {
  id: string;
  platform: Platform;
  pageId: string;
  pageName: string;
  tokenExpiresAt: string | null;
  instagramId: string | null;
}

export interface Analytics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  fetchedAt: string;
}

export interface Post {
  id: string;
  accountId: string;
  platform: Platform;
  status: PostStatus;
  caption: string;
  mediaUrls: string[];
  mediaType: MediaType;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  errorMsg: string | null;
  createdAt: string;
  account: { pageName: string; platform: Platform };
  analytics?: Analytics | null;
}
