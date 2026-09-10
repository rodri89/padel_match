import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';

import { ARGENTINA_LOCATIONS } from '../../data/argentinaLocations';
import {
    createGroup,
    getAvailableGroups,
    getGroupMembers,
    getMyGroups,
    joinGroup,
    updateGroup,
} from '../../services/groupService';
import type { Group, GroupMemberWithProfile, GroupWithRole } from '../../types/group';
import { showSnackbar, SnackbarHost } from '../../components/SnackbarProvider';

const PROVINCES = Object.keys(ARGENTINA_LOCATIONS).sort();

// ---------- Location Picker Modal ----------

type PickerModalProps = {
    items: string[];
    selected: string | null;
    title: string;
    visible: boolean;
    onSelect: (item: string | null) => void;
    onClose: () => void;
};

function PickerModal({
    items,
    selected,
    title,
    visible,
    onSelect,
    onClose,
}: PickerModalProps) {
    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            transparent
            visible={visible}>
            <View style={styles.pickerModalBackdrop}>
                <Pressable
                    accessibilityLabel="Cerrar"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.pickerModalContent}>
                    <View style={styles.pickerModalHeader}>
                        <Text style={styles.pickerModalTitle}>{title}</Text>
                        <Pressable
                            accessibilityLabel="Cerrar"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={styles.pickerModalCloseButton}>
                            <Icon name="close-outline" color="#e2e8f0" size={24} />
                        </Pressable>
                    </View>
                    <ScrollView style={styles.pickerModalList}>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => onSelect(null)}
                            style={({ pressed }) => [
                                styles.pickerModalItem,
                                pressed && styles.pickerModalItemPressed,
                            ]}>
                            <Text style={styles.pickerModalItemText}>
                                -- Sin selección --
                            </Text>
                        </Pressable>
                        {items.map(item => (
                            <Pressable
                                key={item}
                                accessibilityRole="button"
                                onPress={() => onSelect(item)}
                                style={({ pressed }) => [
                                    styles.pickerModalItem,
                                    item === selected && styles.pickerModalItemActive,
                                    pressed && styles.pickerModalItemPressed,
                                ]}>
                                <Text
                                    style={[
                                        styles.pickerModalItemText,
                                        item === selected && styles.pickerModalItemTextActive,
                                    ]}>
                                    {item}
                                </Text>
                                {item === selected && (
                                    <Icon
                                        name="checkmark-outline"
                                        color="#9fb629"
                                        size={20}
                                    />
                                )}
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                <SnackbarHost />
            </View>
        </Modal>
    );
}

// ---------- LocationPicker ----------

type LocationPickerProps = {
    province: string | null;
    city: string | null;
    onProvinceChange: (province: string | null) => void;
    onCityChange: (city: string | null) => void;
};

function LocationPicker({
    province,
    city,
    onProvinceChange,
    onCityChange,
}: LocationPickerProps) {
    const [showProvincePicker, setShowProvincePicker] = useState(false);
    const [showCityPicker, setShowCityPicker] = useState(false);

    const cities = useMemo(
        () => (province ? ARGENTINA_LOCATIONS[province] ?? [] : []),
        [province],
    );

    const provinceLabel = province ?? 'Provincia';
    const cityLabel = city ?? 'Ciudad';

    return (
        <View>
            <View style={styles.pickerRow}>
                <Pressable
                    accessibilityLabel="Seleccionar provincia"
                    accessibilityRole="button"
                    onPress={() => setShowProvincePicker(true)}
                    style={({ pressed }) => [
                        styles.pickerChip,
                        province ? styles.pickerChipActive : null,
                        pressed && styles.pickerChipPressed,
                    ]}>
                    <Icon
                        name="location-outline"
                        color={province ? '#9fb629' : '#6b7280'}
                        size={16}
                    />
                    <Text
                        numberOfLines={1}
                        style={
                            province
                                ? styles.pickerChipTextActive
                                : styles.pickerChipText
                        }>
                        {provinceLabel}
                    </Text>
                    {province && (
                        <Pressable
                            accessibilityLabel="Quitar provincia"
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={() => {
                                onProvinceChange(null);
                                onCityChange(null);
                            }}>
                            <Icon name="close-circle" color="#6b7280" size={16} />
                        </Pressable>
                    )}
                </Pressable>
                {province && cities.length > 0 && (
                    <Pressable
                        accessibilityLabel="Seleccionar ciudad"
                        accessibilityRole="button"
                        onPress={() => setShowCityPicker(true)}
                        style={({ pressed }) => [
                            styles.pickerChip,
                            city ? styles.pickerChipActive : null,
                            pressed && styles.pickerChipPressed,
                        ]}>
                        <Icon
                            name="pin-outline"
                            color={city ? '#9fb629' : '#6b7280'}
                            size={16}
                        />
                        <Text
                            numberOfLines={1}
                            style={
                                city
                                    ? styles.pickerChipTextActive
                                    : styles.pickerChipText
                            }>
                            {cityLabel}
                        </Text>
                        {city && (
                            <Pressable
                                accessibilityLabel="Quitar ciudad"
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={() => onCityChange(null)}>
                                <Icon
                                    name="close-circle"
                                    color="#6b7280"
                                    size={16}
                                />
                            </Pressable>
                        )}
                    </Pressable>
                )}
            </View>
            <PickerModal
                items={PROVINCES}
                selected={province}
                title="Seleccionar provincia"
                visible={showProvincePicker}
                onSelect={item => {
                    onProvinceChange(item);
                    onCityChange(null);
                    setShowProvincePicker(false);
                }}
                onClose={() => setShowProvincePicker(false)}
            />
            <PickerModal
                items={cities}
                selected={city}
                title="Seleccionar ciudad"
                visible={showCityPicker}
                onSelect={item => {
                    onCityChange(item);
                    setShowCityPicker(false);
                }}
                onClose={() => setShowCityPicker(false)}
            />
        </View>
    );
}

// ---------- EditGroupModal ----------

type EditGroupModalProps = {
    visible: boolean;
    group: GroupWithRole | null;
    onClose: () => void;
    onSaved: () => void;
};

function EditGroupModal({ visible, group, onClose, onSaved }: EditGroupModalProps) {
    const [name, setName] = useState('');
    const [localPhoto, setLocalPhoto] = useState<{
        base64?: string;
        type?: string;
        uri: string;
    } | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (group) {
            setName(group.name);
            setLocalPhoto(null);
        }
    }, [group]);

    async function handlePickPhoto() {
        const result = await launchImageLibrary({
            includeBase64: true,
            mediaType: 'photo',
            quality: 0.8,
            selectionLimit: 1,
        });

        if (result.didCancel) {
            return;
        }

        if (result.errorMessage) {
            showSnackbar(result.errorMessage, 'error');
            return;
        }

        const asset = result.assets?.[0];

        if (!asset?.uri) {
            showSnackbar('No se pudo obtener la foto seleccionada.', 'error');
            return;
        }

        setLocalPhoto({
            base64: asset.base64,
            type: asset.type,
            uri: asset.uri,
        });
    }

    async function handleSave() {
        const trimmed = name.trim();
        if (!trimmed) {
            showSnackbar('El nombre del grupo es obligatorio.', 'error');
            return;
        }

        if (!group) {
            return;
        }

        try {
            setSaving(true);
            await updateGroup(
                group.id,
                trimmed,
                localPhoto?.uri,
                localPhoto?.base64,
                localPhoto?.type,
            );
            showSnackbar('Grupo actualizado correctamente.', 'success');
            setLocalPhoto(null);
            onClose();
            onSaved();
        } catch (err: any) {
            showSnackbar(err.message ?? 'Error al actualizar el grupo', 'error');
        } finally {
            setSaving(false);
        }
    }

    function handleCancel() {
        setLocalPhoto(null);
        onClose();
    }

    const photoUri = localPhoto?.uri ?? group?.avatar_url;

    return (
        <Modal
            animationType="fade"
            onRequestClose={handleCancel}
            statusBarTranslucent
            transparent
            visible={visible}>
            <View style={styles.modalBackdrop}>
                <Pressable
                    accessibilityLabel="Cerrar"
                    accessibilityRole="button"
                    onPress={handleCancel}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Editar grupo</Text>

                    {/* Photo */}
                    <View style={styles.editPhotoSection}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.editAvatar} />
                        ) : (
                            <View style={[styles.editAvatar, styles.editAvatarPlaceholder]}>
                                <Icon name="people-outline" color="#6b7280" size={32} />
                            </View>
                        )}
                        <Pressable
                            accessibilityLabel="Cambiar foto"
                            accessibilityRole="button"
                            onPress={handlePickPhoto}
                            style={({ pressed }) => [
                                styles.editPhotoButton,
                                pressed && styles.pickerChipPressed,
                            ]}>
                            <Icon name="camera-outline" color="#9fb629" size={18} />
                            <Text style={styles.editPhotoButtonText}>
                                {photoUri ? 'Cambiar foto' : 'Agregar foto'}
                            </Text>
                        </Pressable>
                    </View>

                    <TextInput
                        placeholder="Nombre del grupo"
                        placeholderTextColor="#6b7280"
                        style={styles.modalInput}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        maxLength={50}
                    />

                    <View style={styles.modalActions}>
                        <Pressable
                            accessibilityLabel="Cancelar"
                            accessibilityRole="button"
                            onPress={handleCancel}
                            style={({ pressed }) => [
                                styles.modalButton,
                                styles.modalButtonCancel,
                                pressed && styles.modalButtonPressed,
                            ]}>
                            <Text style={styles.modalButtonCancelText}>
                                Cancelar
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityLabel="Guardar"
                            accessibilityRole="button"
                            disabled={saving || name.trim().length === 0}
                            onPress={handleSave}
                            style={({ pressed }) => [
                                styles.modalButton,
                                styles.modalButtonPrimary,
                                (saving || name.trim().length === 0) &&
                                styles.modalButtonDisabled,
                                pressed && styles.modalButtonPressed,
                            ]}>
                            {saving ? (
                                <ActivityIndicator color="#1e1f20" size="small" />
                            ) : null}
                            <Text style={styles.modalButtonPrimaryText}>
                                {saving ? 'Guardando...' : 'Guardar'}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <SnackbarHost />
            </View>
        </Modal>
    );
}

// ---------- GroupCard ----------

type GroupCardProps = {
    group: GroupWithRole;
    onPress?: (group: GroupWithRole) => void;
};

function GroupCard({ group, onPress }: GroupCardProps) {
    const locationParts = [group.city, group.province].filter(Boolean);
    const locationText = locationParts.length > 0 ? locationParts.join(', ') : null;

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => onPress?.(group)}
            style={({ pressed }) => [
                styles.groupCard,
                pressed && onPress && styles.groupCardPressed,
            ]}>
            {group.avatar_url ? (
                <Image
                    source={{ uri: group.avatar_url }}
                    style={styles.groupAvatar}
                />
            ) : (
                <View style={[styles.groupAvatar, styles.groupAvatarPlaceholder]}>
                    <Icon name="people-outline" color="#6b7280" size={24} />
                </View>
            )}
            <View style={styles.groupInfo}>
                <Text style={styles.groupName} numberOfLines={1}>
                    {group.name}
                </Text>
                {locationText && (
                    <Text style={styles.groupLocation} numberOfLines={1}>
                        <Icon name="location-outline" color="#6b7280" size={12} />
                        {' '}{locationText}
                    </Text>
                )}
                <Text style={styles.groupRole}>
                    {group.role === 'admin' ? 'Admin' : 'Miembro'}
                </Text>
            </View>
        </Pressable>
    );
}

// ---------- CreateGroupModal ----------

type CreateGroupModalProps = {
    visible: boolean;
    onClose: () => void;
    onCreated: () => void;
};

function CreateGroupModal({ visible, onClose, onCreated }: CreateGroupModalProps) {
    const [name, setName] = useState('');
    const [province, setProvince] = useState<string | null>(null);
    const [city, setCity] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function handleCreate() {
        const trimmed = name.trim();
        if (!trimmed) {
            showSnackbar('El nombre del grupo es obligatorio.', 'error');
            return;
        }

        try {
            setSaving(true);
            await createGroup(trimmed, province ?? undefined, city ?? undefined);
            showSnackbar('Grupo creado correctamente.', 'success');
            setName('');
            setProvince(null);
            setCity(null);
            onClose();
            onCreated();
        } catch (err: any) {
            showSnackbar(err.message ?? 'Error al crear el grupo', 'error');
        } finally {
            setSaving(false);
        }
    }

    function handleCancel() {
        setName('');
        setProvince(null);
        setCity(null);
        onClose();
    }

    return (
        <Modal
            animationType="fade"
            onRequestClose={handleCancel}
            statusBarTranslucent
            transparent
            visible={visible}>
            <View style={styles.modalBackdrop}>
                <Pressable
                    accessibilityLabel="Cerrar"
                    accessibilityRole="button"
                    onPress={handleCancel}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Crear grupo</Text>
                    <TextInput
                        placeholder="Nombre del grupo"
                        placeholderTextColor="#6b7280"
                        style={styles.modalInput}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        maxLength={50}
                    />
                    <Text style={styles.modalLabel}>Ubicación (opcional)</Text>
                    <LocationPicker
                        province={province}
                        city={city}
                        onProvinceChange={setProvince}
                        onCityChange={setCity}
                    />
                    <View style={styles.modalActions}>
                        <Pressable
                            accessibilityLabel="Cancelar"
                            accessibilityRole="button"
                            onPress={handleCancel}
                            style={({ pressed }) => [
                                styles.modalButton,
                                styles.modalButtonCancel,
                                pressed && styles.modalButtonPressed,
                            ]}>
                            <Text style={styles.modalButtonCancelText}>
                                Cancelar
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityLabel="Crear grupo"
                            accessibilityRole="button"
                            disabled={saving || name.trim().length === 0}
                            onPress={handleCreate}
                            style={({ pressed }) => [
                                styles.modalButton,
                                styles.modalButtonPrimary,
                                (saving || name.trim().length === 0) &&
                                styles.modalButtonDisabled,
                                pressed && styles.modalButtonPressed,
                            ]}>
                            {saving ? (
                                <ActivityIndicator color="#1e1f20" size="small" />
                            ) : null}
                            <Text style={styles.modalButtonPrimaryText}>
                                {saving ? 'Creando...' : 'Crear'}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <SnackbarHost />
            </View>
        </Modal>
    );
}

// ---------- GroupMembersModal ----------

type GroupMembersModalProps = {
    visible: boolean;
    group: GroupWithRole | null;
    onClose: () => void;
    onEdit: (group: GroupWithRole) => void;
};

function GroupMembersModal({ visible, group, onClose, onEdit }: GroupMembersModalProps) {
    const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    useEffect(() => {
        if (visible && group) {
            loadMembers(group.id);
        }
    }, [visible, group]);

    async function loadMembers(groupId: string) {
        try {
            setLoadingMembers(true);
            const result = await getGroupMembers(groupId);
            setMembers(result);
        } catch (err: any) {
            showSnackbar(err.message ?? 'Error al cargar miembros', 'error');
        } finally {
            setLoadingMembers(false);
        }
    }

    return (
        <Modal
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            transparent
            visible={visible}>
            <View style={styles.membersModalBackdrop}>
                <Pressable
                    accessibilityLabel="Cerrar"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.membersModalContent}>
                    {/* Header */}
                    <View style={styles.membersModalHeader}>
                        <View style={styles.membersModalHeaderInfo}>
                            {group?.avatar_url ? (
                                <Image
                                    source={{ uri: group.avatar_url }}
                                    style={styles.membersModalAvatar}
                                />
                            ) : (
                                <View style={[styles.membersModalAvatar, styles.membersModalAvatarPlaceholder]}>
                                    <Icon name="people-outline" color="#6b7280" size={24} />
                                </View>
                            )}
                            <View style={styles.membersModalHeaderText}>
                                <Text style={styles.membersModalTitle} numberOfLines={1}>
                                    {group?.name ?? ''}
                                </Text>
                                <Text style={styles.membersModalCount}>
                                    {members.length} miembro{members.length !== 1 ? 's' : ''}
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            accessibilityLabel="Editar grupo"
                            accessibilityRole="button"
                            onPress={() => {
                                if (group) {
                                    onClose();
                                    onEdit(group);
                                }
                            }}
                            style={({ pressed }) => [
                                styles.membersModalEditButton,
                                pressed && styles.membersModalEditButtonPressed,
                            ]}>
                            <Icon name="create-outline" color="#9fb629" size={18} />
                            <Text style={styles.membersModalEditText}>Editar</Text>
                        </Pressable>
                    </View>

                    {/* Members list */}
                    {loadingMembers ? (
                        <ActivityIndicator
                            color="#9fb629"
                            size="large"
                            style={styles.membersModalLoader}
                        />
                    ) : (
                        <FlatList
                            data={members}
                            keyExtractor={item => item.user_id}
                            contentContainerStyle={styles.membersModalList}
                            renderItem={({ item }) => (
                                <View style={styles.membersModalItem}>
                                    {item.avatar_url ? (
                                        <Image
                                            source={{ uri: item.avatar_url }}
                                            style={styles.membersModalItemAvatar}
                                        />
                                    ) : (
                                        <View style={[styles.membersModalItemAvatar, styles.membersModalItemAvatarPlaceholder]}>
                                            <Icon name="person-outline" color="#6b7280" size={18} />
                                        </View>
                                    )}
                                    <View style={styles.membersModalItemInfo}>
                                        <Text style={styles.membersModalItemName} numberOfLines={1}>
                                            {item.display_name}
                                        </Text>
                                        <Text style={styles.membersModalItemRole}>
                                            {item.role === 'admin' ? 'Admin' : 'Miembro'}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        />
                    )}

                    {/* Close button */}
                    <Pressable
                        accessibilityLabel="Cerrar"
                        accessibilityRole="button"
                        onPress={onClose}
                        style={({ pressed }) => [
                            styles.membersModalCloseButton,
                            pressed && styles.membersModalCloseButtonPressed,
                        ]}>
                        <Text style={styles.membersModalCloseText}>Cerrar</Text>
                    </Pressable>
                </View>

                <SnackbarHost />
            </View>
        </Modal>
    );
}

// ---------- GroupsScreen ----------

export default function GroupsScreen() {
    const insets = useSafeAreaInsets();
    const [groups, setGroups] = useState<GroupWithRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingGroup, setEditingGroup] = useState<GroupWithRole | null>(null);
    const [membersModalVisible, setMembersModalVisible] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<GroupWithRole | null>(null);
    const [joinMode, setJoinMode] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
    const [searching, setSearching] = useState(false);

    const loadGroups = useCallback(async () => {
        try {
            setLoading(true);
            const myGroups = await getMyGroups();
            setGroups(myGroups);
        } catch (err: any) {
            showSnackbar(err.message ?? 'Error al cargar grupos', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    // Load all available groups when entering join mode
    useEffect(() => {
        if (joinMode) {
            loadAvailableGroups();
        }
    }, [joinMode]);

    async function loadAvailableGroups(search?: string) {
        try {
            setSearching(true);
            const results = await getAvailableGroups(search);
            setAvailableGroups(results);
        } catch (err: any) {
            showSnackbar(err.message ?? 'Error al buscar grupos', 'error');
        } finally {
            setSearching(false);
        }
    }

    async function handleSearch(text: string) {
        setSearchText(text);
        loadAvailableGroups(text.trim() || undefined);
    }

    function handleGroupPress(group: GroupWithRole) {
        setSelectedGroup(group);
        setMembersModalVisible(true);
    }

    function handleEditGroup(group: GroupWithRole) {
        setEditingGroup(group);
        setEditModalVisible(true);
    }

    async function handleJoinGroup(groupId: string) {
        try {
            await joinGroup(groupId);
            showSnackbar('Te has unido al grupo correctamente.', 'success');
            setJoinMode(false);
            setSearchText('');
            setAvailableGroups([]);
            loadGroups();
        } catch (err: any) {
            showSnackbar(err.message ?? 'Error al unirse al grupo', 'error');
        }
    }

    function confirmJoin(group: Group) {
        const locationParts = [group.city, group.province].filter(Boolean);
        const locationText =
            locationParts.length > 0 ? ` (${locationParts.join(', ')})` : '';

        Alert.alert(
            'Unirse al grupo',
            `¿Querés unirte a "${group.name}"${locationText}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Unirse',
                    onPress: () => handleJoinGroup(group.id),
                },
            ],
        );
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#9fb629" size="large" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Grupos</Text>
                <View style={styles.headerButtons}>
                    <Pressable
                        accessibilityLabel="Crear grupo"
                        accessibilityRole="button"
                        onPress={() => setCreateModalVisible(true)}
                        style={({ pressed }) => [
                            styles.headerButton,
                            pressed && styles.headerButtonPressed,
                        ]}>
                        <Icon name="add-outline" color="#9fb629" size={20} />
                        <Text style={styles.headerButtonText}>Crear</Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel="Unirse a grupo"
                        accessibilityRole="button"
                        onPress={() => {
                            setJoinMode(!joinMode);
                            setSearchText('');
                            setAvailableGroups([]);
                        }}
                        style={({ pressed }) => [
                            styles.headerButton,
                            pressed && styles.headerButtonPressed,
                        ]}>
                        <Icon name="enter-outline" color="#9fb629" size={20} />
                        <Text style={styles.headerButtonText}>Unirse</Text>
                    </Pressable>
                </View>
            </View>

            {/* Create group modal */}
            <CreateGroupModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onCreated={loadGroups}
            />

            {/* Edit group modal */}
            <EditGroupModal
                visible={editModalVisible}
                group={editingGroup}
                onClose={() => {
                    setEditModalVisible(false);
                    setEditingGroup(null);
                }}
                onSaved={loadGroups}
            />

            {/* Group members modal */}
            <GroupMembersModal
                visible={membersModalVisible}
                group={selectedGroup}
                onClose={() => {
                    setMembersModalVisible(false);
                    setSelectedGroup(null);
                }}
                onEdit={handleEditGroup}
            />

            {/* Join mode */}
            {joinMode && (
                <View style={styles.searchContainer}>
                    <TextInput
                        placeholder="Buscar grupo por nombre..."
                        placeholderTextColor="#6b7280"
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={handleSearch}
                        autoFocus
                    />

                    {searching && (
                        <ActivityIndicator
                            color="#9fb629"
                            size="small"
                            style={styles.searchSpinner}
                        />
                    )}

                    {!searching && availableGroups.length > 0 && (
                        <View style={styles.searchResults}>
                            {availableGroups.map(group => {
                                const locationParts = [group.city, group.province].filter(Boolean);
                                const locationText =
                                    locationParts.length > 0
                                        ? locationParts.join(', ')
                                        : null;

                                return (
                                    <Pressable
                                        key={group.id}
                                        accessibilityRole="button"
                                        onPress={() => confirmJoin(group)}
                                        style={({ pressed }) => [
                                            styles.searchResultItem,
                                            pressed && styles.searchResultItemPressed,
                                        ]}>
                                        {group.avatar_url ? (
                                            <Image
                                                source={{ uri: group.avatar_url }}
                                                style={styles.searchResultAvatar}
                                            />
                                        ) : (
                                            <View
                                                style={[
                                                    styles.searchResultAvatar,
                                                    styles.searchResultAvatarPlaceholder,
                                                ]}>
                                                <Icon
                                                    name="people-outline"
                                                    color="#6b7280"
                                                    size={18}
                                                />
                                            </View>
                                        )}
                                        <View style={styles.searchResultInfo}>
                                            <Text
                                                style={styles.searchResultName}
                                                numberOfLines={1}>
                                                {group.name}
                                            </Text>
                                            {locationText && (
                                                <Text
                                                    style={styles.searchResultLocation}
                                                    numberOfLines={1}>
                                                    {locationText}
                                                </Text>
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}

                    {!searching && availableGroups.length === 0 && (
                        <Text style={styles.noResultsText}>
                            No se encontraron grupos
                        </Text>
                    )}
                </View>
            )}

            {/* Group list */}
            {groups.length === 0 && !joinMode ? (
                <View style={styles.emptyState}>
                    <Icon name="people-outline" color="#6b7280" size={64} />
                    <Text style={styles.emptyTitle}>
                        Todavía no tenés grupos
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        Creá o unite a un grupo desde los botones de arriba
                    </Text>
                </View>
            ) : !joinMode ? (
                <FlatList
                    data={groups}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <GroupCard group={item} onPress={handleGroupPress} />
                    )}
                />
            ) : null}
        </View>
    );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
    centered: {
        alignItems: 'center',
        backgroundColor: '#1e1f20',
        flex: 1,
        justifyContent: 'center',
    },
    container: {
        backgroundColor: '#1e1f20',
        flex: 1,
    },
    editAvatar: {
        borderRadius: 32,
        height: 64,
        width: 64,
    },
    editAvatarPlaceholder: {
        alignItems: 'center',
        backgroundColor: '#374151',
        justifyContent: 'center',
    },
    editPhotoButton: {
        alignItems: 'center',
        borderColor: '#9fb629',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    editPhotoButtonText: {
        color: '#9fb629',
        fontSize: 14,
        fontWeight: '700',
    },
    editPhotoSection: {
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
    },
    emptyState: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptySubtitle: {
        color: '#6b7280',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    emptyTitle: {
        color: '#e2e8f0',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    groupAvatar: {
        borderRadius: 24,
        height: 48,
        width: 48,
    },
    groupAvatarPlaceholder: {
        alignItems: 'center',
        backgroundColor: '#374151',
        justifyContent: 'center',
    },
    groupCard: {
        alignItems: 'center',
        backgroundColor: '#2d2e30',
        borderRadius: 12,
        flexDirection: 'row',
        marginBottom: 8,
        padding: 12,
    },
    groupCardPressed: {
        backgroundColor: '#374151',
    },
    groupInfo: {
        flex: 1,
        marginLeft: 12,
    },
    groupLocation: {
        color: '#6b7280',
        fontSize: 13,
        marginTop: 2,
    },
    groupName: {
        color: '#e2e8f0',
        fontSize: 16,
        fontWeight: '600',
    },
    groupRole: {
        color: '#9fb629',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerButton: {
        alignItems: 'center',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    headerButtonPressed: {
        backgroundColor: '#374151',
    },
    headerButtonText: {
        color: '#9fb629',
        fontSize: 14,
        fontWeight: '700',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    headerTitle: {
        color: '#e2e8f0',
        fontSize: 24,
        fontWeight: '800',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    modalButton: {
        alignItems: 'center',
        borderRadius: 10,
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        paddingVertical: 12,
    },
    modalButtonCancel: {
        backgroundColor: '#374151',
    },
    modalButtonCancelText: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '700',
    },
    modalButtonDisabled: {
        opacity: 0.5,
    },
    modalButtonPressed: {
        opacity: 0.8,
    },
    modalButtonPrimary: {
        backgroundColor: '#9fb629',
    },
    modalButtonPrimaryText: {
        color: '#1e1f20',
        fontSize: 15,
        fontWeight: '700',
    },
    modalContent: {
        backgroundColor: '#2d2e30',
        borderRadius: 16,
        padding: 24,
        width: '100%',
    },
    modalInput: {
        backgroundColor: '#1e1f20',
        borderRadius: 10,
        color: '#e2e8f0',
        fontSize: 15,
        marginTop: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    modalLabel: {
        color: '#9fb629',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 16,
        textTransform: 'uppercase',
    },
    modalTitle: {
        color: '#e2e8f0',
        fontSize: 20,
        fontWeight: '800',
    },
    noResultsText: {
        color: '#6b7280',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
    },
    pickerChip: {
        alignItems: 'center',
        borderColor: '#374151',
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        marginRight: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    pickerChipActive: {
        borderColor: '#9fb629',
    },
    pickerChipPressed: {
        opacity: 0.7,
    },
    pickerChipText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '500',
    },
    pickerChipTextActive: {
        color: '#9fb629',
        fontSize: 14,
        fontWeight: '600',
    },
    pickerModalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    pickerModalCloseButton: {
        padding: 4,
    },
    pickerModalContent: {
        backgroundColor: '#2d2e30',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '70%',
        width: '100%',
    },
    pickerModalHeader: {
        alignItems: 'center',
        borderBottomColor: '#374151',
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    pickerModalItem: {
        alignItems: 'center',
        borderBottomColor: '#374151',
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    pickerModalItemActive: {
        backgroundColor: '#374151',
    },
    pickerModalItemPressed: {
        opacity: 0.7,
    },
    pickerModalItemText: {
        color: '#e2e8f0',
        fontSize: 16,
    },
    pickerModalItemTextActive: {
        color: '#9fb629',
        fontWeight: '700',
    },
    pickerModalList: {
        maxHeight: 400,
    },
    pickerModalTitle: {
        color: '#e2e8f0',
        fontSize: 18,
        fontWeight: '700',
    },
    pickerRow: {
        marginTop: 8,
    },
    searchContainer: {
        paddingBottom: 12,
        paddingHorizontal: 16,
    },
    searchInput: {
        backgroundColor: '#2d2e30',
        borderRadius: 10,
        color: '#e2e8f0',
        fontSize: 15,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    searchSpinner: {
        marginTop: 12,
    },
    searchResultAvatar: {
        borderRadius: 20,
        height: 40,
        width: 40,
    },
    searchResultAvatarPlaceholder: {
        alignItems: 'center',
        backgroundColor: '#374151',
        justifyContent: 'center',
    },
    searchResultInfo: {
        flex: 1,
        marginLeft: 10,
    },
    searchResultItem: {
        alignItems: 'center',
        backgroundColor: '#2d2e30',
        borderRadius: 10,
        flexDirection: 'row',
        marginTop: 6,
        padding: 10,
    },
    searchResultItemPressed: {
        backgroundColor: '#374151',
    },
    searchResultLocation: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 1,
    },
    searchResultName: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '600',
    },
    searchResults: {
        marginTop: 4,
    },
    // Group Members Modal Styles
    membersModalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    membersModalContent: {
        backgroundColor: '#2d2e30',
        borderRadius: 16,
        maxHeight: '85%',
        width: '100%',
        paddingVertical: 20,
    },
    membersModalHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomColor: '#374151',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    membersModalHeaderInfo: {
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    membersModalAvatar: {
        borderRadius: 24,
        height: 48,
        width: 48,
    },
    membersModalAvatarPlaceholder: {
        alignItems: 'center',
        backgroundColor: '#374151',
        justifyContent: 'center',
    },
    membersModalHeaderText: {
        flex: 1,
    },
    membersModalTitle: {
        color: '#e2e8f0',
        fontSize: 18,
        fontWeight: '700',
    },
    membersModalCount: {
        color: '#6b7280',
        fontSize: 13,
        marginTop: 2,
    },
    membersModalEditButton: {
        alignItems: 'center',
        borderColor: '#9fb629',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    membersModalEditButtonPressed: {
        opacity: 0.7,
    },
    membersModalEditText: {
        color: '#9fb629',
        fontSize: 14,
        fontWeight: '700',
    },
    membersModalLoader: {
        marginVertical: 32,
    },
    membersModalList: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    membersModalItem: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingVertical: 10,
    },
    membersModalItemAvatar: {
        borderRadius: 20,
        height: 40,
        width: 40,
    },
    membersModalItemAvatarPlaceholder: {
        alignItems: 'center',
        backgroundColor: '#374151',
        justifyContent: 'center',
    },
    membersModalItemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    membersModalItemName: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '600',
    },
    membersModalItemRole: {
        color: '#9fb629',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    membersModalCloseButton: {
        alignItems: 'center',
        backgroundColor: '#374151',
        borderRadius: 10,
        marginHorizontal: 20,
        marginTop: 12,
        paddingVertical: 12,
    },
    membersModalCloseButtonPressed: {
        opacity: 0.7,
    },
    membersModalCloseText: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '700',
    },
});
