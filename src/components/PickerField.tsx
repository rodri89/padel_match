import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

export interface PickerFieldItem {
    label: string;
    value: string;
}

interface PickerFieldProps {
    selectedValue: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    items: PickerFieldItem[];
    enabled?: boolean;
    style?: ViewStyle;
}

// A partir de esta cantidad de opciones la rueda nativa de iOS deja de ser
// usable (las ciudades de Buenos Aires son más de 600), así que se pasa a la
// lista con buscador en las dos plataformas.
const SEARCHABLE_THRESHOLD = 12;

const ACCENTS: Record<string, string> = {
    á: 'a', à: 'a', ä: 'a', â: 'a',
    é: 'e', è: 'e', ë: 'e', ê: 'e',
    í: 'i', ì: 'i', ï: 'i', î: 'i',
    ó: 'o', ò: 'o', ö: 'o', ô: 'o',
    ú: 'u', ù: 'u', ü: 'u', û: 'u',
    ñ: 'n',
};

// Sin esto "bahia" no encuentra "Bahía Blanca". Se reemplaza a mano en vez de
// usar normalize('NFD') para no depender del soporte de ICU del motor JS.
function normalizeText(value: string) {
    return value
        .toLowerCase()
        .replace(/[áàäâéèëêíìïîóòöôúùüûñ]/g, match => ACCENTS[match] ?? match);
}

export default function PickerField({
    selectedValue,
    onValueChange,
    placeholder,
    items,
    enabled = true,
    style,
}: PickerFieldProps) {
    const [isModalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState('');
    const [tempValue, setTempValue] = useState(selectedValue);

    const selectedLabel = selectedValue
        ? items.find(item => item.value === selectedValue)?.label || selectedValue
        : '';

    const isSearchable = items.length > SEARCHABLE_THRESHOLD;

    const visibleItems = useMemo(() => {
        if (!isSearchable || !search.trim()) {
            return items;
        }

        const query = normalizeText(search.trim());
        return items.filter(item => normalizeText(item.label).includes(query));
    }, [isSearchable, items, search]);

    function closeModal() {
        setModalVisible(false);
        setSearch('');
    }

    const trigger = (
        <Pressable
            style={[styles.iosPickerWrapper, !enabled && styles.pickerWrapperDisabled, style]}
            onPress={() => {
                if (enabled) {
                    setTempValue(selectedValue);
                    setModalVisible(true);
                }
            }}
            disabled={!enabled}>
            <Text
                style={[
                    styles.iosPickerText,
                    !selectedValue && styles.iosPickerPlaceholder,
                ]}>
                {selectedValue ? selectedLabel : placeholder}
            </Text>
            <Text style={styles.iosPickerArrow}>▼</Text>
        </Pressable>
    );

    // On Android: the native Picker's dropdown/dialog background and item
    // colors are controlled by the device's system theme, not by our style
    // props (itemStyle is ignored entirely), so text can end up invisible on
    // some devices. Render our own modal-based list instead, so colors are
    // always under our control.
    // On iOS the same list takes over for long option sets, where the native
    // wheel would mean scrolling through hundreds of entries.
    if (Platform.OS === 'android' || isSearchable) {
        const dropdownItems = [{ label: placeholder, value: '' }, ...visibleItems];

        return (
            <>
                {trigger}

                <Modal
                    transparent
                    animationType="fade"
                    visible={isModalVisible}
                    onRequestClose={closeModal}>
                    <Pressable
                        style={styles.dropdownOverlay}
                        onPress={closeModal}>
                        <Pressable style={styles.dropdownModalContent} onPress={() => { }}>
                            {isSearchable ? (
                                <View style={styles.searchWrapper}>
                                    <TextInput
                                        autoCorrect={false}
                                        onChangeText={setSearch}
                                        placeholder="Buscar..."
                                        placeholderTextColor="#6b7280"
                                        style={styles.searchInput}
                                        value={search}
                                    />
                                </View>
                            ) : null}
                            <FlatList
                                data={dropdownItems}
                                keyboardShouldPersistTaps="handled"
                                keyExtractor={item => item.value}
                                ListEmptyComponent={
                                    <Text style={styles.dropdownEmptyText}>
                                        No hay resultados.
                                    </Text>
                                }
                                style={styles.dropdownList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => {
                                            onValueChange(item.value);
                                            closeModal();
                                        }}
                                        style={styles.dropdownItem}>
                                        <Text
                                            style={[
                                                item.value === ''
                                                    ? styles.dropdownItemPlaceholderText
                                                    : styles.dropdownItemText,
                                                item.value === selectedValue &&
                                                styles.dropdownItemTextSelected,
                                            ]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </Pressable>
                    </Pressable>
                </Modal>
            </>
        );
    }

    // On iOS with a short option set: keep the native wheel picker.
    return (
        <>
            {trigger}

            <Modal
                transparent
                animationType="slide"
                visible={isModalVisible}
                onRequestClose={closeModal}>
                <Pressable
                    style={styles.modalOverlay}
                    onPress={closeModal}>
                    <Pressable style={styles.modalContent} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeModal}>
                                <Text style={styles.cancelButton}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    onValueChange(tempValue);
                                    closeModal();
                                }}>
                                <Text style={styles.doneButton}>OK</Text>
                            </TouchableOpacity>
                        </View>
                        <Picker
                            selectedValue={tempValue}
                            onValueChange={value => setTempValue(value)}
                            style={{ backgroundColor: '#1e1f20' }}
                            itemStyle={{
                                color: '#ffffff',
                                fontSize: 20,
                            }}>
                            <Picker.Item label={placeholder} value="" color="#6b7280" />
                            {items.map(item => (
                                <Picker.Item
                                    key={item.value}
                                    label={item.label}
                                    value={item.value}
                                    color="#ffffff"
                                />
                            ))}
                        </Picker>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    pickerWrapperDisabled: {
        backgroundColor: '#374151',
    },
    iosPickerWrapper: {
        alignItems: 'center',
        backgroundColor: '#1e1f20',
        borderColor: '#4b5563',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        height: 50,
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingHorizontal: 16,
    },
    iosPickerText: {
        color: '#ffffff',
        flex: 1,
        fontSize: 16,
    },
    iosPickerPlaceholder: {
        color: '#6b7280',
    },
    iosPickerArrow: {
        color: '#9fb629',
        fontSize: 12,
        marginLeft: 8,
    },
    modalOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e1f20',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 34,
    },
    modalHeader: {
        borderBottomColor: '#374151',
        borderBottomWidth: 0.5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    cancelButton: {
        color: '#9ca3af',
        fontSize: 16,
        fontWeight: '600',
    },
    doneButton: {
        color: '#9fb629',
        fontSize: 16,
        fontWeight: '700',
    },
    dropdownOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    dropdownModalContent: {
        backgroundColor: '#1e1f20',
        borderColor: '#374151',
        borderRadius: 16,
        borderWidth: 1,
        maxHeight: '70%',
        overflow: 'hidden',
        width: '100%',
    },
    dropdownList: {
        flexGrow: 0,
    },
    dropdownItem: {
        borderBottomColor: '#374151',
        borderBottomWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    dropdownItemText: {
        color: '#ffffff',
        fontSize: 16,
    },
    dropdownItemPlaceholderText: {
        color: '#6b7280',
        fontSize: 16,
    },
    dropdownItemTextSelected: {
        color: '#9fb629',
        fontWeight: '800',
    },
    dropdownEmptyText: {
        color: '#9ca3af',
        fontSize: 15,
        paddingHorizontal: 18,
        paddingVertical: 18,
        textAlign: 'center',
    },
    searchWrapper: {
        borderBottomColor: '#374151',
        borderBottomWidth: 1,
        padding: 12,
    },
    searchInput: {
        backgroundColor: '#252628',
        borderColor: '#4b5563',
        borderRadius: 10,
        borderWidth: 1,
        color: '#ffffff',
        fontSize: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
});