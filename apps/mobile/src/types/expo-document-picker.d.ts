declare module "expo-document-picker" {
  export type DocumentPickerAsset = {
    name: string;
    size?: number;
    mimeType?: string;
    uri: string;
    base64?: string;
  };

  export type DocumentPickerResult =
    | { canceled: true; assets?: undefined }
    | { canceled: false; assets: DocumentPickerAsset[] };

  export function getDocumentAsync(options?: {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    base64?: boolean;
  }): Promise<DocumentPickerResult>;
}
