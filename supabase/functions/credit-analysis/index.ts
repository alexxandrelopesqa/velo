import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// URL da API de análise de crédito - configurável via variável de ambiente
const API_CREDIT_ANALYSIS_URL = Deno.env.get('API_CREDIT_ANALYSIS_URL') ||
  'https://uat-api.serasaexperian.com.br/consultas/v1/relato';
const API_CREDIT_ANALYSIS_TOKEN = Deno.env.get('API_CREDIT_ANALYSIS_TOKEN');
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN');

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  if (!API_CREDIT_ANALYSIS_TOKEN) {
    console.error('Missing API_CREDIT_ANALYSIS_TOKEN secret');
    return new Response(
      JSON.stringify({ error: 'Serviço indisponível' }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { cpf } = await req.json();

    if (!cpf) {
      return new Response(
        JSON.stringify({ error: 'CPF é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Remove máscara do CPF
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      return new Response(
        JSON.stringify({ error: 'CPF inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Calling credit analysis API for CPF: ${cpfClean.substring(0, 3)}***`);

    // Requisição para API real
    const response = await fetch(API_CREDIT_ANALYSIS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CREDIT_ANALYSIS_TOKEN}`,
      },
      body: JSON.stringify({
        documento: cpfClean,
        tipo_documento: 'CPF',
        parametros: {
          consultar_score: true,
          exibir_negativacoes: false,
        },
      }),
    });

    if (!response.ok) {
      console.error(`Credit API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: 'Erro na consulta de crédito' }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();

    // Valida resposta
    if (typeof data.score !== 'number') {
      console.error('Invalid response from credit API: missing score field');
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da API de crédito' }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Credit analysis completed. Score: ${data.score}`);

    return new Response(
      JSON.stringify({ 
        status: data.status || 'Done',
        score: data.score 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Credit analysis error:', error);
    
    // Timeout ou falha de rede
    return new Response(
      JSON.stringify({ error: 'Falha na comunicação com serviço de crédito' }),
      { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
