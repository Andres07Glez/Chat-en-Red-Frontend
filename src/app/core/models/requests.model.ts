export interface ContactRequest {
    id: number;
    otherUserId: number;
    otherDisplayName: string;
    otherAvatarUrl: string;
    statusLabel: string;
    statusCode: string;
    createdAt: string;
}