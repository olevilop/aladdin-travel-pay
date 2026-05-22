export type Role = "admin" | "manager";

export type CompanyType = "ru" | "foreign";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
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

export interface LoginResponse {
  token: string;
  user: User;
}
