import api from './api';
import type {
  Invoice,
  InvoiceItem,
  Customer,
  CreateInvoiceRequest,
  CreateInvoiceItemRequest,
  CreateCustomerRequest,
} from '../types/invoice';

export const invoiceService = {
  // Invoice operations
  getInvoices: async (): Promise<Invoice[]> => {
    const response = await api.get<Invoice[]>('/invoices');
    return Array.isArray(response.data) ? response.data : [];
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  createInvoice: async (data: CreateInvoiceRequest): Promise<Invoice> => {
    const response = await api.post<Invoice>('/invoices', data);
    return response.data;
  },

  updateInvoice: async (id: string, data: Partial<CreateInvoiceRequest>): Promise<Invoice> => {
    const response = await api.put<Invoice>(`/invoices/${id}`, data);
    return response.data;
  },

  deleteInvoice: async (id: string): Promise<void> => {
    await api.delete(`/invoices/${id}`);
  },

  // Invoice items operations
  getInvoiceItems: async (invoiceId: string): Promise<InvoiceItem[]> => {
    const response = await api.get<InvoiceItem[]>(`/invoice_items?invoice_id=${invoiceId}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  createInvoiceItem: async (data: CreateInvoiceItemRequest): Promise<InvoiceItem> => {
    const response = await api.post<InvoiceItem>('/invoice_items', data);
    return response.data;
  },

  updateInvoiceItem: async (id: string, data: Partial<CreateInvoiceItemRequest>): Promise<InvoiceItem> => {
    const response = await api.put<InvoiceItem>(`/invoice_items/${id}`, data);
    return response.data;
  },

  deleteInvoiceItem: async (id: string): Promise<void> => {
    await api.delete(`/invoice_items/${id}`);
  },

  // Customer operations
  getCustomers: async (): Promise<Customer[]> => {
    const response = await api.get<Customer[]>('/customers');
    return Array.isArray(response.data) ? response.data : [];
  },

  getCustomer: async (id: string): Promise<Customer> => {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  createCustomer: async (data: CreateCustomerRequest): Promise<Customer> => {
    const response = await api.post<Customer>('/customers', data);
    return response.data;
  },

  updateCustomer: async (id: string, data: Partial<CreateCustomerRequest>): Promise<Customer> => {
    const response = await api.put<Customer>(`/customers/${id}`, data);
    return response.data;
  },

  deleteCustomer: async (id: string): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },
};
