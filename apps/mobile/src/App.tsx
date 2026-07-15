import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { createMatrivaApiClient } from "@matriva/api-client";
import {
  type AddressSuggestion,
  type CreateMaintenanceTaskRequest,
  type HouseId,
  type MaintenanceTask,
  type SavedHouse,
  type SelectedAddressInput,
  type TaskId
} from "@matriva/shared";

import { matrivaApiConfig } from "./config/api";

type TabKey = "dashboard" | "house" | "maintenance" | "documents" | "more";
type LoadingAction = "app" | "address" | "house" | "task";

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
  house
}: {
  house: SavedHouse;
}) {
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
        <Pill tone="warning">Boligdata er endnu ikke verificeret</Pill>
      </View>
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
  tasks,
  onboarding,
  onCreateTask,
  onOpenTasks
}: {
  house: SavedHouse | null;
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

      <HouseStatusCard house={house} />

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
  tasks,
  onboarding
}: {
  house: SavedHouse | null;
  tasks: MaintenanceTask[];
  onboarding: React.ComponentProps<typeof HouseOnboarding>;
}) {
  if (!house) {
    return <HouseOnboarding {...onboarding} />;
  }

  const activeTasks = tasks.filter(isActiveMaintenanceTask);

  return (
    <View style={styles.stack}>
      <SectionHeader
        title="Mit hus"
        subtitle="Profilen for det hus, Matriva holder øje med."
      />

      <HouseStatusCard house={house} />

      <Card>
        <Text style={styles.cardTitle}>Boligstatus</Text>
        <Text style={styles.bodyText}>
          Matriva har gemt huset. Boligdata er endnu ikke verificeret.
        </Text>
        <View style={styles.infoList}>
          <InfoRow label="Adresse" value={house.addressLabel} />
          <InfoRow label="Datagrundlag" value="Afventer verificering" />
          <InfoRow
            label="Vedligehold"
            value={
              activeTasks.length === 1
                ? "1 aktiv opgave"
                : `${activeTasks.length} aktive opgaver`
            }
          />
        </View>
      </Card>
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

function DocumentsScreen() {
  return (
    <View style={styles.stack}>
      <SectionHeader title="Dokumenter" />
      <EmptyState title="Dokumentarkiv kommer senere." body="Her samles husets dokumenter i en senere version." />
    </View>
  );
}

function MoreScreen() {
  const rows = ["Profil", "Indstillinger", "Deling & adgang", "Hjælp", "Om Matriva"];

  return (
    <View style={styles.stack}>
      <SectionHeader title="Mere" />
      <Card>
        {rows.map((row, index) => (
          <View
            key={row}
            style={[styles.menuRow, index === rows.length - 1 ? styles.menuRowLast : null]}
          >
            <Text style={styles.menuText}>{row}</Text>
            <Text style={styles.menuMeta}>Kommer senere</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function App() {
  const apiClient = useMemo(
    () =>
      createMatrivaApiClient({
        baseUrl: matrivaApiConfig.baseUrl
      }),
    []
  );

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>("app");
  const [houses, setHouses] = useState<SavedHouse[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState<HouseId | null>(null);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
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

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? houses[0] ?? null;

  const loadTasks = useCallback(
    async (houseId: HouseId) => {
      const response = await apiClient.listMaintenanceTasks(houseId);
      setTasks(response.tasks);
    },
    [apiClient]
  );

  const loadApp = useCallback(async () => {
    setLoadingAction("app");
    setError(null);

    try {
      const response = await apiClient.listHouses();
      setHouses(response.houses);
      const nextHouse = response.houses[0] ?? null;
      setSelectedHouseId(nextHouse?.id ?? null);

      if (nextHouse) {
        await loadTasks(nextHouse.id);
      } else {
        setTasks([]);
      }
    } catch (caughtError) {
      setError(userFacingError(caughtError));
      setTasks([]);
    } finally {
      setLoadingAction(null);
    }
  }, [apiClient, loadTasks]);

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

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
      const savedHouses = await apiClient.listHouses();
      setHouses(savedHouses.houses);
      setSelectedHouseId(response.house.id);
      setQuery("");
      setSuggestions([]);
      setSelectedAddress(null);
      setHasAddressSearched(false);
      await loadTasks(response.house.id);
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
    if (loadingAction === "app") {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.bodyText}>Henter dit husoverblik...</Text>
        </View>
      );
    }

    if (activeTab === "dashboard") {
      return (
        <DashboardScreen
          house={selectedHouse}
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
      return <HouseScreen house={selectedHouse} tasks={tasks} onboarding={onboardingProps} />;
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

    return <MoreScreen />;
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
                onPress={() => setActiveTab(tab.key)}
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
  content: {
    paddingBottom: 108,
    paddingHorizontal: 20,
    paddingTop: 22,
    rowGap: 18
  },
  stack: {
    rowGap: 16
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
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 35
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
