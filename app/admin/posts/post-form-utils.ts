export type PostFormShape = {
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  coverUrl: string;
  content: string;
};

export function buildSlug(input: string) {
  const ascii = input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // 纯中文/无 ASCII 可用字符时，用时间戳生成唯一 slug
  return ascii || `post-${Date.now().toString(36)}`;
}

export function loadDraft<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function saveDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
