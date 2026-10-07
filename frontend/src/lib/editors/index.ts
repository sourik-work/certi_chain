/**
 * Design Editor Provider Abstraction
 * Defines common contract for external design tools (Canva Connect, Figma) and built-in Quick Editor.
 */

export interface DesignEditorProvider {
  id: 'canva' | 'figma' | 'builtin';
  name: string;
  description: string;
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  connect(): Promise<void>;
  sendTemplate(file: Blob, meta: { title: string }): Promise<{ editUrl?: string; sessionId: string }>;
  fetchEdited(sessionId: string): Promise<{ blob: Blob; mimeType: string }>;
  disconnect(): Promise<void>;
}
