import { getSupabaseClient } from './supabaseClient';
import type { Group, GroupMemberWithProfile, GroupWithRole } from '../types/group';

const GROUP_PHOTOS_BUCKET = 'group-photos';

async function getCurrentUserId(): Promise<string> {
    const supabase = getSupabaseClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!user) {
        throw new Error('No hay un usuario autenticado.');
    }

    return user.id;
}

const GROUP_SELECT = 'id, name, avatar_url, province, city, created_by, created_at, updated_at';

export async function getMyGroups(): Promise<GroupWithRole[]> {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
        .from('group_members')
        .select(
            `
            role,
            joined_at,
            group:groups!inner (
                ${GROUP_SELECT}
            )
        `,
        )
        .eq('user_id', userId);

    if (error) {
        throw error;
    }

    return (data ?? []).map((item: any) => ({
        ...item.group,
        role: item.role,
    }));
}

export async function createGroup(
    name: string,
    province?: string,
    city?: string,
    avatarUri?: string,
    avatarBase64?: string,
    contentType?: string,
): Promise<Group> {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    let avatar_url: string | null = null;

    if (avatarUri) {
        avatar_url = await uploadGroupPhoto(userId, avatarUri, contentType, avatarBase64);
    }

    // Call the security definer function that bypasses RLS
    const { data: groupId, error: rpcError } = await supabase.rpc('create_group', {
        group_name: name,
        group_province: province ?? null,
        group_city: city ?? null,
        group_avatar_url: avatar_url,
    });

    if (rpcError) {
        throw rpcError;
    }

    // Fetch the created group
    const { data, error } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .eq('id', groupId)
        .single<Group>();

    if (error) {
        throw error;
    }

    return data;
}

export async function joinGroup(groupId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    const { error } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: userId,
        role: 'member',
    });

    if (error) {
        throw error;
    }
}

export async function updateGroup(
    groupId: string,
    name?: string,
    avatarUri?: string,
    avatarBase64?: string,
    contentType?: string,
): Promise<Group> {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    const updates: Record<string, any> = {};

    if (name !== undefined) {
        updates.name = name;
    }

    if (avatarUri) {
        updates.avatar_url = await uploadGroupPhoto(userId, avatarUri, contentType, avatarBase64);
    }

    const { error: updateError } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId);

    if (updateError) {
        throw updateError;
    }

    const { data, error } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .eq('id', groupId)
        .single<Group>();

    if (error) {
        throw error;
    }

    return data;
}

async function getMyGroupIds(): Promise<string[]> {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

    if (error) {
        throw error;
    }

    return (data ?? []).map(row => row.group_id);
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberWithProfile[]> {
    const supabase = getSupabaseClient();

    // 1. Get all members of the group
    const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at')
        .eq('group_id', groupId);

    if (membersError) {
        throw membersError;
    }

    if (!members || members.length === 0) {
        return [];
    }

    // 2. Get profiles for those members
    const userIds = members.map(m => m.user_id);

    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

    if (profilesError) {
        throw profilesError;
    }

    // 3. Build a map of user_id -> profile
    const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const p of profiles ?? []) {
        profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
    }

    // 4. Combine members with their profiles
    return members.map(m => {
        const profile = profileMap.get(m.user_id);
        return {
            user_id: m.user_id,
            role: m.role as 'admin' | 'member',
            joined_at: m.joined_at,
            display_name: profile?.display_name ?? 'Usuario',
            avatar_url: profile?.avatar_url ?? null,
        };
    });
}

export async function getAvailableGroups(search?: string): Promise<Group[]> {
    const supabase = getSupabaseClient();
    const groupIds = await getMyGroupIds();

    let query = supabase
        .from('groups')
        .select(GROUP_SELECT);

    if (groupIds.length > 0) {
        query = query.not('id', 'in', `(${groupIds.join(',')})`);
    }

    query = query.limit(50);

    if (search && search.trim().length > 0) {
        query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data ?? [];
}

export async function searchGroupsByName(search: string): Promise<Group[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .ilike('name', `%${search}%`)
        .limit(20);

    if (error) {
        throw error;
    }

    return data ?? [];
}

export async function searchGroupsByLocation(
    province?: string,
    city?: string,
): Promise<Group[]> {
    const supabase = getSupabaseClient();
    const groupIds = await getMyGroupIds();

    let query = supabase
        .from('groups')
        .select(GROUP_SELECT);

    if (groupIds.length > 0) {
        query = query.not('id', 'in', `(${groupIds.join(',')})`);
    }

    query = query.limit(20);

    if (province) {
        query = query.eq('province', province);
    }

    if (city) {
        query = query.eq('city', city);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data ?? [];
}

function getExtension(contentType?: string, uri?: string): string {
    if (contentType?.includes('png')) {
        return 'png';
    }

    if (contentType?.includes('webp')) {
        return 'webp';
    }

    const uriExtension = uri?.split('.').pop()?.split('?')[0]?.toLowerCase();

    if (uriExtension && ['jpg', 'jpeg', 'png', 'webp'].includes(uriExtension)) {
        return uriExtension === 'jpeg' ? 'jpg' : uriExtension;
    }

    return 'jpg';
}

async function uploadGroupPhoto(
    userId: string,
    uri: string,
    contentType?: string,
    base64?: string,
): Promise<string> {
    const supabase = getSupabaseClient();
    const extension = getExtension(contentType, uri);
    const filePath = `${userId}/group-${Date.now()}.${extension}`;

    let file: ArrayBuffer | Blob;

    if (base64) {
        const response = await fetch(
            `data:${contentType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`};base64,${base64}`,
        );
        file = await response.blob();
    } else {
        const response = await fetch(uri);
        file = await response.blob();
    }

    const { error } = await supabase.storage
        .from(GROUP_PHOTOS_BUCKET)
        .upload(filePath, file, {
            contentType:
                contentType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`,
            upsert: true,
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage
        .from(GROUP_PHOTOS_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
}