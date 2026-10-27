import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  logoIcon: {
    fontSize: 14,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4C1D95',
  },
  librarySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionCategory: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  verTodosText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
});