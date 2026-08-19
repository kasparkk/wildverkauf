export type CutStatus = "available" | "reserved" | "sold";

export interface Animal {
  id: number;
  species: string;
  date_harvested: string;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
  cut_count?: number;
  cuts_available?: number;
  cuts?: Cut[];
}

export interface Cut {
  id: number;
  animal_id: number | null;
  name: string;
  weight_kg: number | null;
  price_per_kg: number | null;
  fixed_price: number | null;
  status: CutStatus;
  notes: string | null;
  created_at: string;
  packed_on: string | null;
  best_before: string | null;
  barcode: string | null;
  animal_species?: string;
  animal_date?: string;
}

export interface Settings {
  business_name: string;
  business_address: string;
  shelf_life_days: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  sale_count?: number;
  total_spent?: number;
  sales?: Sale[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  cut_id: number | null;
  description: string;
  weight_kg: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Sale {
  id: number;
  customer_id: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  date: string;
  payment_method: string;
  payment_status: "bezahlt" | "offen";
  notes: string | null;
  created_at: string;
  total?: number;
  items?: SaleItem[];
}

export interface Stats {
  inventory_value: number;
  cut_counts: Record<string, number>;
  revenue_this_month: number;
  open_payments: number;
  recent_sales: Sale[];
  animal_count: number;
  customer_count: number;
}
