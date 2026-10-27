import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  bookCoverMock: {
    width: 50,
    height: 75,
    backgroundColor: '#D97757',
    borderRadius: 4,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  coverText: {
    color: '#FFF',
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  author: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressWrapper: {
    width: '100%',
  },
  barBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },
  pagesText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});