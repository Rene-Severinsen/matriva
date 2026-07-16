import type { HousePublicDataResponseV1 } from "@matriva/shared";

export const PUBLIC_DATA_MAPPING_VERSION = "house_public_data_mapping.v1";

export type JsonRecord = Record<string, unknown>;

export type DatafordelerNode = JsonRecord;

export type DatafordelerRawPayload = {
  addressId: string;
  effectiveAt: string;
  address: DatafordelerNode | null;
  addressBuilding: DatafordelerNode | null;
  ground: DatafordelerNode | null;
  buildings: DatafordelerNode[];
  unitsByBuildingId: Record<string, DatafordelerNode[]>;
  floorsByBuildingId: Record<string, DatafordelerNode[]>;
  partialErrors: Array<{
    phase: string;
    sourceId?: string;
    code: string;
    message: string;
  }>;
};

export type PublicDataNormalized = HousePublicDataResponseV1 & {
  rawPayloadHash: string;
};

export type PublicDataTarget =
  | {
      kind: "house";
      id: string;
      userId: string;
      addressLabel: string;
      darAddressId: string;
      darAccessAddressId: string | null;
    }
  | {
      kind: "house_draft";
      id: string;
      userId: string;
      addressLabel: string;
      darAddressId: string;
      darAccessAddressId: string | null;
    };
