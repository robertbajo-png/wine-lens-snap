let currentUserId: string | null = null;

export const setAuthContextUserId = (userId: string | null) => {
  currentUserId = userId;
};

export const getAuthContextUserId = (): string | null => currentUserId;
