import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { createMatrivaApiClient } from "@matriva/api-client";
import {
  type AddressSuggestion,
  type AppBootstrapResponse,
  type CreateHouseImprovementRequest,
  type CreateMaintenanceTaskRequest,
  type CurrentUser,
  type HouseId,
  type HouseImprovement,
  type HouseImprovementCategory,
  type HouseMedia,
  type HousePublicDataProfileFact,
  type HousePublicDataProfileV1,
  type HousePublicDataSummary,
  type HousePublicDataSummaryField,
  type HousePublicDataSummaryValue,
  type MaintenanceTask,
  type SavedHouse,
  type SelectedAddressInput,
  type SessionTokens,
  type TaskId,
  type UserProfile
} from "@matriva/shared";

import { matrivaApiConfig } from "./config/api";
import { clearStoredSession, readStoredSession, writeStoredSession } from "./auth/sessionStorage";

type TabKey = "dashboard" | "house" | "maintenance" | "documents" | "more";
type LoadingAction = "app" | "auth" | "profile" | "address" | "house" | "task" | "publicData" | "improvement" | "photo" | "logout";
type AuthStatus = "restoring" | "anonymous" | "authenticated";
type MoreView = "menu" | "profile";
type HouseView = "overview" | "details" | "improvements" | "addImprovement";
type UnauthenticatedStep = "welcome" | "create" | "login";
type PublicDataRefreshMessage = {
  tone: "success" | "warning";
  text: string;
};

type Tab = {
  key: TabKey;
  label: string;
  icon: string;
};

const tabs: Tab[] = [
  { key: "dashboard", icon: "▦", label: "Dashboard" },
  { key: "house", icon: "⌂", label: "Mit hus" },
  { key: "maintenance", icon: "✓", label: "Vedligehold" },
  { key: "documents", icon: "▤", label: "Dokumenter" },
  { key: "more", icon: "•••", label: "Mere" }
];

const houseHeroPlaceholder = require("../assets/onboarding/house-hero-placeholder.png");

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

function formatTiming(task: MaintenanceTask) {
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
  onPress
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && !loading ? styles.primaryButtonPressed : null,
        disabled || loading ? styles.disabled : null
      ]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  disabled,
  onPress
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function DeadlineDatePicker({
  visible,
  selectedDate,
  onClose,
  onClear,
  onSelect
}: {
  visible: boolean;
  selectedDate: string;
  onClose: () => void;
  onClear: () => void;
  onSelect: (dateOnly: string) => void;
}) {
  if (!visible) {
    return null;
  }

  const pickerValue = dateFromDateOnly(selectedDate || todayDateOnly());
  const isIos = Platform.OS === "ios";

  function handleDateChange(event: DateTimePickerEvent, date?: Date) {
    if (event.type === "dismissed") {
      onClose();
      return;
    }

    if (date) {
      onSelect(dateOnlyFromDate(date));
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
              <Text style={styles.cardTitle}>Vælg deadline</Text>
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
              <PrimaryButton label="Vælg dato" onPress={onClose} />
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
          <Text style={styles.houseTitle}>{house.addressLabel}</Text>
        </View>
      </View>
      <View style={styles.pillRow}>
        <Pill>Gemt hus</Pill>
        <Pill tone={hasPublicData ? "default" : "warning"}>
          {hasPublicData ? publicDataSummary.sourceLabel : "Afventer BBR"}
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
              tone={
                taskPreview.status === "overdue" || !!taskPreview.timing.daysOverdue
                  ? "warning"
                  : "default"
              }
            >
              {formatStatus(taskPreview.status)}
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
  residential_area: "Boligareal",
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

  if (lower.includes("lejlighed") || lower.includes("beboelseslejlighed")) {
    return "Boligenhed";
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
  onComplete
}: {
  task: MaintenanceTask;
  completing: boolean;
  onComplete: (task: MaintenanceTask) => void;
}) {
  const isOverdue = task.status === "overdue" || !!task.timing.daysOverdue;
  const showStatus = isOverdue || task.status === "due" || task.status === "suggested";
  const description = visibleTaskDescription(task);

  return (
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
      <View style={styles.taskRowBody}>
        <Text style={styles.taskRowTitle}>{task.title}</Text>
        <Text style={[styles.taskTiming, isOverdue ? styles.warningText : null]}>
          {formatTiming(task)}
        </Text>
        {description ? <Text style={styles.compactBodyText}>{description}</Text> : null}
        <Text style={styles.metaText}>{formatSource(task.source)}</Text>
      </View>
      {showStatus ? (
        <Pill tone={isOverdue ? "warning" : "default"}>{formatStatus(task.status)}</Pill>
      ) : null}
    </View>
  );
}

function HouseOnboarding({
  query,
  suggestions,
  selectedAddress,
  hasAddressSearched,
  isSearching,
  isSaving,
  onQueryChange,
  onSearch,
  onSelect,
  onSave
}: {
  query: string;
  suggestions: AddressSuggestion[];
  selectedAddress: AddressSuggestion | null;
  hasAddressSearched: boolean;
  isSearching: boolean;
  isSaving: boolean;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  onSave: () => void;
}) {
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
            label="Gem hus"
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
  if (!house) {
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

  const overdueTasks = tasks.filter(
    (task) => task.status === "overdue" || !!task.timing.daysOverdue
  );
  const upcomingTasks = tasks.filter(
    (task) => task.timing.daysUntilDue !== undefined && task.timing.daysUntilDue <= 30
  );
  const activeTasks = tasks.filter(isActiveMaintenanceTask);

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
  const latestImprovements = improvements.slice(0, 2);
  const identityType =
    productFactValue(factMap.get("housing_type")) !== "Ikke registreret"
      ? productFactValue(factMap.get("housing_type"))
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
        {overviewFactOrder.map((key) => (
          <View
            accessible
            accessibilityLabel={`${overviewFactLabels[key]}: ${productFactValue(factMap.get(key))}`}
            key={key}
            style={styles.overviewFactCard}
          >
            <Text style={styles.overviewFactIcon}>{overviewFactIcons[key]}</Text>
            <Text style={styles.overviewFactLabel}>{overviewFactLabels[key]}</Text>
            <Text style={styles.overviewFactValue}>{productFactValue(factMap.get(key))}</Text>
          </View>
        ))}
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

function MaintenanceScreen({
  house,
  tasks,
  showForm,
  showDeadlinePicker,
  completingTaskId,
  title,
  description,
  deadline,
  formError,
  isSaving,
  onShowForm,
  onCancelForm,
  onShowDeadlinePicker,
  onHideDeadlinePicker,
  onTitleChange,
  onDescriptionChange,
  onDeadlineSelect,
  onDeadlineClear,
  onCompleteTask,
  onSave,
  onboarding
}: {
  house: SavedHouse | null;
  tasks: MaintenanceTask[];
  showForm: boolean;
  showDeadlinePicker: boolean;
  completingTaskId: TaskId | null;
  title: string;
  description: string;
  deadline: string;
  formError: string | null;
  isSaving: boolean;
  onShowForm: () => void;
  onCancelForm: () => void;
  onShowDeadlinePicker: () => void;
  onHideDeadlinePicker: () => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onDeadlineSelect: (deadline: string) => void;
  onDeadlineClear: () => void;
  onCompleteTask: (task: MaintenanceTask) => void;
  onSave: () => void;
  onboarding: React.ComponentProps<typeof HouseOnboarding>;
}) {
  if (!house) {
    return (
      <View style={styles.stack}>
        <SectionHeader title="Vedligehold" />
        <EmptyState
          title="Tilføj et hus først"
          body="Gem din adresse, før du opretter vedligeholdelsesopgaver."
        />
        <HouseOnboarding {...onboarding} />
      </View>
    );
  }

  const activeTasks = tasks.filter(isActiveMaintenanceTask);

  return (
    <View style={styles.stack}>
      <View style={styles.screenTitleRow}>
        <SectionHeader
          title="Vedligehold"
          subtitle={
            activeTasks.length === 1
              ? "1 opgave for dit hus."
              : `${activeTasks.length} opgaver for dit hus.`
          }
        />
        {!showForm ? <SecondaryButton label="Opret" onPress={onShowForm} /> : null}
      </View>

      {showForm ? (
        <Card variant="plain">
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.cardTitle}>Ny vedligeholdelsesopgave</Text>
              <Text style={styles.compactBodyText}>Tilføj titel, eventuel note og deadline.</Text>
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
          <View style={styles.buttonRow}>
            <SecondaryButton label="Annuller" disabled={isSaving} onPress={onCancelForm} />
            <PrimaryButton label="Gem opgave" loading={isSaving} onPress={onSave} />
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

      {activeTasks.length === 0 ? (
        <EmptyState
          title="Ingen opgaver endnu"
          body="Opret den første vedligeholdelsesopgave for dit hus."
        />
      ) : (
        <View style={styles.taskList}>
          {activeTasks.map((task) => (
            <TaskRow
              completing={completingTaskId === task.id}
              key={task.id}
              onComplete={onCompleteTask}
              task={task}
            />
          ))}
        </View>
      )}
    </View>
  );
}


function HeroMedia({ height }: { height: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel="Illustration af et hus"
      resizeMode="cover"
      source={houseHeroPlaceholder}
      style={[styles.heroImage, { height }]}
    />
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
  const heroHeight = Math.min(Math.max(windowHeight * 0.18, 120), 180);

  return (
    <View style={styles.welcomeStack}>
      <HeroMedia height={heroHeight} />
      <View style={styles.welcomeHeader}>
        <Text style={styles.logoText}>DIT HUS. ÉT OVERBLIK.</Text>
        <Text style={styles.welcomeTitle}>
          Få styr på dit hus – før de små ting bliver dyre
        </Text>
        <Text style={styles.welcomeBody}>
          Saml vedligehold, dokumenter og vigtig viden om dit hus ét sted.{" "}
          Matriva hjælper dig med at huske, hvad der skal gøres – og hvornår.
        </Text>
      </View>
      <View style={styles.welcomeActions}>
        <PrimaryButton label="Opret din profil" onPress={onCreateProfile} />
        <Text style={styles.helperText}>
          Gratis at komme i gang. Det tager under ét minut.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onLogin}
          style={({ pressed }) => [
            styles.loginTextAction,
            pressed ? styles.loginTextActionPressed : null
          ]}
        >
          <Text style={styles.loginText}>
            Har du allerede en profil? <Text style={styles.loginTextEmphasis}>Log ind</Text>
          </Text>
        </Pressable>
      </View>
    </View>
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

function DocumentsScreen() {
  return (
    <View style={styles.stack}>
      <SectionHeader title="Dokumenter" />
      <EmptyState title="Dokumentarkiv kommer senere." body="Her samles husets dokumenter i en senere version." />
    </View>
  );
}

function MoreScreen({
  isLoggingOut,
  onOpenProfile,
  onLogout
}: {
  isLoggingOut: boolean;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  const rows = ["Profil", "Indstillinger", "Deling & adgang", "Hjælp", "Om Matriva"];

  return (
    <View style={styles.stack}>
      <SectionHeader title="Mere" />
      <Card>
        {rows.map((row, index) => {
          const isProfile = row === "Profil";

          return (
            <Pressable
              accessibilityRole="button"
              disabled={!isProfile}
              key={row}
              onPress={isProfile ? onOpenProfile : undefined}
              style={({ pressed }) => [
                styles.menuRow,
                index === rows.length - 1 ? styles.menuRowLast : null,
                pressed && isProfile ? styles.secondaryButtonPressed : null
              ]}
            >
              <Text style={styles.menuText}>{row}</Text>
              <Text style={styles.menuMeta}>{isProfile ? "Åbn" : "Kommer senere"}</Text>
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
  const [improvements, setImprovements] = useState<HouseImprovement[]>([]);
  const [housePhoto, setHousePhoto] = useState<HouseMedia | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [hasAddressSearched, setHasAddressSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<TaskId | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
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

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? houses[0] ?? null;
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
    setImprovements([]);
    setHousePhoto(null);
    setQuery("");
    setSuggestions([]);
    setSelectedAddress(null);
    setHasAddressSearched(false);
    setError(null);
    setShowTaskForm(false);
    setShowDeadlinePicker(false);
    setCompletingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeadline("");
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
          loadTasks(nextHouse.id),
          loadHouseImprovements(nextHouse.id),
          loadHousePhoto(nextHouse.id)
        ]);
      } else {
        setTasks([]);
        setImprovements([]);
        setHousePhoto(null);
      }
    } catch (caughtError) {
      setError(userFacingError(caughtError));
      setTasks([]);
      setImprovements([]);
      setHousePhoto(null);
      setPublicDataSummaries([]);
      setPublicDataProfile(null);
    } finally {
      if (options?.showGlobalLoading !== false) {
        setLoadingAction(null);
      }
    }
  }, [apiClient, loadHouseImprovements, loadHousePhoto, loadTasks]);

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

    try {
      const selectedAddressPayload = selectedAddressInput(selectedAddress);
      const draft = await apiClient.createHouseDraft(selectedAddressPayload);
      const response = await apiClient.createSavedHouse({
        houseDraftId: draft.houseDraft.id,
        selectedAddress: draft.houseDraft.selectedAddress
      });
      await loadApp();
      setSelectedHouseId(response.house.id);
      setQuery("");
      setSuggestions([]);
      setSelectedAddress(null);
      setHasAddressSearched(false);
      setActiveTab("dashboard");
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  function resetTaskForm() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeadline("");
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

    const payload: CreateMaintenanceTaskRequest = {
      title: trimmedTitle,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      source: "user_created",
      status: "planned",
      timing: trimmedDeadline
        ? { type: "specific_deadline", dueDate: trimmedDeadline }
        : { type: "none" }
    };

    setLoadingAction("task");
    setTaskFormError(null);
    setError(null);

    try {
      await apiClient.createMaintenanceTask(selectedHouse.id, payload);
      await loadTasks(selectedHouse.id);
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

  async function completeTask(task: MaintenanceTask) {
    if (!selectedHouse) {
      setError("Tilføj et hus, før du markerer opgaver som udført.");
      return;
    }

    setCompletingTaskId(task.id);
    setError(null);

    try {
      await apiClient.updateMaintenanceTaskStatus(selectedHouse.id, task.id, {
        status: "done"
      });
      await loadTasks(selectedHouse.id);
    } catch (caughtError) {
      setError(userFacingError(caughtError));
    } finally {
      setCompletingTaskId(null);
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
    query,
    suggestions,
    selectedAddress,
    hasAddressSearched,
    isSearching: loadingAction === "address",
    isSaving: loadingAction === "house",
    onQueryChange: (nextQuery) => {
      setQuery(nextQuery);
      setError(null);
      setSelectedAddress(null);
    },
    onSearch: () => void searchAddresses(),
    onSelect: setSelectedAddress,
    onSave: () => void saveHouse()
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
          showForm={showTaskForm}
          showDeadlinePicker={showDeadlinePicker}
          completingTaskId={completingTaskId}
          title={taskTitle}
          description={taskDescription}
          deadline={taskDeadline}
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
          onCompleteTask={(task) => void completeTask(task)}
          onSave={() => void saveTask()}
          onboarding={onboardingProps}
        />
      );
    }

    if (activeTab === "documents") {
      return <DocumentsScreen />;
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

    return (
      <MoreScreen
        isLoggingOut={loadingAction === "logout"}
        onOpenProfile={() => setMoreView("profile")}
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

  if (authStatus === "anonymous") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardFrame}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error ? (
              <Card>
                <Text style={styles.errorTitle}>Der opstod et problem</Text>
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}
            {unauthenticatedStep === "welcome" ? (
              <WelcomeScreen
                onCreateProfile={() => openUnauthenticatedMode("create")}
                onLogin={() => openUnauthenticatedMode("login")}
              />
            ) : (
              <LoginScreen
                mode={unauthenticatedStep}
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
            )}
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
                <Text style={[styles.tabIcon, isActive ? styles.tabIconActive : null]}>
                  {tab.icon}
                </Text>
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

const theme = {
  background: "#F7F9FC",
  surface: "#FFFFFF",
  text: "#172033",
  muted: "#667085",
  subtle: "#475467",
  border: "#E4E9F2",
  primary: "#2563EB",
  primaryPressed: "#1D4ED8",
  primarySoft: "#EAF1FF",
  primaryFaint: "#F4F7FF",
  warning: "#B45309",
  warningSoft: "#FFF7ED"
} as const;

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
    paddingHorizontal: 20,
    paddingTop: 22,
    rowGap: 18
  },
  stack: {
    rowGap: 16
  },
  welcomeStack: {
    rowGap: 14
  },
  heroImage: {
    borderRadius: 8,
    width: "100%"
  },
  welcomeHeader: {
    rowGap: 10
  },
  logoText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  welcomeTitle: {
    color: theme.text,
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 38
  },
  welcomeBody: {
    color: theme.muted,
    fontSize: 16,
    lineHeight: 23
  },
  welcomeActions: {
    rowGap: 10
  },
  helperText: {
    color: theme.subtle,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  loginTextAction: {
    alignItems: "center",
    paddingVertical: 8
  },
  loginTextActionPressed: {
    opacity: 0.65
  },
  loginText: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center"
  },
  loginTextEmphasis: {
    color: theme.primary,
    fontWeight: "800"
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
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 31
  },
  sectionSubtitle: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22
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
    padding: 18,
    rowGap: 12,
    shadowColor: "#101828",
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
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23
  },
  bodyText: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22
  },
  compactBodyText: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800"
  },
  formSection: {
    rowGap: 8
  },
  input: {
    backgroundColor: "#FBFCFE",
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  dateField: {
    alignItems: "center",
    backgroundColor: "#FBFCFE",
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 11
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
    fontSize: 16,
    fontWeight: "700"
  },
  dateFieldValue: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800"
  },
  dateFieldIcon: {
    color: theme.primary,
    fontSize: 20,
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
    backgroundColor: "rgba(23, 32, 51, 0.34)",
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
    color: "#FFFFFF",
    fontSize: 16,
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
    backgroundColor: "#DCE8FF"
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 15,
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
    backgroundColor: theme.surface,
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    minHeight: 74,
    paddingHorizontal: 4,
    paddingVertical: 12
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
  taskRowTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
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
    color: "#047857",
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
  houseTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
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
    backgroundColor: "#FBFCFE",
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
    backgroundColor: "#FBFCFE",
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
  formHeader: {
    rowGap: 4
  },
  taskList: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    shadowColor: "#101828",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 10
  },
  errorTitle: {
    color: "#991B1B",
    fontSize: 16,
    fontWeight: "800"
  },
  errorText: {
    color: "#991B1B",
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
    color: theme.muted,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center"
  },
  tabIconActive: {
    color: theme.primary
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
