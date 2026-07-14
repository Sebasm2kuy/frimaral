// Tipos del dominio CALIRAL INSIGHT

export type Rol = 'ADMINISTRADOR' | 'COMERCIAL' | 'LECTOR'

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  ultimoLogin?: string
  createdAt: string
}

export interface Certificador {
  id: string
  nombre: string
  esCaliral: boolean
  cuit?: string
  activo: boolean
}

export interface Competidor {
  id: string
  nombre: string
  cuit?: string
  pais?: string
  activo: boolean
  totalOperaciones?: number
  totalPeso?: number
  totalClientes?: number
  clientesExclusivos?: number
  clientesCompartidos?: number
  captaciones?: number
  perdidas?: number
  crecimiento?: number
  participacion?: number
}

export interface Productor {
  id: string
  nombre: string
  cuit?: string
  razonSocial?: string
  pais: string
  provincia?: string
  localidad?: string
  activo: boolean
  estado?: EstadoCliente
  riskScore?: number
  riskLevel?: RiskLevel
  operacionesCaliralTotal?: number
  operacionesCompetenciaTotal?: number
  participacionCaliral?: number
  ultimaOperacionCaliral?: string
  primeraOperacionCaliral?: string
  competidoresUsados?: string[]
  recomendacion?: string
}

export interface Destino {
  id: string
  nombre: string
  pais: string
  region?: string
}

export interface Operacion {
  id: string
  productorId: string
  productorNombre?: string
  certificadorId?: string
  competidorId?: string
  competidorNombre?: string
  destinoId?: string
  destinoNombre?: string
  contenedorId?: string
  fecha: string
  periodo: string
  producto?: string
  cantidad: number
  pesoKg: number
  valorUsd: number
}

export interface Importacion {
  id: string
  fileName: string
  fileSize: number
  periodo: string
  status: 'PROCESANDO' | 'COMPLETADO' | 'ERROR' | 'PARCIAL'
  totalRows: number
  validRows: number
  duplicateRows: number
  errorRows: number
  hojasDetectadas?: string[]
  columnasDetectadas?: Record<string, string>
  errores?: string[]
  startedAt: string
  completedAt?: string
  uploadedBy?: string
}

export interface Historico {
  id: string
  productorId: string
  periodo: string
  operacionesCaliral: number
  pesoCaliral: number
  valorCaliral: number
  operacionesCompetencia: number
  pesoCompetencia: number
  valorCompetencia: number
  competidoresUsados: Array<{
    competidorId: string
    nombre: string
    operaciones: number
    peso: number
  }>
  estado: EstadoCliente
  riskScore: number
  riskLevel: RiskLevel
  riskFactores?: RiskFactores
  recomendacion?: string
}

export interface RiskFactores {
  disminucionOperaciones: number
  usoCompetidorCreciente: number
  tiempoSinOperar: number
  cambioCertificador: boolean
  cantidadCompetidores: number
  detalle: string[]
}

export interface Alerta {
  id: string
  tipo: TipoAlerta
  severidad: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS'
  productorId?: string
  productorNombre?: string
  competidorId?: string
  competidorNombre?: string
  periodo: string
  titulo: string
  mensaje: string
  datos?: Record<string, unknown>
  leida: boolean
  createdAt: string
}

export type EstadoCliente =
  | 'NUEVO'
  | 'ACTIVO'
  | 'EXCLUSIVO'
  | 'COMPARTIDO'
  | 'PERDIDO'
  | 'RECUPERADO'
  | 'INACTIVO'

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'

export type TipoAlerta =
  | 'CLIENTE_PERDIDO'
  | 'CLIENTE_RECUPERADO'
  | 'CLIENTE_NUEVO'
  | 'CLIENTE_COMPARTIDO'
  | 'RIESGO_ALTO'
  | 'RIESGO_CRITICO'
  | 'COMPETIDOR_CRECIMIENTO'
  | 'COMPETIDOR_CAPTACION'
  | 'MIGRACION'
  | 'DISMINUCION'

export interface RadarComercial {
  periodo: string
  fechaGeneracion: string
  conclusiones: RadarConclusion[]
  metricas: {
    totalProductores: number
    productoresActivos: number
    productoresExclusivos: number
    productoresCompartidos: number
    productoresPerdidos: number
    productoresRecuperados: number
    productoresNuevos: number
    totalOperacionesCaliral: number
    totalPesoCaliral: number
    participacionCaliral: number
    competidoresActivos: number
    clientesEnRiesgo: number
  }
  topCompetidores: Array<{
    competidor: Competidor
    crecimiento: number
    captaciones: number
  }>
  clientesEnRiesgo: Array<{
    productor: Productor
    riskScore: number
    riskLevel: RiskLevel
    motivo: string
  }>
}

export interface RadarConclusion {
  tipo: 'PERDIDA' | 'RECUPERACION' | 'CRECIMIENTO_COMPETIDOR' | 'RIESGO' | 'NUEVO' | 'COMPARTIDO' | 'DISMINUCION' | 'OPORTUNIDAD'
  icono: string
  titulo: string
  mensaje: string
  severidad: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS'
  datos?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  datos?: Record<string, unknown>
}

export interface AIResponse {
  content: string
  query: string
  datos?: Record<string, unknown>
  sources?: string[]
}

export type ReportFormat = 'excel' | 'pdf' | 'csv'
export type ReportType =
  | 'radar'
  | 'productores'
  | 'competidores'
  | 'riesgo'
  | 'alertas'
  | 'evolucion'
  | 'completo'
