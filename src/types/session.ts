export type UserStep =
  | 'idle'
  | 'operator_login'
  | 'operator_password'
  | 'admin_menu'
  | 'operator_menu'
  | 'adding_mahalla_name'
  | 'adding_mahalla_login'
  | 'adding_mahalla_password'
  | 'export_menu'
  | 'export_mahalla_select'
  | 'family_street'
  | 'family_house'
  | 'family_apartment'
  | 'citizen_name'
  | 'citizen_gender'
  | 'citizen_birthdate'
  | 'citizen_jshshir'
  | 'citizen_doc_number'
  | 'citizen_phone'
  | 'citizen_marital'
  | 'citizen_education'
  | 'citizen_occupation'
  | 'citizen_confirm'
  | 'citizen_saved';

export interface UserSession {
  step: UserStep;
  role?: 'admin' | 'operator';
  mahallaId?: string;
  mahallaName?: string;
  activeFamilyId?: string;
  tempData: Record<string, string>;
}
