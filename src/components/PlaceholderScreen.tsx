import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  description: string;
};

export default function PlaceholderScreen({ title, description }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#252628',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  description: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
  },
});