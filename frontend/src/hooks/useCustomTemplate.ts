/**
 * Custom Template Reducer & State Hook
 * Manages active template schema, field definitions, revisions, history stack,
 * dynamic values, and stepper navigation.
 */

import { useCallback, useReducer } from 'react';
import type {
  CertificateTemplate,
  TemplateField,
  NormalizedBox,
  TemplateRevision,
} from '../types/customTemplate';
import { postProcessDetectedFields, snapBox } from '../lib/templateAnalysis';
import { ensureMandatoryQrFields } from '../lib/qrHelper';

export type CustomStepperStep = 'upload' | 'detection' | 'fill' | 'edit_issue';

export interface CustomTemplateState {
  step: CustomStepperStep;
  template: CertificateTemplate | null;
  revisions: TemplateRevision[];
  activeRevisionId: string | null;
  selectedFieldKey: string | null;
  values: Record<string, string>;
  isAnalyzing: boolean;
  analysisError: string | null;
}

type Action =
  | { type: 'SET_STEP'; step: CustomStepperStep }
  | { type: 'SET_TEMPLATE'; template: CertificateTemplate; source: TemplateRevision['source']; title: string }
  | { type: 'UPDATE_FIELD_BOX'; key: string; box: NormalizedBox }
  | { type: 'UPDATE_FIELD'; field: TemplateField }
  | { type: 'ADD_FIELD'; box: NormalizedBox }
  | { type: 'DELETE_FIELD'; key: string }
  | { type: 'CONFIRM_CONFIDENCE'; key: string }
  | { type: 'SET_SELECTED_FIELD'; key: string | null }
  | { type: 'SET_VALUES'; values: Record<string, string> }
  | { type: 'SET_FIELD_VALUE'; key: string; value: string }
  | { type: 'RESTORE_REVISION'; revisionId: string }
  | { type: 'SET_ANALYZING'; isAnalyzing: boolean; error?: string | null };

function templateReducer(state: CustomTemplateState, action: Action): CustomTemplateState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'SET_TEMPLATE': {
      const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fieldsWithQr = ensureMandatoryQrFields(action.template.fields);
      const enrichedTemplate = { ...action.template, fields: fieldsWithQr };

      const newRev: TemplateRevision = {
        id: revisionId,
        title: action.title,
        timestamp: new Date().toISOString(),
        source: action.source,
        template: enrichedTemplate,
      };

      // Populate initial values from sampleText if empty
      const initialValues: Record<string, string> = { ...state.values };
      enrichedTemplate.fields.forEach((f) => {
        if (!initialValues[f.key] && f.sampleText) {
          initialValues[f.key] = f.sampleText;
        }
      });

      return {
        ...state,
        template: enrichedTemplate,
        revisions: [newRev, ...state.revisions],
        activeRevisionId: revisionId,
        selectedFieldKey: enrichedTemplate.fields[0]?.key || null,
        values: initialValues,
        analysisError: null,
      };
    }

    case 'UPDATE_FIELD_BOX': {
      if (!state.template) return state;
      const fields = state.template.fields.map((f) =>
        f.key === action.key ? { ...f, box: snapBox(action.box) } : f
      );
      return {
        ...state,
        template: { ...state.template, fields },
      };
    }

    case 'UPDATE_FIELD': {
      if (!state.template) return state;
      const fields = state.template.fields.map((f) =>
        f.key === action.field.key ? action.field : f
      );
      return {
        ...state,
        template: { ...state.template, fields },
      };
    }

    case 'ADD_FIELD': {
      if (!state.template) return state;
      const count = state.template.fields.length + 1;
      const newKey = `customField${count}`;
      const newField: TemplateField = {
        key: newKey,
        label: `Custom Field ${count}`,
        type: 'text',
        required: true,
        box: snapBox(action.box),
        style: {
          fontFamily: 'Plus Jakarta Sans',
          fontSize: Math.round(state.template.heightPx * 0.03),
          fontWeight: 600,
          color: '#1E293B',
          align: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
          minFontSize: 12,
          maxLines: 1,
          uppercase: false,
        },
        confidence: 1.0,
        source: 'issuer',
      };
      const fields = [...state.template.fields, newField];
      return {
        ...state,
        template: { ...state.template, fields },
        selectedFieldKey: newKey,
      };
    }

    case 'DELETE_FIELD': {
      if (!state.template) return state;
      // Protect mandatory QR code field from deletion
      const target = state.template.fields.find((f) => f.key === action.key);
      if (target?.type === 'qrCode') {
        return state;
      }
      const fields = state.template.fields.filter((f) => f.key !== action.key);
      return {
        ...state,
        template: { ...state.template, fields },
        selectedFieldKey: state.selectedFieldKey === action.key ? null : state.selectedFieldKey,
      };
    }

    case 'CONFIRM_CONFIDENCE': {
      if (!state.template) return state;
      const fields = state.template.fields.map((f) =>
        f.key === action.key ? { ...f, confidence: 1.0 } : f
      );
      return {
        ...state,
        template: { ...state.template, fields },
      };
    }

    case 'SET_SELECTED_FIELD':
      return { ...state, selectedFieldKey: action.key };

    case 'SET_VALUES':
      return { ...state, values: action.values };

    case 'SET_FIELD_VALUE':
      return {
        ...state,
        values: { ...state.values, [action.key]: action.value },
      };

    case 'RESTORE_REVISION': {
      const rev = state.revisions.find((r) => r.id === action.revisionId);
      if (!rev) return state;
      return {
        ...state,
        template: rev.template,
        activeRevisionId: rev.id,
      };
    }

    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.isAnalyzing, analysisError: action.error || null };

    default:
      return state;
  }
}

export function useCustomTemplate() {
  const [state, dispatch] = useReducer(templateReducer, {
    step: 'upload',
    template: null,
    revisions: [],
    activeRevisionId: null,
    selectedFieldKey: null,
    values: {},
    isAnalyzing: false,
    analysisError: null,
  });

  const setStep = useCallback((step: CustomStepperStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const setTemplate = useCallback(
    (template: CertificateTemplate, source: TemplateRevision['source'] = 'upload', title = 'Initial Upload') => {
      const processed = {
        ...template,
        fields: postProcessDetectedFields(template.fields),
      };
      dispatch({ type: 'SET_TEMPLATE', template: processed, source, title });
    },
    []
  );

  const updateFieldBox = useCallback((key: string, box: NormalizedBox) => {
    dispatch({ type: 'UPDATE_FIELD_BOX', key, box });
  }, []);

  const updateField = useCallback((field: TemplateField) => {
    dispatch({ type: 'UPDATE_FIELD', field });
  }, []);

  const addField = useCallback((box: NormalizedBox) => {
    dispatch({ type: 'ADD_FIELD', box });
  }, []);

  const deleteField = useCallback((key: string) => {
    dispatch({ type: 'DELETE_FIELD', key });
  }, []);

  const confirmConfidence = useCallback((key: string) => {
    dispatch({ type: 'CONFIRM_CONFIDENCE', key });
  }, []);

  const setSelectedFieldKey = useCallback((key: string | null) => {
    dispatch({ type: 'SET_SELECTED_FIELD', key });
  }, []);

  const setFieldValue = useCallback((key: string, value: string) => {
    dispatch({ type: 'SET_FIELD_VALUE', key, value });
  }, []);

  const setValues = useCallback((values: Record<string, string>) => {
    dispatch({ type: 'SET_VALUES', values });
  }, []);

  const restoreRevision = useCallback((revisionId: string) => {
    dispatch({ type: 'RESTORE_REVISION', revisionId });
  }, []);

  return {
    state,
    setStep,
    setTemplate,
    updateFieldBox,
    updateField,
    addField,
    deleteField,
    confirmConfidence,
    setSelectedFieldKey,
    setFieldValue,
    setValues,
    restoreRevision,
  };
}
