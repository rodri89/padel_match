import { useState } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

type TutorialStep = {
    icon: string;
    title: string;
    description: string;
    details: string[];
};

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        icon: 'person-outline',
        title: 'Completá tu perfil',
        description:
            'Antes de empezar, asegurate de completar todos tus datos personales.',
        details: [
            'Nombre visible y foto de perfil.',
            'Provincia y ciudad donde jugás.',
            'Tu sexo y posición en la cancha (drive, revés o ambos).',
            'Categoría de juego (1 a 8).',
        ],
    },
    {
        icon: 'options-outline',
        title: 'Preferencias de partido',
        description:
            'Configurá tu disponibilidad y las categorías que querés ver.',
        details: [
            'Agregá los días de la semana que podés jugar.',
            'Definí los horarios disponibles (ej: lunes de 16:00 a 22:00).',
            'Usá la opción "Todo el día" si estás libre todo el día.',
            'Seleccioná las categorías de partidos que querés ver.',
        ],
    },
    {
        icon: 'calendar-outline',
        title: 'Crear un partido',
        description:
            'Cuando quieras jugar, creá un partido y encontrá jugadores.',
        details: [
            'Andá a la pestaña "Partidos" en el menú inferior.',
            'Presioná el botón "+" (flotante) para crear un partido.',
            'Completá: complejo, fecha, horario y tipo de partido.',
            'Indicá cuántos jugadores faltan (1 a 4).',
            'Elegí las categorías de jugadores que buscás.',
            'Una notificación te va a llegar cuando alguien quiera jugar.',
        ],
    },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TutorialModalProps = {
    onClose: () => void;
    visible: boolean;
};

export default function TutorialModal({ onClose, visible }: TutorialModalProps) {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = TUTORIAL_STEPS.length;
    const step = TUTORIAL_STEPS[currentStep];

    function handleNext() {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(value => value + 1);
        } else {
            handleClose();
        }
    }

    function handlePrev() {
        if (currentStep > 0) {
            setCurrentStep(value => value - 1);
        }
    }

    function handleClose() {
        setCurrentStep(0);
        onClose();
    }

    function handleSkip() {
        handleClose();
    }

    return (
        <Modal
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
            transparent
            visible={visible}>
            <View style={styles.backdrop}>
                <View
                    style={[
                        styles.panel,
                        {
                            paddingBottom: Math.max(insets.bottom + 16, 28),
                            paddingTop: Math.max(insets.top + 12, 24),
                        },
                    ]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Tutorial</Text>
                        <Pressable
                            accessibilityLabel="Cerrar tutorial"
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={handleClose}>
                            <Icon name="close-outline" color="#0f172a" size={30} />
                        </Pressable>
                    </View>

                    {/* Step dots */}
                    <View style={styles.dotsContainer}>
                        {TUTORIAL_STEPS.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    index === currentStep && styles.dotActive,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Content */}
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}>
                        <View style={styles.iconContainer}>
                            <Icon name={step.icon} color="#9fb629" size={64} />
                        </View>

                        <Text style={styles.stepLabel}>
                            Paso {currentStep + 1} de {totalSteps}
                        </Text>
                        <Text style={styles.title}>{step.title}</Text>
                        <Text style={styles.description}>{step.description}</Text>

                        <View style={styles.detailsList}>
                            {step.details.map((detail, index) => (
                                <View key={index} style={styles.detailRow}>
                                    <View style={styles.bullet} />
                                    <Text style={styles.detailText}>{detail}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {currentStep > 0 ? (
                            <Pressable
                                onPress={handlePrev}
                                style={styles.secondaryButton}>
                                <Icon name="arrow-back-outline" color="#9fb629" size={20} />
                                <Text style={styles.secondaryButtonText}>Anterior</Text>
                            </Pressable>
                        ) : (
                            <View style={styles.spacer} />
                        )}

                        <Pressable
                            onPress={handleSkip}
                            style={styles.skipButton}>
                            <Text style={styles.skipButtonText}>Saltar</Text>
                        </Pressable>

                        <Pressable
                            onPress={handleNext}
                            style={styles.primaryButton}>
                            <Text style={styles.primaryButtonText}>
                                {currentStep < totalSteps - 1 ? 'Siguiente' : '¡Entendido!'}
                            </Text>
                            {currentStep < totalSteps - 1 ? (
                                <Icon name="arrow-forward-outline" color="#ffffff" size={20} />
                            ) : null}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    actions: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    backdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    bullet: {
        backgroundColor: '#9fb629',
        borderRadius: 4,
        height: 8,
        marginTop: 6,
        width: 8,
    },
    content: {
        alignItems: 'center',
        paddingBottom: 8,
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    description: {
        color: '#475569',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
        textAlign: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    detailsList: {
        alignSelf: 'stretch',
    },
    detailText: {
        color: '#334155',
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    dot: {
        backgroundColor: '#cbd5e1',
        borderRadius: 6,
        height: 12,
        width: 12,
    },
    dotActive: {
        backgroundColor: '#9fb629',
        width: 32,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginBottom: 16,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    headerTitle: {
        color: '#0f172a',
        fontSize: 22,
        fontWeight: '800',
    },
    iconContainer: {
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: 50,
        height: 100,
        justifyContent: 'center',
        marginBottom: 12,
        width: 100,
    },
    panel: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        elevation: 24,
        flex: 1,
        marginBottom: 40,
        marginTop: 60,
        maxHeight: '85%',
        shadowColor: '#000000',
        shadowOffset: { height: 0, width: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
    },
    primaryButton: {
        alignItems: 'center',
        backgroundColor: '#9fb629',
        borderRadius: 12,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
    },
    secondaryButton: {
        alignItems: 'center',
        borderColor: '#9fb629',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    secondaryButtonText: {
        color: '#9fb629',
        fontSize: 15,
        fontWeight: '700',
    },
    skipButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    skipButtonText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    spacer: {
        width: 80,
    },
    stepLabel: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    title: {
        color: '#0f172a',
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
});