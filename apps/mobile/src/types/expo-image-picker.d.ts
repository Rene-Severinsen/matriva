declare module "expo-image-picker" {
  export type ImagePickerAsset = {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number;
    width?: number;
    height?: number;
    base64?: string | null;
  };

  export type ImagePickerResult =
    | { canceled: true; assets?: null }
    | { canceled: false; assets: ImagePickerAsset[] };

  export const MediaTypeOptions: {
    Images: "Images";
  };

  export function requestMediaLibraryPermissionsAsync(): Promise<{
    granted: boolean;
  }>;

  export function requestCameraPermissionsAsync(): Promise<{
    granted: boolean;
  }>;

  export function launchImageLibraryAsync(options: {
    mediaTypes: "Images";
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    base64?: boolean;
  }): Promise<ImagePickerResult>;

  export function launchCameraAsync(options: {
    mediaTypes: "Images";
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    base64?: boolean;
  }): Promise<ImagePickerResult>;
}
