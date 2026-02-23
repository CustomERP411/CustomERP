export interface Customer {
  id: string;
  company_name: string;
  email: string;
  vat_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  subtotal: number;
  tax_total: number;
  grand_total: number;
  created_at?: string;
  updated_at?: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface CreateInvoiceRequest {
  invoice_number: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  subtotal?: number;
  tax_total?: number;
  grand_total?: number;
}

export interface CreateInvoiceItemRequest {
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export interface CreateCustomerRequest {
  company_name: string;
  email: string;
  vat_number?: string;
}
