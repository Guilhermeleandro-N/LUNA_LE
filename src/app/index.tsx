import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ContinueReadingCard from '../components/ContinueReadingCard';
import BookListItem from '../components/BookListItem';
import UploadCard from '../components/UploadCard';
import styles from '../styles/index';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🌙</Text>
            </View>
            <Text style={styles.logoText}>LunaLê</Text>
          </View>
          <Text style={styles.librarySubtitle}>Sua Biblioteca</Text>
          <Text style={styles.greeting}>Como vai, Clara?</Text>
        </View>

        {/* Card de Continuar Lendo */}
        <ContinueReadingCard 
          bookTitle="A arte de fazer acontecer"
          currentChapter="8 — Revisando seu sistema"
          progress={80}
          onContinue={() => console.log('Continuar leitura pressionado')}
        />

        {/* Seção Recentes */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionCategory}>Últimos Acessos</Text>
            <Text style={styles.sectionTitle}>Recentes</Text>
          </View>
          <TouchableOpacity onPress={() => console.log('Ver todos pressionado')}>
            <Text style={styles.verTodosText}>Ver Todos</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Livros Recentes */}
        <BookListItem 
          title="A Arte de fazer Acontecer"
          author="Autor"
          currentPage={120}
          totalPages={150}
          onPress={() => console.log('Livro 1')}
        />
        <BookListItem 
          title="A Arte de fazer Acontecer"
          author="Autor"
          currentPage={120}
          totalPages={150}
          onPress={() => console.log('Livro 2')}
        />
        <BookListItem 
          title="A Arte de fazer Acontecer"
          author="Autor"
          currentPage={120}
          totalPages={150}
          onPress={() => console.log('Livro 3')}
        />

        {/* Card de Abrir Arquivo */}
        <UploadCard onPress={() => console.log('Abrir PDF')} />

      </ScrollView>
    </View>
  );
}