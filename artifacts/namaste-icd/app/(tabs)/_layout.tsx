import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, router } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme, TouchableOpacity } from "react-native";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

function NativeTabLayout() {
  const { user } = useAuth();
  const isPatient = user?.role === "patient";
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="input">
        <Icon sf={{ default: "waveform.path.ecg", selected: "waveform.path.ecg" }} />
        <Label>{isPatient ? "Portal" : "Diagnose"}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>{isPatient ? "Diagnoses" : "My Records"}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  const C = Colors.light;
  return (
    <TouchableOpacity
      onPress={async () => {
        await logout();
        router.replace("/auth");
      }}
      style={{ marginRight: 16 }}
    >
      <Feather name="log-out" size={20} color={C.textSecondary} />
    </TouchableOpacity>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const C = Colors.light;
  const { user } = useAuth();
  const isPatient = user?.role === "patient";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.tint,
        tabBarInactiveTintColor: C.tabIconDefault,
        headerShown: true,
        headerStyle: { backgroundColor: C.backgroundSecondary },
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", color: C.text, fontSize: 17 },
        headerRight: () => <LogoutButton />,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#000" : "#fff" }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="input"
        options={{
          title: isPatient ? "Patient Portal" : "Diagnose",
          tabBarLabel: isPatient ? "Portal" : "Diagnose",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="waveform.path.ecg" tintColor={color} size={24} />
            ) : (
              <Feather name={isPatient ? "user" : "activity"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: isPatient ? "Diagnoses" : "My Records",
          tabBarLabel: isPatient ? "Diagnoses" : "My Records",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={24} />
            ) : (
              <Feather name={isPatient ? "clipboard" : "clock"} size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
