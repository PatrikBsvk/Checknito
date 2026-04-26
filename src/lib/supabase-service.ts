import { createClient } from './supabase';
import { Transmission, Operator } from '@/src/types';

const supabase = createClient();

export async function getOperators() {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching operators:', error);
    return [];
  }
  return data as Operator[];
}

export async function getTransmissions(
  archived: boolean = false,
  onlyOwn: boolean = false,
  search?: string
) {
  let query = supabase
    .from('transmissions')
    .select('*, operators(id, name, created_at)')
    .eq('archived', archived)
    .order('created_at', { ascending: false });

  if (onlyOwn) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id) {
      query = query.eq('created_by', sessionData.session.user.id);
    }
  }

  if (search) {
    query = query.or(
      `transmission_number.ilike.%${search}%,operators.name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching transmissions:', error);
    return [];
  }
  return data as Transmission[];
}

export async function getRecentTransmissions(onlyOwn: boolean = false, search?: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let query = supabase
    .from('transmissions')
    .select('*, operators(id, name, created_at)')
    .eq('archived', false)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (onlyOwn) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id) {
      query = query.eq('created_by', sessionData.session.user.id);
    }
  }

  if (search) {
    query = query.or(
      `transmission_number.ilike.%${search}%,operators.name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching recent transmissions:', error);
    return [];
  }
  return data as Transmission[];
}

export async function createTransmission(data: {
  transmission_number: string;
  model: string;
  operator_id: string;
  completed_at: string | null;
  carts_missing: boolean;
  has_errors: boolean;
  errors: string[];
  photo_left: string;
  photo_right: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user?.id) {
    throw new Error('User not authenticated');
  }

  const { data: transmission, error } = await supabase
    .from('transmissions')
    .insert({
      ...data,
      created_by: sessionData.session.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating transmission:', error);
    throw error;
  }
  return transmission;
}

export async function updateTransmission(
  id: string,
  updates: Partial<Transmission>
) {
  const { data, error } = await supabase
    .from('transmissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating transmission:', error);
    throw error;
  }
  return data;
}

export async function deleteTransmission(id: string) {
  // First, get the transmission to delete photos
  const { data: transmission } = await supabase
    .from('transmissions')
    .select('photo_left, photo_right')
    .eq('id', id)
    .single();

  if (transmission) {
    if (transmission.photo_left) {
      const leftPath = transmission.photo_left.split('/').pop();
      if (leftPath) {
        await supabase.storage
          .from('transmission-photos')
          .remove([leftPath]);
      }
    }
    if (transmission.photo_right) {
      const rightPath = transmission.photo_right.split('/').pop();
      if (rightPath) {
        await supabase.storage
          .from('transmission-photos')
          .remove([rightPath]);
      }
    }
  }

  const { error } = await supabase
    .from('transmissions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting transmission:', error);
    throw error;
  }
}

export async function archiveTransmission(id: string) {
  return updateTransmission(id, { archived: true });
}

export async function restoreTransmission(id: string) {
  return updateTransmission(id, { archived: false });
}

export async function uploadPhoto(file: File): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

  const { error } = await supabase.storage
    .from('transmission-photos')
    .upload(fileName, file);

  if (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from('transmission-photos')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export async function addOperator(
  input: string | { name: string; personal_number?: string | null }
) {
  // Back-compat: když přijde jen string, bereme ho jako jméno bez čísla.
  const payload = typeof input === 'string'
    ? { name: input, personal_number: null }
    : {
        name: input.name,
        personal_number: input.personal_number?.trim() || null,
      };

  const { data, error } = await supabase
    .from('operators')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error adding operator:', error);
    throw error;
  }
  return data as Operator;
}

export async function deleteOperator(id: string) {
  const { error } = await supabase
    .from('operators')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting operator:', error);
    throw error;
  }
}

export async function subscribeToTransmissions(
  callback: (transmission: Transmission) => void,
  onDelete?: (id: string) => void
) {
  const subscription = supabase
    .channel('transmissions-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'transmissions',
      },
      (payload) => {
        callback(payload.new as Transmission);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'transmissions',
      },
      (payload) => {
        if (onDelete) onDelete(payload.old.id);
      }
    )
    .subscribe();

  return subscription;
}

export async function subscribeToOperators(
  callback: (operator: Operator) => void,
  onDelete?: (id: string) => void
) {
  const subscription = supabase
    .channel('operators-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'operators',
      },
      (payload) => {
        callback(payload.new as Operator);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'operators',
      },
      (payload) => {
        if (onDelete) onDelete(payload.old.id);
      }
    )
    .subscribe();

  return subscription;
}
