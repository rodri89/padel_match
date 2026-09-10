import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;
const MAX_CONTENT_WIDTH = 700;

export function useResponsive() {
    const { width } = useWindowDimensions();
    const isTablet = width >= TABLET_BREAKPOINT;

    return {
        isTablet,
        contentMaxWidth: isTablet ? MAX_CONTENT_WIDTH : undefined,
        numColumns: isTablet ? 2 : 1,
        spacing: isTablet ? Math.min(width * 0.04, 36) : 24,
        contentPadding: isTablet ? Math.min(width * 0.04, 36) : 24,
    };
}