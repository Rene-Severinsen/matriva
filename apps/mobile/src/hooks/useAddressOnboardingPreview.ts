import { useMemo, useState } from "react";

import { createMatrivaApiClient } from "@matriva/api-client";
import {
  type AddressSuggestion,
  type EnrichHouseDraftResponse,
  type HouseDraftResponse,
  type SelectedAddressInput
} from "@matriva/shared";

import { matrivaApiConfig } from "../config/api";

type LoadingAction = "search" | "create" | "enrich";

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
    return "Kan ikke kontakte lokal Matriva API.";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  ) {
    return "Kan ikke kontakte lokal Matriva API. Tjek at API-serveren kører, og at base URL passer til din simulator eller device.";
  }

  return `Matriva API svarede med en fejl: ${error.message}`;
}

export function useAddressOnboardingPreview() {
  const apiClient = useMemo(
    () =>
      createMatrivaApiClient({
        baseUrl: matrivaApiConfig.baseUrl
      }),
    []
  );

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] =
    useState<AddressSuggestion | null>(null);
  const [draftResponse, setDraftResponse] =
    useState<HouseDraftResponse | null>(null);
  const [enrichmentResponse, setEnrichmentResponse] =
    useState<EnrichHouseDraftResponse | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const isSearching = loadingAction === "search";
  const isCreating = loadingAction === "create";
  const isEnriching = loadingAction === "enrich";
  const isBusy = loadingAction !== null;
  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2 && !isBusy;
  const canCreate = selectedAddress !== null && !isBusy;
  const canEnrich = draftResponse !== null && !isBusy;

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setError(null);
    setEnrichmentResponse(null);
    setEnrichmentError(null);
  }

  function selectAddress(suggestion: AddressSuggestion) {
    setSelectedAddress(suggestion);
    setDraftResponse(null);
    setError(null);
    setEnrichmentResponse(null);
    setEnrichmentError(null);
  }

  async function searchAddressSuggestions() {
    if (trimmedQuery.length < 2) {
      setError("Skriv mindst 2 tegn for at søge efter en adresse.");
      setHasSearched(false);
      setSuggestions([]);
      setSelectedAddress(null);
      setDraftResponse(null);
      setEnrichmentResponse(null);
      setEnrichmentError(null);
      return;
    }

    setLoadingAction("search");
    setError(null);
    setDraftResponse(null);
    setSelectedAddress(null);
    setEnrichmentResponse(null);
    setEnrichmentError(null);

    try {
      const response = await apiClient.searchAddresses(trimmedQuery);
      setSuggestions(response.suggestions);
      setHasSearched(true);
    } catch (caughtError) {
      setSuggestions([]);
      setHasSearched(false);
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function createFirstHouseDraft() {
    if (!selectedAddress) {
      setError("Vælg en adresse, før du opretter første husoverblik.");
      return;
    }

    setLoadingAction("create");
    setError(null);
    setEnrichmentResponse(null);
    setEnrichmentError(null);

    try {
      setDraftResponse(
        await apiClient.createHouseDraft(selectedAddressInput(selectedAddress))
      );
    } catch (caughtError) {
      setDraftResponse(null);
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function enrichFirstHouseDraft() {
    if (!draftResponse) {
      setError("Opret et house draft, før du henter boligdata preview.");
      return;
    }

    setLoadingAction("enrich");
    setError(null);
    setEnrichmentError(null);

    try {
      setEnrichmentResponse(
        await apiClient.enrichHouseDraft({
          houseDraftId: draftResponse.houseDraft.id,
          selectedAddress: draftResponse.houseDraft.selectedAddress
        })
      );
    } catch (caughtError) {
      setEnrichmentResponse(null);
      setEnrichmentError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  return {
    apiBaseUrl: apiClient.baseUrl,
    usesLocalFallback: matrivaApiConfig.usesLocalFallback,
    query,
    suggestions,
    selectedAddress,
    draftResponse,
    enrichmentResponse,
    enrichmentError,
    hasSearched,
    error,
    isSearching,
    isCreating,
    isEnriching,
    isBusy,
    canSearch,
    canCreate,
    canEnrich,
    updateQuery,
    selectAddress,
    searchAddressSuggestions,
    createFirstHouseDraft,
    enrichFirstHouseDraft
  };
}
