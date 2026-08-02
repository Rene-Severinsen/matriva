import { StatusBar } from "expo-status-bar";

import { theme } from "./theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { WebView } from "react-native-webview";
import { createMatrivaApiClient } from "@matriva/api-client";
import {
  type AddressSuggestion,
  type AppBootstrapResponse,
  type CreateHouseImprovementRequest,
  type CreateMaintenanceTaskRequest,
  type CurrentUser,
  type HouseId,
  type HouseDocument,
  type HouseDocumentCategory,
  type HouseDocumentType,
  type UploadHouseDocumentRequest,
  type HouseImprovement,
  type HouseImprovementCategory,
  type HouseMedia,
  type HousePublicDataProfileFact,
  type HousePublicDataProfileV1,
  type HousePublicDataWithProfileResponseV1,
  type HousePublicDataSummary,
  type HousePublicDataSummaryField,
  type HousePublicDataSummaryValue,
  type MaintenanceHistoryEntry,
  type MaintenanceHistoryDetail,
  type MaintenanceRecommendation,
  type MaintenanceTask,
  formatDkkPrice,
  maintenanceTaskMatchesSeason,
  maintenanceTaskSeason,
  parseDanishPriceInput,
  type SavedHouse,
  type SelectedAddressInput,
  type SessionTokens,
  type TaskId,
  type UserProfile
} from "@matriva/shared";
import { houseDocumentCategoryForType } from "@matriva/shared";

import { matrivaApiConfig } from "./config/api";
import { clearStoredSession, readStoredSession, writeStoredSession } from "./auth/sessionStorage";
import { SwipeActionRow } from "./components/SwipeActionRow";
import {
  markMaintenanceSwipeHintSeen,
  readMaintenanceSwipeHintSeen
} from "./storage/uiPreferencesStorage";

type TabKey = "dashboard" | "house" | "maintenance" | "documents" | "more";
type LoadingAction = "app" | "auth" | "profile" | "address" | "house" | "task" | "publicData" | "improvement" | "photo" | "recommendation" | "logout";
type MaintenanceFilter = "current" | "spring" | "summer" | "autumn" | "winter" | "all";
type MaintenanceView = "main" | "history" | "historyDetail" | "taskDetail" | "recommendations";
type AuthStatus = "restoring" | "anonymous" | "authenticated";
type MoreView = "menu" | "profile" | "settings";
type HouseView = "overview" | "details" | "improvements" | "addImprovement";
type UnauthenticatedStep = "welcome" | "create" | "login";
type HouseOnboardingStep = "search" | "confirm" | "progress" | "publicDataIssue";
type PublicDataRefreshMessage = {
  tone: "success" | "warning";
  text: string;
};

type Tab = {
  key: TabKey;
  label: string;
  icon: "view-dashboard-outline" | "check-bold" | "file-document-outline" | "dots-horizontal";
};

const tabs: Tab[] = [
  { key: "dashboard", icon: "view-dashboard-outline", label: "Dashboard" },
  { key: "house", icon: "view-dashboard-outline", label: "Mit hus" },
  { key: "maintenance", icon: "check-bold", label: "Vedligehold" },
  { key: "documents", icon: "file-document-outline", label: "Dokumenter" },
  { key: "more", icon: "dots-horizontal", label: "Mere" }
];

const houseHeroPlaceholder = require("../assets/onboarding/house-hero-placeholder.png");
const welcomeHeroImage = require("../assets/onboarding/welcome-hero.png");
const matrivaSymbol = require("../assets/onboarding/matriva-symbol.png");
const welcomeBottomFadeImage = require("../assets/onboarding/welcome-bottom-fade.png");

function selectedAddressInput(
  suggestion: AddressSuggestion
): SelectedAddressInput {
  return {
    source: suggestion.source,
    sourceAddressId: suggestion.sourceAddressId,
    sourceAccessAddressId: suggestion.sourceAccessAddressId,
    label: suggestion.label
  };
}

function userFacingError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Matriva kunne ikke gennemføre handlingen. Prøv igen om lidt.";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  ) {
    return "Matriva kunne ikke få forbindelse. Tjek at forbindelsen er aktiv, og prøv igen.";
  }

  return error.message;
}

function publicDataIsUsableAfterOnboarding(
  publicData: HousePublicDataWithProfileResponseV1
) {
  return (
    publicData.status === "success" ||
    publicData.status === "partial" ||
    publicData.status === "ambiguous"
  );
}

function publicDataIssueMessage(
  status: HousePublicDataWithProfileResponseV1["status"]
) {
  if (status === "not_found") {
    return "Boligen er gemt, men BBR fandt ikke oplysninger for adressen.";
  }

  if (status === "temporarily_unavailable") {
    return "Boligen er gemt, men vi kunne ikke hente BBR-oplysningerne lige nu.";
  }

  return "Boligen er gemt, men BBR-oplysningerne kunne ikke hentes lige nu.";
}

function priceInputErrorMessage(code: "negative" | "invalid" | "too_many_decimals" | "too_large") {
  if (code === "negative") {
    return "Prisen må ikke være negativ.";
  }

  if (code === "too_many_decimals") {
    return "Prisen må højst have to decimaler.";
  }

  if (code === "too_large") {
    return "Prisen er for høj.";
  }

  return "Indtast en gyldig pris.";
}

function editablePriceValue(amountMinor: number | null) {
  return amountMinor !== null ? formatDkkPrice(amountMinor).replace(/\s?kr\.$/, "") : "";
}

function formatStatus(status: MaintenanceTask["status"]) {
  const labels: Record<MaintenanceTask["status"], string> = {
    suggested: "Forslag",
    planned: "Planlagt",
    due: "Forfalder",
    overdue: "Overskredet",
    done: "Udført",
    dismissed: "Skjult",
    rescheduled: "Flyttet"
  };

  return labels[status];
}

function formatSource(source: MaintenanceTask["source"]) {
  return source === "user_created" ? "Oprettet af dig" : "Anbefalet";
}

function isActiveMaintenanceTask(task: MaintenanceTask) {
  return task.status !== "done" && task.status !== "dismissed";
}

function isTaskOverdueForDisplay(task: MaintenanceTask) {
  if (task.status === "overdue" || !!task.timing.daysOverdue) {
    return true;
  }

  return (
    isActiveMaintenanceTask(task) &&
    task.timing.type === "specific_deadline" &&
    !!task.timing.dueDate &&
    task.timing.dueDate < todayDateOnly()
  );
}

function maintenanceTaskDueDate(task: MaintenanceTask) {
  return task.timing.type === "specific_deadline" ? task.timing.dueDate ?? null : null;
}

function compareMaintenanceTasksByDueDate(a: MaintenanceTask, b: MaintenanceTask) {
  const aDueDate = maintenanceTaskDueDate(a);
  const bDueDate = maintenanceTaskDueDate(b);

  if (aDueDate && bDueDate && aDueDate !== bDueDate) {
    return aDueDate.localeCompare(bDueDate);
  }

  if (aDueDate && !bDueDate) {
    return -1;
  }

  if (!aDueDate && bDueDate) {
    return 1;
  }

  return a.title.localeCompare(b.title, "da");
}

function formatTiming(task: MaintenanceTask) {
  if (task.timing.type === "seasonal_window" && task.timing.season) {
    const seasonLabels: Record<NonNullable<MaintenanceTask["timing"]["season"]>, string> = {
      spring: "Forår",
      summer: "Sommer",
      autumn: "Efterår",
      winter: "Vinter",
      all_year: "Hele året"
    };

    return seasonLabels[task.timing.season];
  }

  if (task.timing.type !== "specific_deadline" || !task.timing.dueDate) {
    return "Ingen deadline";
  }

  const dueDate = formatDisplayDate(task.timing.dueDate);

  if (task.timing.daysOverdue) {
    return `Deadline ${dueDate} · overskredet med ${task.timing.daysOverdue} dage`;
  }

  if (task.timing.daysUntilDue === 0) {
    return `Deadline ${dueDate} · i dag`;
  }

  if (task.timing.daysUntilDue !== undefined) {
    return `Deadline ${dueDate} · om ${task.timing.daysUntilDue} dage`;
  }

  return `Deadline ${dueDate}`;
}

function visibleTaskDescription(task: MaintenanceTask) {
  if (!task.description) {
    return null;
  }

  const lowerDescription = task.description.toLowerCase();

  if (lowerDescription.includes("persisted smoke")) {
    return null;
  }

  return task.description;
}

function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const danishMonthNames = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december"
];

function todayDateOnly() {
  return dateOnlyFromDate(new Date());
}

function dateOnlyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function datePartsFromDateOnly(dateOnly: string) {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = dateOnly.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  return {
    day,
    monthIndex: month - 1,
    year
  };
}

function dateFromDateOnly(dateOnly: string) {
  const { day, monthIndex, year } = datePartsFromDateOnly(dateOnly);

  return new Date(year, monthIndex, day);
}

function formatDisplayDate(dateOnly: string) {
  if (!validDateOnly(dateOnly)) {
    return "";
  }

  const { day, monthIndex, year } = datePartsFromDateOnly(dateOnly);
  const displayDay = `${day}`.padStart(2, "0");
  const displayMonth = `${monthIndex + 1}`.padStart(2, "0");

  return `${displayDay}-${displayMonth}-${year}`;
}

function SectionHeader({
  title,
  eyebrow,
  subtitle
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Card({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "soft" | "plain";
}) {
  return (
    <View
      style={[
        styles.card,
        variant === "soft" ? styles.softCard : null,
        variant === "plain" ? styles.plainCard : null
      ]}
    >
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  loading,
  disabled,
  compact,
  onPress
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      hitSlop={compact ? 4 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        compact ? styles.compactFormButton : null,
        pressed && !disabled && !loading ? styles.primaryButtonPressed : null,
        disabled || loading ? styles.disabled : null
      ]}
    >
      {loading ? <ActivityIndicator color={theme.surface} /> : null}
      <Text style={[styles.primaryButtonText, compact ? styles.compactFormButtonText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  disabled,
  compact,
  onPress
}: {
  label: string;
  disabled?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={compact ? 4 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        compact ? styles.compactFormButton : null,
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      <Text style={[styles.secondaryButtonText, compact ? styles.compactFormButtonText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DeadlineDatePicker({
  visible,
  selectedDate,
  title,
  onClose,
  onClear,
  onSelect
}: {
  visible: boolean;
  selectedDate: string;
  title?: string;
  onClose: () => void;
  onClear: () => void;
  onSelect: (dateOnly: string) => void;
}) {
  const [draftDate, setDraftDate] = useState(selectedDate || todayDateOnly());

  useEffect(() => {
    if (visible) {
      setDraftDate(selectedDate || todayDateOnly());
    }
  }, [selectedDate, visible]);

  if (!visible) {
    return null;
  }

  const pickerValue = dateFromDateOnly(draftDate);
  const isIos = Platform.OS === "ios";

  function handleDateChange(event: DateTimePickerEvent, date?: Date) {
    if (event.type === "dismissed") {
      onClose();
      return;
    }

    if (date) {
      const nextDate = dateOnlyFromDate(date);
      setDraftDate(nextDate);

      if (!isIos) {
        onSelect(nextDate);
      }
    }

    if (!isIos) {
      onClose();
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.datePickerBackdrop}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.datePickerDismissArea}
        />
        <View style={styles.nativeDatePickerPanel}>
          <View style={styles.datePickerHeader}>
            <View>
              <Text style={styles.cardTitle}>{title ?? "Vælg deadline"}</Text>
              <Text style={styles.compactBodyText}>
                {selectedDate ? formatDisplayDate(selectedDate) : "Ingen dato valgt"}
              </Text>
            </View>
            {isIos ? <SecondaryButton label="Luk" onPress={onClose} /> : null}
          </View>

          <DateTimePicker
            display={isIos ? "inline" : "default"}
            locale="da-DK"
            mode="date"
            onChange={handleDateChange}
            value={pickerValue}
          />

          {isIos ? (
            <View style={styles.datePickerFooter}>
              <SecondaryButton label="Fjern dato" disabled={!selectedDate} onPress={onClear} />
              <PrimaryButton label="Vælg dato" onPress={() => { onSelect(draftDate); onClose(); }} />
            </View>
          ) : (
            <View style={styles.datePickerFooter}>
              <SecondaryButton label="Fjern dato" disabled={!selectedDate} onPress={onClear} />
              <SecondaryButton label="Luk" onPress={onClose} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CompletionNoteModal({
  visible,
  note,
  doNotAskAgain,
  isSaving,
  error,
  onNoteChange,
  onDoNotAskAgainChange,
  onCancel,
  onSave
}: {
  visible: boolean;
  note: string;
  doNotAskAgain: boolean;
  isSaving: boolean;
  error: string | null;
  onNoteChange: (value: string) => void;
  onDoNotAskAgainChange: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.datePickerBackdrop}>
        <Pressable onPress={onCancel} style={styles.datePickerDismissArea} />
        <View style={styles.nativeDatePickerPanel}>
          <Text style={styles.cardTitle}>Opgaven er udført</Text>
          <Text style={styles.compactBodyText}>Vil du tilføje en note om arbejdet?</Text>
          <TextInput
            accessibilityLabel="Note om arbejdet"
            multiline
            maxLength={1200}
            onChangeText={onNoteChange}
            placeholder="Fx hvad der blev gjort, observationer eller materialer"
            placeholderTextColor={theme.muted}
            style={[styles.input, styles.textArea]}
            value={note}
          />
          <View style={styles.settingsRow}>
            <View style={styles.settingsTextGroup}>
              <Text style={styles.menuText}>Vis ikke dette spørgsmål fremover</Text>
            </View>
            <Switch
              onValueChange={onDoNotAskAgainChange}
              trackColor={{ false: theme.border, true: theme.primarySoft }}
              thumbColor={doNotAskAgain ? theme.primary : theme.muted}
              value={doNotAskAgain}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.buttonRow}>
            <SecondaryButton disabled={isSaving} label="Annuller" onPress={onCancel} />
            <PrimaryButton loading={isSaving} label="Gem som udført" onPress={onSave} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReverseMaintenanceModal({
  visible,
  recurring,
  note,
  noteHandling,
  isSaving,
  error,
  onNoteHandlingChange,
  onCancel,
  onSave
}: {
  visible: boolean;
  recurring: boolean;
  note: string | null;
  noteHandling: "keep_as_draft" | "discard";
  isSaving: boolean;
  error: string | null;
  onNoteHandlingChange: (value: "keep_as_draft" | "discard") => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const hasNote = Boolean(note?.trim());

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.datePickerBackdrop}>
        <Pressable onPress={onCancel} style={styles.datePickerDismissArea} />
        <View style={styles.reverseModalPanel}>
          <View style={styles.reverseModalHeader}>
            <Text style={styles.cardTitle}>Læg opgaven tilbage?</Text>
            <Text style={styles.compactBodyText}>
            {recurring
              ? "Opgaven bliver aktiv igen. Den næste automatisk oprettede opgave fjernes samtidig, hvis den stadig er urørt."
              : "Opgaven bliver aktiv igen."}
            </Text>
          </View>
          {hasNote ? (
            <View style={styles.reverseNoteCard}>
              <Text style={styles.sectionEyebrow}>Note fra udførelsen</Text>
              <Text numberOfLines={4} style={styles.reverseNoteText}>{note}</Text>
              {([[
                "keep_as_draft",
                "Behold som kladde",
                "Noten kan bruges, når opgaven fuldføres igen."
              ], ["discard", "Fjern note", "Noten gemmes stadig i audit-historikken."]] as const).map(([value, label, detail]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: noteHandling === value }}
                  key={value}
                  onPress={() => onNoteHandlingChange(value)}
                  style={({ pressed }) => [
                    styles.reverseNoteOption,
                    noteHandling === value ? styles.reverseNoteOptionSelected : null,
                    pressed ? styles.reverseNoteOptionPressed : null
                  ]}
                >
                  <View style={styles.reverseNoteOptionCopy}>
                    <Text style={styles.reverseNoteOptionTitle}>{label}</Text>
                    <Text style={styles.reverseNoteOptionDetail}>{detail}</Text>
                  </View>
                  <View style={[styles.reverseRadio, noteHandling === value ? styles.reverseRadioSelected : null]}>
                    {noteHandling === value ? <Text style={styles.reverseRadioCheck}>✓</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.buttonRow}>
            <SecondaryButton disabled={isSaving} label="Annuller" onPress={onCancel} />
            <PrimaryButton loading={isSaving} label="Læg tilbage" onPress={onSave} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Pill({ children, tone = "default" }: { children: string; tone?: "default" | "warning" }) {
  return (
    <View style={[styles.pill, tone === "warning" ? styles.warningPill : null]}>
      <Text style={[styles.pillText, tone === "warning" ? styles.warningPillText : null]}>
        {children}
      </Text>
    </View>
  );
}

function EmptyState({
  title,
  body,
  compact = false
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <Card variant="soft">
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={compact ? styles.compactBodyText : styles.bodyText}>{body}</Text>
    </Card>
  );
}

function HouseStatusCard({
  house,
  publicDataSummary
}: {
  house: SavedHouse;
  publicDataSummary?: HousePublicDataSummary | null;
}) {
  const hasPublicData =
    publicDataSummary?.status === "available" ||
    publicDataSummary?.status === "partial" ||
    publicDataSummary?.status === "ambiguous";

  return (
    <Card variant="plain">
      <View style={styles.houseHeroTop}>
        <View style={styles.houseGlyph}>
          <Text style={styles.houseGlyphText}>M</Text>
        </View>
        <View style={styles.houseHeroText}>
          <Text style={styles.houseLabel}>Dit gemte hus</Text>
          <Text style={styles.houseAddress}>{house.addressLabel}</Text>
        </View>
      </View>
      <View style={styles.pillRow}>
        <Pill>Gemt hus</Pill>
        <Pill tone={hasPublicData ? "default" : "warning"}>
          {hasPublicData ? publicDataSummary.sourceLabel : "BBR-oplysninger mangler"}
        </Pill>
      </View>
    </Card>
  );
}

function PublicDataSummaryPanel({
  summary,
  profile,
  isRefreshing,
  refreshMessage,
  onRefresh
}: {
  summary: HousePublicDataSummary | null;
  profile: HousePublicDataProfileV1 | null;
  isRefreshing: boolean;
  refreshMessage: PublicDataRefreshMessage | null;
  onRefresh: () => void;
}) {
  const refreshButtonLabel = isRefreshing ? "Opdaterer..." : "Opdater BBR";
  const refreshMessageStyle =
    refreshMessage?.tone === "success" ? styles.successText : styles.refreshWarningText;

  if (!summary || summary.status === "not_started" || summary.status === "loading") {
    return (
      <Card>
        <Text style={styles.cardTitle}>BBR-oplysninger</Text>
        <Text style={styles.bodyText}>
          Matriva henter offentlige oplysninger automatisk efter huset er gemt.
        </Text>
        <Text style={styles.metaText}>Registreret i BBR</Text>
        <View style={styles.summaryActions}>
          <SecondaryButton
            label={refreshButtonLabel}
            disabled={isRefreshing}
            onPress={onRefresh}
          />
        </View>
        {refreshMessage ? (
          <Text style={[styles.refreshMessageText, refreshMessageStyle]}>
            {refreshMessage.text}
          </Text>
        ) : null}
      </Card>
    );
  }

  if (
    summary.status === "not_found" ||
    summary.status === "temporarily_unavailable" ||
    summary.status === "failed"
  ) {
    return (
      <Card>
        <Text style={styles.cardTitle}>BBR-oplysninger</Text>
        <Text style={styles.bodyText}>
          Matriva kunne ikke hente offentlige oplysninger lige nu. Dit gemte hus er
          stadig oprettet.
        </Text>
        <Text style={styles.metaText}>Registreret i BBR</Text>
        <View style={styles.summaryActions}>
          <SecondaryButton
            label={refreshButtonLabel}
            disabled={isRefreshing}
            onPress={onRefresh}
          />
        </View>
        {refreshMessage ? (
          <Text style={[styles.refreshMessageText, refreshMessageStyle]}>
            {refreshMessage.text}
          </Text>
        ) : null}
      </Card>
    );
  }

  if (profile) {
    return (
      <Card>
        <View style={styles.cardHeaderRow}>
          <View style={styles.taskTitleGroup}>
            <Text style={styles.cardTitle}>{profile.title}</Text>
            {profile.subtitle ? (
              <Text style={styles.metaText}>{profile.subtitle}</Text>
            ) : null}
            <Text style={styles.metaText}>
              {profile.sourceLabel}
              {profile.fetchedAt ? ` · ${new Date(profile.fetchedAt).toLocaleDateString("da-DK")}` : ""}
            </Text>
          </View>
          {profile.status === "partial" || profile.status === "ambiguous" ? (
            <Pill tone="warning">
              {profile.status === "ambiguous" ? "Kræver afklaring" : "Delvist opslag"}
            </Pill>
          ) : null}
        </View>

        <ProfileFactGrid facts={profile.topFacts} />

        <View style={styles.summaryActions}>
          <SecondaryButton
            label={refreshButtonLabel}
            disabled={isRefreshing}
            onPress={onRefresh}
          />
        </View>
        {refreshMessage ? (
          <Text style={[styles.refreshMessageText, refreshMessageStyle]}>
            {refreshMessage.text}
          </Text>
        ) : null}

        {profile.sections.map((section, index) => (
          <ProfileSection
            key={section.key}
            section={section}
            defaultExpanded={index < 2}
          />
        ))}
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.cardHeaderRow}>
        <View style={styles.taskTitleGroup}>
          <Text style={styles.cardTitle}>Husprofil</Text>
          <Text style={styles.metaText}>{summary.sourceLabel}</Text>
        </View>
        {summary.status === "partial" || summary.status === "ambiguous" ? (
          <Pill tone="warning">
            {summary.status === "ambiguous" ? "Kræver afklaring" : "Delvist opslag"}
          </Pill>
        ) : null}
      </View>

      {summary.primary.title ? (
        <Text style={styles.publicDataTitle}>{summary.primary.title}</Text>
      ) : null}

      {summary.primary.values.length > 0 ? (
        <View style={styles.infoList}>
          {summary.primary.values.map((item) => (
            <InfoRow
              key={item.key}
              label={publicDataFieldLabels[item.key]}
              value={formatPublicDataValue(item)}
            />
          ))}
        </View>
      ) : null}

      {summary.existingOtherBuildingCount > 0 ? (
        <View style={styles.detailGroup}>
          <Text style={styles.detailTitle}>
            Øvrige bygninger registreret i BBR
          </Text>
          {summary.otherBuildings.map((building) => (
            <View key={building.bbrBuildingId} style={styles.publicBuildingRow}>
              <Text style={styles.taskRowTitle}>{building.title}</Text>
              {building.values.map((item) => (
                <Text key={item.key} style={styles.metaText}>
                  {publicDataFieldLabels[item.key]}: {formatPublicDataValue(item)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {summary.projectedBuildingCount > 0 ? (
        <Text style={styles.metaText}>
          Der findes også {summary.projectedBuildingCount} projekterede bygninger
          registreret i BBR.
        </Text>
      ) : null}

      {summary.missingDataNotice ? (
        <Text style={styles.metaText}>{summary.missingDataNotice}</Text>
      ) : null}

      <View style={styles.summaryActions}>
        <SecondaryButton
          label={refreshButtonLabel}
          disabled={isRefreshing}
          onPress={onRefresh}
        />
      </View>
      {refreshMessage ? (
        <Text style={[styles.refreshMessageText, refreshMessageStyle]}>
          {refreshMessage.text}
        </Text>
      ) : null}
    </Card>
  );
}

function MaintenanceSummary({
  activeTasks,
  overdueTasks,
  upcomingTasks,
  onCreateTask,
  onOpenTasks
}: {
  activeTasks: MaintenanceTask[];
  overdueTasks: MaintenanceTask[];
  upcomingTasks: MaintenanceTask[];
  onCreateTask: () => void;
  onOpenTasks: () => void;
}) {
  const taskPreview = overdueTasks[0] ?? upcomingTasks[0] ?? activeTasks[0] ?? null;
  const taskPreviewDescription = taskPreview ? visibleTaskDescription(taskPreview) : null;
  const taskPreviewIsOverdue = taskPreview ? isTaskOverdueForDisplay(taskPreview) : false;

  return (
    <Card>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryTitleGroup}>
          <Text style={styles.cardTitle}>Vedligehold</Text>
          <Text style={styles.compactBodyText}>
            {activeTasks.length === 0
              ? "Ingen aktive opgaver lige nu."
              : overdueTasks.length > 0
                ? `${overdueTasks.length} kræver opmærksomhed.`
                : `${activeTasks.length} aktive opgaver.`
            }
          </Text>
        </View>
        <SecondaryButton label="Se opgaver" onPress={onOpenTasks} />
      </View>

      <View style={styles.summaryStats}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatValue}>{activeTasks.length}</Text>
          <Text style={styles.summaryStatLabel}>Aktive</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatValue, overdueTasks.length > 0 ? styles.warningText : null]}>
            {overdueTasks.length}
          </Text>
          <Text style={styles.summaryStatLabel}>Overskredet</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatValue}>{upcomingTasks.length}</Text>
          <Text style={styles.summaryStatLabel}>Næste 30 dage</Text>
        </View>
      </View>

      {taskPreview ? (
        <View style={styles.summaryTaskPreview}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.taskTitleGroup}>
              <Text style={styles.cardTitle}>{taskPreview.title}</Text>
              <Text style={styles.taskTiming}>{formatTiming(taskPreview)}</Text>
            </View>
            <Pill
              tone={taskPreviewIsOverdue ? "warning" : "default"}
            >
              {formatStatus(taskPreviewIsOverdue ? "overdue" : taskPreview.status)}
            </Pill>
          </View>
          {taskPreviewDescription ? (
            <Text style={styles.compactBodyText}>{taskPreviewDescription}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.summaryEmpty}>
          <Text style={styles.emptyTitle}>Ingen opgaver kræver opmærksomhed</Text>
          <Text style={styles.compactBodyText}>
            Du kan oprette en opgave, når noget skal planlægges.
          </Text>
        </View>
      )}

      <View style={styles.summaryActions}>
        <PrimaryButton label="Opret opgave" onPress={onCreateTask} />
      </View>
    </Card>
  );
}

function InfoRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const publicDataFieldLabels: Record<HousePublicDataSummaryField, string> = {
  use: "Anvendelse",
  residential_area_m2: "Boligareal",
  construction_year: "Opførelsesår",
  room_count: "Værelser",
  bathroom_count: "Badeværelser",
  basement_area_m2: "Kælderareal",
  heating_installation: "Varmeinstallation",
  heating_source: "Opvarmningsmiddel",
  supplementary_heating: "Supplerende varme",
  other_existing_building_count: "Øvrige bygninger",
  area_m2: "Areal"
};

function formatPublicDataValue(item: HousePublicDataSummaryValue) {
  return item.unit === "m2" ? `${item.value} m²` : `${item.value}`;
}

const overviewFactOrder = [
  "housing_type",
  "residential_area",
  "construction_year",
  "rooms",
  "heating",
  "cadastral_number"
] as const;

const overviewFactLabels: Record<(typeof overviewFactOrder)[number], string> = {
  housing_type: "Boligtype",
  residential_area: "Samlet areal",
  construction_year: "Byggeår",
  rooms: "Værelser",
  heating: "Varme",
  cadastral_number: "Matrikel"
};

const overviewFactIcons: Record<(typeof overviewFactOrder)[number], string> = {
  housing_type: "⌂",
  residential_area: "⌗",
  construction_year: "◷",
  rooms: "▦",
  heating: "♨",
  cadastral_number: "⌖"
};

const improvementCategoryLabels: Record<HouseImprovementCategory, string> = {
  windows_doors: "Vinduer og døre",
  roof: "Tag",
  heating_energy: "Varme og energi",
  kitchen: "Køkken",
  bathroom: "Badeværelse",
  installations: "Installationer",
  extension: "Tilbygning",
  outdoor: "Udendørs",
  other: "Andet"
};

const improvementCategories = Object.entries(improvementCategoryLabels) as Array<
  [HouseImprovementCategory, string]
>;

function compactHouseType(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("fritliggende") || lower.includes("enfamiliehus")) {
    return "Villa";
  }

  if (lower.includes("række") || lower.includes("kæde")) {
    return "Rækkehus";
  }

  if (lower.includes("ejerlejlighed")) {
    return "Ejerlejlighed";
  }

  if (lower.includes("etagebolig") || lower.includes("flerfamiliehus")) {
    return "Lejlighed";
  }

  if (lower.includes("egentlig beboelseslejlighed")) {
    return "Bolig";
  }

  if (lower.includes("lejlighed")) {
    return "Lejlighed";
  }

  if (lower.includes("sommer")) {
    return "Sommerhus";
  }

  return value.length > 28 ? value.slice(0, 25).trimEnd() + "..." : value;
}

function compactHeating(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("fjernvarme")) {
    return "Fjernvarme";
  }

  if (lower.includes("varmepumpe")) {
    return "Varmepumpe";
  }

  if (lower.includes("centralvarme")) {
    return "Centralvarme";
  }

  return value.length > 28 ? value.slice(0, 25).trimEnd() + "..." : value;
}

function productFactValue(fact: HousePublicDataProfileFact | undefined) {
  if (!fact || fact.availability !== "value") {
    return "Ikke registreret";
  }

  const formatted = formatProfileFact(fact);

  if (!formatted) {
    return "Ikke registreret";
  }

  if (fact.key === "housing_type") {
    return compactHouseType(formatted);
  }

  if (fact.key === "heating") {
    return compactHeating(formatted);
  }

  return formatted;
}

function productHouseTypeValue(
  unitHousingFact: HousePublicDataProfileFact | undefined,
  buildingUseFact: HousePublicDataProfileFact | undefined
) {
  const preferredFact =
    buildingUseFact?.availability === "value" ? buildingUseFact : unitHousingFact;

  if (!preferredFact || preferredFact.availability !== "value") {
    return "Ikke registreret";
  }

  const formatted = formatProfileFact(preferredFact);
  return formatted ? compactHouseType(formatted) : "Ikke registreret";
}

function productHeatingValue(
  installationFact: HousePublicDataProfileFact | undefined,
  sourceFact: HousePublicDataProfileFact | undefined
) {
  const installation = productFactValue(installationFact);
  const source =
    sourceFact?.availability === "value" ? formatProfileFact(sourceFact) : null;

  if (!source) {
    return installation;
  }

  return installation === "Ikke registreret" ? source : `${installation} · ${source}`;
}

function numericProfileFactValue(fact: HousePublicDataProfileFact | undefined) {
  return fact?.availability === "value" && typeof fact.value === "number"
    ? fact.value
    : null;
}

function productTotalAreaValue(
  buildingAreaFact: HousePublicDataProfileFact | undefined,
  residentialAreaFact: HousePublicDataProfileFact | undefined,
  basementAreaFact: HousePublicDataProfileFact | undefined
) {
  const mainArea =
    numericProfileFactValue(buildingAreaFact) ??
    numericProfileFactValue(residentialAreaFact);
  const basementArea = numericProfileFactValue(basementAreaFact);

  if (mainArea === null && basementArea === null) {
    return "Ikke registreret";
  }

  return `${(mainArea ?? 0) + (basementArea ?? 0)} m²`;
}

function updatedAtLabel(value: string | null | undefined) {
  if (!value) {
    return "Ikke opdateret endnu";
  }

  return `Opdateret ${new Date(value).toLocaleDateString("da-DK")}`;
}

function improvementDateLabel(improvement: HouseImprovement) {
  if (improvement.improvementDate) {
    return formatDisplayDate(improvement.improvementDate);
  }

  return improvement.improvementYear ? `${improvement.improvementYear}` : "Ikke dateret";
}

function improvementMeta(improvement: HouseImprovement) {
  const parts = [improvementDateLabel(improvement)];

  if (improvement.documentReference) {
    parts.push("Dokument vedhæftet");
  }

  if (improvement.costAmountMinor !== null && improvement.costCurrency) {
    parts.push(
      new Intl.NumberFormat("da-DK", {
        style: "currency",
        currency: improvement.costCurrency
      }).format(improvement.costAmountMinor / 100)
    );
  }

  return parts.join(" · ");
}

function formatProfileFact(fact: HousePublicDataProfileFact) {
  if (fact.availability === "not_relevant") {
    return null;
  }

  if (fact.value !== null && fact.value !== undefined) {
    return fact.unit === "m2" ? `${fact.value} m²` : `${fact.value}`;
  }

  if (fact.availability === "source_unavailable") {
    return "Ikke tilgængeligt fra datakilden";
  }

  if (fact.availability === "fetch_failed") {
    return "Kunne ikke hentes ved seneste opdatering";
  }

  return "Ikke registreret i BBR";
}

function visibleProfileFacts(facts: HousePublicDataProfileFact[]) {
  return facts.filter((fact) => fact.availability !== "not_relevant");
}

function ProfileFactList({ facts }: { facts: HousePublicDataProfileFact[] }) {
  const visibleFacts = visibleProfileFacts(facts);

  if (visibleFacts.length === 0) {
    return null;
  }

  return (
    <View style={styles.infoList}>
      {visibleFacts.map((fact) => {
        const value = formatProfileFact(fact);

        return value ? (
          <InfoRow key={fact.key} label={fact.label} value={value} />
        ) : null;
      })}
    </View>
  );
}

function ProfileFactGrid({ facts }: { facts: HousePublicDataProfileFact[] }) {
  const visibleFacts = visibleProfileFacts(facts).filter(
    (fact) => fact.availability === "value"
  );

  if (visibleFacts.length === 0) {
    return null;
  }

  return (
    <View style={styles.profileFactGrid}>
      {visibleFacts.slice(0, 6).map((fact) => (
        <View key={fact.key} style={styles.profileFactCard}>
          <Text style={styles.profileFactIcon}>⌂</Text>
          <Text style={styles.profileFactLabel}>{fact.label}</Text>
          <Text style={styles.profileFactValue}>{formatProfileFact(fact)}</Text>
        </View>
      ))}
    </View>
  );
}

function ProfileSection({
  section,
  defaultExpanded = false
}: {
  section: HousePublicDataProfileV1["sections"][number];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const visibleFacts = visibleProfileFacts(section.facts);
  const buildingCount = section.buildings?.length ?? 0;

  if (visibleFacts.length === 0 && buildingCount === 0) {
    return null;
  }

  return (
    <View style={styles.profileSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.profileSectionHeader,
          pressed ? styles.profileSectionHeaderPressed : null
        ]}
      >
        <Text style={styles.detailTitle}>{section.title}</Text>
        <Text style={styles.profileSectionIcon}>{expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.profileSectionBody}>
          <ProfileFactList facts={section.facts} />
          {section.buildings?.map((building) => (
            <View key={building.bbrBuildingId} style={styles.publicBuildingRow}>
              <Text style={styles.taskRowTitle}>{building.title}</Text>
              <ProfileFactList facts={building.facts} />
              {building.units.map((unit) => (
                <View key={unit.bbrUnitId} style={styles.profileNestedBlock}>
                  <Text style={styles.detailTitle}>{unit.title}</Text>
                  <ProfileFactList facts={unit.facts} />
                </View>
              ))}
              {building.floors.map((floor) => (
                <View key={floor.bbrFloorId} style={styles.profileNestedBlock}>
                  <Text style={styles.detailTitle}>{floor.title}</Text>
                  <ProfileFactList facts={floor.facts} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TaskRow({
  task,
  completing,
  onComplete,
  onOpen,
  onEdit,
  onDelete,
  openRowId,
  onSwipeOpen
}: {
  task: MaintenanceTask;
  completing: boolean;
  onComplete: (task: MaintenanceTask) => void;
  onOpen: (task: MaintenanceTask) => void;
  onEdit: (task: MaintenanceTask) => void;
  onDelete: (task: MaintenanceTask) => void;
  openRowId: string | null;
  onSwipeOpen: (rowId: string) => void;
}) {
  const isOverdue = isTaskOverdueForDisplay(task);
  const displayStatus: MaintenanceTask["status"] = isOverdue ? "overdue" : task.status;
  const description = visibleTaskDescription(task);
  const priceText =
    task.priceAmountMinor !== null ? formatDkkPrice(task.priceAmountMinor, task.priceCurrency) : null;

  return (
    <SwipeActionRow
      actionWidth={88}
      openRowId={openRowId}
      onOpened={onSwipeOpen}
      onLongSwipeLeft={() => onDelete(task)}
      onLongSwipeRight={() => onComplete(task)}
      rowId={`task:${task.id}`}
      swipeLeftActions={[
        {
          accessibilityLabel: `Rediger ${task.title}`,
          icon: "✎",
          label: "Rediger",
          tone: "neutral",
          onPress: () => onEdit(task)
        },
        {
          accessibilityLabel: `Slet ${task.title}`,
          icon: "×",
          label: "Slet",
          tone: "destructive",
          onPress: () => onDelete(task)
        }
      ]}
      swipeRightAction={{
        accessibilityLabel: `Fuldfør ${task.title}`,
        icon: "✓",
        label: "Fuldfør",
        onPress: () => onComplete(task)
      }}
      disabled={completing}
    >
      <View style={styles.taskRow}>
        <Pressable
          accessibilityLabel={`Markér ${task.title} som udført`}
          accessibilityRole="button"
          disabled={completing}
          onPress={() => onComplete(task)}
          style={({ pressed }) => [
            styles.completeControl,
            pressed && !completing ? styles.completeControlPressed : null,
            completing ? styles.disabled : null
          ]}
        >
          {completing ? <ActivityIndicator color={theme.primary} size="small" /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(task)}
          style={styles.taskRowBody}
        >
          <Text style={styles.taskRowTitle}>{task.title}</Text>
          <Text style={[styles.taskTiming, isOverdue ? styles.warningText : null]}>
            {formatTiming(task)}
          </Text>
          {description ? <Text style={styles.compactBodyText}>{description}</Text> : null}
          {priceText ? <Text style={styles.metaText}>Pris · {priceText}</Text> : null}
          <Text style={styles.metaText}>{formatSource(task.source)}</Text>
        </Pressable>
        <Pill tone={isOverdue ? "warning" : "default"}>{formatStatus(displayStatus)}</Pill>
      </View>
    </SwipeActionRow>
  );
}

function HouseOnboarding({
  step,
  query,
  suggestions,
  selectedAddress,
  hasAddressSearched,
  isSearching,
  isSaving,
  progressText,
  publicDataIssueText,
  onQueryChange,
  onSearch,
  onSelect,
  onSave,
  onChooseAnotherAddress,
  onRetryPublicData,
  onContinueWithoutPublicData
}: {
  step: HouseOnboardingStep;
  query: string;
  suggestions: AddressSuggestion[];
  selectedAddress: AddressSuggestion | null;
  hasAddressSearched: boolean;
  isSearching: boolean;
  isSaving: boolean;
  progressText: string | null;
  publicDataIssueText: string | null;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  onSave: () => void;
  onChooseAnotherAddress: () => void;
  onRetryPublicData: () => void;
  onContinueWithoutPublicData: () => void;
}) {
  if (step === "progress") {
    return (
      <View style={styles.stack}>
        <Card>
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.emptyTitle}>
              {progressText ?? "Vi henter boligoplysninger fra BBR"}
            </Text>
            <Text style={styles.bodyText}>
              Bliv her et øjeblik, mens Matriva gemmer boligen og gør
              boligoversigten klar.
            </Text>
          </View>
        </Card>
      </View>
    );
  }

  if (step === "publicDataIssue") {
    return (
      <View style={styles.stack}>
        <Card>
          <Text style={styles.emptyTitle}>BBR-oplysninger mangler</Text>
          <Text style={styles.bodyText}>
            {publicDataIssueText ??
              "Boligen er gemt, men vi kunne ikke hente BBR-oplysningerne lige nu."}
          </Text>
          <View style={styles.stack}>
            <PrimaryButton
              label="Prøv igen"
              loading={isSaving}
              onPress={onRetryPublicData}
            />
            <SecondaryButton
              label="Fortsæt uden BBR-oplysninger"
              disabled={isSaving}
              onPress={onContinueWithoutPublicData}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (step === "confirm" && selectedAddress) {
    return (
      <View style={styles.stack}>
        <Card>
          <Text style={styles.emptyTitle}>Bekræft din bolig</Text>
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{selectedAddress.label}</Text>
            </View>
          </View>
          <Text style={styles.bodyText}>
            Matriva henter offentlige boligoplysninger fra BBR, så dit overblik
            kan starte med de oplysninger, der er registreret om boligen.
          </Text>
          <View style={styles.stack}>
            <PrimaryButton
              label="Gem bolig og hent BBR-oplysninger"
              loading={isSaving}
              onPress={onSave}
            />
            <SecondaryButton
              label="Vælg en anden adresse"
              disabled={isSaving}
              onPress={onChooseAnotherAddress}
            />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Card>
        <Text style={styles.emptyTitle}>Kom i gang med dit hus</Text>
        <Text style={styles.bodyText}>
          Find din adresse og gem huset, så Matriva kan samle dit overblik og dine
          vedligeholdelsesopgaver.
        </Text>
      </Card>

      <View style={styles.formSection}>
        <Text style={styles.label}>Adresse</Text>
        <TextInput
          accessibilityLabel="Adresse"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!isSearching && !isSaving}
          onChangeText={onQueryChange}
          onSubmitEditing={onSearch}
          placeholder="Skriv vejnavn og nummer"
          placeholderTextColor={theme.muted}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        <PrimaryButton
          label="Søg adresse"
          loading={isSearching}
          disabled={query.trim().length < 2 || isSaving}
          onPress={onSearch}
        />
      </View>

      {hasAddressSearched && suggestions.length === 0 && !isSearching ? (
        <EmptyState
          title="Ingen adresser fundet"
          body="Prøv med vejnavn, husnummer og eventuelt by."
        />
      ) : null}

      {suggestions.length > 0 ? (
        <View style={styles.stack}>
          <Text style={styles.label}>Vælg adresse</Text>
          {suggestions.map((suggestion) => {
            const isSelected = selectedAddress?.id === suggestion.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={suggestion.id}
                onPress={() => onSelect(suggestion)}
                style={({ pressed }) => [
                  styles.addressOption,
                  isSelected ? styles.addressOptionSelected : null,
                  pressed ? styles.addressOptionPressed : null
                ]}
              >
                <Text style={styles.cardTitle}>{suggestion.label}</Text>
              </Pressable>
            );
          })}
          <PrimaryButton
            label="Fortsæt"
            loading={isSaving}
            disabled={!selectedAddress || isSearching}
            onPress={onSave}
          />
        </View>
      ) : null}
    </View>
  );
}

function DashboardScreen({
  house,
  publicDataSummary,
  tasks,
  onboarding,
  onCreateTask,
  onOpenTasks
}: {
  house: SavedHouse | null;
  publicDataSummary: HousePublicDataSummary | null;
  tasks: MaintenanceTask[];
  onboarding: React.ComponentProps<typeof HouseOnboarding>;
  onCreateTask: () => void;
  onOpenTasks: () => void;
}) {
  if (!house || onboarding.step === "progress" || onboarding.step === "publicDataIssue") {
    return (
      <View style={styles.stack}>
        <SectionHeader
          title="Overblik"
          eyebrow="Matriva"
          subtitle="Tilføj din adresse for at starte dit husoverblik."
        />
        <HouseOnboarding {...onboarding} />
      </View>
    );
  }

  const activeTasks = tasks.filter(isActiveMaintenanceTask);
  const overdueTasks = activeTasks.filter(isTaskOverdueForDisplay);
  const upcomingTasks = activeTasks.filter(
    (task) =>
      !isTaskOverdueForDisplay(task) &&
      task.timing.daysUntilDue !== undefined &&
      task.timing.daysUntilDue <= 30
  );

  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Overblik"
        eyebrow="Matriva"
        subtitle="Det vigtigste om dit hus lige nu."
      />

      <HouseStatusCard house={house} publicDataSummary={publicDataSummary} />

      <MaintenanceSummary
        activeTasks={activeTasks}
        overdueTasks={overdueTasks}
        upcomingTasks={upcomingTasks}
        onCreateTask={onCreateTask}
        onOpenTasks={onOpenTasks}
      />
    </View>
  );
}

function HouseScreen({
  house,
  publicDataSummary,
  publicDataProfile,
  improvements,
  housePhoto,
  housePhotoUri,
  housePhotoHeaders,
  onboarding,
  houseView,
  improvementTitle,
  improvementYear,
  improvementDescription,
  improvementCategory,
  improvementDocumentReference,
  improvementCost,
  improvementFormError,
  photoError,
  isRefreshingPublicData,
  isLoadingImprovements,
  isSavingImprovement,
  isUploadingPhoto,
  publicDataRefreshMessage,
  onOpenDetails,
  onOpenImprovements,
  onOpenAddImprovement,
  onBackToHouse,
  onRefreshPublicData,
  onOpenDocuments,
  onAddHousePhoto,
  onTakeHousePhoto,
  onRemoveHousePhoto,
  onImprovementTitleChange,
  onImprovementYearChange,
  onImprovementDescriptionChange,
  onImprovementCategoryChange,
  onImprovementDocumentReferenceChange,
  onImprovementCostChange,
  onSaveImprovement
}: {
  house: SavedHouse | null;
  publicDataSummary: HousePublicDataSummary | null;
  publicDataProfile: HousePublicDataProfileV1 | null;
  improvements: HouseImprovement[];
  housePhoto: HouseMedia | null;
  housePhotoUri: string | null;
  housePhotoHeaders: Record<string, string> | undefined;
  onboarding: React.ComponentProps<typeof HouseOnboarding>;
  houseView: HouseView;
  improvementTitle: string;
  improvementYear: string;
  improvementDescription: string;
  improvementCategory: HouseImprovementCategory | "";
  improvementDocumentReference: string;
  improvementCost: string;
  improvementFormError: string | null;
  photoError: string | null;
  isRefreshingPublicData: boolean;
  isLoadingImprovements: boolean;
  isSavingImprovement: boolean;
  isUploadingPhoto: boolean;
  publicDataRefreshMessage: PublicDataRefreshMessage | null;
  onOpenDetails: () => void;
  onOpenImprovements: () => void;
  onOpenAddImprovement: () => void;
  onBackToHouse: () => void;
  onRefreshPublicData: () => void;
  onOpenDocuments: () => void;
  onAddHousePhoto: () => void;
  onTakeHousePhoto: () => void;
  onRemoveHousePhoto: () => void;
  onImprovementTitleChange: (value: string) => void;
  onImprovementYearChange: (value: string) => void;
  onImprovementDescriptionChange: (value: string) => void;
  onImprovementCategoryChange: (value: HouseImprovementCategory | "") => void;
  onImprovementDocumentReferenceChange: (value: string) => void;
  onImprovementCostChange: (value: string) => void;
  onSaveImprovement: () => void;
}) {
  if (!house) {
    return <HouseOnboarding {...onboarding} />;
  }

  if (houseView === "details") {
    return (
      <View style={styles.stack}>
        <View style={styles.screenTitleRow}>
          <SectionHeader title="Boligoplysninger" subtitle="Detaljer fra BBR." />
          <SecondaryButton label="Tilbage" onPress={onBackToHouse} />
        </View>
        <Card>
          {publicDataProfile ? (
            <>
              <Text style={styles.cardTitle}>{publicDataProfile.title}</Text>
              {publicDataProfile.subtitle ? (
                <Text style={styles.compactBodyText}>{publicDataProfile.subtitle}</Text>
              ) : null}
              <Text style={styles.metaText}>
                {publicDataProfile.sourceLabel} · {updatedAtLabel(publicDataProfile.fetchedAt)}
              </Text>
              {publicDataProfile.sections.map((section, index) => (
                <ProfileSection
                  key={section.key}
                  section={section}
                  defaultExpanded={index < 2}
                />
              ))}
              <View style={styles.summaryActions}>
                <SecondaryButton
                  label={isRefreshingPublicData ? "Opdaterer..." : "Opdater BBR"}
                  disabled={isRefreshingPublicData}
                  onPress={onRefreshPublicData}
                />
              </View>
              {publicDataRefreshMessage ? (
                <Text
                  style={[
                    styles.refreshMessageText,
                    publicDataRefreshMessage.tone === "success"
                      ? styles.successText
                      : styles.refreshWarningText
                  ]}
                >
                  {publicDataRefreshMessage.text}
                </Text>
              ) : null}
            </>
          ) : (
            <EmptyState
              compact
              title="Boligoplysninger hentes"
              body="Matriva viser detaljerne her, når BBR-profilen er klar."
            />
          )}
        </Card>
      </View>
    );
  }

  if (houseView === "improvements") {
    return (
      <View style={styles.stack}>
        <View style={styles.screenTitleRow}>
          <SectionHeader title="Forbedringer" subtitle="Husets historik, nyeste først." />
          <SecondaryButton label="Tilbage" onPress={onBackToHouse} />
        </View>
        <PrimaryButton label="+ Tilføj forbedring" onPress={onOpenAddImprovement} />
        {isLoadingImprovements ? (
          <Card>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.compactBodyText}>Henter forbedringer...</Text>
          </Card>
        ) : improvements.length === 0 ? (
          <EmptyState
            title="Ingen forbedringer registreret endnu."
            body="Tilføj renoveringer og større ændringer, så husets historik følger med."
          />
        ) : (
          <View style={styles.taskList}>
            {improvements.map((improvement) => (
              <ImprovementCard key={improvement.id} improvement={improvement} />
            ))}
          </View>
        )}
      </View>
    );
  }

  if (houseView === "addImprovement") {
    return (
      <View style={styles.stack}>
        <View style={styles.screenTitleRow}>
          <SectionHeader title="Tilføj forbedring" subtitle="Gem en renovering eller større ændring." />
          <SecondaryButton label="Tilbage" disabled={isSavingImprovement} onPress={onBackToHouse} />
        </View>
        <Card variant="plain">
          <View style={styles.formSection}>
            <Text style={styles.label}>Titel</Text>
            <TextInput
              accessibilityLabel="Titel på forbedring"
              editable={!isSavingImprovement}
              onChangeText={onImprovementTitleChange}
              placeholder="Fx Nye vinduer"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={improvementTitle}
            />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>År</Text>
            <TextInput
              accessibilityLabel="År for forbedring"
              editable={!isSavingImprovement}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={onImprovementYearChange}
              placeholder="2024"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={improvementYear}
            />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.choiceWrap}>
              {improvementCategories.map(([key, label]) => {
                const selected = improvementCategory === key;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={key}
                    disabled={isSavingImprovement}
                    onPress={() => onImprovementCategoryChange(selected ? "" : key)}
                    style={({ pressed }) => [
                      styles.choiceChip,
                      selected ? styles.choiceChipSelected : null,
                      pressed && !isSavingImprovement ? styles.choiceChipPressed : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        selected ? styles.choiceChipTextSelected : null
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Beskrivelse</Text>
            <TextInput
              accessibilityLabel="Beskrivelse af forbedring"
              editable={!isSavingImprovement}
              multiline
              onChangeText={onImprovementDescriptionChange}
              placeholder="Valgfrit"
              placeholderTextColor={theme.muted}
              style={[styles.input, styles.textArea]}
              value={improvementDescription}
            />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Dokumentreference</Text>
            <TextInput
              accessibilityLabel="Dokumentreference"
              editable={!isSavingImprovement}
              onChangeText={onImprovementDocumentReferenceChange}
              placeholder="Fx Faktura i dokumentarkiv"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={improvementDocumentReference}
            />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Udgift</Text>
            <TextInput
              accessibilityLabel="Udgift i kroner"
              editable={!isSavingImprovement}
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={onImprovementCostChange}
              placeholder="Valgfrit beløb i kr."
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={improvementCost}
            />
          </View>
          {improvementFormError ? (
            <Text style={styles.errorText}>{improvementFormError}</Text>
          ) : null}
          <PrimaryButton
            label="Gem forbedring"
            loading={isSavingImprovement}
            disabled={isSavingImprovement}
            onPress={onSaveImprovement}
          />
        </Card>
      </View>
    );
  }

  const factMap = new Map(publicDataProfile?.topFacts.map((fact) => [fact.key, fact]));
  const buildingUseFact = publicDataProfile?.sections
    .find((section) => section.key === "primaryBuilding")
    ?.facts.find((fact) => fact.key === "use");
  const heatingSourceFact = publicDataProfile?.sections
    .find((section) => section.key === "heating")
    ?.facts.find((fact) => fact.key === "source");
  const buildingTotalAreaFact = publicDataProfile?.sections
    .find((section) => section.key === "areas")
    ?.facts.find((fact) => fact.key === "building_total");
  const basementAreaFact = publicDataProfile?.sections
    .find((section) => section.key === "floorsAndBasement")
    ?.facts.find((fact) => fact.key === "basement_area");
  const latestImprovements = improvements.slice(0, 2);
  const houseTypeValue = productHouseTypeValue(
    factMap.get("housing_type"),
    buildingUseFact
  );
  const totalAreaValue = productTotalAreaValue(
    buildingTotalAreaFact,
    factMap.get("residential_area"),
    basementAreaFact
  );
  const identityType =
    houseTypeValue !== "Ikke registreret"
      ? houseTypeValue
      : publicDataSummary?.primary.title ?? "Hus";

  return (
    <View style={styles.stack}>
      <View style={styles.houseDashboardHeader}>
        <View style={styles.screenTitleRow}>
          <SectionHeader title="Mit hus" />
          <HousePhotoMenu
            hasPhoto={!!housePhoto}
            isUploading={isUploadingPhoto}
            onAddPhoto={onAddHousePhoto}
            onTakePhoto={onTakeHousePhoto}
            onRemovePhoto={onRemoveHousePhoto}
            onRefreshPublicData={onRefreshPublicData}
          />
        </View>
        {housePhoto ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Foto af huset"
            resizeMode="cover"
            source={{
              uri: housePhotoUri ?? "",
              headers: housePhotoHeaders
            }}
            style={styles.housePhoto}
          />
        ) : null}
        <View style={styles.houseIdentity}>
          <Text style={styles.houseAddress}>{house.addressLabel}</Text>
          <Text style={styles.houseMeta}>
            {identityType} · {updatedAtLabel(publicDataProfile?.fetchedAt ?? publicDataSummary?.fetchedAt)}
          </Text>
          {publicDataProfile?.status === "partial" || publicDataProfile?.status === "ambiguous" ? (
            <Text style={styles.houseStatusMeta}>
              {publicDataProfile.status === "ambiguous" ? "BBR kræver afklaring" : "Delvist BBR-opslag"}
            </Text>
          ) : null}
          {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}
        </View>
      </View>

      <View style={styles.overviewGrid}>
        {overviewFactOrder.map((key) => {
          const value =
            key === "housing_type"
              ? houseTypeValue
              : key === "residential_area"
                ? totalAreaValue
                : key === "heating"
                  ? productHeatingValue(factMap.get(key), heatingSourceFact)
                  : productFactValue(factMap.get(key));

          return (
            <View
              accessible
              accessibilityLabel={`${overviewFactLabels[key]}: ${value}`}
              key={key}
              style={styles.overviewFactCard}
            >
              <Text style={styles.overviewFactIcon}>{overviewFactIcons[key]}</Text>
              <Text style={styles.overviewFactLabel}>{overviewFactLabels[key]}</Text>
              <Text style={styles.overviewFactValue}>{value}</Text>
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Se alle boligoplysninger"
        onPress={onOpenDetails}
        style={({ pressed }) => [styles.linkRow, pressed ? styles.linkRowPressed : null]}
      >
        <Text style={styles.linkRowText}>Se alle boligoplysninger</Text>
        <Text style={styles.linkRowIcon}>›</Text>
      </Pressable>

      <View style={styles.sectionBlock}>
        <View style={styles.inlineSectionHeader}>
          <Text style={styles.inlineSectionTitle}>Forbedringer</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se alle forbedringer"
            onPress={onOpenImprovements}
            style={({ pressed }) => [styles.textLinkButton, pressed ? styles.loginTextActionPressed : null]}
          >
            <Text style={styles.textLink}>Se alle</Text>
          </Pressable>
        </View>
        {isLoadingImprovements ? (
          <Card>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.compactBodyText}>Henter forbedringer...</Text>
          </Card>
        ) : latestImprovements.length > 0 ? (
          latestImprovements.map((improvement) => (
            <ImprovementCard key={improvement.id} improvement={improvement} />
          ))
        ) : (
          <EmptyState
            compact
            title="Ingen forbedringer registreret endnu."
            body="Tilføj renoveringer og større ændringer, så husets historik følger med."
          />
        )}
        <SecondaryButton label="+ Tilføj forbedring" onPress={onOpenAddImprovement} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Åbn dokumentarkiv"
        onPress={onOpenDocuments}
        style={({ pressed }) => [styles.documentArchiveRow, pressed ? styles.linkRowPressed : null]}
      >
        <View style={styles.taskTitleGroup}>
          <Text style={styles.cardTitle}>Dokumentarkiv</Text>
          <Text style={styles.compactBodyText}>
            Se boligpapirer, kvitteringer og dokumentation
          </Text>
        </View>
        <Text style={styles.linkRowIcon}>›</Text>
      </Pressable>
    </View>
  );
}

function HousePhotoMenu({
  hasPhoto,
  isUploading,
  onAddPhoto,
  onTakePhoto,
  onRemovePhoto,
  onRefreshPublicData
}: {
  hasPhoto: boolean;
  isUploading: boolean;
  onAddPhoto: () => void;
  onTakePhoto: () => void;
  onRemovePhoto: () => void;
  onRefreshPublicData: () => void;
}) {
  return (
    <View style={styles.houseMenu}>
      <SecondaryButton
        label={isUploading ? "Uploader..." : hasPhoto ? "Skift husfoto" : "Tilføj husfoto"}
        disabled={isUploading}
        onPress={onAddPhoto}
      />
      <View style={styles.houseMenuInline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tag husfoto"
          disabled={isUploading}
          onPress={onTakePhoto}
          style={({ pressed }) => [
            styles.iconAction,
            pressed && !isUploading ? styles.secondaryButtonPressed : null,
            isUploading ? styles.disabled : null
          ]}
        >
          <Text style={styles.iconActionText}>◎</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opdater BBR"
          disabled={isUploading}
          onPress={onRefreshPublicData}
          style={({ pressed }) => [
            styles.iconAction,
            pressed && !isUploading ? styles.secondaryButtonPressed : null
          ]}
        >
          <Text style={styles.iconActionText}>↻</Text>
        </Pressable>
        {hasPhoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fjern husfoto"
            disabled={isUploading}
            onPress={onRemovePhoto}
            style={({ pressed }) => [
              styles.iconAction,
              pressed && !isUploading ? styles.secondaryButtonPressed : null,
              isUploading ? styles.disabled : null
            ]}
          >
            <Text style={styles.iconActionText}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ImprovementCard({ improvement }: { improvement: HouseImprovement }) {
  return (
    <View style={styles.improvementCard}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.taskTitleGroup}>
          <Text style={styles.taskRowTitle}>{improvement.title}</Text>
          {improvement.description ? (
            <Text style={styles.compactBodyText}>{improvement.description}</Text>
          ) : null}
          <Text style={styles.metaText}>{improvementMeta(improvement)}</Text>
        </View>
        {improvement.category ? (
          <Pill>{improvementCategoryLabels[improvement.category]}</Pill>
        ) : null}
      </View>
    </View>
  );
}

const maintenanceFilters: Array<{ key: MaintenanceFilter; label: string }> = [
  { key: "current", label: "Aktuelt" },
  { key: "spring", label: "Forår" },
  { key: "summer", label: "Sommer" },
  { key: "autumn", label: "Efterår" },
  { key: "winter", label: "Vinter" },
  { key: "all", label: "Alle" }
];

function taskMatchesFilter(task: MaintenanceTask, filter: MaintenanceFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "current") {
    const season = maintenanceTaskSeason(task);
    return (
      task.status === "overdue" ||
      task.status === "due" ||
      !!task.timing.daysOverdue ||
      (task.timing.daysUntilDue !== undefined && task.timing.daysUntilDue <= 30) ||
      season === currentMaintenanceSeason() ||
      season === "all_year"
    );
  }

  return maintenanceTaskMatchesSeason(task, filter);
}

function currentMaintenanceSeason() {
  const month = new Date().getMonth() + 1;

  if (month === 12 || month <= 2) {
    return "winter";
  }

  if (month <= 5) {
    return "spring";
  }

  if (month <= 8) {
    return "summer";
  }

  return "autumn";
}

function RecommendationCard({
  recommendation,
  isSaving,
  onAccept,
  onDismiss,
  openRowId,
  onSwipeOpen
}: {
  recommendation: MaintenanceRecommendation;
  isSaving: boolean;
  onAccept: (recommendation: MaintenanceRecommendation) => void;
  onDismiss: (recommendation: MaintenanceRecommendation) => void;
  openRowId: string | null;
  onSwipeOpen: (rowId: string) => void;
}) {
  const timingText = recommendation.recommendedTimingLabel;

  return (
    <SwipeActionRow
      disabled={isSaving}
      openRowId={openRowId}
      onOpened={onSwipeOpen}
      onLongSwipeLeft={() => onDismiss(recommendation)}
      onLongSwipeRight={() => onAccept(recommendation)}
      rowId={`recommendation:${recommendation.id}`}
      swipeLeftActions={[
        {
          accessibilityLabel: `Afvis forslag: ${recommendation.title}`,
          icon: "×",
          label: "Afvis forslag",
          tone: "destructive",
          onPress: () => onDismiss(recommendation)
        }
      ]}
      swipeRightAction={{
        accessibilityLabel: `Tilføj ${recommendation.title}`,
        label: "Tilføj",
        onPress: () => onAccept(recommendation)
      }}
    >
      <View style={styles.taskRow}>
        <View style={styles.taskRowBody}>
          <Text style={styles.taskRowTitle}>{recommendation.title}</Text>
          <Text style={styles.taskTiming}>{timingText}</Text>
          <Text style={styles.compactBodyText}>{recommendation.description}</Text>
        </View>
        <View style={styles.recommendationActions}>
          <SecondaryButton
            disabled={isSaving}
            label="Afvis forslag"
            onPress={() => onDismiss(recommendation)}
          />
          <PrimaryButton
            loading={isSaving}
            label="Tilføj"
            onPress={() => onAccept(recommendation)}
          />
        </View>
      </View>
    </SwipeActionRow>
  );
}

function MaintenanceHistoryRow({
  entry,
  onPress
}: {
  entry: MaintenanceHistoryEntry;
  onPress?: () => void;
}) {
  const meta = [
    formatDisplayDate(entry.completedDate),
    entry.priceAmountMinor !== null
      ? formatDkkPrice(entry.priceAmountMinor, entry.priceCurrency)
      : null,
    entry.note ? "Note tilføjet" : null
  ].filter(Boolean);

  const content = (
    <View style={styles.historyRow}>
      <Text style={styles.taskRowTitle}>{entry.title}</Text>
      <Text style={styles.metaText}>{meta.join(" · ")}</Text>
    </View>
  );

  return onPress ? (
    <Pressable
      accessibilityLabel={`Åbn historik: ${entry.title}`}
      accessibilityRole="button"
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

type MaintenanceRecurrenceInterval = NonNullable<
  MaintenanceTask["recurrence"]
>["interval"];

const maintenanceRecurrenceOptions: ReadonlyArray<{
  key: MaintenanceRecurrenceInterval | "";
  label: string;
  detailLabel: string | null;
}> = [
  { key: "", label: "Gentages ikke", detailLabel: null },
  { key: "monthly", label: "Månedligt", detailLabel: "Gentages månedligt" },
  { key: "quarterly", label: "Hver 3. måned", detailLabel: "Gentages hver 3. måned" },
  { key: "half_yearly", label: "Hvert halve år", detailLabel: "Gentages hvert halve år" },
  { key: "yearly", label: "Årligt", detailLabel: "Gentages årligt" },
  { key: "every_2_years", label: "Hvert 2. år", detailLabel: "Gentages hvert 2. år" },
  { key: "every_3_years", label: "Hvert 3. år", detailLabel: "Gentages hvert 3. år" },
  { key: "every_5_years", label: "Hvert 5. år", detailLabel: "Gentages hvert 5. år" },
  { key: "every_10_years", label: "Hvert 10. år", detailLabel: "Gentages hvert 10. år" }
];

function recurrenceForInterval(
  interval: MaintenanceRecurrenceInterval | ""
): MaintenanceTask["recurrence"] {
  return interval ? { interval, anchor: "completed_date" } : null;
}

function recurrenceLabel(recurrence: MaintenanceTask["recurrence"]) {
  if (!recurrence) {
    return null;
  }

  return (
    maintenanceRecurrenceOptions.find((option) => option.key === recurrence.interval)
      ?.detailLabel ?? null
  );
}

function sourceLabel(source: MaintenanceTask["source"]) {
  if (source === "recommendation_accepted") {
    return "Oprettet ud fra Matrivas anbefaling";
  }

  if (source === "user_created") {
    return "Oprettet af dig";
  }

  return null;
}

function MaintenanceScreen({
  house,
  tasks,
  history,
  historyDetail,
  selectedTask,
  recommendations,
  filter,
  historyYearFilter,
  view,
  onFilterChange,
  onHistoryYearFilterChange,
  onOpenFullHistory,
  onOpenAllRecommendations,
  onBackToMaintenance,
  onOpenTaskDetail,
  onOpenHistoryDetail,
  onReverseHistory,
  isReversingHistory,
  historyReversalError,
  onUpdateTask,
  onDeleteTask,
  showForm,
  showDeadlinePicker,
  completingTaskId,
  title,
  description,
  deadline,
  price,
  recurrenceInterval,
  formError,
  isSaving,
  onShowForm,
  onCancelForm,
  onShowDeadlinePicker,
  onHideDeadlinePicker,
  onTitleChange,
  onDescriptionChange,
  onPriceChange,
  onRecurrenceIntervalChange,
  onDeadlineSelect,
  onDeadlineClear,
  onCompleteTask,
  onAcceptRecommendation,
  onDismissRecommendation,
  swipeHintSeen,
  onDismissSwipeHint,
  onSave,
  onboarding,
  completionNoteTask,
  completionNote,
  completionDoNotAskAgain,
  completionModalError,
  onCompletionNoteChange,
  onCompletionDoNotAskAgainChange,
  onCancelCompletion,
  onSaveCompletion
}: {
  house: SavedHouse | null;
  tasks: MaintenanceTask[];
  history: MaintenanceHistoryEntry[];
  historyDetail: MaintenanceHistoryDetail | null;
  selectedTask: MaintenanceTask | null;
  recommendations: MaintenanceRecommendation[];
  filter: MaintenanceFilter;
  historyYearFilter: number | null;
  view: MaintenanceView;
  onFilterChange: (filter: MaintenanceFilter) => void;
  onHistoryYearFilterChange: (year: number | null) => void;
  onOpenFullHistory: () => void;
  onOpenAllRecommendations: () => void;
  onBackToMaintenance: () => void;
  onOpenTaskDetail: (task: MaintenanceTask) => void;
  onOpenHistoryDetail: (entry: MaintenanceHistoryEntry) => void;
  onReverseHistory: (noteHandling: "keep_as_draft" | "discard") => void;
  isReversingHistory: boolean;
  historyReversalError: string | null;
  onUpdateTask: (task: MaintenanceTask, patch: { title?: string; description?: string | null; timing?: MaintenanceTask["timing"]; priceAmountMinor?: number | null; priceCurrency?: "DKK"; recurrence?: MaintenanceTask["recurrence"] }) => void;
  onDeleteTask: (task: MaintenanceTask) => void;
  showForm: boolean;
  showDeadlinePicker: boolean;
  completingTaskId: TaskId | null;
  title: string;
  description: string;
  deadline: string;
  price: string;
  recurrenceInterval: MaintenanceRecurrenceInterval | "";
  formError: string | null;
  isSaving: boolean;
  onShowForm: () => void;
  onCancelForm: () => void;
  onShowDeadlinePicker: () => void;
  onHideDeadlinePicker: () => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onPriceChange: (price: string) => void;
  onRecurrenceIntervalChange: (interval: MaintenanceRecurrenceInterval | "") => void;
  onDeadlineSelect: (deadline: string) => void;
  onDeadlineClear: () => void;
  onCompleteTask: (task: MaintenanceTask) => void;
  onAcceptRecommendation: (recommendation: MaintenanceRecommendation) => void;
  onDismissRecommendation: (recommendation: MaintenanceRecommendation) => void;
  swipeHintSeen: boolean | null;
  onDismissSwipeHint: () => void;
  onSave: () => void;
  onboarding: React.ComponentProps<typeof HouseOnboarding>;
  completionNoteTask: MaintenanceTask | null;
  completionNote: string;
  completionDoNotAskAgain: boolean;
  completionModalError: string | null;
  onCompletionNoteChange: (value: string) => void;
  onCompletionDoNotAskAgainChange: (value: boolean) => void;
  onCancelCompletion: () => void;
  onSaveCompletion: () => void;
}) {
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailDeadline, setDetailDeadline] = useState("");
  const [detailPrice, setDetailPrice] = useState("");
  const [detailRecurrenceInterval, setDetailRecurrenceInterval] = useState<
    MaintenanceRecurrenceInterval | ""
  >("");
  const [isTaskEditing, setIsTaskEditing] = useState(false);
  const [showDetailDatePicker, setShowDetailDatePicker] = useState(false);
  const [openSwipeRowId, setOpenSwipeRowId] = useState<string | null>(null);
  const pendingEditTaskId = useRef<TaskId | null>(null);
  const [reverseModalVisible, setReverseModalVisible] = useState(false);
  const [reverseNoteHandling, setReverseNoteHandling] = useState<"keep_as_draft" | "discard">(
    historyDetail?.note?.trim() ? "keep_as_draft" : "discard"
  );

  useEffect(() => {
    if (view !== "main" && view !== "recommendations") {
      setOpenSwipeRowId(null);
    }
  }, [view]);

  function handleSwipeOpened(rowId: string) {
    setOpenSwipeRowId(rowId);
  }

  function openTaskForEditing(task: MaintenanceTask) {
    pendingEditTaskId.current = task.id;
    onOpenTaskDetail(task);
  }

  useEffect(() => {
    if (!selectedTask) {
      setDetailTitle("");
      setDetailDescription("");
      setDetailDeadline("");
      setDetailPrice("");
      setDetailRecurrenceInterval("");
      setIsTaskEditing(false);
      setShowDetailDatePicker(false);
      return;
    }

    setDetailTitle(selectedTask.title);
    setDetailDescription(selectedTask.description ?? "");
    setDetailDeadline(
      selectedTask.timing.type === "specific_deadline" ? selectedTask.timing.dueDate ?? "" : ""
    );
    setDetailPrice(editablePriceValue(selectedTask.priceAmountMinor));
    setDetailRecurrenceInterval(selectedTask.recurrence?.interval ?? "");
    setIsTaskEditing(pendingEditTaskId.current === selectedTask.id);
    pendingEditTaskId.current = null;
    setShowDetailDatePicker(false);
  }, [selectedTask?.id]);

  if (!house) {
    return (
      <View style={styles.stack}>
        <SectionHeader title="Vedligeholdelse" />
        <EmptyState
          title="Tilføj et hus først"
          body="Gem din adresse, før du opretter vedligeholdelsesopgaver."
        />
        <HouseOnboarding {...onboarding} />
      </View>
    );
  }

  const years = Array.from(
    new Set(history.map((entry) => Number(entry.completedDate.slice(0, 4))))
  ).sort((a, b) => b - a);
  const filteredHistory = history.filter((entry) => {
    if (historyYearFilter && Number(entry.completedDate.slice(0, 4)) !== historyYearFilter) {
      return false;
    }

    return true;
  });

  if (view === "taskDetail" && selectedTask) {
    const recurrenceText = recurrenceLabel(selectedTask.recurrence);
    const sourceText = sourceLabel(selectedTask.source);
    const dateText =
      selectedTask.timing.type === "specific_deadline" && selectedTask.timing.dueDate
        ? formatDisplayDate(selectedTask.timing.dueDate)
        : "Ingen dato";
    const priceText =
      selectedTask.priceAmountMinor !== null
        ? formatDkkPrice(selectedTask.priceAmountMinor, selectedTask.priceCurrency)
        : null;

    return (
      <View style={styles.stack}>
        <SecondaryButton label="Tilbage" onPress={onBackToMaintenance} />
        {isTaskEditing ? (
          <View style={styles.taskList}>
            <Text style={styles.label}>Titel</Text>
            <TextInput
              accessibilityLabel="Titel"
              onChangeText={setDetailTitle}
              style={styles.input}
              value={detailTitle}
            />
            <Text style={styles.label}>Note</Text>
            <TextInput
              accessibilityLabel="Note"
              multiline
              onChangeText={setDetailDescription}
              style={[styles.input, styles.textArea]}
              value={detailDescription}
            />
            <Text style={styles.label}>Pris</Text>
            <View style={styles.priceInputRow}>
              <TextInput
                accessibilityLabel="Pris"
                keyboardType="decimal-pad"
                onChangeText={setDetailPrice}
                placeholder="0,00"
                placeholderTextColor={theme.muted}
                style={[styles.input, styles.priceInput]}
                value={detailPrice}
              />
              <Text style={styles.metaText}>kr.</Text>
            </View>
            <Text style={styles.label}>Gentagelse</Text>
            <View style={styles.choiceWrap}>
              {maintenanceRecurrenceOptions.map((option) => {
                const selected = detailRecurrenceInterval === option.key;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.key || "none"}
                    onPress={() => setDetailRecurrenceInterval(option.key)}
                    style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        selected ? styles.choiceChipTextSelected : null
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Deadline</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDetailDatePicker(true)}
              style={styles.dateField}
            >
              <Text style={detailDeadline ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
                {detailDeadline ? formatDisplayDate(detailDeadline) : "Vælg dato"}
              </Text>
              <Text style={styles.dateFieldIcon}>⌄</Text>
            </Pressable>
            <DeadlineDatePicker
              visible={showDetailDatePicker}
              selectedDate={detailDeadline}
              onClose={() => setShowDetailDatePicker(false)}
              onClear={() => {
                setDetailDeadline("");
                setShowDetailDatePicker(false);
              }}
              onSelect={(value) => {
                setDetailDeadline(value);
                setShowDetailDatePicker(false);
              }}
            />
            <View style={[styles.buttonRow, styles.compactFormActions]}>
              <PrimaryButton
                compact
                label="Gem"
                loading={isSaving}
                onPress={() => {
                  const parsedPrice = parseDanishPriceInput(detailPrice);

                  if (!parsedPrice.ok) {
                    Alert.alert("Pris", priceInputErrorMessage(parsedPrice.code));
                    return;
                  }

                  onUpdateTask(selectedTask, {
                    title: detailTitle,
                    description: detailDescription.trim() ? detailDescription : null,
                    timing: detailDeadline
                      ? { type: "specific_deadline", dueDate: detailDeadline }
                      : { type: "none" },
                    priceAmountMinor: parsedPrice.amountMinor,
                    priceCurrency: "DKK",
                    recurrence: recurrenceForInterval(detailRecurrenceInterval)
                  });
                  setIsTaskEditing(false);
                }}
              />
              <SecondaryButton
                compact
                label="Annuller"
                onPress={() => {
                  setDetailTitle(selectedTask.title);
                  setDetailDescription(selectedTask.description ?? "");
                  setDetailDeadline(
                    selectedTask.timing.type === "specific_deadline"
                      ? selectedTask.timing.dueDate ?? ""
                      : ""
                  );
                  setDetailPrice(editablePriceValue(selectedTask.priceAmountMinor));
                  setDetailRecurrenceInterval(selectedTask.recurrence?.interval ?? "");
                  setIsTaskEditing(false);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.taskDetailCard}>
            <View style={styles.taskDetailHeader}>
              <Text style={[styles.detailTitle, styles.taskDetailTitle]}>
                {selectedTask.title}
              </Text>
              <Pill>{formatStatus(selectedTask.status)}</Pill>
            </View>
            {sourceText ? <Text style={styles.taskTiming}>{sourceText}</Text> : null}
            <Text style={styles.taskTiming}>{dateText}</Text>
            {selectedTask.description ? (
              <Text style={styles.compactBodyText}>{selectedTask.description}</Text>
            ) : null}
            {priceText ? <Text style={styles.metaText}>Pris · {priceText}</Text> : null}
            {recurrenceText ? (
              <View style={styles.pillRow}>
                <Pill>{recurrenceText}</Pill>
              </View>
            ) : null}
          </View>
        )}
        {!isTaskEditing ? (
          <View style={styles.compactActionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsTaskEditing(true)}
              style={({ pressed }) => [
                styles.compactActionButton,
                pressed ? styles.secondaryButtonPressed : null
              ]}
            >
              <Text style={styles.compactActionText}>Rediger</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onDeleteTask(selectedTask)}
              style={({ pressed }) => [
                styles.compactActionButton,
                styles.compactDangerButton,
                pressed ? styles.compactDangerButtonPressed : null
              ]}
            >
              <Text style={[styles.compactActionText, styles.compactDangerText]}>
                Slet opgave
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  if (view === "recommendations") {
    return (
      <View style={styles.stack}>
        <SecondaryButton label="Tilbage" onPress={onBackToMaintenance} />
        <SectionHeader
          title="Anbefalet til dit hus"
          subtitle="Generelle forslag fra Matriva-kataloget."
        />
        <Text style={styles.compactBodyText}>
          Matrivas anbefalinger er generelle forslag. Følg altid producentens anvisninger,
          og kontakt en fagperson ved tvivl.
        </Text>
        {recommendations.length > 0 ? (
          <View style={styles.taskList}>
            {recommendations.map((recommendation) => (
              <RecommendationCard
                isSaving={isSaving}
                key={recommendation.id}
                onAccept={onAcceptRecommendation}
                onDismiss={onDismissRecommendation}
                onSwipeOpen={handleSwipeOpened}
                openRowId={openSwipeRowId}
                recommendation={recommendation}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="Ingen nye anbefalinger lige nu"
            body="Vi viser nye forslag, når de bliver relevante for dit hus og perioden."
          />
        )}
      </View>
    );
  }

  if (view === "historyDetail" && historyDetail) {
    const detailMeta = [
      historyDetail.note,
      historyDetail.priceAmountMinor !== null
        ? `Pris · ${formatDkkPrice(historyDetail.priceAmountMinor, historyDetail.priceCurrency)}`
        : null
    ].filter(Boolean);
    const recurrenceText = recurrenceLabel(historyDetail.recurrence);
    const sourceText = sourceLabel(historyDetail.source);

    return (
      <View style={styles.stack}>
        <ReverseMaintenanceModal
          error={historyReversalError}
          isSaving={isReversingHistory}
          note={historyDetail.note}
          noteHandling={reverseNoteHandling}
          onCancel={() => {
            if (!isReversingHistory) {
              setReverseModalVisible(false);
            }
          }}
          onNoteHandlingChange={setReverseNoteHandling}
          onSave={() => onReverseHistory(reverseNoteHandling)}
          recurring={historyDetail.recurrence !== null}
          visible={reverseModalVisible}
        />
        <SecondaryButton label="Tilbage" onPress={onBackToMaintenance} />
        <SectionHeader title={historyDetail.title} subtitle={formatDisplayDate(historyDetail.completedDate)} />
        {detailMeta.length > 0 ? (
          <View style={styles.taskList}>
            <Text style={styles.sectionEyebrow}>Detaljer</Text>
            {detailMeta.map((item) => (
              <Text key={item} style={styles.compactBodyText}>
                {item}
              </Text>
            ))}
          </View>
        ) : null}
        {recurrenceText ? (
          <View style={styles.taskList}>
            <Text style={styles.sectionEyebrow}>Gentagelse</Text>
            <Text style={styles.compactBodyText}>{recurrenceText}</Text>
          </View>
        ) : null}
        {sourceText && historyDetail.source !== "user_created" ? (
          <View style={styles.taskList}>
            <Text style={styles.sectionEyebrow}>Kilde</Text>
            <Text style={styles.compactBodyText}>{sourceText}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label="Læg opgaven tilbage"
          onPress={() => {
            setReverseNoteHandling(historyDetail.note?.trim() ? "keep_as_draft" : "discard");
            setReverseModalVisible(true);
          }}
        />
      </View>
    );
  }

  if (view === "history") {
    return (
      <View style={styles.stack}>
        <SecondaryButton label="Tilbage" onPress={onBackToMaintenance} />
        <SectionHeader title="Historik" subtitle={`${filteredHistory.length} udførte opgaver`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterChipRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onHistoryYearFilterChange(null)}
              style={[styles.filterChip, historyYearFilter === null ? styles.filterChipSelected : null]}
            >
              <Text style={[styles.filterChipText, historyYearFilter === null ? styles.filterChipTextSelected : null]}>
                Alle år
              </Text>
            </Pressable>
            {years.map((year) => (
              <Pressable
                accessibilityRole="button"
                key={year}
                onPress={() => onHistoryYearFilterChange(year)}
                style={[styles.filterChip, historyYearFilter === year ? styles.filterChipSelected : null]}
              >
                <Text style={[styles.filterChipText, historyYearFilter === year ? styles.filterChipTextSelected : null]}>
                  {year}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={styles.taskList}>
          {filteredHistory.length > 0 ? (
            filteredHistory.map((entry) => (
              <Pressable
                accessibilityRole="button"
                key={entry.id}
                onPress={() => onOpenHistoryDetail(entry)}
              >
                <MaintenanceHistoryRow entry={entry} />
              </Pressable>
            ))
          ) : (
            <EmptyState
              title="Ingen historik matcher filteret"
              body="Vælg et andet år."
            />
          )}
        </View>
      </View>
    );
  }

  const activeTasks = tasks.filter(isActiveMaintenanceTask);
  const filteredTasks = activeTasks.filter((task) => taskMatchesFilter(task, filter));
  const seenTaskIds = new Set<TaskId>();
  const takeSectionTasks = (sectionTasks: MaintenanceTask[]) =>
    sectionTasks.filter((task) => {
      if (seenTaskIds.has(task.id)) {
        return false;
      }

      seenTaskIds.add(task.id);
      return true;
    });
  const overdueTasks = takeSectionTasks(
    activeTasks.filter(isTaskOverdueForDisplay).sort(compareMaintenanceTasksByDueDate)
  );
  const soonTasks = takeSectionTasks(
    filteredTasks.filter(
      (task) =>
        task.timing.daysUntilDue !== undefined &&
        task.timing.daysUntilDue <= 30
    ).sort(compareMaintenanceTasksByDueDate)
  );
  const seasonalTasks = takeSectionTasks(
    filteredTasks.filter(
      (task) => {
        const season = maintenanceTaskSeason(task);

        if (filter === "current") {
          return season === currentMaintenanceSeason();
        }

        if (filter === "all") {
          return season !== null && season !== "all_year";
        }

        return season === filter;
      }
    )
  );
  const laterTasks = takeSectionTasks(filteredTasks);
  const latestHistory = history.slice(0, 3);
  const visibleRecommendations = recommendations.slice(0, 3);
  const hiddenRecommendationCount = Math.max(recommendations.length - visibleRecommendations.length, 0);

  return (
    <View style={styles.stack}>
      <CompletionNoteModal
        doNotAskAgain={completionDoNotAskAgain}
        error={completionModalError}
        isSaving={completingTaskId !== null && completionNoteTask !== null}
        note={completionNote}
        onCancel={onCancelCompletion}
        onDoNotAskAgainChange={onCompletionDoNotAskAgainChange}
        onNoteChange={onCompletionNoteChange}
        onSave={onSaveCompletion}
        visible={completionNoteTask !== null}
      />
      <View style={styles.screenTitleRow}>
        <SectionHeader
          title="Vedligeholdelse"
          subtitle={
            activeTasks.length === 1
              ? "1 opgave for dit hus."
              : `${activeTasks.length} opgaver for dit hus.`
          }
        />
        {!showForm ? <SecondaryButton label="Opret opgave" onPress={onShowForm} /> : null}
      </View>

      {swipeHintSeen === false && (activeTasks.length > 0 || recommendations.length > 0) ? (
        <View
          accessibilityLabel="Swipe til højre for en positiv handling og til venstre for flere muligheder"
          style={styles.swipeHint}
        >
          <Text style={styles.swipeHintText}>
            Swipe til højre for en positiv handling og til venstre for flere muligheder.
          </Text>
          <Pressable
            accessibilityLabel="Luk swipe-tip"
            accessibilityRole="button"
            onPress={onDismissSwipeHint}
            style={({ pressed }) => [styles.swipeHintClose, pressed ? styles.swipeHintClosePressed : null]}
          >
            <Text style={styles.swipeHintCloseText}>Luk</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.maintenanceFilterGrid}>
        {maintenanceFilters.map((item) => {
          const selected = item.key === filter;

          return (
            <Pressable
              accessibilityRole="button"
              key={item.key}
              onPress={() => onFilterChange(item.key)}
              style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selected ? styles.filterChipTextSelected : null
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showForm ? (
        <Card variant="plain">
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.cardTitle}>Ny vedligeholdelsesopgave</Text>
              <Text style={styles.compactBodyText}>
                Tilføj titel, eventuel note, pris, gentagelse og deadline.
              </Text>
            </View>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Titel</Text>
            <TextInput
              accessibilityLabel="Titel"
              editable={!isSaving}
              onChangeText={onTitleChange}
              placeholder="Fx Rens tagrender"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={title}
            />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Beskrivelse</Text>
            <TextInput
              accessibilityLabel="Beskrivelse"
              editable={!isSaving}
              multiline
              onChangeText={onDescriptionChange}
              placeholder="Valgfrit"
              placeholderTextColor={theme.muted}
              style={[styles.input, styles.textArea]}
              value={description}
            />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Pris</Text>
            <View style={styles.priceInputRow}>
              <TextInput
                accessibilityLabel="Pris"
                editable={!isSaving}
                keyboardType="decimal-pad"
                onChangeText={onPriceChange}
                placeholder="0,00"
                placeholderTextColor={theme.muted}
                style={[styles.input, styles.priceInput]}
                value={price}
              />
              <Text style={styles.metaText}>kr.</Text>
            </View>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Gentagelse</Text>
            <View style={styles.choiceWrap}>
              {maintenanceRecurrenceOptions.map((option) => {
                const selected = recurrenceInterval === option.key;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    key={option.key || "none"}
                    onPress={() => onRecurrenceIntervalChange(option.key)}
                    style={[
                      styles.choiceChip,
                      selected ? styles.choiceChipSelected : null,
                      isSaving ? styles.disabled : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        selected ? styles.choiceChipTextSelected : null
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.label}>Deadline</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onShowDeadlinePicker}
              style={({ pressed }) => [
                styles.dateField,
                pressed && !isSaving ? styles.dateFieldPressed : null,
                isSaving ? styles.disabled : null
              ]}
            >
              <View style={styles.dateFieldTextGroup}>
                <Text style={deadline ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
                  {deadline ? formatDisplayDate(deadline) : "Vælg dato"}
                </Text>
              </View>
              <Text style={styles.dateFieldIcon}>⌄</Text>
            </Pressable>
            {deadline ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={onDeadlineClear}
                style={({ pressed }) => [
                  styles.clearDateButton,
                  pressed && !isSaving ? styles.clearDateButtonPressed : null,
                  isSaving ? styles.disabled : null
                ]}
              >
                <Text style={styles.clearDateText}>Fjern dato</Text>
              </Pressable>
            ) : null}
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <View style={[styles.buttonRow, styles.compactFormActions]}>
            <SecondaryButton
              compact
              label="Annuller"
              disabled={isSaving}
              onPress={onCancelForm}
            />
            <PrimaryButton compact label="Gem opgave" loading={isSaving} onPress={onSave} />
          </View>
        </Card>
      ) : null}

      <DeadlineDatePicker
        visible={showDeadlinePicker}
        selectedDate={deadline}
        onClose={onHideDeadlinePicker}
        onClear={onDeadlineClear}
        onSelect={onDeadlineSelect}
      />

      {activeTasks.length === 0 && recommendations.length === 0 ? (
        <EmptyState
          title="Kom godt i gang med vedligeholdelsen"
          body="Opret din første opgave, eller se Matrivas anbefalinger til dit hus."
        />
      ) : (
        <View style={styles.stack}>
          {overdueTasks.length > 0 ? (
            <MaintenanceSection
              completingTaskId={completingTaskId}
              onCompleteTask={onCompleteTask}
              onDeleteTask={onDeleteTask}
              onEditTask={openTaskForEditing}
              onOpenTask={onOpenTaskDetail}
              onSwipeOpen={handleSwipeOpened}
              openSwipeRowId={openSwipeRowId}
              tasks={overdueTasks}
              title="Overskredne"
            />
          ) : null}
          {soonTasks.length > 0 ? (
            <MaintenanceSection
              completingTaskId={completingTaskId}
              onCompleteTask={onCompleteTask}
              onDeleteTask={onDeleteTask}
              onEditTask={openTaskForEditing}
              onOpenTask={onOpenTaskDetail}
              onSwipeOpen={handleSwipeOpened}
              openSwipeRowId={openSwipeRowId}
              tasks={soonTasks}
              title="Snart"
            />
          ) : null}
          {seasonalTasks.length > 0 ? (
            <MaintenanceSection
              completingTaskId={completingTaskId}
              onCompleteTask={onCompleteTask}
              onDeleteTask={onDeleteTask}
              onEditTask={openTaskForEditing}
              onOpenTask={onOpenTaskDetail}
              onSwipeOpen={handleSwipeOpened}
              openSwipeRowId={openSwipeRowId}
              tasks={seasonalTasks}
              title="Denne sæson"
            />
          ) : null}
          {laterTasks.length > 0 ? (
            <MaintenanceSection
              completingTaskId={completingTaskId}
              onCompleteTask={onCompleteTask}
              onDeleteTask={onDeleteTask}
              onEditTask={openTaskForEditing}
              onOpenTask={onOpenTaskDetail}
              onSwipeOpen={handleSwipeOpened}
              openSwipeRowId={openSwipeRowId}
              tasks={laterTasks}
              title="Senere"
            />
          ) : null}
          {recommendations.length > 0 ? (
            <View style={styles.taskList}>
              <Text style={styles.sectionEyebrow}>Anbefalet til dit hus</Text>
              <Text style={styles.compactBodyText}>
                Matrivas anbefalinger er generelle forslag. Følg altid producentens anvisninger,
                og kontakt en fagperson ved tvivl.
              </Text>
              {visibleRecommendations.map((recommendation) => (
                <RecommendationCard
                  isSaving={isSaving}
                  key={recommendation.id}
                  onAccept={onAcceptRecommendation}
                  onDismiss={onDismissRecommendation}
                  onSwipeOpen={handleSwipeOpened}
                  openRowId={openSwipeRowId}
                  recommendation={recommendation}
                />
              ))}
              {hiddenRecommendationCount > 0 ? (
                <SecondaryButton
                  label={`Vis alle (${recommendations.length})`}
                  onPress={onOpenAllRecommendations}
                />
              ) : null}
            </View>
          ) : (
            <EmptyState
              title="Ingen nye anbefalinger lige nu"
              body="Vi viser nye forslag, når de bliver relevante for dit hus og årstiden."
            />
          )}
        </View>
      )}

      <View style={styles.taskList}>
        <Text style={styles.sectionEyebrow}>Historik</Text>
        {latestHistory.length > 0 ? (
          latestHistory.map((entry) => (
            <MaintenanceHistoryRow
              entry={entry}
              key={entry.id}
              onPress={() => onOpenHistoryDetail(entry)}
            />
          ))
        ) : (
          <EmptyState
            title="Ingen udførte opgaver endnu"
            body="Når du afslutter en opgave, bliver den gemt i husets historik."
          />
        )}
        {history.length > 3 ? (
          <SecondaryButton label="Vis al historik" onPress={onOpenFullHistory} />
        ) : null}
      </View>
    </View>
  );
}

function MaintenanceSection({
  title,
  tasks,
  completingTaskId,
  onCompleteTask,
  onOpenTask,
  onEditTask,
  onDeleteTask,
  openSwipeRowId,
  onSwipeOpen
}: {
  title: string;
  tasks: MaintenanceTask[];
  completingTaskId: TaskId | null;
  onCompleteTask: (task: MaintenanceTask) => void;
  onOpenTask: (task: MaintenanceTask) => void;
  onEditTask: (task: MaintenanceTask) => void;
  onDeleteTask: (task: MaintenanceTask) => void;
  openSwipeRowId: string | null;
  onSwipeOpen: (rowId: string) => void;
}) {
  return (
    <View style={styles.taskList}>
      <Text style={styles.sectionEyebrow}>{title}</Text>
      {tasks.map((task) => (
        <TaskRow
          completing={completingTaskId === task.id}
          key={task.id}
          onComplete={onCompleteTask}
          onDelete={onDeleteTask}
          onEdit={onEditTask}
          onOpen={onOpenTask}
          onSwipeOpen={onSwipeOpen}
          openRowId={openSwipeRowId}
          task={task}
        />
      ))}
    </View>
  );
}


function WelcomeScreen({
  onCreateProfile,
  onLogin
}: {
  onCreateProfile: () => void;
  onLogin: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const isCompact = windowHeight < 760;
  const visualLift = Math.round(windowHeight * 0.1);
  const welcomeBottomRef = useRef<View>(null);
  const [fadeTop, setFadeTop] = useState<number | null>(null);

  return (
    <ImageBackground
      accessibilityIgnoresInvertColors
      accessibilityLabel="Moderne dansk parcelhus i en grøn have"
      imageStyle={styles.welcomeBackgroundImage}
      resizeMode="cover"
      source={welcomeHeroImage}
      style={styles.welcomeBackground}
    >
      {fadeTop !== null ? (
        <View
          pointerEvents="none"
          style={[styles.welcomeBottomFade, { top: fadeTop }]}
        >
          <Image
            accessibilityElementsHidden
            resizeMode="stretch"
            source={welcomeBottomFadeImage}
            style={styles.welcomeBottomFadeImage}
          />
        </View>
      ) : null}

      <SafeAreaView style={styles.welcomeSafeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.welcomeContent,
            isCompact ? styles.welcomeContentCompact : null
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.welcomeBrand,
              isCompact ? styles.welcomeBrandCompact : null,
              { transform: [{ translateY: -visualLift }] }
            ]}
          >
            <Image
              accessibilityElementsHidden
              resizeMode="contain"
              source={matrivaSymbol}
              style={styles.welcomeHouseMark}
            />

            <Text style={styles.welcomeWordmark}>MATRIVA</Text>
            <Text style={styles.welcomeTagline}>Styr på dit hus. Ét sted.</Text>
          </View>

          <View
            onLayout={() => {
              welcomeBottomRef.current?.measureInWindow((_x, y) => {
                const nextFadeTop = Math.round(y);
                setFadeTop((currentFadeTop) =>
                  currentFadeTop === nextFadeTop ? currentFadeTop : nextFadeTop
                );
              });
            }}
            ref={welcomeBottomRef}
            style={styles.welcomeBottom}
          >
            <View style={styles.welcomeActions}>
              <Pressable
                accessibilityHint="Åbner login med din e-mailadresse"
                accessibilityRole="button"
                onPress={onLogin}
                style={({ pressed }) => [
                  styles.welcomePrimaryButton,
                  pressed ? styles.welcomePrimaryButtonPressed : null
                ]}
              >
                <View style={styles.welcomeButtonContent}>
                  <View style={styles.welcomeLockIcon}>
                    <View style={styles.welcomeLockShackle} />
                    <View style={styles.welcomeLockBody} />
                  </View>
                  <Text style={styles.welcomePrimaryButtonText}>Log ind</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityHint="Opretter en ny Matriva-profil"
                accessibilityRole="button"
                onPress={onCreateProfile}
                style={({ pressed }) => [
                  styles.welcomeSecondaryButton,
                  pressed ? styles.welcomeSecondaryButtonPressed : null
                ]}
              >
                <View style={styles.welcomeButtonContent}>
                  <View style={styles.welcomeUserIcon}>
                    <View style={styles.welcomeUserHead} />
                    <View style={styles.welcomeUserShoulders} />
                  </View>
                  <Text style={styles.welcomeSecondaryButtonText}>Opret konto</Text>
                </View>
              </Pressable>

            </View>

            <Text style={styles.welcomeLegal}>
              Ved at fortsætte accepterer du Matri­vas brugsvilkår og
              privatlivspolitik.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function LoginScreen({
  mode,
  email,
  message,
  devMagicLink,
  isLoading,
  onBack,
  onEmailChange,
  onRequestLink,
  onOpenDevLink
}: {
  mode: Exclude<UnauthenticatedStep, "welcome">;
  email: string;
  message: string | null;
  devMagicLink: string | null;
  isLoading: boolean;
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onRequestLink: () => void;
  onOpenDevLink: (url: string) => void;
}) {
  const isCreateMode = mode === "create";

  return (
    <View style={styles.stack}>
      <View style={styles.emailHeader}>
        <SecondaryButton label="Tilbage" disabled={isLoading} onPress={onBack} />
        <SectionHeader
          title={isCreateMode ? "Opret din Matriva-profil" : "Log ind på Matriva"}
          subtitle={
            isCreateMode
              ? "Indtast din e-mail. Vi sender dig et sikkert link – ingen adgangskode nødvendig."
              : "Indtast den e-mail, du brugte, da du oprettede din profil."
          }
        />
      </View>
      <Card>
        <View style={styles.formSection}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={onEmailChange}
            placeholder="dig@example.dk"
            style={styles.input}
            value={email}
          />
        </View>
        <PrimaryButton
          label={isCreateMode ? "Send mig linket" : "Send loginlink"}
          loading={isLoading}
          disabled={isLoading}
          onPress={onRequestLink}
        />
        {message ? <Text style={styles.bodyText}>{message}</Text> : null}
        {devMagicLink ? (
          <SecondaryButton label="Åbn udviklingslink" onPress={() => onOpenDevLink(devMagicLink)} />
        ) : null}
      </Card>
    </View>
  );
}

function ProfileOnboardingScreen({
  user,
  displayName,
  isSaving,
  onNameChange,
  onSave
}: {
  user: CurrentUser;
  displayName: string;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.stack}>
      <SectionHeader title="Din profil" subtitle="Fortæl Matriva, hvad vi skal kalde dig." />
      <Card>
        <InfoRow label="Email" value={user.email} />
        <View style={styles.formSection}>
          <Text style={styles.label}>Navn</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={onNameChange}
            placeholder="Dit navn"
            style={styles.input}
            value={displayName}
          />
        </View>
        <PrimaryButton
          label="Fortsæt"
          loading={isSaving}
          disabled={isSaving || displayName.trim().length === 0}
          onPress={onSave}
        />
      </Card>
    </View>
  );
}

function BootstrapRetryScreen({
  isLoading,
  onRetry
}: {
  isLoading: boolean;
  onRetry: () => void;
}) {
  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Vi kunne ikke hente din appstatus"
        subtitle={
          "Din session er stadig gemt. Prøv igen, så henter Matriva den autoritative onboarding-state fra API'et."
        }
      />
      <PrimaryButton
        label="Prøv igen"
        loading={isLoading}
        disabled={isLoading}
        onPress={onRetry}
      />
    </View>
  );
}

const documentTypeGroups: Array<{ label: string; options: Array<[HouseDocumentType, string]> }> = [
  { label: "Rapporter", options: [["condition_report", "Tilstandsrapport"], ["energy_label", "Energimærke"]] },
  { label: "Officielle oplysninger", options: [["bbr_notice", "BBR-meddelelse"]] },
  { label: "Manualer og garantier", options: [["manual", "Brugermanual"], ["warranty", "Garantibevis"]] },
  { label: "Fakturaer og kvitteringer", options: [["invoice", "Faktura"], ["receipt", "Kvittering"]] },
  { label: "Aftaler", options: [["purchase_agreement", "Købsaftale"], ["insurance_policy", "Forsikringspolice"], ["service_agreement", "Serviceaftale"]] },
  { label: "Forbedringer", options: [["renovation_documentation", "Renoveringsdokumentation"]] },
  { label: "Andet", options: [["other", "Andet dokument"]] }
];

const documentTypesWithAmount: ReadonlySet<HouseDocumentType> = new Set([
  "invoice",
  "receipt",
  "purchase_agreement",
  "renovation_documentation"
]);

function documentTypeHasAmount(value: HouseDocumentType | null) {
  return value !== null && documentTypesWithAmount.has(value);
}

function documentTypeLabel(value: HouseDocumentType | null) {
  return documentTypeGroups.flatMap((group) => group.options).find(([key]) => key === value)?.[1] ?? "Vælg dokumenttype";
}

function documentCategoryLabel(value: HouseDocumentCategory | null) {
  return {
    reports: "Rapporter",
    official: "Officielle oplysninger",
    manuals_warranties: "Manualer og garantier",
    invoices_receipts: "Fakturaer og kvitteringer",
    improvements: "Forbedringer",
    insurance: "Forsikring",
    agreements: "Aftaler",
    other: "Andet"
  }[value ?? "other"] ?? "Mangler";
}

function documentMimeLabel(mimeType: HouseDocument["mimeType"]) {
  return mimeType === "application/pdf" ? "PDF-dokument" : "Billede";
}

function documentCreatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Oprettet: Ukendt dato";
  }

  return `Oprettet: ${date.getDate()}. ${danishMonthNames[date.getMonth()]}`;
}

function DocumentImageGlyph() {
  return <View style={styles.documentImageGlyph}><View style={styles.documentImageGlyphSun} /><View style={styles.documentImageGlyphMountainLeft} /><View style={styles.documentImageGlyphMountainRight} /></View>;
}

function DocumentListIcon({ mimeType }: { mimeType: HouseDocument["mimeType"] }) {
  if (mimeType === "application/pdf") {
    return <View style={[styles.documentListIcon, styles.documentPdfIcon]}><Text style={styles.documentPdfIconText}>PDF</Text></View>;
  }

  return <View style={[styles.documentListIcon, styles.documentImageIcon]}><DocumentImageGlyph /></View>;
}

function CategoryIcon({ category }: { category: HouseDocumentCategory }) {
  const iconName = category === "official"
    ? "shield-check"
    : category === "improvements"
      ? "tools"
      : category === "manuals_warranties"
        ? "folder-cog-outline"
        : "file-document-outline";

  return <View style={styles.categoryIcon}><MaterialCommunityIcons accessibilityLabel="Kategorisymbol" color={theme.primary} name={iconName} size={27} /></View>;
}

function DocumentTypeSelector({
  value,
  onChange
}: {
  value: HouseDocumentType | null;
  onChange: (value: HouseDocumentType) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vælg dokumenttype"
        accessibilityHint="Åbner en liste over dokumenttyper"
        onPress={() => setVisible(true)}
        style={[styles.input, styles.selectorField]}
      >
        <Text style={value ? styles.dateFieldValue : styles.dateFieldPlaceholder}>{documentTypeLabel(value)}</Text>
        <Text style={styles.dateFieldIcon}>⌄</Text>
      </Pressable>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.selectorBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Luk dokumenttypevælger" onPress={() => setVisible(false)} style={styles.datePickerDismissArea} />
          <View style={styles.selectorPanel}>
            <View style={styles.screenTitleRow}><Text style={styles.modalTitle}>Vælg dokumenttype</Text><Pressable accessibilityRole="button" onPress={() => setVisible(false)}><Text style={styles.cancelText}>Luk</Text></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {documentTypeGroups.map((group) => <View key={group.label} style={styles.selectorGroup}><Text style={styles.selectorGroupTitle}>{group.label}</Text>{group.options.map(([key, label]) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: value === key }} onPress={() => { onChange(key); setVisible(false); }} style={[styles.selectorOption, value === key && styles.selectorOptionSelected]}><Text style={[styles.selectorOptionText, value === key && styles.selectorOptionTextSelected]}>{label}</Text><Text style={styles.selectorCheck}>{value === key ? "✓" : ""}</Text></Pressable>)}</View>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function DocumentsScreen({
  documents,
  isSaving,
  onOpenDocument,
  onDeleteDocument,
  onPickSource,
  onSaveDocument,
  fileName,
  isPicking
}: {
  documents: HouseDocument[];
  isSaving: boolean;
  onOpenDocument: (document: HouseDocument) => void;
  onDeleteDocument: (document: HouseDocument) => void;
  onPickSource: (source: "camera" | "library" | "file") => void;
  onSaveDocument: (input: Omit<UploadHouseDocumentRequest, "fileName" | "mimeType" | "sizeBytes" | "contentBase64">) => Promise<boolean>;
  fileName: string | null;
  isPicking: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "important" | "expiring">("all");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [documentType, setDocumentType] = useState<HouseDocumentType | null>(null);
  const [relatedParty, setRelatedParty] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [showDocumentDatePicker, setShowDocumentDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<HouseDocument | null>(null);
  const [isDocumentNoteExpanded, setIsDocumentNoteExpanded] = useState(false);
  useEffect(() => {
    setIsDocumentNoteExpanded(false);
  }, [selectedDocument?.id]);
  useEffect(() => {
    if (fileName && !title) setTitle(fileName.replace(/\.[^.]+$/, ""));
  }, [fileName, title]);
  const now = new Date();
  const soon = new Date(now.getTime() + 90 * 86400000);
  const isMissing = (d: HouseDocument) => !d.title || !d.category || !d.documentType;
  const isExpiring = (d: HouseDocument) => Boolean(d.expiresAt && new Date(d.expiresAt) <= soon);
  const filtered = documents.filter((d) => {
    const matchesSearch = (d.title ?? d.originalFilename).toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "all" || (filter === "important" && d.isImportant) || (filter === "expiring" && isExpiring(d)));
  });
  const categories: Array<[HouseDocumentCategory, string]> = [["reports", "Rapporter"], ["official", "Officielle oplysninger"], ["improvements", "Forbedringer"], ["manuals_warranties", "Manualer & garantier"]];
  const resetForm = () => { setShowForm(false); setTitle(""); setDocumentDate(""); setDocumentType(null); setRelatedParty(""); setAmount(""); setExpiresAt(""); setNote(""); setIsImportant(false); setShowDocumentDatePicker(false); setShowExpiryDatePicker(false); };
  const relatedPartyLabel = documentType === "invoice" || documentType === "receipt" ? "Virksomhed" : documentType === "warranty" ? "Producent eller leverandør" : documentType === "insurance_policy" ? "Forsikringsselskab" : documentType === "service_agreement" ? "Leverandør" : documentType === "purchase_agreement" ? "Relevant part" : null;
  const expiryLabel = documentType === "warranty" ? "Garanti til" : "Udløbsdato";
  const hasExpiry = documentType === "warranty" || documentType === "insurance_policy" || documentType === "service_agreement";
  return (
    <View style={styles.stack}>
      <View style={styles.screenTitleRow}><SectionHeader title="Dokumenter" /><Pressable accessibilityRole="button" accessibilityLabel="Tilføj dokument" onPress={() => { resetForm(); setShowForm(true); }} style={styles.documentAddButton}><Text style={styles.documentAddButtonText}>+</Text></Pressable></View>
      <TextInput value={search} onChangeText={setSearch} placeholder="⌕  Søg i dokumenter" placeholderTextColor={theme.subtle} style={styles.documentSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.documentChips}>
        {([["all", "Alle"], ["important", "! Vigtige"], ["expiring", "Udløber snart"]] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.documentChip, filter === key && styles.documentChipActive]}><Text style={[styles.documentChipText, filter === key && styles.documentChipTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      <Text style={styles.documentSectionTitle}>Kategorier</Text>
      <View style={styles.categoryGrid}>{categories.map(([key, label]) => <View key={key} style={styles.categoryCard}><CategoryIcon category={key} /><Text style={styles.categoryTitle}>{label}</Text><Text style={styles.categoryCount}>{documents.filter((d) => d.category === key).length} filer</Text></View>)}</View>
      <Text style={styles.documentSectionTitle}>Seneste dokumenter</Text>
      {filtered.length ? filtered.map((document) => <Pressable key={document.id} style={styles.documentListRow} onPress={() => setSelectedDocument(document)}><DocumentListIcon mimeType={document.mimeType} /><View style={styles.fileTextGroup}><Text numberOfLines={1} style={styles.taskRowTitle}>{document.title ?? document.originalFilename}</Text><Text style={styles.metaText}>{documentCreatedLabel(document.createdAt)} · {(document.sizeBytes / 1024 / 1024).toFixed(1)} MB</Text>{isMissing(document) ? <Text style={styles.missingLabel}>MANGLER</Text> : null}</View><Text style={styles.documentChevron}>›</Text></Pressable>) : <EmptyState title="Ingen dokumenter matcher" body="Prøv et andet søgeord eller filter." />}
      <Modal visible={showForm} animationType="slide" onRequestClose={resetForm}>
        <SafeAreaView style={styles.modalSurface}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardFrame}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.screenTitleRow}><Text style={styles.modalTitle}>Tilføj dokument</Text><Pressable accessibilityRole="button" onPress={resetForm}><Text style={styles.cancelText}>Annuller</Text></Pressable></View>
              <View style={styles.sourceRow}>{[["camera", "Tag foto"], ["library", "Vælg billede"], ["file", "Upload PDF"]].map(([source, label]) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={isPicking || isSaving} key={source} style={[styles.sourceCard, (isPicking || isSaving) && styles.disabled]} onPress={() => onPickSource(source as "camera" | "library" | "file")}>
                {source === "camera" ? <MaterialCommunityIcons color={theme.primary} name="camera-outline" size={27} /> : source === "library" ? <DocumentImageGlyph /> : <Text style={styles.sourceIcon}>PDF</Text>}
                <Text style={styles.sourceLabel}>{label}</Text>
              </Pressable>)}</View>
              {fileName ? <Text style={styles.selectedFile}>Valgt: {fileName}</Text> : null}
              <Text style={styles.label}>Titel</Text><TextInput accessibilityLabel="Titel" value={title} onChangeText={setTitle} placeholder="F.eks. Købsaftale" placeholderTextColor={theme.subtle} style={styles.input} />
              <Text style={styles.label}>Dokumentdato</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Dokumentdato" onPress={() => setShowDocumentDatePicker(true)} style={styles.dateField}><Text style={documentDate ? styles.dateFieldValue : styles.dateFieldPlaceholder}>{documentDate ? formatDisplayDate(documentDate) : "Vælg dato"}</Text><Text style={styles.dateFieldIcon}>⌄</Text></Pressable>
              {documentDate ? <Pressable accessibilityRole="button" onPress={() => setDocumentDate("")}><Text style={styles.clearDateText}>Fjern dato</Text></Pressable> : null}
              <DeadlineDatePicker title="Vælg dokumentdato" visible={showDocumentDatePicker} selectedDate={documentDate} onClose={() => setShowDocumentDatePicker(false)} onClear={() => { setDocumentDate(""); setShowDocumentDatePicker(false); }} onSelect={(value) => { setDocumentDate(value); setShowDocumentDatePicker(false); }} />
              <Text style={styles.label}>Dokumenttype</Text><DocumentTypeSelector value={documentType} onChange={setDocumentType} />
              {documentTypeHasAmount(documentType) ? <><Text style={styles.label}>Beløb i DKK</Text><TextInput accessibilityLabel="Beløb i DKK" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={theme.subtle} style={styles.input} /></> : null}
              {relatedPartyLabel ? <><Text style={styles.label}>{relatedPartyLabel}</Text><TextInput accessibilityLabel={relatedPartyLabel} value={relatedParty} onChangeText={setRelatedParty} style={styles.input} /></> : null}
              {hasExpiry ? <><Text style={styles.label}>{expiryLabel}</Text><Pressable accessibilityRole="button" accessibilityLabel={expiryLabel} onPress={() => setShowExpiryDatePicker(true)} style={styles.dateField}><Text style={expiresAt ? styles.dateFieldValue : styles.dateFieldPlaceholder}>{expiresAt ? formatDisplayDate(expiresAt) : "Vælg dato"}</Text><Text style={styles.dateFieldIcon}>⌄</Text></Pressable>{expiresAt ? <Pressable accessibilityRole="button" onPress={() => setExpiresAt("")}><Text style={styles.clearDateText}>Fjern dato</Text></Pressable> : null}<DeadlineDatePicker title={expiryLabel} visible={showExpiryDatePicker} selectedDate={expiresAt} onClose={() => setShowExpiryDatePicker(false)} onClear={() => { setExpiresAt(""); setShowExpiryDatePicker(false); }} onSelect={(value) => { setExpiresAt(value); setShowExpiryDatePicker(false); }} /></> : null}
              <View style={styles.switchRow}><Text style={styles.label}>Markér som vigtigt</Text><Switch accessibilityLabel="Markér som vigtigt" value={isImportant} onValueChange={setIsImportant} trackColor={{ true: theme.primary }} /></View>
              <Text style={styles.label}>Notat</Text><TextInput value={note} onChangeText={setNote} multiline style={[styles.input, styles.textArea]} />
              <PrimaryButton
                label="Gem"
                disabled={!fileName || !title.trim() || !documentType || isSaving}
                loading={isSaving}
                onPress={async () => {
                  const saved = await onSaveDocument({
                    title: title.trim(),
                    documentDate: documentDate || null,
                    category: houseDocumentCategoryForType(documentType),
                    documentType,
                    relatedParty: relatedParty || null,
                    amountMinor: amount ? Math.round(Number(amount.replace(",", ".")) * 100) : null,
                    expiresAt: expiresAt || null,
                    isImportant,
                    note: note || null
                  });
                  if (saved) {
                    resetForm();
                  }
                }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal visible={Boolean(selectedDocument)} animationType="slide" onRequestClose={() => setSelectedDocument(null)}>
        <SafeAreaView style={styles.modalSurface}>
          <ScrollView contentContainerStyle={styles.documentDetailContent}>
            {selectedDocument ? <>
              <View style={styles.documentDetailHeader}>
                <Pressable accessibilityRole="button" accessibilityLabel="Luk dokumentdetalje" onPress={() => setSelectedDocument(null)} style={styles.documentDetailBack}><Text style={styles.documentDetailBackText}>‹</Text></Pressable>
                <Text style={styles.documentDetailHeaderTitle}>Dokumentdetalje</Text>
                <View style={styles.documentDetailHeaderSpacer} />
              </View>
              <View style={styles.documentDetailPreview}>
                <Text style={[styles.documentDetailPreviewIcon, selectedDocument.mimeType === "application/pdf" && styles.pdfIcon]}>{selectedDocument.mimeType === "application/pdf" ? "PDF" : "▧"}</Text>
                <Text style={styles.documentDetailPreviewHint}>{documentMimeLabel(selectedDocument.mimeType)}</Text>
                <Text numberOfLines={2} style={styles.documentDetailPreviewName}>{selectedDocument.title ?? selectedDocument.originalFilename}</Text>
              </View>
              <Text style={styles.documentDetailTitle}>{selectedDocument.title ?? selectedDocument.originalFilename}</Text>
              <View style={styles.documentDetailCard}>
                <View style={styles.documentDetailRow}><Text style={styles.documentDetailLabel}>Kategori</Text><Text style={styles.documentDetailValue}>{selectedDocument.category ? documentCategoryLabel(selectedDocument.category) : "Mangler"}</Text></View>
                <View style={styles.documentDetailRow}><Text style={styles.documentDetailLabel}>Dokumenttype</Text><Text style={styles.documentDetailValue}>{selectedDocument.documentType ? documentTypeLabel(selectedDocument.documentType) : "Mangler"}</Text></View>
                <View style={styles.documentDetailRow}><Text style={styles.documentDetailLabel}>Dokumentdato</Text><Text style={styles.documentDetailValue}>{selectedDocument.documentDate ? formatDisplayDate(selectedDocument.documentDate) : "Mangler"}</Text></View>
                {selectedDocument.relatedParty ? <View style={styles.documentDetailRow}><Text style={styles.documentDetailLabel}>Relevant part</Text><Text style={styles.documentDetailValue}>{selectedDocument.relatedParty}</Text></View> : null}
                {selectedDocument.amountMinor !== null ? <View style={styles.documentDetailRow}><Text style={styles.documentDetailLabel}>Beløb</Text><Text style={styles.documentDetailValue}>{(selectedDocument.amountMinor / 100).toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr.</Text></View> : null}
                {selectedDocument.expiresAt ? <View style={styles.documentDetailRow}><Text style={styles.documentDetailLabel}>Garanti-/udløbsdato</Text><Text style={styles.documentDetailValue}>{formatDisplayDate(selectedDocument.expiresAt)}</Text></View> : null}
                {selectedDocument.note?.trim() ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isDocumentNoteExpanded }}
                      accessibilityLabel={isDocumentNoteExpanded ? "Skjul notat" : "Vis notat"}
                      onPress={() => setIsDocumentNoteExpanded((expanded) => !expanded)}
                      style={styles.documentNoteToggle}
                    >
                      <Text style={styles.documentDetailLabel}>Notat</Text>
                      <Text style={styles.documentDetailValue}>{isDocumentNoteExpanded ? "Skjul" : "Vis notat"}</Text>
                    </Pressable>
                    {isDocumentNoteExpanded ? <Text style={styles.documentNoteText}>{selectedDocument.note}</Text> : null}
                  </>
                ) : null}
              </View>
              <PrimaryButton label="Åbn dokument" onPress={() => { const documentToOpen = selectedDocument; setSelectedDocument(null); onOpenDocument(documentToOpen); }} />
              <SecondaryButton label="Fjern dokument" onPress={() => { setSelectedDocument(null); onDeleteDocument(selectedDocument); }} />
            </> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function MoreScreen({
  isLoggingOut,
  onOpenProfile,
  onOpenSettings,
  onLogout
}: {
  isLoggingOut: boolean;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  const rows = ["Profil", "Indstillinger", "Deling & adgang", "Hjælp", "Om Matriva"];

  return (
    <View style={styles.stack}>
      <SectionHeader title="Mere" />
      <Card>
        {rows.map((row, index) => {
          const isProfile = row === "Profil";
          const isSettings = row === "Indstillinger";
          const isEnabled = isProfile || isSettings;

          return (
            <Pressable
              accessibilityRole="button"
              disabled={!isEnabled}
              key={row}
              onPress={isProfile ? onOpenProfile : isSettings ? onOpenSettings : undefined}
              style={({ pressed }) => [
                styles.menuRow,
                index === rows.length - 1 ? styles.menuRowLast : null,
                pressed && isEnabled ? styles.secondaryButtonPressed : null
              ]}
            >
              <Text style={styles.menuText}>{row}</Text>
              <Text style={styles.menuMeta}>{isEnabled ? "Åbn" : "Kommer senere"}</Text>
            </Pressable>
          );
        })}
      </Card>
      <Card>
        <Pressable
          accessibilityRole="button"
          disabled={isLoggingOut}
          onPress={onLogout}
          style={({ pressed }) => [
            styles.menuRow,
            styles.menuRowLast,
            pressed && !isLoggingOut ? styles.secondaryButtonPressed : null,
            isLoggingOut ? styles.disabled : null
          ]}
        >
          <Text style={styles.menuText}>{isLoggingOut ? "Logger ud..." : "Log ud"}</Text>
          <Text style={styles.menuMeta}>Afslut session</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function SettingsScreen({
  promptForCompletionNote,
  isSaving,
  onBack,
  onChange
}: {
  promptForCompletionNote: boolean;
  isSaving: boolean;
  onBack: () => void;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.screenTitleRow}>
        <SectionHeader title="Indstillinger" />
        <SecondaryButton label="Tilbage" onPress={onBack} />
      </View>
      <Card>
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextGroup}>
            <Text style={styles.menuText}>Spørg efter note ved fuldførelse</Text>
            <Text style={styles.compactBodyText}>
              Vis mulighed for at skrive en note, når en opgave markeres som udført.
            </Text>
          </View>
          <Switch
            disabled={isSaving}
            onValueChange={onChange}
            trackColor={{ false: theme.border, true: theme.primarySoft }}
            thumbColor={promptForCompletionNote ? theme.primary : theme.muted}
            value={promptForCompletionNote}
          />
        </View>
      </Card>
    </View>
  );
}

function ProfileScreen({
  user,
  profile,
  displayName,
  isSaving,
  onBack,
  onNameChange,
  onSaveProfile
}: {
  user: CurrentUser | null;
  profile: UserProfile | null;
  displayName: string;
  isSaving: boolean;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onSaveProfile: () => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.screenTitleRow}>
        <SectionHeader title="Profil" />
        <SecondaryButton label="Tilbage" onPress={onBack} />
      </View>
      <Card>
        <InfoRow label="Navn" value={profile?.displayName ?? "Ikke sat"} />
        <InfoRow label="Email" value={user?.email ?? "Ikke indlæst"} />
        <View style={styles.formSection}>
          <Text style={styles.label}>Rediger navn</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={onNameChange}
            placeholder="Dit navn"
            style={styles.input}
            value={displayName}
          />
        </View>
        <PrimaryButton
          label="Gem navn"
          loading={isSaving}
          disabled={isSaving || displayName.trim().length === 0}
          onPress={onSaveProfile}
        />
      </Card>
    </View>
  );
}

export default function App() {
  const accessTokenRef = useRef<string | null>(null);
  const consumedMagicLinkTokensRef = useRef<Set<string>>(new Set());
  const isConsumingMagicLinkRef = useRef(false);
  const apiClient = useMemo(
    () =>
      createMatrivaApiClient({
        baseUrl: matrivaApiConfig.baseUrl,
        getAccessToken: () => accessTokenRef.current
      }),
    []
  );

  const [authStatus, setAuthStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<SessionTokens | null>(null);
  const [bootstrap, setBootstrap] = useState<AppBootstrapResponse | null>(null);
  const [unauthenticatedStep, setUnauthenticatedStep] =
    useState<UnauthenticatedStep>("welcome");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [moreView, setMoreView] = useState<MoreView>("menu");
  const [houseView, setHouseView] = useState<HouseView>("overview");
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>("app");
  const [houses, setHouses] = useState<SavedHouse[]>([]);
  const [publicDataSummaries, setPublicDataSummaries] = useState<
    HousePublicDataSummary[]
  >([]);
  const [publicDataProfile, setPublicDataProfile] =
    useState<HousePublicDataProfileV1 | null>(null);
  const [selectedHouseId, setSelectedHouseId] = useState<HouseId | null>(null);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryEntry[]>([]);
  const [maintenanceRecommendations, setMaintenanceRecommendations] = useState<
    MaintenanceRecommendation[]
  >([]);
  const [maintenanceSwipeHintSeen, setMaintenanceSwipeHintSeen] = useState<boolean | null>(null);
  const [houseDocuments, setHouseDocuments] = useState<HouseDocument[]>([]);
  const [documentPreview, setDocumentPreview] = useState<{
    uri: string;
    title: string;
    mimeType: string;
  } | null>(null);
  const [pendingDocument, setPendingDocument] = useState<Pick<UploadHouseDocumentRequest, "fileName" | "mimeType" | "sizeBytes" | "contentBase64"> | null>(null);
  const [isPickingDocument, setIsPickingDocument] = useState(false);
  const [maintenanceView, setMaintenanceView] = useState<MaintenanceView>("main");
  const [selectedHistoryDetail, setSelectedHistoryDetail] =
    useState<MaintenanceHistoryDetail | null>(null);
  const [historyReversalInProgress, setHistoryReversalInProgress] = useState(false);
  const [historyReversalError, setHistoryReversalError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [maintenanceFilter, setMaintenanceFilter] =
    useState<MaintenanceFilter>("current");
  const [historyYearFilter, setHistoryYearFilter] = useState<number | null>(null);
  const [improvements, setImprovements] = useState<HouseImprovement[]>([]);
  const [housePhoto, setHousePhoto] = useState<HouseMedia | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [hasAddressSearched, setHasAddressSearched] = useState(false);
  const [houseOnboardingStep, setHouseOnboardingStep] =
    useState<HouseOnboardingStep>("search");
  const [houseOnboardingProgressText, setHouseOnboardingProgressText] =
    useState<string | null>(null);
  const [houseOnboardingPublicDataIssueText, setHouseOnboardingPublicDataIssueText] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<TaskId | null>(null);
  const [completionNoteTask, setCompletionNoteTask] = useState<MaintenanceTask | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completionDoNotAskAgain, setCompletionDoNotAskAgain] = useState(false);
  const [completionModalError, setCompletionModalError] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPrice, setTaskPrice] = useState("");
  const [taskRecurrenceInterval, setTaskRecurrenceInterval] = useState<
    MaintenanceRecurrenceInterval | ""
  >("");
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [improvementTitle, setImprovementTitle] = useState("");
  const [improvementYear, setImprovementYear] = useState("");
  const [improvementDescription, setImprovementDescription] = useState("");
  const [improvementCategory, setImprovementCategory] = useState<
    HouseImprovementCategory | ""
  >("");
  const [improvementDocumentReference, setImprovementDocumentReference] =
    useState("");
  const [improvementCost, setImprovementCost] = useState("");
  const [improvementFormError, setImprovementFormError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [publicDataRefreshMessage, setPublicDataRefreshMessage] =
    useState<PublicDataRefreshMessage | null>(null);

  useEffect(() => {
    let isMounted = true;

    void readMaintenanceSwipeHintSeen().then((seen) => {
      if (isMounted) {
        setMaintenanceSwipeHintSeen(seen);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  function dismissMaintenanceSwipeHint() {
    setMaintenanceSwipeHintSeen(true);
    void markMaintenanceSwipeHintSeen();
  }

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? houses[0] ?? null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedPublicDataSummary =
    publicDataSummaries.find(
      (summary) => summary.houseId === selectedHouse?.id
    ) ?? null;

  function resetUnauthenticatedFlowState() {
    accessTokenRef.current = null;
    isConsumingMagicLinkRef.current = false;
    consumedMagicLinkTokensRef.current.clear();
    setSession(null);
    setBootstrap(null);
    setUnauthenticatedStep("welcome");
    setLoginEmail("");
    setLoginMessage(null);
    setDevMagicLink(null);
    setProfileName("");
    setActiveTab("dashboard");
    setMoreView("menu");
    setHouseView("overview");
    setHouses([]);
    setPublicDataSummaries([]);
    setPublicDataProfile(null);
    setSelectedHouseId(null);
    setTasks([]);
    setHouseDocuments([]);
    setImprovements([]);
    setHousePhoto(null);
    setQuery("");
    setSuggestions([]);
    setSelectedAddress(null);
    setHasAddressSearched(false);
    setHouseOnboardingStep("search");
    setHouseOnboardingProgressText(null);
    setHouseOnboardingPublicDataIssueText(null);
    setError(null);
    setShowTaskForm(false);
    setShowDeadlinePicker(false);
    setCompletingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeadline("");
    setTaskPrice("");
    setTaskRecurrenceInterval("");
    setTaskFormError(null);
    setImprovementTitle("");
    setImprovementYear("");
    setImprovementDescription("");
    setImprovementCategory("");
    setImprovementDocumentReference("");
    setImprovementCost("");
    setImprovementFormError(null);
    setPhotoError(null);
    setPublicDataRefreshMessage(null);
    setLoadingAction(null);
  }

  const loadTasks = useCallback(
    async (houseId: HouseId) => {
      const response = await apiClient.listMaintenanceTasks(houseId);
      setTasks(response.tasks);
    },
    [apiClient]
  );

  const loadMaintenanceV1 = useCallback(
    async (houseId: HouseId) => {
      const [taskResponse, historyResponse, recommendationResponse] =
        await Promise.all([
          apiClient.listMaintenanceTasks(houseId),
          apiClient.listMaintenanceHistory(houseId),
          apiClient.listMaintenanceRecommendations(houseId)
        ]);
      setTasks(taskResponse.tasks);
      setMaintenanceHistory(historyResponse.history);
      setMaintenanceRecommendations(recommendationResponse.recommendations);
    },
    [apiClient]
  );

  const loadHouseDocuments = useCallback(
    async (houseId: HouseId) => {
      const response = await apiClient.listHouseDocuments(houseId);
      setHouseDocuments(response.documents);
    },
    [apiClient]
  );

  const loadHouseImprovements = useCallback(
    async (houseId: HouseId) => {
      const response = await apiClient.listHouseImprovements(houseId);
      setImprovements(response.improvements);
    },
    [apiClient]
  );

  const loadHousePhoto = useCallback(
    async (houseId: HouseId) => {
      const response = await apiClient.getHousePhoto(houseId);
      setHousePhoto(response.photo);
      setPhotoError(null);
    },
    [apiClient]
  );

  async function storeSessionTokens(tokens: SessionTokens) {
    accessTokenRef.current = tokens.accessToken;
    setSession(tokens);
    await writeStoredSession(tokens);
  }

  const loadApp = useCallback(async (options?: { showGlobalLoading?: boolean }) => {
    if (options?.showGlobalLoading !== false) {
      setLoadingAction("app");
    }
    setError(null);

    try {
      const bootstrapResponse = await apiClient.getAppBootstrap();
      setBootstrap(bootstrapResponse);
      setProfileName(bootstrapResponse.profile.displayName ?? "");
      setHouses(bootstrapResponse.houses);
      setPublicDataSummaries(bootstrapResponse.publicDataSummaries);
      setPublicDataProfile(null);
      const nextHouse =
        bootstrapResponse.houses.find(
          (house) => house.id === bootstrapResponse.activeHouseId
        ) ??
        bootstrapResponse.houses[0] ??
        null;
      setSelectedHouseId(nextHouse?.id ?? null);

      if (bootstrapResponse.onboarding.state === "complete" && nextHouse) {
        await Promise.all([
          loadMaintenanceV1(nextHouse.id),
          loadHouseImprovements(nextHouse.id),
          loadHousePhoto(nextHouse.id),
          loadHouseDocuments(nextHouse.id)
        ]);
      } else {
        setTasks([]);
        setMaintenanceHistory([]);
        setMaintenanceRecommendations([]);
        setHouseDocuments([]);
        setSelectedHistoryDetail(null);
        setMaintenanceView("main");
        setImprovements([]);
        setHousePhoto(null);
      }
    } catch (caughtError) {
      setError(userFacingError(caughtError));
      setTasks([]);
      setMaintenanceHistory([]);
      setMaintenanceRecommendations([]);
      setHouseDocuments([]);
      setSelectedHistoryDetail(null);
      setMaintenanceView("main");
      setImprovements([]);
      setHousePhoto(null);
      setPublicDataSummaries([]);
      setPublicDataProfile(null);
    } finally {
      if (options?.showGlobalLoading !== false) {
        setLoadingAction(null);
      }
    }
  }, [apiClient, loadHouseDocuments, loadHouseImprovements, loadHousePhoto, loadMaintenanceV1]);

  useEffect(() => {
    if (!selectedHouse || authStatus !== "authenticated") {
      setPublicDataProfile(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const publicData = await apiClient.getHousePublicData(selectedHouse.id);

        if (!cancelled) {
          setPublicDataProfile(publicData.profile);
        }
      } catch {
        if (!cancelled) {
          setPublicDataProfile(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiClient, authStatus, selectedHouse]);

  const consumeMagicLinkUrl = useCallback(
    async (url: string | null) => {
      if (!url) {
        return;
      }

      let parsedUrl: URL;

      try {
        parsedUrl = new URL(url);
      } catch {
        return;
      }

      const token = parsedUrl.searchParams.get("token");

      if (!token || !url.startsWith("matriva://auth/magic-link")) {
        return;
      }

      if (isConsumingMagicLinkRef.current || consumedMagicLinkTokensRef.current.has(token)) {
        return;
      }

      isConsumingMagicLinkRef.current = true;
      setLoadingAction("auth");
      setLoginMessage(null);
      setDevMagicLink(null);
      setError(null);

      try {
        const response = await apiClient.consumeMagicLink({ token });
        consumedMagicLinkTokensRef.current.add(token);
        await storeSessionTokens(response.tokens);
        setBootstrap(null);
        setAuthStatus("authenticated");
        await loadApp();
      } catch (caughtError) {
        await clearStoredSession();
        resetUnauthenticatedFlowState();
        setAuthStatus("anonymous");
        setError(userFacingError(caughtError));
      } finally {
        isConsumingMagicLinkRef.current = false;
        setLoadingAction(null);
      }
    },
    [apiClient, loadApp]
  );

  useEffect(() => {
    void (async () => {
      try {
        const storedSession = await readStoredSession();

        if (!storedSession) {
          setAuthStatus("anonymous");
          return;
        }

        accessTokenRef.current = storedSession.accessToken;
        const refreshed = await apiClient.refreshSession({
          refreshToken: storedSession.refreshToken
        });
        await storeSessionTokens(refreshed.tokens);
        setAuthStatus("authenticated");
        await loadApp();
      } catch {
        await clearStoredSession();
        resetUnauthenticatedFlowState();
        setAuthStatus("anonymous");
      } finally {
        setLoadingAction(null);
      }
    })();
  }, [apiClient, loadApp]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void consumeMagicLinkUrl(url);
    });

    void Linking.getInitialURL().then(consumeMagicLinkUrl);

    return () => subscription.remove();
  }, [consumeMagicLinkUrl]);

  async function searchAddresses() {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setError("Skriv mindst 2 tegn for at søge efter en adresse.");
      return;
    }

    setLoadingAction("address");
    setError(null);
    setSelectedAddress(null);
    setHouseOnboardingStep("search");
    setHouseOnboardingPublicDataIssueText(null);

    try {
      const response = await apiClient.searchAddresses(trimmedQuery);
      setSuggestions(response.suggestions);
      setHasAddressSearched(true);
    } catch (caughtError) {
      setSuggestions([]);
      setHasAddressSearched(false);
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  function continueAddressOnboarding() {
    if (!selectedAddress) {
      setError("Vælg en adresse, før du fortsætter.");
      return;
    }

    setError(null);
    setHouseOnboardingStep("confirm");
  }

  function chooseAnotherAddress() {
    setError(null);
    setSelectedAddress(null);
    setHouseOnboardingStep("search");
    setHouseOnboardingProgressText(null);
    setHouseOnboardingPublicDataIssueText(null);
  }

  function openUnauthenticatedMode(mode: Exclude<UnauthenticatedStep, "welcome">) {
    setUnauthenticatedStep(mode);
    setLoginMessage(null);
    setDevMagicLink(null);
    setError(null);
  }

  function returnToWelcome() {
    setUnauthenticatedStep("welcome");
    setLoginMessage(null);
    setDevMagicLink(null);
    setError(null);
  }

  async function requestLoginLink() {
    if (loadingAction === "auth") {
      return;
    }

    const trimmedEmail = loginEmail.trim();

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setLoginMessage("Skriv en gyldig emailadresse.");
      return;
    }

    setLoadingAction("auth");
    setLoginMessage(null);
    setDevMagicLink(null);
    setError(null);

    try {
      const response = await apiClient.requestMagicLink({ email: trimmedEmail });
      setLoginMessage("Vi har sendt et loginlink, hvis emailen kan bruges til Matriva.");
      setDevMagicLink(response.devMagicLink ?? null);
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function saveProfile() {
    const trimmedName = profileName.trim();

    if (!trimmedName) {
      setError("Navn må ikke være tomt.");
      return;
    }

    setLoadingAction("profile");
    setError(null);

    try {
      await apiClient.updateProfile({ displayName: trimmedName, preferredLocale: "da-DK" });
      await loadApp();
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function updateCompletionNotePrompt(value: boolean) {
    setLoadingAction("profile");
    setError(null);

    try {
      const response = await apiClient.updateMaintenanceSettings({
        promptForCompletionNote: value
      });
      setBootstrap((current) =>
        current ? { ...current, profile: response.profile } : current
      );
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function logout() {
    setLoadingAction("logout");
    setError(null);

    try {
      if (session) {
        await apiClient.logout({ refreshToken: session.refreshToken });
      }
    } catch {
      // Local credentials are still removed so a user can leave the device safely if the API is unavailable.
    } finally {
      await clearStoredSession();
      resetUnauthenticatedFlowState();
      setAuthStatus("anonymous");
    }
  }

  async function saveHouse() {
    if (!selectedAddress) {
      setError("Vælg en adresse, før du gemmer huset.");
      return;
    }

    setLoadingAction("house");
    setError(null);
    setHouseOnboardingStep("progress");
    setHouseOnboardingProgressText("Vi gemmer din bolig");
    setHouseOnboardingPublicDataIssueText(null);
    let savedHouseId: HouseId | null = null;

    try {
      const selectedAddressPayload = selectedAddressInput(selectedAddress);
      const draft = await apiClient.createHouseDraft(selectedAddressPayload);
      const response = await apiClient.createSavedHouse({
        houseDraftId: draft.houseDraft.id,
        selectedAddress: draft.houseDraft.selectedAddress
      });
      savedHouseId = response.house.id;
      setSelectedHouseId(response.house.id);
      setHouseOnboardingProgressText("Vi henter boligoplysninger fra BBR");
      const publicData = await apiClient.refreshHousePublicData(response.house.id);
      setPublicDataProfile(publicData.profile);

      if (!publicDataIsUsableAfterOnboarding(publicData)) {
        await loadApp({ showGlobalLoading: false });
        setSelectedHouseId(response.house.id);
        setHouseOnboardingPublicDataIssueText(publicDataIssueMessage(publicData.status));
        setHouseOnboardingStep("publicDataIssue");
        return;
      }

      setHouseOnboardingProgressText("Vi gør din boligoversigt klar");
      await loadApp({ showGlobalLoading: false });
      setSelectedHouseId(response.house.id);
      setQuery("");
      setSuggestions([]);
      setSelectedAddress(null);
      setHasAddressSearched(false);
      setHouseOnboardingStep("search");
      setHouseOnboardingProgressText(null);
      setHouseOnboardingPublicDataIssueText(null);
      setActiveTab("dashboard");
    } catch (caughtError) {
      const message = userFacingError(caughtError);
      if (savedHouseId) {
        await loadApp({ showGlobalLoading: false });
        setSelectedHouseId(savedHouseId);
        setHouseOnboardingPublicDataIssueText(
          "Boligen er gemt, men vi kunne ikke hente BBR-oplysningerne lige nu."
        );
        setHouseOnboardingStep("publicDataIssue");
      } else {
        setHouseOnboardingStep("confirm");
      }
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  }

  async function retryOnboardingPublicData() {
    const onboardingHouseId = selectedHouseId;

    if (!onboardingHouseId) {
      setError("Tilføj et hus, før du opdaterer BBR-oplysninger.");
      return;
    }

    setLoadingAction("house");
    setError(null);
    setHouseOnboardingStep("progress");
    setHouseOnboardingProgressText("Vi henter boligoplysninger fra BBR");

    try {
      const publicData = await apiClient.refreshHousePublicData(onboardingHouseId);
      setPublicDataProfile(publicData.profile);

      if (!publicDataIsUsableAfterOnboarding(publicData)) {
        await loadApp({ showGlobalLoading: false });
        setSelectedHouseId(onboardingHouseId);
        setHouseOnboardingPublicDataIssueText(publicDataIssueMessage(publicData.status));
        setHouseOnboardingStep("publicDataIssue");
        return;
      }

      setHouseOnboardingProgressText("Vi gør din boligoversigt klar");
      await loadApp({ showGlobalLoading: false });
      setSelectedHouseId(onboardingHouseId);
      setHouseOnboardingStep("search");
      setHouseOnboardingProgressText(null);
      setHouseOnboardingPublicDataIssueText(null);
      setQuery("");
      setSuggestions([]);
      setSelectedAddress(null);
      setHasAddressSearched(false);
      setActiveTab("dashboard");
    } catch (caughtError) {
      const message = userFacingError(caughtError);
      setHouseOnboardingPublicDataIssueText(
        "Boligen er gemt, men vi kunne ikke hente BBR-oplysningerne lige nu."
      );
      setHouseOnboardingStep("publicDataIssue");
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  }

  async function continueWithoutOnboardingPublicData() {
    const onboardingHouseId = selectedHouseId;

    if (onboardingHouseId) {
      await loadApp({ showGlobalLoading: false });
      setSelectedHouseId(onboardingHouseId);
    }

    setQuery("");
    setSuggestions([]);
    setSelectedAddress(null);
    setHasAddressSearched(false);
    setHouseOnboardingStep("search");
    setHouseOnboardingProgressText(null);
    setHouseOnboardingPublicDataIssueText(null);
    setActiveTab("dashboard");
  }

  function resetTaskForm() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeadline("");
    setTaskPrice("");
    setTaskRecurrenceInterval("");
    setTaskFormError(null);
    setShowTaskForm(false);
    setShowDeadlinePicker(false);
  }

  async function saveTask() {
    if (!selectedHouse) {
      setTaskFormError("Tilføj et hus, før du opretter en opgave.");
      return;
    }

    const trimmedTitle = taskTitle.trim();
    const trimmedDescription = taskDescription.trim();
    const trimmedDeadline = taskDeadline.trim();

    if (!trimmedTitle) {
      setTaskFormError("Titel er påkrævet.");
      return;
    }

    if (trimmedDeadline && !validDateOnly(trimmedDeadline)) {
      setTaskFormError("Vælg en gyldig deadline.");
      return;
    }

    const parsedPrice = parseDanishPriceInput(taskPrice);

    if (!parsedPrice.ok) {
      setTaskFormError(priceInputErrorMessage(parsedPrice.code));
      return;
    }

    const payload: CreateMaintenanceTaskRequest = {
      title: trimmedTitle,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      source: "user_created",
      status: "planned",
      timing: trimmedDeadline
        ? { type: "specific_deadline", dueDate: trimmedDeadline }
        : { type: "none" },
      priceAmountMinor: parsedPrice.amountMinor,
      priceCurrency: "DKK",
      ...(taskRecurrenceInterval
        ? { recurrence: recurrenceForInterval(taskRecurrenceInterval) }
        : {})
    };

    setLoadingAction("task");
    setTaskFormError(null);
    setError(null);

    try {
      await apiClient.createMaintenanceTask(selectedHouse.id, payload);
      await loadMaintenanceV1(selectedHouse.id);
      resetTaskForm();
    } catch (caughtError) {
      setTaskFormError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  function resetImprovementForm() {
    setImprovementTitle("");
    setImprovementYear("");
    setImprovementDescription("");
    setImprovementCategory("");
    setImprovementDocumentReference("");
    setImprovementCost("");
    setImprovementFormError(null);
  }

  async function saveImprovement() {
    if (!selectedHouse) {
      setImprovementFormError("Tilføj et hus, før du opretter en forbedring.");
      return;
    }

    const title = improvementTitle.trim();
    const year = Number(improvementYear.trim());
    const costText = improvementCost.trim().replace(",", ".");

    if (!title) {
      setImprovementFormError("Titel er påkrævet.");
      return;
    }

    if (!Number.isInteger(year) || year < 1700 || year > 2200) {
      setImprovementFormError("Skriv et gyldigt år.");
      return;
    }

    const parsedCostAmountMinor = costText
      ? Math.round(Number(costText) * 100)
      : undefined;

    if (
      costText &&
      (
        parsedCostAmountMinor === undefined ||
        !Number.isFinite(parsedCostAmountMinor) ||
        parsedCostAmountMinor < 0
      )
    ) {
      setImprovementFormError("Udgift skal være et gyldigt beløb.");
      return;
    }

    const payload: CreateHouseImprovementRequest = {
      title,
      improvementYear: year,
      ...(improvementDescription.trim()
        ? { description: improvementDescription.trim() }
        : {}),
      ...(improvementCategory ? { category: improvementCategory } : {}),
      ...(improvementDocumentReference.trim()
        ? { documentReference: improvementDocumentReference.trim() }
        : {}),
      ...(parsedCostAmountMinor !== undefined
        ? { costAmountMinor: parsedCostAmountMinor, costCurrency: "DKK" }
        : {})
    };

    setLoadingAction("improvement");
    setImprovementFormError(null);
    setError(null);

    try {
      await apiClient.createHouseImprovement(selectedHouse.id, payload);
      await loadHouseImprovements(selectedHouse.id);
      resetImprovementForm();
      setHouseView("overview");
    } catch (caughtError) {
      setImprovementFormError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function pickHousePhoto(source: "library" | "camera") {
    if (!selectedHouse || loadingAction === "photo") {
      return;
    }

    setLoadingAction("photo");
    setPhotoError(null);

    try {
      const ImagePicker = await import("expo-image-picker");
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setPhotoError(
          source === "camera"
            ? "Kameraadgang er nødvendig for at tage et husfoto."
            : "Fotoadgang er nødvendig for at vælge et husfoto."
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.82,
              base64: true
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.82,
              base64: true
            });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const base64 = asset?.base64;
      const mimeType = asset?.mimeType ?? "image/jpeg";

      if (!asset || !base64) {
        setPhotoError("Billedet kunne ikke læses. Prøv et andet foto.");
        return;
      }

      if (!["image/jpeg", "image/png", "image/heic", "image/heif"].includes(mimeType)) {
        setPhotoError("Vælg et JPEG-, PNG- eller HEIC-billede.");
        return;
      }

      const sizeBytes =
        asset.fileSize ?? Math.floor((base64.replace(/=+$/, "").length * 3) / 4);

      const response = await apiClient.setHousePhoto(selectedHouse.id, {
        fileName: asset.fileName ?? `house-photo.${mimeType.split("/")[1] ?? "jpg"}`,
        mimeType: mimeType as "image/jpeg" | "image/png" | "image/heic" | "image/heif",
        sizeBytes,
        ...(asset.width ? { width: asset.width } : {}),
        ...(asset.height ? { height: asset.height } : {}),
        contentBase64: base64
      });
      setHousePhoto(response.photo);
    } catch (caughtError) {
      setPhotoError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function removeHousePhoto() {
    if (!selectedHouse || loadingAction === "photo") {
      return;
    }

    setLoadingAction("photo");
    setPhotoError(null);

    try {
      await apiClient.removeHousePhoto(selectedHouse.id);
      setHousePhoto(null);
    } catch (caughtError) {
      setPhotoError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function completeTask(task: MaintenanceTask, note?: string): Promise<boolean> {
    if (!selectedHouse) {
      setError("Tilføj et hus, før du markerer opgaver som udført.");
      return false;
    }

    setCompletingTaskId(task.id);
    setError(null);

    try {
      await apiClient.completeMaintenanceTask(selectedHouse.id, task.id, {
        completedDate: todayDateOnly(),
        ...(note?.trim() ? { note: note.trim() } : {})
      });
      await loadMaintenanceV1(selectedHouse.id);
      setCompletionNoteTask(null);
      setCompletionNote("");
      setCompletionDoNotAskAgain(false);
      setCompletionModalError(null);
      return true;
    } catch (caughtError) {
      const message = userFacingError(caughtError);
      setError(message);
      setCompletionModalError(message);
      return false;
    } finally {
      setCompletingTaskId(null);
    }
  }

  function openCompletionFlow(task: MaintenanceTask) {
    if (!bootstrap?.profile.promptForCompletionNote) {
      void completeTask(task);
      return;
    }

    setCompletionNoteTask(task);
    setCompletionNote(task.restoredNoteDraft ?? "");
    setCompletionDoNotAskAgain(false);
    setCompletionModalError(null);
  }

  async function saveCompletionFromModal() {
    if (!completionNoteTask) {
      return;
    }

    const task = completionNoteTask;
    setCompletingTaskId(task.id);
    setCompletionModalError(null);

    try {
      const completed = await completeTask(task, completionNote);

      if (!completed) {
        return;
      }

      if (completionDoNotAskAgain) {
        try {
          const response = await apiClient.updateMaintenanceSettings({
            promptForCompletionNote: false
          });
          setBootstrap((current) =>
            current ? { ...current, profile: response.profile } : current
          );
        } catch (caughtError) {
          setError(
            `Opgaven blev gemt, men præferencen kunne ikke gemmes: ${userFacingError(caughtError)}`
          );
        }
      }
    } catch (caughtError) {
      setCompletionModalError(userFacingError(caughtError));
    } finally {
      setCompletingTaskId(null);
    }
  }

  function confirmCompleteTask(task: MaintenanceTask) {
    const dueDate =
      task.timing.type === "specific_deadline" ? task.timing.dueDate : undefined;
    const currentYear = new Date().getFullYear();
    const dueYear = dueDate ? Number(dueDate.slice(0, 4)) : currentYear;

    if (!dueDate || dueYear === currentYear) {
      openCompletionFlow(task);
      return;
    }

    Alert.alert(
      `Deadline er uden for ${currentYear}`,
      `Opgaven har deadline ${formatDisplayDate(dueDate)}. Vil du markere den som udført i ${currentYear}?`,
      [
        { text: "Annuller", style: "cancel" },
        { text: "Udfør alligevel", onPress: () => openCompletionFlow(task) }
      ]
    );
  }

  async function updateTask(
    task: MaintenanceTask,
    patch: {
      title?: string;
      description?: string | null;
      timing?: MaintenanceTask["timing"];
      priceAmountMinor?: number | null;
      priceCurrency?: "DKK";
      recurrence?: MaintenanceTask["recurrence"];
    }
  ) {
    if (!selectedHouse) {
      return;
    }

    setLoadingAction("task");
    setError(null);

    try {
      await apiClient.updateMaintenanceTask(selectedHouse.id, task.id, patch);
      await loadMaintenanceV1(selectedHouse.id);
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  function deleteTask(task: MaintenanceTask) {
    if (!selectedHouse) {
      return;
    }

    Alert.alert("Slet opgave", "Vil du slette opgaven?", [
      { text: "Annuller", style: "cancel" },
      {
        text: "Slet opgave",
        style: "destructive",
        onPress: () =>
          void (async () => {
            if (!selectedHouse) {
              return;
            }

            setLoadingAction("task");
            setError(null);

            try {
              await apiClient.deleteMaintenanceTask(selectedHouse.id, task.id);
              await loadMaintenanceV1(selectedHouse.id);
              setSelectedTaskId(null);
              setMaintenanceView("main");
            } catch (caughtError) {
              setError(userFacingError(caughtError));
            } finally {
              setLoadingAction(null);
            }
          })()
      }
    ]);
  }

  async function acceptRecommendation(recommendation: MaintenanceRecommendation) {
    if (!selectedHouse) {
      setError("Tilføj et hus, før du accepterer anbefalinger.");
      return;
    }

    const dueDate =
      recommendation.suggestedDueDate ??
      (recommendation.timing.type === "specific_deadline"
        ? recommendation.timing.dueDate ?? ""
        : "");
    const recurrenceInterval =
      recommendation.defaultRecurrence?.interval ?? recommendation.recurrence?.interval ?? null;

    if (!dueDate) {
      setError("Anbefalingen mangler en foreslået periode. Prøv at hente anbefalinger igen.");
      return;
    }

    setLoadingAction("recommendation");
    setError(null);

    try {
      await apiClient.acceptMaintenanceRecommendation(
        selectedHouse.id,
        recommendation.id,
        {
          dueDate,
          recurrenceInterval
        }
      );
      await loadMaintenanceV1(selectedHouse.id);
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function dismissRecommendation(recommendation: MaintenanceRecommendation) {
    if (!selectedHouse) {
      setError("Tilføj et hus, før du afviser anbefalinger.");
      return;
    }

    Alert.alert("Afvis anbefaling", "Hvordan vil du skjule anbefalingen?", [
      { text: "Annuller", style: "cancel" },
      {
        text: "Ikke nu",
        onPress: () => void dismissRecommendationWithMode(recommendation, "not_now")
      },
      {
        text: "Vis ikke igen",
        style: "destructive",
        onPress: () => void dismissRecommendationWithMode(recommendation, "hide_forever")
      }
    ]);
  }

  async function dismissRecommendationWithMode(
    recommendation: MaintenanceRecommendation,
    mode: "not_now" | "hide_forever"
  ) {
    if (!selectedHouse) {
      return;
    }

    setLoadingAction("recommendation");
    setError(null);

    try {
      await apiClient.dismissMaintenanceRecommendation(selectedHouse.id, recommendation.id, {
        mode
      });
      await loadMaintenanceV1(selectedHouse.id);
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function openHistoryDetail(entry: MaintenanceHistoryEntry) {
    if (!selectedHouse) {
      return;
    }

    setLoadingAction("task");
    setError(null);

    try {
      const response = await apiClient.getMaintenanceHistoryEntry(
        selectedHouse.id,
        entry.id
      );
      setSelectedHistoryDetail(response.historyEntry);
      setMaintenanceView("historyDetail");
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function refreshSelectedHistoryDetail(completionId: MaintenanceHistoryEntry["id"]) {
    if (!selectedHouse) {
      return;
    }

    const response = await apiClient.getMaintenanceHistoryEntry(selectedHouse.id, completionId);
    setSelectedHistoryDetail(response.historyEntry);
  }

  async function reverseSelectedHistory(noteHandling: "keep_as_draft" | "discard") {
    if (!selectedHouse || !selectedHistoryDetail || historyReversalInProgress) {
      return;
    }

    setHistoryReversalInProgress(true);
    setHistoryReversalError(null);

    try {
      await apiClient.reverseMaintenanceCompletion(
        selectedHouse.id,
        selectedHistoryDetail.id,
        { noteHandling }
      );
      await loadMaintenanceV1(selectedHouse.id);
      setSelectedHistoryDetail(null);
      setMaintenanceView("main");
    } catch (caughtError) {
      setHistoryReversalError(userFacingError(caughtError));
    } finally {
      setHistoryReversalInProgress(false);
    }
  }

  async function pickHouseDocument(source: "camera" | "library" | "file") {
    if (!selectedHouse || loadingAction === "photo") {
      return;
    }

    setLoadingAction("photo");
    setIsPickingDocument(true);
    setError(null);

    try {
      if (source === "camera" || source === "library") {
        const ImagePicker = await import("expo-image-picker");
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          setError(
            source === "camera"
              ? "Kameraadgang er nødvendig for at tage dokumentationsbilleder."
              : "Fotoadgang er nødvendig for at vælge billeder."
          );
          return;
        }

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.86,
                base64: true
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.86,
                base64: true
              });

        if (result.canceled) {
          return;
        }

        const asset = result.assets[0];
        const base64 = asset?.base64;
        const mimeType = asset?.mimeType ?? "image/jpeg";

        if (!asset || !base64) {
          setError("Billedet kunne ikke læses. Prøv et andet foto.");
          return;
        }

        const sizeBytes =
          asset.fileSize ?? Math.floor((base64.replace(/=+$/, "").length * 3) / 4);

        setPendingDocument({
          fileName: asset.fileName ?? `vedligehold.${mimeType.split("/")[1] ?? "jpg"}`,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/heic" | "image/heif",
          sizeBytes,
          contentBase64: base64
        });
      } else {
        const DocumentPicker = await import("expo-document-picker");
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
          base64: true
        });

        if (result.canceled) {
          return;
        }

        const asset = result.assets[0];

        if (!asset?.uri) {
          setError("PDF-filen kunne ikke læses. Prøv et andet dokument.");
          return;
        }

        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64
        });

        setPendingDocument({
          fileName: asset.name,
          mimeType: "application/pdf",
          sizeBytes:
            asset.size ?? Math.floor((base64.replace(/=+$/, "").length * 3) / 4),
          contentBase64: base64
        });
      }
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setIsPickingDocument(false);
      setLoadingAction(null);
    }
  }

  async function saveHouseDocument(metadata: Omit<UploadHouseDocumentRequest, "fileName" | "mimeType" | "sizeBytes" | "contentBase64">): Promise<boolean> {
    if (!selectedHouse || !pendingDocument) {
      setError("Vælg en fil, før dokumentet gemmes.");
      return false;
    }
    setLoadingAction("photo");
    setError(null);
    try {
      await apiClient.uploadHouseDocument(selectedHouse.id, { ...pendingDocument, ...metadata });
      setPendingDocument(null);
      await loadHouseDocuments(selectedHouse.id);
      return true;
    } catch (caughtError) {
      setError(userFacingError(caughtError));
      return false;
    } finally {
      setLoadingAction(null);
    }
  }

  async function deleteHouseDocument(document: HouseDocument) {
    if (!selectedHouse) {
      return;
    }

    setLoadingAction("photo");
    setError(null);

    try {
      await apiClient.deleteHouseDocument(selectedHouse.id, document.id);
      await loadHouseDocuments(selectedHouse.id);
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function openHouseDocument(document: HouseDocument) {
    if (!document.contentPath) {
      setError("Dokumentet er ikke klar til åbning endnu.");
      return;
    }

    if (!accessTokenRef.current || !FileSystem.cacheDirectory) {
      setError("Dokumentet kan ikke åbnes, før din session er klar.");
      return;
    }

    setLoadingAction("photo");
    setError(null);

    try {
      const safeFilename = document.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetUri = `${FileSystem.cacheDirectory}${document.id}-${safeFilename}`;
      const download = await FileSystem.downloadAsync(
        `${apiClient.baseUrl}${document.contentPath}`,
        targetUri,
        { headers: { authorization: `Bearer ${accessTokenRef.current}` } }
      );

      if (download.status < 200 || download.status >= 300) {
        throw new Error("Dokumentet kunne ikke hentes fra Matriva.");
      }

      const openUri =
        Platform.OS === "android"
          ? await FileSystem.getContentUriAsync(download.uri)
          : download.uri;
      setDocumentPreview({
        uri: openUri,
        title: document.title ?? document.originalFilename,
        mimeType: document.mimeType
      });
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function refreshPublicData() {
    if (loadingAction === "publicData") {
      return;
    }

    if (!selectedHouse) {
      setError("Tilføj et hus, før du opdaterer BBR-oplysninger.");
      return;
    }

    setLoadingAction("publicData");
    setError(null);
    setPublicDataRefreshMessage(null);

    try {
      const publicData = await apiClient.refreshHousePublicData(selectedHouse.id);
      setPublicDataProfile(publicData.profile);
      await loadApp({ showGlobalLoading: false });

      if (
        publicData.status === "success" ||
        publicData.status === "partial" ||
        publicData.status === "ambiguous"
      ) {
        setPublicDataRefreshMessage({
          tone: "success",
          text: "BBR-oplysninger er opdateret."
        });
      } else if (publicData.status === "not_found") {
        setPublicDataRefreshMessage({
          tone: "warning",
          text: "BBR fandt ikke oplysninger for adressen."
        });
      } else {
        setPublicDataRefreshMessage({
          tone: "warning",
          text: "BBR-oplysninger kunne ikke hentes lige nu. Prøv igen senere."
        });
      }
    } catch (caughtError) {
      const message = userFacingError(caughtError);
      setPublicDataRefreshMessage({
        tone: "warning",
        text: message
      });
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  }

  const onboardingProps: React.ComponentProps<typeof HouseOnboarding> = {
    step: houseOnboardingStep,
    query,
    suggestions,
    selectedAddress,
    hasAddressSearched,
    isSearching: loadingAction === "address",
    isSaving: loadingAction === "house",
    progressText: houseOnboardingProgressText,
    publicDataIssueText: houseOnboardingPublicDataIssueText,
    onQueryChange: (nextQuery) => {
      setQuery(nextQuery);
      setError(null);
      setSelectedAddress(null);
      setHouseOnboardingStep("search");
      setHouseOnboardingPublicDataIssueText(null);
    },
    onSearch: () => void searchAddresses(),
    onSelect: (suggestion) => {
      setSelectedAddress(suggestion);
      setError(null);
    },
    onSave:
      houseOnboardingStep === "confirm"
        ? () => void saveHouse()
        : () => continueAddressOnboarding(),
    onChooseAnotherAddress: chooseAnotherAddress,
    onRetryPublicData: () => void retryOnboardingPublicData(),
    onContinueWithoutPublicData: () => void continueWithoutOnboardingPublicData()
  };

  function renderActiveScreen() {
    if (authStatus === "restoring" || loadingAction === "app") {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.bodyText}>Henter Matriva...</Text>
        </View>
      );
    }

    if (activeTab === "dashboard") {
      return (
        <DashboardScreen
          house={selectedHouse}
          publicDataSummary={selectedPublicDataSummary}
          tasks={tasks}
          onboarding={onboardingProps}
          onCreateTask={() => {
            setActiveTab("maintenance");
            setShowTaskForm(true);
          }}
          onOpenTasks={() => {
            setActiveTab("maintenance");
            setShowTaskForm(false);
          }}
        />
      );
    }

    if (activeTab === "house") {
      return (
        <HouseScreen
          house={selectedHouse}
          publicDataSummary={selectedPublicDataSummary}
          publicDataProfile={publicDataProfile}
          improvements={improvements}
          housePhoto={housePhoto}
          housePhotoUri={
            housePhoto ? `${apiClient.baseUrl}${housePhoto.contentPath}` : null
          }
          housePhotoHeaders={
            accessTokenRef.current
              ? { authorization: `Bearer ${accessTokenRef.current}` }
              : undefined
          }
          onboarding={onboardingProps}
          houseView={houseView}
          improvementTitle={improvementTitle}
          improvementYear={improvementYear}
          improvementDescription={improvementDescription}
          improvementCategory={improvementCategory}
          improvementDocumentReference={improvementDocumentReference}
          improvementCost={improvementCost}
          improvementFormError={improvementFormError}
          photoError={photoError}
          isRefreshingPublicData={loadingAction === "publicData"}
          isLoadingImprovements={false}
          isSavingImprovement={loadingAction === "improvement"}
          isUploadingPhoto={loadingAction === "photo"}
          publicDataRefreshMessage={publicDataRefreshMessage}
          onOpenDetails={() => setHouseView("details")}
          onOpenImprovements={() => setHouseView("improvements")}
          onOpenAddImprovement={() => setHouseView("addImprovement")}
          onBackToHouse={() => {
            resetImprovementForm();
            setHouseView("overview");
          }}
          onRefreshPublicData={() => void refreshPublicData()}
          onOpenDocuments={() => setActiveTab("documents")}
          onAddHousePhoto={() => void pickHousePhoto("library")}
          onTakeHousePhoto={() => void pickHousePhoto("camera")}
          onRemoveHousePhoto={() => void removeHousePhoto()}
          onImprovementTitleChange={(value) => {
            setImprovementTitle(value);
            setImprovementFormError(null);
          }}
          onImprovementYearChange={(value) => {
            setImprovementYear(value.replace(/[^\d]/g, "").slice(0, 4));
            setImprovementFormError(null);
          }}
          onImprovementDescriptionChange={setImprovementDescription}
          onImprovementCategoryChange={setImprovementCategory}
          onImprovementDocumentReferenceChange={setImprovementDocumentReference}
          onImprovementCostChange={(value) => {
            setImprovementCost(value);
            setImprovementFormError(null);
          }}
          onSaveImprovement={() => void saveImprovement()}
        />
      );
    }

    if (activeTab === "maintenance") {
      return (
        <MaintenanceScreen
          house={selectedHouse}
          tasks={tasks}
          history={maintenanceHistory}
          historyDetail={selectedHistoryDetail}
          selectedTask={selectedTask}
          recommendations={maintenanceRecommendations}
          filter={maintenanceFilter}
          historyYearFilter={historyYearFilter}
          view={maintenanceView}
          onFilterChange={setMaintenanceFilter}
          onHistoryYearFilterChange={setHistoryYearFilter}
          onOpenFullHistory={() => setMaintenanceView("history")}
          onOpenAllRecommendations={() => setMaintenanceView("recommendations")}
          onBackToMaintenance={() => {
            setMaintenanceView("main");
            setSelectedHistoryDetail(null);
            setSelectedTaskId(null);
          }}
          onOpenTaskDetail={(task) => {
            setSelectedTaskId(task.id);
            setMaintenanceView("taskDetail");
          }}
          onOpenHistoryDetail={(entry) => void openHistoryDetail(entry)}
          onReverseHistory={(noteHandling) => void reverseSelectedHistory(noteHandling)}
          isReversingHistory={historyReversalInProgress}
          historyReversalError={historyReversalError}
          onUpdateTask={(task, patch) => void updateTask(task, patch)}
          onDeleteTask={(task) => deleteTask(task)}
          showForm={showTaskForm}
          showDeadlinePicker={showDeadlinePicker}
          completingTaskId={completingTaskId}
          title={taskTitle}
          description={taskDescription}
          deadline={taskDeadline}
          price={taskPrice}
          recurrenceInterval={taskRecurrenceInterval}
          formError={taskFormError}
          isSaving={loadingAction === "task"}
          onShowForm={() => setShowTaskForm(true)}
          onCancelForm={resetTaskForm}
          onShowDeadlinePicker={() => setShowDeadlinePicker(true)}
          onHideDeadlinePicker={() => setShowDeadlinePicker(false)}
          onTitleChange={(value) => {
            setTaskTitle(value);
            setTaskFormError(null);
          }}
          onDescriptionChange={setTaskDescription}
          onPriceChange={(value) => {
            setTaskPrice(value);
            setTaskFormError(null);
          }}
          onRecurrenceIntervalChange={(value) => {
            setTaskRecurrenceInterval(value);
            setTaskFormError(null);
          }}
          onDeadlineSelect={(value) => {
            setTaskDeadline(value);
            setTaskFormError(null);
            setShowDeadlinePicker(false);
          }}
          onDeadlineClear={() => {
            setTaskDeadline("");
            setTaskFormError(null);
            setShowDeadlinePicker(false);
          }}
          onCompleteTask={confirmCompleteTask}
          onAcceptRecommendation={(recommendation) => void acceptRecommendation(recommendation)}
          onDismissRecommendation={(recommendation) => void dismissRecommendation(recommendation)}
          swipeHintSeen={maintenanceSwipeHintSeen}
          onDismissSwipeHint={dismissMaintenanceSwipeHint}
          onSave={() => void saveTask()}
          completionNoteTask={completionNoteTask}
          completionNote={completionNote}
          completionDoNotAskAgain={completionDoNotAskAgain}
          completionModalError={completionModalError}
          onCompletionNoteChange={setCompletionNote}
          onCompletionDoNotAskAgainChange={setCompletionDoNotAskAgain}
          onCancelCompletion={() => {
            if (completingTaskId === null) {
              setCompletionNoteTask(null);
              setCompletionNote("");
              setCompletionModalError(null);
            }
          }}
          onSaveCompletion={() => void saveCompletionFromModal()}
          onboarding={onboardingProps}
        />
      );
    }

    if (activeTab === "documents") {
      return (
        <DocumentsScreen
          documents={houseDocuments}
          isSaving={loadingAction === "photo" && !isPickingDocument}
          onOpenDocument={openHouseDocument}
          onDeleteDocument={(document) => void deleteHouseDocument(document)}
          onPickSource={(source) => void pickHouseDocument(source)}
          onSaveDocument={saveHouseDocument}
          fileName={pendingDocument?.fileName ?? null}
          isPicking={isPickingDocument}
        />
      );
    }

    if (moreView === "profile") {
      return (
        <ProfileScreen
          user={bootstrap?.user ?? null}
          profile={bootstrap?.profile ?? null}
          displayName={profileName}
          isSaving={loadingAction === "profile"}
          onBack={() => setMoreView("menu")}
          onNameChange={(value) => {
            setProfileName(value);
            setError(null);
          }}
          onSaveProfile={() => void saveProfile()}
        />
      );
    }

    if (moreView === "settings") {
      return (
        <SettingsScreen
          isSaving={loadingAction === "profile"}
          onBack={() => setMoreView("menu")}
          onChange={(value) => void updateCompletionNotePrompt(value)}
          promptForCompletionNote={bootstrap?.profile.promptForCompletionNote ?? true}
        />
      );
    }

    return (
      <MoreScreen
        isLoggingOut={loadingAction === "logout"}
        onOpenProfile={() => setMoreView("profile")}
        onOpenSettings={() => setMoreView("settings")}
        onLogout={() => void logout()}
      />
    );
  }

  if (
    authStatus === "restoring" ||
    (authStatus === "authenticated" && loadingAction === "app" && !bootstrap)
  ) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.bodyText}>Henter Matriva...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (
    authStatus === "anonymous" &&
    unauthenticatedStep === "welcome"
  ) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <WelcomeScreen
          onCreateProfile={() => openUnauthenticatedMode("create")}
          onLogin={() => openUnauthenticatedMode("login")}
        />
      </View>
    );
  }

  if (authStatus === "anonymous") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardFrame}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <Card>
                <Text style={styles.errorTitle}>Der opstod et problem</Text>
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}

            <LoginScreen
              mode={unauthenticatedStep === "create" ? "create" : "login"}
              email={loginEmail}
              message={loginMessage}
              devMagicLink={devMagicLink}
              isLoading={loadingAction === "auth"}
              onBack={returnToWelcome}
              onEmailChange={(value) => {
                setLoginEmail(value);
                setLoginMessage(null);
                setError(null);
              }}
              onRequestLink={() => void requestLoginLink()}
              onOpenDevLink={(url) => void consumeMagicLinkUrl(url)}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!bootstrap) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? (
            <Card>
              <Text style={styles.errorTitle}>Der opstod et problem</Text>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}
          <BootstrapRetryScreen
            isLoading={loadingAction === "app"}
            onRetry={() => void loadApp()}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (bootstrap.onboarding.state === "profile_required") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? (
            <Card>
              <Text style={styles.errorTitle}>Der opstod et problem</Text>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}
          <ProfileOnboardingScreen
            user={bootstrap.user}
            displayName={profileName}
            isSaving={loadingAction === "profile"}
            onNameChange={(value) => {
              setProfileName(value);
              setError(null);
            }}
            onSave={() => void saveProfile()}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (bootstrap.onboarding.state === "house_required") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? (
            <Card>
              <Text style={styles.errorTitle}>Der opstod et problem</Text>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}
          <HouseOnboarding {...onboardingProps} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.appFrame}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Card>
              <Text style={styles.errorTitle}>Der opstod et problem</Text>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}
          {renderActiveScreen()}
        </ScrollView>
        <Modal
          animationType="fade"
          visible={Boolean(documentPreview)}
          onRequestClose={() => setDocumentPreview(null)}
        >
          <SafeAreaView style={styles.documentPreviewSurface}>
            <View style={styles.documentPreviewHeader}>
              <Text numberOfLines={1} style={styles.documentPreviewTitle}>
                {documentPreview?.title ?? "Dokument"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Luk forhåndsvisning"
                onPress={() => setDocumentPreview(null)}
                style={styles.documentPreviewClose}
              >
                <Text style={styles.documentPreviewCloseText}>Luk</Text>
              </Pressable>
            </View>
            {documentPreview ? (
              documentPreview.mimeType === "application/pdf" ? (
                <WebView
                  accessibilityLabel={`Forhåndsvisning af ${documentPreview.title}`}
                  allowFileAccess
                  allowUniversalAccessFromFileURLs
                  originWhitelist={["*"]}
                  source={{ uri: documentPreview.uri }}
                  style={styles.documentPreviewWebView}
                />
              ) : (
                <Image
                  accessibilityLabel={documentPreview.title}
                  resizeMode="contain"
                  source={{ uri: documentPreview.uri }}
                  style={styles.documentPreviewImage}
                />
              )
            ) : null}
          </SafeAreaView>
        </Modal>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={tab.key}
                onPress={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "house") {
                    setHouseView("overview");
                  }
                }}
                style={[styles.tabItem, isActive ? styles.tabItemActive : null]}
              >
                {tab.key === "house" ? (
                  <Image
                    accessibilityElementsHidden
                    source={matrivaSymbol}
                    style={[styles.tabHouseIcon, !isActive ? styles.tabHouseIconInactive : null]}
                  />
                ) : (
                  <MaterialCommunityIcons
                    accessibilityElementsHidden
                    color={isActive ? theme.primary : theme.muted}
                    name={tab.icon}
                    size={22}
                    style={styles.tabIcon}
                  />
                )}
                <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background
  },
  appFrame: {
    flex: 1
  },
  keyboardFrame: {
    flex: 1
  },
  content: {
    paddingBottom: 108,
    paddingHorizontal: 18,
    paddingTop: 18,
    rowGap: 14
  },
  stack: {
    rowGap: 12
  },
  welcomeBackground: {
    backgroundColor: theme.primaryFaint,
    flex: 1
  },
  welcomeBackgroundImage: {
    backgroundColor: theme.primaryFaint
  },
  welcomeBottomFade: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0
  },
  welcomeBottomFadeImage: {
    height: "100%",
    width: "100%"
  },
  welcomeSafeArea: {
    flex: 1
  },
  welcomeContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingBottom: 22,
    paddingHorizontal: 28,
    paddingTop: 92
  },
  welcomeContentCompact: {
    paddingBottom: 14,
    paddingHorizontal: 22,
    paddingTop: 54
  },
  welcomeBrand: {
    alignItems: "center",
    paddingTop: 34
  },
  welcomeBrandCompact: {
    paddingTop: 10
  },
  welcomeHouseMark: {
    height: 110,
    marginBottom: 2,
    width: 84
  },
  welcomeWordmark: {
    color: theme.text,
    fontSize: 43,
    fontWeight: "500",
    letterSpacing: 10,
    lineHeight: 54,
    marginLeft: 10,
    textAlign: "center"
  },
  welcomeTagline: {
    color: theme.muted,
    fontSize: 19,
    fontWeight: "500",
    lineHeight: 26,
    marginTop: 2,
    textAlign: "center"
  },
  welcomeBottom: {
    rowGap: 18
  },
  welcomeActions: {
    rowGap: 10
  },
  welcomePrimaryButton: {
    alignItems: "center",
    backgroundColor: theme.primaryPressed,
    borderRadius: 15,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: theme.text,
    shadowOffset: {
      height: 5,
      width: 0
    },
    shadowOpacity: 0.18,
    shadowRadius: 14
  },
  welcomePrimaryButtonPressed: {
    backgroundColor: theme.primaryPressed,
    opacity: 0.92,
    transform: [{ scale: 0.992 }]
  },
  welcomePrimaryButtonText: {
    color: theme.surface,
    fontSize: 20,
    fontWeight: "800"
  },
  welcomeButtonContent: {
    alignItems: "center",
    columnGap: 22,
    flexDirection: "row",
    justifyContent: "center"
  },
  welcomeLockIcon: {
    height: 32,
    position: "relative",
    width: 27
  },
  welcomeLockShackle: {
    borderColor: theme.surface,
    borderRadius: 10,
    borderWidth: 3,
    height: 16,
    left: 5,
    position: "absolute",
    top: 0,
    width: 17
  },
  welcomeLockBody: {
    backgroundColor: "transparent",
    borderColor: theme.surface,
    borderRadius: 3,
    borderWidth: 3,
    bottom: 0,
    height: 19,
    position: "absolute",
    width: 27
  },
  welcomeUserIcon: {
    alignItems: "center",
    height: 32,
    justifyContent: "flex-end",
    width: 27
  },
  welcomeUserHead: {
    borderColor: theme.primary,
    borderRadius: 8,
    borderWidth: 3,
    height: 14,
    position: "absolute",
    top: 0,
    width: 14
  },
  welcomeUserShoulders: {
    borderColor: theme.primary,
    borderRadius: 13,
    borderWidth: 3,
    height: 15,
    width: 27
  },
  welcomeSecondaryButton: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: theme.text,
    shadowOffset: {
      height: 4,
      width: 0
    },
    shadowOpacity: 0.14,
    shadowRadius: 12
  },
  welcomeSecondaryButtonPressed: {
    backgroundColor: theme.primarySoft,
    opacity: 0.92,
    transform: [{ scale: 0.992 }]
  },
  welcomeSecondaryButtonText: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800"
  },
  welcomeLegal: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 12,
    textAlign: "center"
  },
  loginTextActionPressed: {
    opacity: 0.65
  },
  emailHeader: {
    rowGap: 12
  },
  sectionHeader: {
    flex: 1,
    rowGap: 5
  },
  eyebrow: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 29
  },
  sectionSubtitle: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20
  },
  screenTitleRow: {
    alignItems: "center",
    columnGap: 16,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 14,
    rowGap: 10,
    shadowColor: theme.text,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12
  },
  softCard: {
    backgroundColor: theme.primaryFaint,
    shadowOpacity: 0
  },
  plainCard: {
    backgroundColor: theme.surface,
    shadowOpacity: 0.08
  },
  cardHeaderRow: {
    alignItems: "flex-start",
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardTitle: {
    color: theme.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  bodyText: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20
  },
  compactBodyText: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24
  },
  label: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "800"
  },
  formSection: {
    rowGap: 8
  },
  input: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.text,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  priceInputRow: {
    alignItems: "center",
    columnGap: 8,
    flexDirection: "row"
  },
  priceInput: {
    flex: 1
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  dateField: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  dateFieldPressed: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.primary
  },
  dateFieldTextGroup: {
    flex: 1,
    rowGap: 2
  },
  dateFieldPlaceholder: {
    color: theme.muted,
    fontSize: 15,
    fontWeight: "700"
  },
  dateFieldValue: {
    color: theme.muted,
    fontSize: 15,
    fontWeight: "700"
  },
  dateFieldIcon: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: "900"
  },
  clearDateButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingVertical: 4
  },
  clearDateButtonPressed: {
    opacity: 0.62
  },
  clearDateText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "800"
  },
  datePickerBackdrop: {
    backgroundColor: "rgba(15, 92, 73, 0.34)",
    flex: 1,
    justifyContent: "flex-end"
  },
  datePickerDismissArea: {
    flex: 1
  },
  nativeDatePickerPanel: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 18,
    rowGap: 16
  },
  reverseModalPanel: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 22,
    paddingTop: 20,
    rowGap: 14
  },
  reverseModalHeader: {
    rowGap: 7
  },
  reverseNoteCard: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    rowGap: 10
  },
  reverseNoteText: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20
  },
  reverseNoteOption: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  reverseNoteOptionSelected: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary
  },
  reverseNoteOptionPressed: {
    opacity: 0.78
  },
  reverseNoteOptionCopy: {
    flex: 1,
    rowGap: 3
  },
  reverseNoteOptionTitle: {
    color: theme.subtle,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  reverseNoteOptionDetail: {
    color: theme.subtle,
    fontSize: 12,
    lineHeight: 16
  },
  reverseRadio: {
    alignItems: "center",
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  reverseRadioSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary
  },
  reverseRadioCheck: {
    color: theme.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  datePickerHeader: {
    alignItems: "flex-start",
    columnGap: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  datePickerFooter: {
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.primary,
    borderRadius: 8,
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  primaryButtonPressed: {
    backgroundColor: theme.primaryPressed
  },
  primaryButtonText: {
    color: theme.surface,
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryButtonPressed: {
    backgroundColor: theme.primaryFaint
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.52
  },
  pillRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  warningPill: {
    backgroundColor: theme.warningSoft
  },
  pillText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  warningPillText: {
    color: theme.warning
  },
  metaText: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18
  },
  taskTitleGroup: {
    flex: 1,
    rowGap: 4
  },
  taskTiming: {
    color: theme.subtle,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  taskRow: {
    alignItems: "flex-start",
    backgroundColor: theme.primaryFaint,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    marginBottom: 8,
    minHeight: 66,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  completeControl: {
    alignItems: "center",
    borderColor: theme.primary,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24
  },
  completeControlPressed: {
    backgroundColor: theme.primarySoft
  },
  taskRowBody: {
    flex: 1,
    rowGap: 3
  },
  swipeHint: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 10,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  swipeHintText: {
    color: theme.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  swipeHintClose: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  swipeHintClosePressed: {
    backgroundColor: theme.surface
  },
  swipeHintCloseText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: "800"
  },
  filterScroll: {
    marginHorizontal: -2
  },
  filterChipRow: {
    columnGap: 8,
    flexDirection: "row",
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  maintenanceFilterGrid: {
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  filterChip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterChipSelected: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary
  },
  filterChipText: {
    color: theme.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  filterChipTextSelected: {
    color: theme.primary
  },
  sectionEyebrow: {
    color: theme.subtle,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  recommendationActions: {
    alignItems: "flex-end",
    rowGap: 8
  },
  historyRow: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    rowGap: 4
  },
  fileRow: {
    alignItems: "center",
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    columnGap: 8,
    flexDirection: "row",
    minHeight: 48,
    paddingVertical: 8
  },
  documentAddButton: { alignItems: "center", backgroundColor: theme.primary, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  documentAddButtonText: { color: theme.surface, fontSize: 30, fontWeight: "500", lineHeight: 34 },
  documentSearch: { backgroundColor: theme.surface, borderRadius: 14, color: theme.text, fontSize: 17, minHeight: 58, paddingHorizontal: 18 },
  documentChips: { columnGap: 8, paddingVertical: 2 },
  documentChip: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  documentChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  documentChipText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  documentChipTextActive: { color: theme.surface },
  documentSectionTitle: { color: theme.text, fontSize: 21, fontWeight: "900", marginTop: 8 },
  categoryGrid: { columnGap: 10, flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  categoryCard: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, minHeight: 120, padding: 14, width: "48%" },
  categoryIcon: { alignItems: "center", backgroundColor: theme.primarySoft, borderRadius: 10, height: 48, justifyContent: "center", marginBottom: 10, width: 48 },
  categoryTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  categoryCount: { color: theme.subtle, fontSize: 13, marginTop: 4 },
  documentRow: { alignItems: "center", backgroundColor: theme.surface, borderRadius: 14, columnGap: 12, minHeight: 82, padding: 12 },
  documentListRow: { alignItems: "center", backgroundColor: theme.surface, borderRadius: 14, columnGap: 14, flexDirection: "row", minHeight: 86, paddingHorizontal: 14, paddingVertical: 12 },
  documentListIcon: { alignItems: "center", borderRadius: 11, height: 54, justifyContent: "center", width: 54 },
  documentPdfIcon: { backgroundColor: theme.errorSoft },
  documentPdfIconText: { color: theme.error, fontSize: 13, fontWeight: "900" },
  documentImageIcon: { backgroundColor: theme.primarySoft },
  documentImageGlyph: { borderColor: theme.primary, borderRadius: 3, borderWidth: 2, height: 25, overflow: "hidden", position: "relative", width: 30 },
  documentImageGlyphSun: { backgroundColor: theme.primary, borderRadius: 4, height: 6, position: "absolute", right: 4, top: 4, width: 6 },
  documentImageGlyphMountainLeft: { borderBottomColor: theme.primary, borderBottomWidth: 10, borderLeftColor: "transparent", borderLeftWidth: 7, borderRightColor: "transparent", borderRightWidth: 7, bottom: 1, left: 2, position: "absolute", width: 0 },
  documentImageGlyphMountainRight: { borderBottomColor: theme.primary, borderBottomWidth: 7, borderLeftColor: "transparent", borderLeftWidth: 5, borderRightColor: "transparent", borderRightWidth: 5, bottom: 1, position: "absolute", right: 1, width: 0 },
  documentTypeIcon: { backgroundColor: theme.primarySoft, borderRadius: 10, color: theme.primary, fontSize: 20, fontWeight: "900", padding: 12 },
  pdfIcon: { backgroundColor: theme.errorSoft, color: theme.error, fontSize: 12 },
  documentChevron: { color: theme.subtle, fontSize: 32 },
  missingLabel: { color: theme.warning, fontSize: 10, fontWeight: "900", marginTop: 3 },
  modalSurface: { backgroundColor: theme.background, flex: 1 },
  modalContent: { padding: 20, rowGap: 10 },
  modalTitle: { color: theme.text, flex: 1, fontSize: 25, fontWeight: "900" },
  cancelText: { color: theme.primary, fontSize: 16, fontWeight: "800" },
  sourceRow: { columnGap: 8, flexDirection: "row", marginBottom: 12 },
  sourceCard: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 92, justifyContent: "center", padding: 8 },
  sourceIcon: { color: theme.primary, fontSize: 24, fontWeight: "900" },
  sourceLabel: { color: theme.text, fontSize: 13, fontWeight: "800", marginTop: 7, textAlign: "center" },
  selectedFile: { backgroundColor: theme.primarySoft, borderRadius: 8, color: theme.text, padding: 10 },
  documentPreviewSurface: { backgroundColor: theme.background, flex: 1 },
  documentPreviewHeader: { alignItems: "center", borderBottomColor: theme.border, borderBottomWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  documentPreviewTitle: { color: theme.text, flex: 1, fontSize: 17, fontWeight: "800" },
  documentPreviewClose: { paddingHorizontal: 4, paddingVertical: 6 },
  documentPreviewCloseText: { color: theme.primary, fontSize: 16, fontWeight: "800" },
  documentPreviewImage: { flex: 1, width: "100%" },
  documentPreviewWebView: { backgroundColor: theme.surface, flex: 1, width: "100%" },
  documentDetailContent: { padding: 20, rowGap: 14 },
  documentDetailHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 },
  documentDetailBack: { alignItems: "center", backgroundColor: theme.surface, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  documentDetailBackText: { color: theme.text, fontSize: 30, lineHeight: 32 },
  documentDetailHeaderTitle: { color: theme.text, fontSize: 20, fontWeight: "900" },
  documentDetailHeaderSpacer: { width: 40 },
  documentDetailPreview: { alignItems: "center", backgroundColor: theme.primarySoft, borderRadius: 18, minHeight: 190, justifyContent: "center", padding: 20 },
  documentDetailPreviewIcon: { backgroundColor: theme.surface, borderRadius: 16, color: theme.primary, fontSize: 42, fontWeight: "900", paddingHorizontal: 20, paddingVertical: 16 },
  documentDetailPreviewHint: { color: theme.subtle, fontSize: 13, fontWeight: "700", marginTop: 12 },
  documentDetailPreviewName: { color: theme.text, fontSize: 14, fontWeight: "800", marginTop: 4, textAlign: "center" },
  documentDetailTitle: { color: theme.text, fontSize: 24, fontWeight: "900", lineHeight: 29 },
  documentDetailCard: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  documentDetailRow: { borderBottomColor: theme.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 13 },
  documentDetailLabel: { color: theme.muted, flex: 1, fontSize: 14 },
  documentDetailValue: { color: theme.text, flex: 1.2, fontSize: 14, fontWeight: "800", textAlign: "right" },
  documentNoteToggle: { alignItems: "center", borderBottomColor: theme.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 13 },
  documentNoteText: { color: theme.text, fontSize: 14, lineHeight: 21, paddingBottom: 14, paddingTop: 10 },
  selectorField: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  selectorBackdrop: { backgroundColor: "rgba(15, 92, 73, 0.24)", flex: 1, justifyContent: "flex-end" },
  selectorPanel: { backgroundColor: theme.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "82%", padding: 20 },
  selectorGroup: { marginTop: 14, rowGap: 6 },
  selectorGroupTitle: { color: theme.subtle, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  selectorOption: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 14 },
  selectorOptionSelected: { backgroundColor: theme.primarySoft, borderColor: theme.primary },
  selectorOptionText: { color: theme.text, fontSize: 15, fontWeight: "700" },
  selectorOptionTextSelected: { color: theme.primaryPressed },
  selectorCheck: { color: theme.primary, fontSize: 18, fontWeight: "900" },
  switchRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  fileIcon: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: "800",
    width: 24
  },
  fileTextGroup: {
    flex: 1,
    rowGap: 2
  },
  fileActions: {
    columnGap: 6,
    flexDirection: "row"
  },
  taskRowTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  },
  warningText: {
    color: theme.warning
  },
  refreshMessageText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  refreshWarningText: {
    color: theme.warning
  },
  successText: {
    color: theme.success,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  summaryHeader: {
    alignItems: "flex-start",
    columnGap: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  summaryTitleGroup: {
    flex: 1,
    rowGap: 4
  },
  summaryStats: {
    backgroundColor: theme.primaryFaint,
    borderRadius: 8,
    columnGap: 8,
    flexDirection: "row",
    padding: 12
  },
  summaryStat: {
    flex: 1,
    rowGap: 2
  },
  summaryStatValue: {
    color: theme.text,
    fontSize: 23,
    fontWeight: "900"
  },
  summaryStatLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  },
  summaryTaskPreview: {
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  summaryEmpty: {
    backgroundColor: theme.primaryFaint,
    borderRadius: 8,
    padding: 14,
    rowGap: 6
  },
  summaryActions: {
    alignItems: "flex-start"
  },
  addressOption: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 58,
    padding: 14
  },
  addressOptionSelected: {
    borderColor: theme.primary,
    borderWidth: 2
  },
  addressOptionPressed: {
    backgroundColor: theme.primarySoft
  },
  buttonRow: {
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  compactFormActions: {
    alignItems: "center",
    columnGap: 8,
    minHeight: 44
  },
  compactFormButton: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  compactFormButtonText: {
    fontSize: 13
  },
  houseHeroTop: {
    alignItems: "center",
    columnGap: 14,
    flexDirection: "row"
  },
  houseGlyph: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  houseGlyphText: {
    color: theme.primary,
    fontSize: 19,
    fontWeight: "900"
  },
  houseHeroText: {
    flex: 1,
    rowGap: 3
  },
  houseLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  infoList: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
    rowGap: 0
  },
  infoRow: {
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
    rowGap: 3
  },
  infoLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  infoValue: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21
  },
  publicDataTitle: {
    color: theme.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25
  },
  profileFactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  profileFactCard: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 104,
    padding: 12,
    rowGap: 5,
    width: "48%"
  },
  profileFactIcon: {
    color: theme.primary,
    fontSize: 17,
    fontWeight: "900"
  },
  profileFactLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  profileFactValue: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  profileSection: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
    paddingTop: 6,
    rowGap: 8
  },
  settingsRow: {
    alignItems: "center",
    columnGap: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  settingsTextGroup: {
    flex: 1,
    rowGap: 4
  },
  profileSectionHeader: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 4
  },
  profileSectionHeaderPressed: {
    backgroundColor: theme.primaryFaint
  },
  profileSectionIcon: {
    color: theme.primary,
    fontSize: 20,
    fontWeight: "900"
  },
  profileSectionBody: {
    rowGap: 10
  },
  profileNestedBlock: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
    paddingTop: 10,
    rowGap: 8
  },
  detailGroup: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
    paddingTop: 12,
    rowGap: 10
  },
  detailTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  },
  publicBuildingRow: {
    backgroundColor: theme.primaryFaint,
    borderRadius: 8,
    padding: 12,
    rowGap: 4
  },
  houseDashboardHeader: {
    rowGap: 12
  },
  houseMenu: {
    alignItems: "flex-end",
    rowGap: 8
  },
  houseMenuInline: {
    columnGap: 6,
    flexDirection: "row"
  },
  iconAction: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  iconActionText: {
    color: theme.primary,
    fontSize: 19,
    fontWeight: "900"
  },
  housePhoto: {
    aspectRatio: 16 / 9,
    borderRadius: 8,
    width: "100%"
  },
  houseIdentity: {
    rowGap: 4
  },
  houseAddress: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30
  },
  houseMeta: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 21
  },
  houseStatusMeta: {
    color: theme.subtle,
    fontSize: 13,
    lineHeight: 18
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  overviewFactCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 96,
    padding: 12,
    rowGap: 5,
    width: "48%"
  },
  overviewFactIcon: {
    color: theme.primary,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22
  },
  overviewFactLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  overviewFactValue: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 23
  },
  linkRow: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14
  },
  linkRowPressed: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.primary
  },
  linkRowText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800"
  },
  linkRowIcon: {
    color: theme.primary,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 26
  },
  sectionBlock: {
    rowGap: 10
  },
  inlineSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  inlineSectionTitle: {
    color: theme.text,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24
  },
  textLinkButton: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  textLink: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "800"
  },
  improvementCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  documentArchiveRow: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 74,
    padding: 14
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choiceChip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  choiceChipSelected: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary
  },
  choiceChipPressed: {
    opacity: 0.72
  },
  choiceChipText: {
    color: theme.subtle,
    fontSize: 13,
    fontWeight: "700"
  },
  choiceChipTextSelected: {
    color: theme.primary,
    fontWeight: "800"
  },
  taskDetailCard: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    rowGap: 8,
    shadowColor: theme.text,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 10
  },
  taskDetailHeader: {
    alignItems: "flex-start",
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  taskDetailTitle: {
    flex: 1,
    flexShrink: 1
  },
  compactActionRow: {
    alignItems: "center",
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  compactActionButton: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  compactDangerButton: {
    backgroundColor: theme.errorSoft
  },
  compactDangerButtonPressed: {
    backgroundColor: theme.errorBorder
  },
  compactActionText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: "800"
  },
  compactDangerText: {
    color: theme.error
  },
  formHeader: {
    rowGap: 4
  },
  taskList: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    shadowColor: theme.text,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 10
  },
  errorTitle: {
    color: theme.error,
    fontSize: 16,
    fontWeight: "800"
  },
  errorText: {
    color: theme.error,
    fontSize: 14,
    lineHeight: 20
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 360,
    rowGap: 12
  },
  menuRow: {
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    paddingVertical: 13,
    rowGap: 3
  },
  menuRowLast: {
    borderBottomWidth: 0
  },
  menuText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800"
  },
  menuMeta: {
    color: theme.muted,
    fontSize: 13
  },
  tabBar: {
    backgroundColor: theme.surface,
    borderTopColor: theme.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 2,
    paddingVertical: 7,
    rowGap: 5
  },
  tabItemActive: {
    backgroundColor: theme.primarySoft
  },
  tabIcon: {
    textAlign: "center"
  },
  tabHouseIcon: {
    height: 22,
    resizeMode: "contain",
    width: 22
  },
  tabHouseIconInactive: {
    opacity: 0.55
  },
  tabLabel: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    textAlign: "center"
  },
  tabLabelActive: {
    color: theme.primary
  }
});
