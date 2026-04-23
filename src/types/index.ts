export interface Operator {
  id: string;
  name: string;
  personal_number: string | null;
  created_at: string;
}

export interface Transmission {
  id: string;
  transmission_number: string;
  operator_id: string;
  completed_at: string;
  has_errors: boolean;
  errors: string[];
  photo_left: string;
  photo_right: string;
  created_by: string;
  created_at: string;
  archived: boolean;
  operators?: Operator;
}

export interface TransmissionForm {
  transmission_number: string;
  operator_id: string;
  completed_at: string;
  has_errors: boolean;
  errors: string[];
  files: [File, File];
}

export const ERROR_TYPES = ['Chyba typu A', 'Chyba typu B', 'Chyba typu C', 'Chyba typu D'];
