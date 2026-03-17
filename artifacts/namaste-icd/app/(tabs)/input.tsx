import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/context/ApiContext";
import { ScoreBar } from "@/components/ScoreBar";
import Colors from "@/constants/colors";

interface IcdMatch {
  code: string;
  description: string;
  score: number;
}

const EXAMPLE_QUERIES = [
  "fever with chills and body ache",
  "persistent cough with breathlessness",
  "chest pain radiating to left arm",
  "high blood sugar frequent urination",
  "severe headache with nausea and vomiting",
];

export default function InputScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { predict, saveRecord } = useApi();
  const C = Colors.light;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<IcdMatch[]>([]);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handlePredict = async () => {
    if (!text.trim()) {
      shake();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    setError("");
    setLoading(true);
    setResults([]);
    setSavedIds(new Set());
    try {
      const res = await predict(text.trim());
      setResults(res.results);
      setAiAvailable(res.ai_available);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prediction failed";
      setError(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (match: IcdMatch) => {
    if (savedIds.has(match.code)) return;
    setSaving(match.code);
    try {
      await saveRecord({
        input_text: text.trim(),
        selected_icd: match.code,
        icd_description: match.description,
        confidence_score: match.score,
      });
      setSavedIds(prev => new Set([...prev, match.code]));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      Alert.alert("Error", msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 84) + 16,
        }
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: C.textMuted }]}>
            Hello, {user?.name?.split(" ")[0] ?? "Doctor"}
          </Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Clinical Mapper</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: C.backgroundTertiary }]}>
          <Feather name="log-out" size={18} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: C.backgroundSecondary, shadowColor: C.cardShadow }]}>
        <View style={styles.cardHeader}>
          <Feather name="edit-3" size={16} color={C.tint} />
          <Text style={[styles.cardLabel, { color: C.tint }]}>NAMASTE / Clinical Terms</Text>
        </View>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <TextInput
            style={[styles.textArea, { color: C.text, borderColor: text ? C.tint : C.border }]}
            placeholder="Enter symptoms, NAMASTE terms, or clinical description..."
            placeholderTextColor={C.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            fontFamily="Inter_400Regular"
            returnKeyType="done"
          />
        </Animated.View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.examplesRow}
        >
          {EXAMPLE_QUERIES.map(q => (
            <TouchableOpacity
              key={q}
              style={[styles.exampleChip, { backgroundColor: C.badge, borderColor: C.border }]}
              onPress={() => setText(q)}
              activeOpacity={0.7}
            >
              <Text style={[styles.exampleText, { color: C.badgeText }]} numberOfLines={1}>
                {q}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.predictBtn, { backgroundColor: C.tint }, loading && styles.btnDisabled]}
          onPress={handlePredict}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="cpu" size={18} color="#fff" />
              <Text style={styles.predictBtnText}>Generate ICD Codes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {error !== "" && (
        <View style={[styles.errorBanner, { backgroundColor: "#FEE8E8" }]}>
          <Feather name="alert-circle" size={14} color={C.danger} />
          <Text style={[styles.errorText, { color: C.danger }]}>{error}</Text>
        </View>
      )}

      {aiAvailable !== null && (
        <View style={[styles.aiBadge, { backgroundColor: aiAvailable ? "#E8FAF5" : "#FFF8E8" }]}>
          <Feather
            name={aiAvailable ? "zap" : "zap-off"}
            size={12}
            color={aiAvailable ? C.success : C.warning}
          />
          <Text style={[styles.aiBadgeText, { color: aiAvailable ? C.success : C.warning }]}>
            {aiAvailable ? "BioBERT + FAISS active" : "Keyword fallback mode"}
          </Text>
        </View>
      )}

      {results.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={[styles.resultsTitle, { color: C.text }]}>
            ICD-11 Matches
          </Text>
          <Text style={[styles.resultsSubtitle, { color: C.textSecondary }]}>
            {results.length} results · Tap to confirm & save
          </Text>
          {results.map((match, idx) => {
            const isSaved = savedIds.has(match.code);
            const isSavingThis = saving === match.code;
            return (
              <View
                key={match.code}
                style={[
                  styles.resultCard,
                  {
                    backgroundColor: C.backgroundSecondary,
                    borderColor: isSaved ? C.success : C.border,
                    shadowColor: C.cardShadow,
                  }
                ]}
              >
                <View style={styles.resultTop}>
                  <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? C.tint : C.backgroundTertiary }]}>
                    <Text style={[styles.rankText, { color: idx === 0 ? "#fff" : C.textMuted }]}>
                      #{idx + 1}
                    </Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.icdCode, { color: C.tint }]}>{match.code}</Text>
                    <Text style={[styles.icdDesc, { color: C.text }]} numberOfLines={2}>
                      {match.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.resultBottom}>
                  <View style={styles.scoreArea}>
                    <Text style={[styles.scoreLabel, { color: C.textMuted }]}>Confidence</Text>
                    <ScoreBar score={match.score} />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      {
                        backgroundColor: isSaved ? C.success : C.tint,
                        opacity: isSaved ? 1 : 1,
                      }
                    ]}
                    onPress={() => handleSave(match)}
                    disabled={isSaved || isSavingThis}
                    activeOpacity={0.8}
                  >
                    {isSavingThis ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Feather name={isSaved ? "check" : "save"} size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {isSaved && (
                  <View style={[styles.savedBanner, { backgroundColor: "#E8FAF5" }]}>
                    <Feather name="check-circle" size={12} color={C.success} />
                    <Text style={[styles.savedText, { color: C.success }]}>
                      Saved as FHIR record
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {results.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: C.backgroundTertiary }]}>
            <Feather name="search" size={28} color={C.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
            Enter clinical symptoms
          </Text>
          <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
            BioBERT will map your input to the most relevant ICD-11 codes
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  textArea: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    fontSize: 15,
    lineHeight: 22,
  },
  examplesRow: {
    gap: 8,
    paddingVertical: 2,
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 200,
  },
  exampleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  predictBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
  },
  btnDisabled: { opacity: 0.7 },
  predictBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  aiBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  resultsSection: {
    gap: 10,
  },
  resultsTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  resultsSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  resultTop: {
    flexDirection: "row",
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  resultInfo: {
    flex: 1,
    gap: 3,
  },
  icdCode: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  icdDesc: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  resultBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreArea: {
    flex: 1,
    gap: 6,
  },
  scoreLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  saveBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  savedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
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
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
});
