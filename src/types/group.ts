export type Group = {
    id: string;
    name: string;
    avatar_url: string | null;
    province: string | null;
    city: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
};

export type GroupMember = {
    group_id: string;
    user_id: string;
    role: 'admin' | 'member';
    joined_at: string;
};

export type GroupWithRole = Group & {
    role: 'admin' | 'member';
};

export type GroupMemberWithProfile = {
    user_id: string;
    role: 'admin' | 'member';
    joined_at: string;
    display_name: string;
    avatar_url: string | null;
};