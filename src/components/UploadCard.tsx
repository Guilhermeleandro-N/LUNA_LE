import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../styles/UploadCard.styles';

interface UploadCardProps {
  onPress: () => void;
}

export default function UploadCard({ onPress }: UploadCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Text style={{ fontSize: 22 }}>📄</Text>
      </View>
      <View>
        <Text style={styles.title}>Abrir um Arquivo</Text>
        <Text style={styles.subtitle}>PDF até 100 mb</Text>
      </View>
    </TouchableOpacity>
  );
}