import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';
import type { MedicalProfile, MedicalProfileInput } from '../types';
import type { Database } from '../types/database.types';

type Row = Database['public']['Tables']['patient_medical_profiles']['Row'];

function toDomain(r: Row): MedicalProfile {
  return {
    clientId: r.client_id,
    allergies: r.allergies ?? undefined,
    medicalHistory: r.medical_history ?? undefined,
    medications: r.medications ?? undefined,
    importantNotes: r.important_notes ?? undefined,
    updatedAt: r.updated_at,
  };
}

/** Historial médico del paciente (null si no hay). La recepción no tiene acceso: recibirá null. */
export async function getMedicalProfile(clientId: string): Promise<ServiceResult<MedicalProfile | null>> {
  try {
    const { data, error } = await supabase.from('patient_medical_profiles').select('*').eq('client_id', clientId).maybeSingle();
    if (error) return fail(mapSupabaseError(error));
    return ok(data ? toDomain(data) : null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Guarda (crea o reemplaza) el historial médico. Solo dueño y doctores. */
export async function saveMedicalProfile(clientId: string, input: MedicalProfileInput): Promise<ServiceResult<MedicalProfile>> {
  try {
    const { data, error } = await supabase.rpc('save_patient_medical_profile', {
      p_client_id: clientId,
      p_allergies: input.allergies ?? null,
      p_medical_history: input.medicalHistory ?? null,
      p_medications: input.medications ?? null,
      p_important_notes: input.importantNotes ?? null,
    });
    if (error) return fail(mapAgendaError(error));
    return ok(toDomain(data));
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}
