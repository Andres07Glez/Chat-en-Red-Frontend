
export interface UserMeData {
  id: number;
  username: string;
  email: string;
  createdAt: string;       // ISO string — ej: "2025-11-08T20:56:00"
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}


export interface UpdateProfileRequest {
  displayName: string;
  bio: string;
}