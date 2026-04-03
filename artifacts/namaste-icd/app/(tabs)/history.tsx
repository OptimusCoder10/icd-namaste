import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useApi, type RecordItem } from "@/context/ApiContext";
import { ScoreBar } from "@/components/ScoreBar";
import Colors from "@/constants/colors";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getHistory, searchRecords } = useApi();
  const C = Colors.light;

  const isPatient = user?.role === "patient";

  const [allRecords, setAllRecords] = useState<RecordItem[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setError("");
      const data = await getHistory();
      setAllRecords(data);
      setRecords(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load history";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHistory]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setSearchQuery("");
      fetchHistory();
    }, [fetchHistory])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setSearchQuery("");
    fetchHistory();
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q.trim()) {
      setRecords(allRecords);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchRecords(q.trim());
        setRecords(results);
      } catch {
        const lower = q.toLowerCase();
        setRecords(allRecords.filter(r =>
          r.selected_icd.toLowerCase().includes(lower) ||
          r.icd_description.toLowerCase().includes(lower) ||
          r.input_text.toLowerCase().includes(lower)
        ));
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const getDcColor = (dc: number | null) => {
    if (dc === null || dc === undefined) return C.textMuted;
    if (dc >= 70) return C.success;
    if (dc >= 40) return C.warning;
    return C.danger;
  };

  const renderRecord = ({ item, index }: { item: RecordItem; index: number }) => {
    const dc = item.doctor_confidence;
    const dcColor = getDcColor(dc);

    return (
      <TouchableOpacity
        style={[styles.recordCard, { backgroundColor: C.backgroundSecondary, borderColor: C.border, shadowColor: C.cardShadow }]}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedRecord(item);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          {isPatient && dc !== null && dc !== undefined ? (
            <View style={[styles.rankCircle, { backgroundColor: dcColor + "18", borderColor: dcColor + "40" }]}>
              <Text style={[styles.rankNum, { color: dcColor }]}>{dc}%</Text>
            </View>
          ) : (
            <View style={[styles.idxBadge, { backgroundColor: C.badge }]}>
              <Text style={[styles.idxText, { color: C.badgeText }]}>#{records.length - index}</Text>
            </View>
          )}
          <View style={styles.dateArea}>
            <Text style={[styles.dateText, { color: C.textMuted }]}>{formatDate(item.created_at)}</Text>
            <Text style={[styles.timeText, { color: C.textMuted }]}>{formatTime(item.created_at)}</Text>
          </View>
          {isPatient && item.doctor_name && (
            <View style={[styles.drBadge, { backgroundColor: C.tint + "12" }]}>
              <Feather name="briefcase" size={10} color={C.tint} />
              <Text style={[styles.drName, { color: C.tint }]} numberOfLines={1}>
                Dr. {item.doctor_name.split(" ")[0]}
              </Text>
            </View>
          )}
          {!isPatient && item.patient_name && (
            <View style={[styles.patientBadge, { backgroundColor: "#7C3AED12" }]}>
              <Feather name="user" size={10} color="#7C3AED" />
              <Text style={[styles.patientBadgeName, { color: "#7C3AED" }]} numberOfLines={1}>
                {item.patient_name.split(" ")[0]}
              </Text>
            </View>
          )}
          <Feather name="chevron-right" size={16} color={C.textMuted} />
        </View>

        <View style={styles.cardMain}>
          <Text style={[styles.icdCode, { color: C.tint }]}>{item.selected_icd}</Text>
          <Text style={[styles.icdDesc, { color: C.text }]} numberOfLines={1}>{item.icd_description}</Text>
          <Text style={[styles.inputText, { color: C.textSecondary }]} numberOfLines={2}>
            {item.input_text}
          </Text>
        </View>

        <View style={styles.scoresRow}>
          <View style={styles.scoreBlock}>
            <Text style={[styles.scoreBlockLabel, { color: C.textMuted }]}>AI</Text>
            <ScoreBar score={item.confidence_score} />
          </View>
          {dc !== null && dc !== undefined && (
            <View style={styles.scoreBlock}>
              <Text style={[styles.scoreBlockLabel, { color: C.textMuted }]}>Doctor</Text>
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

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

  const screenTitle = isPatient ? "My Diagnoses" : "My Records";
  const screenSubtitle = isPatient
    ? `${allRecords.length} diagnosis${allRecords.length !== 1 ? "es" : ""} · ranked by doctor confidence`
    : `${allRecords.length} FHIR record${allRecords.length !== 1 ? "s" : ""} saved`;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <FlatList
        data={records}
        keyExtractor={item => String(item.id)}
        renderItem={renderRecord}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 84) + 16,
          }
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.titleRow}>
              <Text style={[styles.screenTitle, { color: C.text }]}>{screenTitle}</Text>
              {isPatient && (
                <View style={[styles.patientTag, { backgroundColor: "#7C3AED15" }]}>
                  <Feather name="user" size={11} color="#7C3AED" />
                  <Text style={[styles.patientTagText, { color: "#7C3AED" }]}>Patient</Text>
                </View>
              )}
            </View>
            <Text style={[styles.screenSubtitle, { color: C.textSecondary }]}>
              {screenSubtitle}
            </Text>

            <View style={[styles.searchBar, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
              <Feather name="search" size={15} color={C.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: C.text }]}
                placeholder={isPatient ? "Search your diagnoses..." : "Search records..."}
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                fontFamily="Inter_400Regular"
                returnKeyType="search"
              />
              {searching && <ActivityIndicator size="small" color={C.tint} />}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity onPress={() => handleSearch("")}>
                  <Feather name="x" size={14} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {isPatient && allRecords.length > 0 && !searchQuery && (
              <View style={[styles.sortHint, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
                <Feather name="bar-chart-2" size={12} color={C.textMuted} />
                <Text style={[styles.sortHintText, { color: C.textMuted }]}>
                  Sorted by doctor confidence — highest first
                </Text>
              </View>
            )}

            {isPatient && allRecords.length > 0 && (
              <View style={[styles.privacyNote, { backgroundColor: "#7C3AED08", borderColor: "#7C3AED20" }]}>
                <Feather name="lock" size={11} color="#7C3AED" />
                <Text style={[styles.privacyNoteText, { color: "#7C3AED" }]}>
                  Only showing diagnoses linked to you by a doctor
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <Feather name="alert-circle" size={32} color={C.danger} />
              <Text style={[styles.emptyTitle, { color: C.text }]}>Failed to load</Text>
              <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: C.tint }]}
                onPress={fetchHistory}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : searchQuery ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.backgroundTertiary }]}>
                <Feather name="search" size={28} color={C.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No results found</Text>
              <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
                Try different keywords or clear the search
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.backgroundTertiary }]}>
                <Feather name={isPatient ? "clipboard" : "clock"} size={28} color={C.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
                {isPatient ? "No diagnoses yet" : "No records yet"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
                {isPatient
                  ? "When a doctor links a diagnosis to you, it will appear here"
                  : "Confirmed ICD-11 codes will appear here"}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.tint} />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        scrollEnabled={records.length > 0 || !!searchQuery}
      />

      <Modal
        visible={selectedRecord !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: C.backgroundSecondary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>FHIR Record</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)} style={styles.closeBtn}>
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedRecord && (
                <>
                  {!isPatient && selectedRecord.patient_name && (
                    <View style={[styles.fhirSection, { backgroundColor: "#7C3AED0A" }]}>
                      <Text style={[styles.fhirLabel, { color: "#7C3AED" }]}>PATIENT</Text>
                      <View style={styles.patientNameRow}>
                        <Feather name="user" size={16} color="#7C3AED" />
                        <Text style={[styles.patientNameText, { color: C.text }]}>{selectedRecord.patient_name}</Text>
                      </View>
                    </View>
                  )}

                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>ICD-11 CODE</Text>
                    <Text style={[styles.fhirCode, { color: C.tint }]}>{selectedRecord.selected_icd}</Text>
                    <Text style={[styles.fhirDesc, { color: C.text }]}>{selectedRecord.icd_description}</Text>
                  </View>

                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>CLINICAL INPUT</Text>
                    <Text style={[styles.fhirText, { color: C.text }]}>{selectedRecord.input_text}</Text>
                  </View>

                  <View style={styles.scoresDetailSection}>
                    <View style={styles.scoreDetailBlock}>
                      <Text style={[styles.fhirLabel, { color: C.textMuted }]}>AI CONFIDENCE</Text>
                      <ScoreBar score={selectedRecord.confidence_score} />
                    </View>

                    {selectedRecord.doctor_confidence !== null && selectedRecord.doctor_confidence !== undefined && (
                      <View style={[styles.scoreDetailBlock, { marginTop: 12 }]}>
                        <Text style={[styles.fhirLabel, { color: C.textMuted }]}>DOCTOR CONFIDENCE</Text>
                        <View style={styles.dcDetailRow}>
                          <View style={[styles.dcBigCircle, {
                            backgroundColor: getDcColor(selectedRecord.doctor_confidence) + "18",
                            borderColor: getDcColor(selectedRecord.doctor_confidence) + "40"
                          }]}>
                            <Text style={[styles.dcBigNum, { color: getDcColor(selectedRecord.doctor_confidence) }]}>
                              {selectedRecord.doctor_confidence}%
                            </Text>
                          </View>
                          <View style={styles.dcDetailBarWrap}>
                            <View style={[styles.dcDetailBar, { backgroundColor: C.border }]}>
                              <View style={[
                                styles.dcDetailFill,
                                {
                                  width: `${selectedRecord.doctor_confidence}%` as any,
                                  backgroundColor: getDcColor(selectedRecord.doctor_confidence)
                                }
                              ]} />
                            </View>
                            <Text style={[styles.dcDetailLabel, { color: C.textMuted }]}>
                              {selectedRecord.doctor_confidence >= 70 ? "High confidence" :
                               selectedRecord.doctor_confidence >= 40 ? "Moderate confidence" : "Low confidence"}
                            </Text>
                          </View>
                        </View>
                        {isPatient && selectedRecord.doctor_name && (
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingHorizontal: 16, gap: 0 },
  listHeader: { marginBottom: 16, gap: 8 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  patientTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  patientTagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  screenSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sortHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  sortHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  privacyNoteText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  recordCard: {
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
    gap: 10,
  },
  rankCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    flexShrink: 0,
  },
  rankNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  idxBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  idxText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  dateArea: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  drBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 100,
  },
  drName: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  patientBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 100,
  },
  patientBadgeName: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  cardMain: { gap: 3 },
  icdCode: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  icdDesc: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  inputText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  scoresRow: {
    gap: 8,
  },
  scoreBlock: {
    gap: 4,
  },
  scoreBlockLabel: {
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
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
  patientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  patientNameText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  scoresDetailSection: {
    marginBottom: 12,
  },
  scoreDetailBlock: {
    gap: 8,
  },
  dcDetailRow: {
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
  dcDetailBarWrap: {
    flex: 1,
    gap: 6,
  },
  dcDetailBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  dcDetailFill: {
    height: "100%",
    borderRadius: 4,
  },
  dcDetailLabel: {
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
