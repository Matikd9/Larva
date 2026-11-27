export type AdminUserEntry = {
	id: string;
	username: string;
	role: string;
	createdAt: number;
	lastLoginAt: number | null;
	recipeCount: number;
	openInviteType: 'invite' | 'reset' | null;
	openInviteExpiresAt: number | null;
};

export type AdminInvite = {
	userId: string;
	inviteUrl: string;
	expiresAt: number;
	type: 'invite' | 'reset';
};
