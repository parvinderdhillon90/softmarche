import { PostStatus, Platform } from "@/types";

const statusColors: Record<PostStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

const platformColors: Record<Platform, string> = {
  FACEBOOK: "bg-blue-600 text-white",
  INSTAGRAM: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${platformColors[platform]}`}>
      {platform.charAt(0) + platform.slice(1).toLowerCase()}
    </span>
  );
}
