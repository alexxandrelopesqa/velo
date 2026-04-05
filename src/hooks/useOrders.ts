import { supabase } from '@/integrations/supabase/client';
import { Order, CarConfiguration, OptionalFeature } from '@/store/configuratorStore';

export interface DbOrder {
  id: string;
  order_number: string;
  color: string;
  wheel_type: string;
  optionals: string[] | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_cpf: string;
  payment_method: string;
  total_price: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PublicOrderRow {
  order_number: string;
  color: string;
  wheel_type: string;
  optionals: string[] | null;
  payment_method: string;
  total_price: number;
  status: string;
  created_at: string;
  customer_name_masked: string;
}

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function maskCpf(cpfDigits: string): string {
  return cpfDigits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function generateOrderNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'VLO-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function dbOrderToOrder(dbOrder: DbOrder): Order {
  const nameParts = dbOrder.customer_name.split(' ');
  const firstName = nameParts[0] || '';
  const surname = nameParts.slice(1).join(' ') || '';

  return {
    id: dbOrder.order_number,
    configuration: {
      exteriorColor: dbOrder.color as CarConfiguration['exteriorColor'],
      interiorColor: 'cream' as CarConfiguration['interiorColor'],
      wheelType: dbOrder.wheel_type as CarConfiguration['wheelType'],
      optionals: (dbOrder.optionals || []) as OptionalFeature[],
    },
    totalPrice: Number(dbOrder.total_price),
    customer: {
      name: firstName,
      surname: surname,
      email: dbOrder.customer_email,
      phone: dbOrder.customer_phone,
      cpf: dbOrder.customer_cpf,
      store: '',
    },
    paymentMethod: dbOrder.payment_method as 'avista' | 'financiamento',
    status: dbOrder.status as 'APROVADO' | 'REPROVADO' | 'EM_ANALISE',
    createdAt: dbOrder.created_at,
  };
}

function publicOrderToOrder(publicOrder: PublicOrderRow): Order {
  const nameParts = publicOrder.customer_name_masked.split(' ');
  const firstName = nameParts[0] || '';
  const surname = nameParts.slice(1).join(' ') || '';

  return {
    id: publicOrder.order_number,
    configuration: {
      exteriorColor: publicOrder.color as CarConfiguration['exteriorColor'],
      interiorColor: 'carbon-black' as CarConfiguration['interiorColor'],
      wheelType: publicOrder.wheel_type as CarConfiguration['wheelType'],
      optionals: (publicOrder.optionals || []) as OptionalFeature[],
    },
    totalPrice: Number(publicOrder.total_price),
    customer: {
      name: firstName,
      surname,
      email: '',
      phone: '',
      cpf: '',
      store: '',
    },
    paymentMethod: publicOrder.payment_method as 'avista' | 'financiamento',
    status: publicOrder.status as 'APROVADO' | 'REPROVADO' | 'EM_ANALISE',
    createdAt: publicOrder.created_at,
  };
}

export async function createOrder(orderData: {
  configuration: CarConfiguration;
  totalPrice: number;
  customer: {
    name: string;
    surname: string;
    email: string;
    phone: string;
    cpf: string;
    store: string;
  };
  paymentMethod: 'avista' | 'financiamento';
  status: 'APROVADO' | 'REPROVADO' | 'EM_ANALISE';
}): Promise<{ order: Order | null; error: string | null }> {
  const orderNumber = generateOrderNumber();

  const { data, error } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      color: orderData.configuration.exteriorColor,
      wheel_type: orderData.configuration.wheelType,
      optionals: orderData.configuration.optionals,
      customer_name: `${orderData.customer.name} ${orderData.customer.surname}`,
      customer_email: orderData.customer.email,
      customer_phone: orderData.customer.phone,
      customer_cpf: normalizeCpf(orderData.customer.cpf),
      payment_method: orderData.paymentMethod,
      total_price: orderData.totalPrice,
      status: orderData.status,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error);
    return { order: null, error: error.message };
  }

  const order = dbOrderToOrder(data as DbOrder);
  order.customer.store = orderData.customer.store;

  return { order, error: null };
}

export async function getOrderByNumber(orderNumber: string, cpf = ''): Promise<{ order: Order | null; error: string | null }> {
  const normalizedCpf = normalizeCpf(cpf);
  const formattedCpf = maskCpf(normalizedCpf);
  const normalizedOrderNumber = orderNumber.trim().toUpperCase();

  const { data, error } = await supabase
    .rpc('get_order_public', {
      p_order_number: normalizedOrderNumber,
      p_customer_cpf: normalizedCpf,
      p_customer_cpf_masked: formattedCpf,
    });

  if (error) {
    console.error('Error fetching order:', error);
    return { order: null, error: error.message };
  }

  const rows = (data || []) as PublicOrderRow[];
  const [row] = rows;
  if (!row) {
    return { order: null, error: null };
  }

  return { order: publicOrderToOrder(row), error: null };
}
