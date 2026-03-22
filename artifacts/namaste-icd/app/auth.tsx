import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth, type UserRole } from "@/context/AuthContext";
import Colors from "@/constants/colors";

type AuthMode = "login" | "register";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("doctor");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const C = Colors.light;

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim(), role);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/input");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === "login" ? "register" : "login");
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setRole("doctor");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 40,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: C.tint }]}>
            <Feather name="activity" size={32} color="#fff" />
          </View>
          <Text style={[styles.appTitle, { color: C.text }]}>NAMASTE–ICD11</Text>
          <Text style={[styles.appSubtitle, { color: C.textSecondary }]}>
            Clinical Mapping Intelligence
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.backgroundSecondary, shadowColor: C.cardShadow }]}>
          <Text style={[styles.cardTitle, { color: C.text }]}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={[styles.cardSubtitle, { color: C.textSecondary }]}>
            {mode === "login" ? "Sign in to continue" : "Join NAMASTE–ICD11"}
          </Text>

          {mode === "register" && (
            <>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    { borderColor: role === "doctor" ? C.tint : C.border },
                    role === "doctor" && { backgroundColor: C.tint + "15" }
                  ]}
                  onPress={() => setRole("doctor")}
                  activeOpacity={0.8}
                >
                  <Feather name="briefcase" size={18} color={role === "doctor" ? C.tint : C.textMuted} />
                  <Text style={[styles.roleLabel, { color: role === "doctor" ? C.tint : C.textMuted }]}>
                    Doctor
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    { borderColor: role === "patient" ? "#7C3AED" : C.border },
                    role === "patient" && { backgroundColor: "#7C3AED15" }
                  ]}
                  onPress={() => setRole("patient")}
                  activeOpacity={0.8}
                >
                  <Feather name="user" size={18} color={role === "patient" ? "#7C3AED" : C.textMuted} />
                  <Text style={[styles.roleLabel, { color: role === "patient" ? "#7C3AED" : C.textMuted }]}>
                    Patient
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { borderColor: C.border, backgroundColor: C.inputBackground }]}>
                <Feather name="user" size={18} color={C.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: C.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Full name"
                  placeholderTextColor={C.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          <View style={[styles.inputGroup, { borderColor: C.border, backgroundColor: C.inputBackground }]}>
            <Feather name="mail" size={18} color={C.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: C.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Email address"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={[styles.inputGroup, { borderColor: C.border, backgroundColor: C.inputBackground }]}>
            <Feather name="lock" size={18} color={C.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: C.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Password"
              placeholderTextColor={C.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {error !== "" && (
            <View style={[styles.errorBanner, { backgroundColor: "#FEE8E8" }]}>
              <Feather name="alert-circle" size={14} color={C.danger} />
              <Text style={[styles.errorText, { color: C.danger }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: C.tint }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === "login" ? "Sign In" : `Create ${role === "patient" ? "Patient" : "Doctor"} Account`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={switchMode} style={styles.switchMode}>
          <Text style={[styles.switchText, { color: C.textSecondary }]}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <Text style={[styles.switchLink, { color: C.tint }]}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.demoHint}>
          <Feather name="info" size={12} color={C.textMuted} />
          <Text style={[styles.demoText, { color: C.textMuted }]}>
            Doctors diagnose · Patients view ranked results
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1B6CA8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  roleLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  eyeButton: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  switchMode: {
    alignItems: "center",
    marginTop: 24,
    padding: 8,
  },
  switchText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  switchLink: {
    fontFamily: "Inter_600SemiBold",
  },
  demoHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 8,
  },
  demoText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
