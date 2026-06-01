import axios from "axios";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

function api(token: string) {
  return axios.create({
    baseURL: GRAPH_BASE,
    params: { access_token: token },
  });
}

// ── Facebook ──────────────────────────────────────────────────────────────────

export async function publishFacebookPost(
  pageId: string,
  token: string,
  caption: string,
  mediaUrls: string[]
) {
  const client = api(token);

  if (mediaUrls.length === 0) {
    const { data } = await client.post(`/${pageId}/feed`, { message: caption });
    return data.id as string;
  }

  if (mediaUrls.length === 1) {
    const { data } = await client.post(`/${pageId}/photos`, {
      url: mediaUrls[0],
      caption,
    });
    return data.id as string;
  }

  // Carousel: upload each photo unpublished, then combine
  const photoIds = await Promise.all(
    mediaUrls.map(async (url) => {
      const { data } = await client.post(`/${pageId}/photos`, {
        url,
        published: false,
      });
      return { media_fbid: data.id };
    })
  );

  const { data } = await client.post(`/${pageId}/feed`, {
    message: caption,
    attached_media: photoIds,
  });
  return data.id as string;
}

export async function getFacebookPostInsights(
  postId: string,
  token: string
): Promise<MetricMap> {
  const metrics = [
    "post_impressions",
    "post_impressions_unique",
    "post_reactions_by_type_total",
    "post_clicks",
  ].join(",");

  const { data } = await api(token).get(`/${postId}/insights`, {
    params: { metric: metrics },
  });

  const map: MetricMap = {};
  for (const item of data.data as Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }>) {
    const val = item.values[0]?.value;
    if (typeof val === "number") {
      map[item.name] = val;
    } else if (typeof val === "object") {
      // reactions: sum all types
      map[item.name] = Object.values(val).reduce((a, b) => a + b, 0);
    }
  }
  return map;
}

// ── Instagram ─────────────────────────────────────────────────────────────────

export async function publishInstagramPost(
  igUserId: string,
  token: string,
  caption: string,
  mediaUrls: string[],
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL"
) {
  const client = api(token);

  if (mediaType === "CAROUSEL") {
    const containerIds = await Promise.all(
      mediaUrls.map(async (url) => {
        const { data } = await client.post(`/${igUserId}/media`, {
          image_url: url,
          is_carousel_item: true,
        });
        return data.id as string;
      })
    );

    const { data: carousel } = await client.post(`/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: containerIds.join(","),
      caption,
    });
    const { data: published } = await client.post(`/${igUserId}/media_publish`, {
      creation_id: carousel.id,
    });
    return published.id as string;
  }

  const isVideo = mediaType === "VIDEO" || mediaType === "REEL";
  const mediaPayload = isVideo
    ? { video_url: mediaUrls[0], media_type: mediaType, caption }
    : { image_url: mediaUrls[0], caption };

  const { data: container } = await client.post(`/${igUserId}/media`, mediaPayload);
  const { data: published } = await client.post(`/${igUserId}/media_publish`, {
    creation_id: container.id,
  });
  return published.id as string;
}

export async function getInstagramPostInsights(
  mediaId: string,
  token: string
): Promise<MetricMap> {
  const metrics = ["impressions", "reach", "likes", "comments", "shares", "saves"].join(",");
  const { data } = await api(token).get(`/${mediaId}/insights`, {
    params: { metric: metrics },
  });

  const map: MetricMap = {};
  for (const item of data.data as Array<{ name: string; values: Array<{ value: number }> }>) {
    map[item.name] = item.values[0]?.value ?? 0;
  }
  return map;
}

// ── OAuth helper ──────────────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: redirectUri,
      code,
    },
  });
  return data as { access_token: string; token_type: string };
}

export async function getLongLivedToken(shortToken: string) {
  const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  return data as { access_token: string; expires_in: number };
}

export async function getUserPages(userToken: string) {
  const { data } = await api(userToken).get("/me/accounts", {
    params: { fields: "id,name,access_token,instagram_business_account" },
  });
  return data.data as Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string };
  }>;
}

// ── Instagram monitoring ──────────────────────────────────────────────────────

export interface IgMediaItem {
  id: string;
  timestamp: string;       // ISO 8601
  media_type: string;
  permalink: string;
  caption?: string;
  thumbnail_url?: string;
  media_url?: string;
}

export async function getInstagramMediaForMonth(
  igUserId: string,
  token: string,
  year: number,
  month: number // 1-based
): Promise<IgMediaItem[]> {
  const since = new Date(year, month - 1, 1);
  const until = new Date(year, month, 1);

  const client = api(token);
  const items: IgMediaItem[] = [];
  let url = `/${igUserId}/media`;
  let params: Record<string, string | number> = {
    fields: "id,timestamp,media_type,permalink,caption,thumbnail_url,media_url",
    since: Math.floor(since.getTime() / 1000),
    until: Math.floor(until.getTime() / 1000),
    limit: 50,
  };

  // Paginate through all results
  while (url) {
    const { data } = await client.get(url, { params });
    items.push(...(data.data as IgMediaItem[]));
    url = data.paging?.next ? "" : ""; // stop after first page for month view
    params = {};
    break;
  }

  return items.filter((item) => {
    const d = new Date(item.timestamp);
    return d >= since && d < until;
  });
}

export async function getInstagramAccountInfo(igUserId: string, token: string) {
  const { data } = await api(token).get(`/${igUserId}`, {
    params: { fields: "id,username,profile_picture_url,followers_count,media_count" },
  });
  return data as {
    id: string;
    username: string;
    profile_picture_url?: string;
    followers_count: number;
    media_count: number;
  };
}

export async function getInstagramStoriesCount(igUserId: string, token: string): Promise<number> {
  try {
    const { data } = await api(token).get(`/${igUserId}/stories`, {
      params: { fields: "id" },
    });
    return (data.data as Array<{ id: string }>).length;
  } catch {
    return 0;
  }
}

type MetricMap = Record<string, number>;
