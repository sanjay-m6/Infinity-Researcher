export interface SubsystemHealth {
  database: string;
  network_engine: string;
  scraper_pipeline: string;
  pdf_processor: string;
}

export interface HealthResponse {
  status: string;
  app_version: string;
  platform: string;
  backend_ready: boolean;
  uptime_secs: number;
  default_storage_dir: string;
  subsystems: SubsystemHealth;
}

export interface CommandError {
  code: string;
  message: string;
  retryable: boolean;
}
