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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useApi } from "@/context/ApiContext";
import { ScoreBar } from "@/components/ScoreBar";
import Colors from "@/constants/colors";

interface RecordItem {
  id: number;
  user_id: number;
  input_text: string;
  selected_icd: string;
  icd_description: string;
  confidence_score: number;
  fhir_json: object;
  created_at: string;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { getHistory } = useApi();
  const C = Colors.light;

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setError("");
      const data = await getHistory();
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
      fetchHistory();
    }, [fetchHistory])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const renderRecord = ({ item, index }: { item: RecordItem; index: number }) => (
    <TouchableOpacity
      style={[styles.recordCard, { backgroundColor: C.backgroundSecondary, borderColor: C.border, shadowColor: C.cardShadow }]}
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedRecord(item);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.cardTop}>
        <View style={[styles.idxBadge, { backgroundColor: C.badge }]}>
          <Text style={[styles.idxText, { color: C.badgeText }]}>#{records.length - index}</Text>
        </View>
        <View style={styles.dateArea}>
          <Text style={[styles.dateText, { color: C.textMuted }]}>{formatDate(item.created_at)}</Text>
          <Text style={[styles.timeText, { color: C.textMuted }]}>{formatTime(item.created_at)}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={C.textMuted} />
      </View>

      <View style={styles.cardMain}>
        <Text style={[styles.icdCode, { color: C.tint }]}>{item.selected_icd}</Text>
        <Text style={[styles.icdDesc, { color: C.text }]} numberOfLines={1}>{item.icd_description}</Text>
        <Text style={[styles.inputText, { color: C.textSecondary }]} numberOfLines={2}>
          {item.input_text}
        </Text>
      </View>

      <ScoreBar score={item.confidence_score} />
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

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
            <Text style={[styles.screenTitle, { color: C.text }]}>Record History</Text>
            <Text style={[styles.screenSubtitle, { color: C.textSecondary }]}>
              {records.length} FHIR record{records.length !== 1 ? "s" : ""} saved
            </Text>
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
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.backgroundTertiary }]}>
                <Feather name="clock" size={28} color={C.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No records yet</Text>
              <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
                Confirmed ICD-11 codes will appear here
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.tint}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        scrollEnabled={records.length > 0}
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
                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>ICD-11 CODE</Text>
                    <Text style={[styles.fhirCode, { color: C.tint }]}>{selectedRecord.selected_icd}</Text>
                    <Text style={[styles.fhirDesc, { color: C.text }]}>{selectedRecord.icd_description}</Text>
                  </View>

                  <View style={[styles.fhirSection, { backgroundColor: C.background }]}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>CLINICAL INPUT</Text>
                    <Text style={[styles.fhirText, { color: C.text }]}>{selectedRecord.input_text}</Text>
                  </View>

                  <View style={styles.scoreSection}>
                    <Text style={[styles.fhirLabel, { color: C.textMuted }]}>CONFIDENCE</Text>
                    <ScoreBar score={selectedRecord.confidence_score} />
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
  listHeader: { marginBottom: 16 },
  screenTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  screenSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
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
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
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
  scoreSection: {
    marginBottom: 12,
    gap: 8,
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
