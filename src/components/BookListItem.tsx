import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../styles/BookListItem.styles';

interface BookListItemProps {
  title: string;
  author: string;
  currentPage: number;
  totalPages: number;
  onPress: () => void;
}

export default function BookListItem({
  title,
  author,
  currentPage,
  totalPages,
  onPress,
}: BookListItemProps) {
  const progressPercent = (currentPage / totalPages) * 100;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.bookCoverMock}>
        <Text style={styles.coverText} numberOfLines={3}>{title}</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.author}>{author}</Text>
        
        <View style={styles.progressWrapper}>
          <View style={styles.barBackground}>
            <View style={[styles.barFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.pagesText}>{currentPage} de {totalPages} Páginas</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}