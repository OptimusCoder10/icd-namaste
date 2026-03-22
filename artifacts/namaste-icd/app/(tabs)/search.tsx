import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useApi, type RecordItem } from "@/context/ApiContext";
import { ScoreBar } from "@/components/ScoreBar";
import Colors from "@/constants/colors";

const SUGGESTIONS = [
  "fever",
  "chest pain",
  "diabetes",
  "hypertension",
  "pneumonia",
  "fracture",
  "anxiety",
  "asthma",
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { searchRecords } = useApi();
  const C = Colors.light;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await searchRecords(q.trim());
      setResults(data);
      setSearched(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchRecords]);

  const handleChangeText = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 400);
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    runSearch(s);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setError("");
    inputRef.current?.focus();
  };

  const getDcColor = (dc: number | null) => {
    if (dc === null || dc === undefined) return C.textMuted;
    if (dc >= 70) return C.success;
    if (dc >= 40) return C.warning;
    return C.danger;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderResult = ({ item }: { item: RecordItem }) => {
    const dc = item.doctor_confidence;
    const dcColor = getDcColor(dc);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.backgroundSecondary, borderColor: C.border, shadowColor: C.cardShadow }]}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedRecord(item);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          {dc !== null && dc !== undefined ? (
            <View style={[styles.dcCircle, { backgroundColor: dcColor + "18", borderColor: dcColor + "40" }]}>
              <Text style={[styles.dcCircleNum, { color: dcColor }]}>{dc}%</Text>
            </View>
          ) : (
            <View style={[styles.dcCircle, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <Feather name="minus" size={14} color={C.textMuted} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.icdCode, { color: C.tint }]}>{item.selected_icd}</Text>
            <Text style={[styles.icdDesc, { color: C.text }]} numberOfLines={2}>
              {item.icd_description}
            </Text>
            {item.doctor_name && (
              <View style={styles.drRow}>
                <Feather name="briefcase" size={10} color={C.textMuted} />
                <Text style={[styles.drText, { color: C.textMuted }]}>
                  Dr. {item.doctor_name} · {formatDate(item.created_at)}
                </Text>
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={16} color={C.textMuted} />
        </View>

        <View style={styles.cardScores}>
          <View style={styles.scoreCol}>
            <Text style={[styles.scoreColLabel, { color: C.textMuted }]}>AI</Text>
            <ScoreBar score={item.confidence_score} />
          </View>
          {dc !== null && dc !== undefined && (
            <View style={styles.scoreCol}>
              <Text style={[styles.scoreColLabel, { color: C.textMuted }]}>Doctor</Text>
              <View style={styles.dcBarRow}>
                <View style={[styles.dcBarBg, { backgroundColor: C.border }]}>
                  <View style={[styles.dcBarFill, { width: `${dc}%` as any, backgroundColor: dcColor }]} />
                </View>
                <Text style={[styles.dcPct, { color: dcColor }]}>{dc}%</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[
        styles.searchHeader,
        {
          backgroundColor: C.backgroundSecondary,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
          borderBottomColor: C.border,
        }
      ]}>
        <Text style={[styles.screenTitle, { color: C.text }]}>Search Diagnoses</Text>
        <Text style={[styles.screenSub, { color: C.textSecondary }]}>
          Search by disease, ICD code, or symptom
        </Text>
        <View style={[styles.searchBox, { backgroundColor: C.inputBackground, borderColor: query ? C.tint : C.border }]}>
          <Feather name="search" size={18} color={query ? C.tint : C.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: C.text, fontFamily: "Inter_400Regular" }]}
            placeholder="e.g. fever, chest pain, ICD-11..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={handleChangeText}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Feather name="x-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator size="small" color={C.tint} style={{ marginLeft: 8 }} />}
        </View>
      </View>

      {!searched && !loading && (
        <ScrollView
          contentContainerStyle={[styles.suggestionsContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.suggestionsLabel, { color: C.textMuted }]}>Common searches</Text>
          <View style={styles.chipsGrid}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, { backgroundColor: C.badge, borderColor: C.border }]}
                onPress={() => handleSuggestion(s)}
                activeOpacity={0.7}
              >
                <Feather name="search" size={12} color={C.badgeText} />
                <Text style={[styles.chipText, { color: C.badgeText }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.infoBox, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
            <Feather name="info" size={14} color={C.tint} />
            <Text style={[styles.infoText, { color: C.textSecondary }]}>
              Results are sorted by doctor confidence — the higher the confidence, the more reliable the diagnosis.
            </Text>
          </View>
        </ScrollView>
      )}

      {error !== "" && (
        <View style={[styles.errorBanner, { backgroundColor: "#FEE8E8" }]}>
          <Feather name="alert-circle" size={14} color={C.danger} />
          <Text style={[styles.errorText, { color: C.danger }]}>{error}</Text>
        </View>
      )}

      {searched && (
        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          renderItem={renderResult}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 84) + 16 }
          ]}
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: C.textSecondary }]}>
                {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
              </Text>
              {results.length > 0 && (
                <View style={[styles.sortBadge, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
                  <Feather name="bar-chart-2" size={11} color={C.textMuted} />
                  <Text style={[styles.sortBadgeText, { color: C.textMuted }]}>By doctor confidence</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.backgroundTertiary }]}>
                <Feather name="search" size={28} color={C.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No results found</Text>
              <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
                Try searching by disease name, ICD code, or symptom description
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={selectedRecord !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: C.backgroundSecondary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>Diagnosis Detail</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)} style={styles.closeBtn}>
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedRecord && (
                <>
                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>ICD-11 CODE</Text>
                    <Text style={[styles.fhirCode, { color: C.tint }]}>{selectedRecord.selected_icd}</Text>
                    <Text style={[styles.fhirDesc, { color: C.text }]}>{selectedRecord.icd_description}</Text>
                  </View>

                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>CLINICAL INPUT</Text>
                    <Text style={[styles.fhirText, { color: C.text }]}>{selectedRecord.input_text}</Text>
                  </View>

                  <View style={styles.scoresSection}>
                    <View style={styles.scoreBlock}>
                      <Text style={[styles.fhirLabel, { color: C.textMuted }]}>AI CONFIDENCE</Text>
                      <ScoreBar score={selectedRecord.confidence_score} />
                    </View>

                    {selectedRecord.doctor_confidence !== null && selectedRecord.doctor_confidence !== undefined && (
                      <View style={[styles.scoreBlock, { marginTop: 12 }]}>
                        <Text style={[styles.fhirLabel, { color: C.textMuted }]}>DOCTOR CONFIDENCE</Text>
                        <View style={styles.dcDetail}>
                          <View style={[styles.dcBigCircle, {
                            backgroundColor: getDcColor(selectedRecord.doctor_confidence) + "18",
                            borderColor: getDcColor(selectedRecord.doctor_confidence) + "40",
                          }]}>
                            <Text style={[styles.dcBigNum, { color: getDcColor(selectedRecord.doctor_confidence) }]}>
                              {selectedRecord.doctor_confidence}%
                            </Text>
                          </View>
                          <View style={styles.dcBarWrap}>
                            <View style={[styles.dcBar, { backgroundColor: C.border }]}>
                              <View style={[styles.dcFill, {
                                width: `${selectedRecord.doctor_confidence}%` as any,
                                backgroundColor: getDcColor(selectedRecord.doctor_confidence),
                              }]} />
                            </View>
                            <Text style={[styles.dcConfLabel, { color: C.textMuted }]}>
                              {selectedRecord.doctor_confidence >= 70 ? "High confidence" :
                               selectedRecord.doctor_confidence >= 40 ? "Moderate confidence" : "Low confidence"}
                            </Text>
                          </View>
                        </View>
                        {selectedRecord.doctor_name && (
                          <Text style={[styles.drAttr, { color: C.textMuted }]}>
                            Assessed by Dr. {selectedRecord.doctor_name}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>FHIR JSON</Text>
                    <Text style={[styles.jsonText, { color: C.text }]}>
                      {JSON.stringify(selectedRecord.fhir_json, null, 2)}
                    </Text>
                  </View>

                  <Text style={[styles.recordedDate, { color: C.textMuted }]}>
                    Recorded: {new Date(selectedRecord.created_at).toLocaleString()}
                  </Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  screenSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginTop: 4,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  clearBtn: { padding: 4, marginLeft: 4 },
  suggestionsContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 0,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  sortBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dcCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    flexShrink: 0,
  },
  dcCircleNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  icdCode: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  icdDesc: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 19,
  },
  drRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  drText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  cardScores: {
    gap: 8,
  },
  scoreCol: {
    gap: 4,
  },
  scoreColLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  dcBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dcBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  dcBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  dcPct: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    width: 36,
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: { padding: 4 },
  modalBody: { padding: 20 },
  fhirSection: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  fhirLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  fhirCode: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  fhirDesc: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  fhirText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  scoresSection: {
    marginBottom: 12,
  },
  scoreBlock: { gap: 8 },
  dcDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  dcBigCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    flexShrink: 0,
  },
  dcBigNum: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  dcBarWrap: {
    flex: 1,
    gap: 6,
  },
  dcBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  dcFill: {
    height: "100%",
    borderRadius: 4,
  },
  dcConfLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  drAttr: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    lineHeight: 17,
  },
  recordedDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 40,
  },
});
