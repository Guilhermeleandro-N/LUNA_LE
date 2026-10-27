import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../styles/ContinueReadingCard.styles';

interface ContinueReadingCardProps {
  bookTitle: string;
  currentChapter: string;
  progress: number;
  onContinue: () => void;
}

export default function ContinueReadingCard({
  bookTitle,
  currentChapter,
  progress,
  onContinue,
}: ContinueReadingCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Continue Lendo</Text>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{bookTitle}</Text>
          <Text style={styles.chapter}>Você parou no capítulo {currentChapter}</Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>Continuar leitura &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bookCoverMock}>
          <Text style={styles.coverText} numberOfLines={3}>{bookTitle}</Text>
        </View>
      </View>
    </View>
  );
}