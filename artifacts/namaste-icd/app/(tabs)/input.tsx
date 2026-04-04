import React, { useState, useRef, useCallback } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { useApi, type PatientSuggestion } from "@/context/ApiContext";
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
  const { predict, saveRecord, searchPatients, extractText } = useApi();
  const C = Colors.light;

  const isPatient = user?.role === "patient";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<IcdMatch[]>([]);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [doctorConfidences, setDoctorConfidences] = useState<Record<string, number>>({});

  const [patientQuery, setPatientQuery] = useState("");
  const [patientSuggestions, setPatientSuggestions] = useState<PatientSuggestion[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handlePatientQueryChange = useCallback((q: string) => {
    setPatientQuery(q);
    setSelectedPatient(null);
    if (patientDebounceRef.current) clearTimeout(patientDebounceRef.current);
    if (!q || q.length < 2) {
      setPatientSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    patientDebounceRef.current = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const results = await searchPatients(q);
        setPatientSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setPatientSuggestions([]);
      } finally {
        setPatientSearching(false);
      }
    }, 350);
  }, [searchPatients]);

  const handleSelectPatient = (patient: PatientSuggestion) => {
    setSelectedPatient(patient);
    setPatientQuery(patient.name);
    setShowSuggestions(false);
    setPatientSuggestions([]);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setPatientQuery("");
    setPatientSuggestions([]);
    setShowSuggestions(false);
  };

  const handleImageExtract = async (base64: string, mimeType: string, displayName: string) => {
    setExtracting(true);
    setUploadedFileName(displayName);
    setError("");
    try {
      const extracted = await extractText(base64, mimeType);
      setText(extracted);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      setError(msg);
      setUploadedFileName(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setExtracting(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: false,
        base64: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Error", "Could not read image data"); return; }
      const mimeType = (asset as any).mimeType || "image/jpeg";
      const displayName = (asset as any).fileName || "photo.jpg";
      await handleImageExtract(asset.base64, mimeType, displayName);
    } catch {
      Alert.alert("Error", "Could not open image library");
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
        base64: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Error", "Could not read image data"); return; }
      await handleImageExtract(asset.base64, "image/jpeg", "camera_photo.jpg");
    } catch {
      Alert.alert("Error", "Could not open camera");
    }
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
    setDoctorConfidences({});
    try {
      const res = await predict(text.trim());
      setResults(res.results);
      setAiAvailable(res.ai_available);
      const initial: Record<string, number> = {};
      res.results.forEach(r => { initial[r.code] = Math.round(r.score * 100); });
      setDoctorConfidences(initial);
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
      const dc = doctorConfidences[match.code] ?? Math.round(match.score * 100);
      await saveRecord({
        input_text: text.trim(),
        selected_icd: match.code,
        icd_description: match.description,
        confidence_score: match.score,
        doctor_confidence: dc,
        patient_id: selectedPatient?.id ?? null,
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

  const adjustConfidence = (code: string, delta: number) => {
    setDoctorConfidences(prev => ({
      ...prev,
      [code]: Math.min(100, Math.max(0, (prev[code] ?? 50) + delta)),
    }));
  };

  if (isPatient) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
            paddingBottom: insets.bottom + 16,
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }
        ]}>
          <View style={[styles.patientIcon, { backgroundColor: "#7C3AED15" }]}>
            <Feather name="user" size={36} color="#7C3AED" />
          </View>
          <Text style={[styles.patientTitle, { color: C.text }]}>Patient Portal</Text>
          <Text style={[styles.patientSubtitle, { color: C.textSecondary }]}>
            Welcome, {user?.name?.split(" ")[0]}. View your diagnoses in the Diagnoses tab, ranked by doctor confidence.
          </Text>
          <View style={[styles.patientBadge, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED30" }]}>
            <Feather name="shield" size={14} color="#7C3AED" />
            <Text style={[styles.patientBadgeText, { color: "#7C3AED" }]}>Patient Account</Text>
          </View>
          <TouchableOpacity
            style={[styles.logoutBtnLarge, { backgroundColor: C.backgroundTertiary }]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={16} color={C.textSecondary} />
            <Text style={[styles.logoutBtnText, { color: C.textSecondary }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          <View style={styles.headerTopRow}>
            <Text style={[styles.greeting, { color: C.textMuted }]}>
              Dr. {user?.name?.split(" ")[0] ?? "Doctor"}
            </Text>
            <View style={[styles.doctorBadge, { backgroundColor: C.tint + "18" }]}>
              <Feather name="briefcase" size={10} color={C.tint} />
              <Text style={[styles.doctorBadgeText, { color: C.tint }]}>Doctor</Text>
            </View>
          </View>
          <Text style={[styles.headerTitle, { color: C.text }]}>Clinical Mapper</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: C.backgroundTertiary }]}>
          <Feather name="log-out" size={18} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: C.backgroundSecondary, shadowColor: C.cardShadow }]}>
        <View style={styles.cardHeader}>
          <Feather name="user-check" size={16} color="#7C3AED" />
          <Text style={[styles.cardLabel, { color: "#7C3AED" }]}>Patient (Optional)</Text>
        </View>
        <View style={styles.patientInputWrap}>
          <View style={[
            styles.patientInputRow,
            {
              borderColor: selectedPatient ? "#7C3AED" : C.border,
              backgroundColor: C.background,
            }
          ]}>
            <Feather name="search" size={15} color={selectedPatient ? "#7C3AED" : C.textMuted} style={styles.patientSearchIcon} />
            <TextInput
              style={[styles.patientInput, { color: C.text }]}
              placeholder="Search patient by name..."
              placeholderTextColor={C.textMuted}
              value={patientQuery}
              onChangeText={handlePatientQueryChange}
              fontFamily="Inter_400Regular"
              returnKeyType="search"
            />
            {patientSearching && <ActivityIndicator size="small" color={C.tint} style={styles.patientLoader} />}
            {selectedPatient && (
              <TouchableOpacity onPress={handleClearPatient} style={styles.clearBtn}>
                <Feather name="x" size={14} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {showSuggestions && patientSuggestions.length > 0 && (
            <View style={[styles.suggestionsList, { backgroundColor: C.backgroundSecondary, borderColor: C.border, shadowColor: C.cardShadow }]}>
              {patientSuggestions.map((pt, idx) => (
                <TouchableOpacity
                  key={pt.id}
                  style={[
                    styles.suggestionItem,
                    idx < patientSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }
                  ]}
                  onPress={() => handleSelectPatient(pt)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.suggestionAvatar, { backgroundColor: "#7C3AED15" }]}>
                    <Feather name="user" size={13} color="#7C3AED" />
                  </View>
                  <Text style={[styles.suggestionName, { color: C.text }]}>{pt.name}</Text>
                  <Feather name="chevron-right" size={14} color={C.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedPatient && (
            <View style={[styles.selectedPatientBanner, { backgroundColor: "#7C3AED10", borderColor: "#7C3AED30" }]}>
              <Feather name="check-circle" size={14} color="#7C3AED" />
              <Text style={[styles.selectedPatientText, { color: "#7C3AED" }]}>
                Diagnosing: {selectedPatient.name}
              </Text>
            </View>
          )}

          {!selectedPatient && !patientQuery && (
            <Text style={[styles.patientHint, { color: C.textMuted }]}>
              Link to a patient so they can see this diagnosis in their portal
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.backgroundSecondary, shadowColor: C.cardShadow }]}>
        <View style={styles.cardHeader}>
          <Feather name="camera" size={16} color="#0891B2" />
          <Text style={[styles.cardLabel, { color: "#0891B2" }]}>Scan Clinical Image (Optional)</Text>
        </View>

        {extracting ? (
          <View style={[styles.uploadLoading, { backgroundColor: "#0891B208" }]}>
            <ActivityIndicator size="small" color="#0891B2" />
            <Text style={[styles.uploadLoadingText, { color: "#0891B2" }]}>Extracting text from document…</Text>
          </View>
        ) : uploadedFileName ? (
          <View style={[styles.uploadedBanner, { backgroundColor: "#0891B210", borderColor: "#0891B230" }]}>
            <Feather name="check-circle" size={14} color="#0891B2" />
            <Text style={[styles.uploadedBannerText, { color: "#0891B2" }]} numberOfLines={1}>
              {uploadedFileName}
            </Text>
            <TouchableOpacity onPress={() => { setUploadedFileName(null); setText(""); }}>
              <Feather name="x" size={14} color="#0891B2" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.uploadHint, { color: C.textMuted }]}>
            Take a photo or select an image to extract clinical text automatically
          </Text>
        )}

        <View style={styles.uploadBtnsRow}>
          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED30" }]}
            onPress={handlePickImage}
            disabled={extracting}
            activeOpacity={0.75}
          >
            <Feather name="image" size={18} color="#7C3AED" />
            <Text style={[styles.uploadBtnText, { color: "#7C3AED" }]}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: "#0891B215", borderColor: "#0891B230" }]}
            onPress={handleCamera}
            disabled={extracting}
            activeOpacity={0.75}
          >
            <Feather name="camera" size={18} color="#0891B2" />
            <Text style={[styles.uploadBtnText, { color: "#0891B2" }]}>Camera</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={[styles.resultsTitle, { color: C.text }]}>ICD-11 Matches</Text>
          <Text style={[styles.resultsSubtitle, { color: C.textSecondary }]}>
            {results.length} results · Set your confidence & confirm
            {selectedPatient ? ` · for ${selectedPatient.name}` : ""}
          </Text>
          {results.map((match, idx) => {
            const isSaved = savedIds.has(match.code);
            const isSavingThis = saving === match.code;
            const dc = doctorConfidences[match.code] ?? Math.round(match.score * 100);
            const dcColor = dc >= 70 ? C.success : dc >= 40 ? C.warning : C.danger;
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

                <View style={styles.aiScoreRow}>
                  <Text style={[styles.scoreLabel, { color: C.textMuted }]}>AI Confidence</Text>
                  <ScoreBar score={match.score} />
                </View>

                <View style={[styles.doctorConfRow, { backgroundColor: C.background, borderRadius: 10, padding: 10 }]}>
                  <View style={styles.dcHeader}>
                    <Feather name="briefcase" size={12} color={dcColor} />
                    <Text style={[styles.dcLabel, { color: C.textMuted }]}>My Confidence</Text>
                    <Text style={[styles.dcValue, { color: dcColor }]}>{dc}%</Text>
                  </View>
                  <View style={styles.dcControls}>
                    {[
                      { label: "-10", delta: -10 },
                      { label: "-5", delta: -5 },
                      { label: "+5", delta: 5 },
                      { label: "+10", delta: 10 },
                    ].map(({ label, delta }) => (
                      <TouchableOpacity
                        key={label}
                        style={[styles.dcBtn, { borderColor: C.border, backgroundColor: C.backgroundSecondary }]}
                        onPress={() => adjustConfidence(match.code, delta)}
                        disabled={isSaved}
                      >
                        <Text style={[styles.dcBtnText, { color: delta > 0 ? C.success : C.danger }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={[styles.dcBar, { backgroundColor: C.border }]}>
                    <View style={[styles.dcFill, { width: `${dc}%` as any, backgroundColor: dcColor }]} />
                  </View>
                </View>

                <View style={styles.resultBottom}>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { backgroundColor: isSaved ? C.success : C.tint, flex: 1 }
                    ]}
                    onPress={() => handleSave(match)}
                    disabled={isSaved || isSavingThis}
                    activeOpacity={0.8}
                  >
                    {isSavingThis ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <View style={styles.saveBtnInner}>
                        <Feather name={isSaved ? "check" : "save"} size={15} color="#fff" />
                        <Text style={styles.saveBtnText}>
                          {isSaved ? "Saved as FHIR" : "Confirm & Save"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
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
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  doctorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  doctorBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
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
  patientInputWrap: { gap: 8 },
  patientInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  patientSearchIcon: { flexShrink: 0 },
  patientInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  patientLoader: { flexShrink: 0 },
  clearBtn: {
    padding: 4,
  },
  suggestionsList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  suggestionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  selectedPatientBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedPatientText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  patientHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
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
  resultsSection: { gap: 10 },
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
  aiScoreRow: {
    gap: 6,
  },
  scoreLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  doctorConfRow: {
    gap: 8,
  },
  dcHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dcLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  dcValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  dcControls: {
    flexDirection: "row",
    gap: 6,
  },
  dcBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  dcBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  dcBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  dcFill: {
    height: "100%",
    borderRadius: 3,
  },
  resultBottom: {
    flexDirection: "row",
    gap: 10,
  },
  saveBtn: {
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
  uploadLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  uploadedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  uploadedBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  uploadHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  uploadBtnsRow: {
    flexDirection: "row",
    gap: 10,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  uploadBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  patientIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  patientTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  patientSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },
  patientBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  patientBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  logoutBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  logoutBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
