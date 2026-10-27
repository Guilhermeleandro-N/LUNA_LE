import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../styles/index'; // ou podes criar um explore.styles.ts

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1F2937' }}>
            Explorar Biblioteca
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8 }}>
            Aqui vais poder pesquisar todos os livros e documentos disponíveis.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}