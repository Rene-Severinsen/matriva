import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { createMatrivaApiClient } from "@matriva/api-client";
import {
  type AddressSuggestion,
  type CreateMaintenanceTaskRequest,
  type HouseId,
  type MaintenanceTask,
  type SavedHouse,
  type SelectedAddressInput
} from "@matriva/shared";

import { matrivaApiConfig } from "./config/api";

type TabKey = "dashboard" | "house" | "maintenance" | "documents" | "more";
type LoadingAction = "app" | "address" | "house" | "task";

type Tab = {
  key: TabKey;
  label: string;
};

const tabs: Tab[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "house", label: "Mit hus" },
  { key: "maintenance", label: "Vedligehold" },
  { key: "documents", label: "Dokumenter" },
  { key: "more", label: "Mere" }
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

function formatTiming(task: MaintenanceTask) {
  if (task.timing.type !== "specific_deadline" || !task.timing.dueDate) {
    return "Ingen deadline";
  }

  if (task.timing.daysOverdue) {
    return `Deadline ${task.timing.dueDate} · ${task.timing.daysOverdue} dage overskredet`;
  }

  if (task.timing.daysUntilDue === 0) {
    return `Deadline ${task.timing.dueDate} · i dag`;
  }

  if (task.timing.daysUntilDue !== undefined) {
    return `Deadline ${task.timing.dueDate} · om ${task.timing.daysUntilDue} dage`;
  }

  return `Deadline ${task.timing.dueDate}`;
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

function SectionHeader({
  title,
  eyebrow
}: {
  title: string;
  eyebrow?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
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
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </Card>
  );
}

function SummaryMetric({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function TaskCard({ task }: { task: MaintenanceTask }) {
  const isOverdue = task.status === "overdue" || !!task.timing.daysOverdue;
  const description = visibleTaskDescription(task);

  return (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{task.title}</Text>
        <Pill tone={isOverdue ? "warning" : "default"}>{formatStatus(task.status)}</Pill>
      </View>
      {description ? <Text style={styles.bodyText}>{description}</Text> : null}
      <View style={styles.metaWrap}>
        <Text style={styles.metaText}>{formatSource(task.source)}</Text>
        <Text style={styles.metaText}>{formatTiming(task)}</Text>
      </View>
    </Card>
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
  onCreateHouse,
  onCreateTask
}: {
  house: SavedHouse | null;
  tasks: MaintenanceTask[];
  onCreateHouse: () => void;
  onCreateTask: () => void;
}) {
  if (!house) {
    return (
      <View style={styles.stack}>
        <SectionHeader title="Dit husoverblik" eyebrow="Matriva" />
        <EmptyState
          title="Du har ikke gemt et hus endnu"
          body="Tilføj din adresse for at starte dit husoverblik."
        />
        <PrimaryButton label="Find dit hus" onPress={onCreateHouse} />
      </View>
    );
  }

  const overdueTasks = tasks.filter(
    (task) => task.status === "overdue" || !!task.timing.daysOverdue
  );
  const upcomingTasks = tasks.filter(
    (task) => task.timing.daysUntilDue !== undefined && task.timing.daysUntilDue <= 30
  );
  const activeTasks = tasks.filter((task) => task.status !== "done" && task.status !== "dismissed");

  return (
    <View style={styles.stack}>
      <SectionHeader title="Dit husoverblik" eyebrow="Matriva" />
      <Card>
        <Text style={styles.cardTitle}>{house.addressLabel}</Text>
        <View style={styles.pillRow}>
          <Pill>Gemt hus</Pill>
          <Pill tone="warning">Boligdata er endnu ikke verificeret</Pill>
        </View>
      </Card>

      <View style={styles.metricGrid}>
        <SummaryMetric label="Aktive opgaver" value={activeTasks.length} />
        <SummaryMetric label="Overskredet" value={overdueTasks.length} />
        <SummaryMetric label="Næste 30 dage" value={upcomingTasks.length} />
      </View>

      <View style={styles.stack}>
        <SectionHeader title="Vedligehold" />
        {overdueTasks.length > 0 ? (
          overdueTasks.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} />)
        ) : (
          <EmptyState
            title="Ingen opgaver kræver opmærksomhed"
            body="Du kan oprette en opgave, når noget skal planlægges."
          />
        )}
      </View>

      <View style={styles.quickActions}>
        <PrimaryButton label="Opret opgave" onPress={onCreateTask} />
      </View>
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

  const activeTasks = tasks.filter((task) => task.status !== "done" && task.status !== "dismissed");

  return (
    <View style={styles.stack}>
      <SectionHeader title="Mit hus" />
      <Card>
        <Text style={styles.cardTitle}>{house.addressLabel}</Text>
        <View style={styles.pillRow}>
          <Pill>Gemt</Pill>
          <Pill tone="warning">Boligdata er endnu ikke verificeret</Pill>
        </View>
      </Card>
      <Card>
        <Text style={styles.label}>Boligstatus</Text>
        <Text style={styles.bodyText}>Matriva har gemt huset, men boligdata er endnu ikke verificeret.</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Adresse</Text>
        <Text style={styles.bodyText}>{house.addressLabel}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Vedligehold</Text>
        <Text style={styles.bodyText}>
          {activeTasks.length === 1
            ? "1 aktiv opgave"
            : `${activeTasks.length} aktive opgaver`}
        </Text>
      </Card>
    </View>
  );
}

function MaintenanceScreen({
  house,
  tasks,
  showForm,
  title,
  description,
  deadline,
  formError,
  isSaving,
  onShowForm,
  onCancelForm,
  onTitleChange,
  onDescriptionChange,
  onDeadlineChange,
  onSave,
  onboarding
}: {
  house: SavedHouse | null;
  tasks: MaintenanceTask[];
  showForm: boolean;
  title: string;
  description: string;
  deadline: string;
  formError: string | null;
  isSaving: boolean;
  onShowForm: () => void;
  onCancelForm: () => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onDeadlineChange: (deadline: string) => void;
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

  return (
    <View style={styles.stack}>
      <View style={styles.screenTitleRow}>
        <SectionHeader title="Vedligehold" />
        {!showForm ? <SecondaryButton label="Opret" onPress={onShowForm} /> : null}
      </View>

      {showForm ? (
        <Card>
          <Text style={styles.cardTitle}>Ny vedligeholdelsesopgave</Text>
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
            <TextInput
              accessibilityLabel="Deadline"
              autoCapitalize="none"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={onDeadlineChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.muted}
              style={styles.input}
              value={deadline}
            />
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <View style={styles.buttonRow}>
            <SecondaryButton label="Annuller" disabled={isSaving} onPress={onCancelForm} />
            <PrimaryButton label="Gem opgave" loading={isSaving} onPress={onSave} />
          </View>
        </Card>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          title="Ingen opgaver endnu"
          body="Opret den første vedligeholdelsesopgave for dit hus."
        />
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
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
      setHouses([response.house, ...houses]);
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
      setTaskFormError("Deadline skal skrives som YYYY-MM-DD.");
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
          onCreateHouse={() => setActiveTab("house")}
          onCreateTask={() => {
            setActiveTab("maintenance");
            setShowTaskForm(true);
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
          title={taskTitle}
          description={taskDescription}
          deadline={taskDeadline}
          formError={taskFormError}
          isSaving={loadingAction === "task"}
          onShowForm={() => setShowTaskForm(true)}
          onCancelForm={resetTaskForm}
          onTitleChange={(value) => {
            setTaskTitle(value);
            setTaskFormError(null);
          }}
          onDescriptionChange={setTaskDescription}
          onDeadlineChange={(value) => {
            setTaskDeadline(value);
            setTaskFormError(null);
          }}
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
                <View style={[styles.tabDot, isActive ? styles.tabDotActive : null]} />
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
  background: "#F6F8FB",
  surface: "#FFFFFF",
  text: "#172033",
  muted: "#667085",
  border: "#D8DEE8",
  primary: "#2563EB",
  primaryPressed: "#1D4ED8",
  primarySoft: "#EAF1FF",
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
    paddingHorizontal: 18,
    paddingTop: 18,
    rowGap: 16
  },
  stack: {
    rowGap: 14
  },
  sectionHeader: {
    rowGap: 3
  },
  eyebrow: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: "800"
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34
  },
  screenTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 10
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
  emptyTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26
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
    backgroundColor: theme.surface,
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
  metaWrap: {
    rowGap: 4
  },
  metaText: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18
  },
  metricGrid: {
    columnGap: 10,
    flexDirection: "row"
  },
  metric: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 88,
    padding: 12,
    rowGap: 4
  },
  metricValue: {
    color: theme.text,
    fontSize: 27,
    fontWeight: "800"
  },
  metricLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  },
  quickActions: {
    rowGap: 10
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
  tabDot: {
    backgroundColor: "#B7C0CF",
    borderRadius: 4,
    height: 8,
    width: 8
  },
  tabDotActive: {
    backgroundColor: theme.primary
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
