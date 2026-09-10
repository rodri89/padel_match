import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    BannerAd,
    BannerAdSize,
    TestIds,
} from 'react-native-google-mobile-ads';

import { ADMOB_BANNER_ID } from '../config/admob';

type AdBannerProps = {
    /** Override the default Ad Unit ID (useful when testing with real IDs) */
    adUnitId?: string;
    /** Banner size. Defaults to ADAPTIVE_BANNER */
    size?: BannerAdSize;
};

export default function AdBanner({
    adUnitId,
    size = BannerAdSize.BANNER,
}: AdBannerProps) {
    const [isFailed, setIsFailed] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    if (isFailed) {
        return null;
    }

    return (
        <View style={styles.container}>
            {!isLoaded && (
                <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>Anuncio</Text>
                </View>
            )}
            <BannerAd
                size={size}
                unitId={adUnitId ?? ADMOB_BANNER_ID ?? TestIds.BANNER}
                onAdFailedToLoad={(error: unknown) => {
                    console.warn('[AdMob] Banner failed to load:', error);
                    setIsFailed(true);
                }}
                onAdLoaded={() => {
                    setIsLoaded(true);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 12,
        minHeight: 60,
        width: '100%',
    },
    placeholder: {
        alignItems: 'center',
        backgroundColor: '#1e1f20',
        borderColor: '#374151',
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        paddingVertical: 18,
        width: '100%',
    },
    placeholderText: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: '600',
    },
});