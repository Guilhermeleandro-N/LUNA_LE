
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';

import ContinueReadingCard from '../components/ContinueReadingCard';
import BookListItem from '../components/BookListItem';
import UploadCard from '../components/UploadCard';
import styles from '../styles/index';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function handleOpenPdf() {
    try {
      // Abre o seletor de arquivos do Android
      const result = await File.pickFileAsync({
        mimeTypes: ['application/pdf'],
      });

      if (result.canceled || !result.result) {
        return;
      }

      const file = result.result;
      const maxSize = 100 * 1024 * 1024;

      // Verifica o tamanho do PDF
      if (file.size > maxSize) {
        Alert.alert(
          'Arquivo muito grande',
          'Selecione um PDF de até 100 MB.'
        );
        return;
      }

      console.log('PDF ORIGINAL:', {
        uri: file.uri,
        name: file.name,
        size: file.size,
        type: file.type,
        exists: file.exists,
      });

      // Cria um destino no armazenamento privado do aplicativo
      const copiedFile = new File(
        Paths.cache,
        `pdf-${Date.now()}.pdf`
      );

      // Copia o PDF para o armazenamento privado
      await file.copy(copiedFile);

      // Verifica os dados da cópia
      console.log('PDF COPIADO:', {
        uriOriginal: file.uri,
        uriCopia: copiedFile.uri,
        existe: copiedFile.exists,
        tamanho: copiedFile.size,
        tipo: copiedFile.type,
      });

      // Codifica a URI para preservar os caracteres especiais
      const encodedUri = encodeURIComponent(copiedFile.uri);

      console.log('URI ENVIADA AO LEITOR:', encodedUri);

      // Encaminha a cópia para a tela de leitura
      router.push({
        pathname: './reader',
        params: {
          uri: encodedUri,
          name: file.name,
        },
      });

    } catch (error) {
      console.error('ERRO AO SELECIONAR OU COPIAR PDF:', error);

      Alert.alert(
        'Erro',
        'Não foi possível acessar ou copiar o PDF selecionado.'
      );
    }
  }

  const handleOpenRecent = (title: string) => {
    console.log('Abrir livro:', title);
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Continuar lendo */}
        <ContinueReadingCard
          bookTitle="A arte de fazer acontecer"
          currentChapter="8 — Revisando seu sistema"
          progress={80}
          onContinue={() => console.log('Continuar leitura')}
        />

        {/* Recentes */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionCategory}>Últimos Acessos</Text>
            <Text style={styles.sectionTitle}>Recentes</Text>
          </View>

          <TouchableOpacity onPress={() => console.log('Ver todos')}>
            <Text style={styles.verTodosText}>Ver Todos</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de livros */}
        <BookListItem
          title="A Arte de fazer Acontecer"
          author="Autor"
          currentPage={120}
          totalPages={150}
          onPress={() => handleOpenRecent('A Arte de fazer Acontecer')}
        />

        <BookListItem
          title="A Arte de fazer Acontecer"
          author="Autor"
          currentPage={120}
          totalPages={150}
          onPress={() => handleOpenRecent('A Arte de fazer Acontecer')}
        />

        <BookListItem
          title="A Arte de fazer Acontecer"
          author="Autor"
          currentPage={120}
          totalPages={150}
          onPress={() => handleOpenRecent('A Arte de fazer Acontecer')}
        />

        {/* Abrir PDF */}
        <UploadCard onPress={handleOpenPdf} />
      </ScrollView>
    </View>
  );
}
