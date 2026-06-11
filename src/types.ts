export type Role = "admin" | "manager" | "accountant";

export type CompanyType = "ru" | "foreign";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  can_access_contracts?: boolean;
  created_at: string;
}

export interface InvoiceFile {
  id: string;
  application_id: string;
  company_type: CompanyType;
  name: string;
  size: number;
  mime: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  is_paid: boolean;
  download_url?: string;
}

export interface Application {
  id: string;
  number: string;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  files: InvoiceFile[];
}

export type PaymentStatus = "empty" | "unpaid" | "partial" | "paid";

// ── Договора ─────────────────────────────────────────────────────────────────
export interface ContractCategory {
  id: string;
  company_type: CompanyType;
  name: string;
  created_at: string;
}

export interface ContractFieldFile {
  name: string;
  size: number;
  mime: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ContractField {
  id: string;
  document_id: string;
  slot: string | null; // null = пользовательское поле
  label: string;
  position: number;
  file: ContractFieldFile | null;
}

export interface ContractDocument {
  id: string;
  partner_id: string;
  title: string;
  position: number;
  created_at: string;
  fields: ContractField[];
}

export interface ContractPartner {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
  documents: ContractDocument[];
}

export interface LoginResponse {
  token: string;
  user: User;
}
